// SERİ / LOT MİKTAR DÜŞ
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
// SERİ / LOT MİKTAR DÜŞ
// ===============================
app.put("/api/serial-lot-tracking/:id/consume", (req, res) => {
  const { quantity } = req.body;

  if (!quantity || Number(quantity) <= 0) {
    return res.status(400).json({
      success:false,
      message:"Düşülecek miktar zorunludur."
    });
  }

  db.get(`
    SELECT *
    FROM serial_lot_tracking
    WHERE id = ?
  `, [req.params.id], (err, record) => {
    if (err) {
      console.error("Seri/lot sorgu hatası:", err);
      return res.status(500).json({ success:false, message:err.message });
    }

    if (!record) {
      return res.status(404).json({
        success:false,
        message:"Seri/lot kaydı bulunamadı."
      });
    }

    const currentQty = Number(record.remaining_quantity || 0);
    const consumeQty = Number(quantity);

    if (currentQty < consumeQty) {
      return res.status(400).json({
        success:false,
        message:"Kalan miktar yetersiz."
      });
    }

    const nextQty = currentQty - consumeQty;
    const newStatus = nextQty <= 0 ? "closed" : record.status;

    db.run(`
      UPDATE serial_lot_tracking
      SET remaining_quantity = ?, status = ?
      WHERE id = ?
    `, [nextQty, newStatus, req.params.id], function(updateErr) {
      if (updateErr) {
        console.error("Seri/lot miktar düşme hatası:", updateErr);
        return res.status(500).json({ success:false, message:updateErr.message });
      }

      res.json({
        success:true,
        message:"Seri/lot miktarı güncellendi."
      });
    });
  });
});

/* ================================
   SAYIM YÖNETİMİ BACKEND
   app.js içine ekle
================================ */

