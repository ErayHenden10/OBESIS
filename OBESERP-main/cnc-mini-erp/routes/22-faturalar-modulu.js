// FATURALAR MODÜLÜ
module.exports = function register(app, ctx) {
  var db = ctx.db;
  var dbGet = ctx.dbGet;
  var dbAll = ctx.dbAll;
  var dbRun = ctx.dbRun;
  var path = ctx.path;
  var rootDir = ctx.rootDir;
  var onlySuperAdmin = ctx.onlySuperAdmin;
  var addActivityLog = ctx.addActivityLog;

// ===============================
// FATURALAR MODÜLÜ
// ===============================

db.run(`
CREATE TABLE IF NOT EXISTS invoices (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  invoice_no TEXT,
  customer_id INTEGER,
  invoice_date DATE,
  due_date DATE,
  invoice_type TEXT DEFAULT 'Satış',
  subtotal REAL DEFAULT 0,
  vat_rate REAL DEFAULT 20,
  vat_amount REAL DEFAULT 0,
  total_amount REAL DEFAULT 0,
  status TEXT DEFAULT 'Beklemede',
  note TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
)
`);

db.run(`
CREATE TABLE IF NOT EXISTS invoice_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  invoice_id INTEGER,
  item_name TEXT,
  quantity REAL DEFAULT 0,
  unit TEXT DEFAULT 'Adet',
  unit_price REAL DEFAULT 0,
  vat_rate REAL DEFAULT 20,
  total_amount REAL DEFAULT 0
)
`);

app.get("/api/invoices", (req, res) => {
  db.all(`
    SELECT 
      i.*,
COALESCE(c.company_name, '-') AS customer_name    FROM invoices i
    LEFT JOIN customers c ON c.id = i.customer_id
    ORDER BY i.id DESC
  `, [], (err, rows) => {
    if (err) {
      console.error("Fatura listeleme hatası:", err);
      return res.status(500).json({ success: false, message: err.message });
    }

    res.json({ success: true, invoices: rows });
  });
});

app.get("/api/invoices/:id", (req, res) => {
  db.get(`
    SELECT 
      i.*,
      COALESCE(c.company_name, '-') AS customer_name,
      COALESCE(c.tax_no, '-') AS tax_no,
      COALESCE(c.tax_office, '-') AS tax_office,
      COALESCE(c.address, '-') AS address,
      COALESCE(c.phone, '-') AS phone,
      COALESCE(c.email, '-') AS email
    FROM invoices i
    LEFT JOIN customers c ON c.id = i.customer_id
    WHERE i.id = ?
  `, [req.params.id], (err, invoice) => {
    if (err) {
      console.error("Fatura detay hatası:", err);
      return res.status(500).json({ success: false, message: err.message });
    }

    if (!invoice) {
      return res.status(404).json({ success: false, message: "Fatura bulunamadı." });
    }

    db.all(`
      SELECT *
      FROM invoice_items
      WHERE invoice_id = ?
      ORDER BY id ASC
    `, [req.params.id], (err2, items) => {
      if (err2) {
        console.error("Fatura kalemleri hatası:", err2);
        return res.status(500).json({ success: false, message: err2.message });
      }

      res.json({
        success: true,
        invoice,
        items
      });
    });
  });
});

app.get("/api/stock-movements", (req, res) => {
  const sql = `
    SELECT 
      sm.*,
      s.stock_code,
      s.part_name,
      s.unit
    FROM stock_movements sm
    LEFT JOIN stocks s ON s.id = sm.stock_id
    ORDER BY sm.id DESC
  `;

  db.all(sql, [], (err, rows) => {
    if (err) {
      console.error("Stok hareketleri listeleme hatası:", err);
      return res.status(500).json({
        success: false,
        message: err.message
      });
    }

    res.json({
      success: true,
      movements: rows
    });
  });
});

// ===============================
// STOK HAREKETİ OLUŞTUR
// giriş, çıkış, sayım, hurda, transfer
// ===============================
app.post("/api/stock-movements", (req, res) => {
  const {
    stock_id,
    movement_type,
    quantity,
    description,
    created_by
  } = req.body;

  if (!stock_id || !movement_type || !quantity) {
    return res.status(400).json({
      success: false,
      message: "Malzeme, hareket tipi ve miktar zorunludur."
    });
  }

  db.get(`SELECT * FROM stocks WHERE id = ?`, [stock_id], (err, stock) => {
    if (err) {
      console.error("Stok sorgu hatası:", err);
      return res.status(500).json({
        success: false,
        message: err.message
      });
    }

    if (!stock) {
      return res.status(404).json({
        success: false,
        message: "Stok bulunamadı."
      });
    }

    const previousQuantity = Number(stock.quantity || 0);
    const qty = Number(quantity);
    let nextQuantity = previousQuantity;

    if (movement_type === "giris") {
      nextQuantity = previousQuantity + qty;
    } else if (
      movement_type === "cikis" ||
      movement_type === "hurda" ||
      movement_type === "transfer"
    ) {
      nextQuantity = previousQuantity - qty;
    } else if (movement_type === "sayim") {
      nextQuantity = qty;
    } else {
      return res.status(400).json({
        success: false,
        message: "Geçersiz hareket tipi."
      });
    }

    if (nextQuantity < 0) {
      return res.status(400).json({
        success: false,
        message: "Stok miktarı eksiye düşemez."
      });
    }

    const movementNo = "SH-" + Date.now();

    db.serialize(() => {
      db.run("BEGIN TRANSACTION");

      db.run(
        `
        INSERT INTO stock_movements (
          movement_no,
          stock_id,
          movement_type,
          quantity,
          previous_quantity,
          next_quantity,
          description,
          created_by
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `,
        [
          movementNo,
          stock_id,
          movement_type,
          qty,
          previousQuantity,
          nextQuantity,
          description || "",
          created_by || "Sistem"
        ],
        function (insertErr) {
          if (insertErr) {
            db.run("ROLLBACK");
            console.error("Stok hareketi kayıt hatası:", insertErr);
            return res.status(500).json({
              success: false,
              message: insertErr.message
            });
          }

          db.run(
            `UPDATE stocks SET quantity = ? WHERE id = ?`,
            [nextQuantity, stock_id],
            function (updateErr) {
              if (updateErr) {
                db.run("ROLLBACK");
                console.error("Stok güncelleme hatası:", updateErr);
                return res.status(500).json({
                  success: false,
                  message: updateErr.message
                });
              }

              db.run("COMMIT");

              res.json({
                success: true,
                message: "Stok hareketi başarıyla oluşturuldu.",
                movementNo,
                previousQuantity,
                nextQuantity
              });
            }
          );
        }
      );
    });
  });
});

};
