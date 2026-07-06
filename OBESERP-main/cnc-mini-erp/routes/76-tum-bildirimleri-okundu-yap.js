const documentUpload = require("../middlewares/documentUpload");
// TÜM BİLDİRİMLERİ OKUNDU YAP
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
// TÜM BİLDİRİMLERİ OKUNDU YAP
// ===============================
app.put("/api/notifications/read-all", (req, res) => {
  db.run(`
    UPDATE notifications
    SET is_read = 1
    WHERE is_read = 0
  `, [], function(err) {
    if (err) {
      console.error("Tüm bildirimleri okundu yapma hatası:", err);
      return res.status(500).json({
        success: false,
        message: err.message
      });
    }

    res.json({
      success: true,
      message: "Tüm bildirimler okundu olarak işaretlendi."
    });
  });
});

app.delete("/api/notifications/:id", (req, res) => {
  const id = req.params.id;

  db.run(`
    DELETE FROM notifications
    WHERE id = ?
  `, [id], function(err) {
    if (err) {
      console.error("Bildirim silme hatası:", err);
      return res.status(500).json({
        success: false,
        message: err.message
      });
    }

    res.json({
      success: true,
      message: "Bildirim silindi."
    });
  });
});


app.post("/api/notifications/demo/create", (req, res) => {
  const demoNotifications = [
    ["Stok Seviyesi Kritik", "ALM-001 minimum stok seviyesinin altına düştü.", "stock"],
    ["İş Emri Gecikti", "IE-2026-0045 teslim tarihi geçti.", "work_order"],
    ["Satın Alma Onayı Bekliyor", "SAT-0021 numaralı talep onay bekliyor.", "purchase"],
    ["Makine Bakımı Yaklaşıyor", "CNC-05 bakım tarihi yaklaşıyor.", "maintenance"]
  ];

  const stmt = db.prepare(`
    INSERT INTO notifications (title, message, type, is_read, created_by)
    VALUES (?, ?, ?, 0, 'Sistem')
  `);

  demoNotifications.forEach(n => {
    stmt.run(n[0], n[1], n[2]);
  });

  stmt.finalize();

  res.json({
    success: true,
    message: "Demo bildirimler oluşturuldu."
  });
});

function calculateMinutes(start, end) {
  if (!start || !end) return 0;

  const startDate = new Date(start);
  const endDate = new Date(end);

  if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) return 0;

  const diff = Math.floor((endDate - startDate) / 60000);

  return diff > 0 ? diff : 0;
}

/* DOKÜMAN DETAY */
app.get("/api/documents/:id", async (req, res) => {
  try {
    const document = await dbGet(`
      SELECT *
      FROM documents
      WHERE id = ?
    `, [req.params.id]);

    if (!document) {
      return res.status(404).json({
        success: false,
        message: "Doküman bulunamadı."
      });
    }

    res.json({ success: true, document });
  } catch (err) {
    console.error("Doküman detay hatası:", err);
    res.status(500).json({ success: false, message: err.message });
  }
});