// TABLOLAR
db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS stock_counts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      count_no TEXT UNIQUE,
      warehouse_id INTEGER,
      warehouse_name TEXT,
      count_date DATE DEFAULT CURRENT_DATE,
      status TEXT DEFAULT 'Taslak',
      description TEXT,
      created_by TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      approved_by TEXT,
      approved_at DATETIME
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS stock_count_lines (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      count_id INTEGER,
      stock_id INTEGER,
      stock_code TEXT,
      part_name TEXT,
      system_quantity REAL DEFAULT 0,
      counted_quantity REAL DEFAULT 0,
      difference_quantity REAL DEFAULT 0,
      unit TEXT DEFAULT 'Adet',
      location TEXT,
      note TEXT,
      FOREIGN KEY(count_id) REFERENCES stock_counts(id)
    )
  `);
});

function generateCountNo() {
  return "SYM" + Date.now();
}

function dbAll(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => err ? reject(err) : resolve(rows));
  });
}

function dbGet(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => err ? reject(err) : resolve(row));
  });
}

function dbRun(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function(err) {
      if (err) reject(err);
      else resolve(this);
    });
  });
}

// SAYIM FİŞLERİ LİSTELE
app.get("/api/stock-counts", async (req, res) => {
  try {
    const rows = await dbAll(`
      SELECT 
        sc.*,
        COUNT(scl.id) AS line_count,
        IFNULL(SUM(CASE WHEN scl.difference_quantity != 0 THEN 1 ELSE 0 END), 0) AS diff_line_count
      FROM stock_counts sc
      LEFT JOIN stock_count_lines scl ON scl.count_id = sc.id
      GROUP BY sc.id
      ORDER BY sc.id DESC
    `);

    res.json({ success: true, counts: rows });
  } catch (err) {
    console.error("Sayım fişleri alınamadı:", err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// SAYIM FİŞİ DETAY
app.get("/api/stock-counts/:id", async (req, res) => {
  try {
    const count = await dbGet(`SELECT * FROM stock_counts WHERE id = ?`, [req.params.id]);

    if (!count) {
      return res.status(404).json({ success: false, message: "Sayım fişi bulunamadı." });
    }

    const lines = await dbAll(`
      SELECT *
      FROM stock_count_lines
      WHERE count_id = ?
      ORDER BY id ASC
    `, [req.params.id]);

    res.json({ success: true, count, lines });
  } catch (err) {
    console.error("Sayım detayı alınamadı:", err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// SAYIM FİŞİ OLUŞTUR
app.post("/api/stock-counts", async (req, res) => {
  try {
    const { warehouse_id, warehouse_name, count_date, description, created_by } = req.body;
    const countNo = generateCountNo();

    const result = await dbRun(`
      INSERT INTO stock_counts
      (count_no, warehouse_id, warehouse_name, count_date, description, created_by)
      VALUES (?, ?, ?, ?, ?, ?)
    `, [countNo, warehouse_id || null, warehouse_name || "Genel Depo", count_date || new Date().toISOString().slice(0, 10), description || "", created_by || "Sistem"]);

    res.json({ success: true, message: "Sayım fişi oluşturuldu.", id: result.lastID, count_no: countNo });
  } catch (err) {
    console.error("Sayım fişi oluşturma hatası:", err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// STOKLARI SAYIMA AKTAR
app.post("/api/stock-counts/:id/import-stocks", async (req, res) => {
  try {
    const countId = req.params.id;
    const count = await dbGet(`SELECT * FROM stock_counts WHERE id = ?`, [countId]);

    if (!count) return res.status(404).json({ success: false, message: "Sayım fişi bulunamadı." });
    if (count.status === "Onaylandı") return res.status(400).json({ success: false, message: "Onaylı sayım fişine stok aktarılamaz." });

    const exists = await dbGet(`SELECT COUNT(*) AS total FROM stock_count_lines WHERE count_id = ?`, [countId]);
    if (exists.total > 0) return res.status(400).json({ success: false, message: "Bu sayım fişine stoklar zaten aktarılmış." });

    const stocks = await dbAll(`
      SELECT id, stock_code, part_name, quantity, unit, location
      FROM stocks
      WHERE IFNULL(status, 'active') != 'passive'
      ORDER BY part_name ASC
    `);

    for (const s of stocks) {
      await dbRun(`
        INSERT INTO stock_count_lines
        (count_id, stock_id, stock_code, part_name, system_quantity, counted_quantity, difference_quantity, unit, location)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [countId, s.id, s.stock_code || "", s.part_name || "", Number(s.quantity || 0), Number(s.quantity || 0), 0, s.unit || "Adet", s.location || ""]);
    }

    res.json({ success: true, message: "Stoklar sayım fişine aktarıldı.", importedCount: stocks.length });
  } catch (err) {
    console.error("Stokları sayım fişine aktarma hatası:", err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// SAYILAN MİKTAR GÜNCELLE
app.put("/api/stock-count-lines/:lineId", async (req, res) => {
  try {
    const { counted_quantity, note } = req.body;

    const line = await dbGet(`
      SELECT scl.*, sc.status
      FROM stock_count_lines scl
      JOIN stock_counts sc ON sc.id = scl.count_id
      WHERE scl.id = ?
    `, [req.params.lineId]);

    if (!line) return res.status(404).json({ success: false, message: "Sayım satırı bulunamadı." });
    if (line.status === "Onaylandı") return res.status(400).json({ success: false, message: "Onaylı sayım satırı değiştirilemez." });

    const counted = Number(counted_quantity || 0);
    const systemQty = Number(line.system_quantity || 0);
    const diff = counted - systemQty;

    await dbRun(`
      UPDATE stock_count_lines
      SET counted_quantity = ?, difference_quantity = ?, note = ?
      WHERE id = ?
    `, [counted, diff, note || "", req.params.lineId]);

    res.json({ success: true, message: "Sayım satırı güncellendi.", difference_quantity: diff });
  } catch (err) {
    console.error("Sayım satırı güncelleme hatası:", err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// SAYIM ONAYLA
app.put("/api/stock-counts/:id/approve", async (req, res) => {
  try {
    const countId = req.params.id;
    const approvedBy = req.body.approved_by || req.headers["x-user-name"] || "Sistem";
    const count = await dbGet(`SELECT * FROM stock_counts WHERE id = ?`, [countId]);

    if (!count) return res.status(404).json({ success: false, message: "Sayım fişi bulunamadı." });
    if (count.status === "Onaylandı") return res.status(400).json({ success: false, message: "Bu sayım fişi zaten onaylanmış." });

    const lines = await dbAll(`SELECT * FROM stock_count_lines WHERE count_id = ?`, [countId]);
    if (!lines.length) return res.status(400).json({ success: false, message: "Sayım fişinde satır yok." });

    await dbRun("BEGIN TRANSACTION");

    try {
      for (const line of lines) {
        const diff = Number(line.difference_quantity || 0);
        if (diff === 0) continue;

        const stock = await dbGet(`SELECT * FROM stocks WHERE id = ?`, [line.stock_id]);
        if (!stock) continue;

        const previousQty = Number(stock.quantity || 0);
        const nextQty = Number(line.counted_quantity || 0);

        await dbRun(`UPDATE stocks SET quantity = ? WHERE id = ?`, [nextQty, line.stock_id]);

        await dbRun(`
          INSERT INTO stock_movements
          (movement_no, movement_date, stock_id, stock_code, part_name, movement_type, quantity, previous_stock, next_stock, description, created_by, created_at)
          VALUES (?, datetime('now'), ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
        `, [
          "HRK" + Date.now() + line.id,
          line.stock_id,
          line.stock_code || stock.stock_code || "",
          line.part_name || stock.part_name || "",
          diff > 0 ? "Sayım Fazlası" : "Sayım Eksiği",
          Math.abs(diff),
          previousQty,
          nextQty,
          `${count.count_no} numaralı sayım fişi onayı`,
          approvedBy
        ]);
      }

      await dbRun(`UPDATE stock_counts SET status = 'Onaylandı', approved_by = ?, approved_at = datetime('now') WHERE id = ?`, [approvedBy, countId]);
      await dbRun("COMMIT");
      res.json({ success: true, message: "Sayım fişi onaylandı ve stoklar güncellendi." });
    } catch (err) {
      await dbRun("ROLLBACK");
      throw err;
    }
  } catch (err) {
    console.error("Sayım onaylama hatası:", err);
    res.status(500).json({ success: false, message: err.message });
  }
});

/* ==========================================================
   DEPOLAR ARASI TRANSFER ONAYI BACKEND
   app.js içine ekle
   Not: Mevcut db ve app değişkenlerini kullanır.
========================================================== */

db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS transfer_approvals (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      transfer_id INTEGER NOT NULL,
      approved_by TEXT,
      approved_date DATETIME,
      status TEXT DEFAULT 'Onay Bekliyor',
      note TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS stock_transfer_lines (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      transfer_id INTEGER NOT NULL,
      stock_id INTEGER,
      stock_code TEXT,
      part_name TEXT,
      quantity REAL DEFAULT 0,
      unit TEXT DEFAULT 'Adet',
      source_location TEXT,
      target_location TEXT,
      note TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
});

/* Promise helperlar sende varsa tekrar ekleme */
function dbAll(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => err ? reject(err) : resolve(rows));
  });
}

function dbGet(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => err ? reject(err) : resolve(row));
  });
}

