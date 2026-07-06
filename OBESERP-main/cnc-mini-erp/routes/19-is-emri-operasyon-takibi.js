// İŞ EMRİ OPERASYON TAKİBİ
module.exports = function register(app, ctx) {
  var db = ctx.db;
  var dbGet = ctx.dbGet;
  var dbAll = ctx.dbAll;
  var dbRun = ctx.dbRun;
  var path = ctx.path;
  var rootDir = ctx.rootDir;
  var onlySuperAdmin = ctx.onlySuperAdmin;
  var addActivityLog = ctx.addActivityLog;

// ======================================
// İŞ EMRİ OPERASYON TAKİBİ
// ======================================

db.run(`
CREATE TABLE IF NOT EXISTS work_order_operations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  work_order_id INTEGER NOT NULL,
  product_id INTEGER,
  operation_id INTEGER,
  sequence_no INTEGER,
  operation_code TEXT,
  operation_name TEXT,
  machine_type TEXT,
  planned_time REAL DEFAULT 0,
  status TEXT DEFAULT 'waiting',
  start_time TEXT,
  end_time TEXT,
  operator_name TEXT,
  description TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
)
`);

// İş emrine ait operasyonları listele
app.get("/api/work-orders/:workOrderId/operations", (req, res) => {
  const { workOrderId } = req.params;

  db.all(`
    SELECT *
    FROM work_order_operations
    WHERE work_order_id = ?
    ORDER BY sequence_no ASC, id ASC
  `, [workOrderId], (err, rows) => {
    if (err) {
      console.error("İş emri operasyon listeleme hatası:", err.message);

      return res.status(500).json({
        success: false,
        message: err.message,
        operations: []
      });
    }

    res.json({
      success: true,
      operations: rows || []
    });
  });
});

// Ürün rotasından iş emrine operasyon oluştur
app.post("/api/work-orders/:workOrderId/create-operations", (req, res) => {
  const { workOrderId } = req.params;

  db.get(`
    SELECT *
    FROM work_orders
    WHERE id = ?
  `, [workOrderId], (err, workOrder) => {
    if (err) {
      return res.status(500).json({
        success: false,
        message: err.message
      });
    }

    if (!workOrder) {
      return res.status(404).json({
        success: false,
        message: "İş emri bulunamadı."
      });
    }

    const productId =
      workOrder.product_id ||
      workOrder.stock_id ||
      workOrder.part_id ||
      null;

    if (!productId) {
      return res.status(400).json({
        success: false,
        message: "Bu iş emrinde ürün/stok bağlantısı bulunamadı. work_orders tablosunda product_id veya stock_id olmalı."
      });
    }

    db.get(`
      SELECT COUNT(*) AS count
      FROM work_order_operations
      WHERE work_order_id = ?
    `, [workOrderId], (err, existing) => {
      if (err) {
        return res.status(500).json({
          success: false,
          message: err.message
        });
      }

      if (existing && existing.count > 0) {
        return res.status(400).json({
          success: false,
          message: "Bu iş emri için operasyonlar zaten oluşturulmuş."
        });
      }

      db.all(`
        SELECT
          pr.product_id,
          pr.operation_id,
          pr.sequence_no,
          pr.planned_time,
          pr.description,
          o.operation_code,
          o.operation_name,
          o.machine_type
        FROM product_routes pr
        LEFT JOIN operations o ON o.id = pr.operation_id
        WHERE pr.product_id = ?
          AND IFNULL(pr.status, 'active') = 'active'
        ORDER BY pr.sequence_no ASC
      `, [productId], (err, routes) => {
        if (err) {
          return res.status(500).json({
            success: false,
            message: err.message
          });
        }

        if (!routes || routes.length === 0) {
          return res.status(404).json({
            success: false,
            message: "Bu ürün için rota bulunamadı. Önce Ürün Rotaları ekranından rota tanımla."
          });
        }

        const stmt = db.prepare(`
          INSERT INTO work_order_operations
          (
            work_order_id,
            product_id,
            operation_id,
            sequence_no,
            operation_code,
            operation_name,
            machine_type,
            planned_time,
            status,
            description
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'waiting', ?)
        `);

        routes.forEach(r => {
          stmt.run([
            workOrderId,
            r.product_id,
            r.operation_id,
            r.sequence_no,
            r.operation_code || "",
            r.operation_name || "",
            r.machine_type || "",
            Number(r.planned_time || 0),
            r.description || ""
          ]);
        });

        stmt.finalize(finalErr => {
          if (finalErr) {
            return res.status(500).json({
              success: false,
              message: finalErr.message
            });
          }

          if (typeof addActivityLog === "function") {
            addActivityLog(req, {
              moduleName: "İş Emri Operasyonları",
              actionType: "CREATE",
              description: "İş emri için rota operasyonları oluşturuldu.",
              recordId: workOrderId
            });
          }

          res.json({
            success: true,
            message: `${routes.length} operasyon iş emrine aktarıldı.`
          });
        });
      });
    });
  });
});

// Operasyon başlat
app.put("/api/work-order-operations/:id/start", (req, res) => {
  const { id } = req.params;
  const { operatorName } = req.body;

  db.get(`
    SELECT *
    FROM work_order_operations
    WHERE id = ?
  `, [id], (err, operation) => {
    if (err) {
      return res.status(500).json({
        success: false,
        message: err.message
      });
    }

    if (!operation) {
      return res.status(404).json({
        success: false,
        message: "Operasyon bulunamadı."
      });
    }

    if (operation.status !== "waiting") {
      return res.status(400).json({
        success: false,
        message: "Sadece bekleyen operasyon başlatılabilir."
      });
    }

    db.run(`
      UPDATE work_order_operations
      SET
        status = 'in_progress',
        start_time = datetime('now'),
        operator_name = ?
      WHERE id = ?
    `, [
      operatorName || req.headers["x-user-name"] || "Operatör",
      id
    ], function(err) {
      if (err) {
        return res.status(500).json({
          success: false,
          message: err.message
        });
      }

      if (typeof addActivityLog === "function") {
        addActivityLog(req, {
          moduleName: "İş Emri Operasyonları",
          actionType: "START",
          description: `${operation.operation_name} operasyonu başlatıldı.`,
          recordId: id
        });
      }

      res.json({
        success: true,
        message: "Operasyon başlatıldı."
      });
    });
  });
});

// Operasyon bitir
app.put("/api/work-order-operations/:id/finish", (req, res) => {
  const { id } = req.params;

  db.get(`
    SELECT *
    FROM work_order_operations
    WHERE id = ?
  `, [id], (err, operation) => {
    if (err) {
      return res.status(500).json({
        success: false,
        message: err.message
      });
    }

    if (!operation) {
      return res.status(404).json({
        success: false,
        message: "Operasyon bulunamadı."
      });
    }

    if (operation.status !== "in_progress") {
      return res.status(400).json({
        success: false,
        message: "Sadece devam eden operasyon bitirilebilir."
      });
    }

    db.run(`
      UPDATE work_order_operations
      SET
        status = 'completed',
        end_time = datetime('now')
      WHERE id = ?
    `, [id], function(err) {
      if (err) {
        return res.status(500).json({
          success: false,
          message: err.message
        });
      }

      if (typeof addActivityLog === "function") {
        addActivityLog(req, {
          moduleName: "İş Emri Operasyonları",
          actionType: "FINISH",
          description: `${operation.operation_name} operasyonu tamamlandı.`,
          recordId: id
        });
      }

      res.json({
        success: true,
        message: "Operasyon tamamlandı."
      });
    });
  });
});

};