/* DOKÜMAN YÜKLE */
app.post("/api/documents", documentUpload.single("file"), async (req, res) => {
  try {
    const {
      work_order_id,
      document_type,
      title,
      revision_no,
      description,
      uploaded_by
    } = req.body;

    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "Dosya seçilmelidir."
      });
    }

    if (!title) {
      return res.status(400).json({
        success: false,
        message: "Doküman başlığı zorunludur."
      });
    }

    let workOrderNo = "";

    if (work_order_id) {
      const wo = await dbGet(`
        SELECT work_order_no
        FROM work_orders
        WHERE id = ?
      `, [work_order_id]);

      workOrderNo = wo?.work_order_no || "";
    }

    const documentNo = generateDocumentNo();
    const ext = path.extname(req.file.originalname).toLowerCase();

    const result = await dbRun(`
      INSERT INTO documents
      (
        document_no,
        work_order_id,
        work_order_no,
        document_type,
        title,
        revision_no,
        file_name,
        original_file_name,
        file_path,
        file_ext,
        file_size,
        description,
        uploaded_by
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      documentNo,
      work_order_id || null,
      workOrderNo,
      document_type || "Genel",
      title,
      revision_no || "R0",
      req.file.filename,
      req.file.originalname,
      req.file.path,
      ext,
      req.file.size,
      description || "",
      uploaded_by || req.headers["x-user-name"] || "Sistem"
    ]);

    res.json({
      success: true,
      message: "Doküman yüklendi.",
      id: result.lastID,
      document_no: documentNo
    });

  } catch (err) {
    console.error("Doküman yükleme hatası:", err);

    if (req.file && req.file.path && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }

    res.status(500).json({ success: false, message: err.message });
  }
});

/* DOKÜMAN GÜNCELLE */
app.put("/api/documents/:id", async (req, res) => {
  try {
    const {
      work_order_id,
      document_type,
      title,
      revision_no,
      description,
      status
    } = req.body;

    const document = await dbGet(`
      SELECT *
      FROM documents
      WHERE id = ?
    `, [req.params.id]);

    if (!document) {
      return res.status(404).json({
        success: false,
        message: "Doküman bulunamadı."
      });
    }

    let workOrderNo = document.work_order_no || "";

    if (work_order_id) {
      const wo = await dbGet(`
        SELECT work_order_no
        FROM work_orders
        WHERE id = ?
      `, [work_order_id]);

      workOrderNo = wo?.work_order_no || "";
    }

    await dbRun(`
      UPDATE documents
      SET
        work_order_id = ?,
        work_order_no = ?,
        document_type = ?,
        title = ?,
        revision_no = ?,
        description = ?,
        status = ?
      WHERE id = ?
    `, [
      work_order_id || null,
      workOrderNo,
      document_type || document.document_type,
      title || document.title,
      revision_no || document.revision_no,
      description || "",
      status || document.status,
      req.params.id
    ]);

    res.json({
      success: true,
      message: "Doküman güncellendi."
    });

  } catch (err) {
    console.error("Doküman güncelleme hatası:", err);
    res.status(500).json({ success: false, message: err.message });
  }
});

/* DOKÜMAN İNDİR */
app.get("/api/documents/:id/download", async (req, res) => {
  try {
    const document = await dbGet(`
      SELECT *
      FROM documents
      WHERE id = ?
    `, [req.params.id]);

    if (!document) {
      return res.status(404).send("Doküman bulunamadı.");
    }

    if (!document.file_path || !fs.existsSync(document.file_path)) {
      return res.status(404).send("Dosya sunucuda bulunamadı.");
    }

    res.download(document.file_path, document.original_file_name || document.file_name);
  } catch (err) {
    console.error("Doküman indirme hatası:", err);
    res.status(500).send(err.message);
  }
});

/* DOKÜMAN PASİFLEŞTİR */
app.put("/api/documents/:id/archive", async (req, res) => {
  try {
    const document = await dbGet(`
      SELECT *
      FROM documents
      WHERE id = ?
    `, [req.params.id]);

    if (!document) {
      return res.status(404).json({
        success: false,
        message: "Doküman bulunamadı."
      });
    }

    await dbRun(`
      UPDATE documents
      SET status = 'Pasif'
      WHERE id = ?
    `, [req.params.id]);

    res.json({
      success: true,
      message: "Doküman pasifleştirildi."
    });

  } catch (err) {
    console.error("Doküman pasifleştirme hatası:", err);
    res.status(500).json({ success: false, message: err.message });
  }
});

/* DOKÜMAN SİL */
app.delete("/api/documents/:id", async (req, res) => {
  try {
    const document = await dbGet(`
      SELECT *
      FROM documents
      WHERE id = ?
    `, [req.params.id]);

    if (!document) {
      return res.status(404).json({
        success: false,
        message: "Doküman bulunamadı."
      });
    }

    if (document.file_path && fs.existsSync(document.file_path)) {
      fs.unlinkSync(document.file_path);
    }

    await dbRun(`
      DELETE FROM documents
      WHERE id = ?
    `, [req.params.id]);

    res.json({
      success: true,
      message: "Doküman silindi."
    });

  } catch (err) {
    console.error("Doküman silme hatası:", err);
    res.status(500).json({ success: false, message: err.message });
  }
});


// SAYIM FİŞİ SİL
app.delete("/api/stock-counts/:id", async (req, res) => {
  try {
    const count = await dbGet(`SELECT * FROM stock_counts WHERE id = ?`, [req.params.id]);
    if (!count) return res.status(404).json({ success: false, message: "Sayım fişi bulunamadı." });
    if (count.status === "Onaylandı") return res.status(400).json({ success: false, message: "Onaylı sayım fişi silinemez." });

    await dbRun(`DELETE FROM stock_count_lines WHERE count_id = ?`, [req.params.id]);
    await dbRun(`DELETE FROM stock_counts WHERE id = ?`, [req.params.id]);
    res.json({ success: true, message: "Sayım fişi silindi." });
  } catch (err) {
    console.error("Sayım fişi silme hatası:", err);
    res.status(500).json({ success: false, message: err.message });
  }
});



app.get("/api/dashboard/kpi-2", async (req, res) => {
  try {
    const kpi = {};

    db.get(`SELECT COUNT(*) AS count FROM work_orders WHERE status IN ('Beklemede','Üretimde','waiting','production','progress')`, [], (err, openWo) => {
      if (err) return res.status(500).json({ success:false, message:err.message });

      db.get(`SELECT COUNT(*) AS count FROM work_orders WHERE date(due_date) < date('now') AND status NOT IN ('Tamamlandı','completed','cancelled')`, [], (err, lateWo) => {
        if (err) return res.status(500).json({ success:false, message:err.message });

        db.get(`SELECT COUNT(*) AS count FROM stocks WHERE quantity <= min_quantity`, [], (err, criticalStock) => {
          if (err) return res.status(500).json({ success:false, message:err.message });

          db.get(`SELECT COUNT(*) AS count FROM purchase_requests WHERE status IN ('Beklemede','Planlandı','waiting','planned')`, [], (err, purchaseReq) => {
            if (err) return res.status(500).json({ success:false, message:err.message });

            db.get(`SELECT COUNT(*) AS count FROM purchase_orders WHERE status IN ('Onay Bekliyor','Beklemede','waiting','pending')`, [], (err, purchaseOrders) => {
              if (err) return res.status(500).json({ success:false, message:err.message });

              db.get(`SELECT IFNULL(SUM(total_amount),0) AS total FROM offers WHERE strftime('%Y-%m', offer_date) = strftime('%Y-%m', 'now')`, [], (err, monthlyOffers) => {
                if (err) return res.status(500).json({ success:false, message:err.message });

                db.get(`SELECT IFNULL(SUM(debit - credit),0) AS total FROM current_transactions`, [], (err, receivable) => {
                  if (err) return res.status(500).json({ success:false, message:err.message });

                  db.all(`
                    SELECT 
                      date(created_at) AS day,
                      COUNT(*) AS movementCount
                    FROM stock_movements
                    WHERE date(created_at) >= date('now','-6 day')
                    GROUP BY date(created_at)
                    ORDER BY date(created_at)
                  `, [], (err, stockChart) => {
                    if (err) return res.status(500).json({ success:false, message:err.message });

                    res.json({
                      success: true,
                      kpi: {
                        openWorkOrders: openWo.count,
                        lateWorkOrders: lateWo.count,
                        criticalStock: criticalStock.count,
                        pendingPurchaseRequests: purchaseReq.count,
                        pendingPurchaseOrders: purchaseOrders.count,
                        monthlyOfferTotal: monthlyOffers.total,
                        receivableTotal: receivable.total,
                        stockMovementChart: stockChart
                      }
                    });
                  });
                });
              });
            });
          });
        });
      });
    });
  } catch (error) {
    res.status(500).json({ success:false, message:error.message });
  }
});

};