function dbRun(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function(err) {
      if (err) reject(err);
      else resolve(this);
    });
  });
}

function generateTransferNo() {
  return "TRF" + Date.now();
}

/* Transfer tablonda kolon eksikse güvenli şekilde ekler */
function ensureTransferColumns() {
  const columns = [
    ["transfer_no", "TEXT"],
    ["source_warehouse_id", "INTEGER"],
    ["target_warehouse_id", "INTEGER"],
    ["source_warehouse_name", "TEXT"],
    ["target_warehouse_name", "TEXT"],
    ["transfer_date", "DATE"],
    ["status", "TEXT DEFAULT 'Onay Bekliyor'"],
    ["description", "TEXT"],
    ["created_by", "TEXT"],
    ["approved_by", "TEXT"],
    ["approved_at", "DATETIME"],
    ["rejected_by", "TEXT"],
    ["rejected_at", "DATETIME"],
    ["reject_reason", "TEXT"],
    ["created_at", "DATETIME DEFAULT CURRENT_TIMESTAMP"]
  ];

  db.all(`PRAGMA table_info(stock_transfers)`, [], (err, rows) => {
    if (err) return;

    const existing = rows.map(r => r.name);

    columns.forEach(([name, type]) => {
      if (!existing.includes(name)) {
        db.run(`ALTER TABLE stock_transfers ADD COLUMN ${name} ${type}`, [], alterErr => {
          if (alterErr) console.log("Transfer kolon ekleme uyarısı:", name, alterErr.message);
        });
      }
    });
  });
}

