module.exports = (app, ctx) => {
  const db = ctx.db || ctx.database || ctx.sqlite || ctx;

  if (!db || typeof db.run !== "function") {
    console.error("83-mobil-operator: db bulunamadı. ctx içinde db yok.");
    return;
  }

  db.run(`
    CREATE TABLE IF NOT EXISTS operator_job_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      work_order_id INTEGER,
      work_order_no TEXT,
      operator_name TEXT NOT NULL,
      action_type TEXT NOT NULL,
      quantity INTEGER DEFAULT 0,
      note TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS operator_downtime_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      work_order_id INTEGER,
      work_order_no TEXT,
      operator_name TEXT NOT NULL,
      machine_name TEXT,
      reason TEXT NOT NULL,
      note TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS operator_quality_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      work_order_id INTEGER,
      work_order_no TEXT,
      operator_name TEXT NOT NULL,
      ok_qty INTEGER DEFAULT 0,
      scrap_qty INTEGER DEFAULT 0,
      quality_status TEXT DEFAULT 'Uygun',
      note TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  app.get("/api/mobile-operator/work-orders", (req, res) => {
    db.all(`
      SELECT 
        id,
        work_order_no,
        title,
        part_name,
        status,
        delivery_date
      FROM work_orders
      WHERE 
        status IS NULL
        OR status NOT IN ('Tamamlandı','İptal','İptal Edildi','Cancelled','Closed')
      ORDER BY id DESC
    `, [], (err, rows) => {
      if (err) {
        return res.status(500).json({ success: false, message: err.message });
      }

      res.json({ success: true, data: rows || [] });
    });
  });

  app.post("/api/mobile-operator/job-action", (req, res) => {
    const {
      work_order_id,
      work_order_no,
      operator_name,
      action_type,
      quantity,
      note
    } = req.body;

    if (!work_order_id || !work_order_no || !operator_name || !action_type) {
      return res.status(400).json({
        success: false,
        message: "İş emri, operatör ve işlem tipi zorunludur."
      });
    }

    if (!["START", "FINISH"].includes(action_type)) {
      return res.status(400).json({
        success: false,
        message: "Geçersiz işlem tipi."
      });
    }

    db.run(`
      INSERT INTO operator_job_logs (
        work_order_id,
        work_order_no,
        operator_name,
        action_type,
        quantity,
        note
      )
      VALUES (?, ?, ?, ?, ?, ?)
    `, [
      work_order_id,
      work_order_no,
      operator_name,
      action_type,
      Number(quantity || 0),
      note || ""
    ], function (err) {
      if (err) {
        return res.status(500).json({ success: false, message: err.message });
      }

      const insertedId = this && this.lastID ? this.lastID : null;
      const newStatus = action_type === "START" ? "Üretimde" : "Tamamlandı";

      db.run(`
        UPDATE work_orders
        SET status = ?
        WHERE id = ?
      `, [newStatus, work_order_id], (updateErr) => {
        if (updateErr) {
          return res.status(500).json({
            success: false,
            message: updateErr.message
          });
        }

        res.json({
          success: true,
          message: action_type === "START" ? "İş başlatıldı." : "İş tamamlandı.",
          id: insertedId
        });
      });
    });
  });

  app.post("/api/mobile-operator/downtime", (req, res) => {
    const {
      work_order_id,
      work_order_no,
      operator_name,
      machine_name,
      reason,
      note
    } = req.body;

    if (!work_order_id || !work_order_no || !operator_name || !reason) {
      return res.status(400).json({
        success: false,
        message: "İş emri, operatör ve duruş nedeni zorunludur."
      });
    }

    db.run(`
      INSERT INTO operator_downtime_logs (
        work_order_id,
        work_order_no,
        operator_name,
        machine_name,
        reason,
        note
      )
      VALUES (?, ?, ?, ?, ?, ?)
    `, [
      work_order_id,
      work_order_no,
      operator_name,
      machine_name || "",
      reason,
      note || ""
    ], function (err) {
      if (err) {
        return res.status(500).json({ success: false, message: err.message });
      }

      res.json({
        success: true,
        message: "Duruş bildirimi kaydedildi.",
        id: this && this.lastID ? this.lastID : null
      });
    });
  });

  app.post("/api/mobile-operator/quality", (req, res) => {
    const {
      work_order_id,
      work_order_no,
      operator_name,
      ok_qty,
      scrap_qty,
      quality_status,
      note
    } = req.body;

    if (!work_order_id || !work_order_no || !operator_name) {
      return res.status(400).json({
        success: false,
        message: "İş emri ve operatör zorunludur."
      });
    }

    db.run(`
      INSERT INTO operator_quality_logs (
        work_order_id,
        work_order_no,
        operator_name,
        ok_qty,
        scrap_qty,
        quality_status,
        note
      )
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [
      work_order_id,
      work_order_no,
      operator_name,
      Number(ok_qty || 0),
      Number(scrap_qty || 0),
      quality_status || "Uygun",
      note || ""
    ], function (err) {
      if (err) {
        return res.status(500).json({ success: false, message: err.message });
      }

      res.json({
        success: true,
        message: "Kalite kaydı oluşturuldu.",
        id: this && this.lastID ? this.lastID : null
      });
    });
  });

  app.get("/api/mobile-operator/logs", (req, res) => {
    const limit = Number(req.query.limit || 100);

    const sql = `
      SELECT 
        'JOB' AS log_type,
        id,
        work_order_id,
        work_order_no,
        operator_name,
        action_type AS action,
        quantity,
        NULL AS machine_name,
        NULL AS reason,
        NULL AS ok_qty,
        NULL AS scrap_qty,
        NULL AS quality_status,
        note,
        created_at
      FROM operator_job_logs

      UNION ALL

      SELECT
        'DOWNTIME' AS log_type,
        id,
        work_order_id,
        work_order_no,
        operator_name,
        NULL AS action,
        NULL AS quantity,
        machine_name,
        reason,
        NULL AS ok_qty,
        NULL AS scrap_qty,
        NULL AS quality_status,
        note,
        created_at
      FROM operator_downtime_logs

      UNION ALL

      SELECT
        'QUALITY' AS log_type,
        id,
        work_order_id,
        work_order_no,
        operator_name,
        NULL AS action,
        NULL AS quantity,
        NULL AS machine_name,
        NULL AS reason,
        ok_qty,
        scrap_qty,
        quality_status,
        note,
        created_at
      FROM operator_quality_logs

      ORDER BY created_at DESC
      LIMIT ?
    `;

    db.all(sql, [limit], (err, rows) => {
      if (err) {
        return res.status(500).json({ success: false, message: err.message });
      }

      res.json({
        success: true,
        data: rows || []
      });
    });
  });
};