db.run(`
  CREATE TABLE IF NOT EXISTS stock_transfers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    transfer_no TEXT UNIQUE,
    source_warehouse_id INTEGER,
    target_warehouse_id INTEGER,
    source_warehouse_name TEXT,
    target_warehouse_name TEXT,
    transfer_date DATE DEFAULT CURRENT_DATE,
    status TEXT DEFAULT 'Onay Bekliyor',
    description TEXT,
    created_by TEXT,
    approved_by TEXT,
    approved_at DATETIME,
    rejected_by TEXT,
    rejected_at DATETIME,
    reject_reason TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`, ensureTransferColumns);

/* TRANSFERLERİ LİSTELE */
app.get("/api/transfers", async (req, res) => {
  try {
    const rows = await dbAll(`
      SELECT 
        st.*,
        COUNT(stl.id) AS line_count,
        IFNULL(SUM(stl.quantity), 0) AS total_quantity
      FROM stock_transfers st
      LEFT JOIN stock_transfer_lines stl ON stl.transfer_id = st.id
      GROUP BY st.id
      ORDER BY st.id DESC
    `);

    res.json({ success: true, transfers: rows });
  } catch (err) {
    console.error("Transferler alınamadı:", err);
    res.status(500).json({ success: false, message: err.message });
  }
});

/* TRANSFER DETAY */
app.get("/api/transfers/:id", async (req, res) => {
  try {
    const transfer = await dbGet(`
      SELECT *
      FROM stock_transfers
      WHERE id = ?
    `, [req.params.id]);

    if (!transfer) {
      return res.status(404).json({
        success: false,
        message: "Transfer kaydı bulunamadı."
      });
    }

    const lines = await dbAll(`
      SELECT *
      FROM stock_transfer_lines
      WHERE transfer_id = ?
      ORDER BY id ASC
    `, [req.params.id]);

    res.json({ success: true, transfer, lines });
  } catch (err) {
    console.error("Transfer detay hatası:", err);
    res.status(500).json({ success: false, message: err.message });
  }
});

/* STOKLARI LİSTELE - sayfada malzeme seçimi için */
app.get("/api/transfer/stocks", async (req, res) => {
  try {
    const rows = await dbAll(`
      SELECT 
        id,
        stock_code,
        part_name,
        quantity,
        unit,
        location
      FROM stocks
      WHERE IFNULL(status, 'active') != 'passive'
      ORDER BY part_name ASC
    `);

    res.json({ success: true, stocks: rows });
  } catch (err) {
    console.error("Transfer stok listesi hatası:", err);
    res.status(500).json({ success: false, message: err.message });
  }
});

/* TRANSFER OLUŞTUR */
app.post("/api/transfers", async (req, res) => {
  try {
    const {
      source_warehouse_id,
      target_warehouse_id,
      source_warehouse_name,
      target_warehouse_name,
      transfer_date,
      description,
      created_by,
      lines
    } = req.body;

    if (!source_warehouse_name || !target_warehouse_name) {
      return res.status(400).json({
        success: false,
        message: "Kaynak depo ve hedef depo zorunludur."
      });
    }

    if (source_warehouse_name === target_warehouse_name) {
      return res.status(400).json({
        success: false,
        message: "Kaynak depo ile hedef depo aynı olamaz."
      });
    }

    if (!Array.isArray(lines) || lines.length === 0) {
      return res.status(400).json({
        success: false,
        message: "En az bir transfer satırı girilmelidir."
      });
    }

    await dbRun("BEGIN TRANSACTION");

    try {
      const transferNo = generateTransferNo();

      const result = await dbRun(`
        INSERT INTO stock_transfers
        (
          transfer_no,
          source_warehouse_id,
          target_warehouse_id,
          source_warehouse_name,
          target_warehouse_name,
          transfer_date,
          status,
          description,
          created_by
        )
        VALUES (?, ?, ?, ?, ?, ?, 'Onay Bekliyor', ?, ?)
      `, [
        transferNo,
        source_warehouse_id || null,
        target_warehouse_id || null,
        source_warehouse_name,
        target_warehouse_name,
        transfer_date || new Date().toISOString().slice(0, 10),
        description || "",
        created_by || "Sistem"
      ]);

      const transferId = result.lastID;

      for (const line of lines) {
        if (!line.stock_id || Number(line.quantity || 0) <= 0) {
          throw new Error("Transfer satırlarında malzeme ve miktar zorunludur.");
        }

        const stock = await dbGet(`
          SELECT *
          FROM stocks
          WHERE id = ?
        `, [line.stock_id]);

        if (!stock) {
          throw new Error("Seçilen stok bulunamadı.");
        }

        await dbRun(`
          INSERT INTO stock_transfer_lines
          (
            transfer_id,
            stock_id,
            stock_code,
            part_name,
            quantity,
            unit,
            source_location,
            target_location,
            note
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
          transferId,
          stock.id,
          stock.stock_code || "",
          stock.part_name || "",
          Number(line.quantity || 0),
          stock.unit || line.unit || "Adet",
          line.source_location || stock.location || "",
          line.target_location || target_warehouse_name || "",
          line.note || ""
        ]);
      }

      await dbRun(`
        INSERT INTO transfer_approvals
        (transfer_id, status, note)
        VALUES (?, 'Onay Bekliyor', 'Transfer onay bekliyor')
      `, [transferId]);

      await dbRun("COMMIT");

      res.json({
        success: true,
        message: "Transfer oluşturuldu ve onaya gönderildi.",
        id: transferId,
        transfer_no: transferNo
      });

    } catch (err) {
      await dbRun("ROLLBACK");
      throw err;
    }

  } catch (err) {
    console.error("Transfer oluşturma hatası:", err);
    res.status(500).json({ success: false, message: err.message });
  }
});

/* TRANSFER ONAYLA */
app.put("/api/transfers/:id/approve", async (req, res) => {
  try {
    const transferId = req.params.id;
    const approvedBy = req.body.approved_by || req.headers["x-user-name"] || "Sistem";

    const transfer = await dbGet(`
      SELECT *
      FROM stock_transfers
      WHERE id = ?
    `, [transferId]);

    if (!transfer) {
      return res.status(404).json({
        success: false,
        message: "Transfer kaydı bulunamadı."
      });
    }

    if (transfer.status === "Onaylandı") {
      return res.status(400).json({
        success: false,
        message: "Bu transfer zaten onaylanmış."
      });
    }

    if (transfer.status === "Reddedildi") {
      return res.status(400).json({
        success: false,
        message: "Reddedilmiş transfer onaylanamaz."
      });
    }

    const lines = await dbAll(`
      SELECT *
      FROM stock_transfer_lines
      WHERE transfer_id = ?
    `, [transferId]);

    if (!lines.length) {
      return res.status(400).json({
        success: false,
        message: "Transfer satırı bulunamadı."
      });
    }

    await dbRun("BEGIN TRANSACTION");

    try {
      for (const line of lines) {
        const stock = await dbGet(`
          SELECT *
          FROM stocks
          WHERE id = ?
        `, [line.stock_id]);

        if (!stock) {
          throw new Error(`${line.part_name || line.stock_code} stok kartı bulunamadı.`);
        }

        const qty = Number(line.quantity || 0);
        const previousQty = Number(stock.quantity || 0);

        if (previousQty < qty) {
          throw new Error(`${stock.part_name || stock.stock_code} için yeterli stok yok. Mevcut: ${previousQty}, İstenen: ${qty}`);
        }

        const nextQty = previousQty - qty;

        await dbRun(`
          UPDATE stocks
          SET quantity = ?
          WHERE id = ?
        `, [nextQty, stock.id]);

        await dbRun(`
          INSERT INTO stock_movements
          (
            movement_no,
            movement_date,
            stock_id,
            stock_code,
            part_name,
            movement_type,
            quantity,
            previous_stock,
            next_stock,
            description,
            created_by,
            created_at
          )
          VALUES (?, datetime('now'), ?, ?, ?, 'Transfer Çıkış', ?, ?, ?, ?, ?, datetime('now'))
        `, [
          "HRK" + Date.now() + line.id + "C",
          stock.id,
          stock.stock_code || "",
          stock.part_name || "",
          qty,
          previousQty,
          nextQty,
          `${transfer.transfer_no} - ${transfer.source_warehouse_name} → ${transfer.target_warehouse_name}`,
          approvedBy
        ]);

        /*
          Not:
          Tek stok kartında quantity tuttuğun için hedef depoya ayrı stok kartı açmıyoruz.
          Depo bazlı stok yapısına geçtiğinde burada target warehouse stok satırı artırılır.
          Şimdilik genel stoktan düşüp transfer hareketi logluyoruz.
        */

        await dbRun(`
          INSERT INTO stock_movements
          (
            movement_no,
            movement_date,
            stock_id,
            stock_code,
            part_name,
            movement_type,
            quantity,
            previous_stock,
            next_stock,
            description,
            created_by,
            created_at
          )
          VALUES (?, datetime('now'), ?, ?, ?, 'Transfer Giriş', ?, ?, ?, ?, ?, datetime('now'))
        `, [
          "HRK" + Date.now() + line.id + "G",
          stock.id,
          stock.stock_code || "",
          stock.part_name || "",
          qty,
          nextQty,
          nextQty,
          `${transfer.transfer_no} - ${transfer.target_warehouse_name} deposuna giriş kaydı`,
          approvedBy
        ]);
      }

      await dbRun(`
        UPDATE stock_transfers
        SET status = 'Onaylandı',
            approved_by = ?,
            approved_at = datetime('now')
        WHERE id = ?
      `, [approvedBy, transferId]);

      await dbRun(`
        UPDATE transfer_approvals
        SET status = 'Onaylandı',
            approved_by = ?,
            approved_date = datetime('now'),
            note = 'Transfer onaylandı'
        WHERE transfer_id = ?
      `, [approvedBy, transferId]);

      await dbRun("COMMIT");

      res.json({
        success: true,
        message: "Transfer onaylandı ve stok hareketleri oluşturuldu."
      });

    } catch (err) {
      await dbRun("ROLLBACK");
      throw err;
    }

  } catch (err) {
    console.error("Transfer onaylama hatası:", err);
    res.status(500).json({ success: false, message: err.message });
  }
});

/* TRANSFER REDDET */
app.put("/api/transfers/:id/reject", async (req, res) => {
  try {
    const transferId = req.params.id;
    const rejectedBy = req.body.rejected_by || req.headers["x-user-name"] || "Sistem";
    const rejectReason = req.body.reject_reason || "Sebep belirtilmedi";

    const transfer = await dbGet(`
      SELECT *
      FROM stock_transfers
      WHERE id = ?
    `, [transferId]);

    if (!transfer) {
      return res.status(404).json({
        success: false,
        message: "Transfer kaydı bulunamadı."
      });
    }

    if (transfer.status === "Onaylandı") {
      return res.status(400).json({
        success: false,
        message: "Onaylanmış transfer reddedilemez."
      });
    }

    await dbRun(`
      UPDATE stock_transfers
      SET status = 'Reddedildi',
          rejected_by = ?,
          rejected_at = datetime('now'),
          reject_reason = ?
      WHERE id = ?
    `, [rejectedBy, rejectReason, transferId]);

    await dbRun(`
      UPDATE transfer_approvals
      SET status = 'Reddedildi',
          approved_by = ?,
          approved_date = datetime('now'),
          note = ?
      WHERE transfer_id = ?
    `, [rejectedBy, rejectReason, transferId]);

    res.json({
      success: true,
      message: "Transfer reddedildi."
    });

  } catch (err) {
    console.error("Transfer reddetme hatası:", err);
    res.status(500).json({ success: false, message: err.message });
  }
});

/* TRANSFER SİL */
app.delete("/api/transfers/:id", async (req, res) => {
  try {
    const transfer = await dbGet(`
      SELECT *
      FROM stock_transfers
      WHERE id = ?
    `, [req.params.id]);

    if (!transfer) {
      return res.status(404).json({
        success: false,
        message: "Transfer kaydı bulunamadı."
      });
    }

    if (transfer.status === "Onaylandı") {
      return res.status(400).json({
        success: false,
        message: "Onaylanmış transfer silinemez."
      });
    }

    await dbRun(`DELETE FROM transfer_approvals WHERE transfer_id = ?`, [req.params.id]);
    await dbRun(`DELETE FROM stock_transfer_lines WHERE transfer_id = ?`, [req.params.id]);
    await dbRun(`DELETE FROM stock_transfers WHERE id = ?`, [req.params.id]);

    res.json({
      success: true,
      message: "Transfer silindi."
    });

  } catch (err) {
    console.error("Transfer silme hatası:", err);
    res.status(500).json({ success: false, message: err.message });
  }
});

const multer = require("multer");
const fs = require("fs");

const documentUploadDir = path.join(rootDir, "uploads", "documents");

if (!fs.existsSync(documentUploadDir)) {
  fs.mkdirSync(documentUploadDir, { recursive: true });
}

const documentStorage = multer.diskStorage({
  destination: function(req, file, cb) {
    cb(null, documentUploadDir);
  },
  filename: function(req, file, cb) {
    const safeOriginal = file.originalname
      .replace(/[^\wğüşöçıİĞÜŞÖÇ.\- ]/gi, "")
      .replace(/\s+/g, "_");

    cb(null, Date.now() + "_" + safeOriginal);
  }
});

const documentUpload = multer({
  storage: documentStorage,
  limits: {
    fileSize: 50 * 1024 * 1024
  },
  fileFilter: function(req, file, cb) {
const allowed = [
  ".pdf",
  ".dxf",
  ".dwg",
  ".step",
  ".stp",
  ".stl",
  ".igs",
  ".iges",
  ".x_t",
  ".x_b",
  ".sldprt",
  ".sldasm",
  ".ipt",
  ".iam",
  ".jpg",
  ".jpeg",
  ".png",
  ".webp",
  ".bmp",
  ".xlsx",
  ".xls",
  ".csv",
  ".docx",
  ".doc",
  ".txt",
  ".zip",
  ".rar",
  ".7z"
];


    const ext = path.extname(file.originalname).toLowerCase();

    if (!allowed.includes(ext)) {
      return cb(new Error("Bu dosya türüne izin verilmiyor."));
    }

    cb(null, true);
  }
});

db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS documents (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      document_no TEXT UNIQUE,
      work_order_id INTEGER,
      work_order_no TEXT,
      document_type TEXT,
      title TEXT NOT NULL,
      revision_no TEXT DEFAULT 'R0',
      file_name TEXT,
      original_file_name TEXT,
      file_path TEXT,
      file_ext TEXT,
      file_size INTEGER DEFAULT 0,
      description TEXT,
      status TEXT DEFAULT 'Aktif',
      uploaded_by TEXT,
      uploaded_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
});

function generateDocumentNo() {
  return "DOC" + Date.now();
}

/* Promise helperlar sende varsa tekrar ekleme */
function dbAll(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => err ? reject(err) : resolve(rows));
  });
}

function dbGet(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => err ? reject(err) : resolve(row));
  });
}

function dbRun(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function(err) {
      if (err) reject(err);
      else resolve(this);
    });
  });
}

/* ==========================================================
   MES LITE / OPERASYON TAKİBİ BACKEND
   app.js / server.js içine ekle
========================================================== */

db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS production_operations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      operation_no TEXT,
      work_order_id INTEGER NOT NULL,
      work_order_no TEXT,
      operation_name TEXT NOT NULL,
      machine_id INTEGER,
      machine_name TEXT,
      operator_id INTEGER,
      operator_name TEXT,
      planned_minutes INTEGER DEFAULT 0,
      actual_minutes INTEGER DEFAULT 0,
      start_time DATETIME,
      end_time DATETIME,
      status TEXT DEFAULT 'Beklemede',
      scrap_quantity REAL DEFAULT 0,
      good_quantity REAL DEFAULT 0,
      note TEXT,
      created_by TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME
    )
  `);
});

/* Promise helperlar sende varsa tekrar ekleme */
function dbAll(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => err ? reject(err) : resolve(rows));
  });
}

function dbGet(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => err ? reject(err) : resolve(row));
  });
}

function dbRun(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function(err) {
      if (err) reject(err);
      else resolve(this);
    });
  });
}

function generateOperationNo() {
  return "OPR" + Date.now();
}

/* İş emirleri select için */
app.get("/api/mes/work-orders", async (req, res) => {
  try {
    const rows = await dbAll(`
      SELECT 
        id,
        work_order_no,
        part_name,
        title,
        status,
        delivery_date,
        due_date
      FROM work_orders
      WHERE IFNULL(status, '') NOT IN ('Tamamlandı', 'completed', 'cancelled', 'İptal')
      ORDER BY id DESC
    `);

    res.json({ success: true, workOrders: rows });
  } catch (err) {
    console.error("MES iş emirleri alınamadı:", err);
    res.status(500).json({ success: false, message: err.message });
  }
});

/* Makine listesi select için - tablo yoksa boş döner */
app.get("/api/mes/machines", async (req, res) => {
  try {
    const table = await dbGet(`
      SELECT name 
      FROM sqlite_master 
      WHERE type='table' AND name='machines'
    `);

    if (!table) {
      return res.json({ success: true, machines: [] });
    }

    const rows = await dbAll(`
      SELECT 
        id,
        machine_name,
        name,
        code,
        status
      FROM machines
      ORDER BY id DESC
    `);

    res.json({
      success: true,
      machines: rows.map(m => ({
        id: m.id,
        machine_name: m.machine_name || m.name || m.code || ("Makine " + m.id),
        status: m.status || ""
      }))
    });
  } catch (err) {
    console.error("MES makineler alınamadı:", err);
    res.json({ success: true, machines: [] });
  }
});

};
