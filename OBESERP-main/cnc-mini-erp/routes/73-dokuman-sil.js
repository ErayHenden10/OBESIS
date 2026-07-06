// DOKÜMAN SİL
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
// DOKÜMAN SİL
// ===============================
app.delete("/api/documents/:id", (req, res) => {
  db.get(`
    SELECT *
    FROM documents
    WHERE id = ?
  `, [req.params.id], (err, doc) => {
    if (err) {
      return res.status(500).json({
        success: false,
        message: err.message
      });
    }

    if (!doc) {
      return res.status(404).json({
        success: false,
        message: "Doküman bulunamadı."
      });
    }

    db.run(`
      DELETE FROM documents
      WHERE id = ?
    `, [req.params.id], function(deleteErr) {
      if (deleteErr) {
        return res.status(500).json({
          success: false,
          message: deleteErr.message
        });
      }

      const fullPath = path.join(rootDir, doc.file_path || "");

      if (doc.file_path && fs.existsSync(fullPath)) {
        fs.unlinkSync(fullPath);
      }

      res.json({
        success: true,
        message: "Doküman silindi."
      });
    });
  });
});

/* Operatör listesi select için - users tablosundan çeker */
app.get("/api/mes/operators", async (req, res) => {
  try {
    const rows = await dbAll(`
      SELECT 
        id,
        full_name,
        username,
        role,
        active
      FROM users
      WHERE IFNULL(active, 1) = 1
      ORDER BY full_name ASC
    `);

    res.json({
      success: true,
      operators: rows.map(u => ({
        id: u.id,
        operator_name: u.full_name || u.username || ("Kullanıcı " + u.id),
        role: u.role || ""
      }))
    });
  } catch (err) {
    console.error("MES operatörler alınamadı:", err);
    res.status(500).json({ success: false, message: err.message });
  }
});

/* Operasyonları listele */
app.get("/api/mes/operations", async (req, res) => {
  try {
    const { workOrderId, status, q } = req.query;

    const where = [];
    const params = [];

    if (workOrderId) {
      where.push("work_order_id = ?");
      params.push(workOrderId);
    }

    if (status) {
      where.push("status = ?");
      params.push(status);
    }

    if (q) {
      where.push(`(
        operation_no LIKE ? OR
        work_order_no LIKE ? OR
        operation_name LIKE ? OR
        machine_name LIKE ? OR
        operator_name LIKE ?
      )`);
      params.push(`%${q}%`, `%${q}%`, `%${q}%`, `%${q}%`, `%${q}%`);
    }

    const whereSql = where.length ? "WHERE " + where.join(" AND ") : "";

    const rows = await dbAll(`
      SELECT *
      FROM production_operations
      ${whereSql}
      ORDER BY 
        CASE status
          WHEN 'Çalışıyor' THEN 1
          WHEN 'Beklemede' THEN 2
          WHEN 'Durdu' THEN 3
          WHEN 'Tamamlandı' THEN 4
          ELSE 5
        END,
        id DESC
    `, params);

    res.json({ success: true, operations: rows });
  } catch (err) {
    console.error("MES operasyonları alınamadı:", err);
    res.status(500).json({ success: false, message: err.message });
  }
});

/* MES KPI */
app.get("/api/mes/kpi", async (req, res) => {
  try {
    const total = await dbGet(`SELECT COUNT(*) AS c FROM production_operations`);
    const waiting = await dbGet(`SELECT COUNT(*) AS c FROM production_operations WHERE status = 'Beklemede'`);
    const running = await dbGet(`SELECT COUNT(*) AS c FROM production_operations WHERE status = 'Çalışıyor'`);
    const completed = await dbGet(`SELECT COUNT(*) AS c FROM production_operations WHERE status = 'Tamamlandı'`);
    const stopped = await dbGet(`SELECT COUNT(*) AS c FROM production_operations WHERE status = 'Durdu'`);

    const time = await dbGet(`
      SELECT 
        IFNULL(SUM(planned_minutes), 0) AS planned,
        IFNULL(SUM(actual_minutes), 0) AS actual,
        IFNULL(SUM(scrap_quantity), 0) AS scrap,
        IFNULL(SUM(good_quantity), 0) AS good
      FROM production_operations
    `);

    const progress = total.c > 0 ? Math.round((completed.c / total.c) * 100) : 0;

    res.json({
      success: true,
      kpi: {
        total: total.c,
        waiting: waiting.c,
        running: running.c,
        completed: completed.c,
        stopped: stopped.c,
        plannedMinutes: time.planned,
        actualMinutes: time.actual,
        scrapQuantity: time.scrap,
        goodQuantity: time.good,
        progress
      }
    });
  } catch (err) {
    console.error("MES KPI alınamadı:", err);
    res.status(500).json({ success: false, message: err.message });
  }
});

/* Operasyon oluştur */
app.post("/api/mes/operations", async (req, res) => {
  try {
    const {
      work_order_id,
      operation_name,
      machine_id,
      machine_name,
      operator_id,
      operator_name,
      planned_minutes,
      note,
      created_by
    } = req.body;

    if (!work_order_id) {
      return res.status(400).json({ success: false, message: "İş emri zorunludur." });
    }

    if (!operation_name) {
      return res.status(400).json({ success: false, message: "Operasyon adı zorunludur." });
    }

    const wo = await dbGet(`
      SELECT *
      FROM work_orders
      WHERE id = ?
    `, [work_order_id]);

    if (!wo) {
      return res.status(404).json({ success: false, message: "İş emri bulunamadı." });
    }

    const operationNo = generateOperationNo();

    const result = await dbRun(`
      INSERT INTO production_operations
      (
        operation_no,
        work_order_id,
        work_order_no,
        operation_name,
        machine_id,
        machine_name,
        operator_id,
        operator_name,
        planned_minutes,
        status,
        note,
        created_by
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'Beklemede', ?, ?)
    `, [
      operationNo,
      work_order_id,
      wo.work_order_no || "",
      operation_name,
      machine_id || null,
      machine_name || "",
      operator_id || null,
      operator_name || "",
      Number(planned_minutes || 0),
      note || "",
      created_by || req.headers["x-user-name"] || "Sistem"
    ]);

    res.json({
      success: true,
      message: "Operasyon oluşturuldu.",
      id: result.lastID,
      operation_no: operationNo
    });

  } catch (err) {
    console.error("MES operasyon oluşturma hatası:", err);
    res.status(500).json({ success: false, message: err.message });
  }
});

/* Toplu standart operasyon oluştur */
app.post("/api/mes/operations/create-standard", async (req, res) => {
  try {
    const { work_order_id, created_by } = req.body;

    if (!work_order_id) {
      return res.status(400).json({ success: false, message: "İş emri zorunludur." });
    }

    const wo = await dbGet(`
      SELECT *
      FROM work_orders
      WHERE id = ?
    `, [work_order_id]);

    if (!wo) {
      return res.status(404).json({ success: false, message: "İş emri bulunamadı." });
    }

    const exists = await dbGet(`
      SELECT COUNT(*) AS c
      FROM production_operations
      WHERE work_order_id = ?
    `, [work_order_id]);

    if (exists.c > 0) {
      return res.status(400).json({
        success: false,
        message: "Bu iş emrine daha önce operasyon tanımlanmış."
      });
    }

    const standardOperations = [
      { name: "Kesim", minutes: 60 },
      { name: "Torna", minutes: 120 },
      { name: "Freze", minutes: 120 },
      { name: "Kalite Kontrol", minutes: 30 },
      { name: "Paketleme", minutes: 30 }
    ];

    await dbRun("BEGIN TRANSACTION");

    try {
      for (const op of standardOperations) {
        await dbRun(`
          INSERT INTO production_operations
          (
            operation_no,
            work_order_id,
            work_order_no,
            operation_name,
            planned_minutes,
            status,
            created_by
          )
          VALUES (?, ?, ?, ?, ?, 'Beklemede', ?)
        `, [
          generateOperationNo() + Math.floor(Math.random() * 999),
          work_order_id,
          wo.work_order_no || "",
          op.name,
          op.minutes,
          created_by || req.headers["x-user-name"] || "Sistem"
        ]);
      }

      await dbRun("COMMIT");

      res.json({
        success: true,
        message: "Standart operasyonlar oluşturuldu.",
        count: standardOperations.length
      });

    } catch (err) {
      await dbRun("ROLLBACK");
      throw err;
    }

  } catch (err) {
    console.error("Standart operasyon oluşturma hatası:", err);
    res.status(500).json({ success: false, message: err.message });
  }
});

/* Operasyon güncelle */
app.put("/api/mes/operations/:id", async (req, res) => {
  try {
    const {
      operation_name,
      machine_id,
      machine_name,
      operator_id,
      operator_name,
      planned_minutes,
      good_quantity,
      scrap_quantity,
      note
    } = req.body;

    const op = await dbGet(`
      SELECT *
      FROM production_operations
      WHERE id = ?
    `, [req.params.id]);

    if (!op) {
      return res.status(404).json({ success: false, message: "Operasyon bulunamadı." });
    }

    if (op.status === "Tamamlandı") {
      return res.status(400).json({ success: false, message: "Tamamlanan operasyon düzenlenemez." });
    }

    await dbRun(`
      UPDATE production_operations
      SET
        operation_name = ?,
        machine_id = ?,
        machine_name = ?,
        operator_id = ?,
        operator_name = ?,
        planned_minutes = ?,
        good_quantity = ?,
        scrap_quantity = ?,
        note = ?,
        updated_at = datetime('now')
      WHERE id = ?
    `, [
      operation_name || op.operation_name,
      machine_id || null,
      machine_name || "",
      operator_id || null,
      operator_name || "",
      Number(planned_minutes || 0),
      Number(good_quantity || 0),
      Number(scrap_quantity || 0),
      note || "",
      req.params.id
    ]);

    res.json({ success: true, message: "Operasyon güncellendi." });

  } catch (err) {
    console.error("MES operasyon güncelleme hatası:", err);
    res.status(500).json({ success: false, message: err.message });
  }
});

/* Operasyon başlat */
app.put("/api/mes/operations/:id/start", async (req, res) => {
  try {
    const op = await dbGet(`
      SELECT *
      FROM production_operations
      WHERE id = ?
    `, [req.params.id]);

    if (!op) {
      return res.status(404).json({ success: false, message: "Operasyon bulunamadı." });
    }

    if (op.status === "Tamamlandı") {
      return res.status(400).json({ success: false, message: "Tamamlanan operasyon başlatılamaz." });
    }

    await dbRun(`
      UPDATE production_operations
      SET
        status = 'Çalışıyor',
        start_time = COALESCE(start_time, datetime('now')),
        updated_at = datetime('now')
      WHERE id = ?
    `, [req.params.id]);

    await dbRun(`
      UPDATE work_orders
      SET status = 'Üretimde'
      WHERE id = ?
    `, [op.work_order_id]).catch(() => {});

    res.json({ success: true, message: "Operasyon başlatıldı." });

  } catch (err) {
    console.error("MES operasyon başlatma hatası:", err);
    res.status(500).json({ success: false, message: err.message });
  }
});

/* Operasyon durdur */
app.put("/api/mes/operations/:id/stop", async (req, res) => {
  try {
    const op = await dbGet(`
      SELECT *
      FROM production_operations
      WHERE id = ?
    `, [req.params.id]);

    if (!op) {
      return res.status(404).json({ success: false, message: "Operasyon bulunamadı." });
    }

    if (op.status !== "Çalışıyor") {
      return res.status(400).json({ success: false, message: "Sadece çalışan operasyon durdurulabilir." });
    }

    const diff = await dbGet(`
      SELECT CAST((julianday('now') - julianday(?)) * 24 * 60 AS INTEGER) AS minutes
    `, [op.start_time]);

    const extraMinutes = Number(diff?.minutes || 0);
    const totalActual = Number(op.actual_minutes || 0) + Math.max(extraMinutes, 0);

    await dbRun(`
      UPDATE production_operations
      SET
        status = 'Durdu',
        actual_minutes = ?,
        updated_at = datetime('now')
      WHERE id = ?
    `, [totalActual, req.params.id]);

    res.json({ success: true, message: "Operasyon durduruldu.", actual_minutes: totalActual });

  } catch (err) {
    console.error("MES operasyon durdurma hatası:", err);
    res.status(500).json({ success: false, message: err.message });
  }
});

/* Operasyon tamamla */
app.put("/api/mes/operations/:id/complete", async (req, res) => {
  try {
    const {
      good_quantity,
      scrap_quantity,
      note
    } = req.body;

    const op = await dbGet(`
      SELECT *
      FROM production_operations
      WHERE id = ?
    `, [req.params.id]);

    if (!op) {
      return res.status(404).json({ success: false, message: "Operasyon bulunamadı." });
    }

    if (op.status === "Tamamlandı") {
      return res.status(400).json({ success: false, message: "Operasyon zaten tamamlanmış." });
    }

    let totalActual = Number(op.actual_minutes || 0);

    if (op.status === "Çalışıyor" && op.start_time) {
      const diff = await dbGet(`
        SELECT CAST((julianday('now') - julianday(?)) * 24 * 60 AS INTEGER) AS minutes
      `, [op.start_time]);

      totalActual += Math.max(Number(diff?.minutes || 0), 0);
    }

    await dbRun(`
      UPDATE production_operations
      SET
        status = 'Tamamlandı',
        end_time = datetime('now'),
        actual_minutes = ?,
        good_quantity = ?,
        scrap_quantity = ?,
        note = ?,
        updated_at = datetime('now')
      WHERE id = ?
    `, [
      totalActual,
      Number(good_quantity || op.good_quantity || 0),
      Number(scrap_quantity || op.scrap_quantity || 0),
      note || op.note || "",
      req.params.id
    ]);

    const remaining = await dbGet(`
      SELECT COUNT(*) AS c
      FROM production_operations
      WHERE work_order_id = ?
        AND status != 'Tamamlandı'
    `, [op.work_order_id]);

    if (remaining.c === 0) {
      await dbRun(`
        UPDATE work_orders
        SET status = 'Tamamlandı'
        WHERE id = ?
      `, [op.work_order_id]).catch(() => {});
    }

    res.json({ success: true, message: "Operasyon tamamlandı.", actual_minutes: totalActual });

  } catch (err) {
    console.error("MES operasyon tamamlama hatası:", err);
    res.status(500).json({ success: false, message: err.message });
  }
});

/* Operasyon sil */
app.delete("/api/mes/operations/:id", async (req, res) => {
  try {
    const op = await dbGet(`
      SELECT *
      FROM production_operations
      WHERE id = ?
    `, [req.params.id]);

    if (!op) {
      return res.status(404).json({ success: false, message: "Operasyon bulunamadı." });
    }

    if (op.status === "Çalışıyor") {
      return res.status(400).json({ success: false, message: "Çalışan operasyon silinemez." });
    }

    await dbRun(`
      DELETE FROM production_operations
      WHERE id = ?
    `, [req.params.id]);

    res.json({ success: true, message: "Operasyon silindi." });

  } catch (err) {
    console.error("MES operasyon silme hatası:", err);
    res.status(500).json({ success: false, message: err.message });
  }
});
/* ==========================================================
   KALİBRASYON YÖNETİMİ BACKEND
   app.js / server.js içine ekle
========================================================== */

db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS calibration_devices (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      device_no TEXT UNIQUE,
      device_name TEXT NOT NULL,
      device_type TEXT,
      serial_no TEXT,
      brand TEXT,
      model TEXT,
      location TEXT,
      responsible_person TEXT,
      last_calibration_date DATE,
      next_calibration_date DATE,
      calibration_period_month INTEGER DEFAULT 12,
      status TEXT DEFAULT 'Aktif',
      description TEXT,
      created_by TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS calibration_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      device_id INTEGER NOT NULL,
      calibration_date DATE NOT NULL,
      next_calibration_date DATE,
      certificate_no TEXT,
      result TEXT DEFAULT 'Uygun',
      calibration_company TEXT,
      document_id INTEGER,
      document_no TEXT,
      file_name TEXT,
      file_path TEXT,
      note TEXT,
      created_by TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(device_id) REFERENCES calibration_devices(id)
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

function generateCalibrationDeviceNo() {
  return "KLB" + Date.now();
}

/* CİHAZLARI LİSTELE */
app.get("/api/calibration/devices", async (req, res) => {
  try {
    const { status, q, alert } = req.query;

    const where = [];
    const params = [];

    if (status) {
      where.push("status = ?");
      params.push(status);
    }

    if (q) {
      where.push(`(
        device_no LIKE ? OR
        device_name LIKE ? OR
        device_type LIKE ? OR
        serial_no LIKE ? OR
        location LIKE ? OR
        responsible_person LIKE ?
      )`);
      params.push(`%${q}%`, `%${q}%`, `%${q}%`, `%${q}%`, `%${q}%`, `%${q}%`);
    }

    if (alert === "expired") {
      where.push("date(next_calibration_date) < date('now')");
    }

    if (alert === "upcoming") {
      where.push("date(next_calibration_date) BETWEEN date('now') AND date('now', '+30 day')");
    }

    const whereSql = where.length ? "WHERE " + where.join(" AND ") : "";

    const rows = await dbAll(`
      SELECT 
        cd.*,
        CASE
          WHEN cd.next_calibration_date IS NULL THEN 'Tarih Yok'
          WHEN date(cd.next_calibration_date) < date('now') THEN 'Geçti'
          WHEN date(cd.next_calibration_date) BETWEEN date('now') AND date('now', '+30 day') THEN 'Yaklaşıyor'
          ELSE 'Normal'
        END AS calibration_status,
        (
          SELECT COUNT(*)
          FROM calibration_records cr
          WHERE cr.device_id = cd.id
        ) AS record_count
      FROM calibration_devices cd
      ${whereSql}
      ORDER BY 
        CASE
          WHEN cd.next_calibration_date IS NULL THEN 4
          WHEN date(cd.next_calibration_date) < date('now') THEN 1
          WHEN date(cd.next_calibration_date) BETWEEN date('now') AND date('now', '+30 day') THEN 2
          ELSE 3
        END,
        cd.next_calibration_date ASC
    `, params);

    res.json({ success: true, devices: rows });
  } catch (err) {
    console.error("Kalibrasyon cihazları alınamadı:", err);
    res.status(500).json({ success: false, message: err.message });
  }
});

/* KPI */
app.get("/api/calibration/kpi", async (req, res) => {
  try {
    const total = await dbGet(`
      SELECT COUNT(*) AS c 
      FROM calibration_devices
      WHERE IFNULL(status, 'Aktif') = 'Aktif'
    `);

    const expired = await dbGet(`
      SELECT COUNT(*) AS c
      FROM calibration_devices
      WHERE IFNULL(status, 'Aktif') = 'Aktif'
        AND next_calibration_date IS NOT NULL
        AND date(next_calibration_date) < date('now')
    `);

    const upcoming = await dbGet(`
      SELECT COUNT(*) AS c
      FROM calibration_devices
      WHERE IFNULL(status, 'Aktif') = 'Aktif'
        AND next_calibration_date IS NOT NULL
        AND date(next_calibration_date) BETWEEN date('now') AND date('now', '+30 day')
    `);

    const records = await dbGet(`
      SELECT COUNT(*) AS c
      FROM calibration_records
    `);

    res.json({
      success: true,
      kpi: {
        totalDevices: total.c,
        expiredDevices: expired.c,
        upcomingDevices: upcoming.c,
        totalRecords: records.c
      }
    });
  } catch (err) {
    console.error("Kalibrasyon KPI alınamadı:", err);
    res.status(500).json({ success: false, message: err.message });
  }
});

/* CİHAZ DETAY */
app.get("/api/calibration/devices/:id", async (req, res) => {
  try {
    const device = await dbGet(`
      SELECT 
        *,
        CASE
          WHEN next_calibration_date IS NULL THEN 'Tarih Yok'
          WHEN date(next_calibration_date) < date('now') THEN 'Geçti'
          WHEN date(next_calibration_date) BETWEEN date('now') AND date('now', '+30 day') THEN 'Yaklaşıyor'
          ELSE 'Normal'
        END AS calibration_status
      FROM calibration_devices
      WHERE id = ?
    `, [req.params.id]);

    if (!device) {
      return res.status(404).json({
        success: false,
        message: "Kalibrasyon cihazı bulunamadı."
      });
    }

    const records = await dbAll(`
      SELECT *
      FROM calibration_records
      WHERE device_id = ?
      ORDER BY calibration_date DESC, id DESC
    `, [req.params.id]);

    res.json({ success: true, device, records });
  } catch (err) {
    console.error("Kalibrasyon cihaz detay hatası:", err);
    res.status(500).json({ success: false, message: err.message });
  }
});

/* CİHAZ OLUŞTUR */
app.post("/api/calibration/devices", async (req, res) => {
  try {
    const {
      device_name,
      device_type,
      serial_no,
      brand,
      model,
      location,
      responsible_person,
      last_calibration_date,
      next_calibration_date,
      calibration_period_month,
      description,
      created_by
    } = req.body;

    if (!device_name) {
      return res.status(400).json({
        success: false,
        message: "Cihaz adı zorunludur."
      });
    }

    const deviceNo = generateCalibrationDeviceNo();

    const result = await dbRun(`
      INSERT INTO calibration_devices
      (
        device_no,
        device_name,
        device_type,
        serial_no,
        brand,
        model,
        location,
        responsible_person,
        last_calibration_date,
        next_calibration_date,
        calibration_period_month,
        description,
        created_by
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      deviceNo,
      device_name,
      device_type || "",
      serial_no || "",
      brand || "",
      model || "",
      location || "",
      responsible_person || "",
      last_calibration_date || null,
      next_calibration_date || null,
      Number(calibration_period_month || 12),
      description || "",
      created_by || req.headers["x-user-name"] || "Sistem"
    ]);

    res.json({
      success: true,
      message: "Kalibrasyon cihazı oluşturuldu.",
      id: result.lastID,
      device_no: deviceNo
    });

  } catch (err) {
    console.error("Kalibrasyon cihaz oluşturma hatası:", err);
    res.status(500).json({ success: false, message: err.message });
  }
});

/* CİHAZ GÜNCELLE */
app.put("/api/calibration/devices/:id", async (req, res) => {
  try {
    const {
      device_name,
      device_type,
      serial_no,
      brand,
      model,
      location,
      responsible_person,
      last_calibration_date,
      next_calibration_date,
      calibration_period_month,
      status,
      description
    } = req.body;

    const device = await dbGet(`
      SELECT *
      FROM calibration_devices
      WHERE id = ?
    `, [req.params.id]);

    if (!device) {
      return res.status(404).json({
        success: false,
        message: "Kalibrasyon cihazı bulunamadı."
      });
    }

    await dbRun(`
      UPDATE calibration_devices
      SET
        device_name = ?,
        device_type = ?,
        serial_no = ?,
        brand = ?,
        model = ?,
        location = ?,
        responsible_person = ?,
        last_calibration_date = ?,
        next_calibration_date = ?,
        calibration_period_month = ?,
        status = ?,
        description = ?,
        updated_at = datetime('now')
      WHERE id = ?
    `, [
      device_name || device.device_name,
      device_type || "",
      serial_no || "",
      brand || "",
      model || "",
      location || "",
      responsible_person || "",
      last_calibration_date || null,
      next_calibration_date || null,
      Number(calibration_period_month || 12),
      status || device.status,
      description || "",
      req.params.id
    ]);

    res.json({
      success: true,
      message: "Kalibrasyon cihazı güncellendi."
    });

  } catch (err) {
    console.error("Kalibrasyon cihaz güncelleme hatası:", err);
    res.status(500).json({ success: false, message: err.message });
  }
});

/* KALİBRASYON KAYDI EKLE */
app.post("/api/calibration/devices/:id/records", async (req, res) => {
  try {
    const {
      calibration_date,
      next_calibration_date,
      certificate_no,
      result,
      calibration_company,
      document_id,
      document_no,
      file_name,
      file_path,
      note,
      created_by
    } = req.body;

    const device = await dbGet(`
      SELECT *
      FROM calibration_devices
      WHERE id = ?
    `, [req.params.id]);

    if (!device) {
      return res.status(404).json({
        success: false,
        message: "Kalibrasyon cihazı bulunamadı."
      });
    }

    if (!calibration_date) {
      return res.status(400).json({
        success: false,
        message: "Kalibrasyon tarihi zorunludur."
      });
    }

    const period = Number(device.calibration_period_month || 12);

    let calculatedNext = next_calibration_date;

    if (!calculatedNext) {
      const date = new Date(calibration_date);
      date.setMonth(date.getMonth() + period);
      calculatedNext = date.toISOString().slice(0, 10);
    }

    await dbRun("BEGIN TRANSACTION");

    try {
      const resultRow = await dbRun(`
        INSERT INTO calibration_records
        (
          device_id,
          calibration_date,
          next_calibration_date,
          certificate_no,
          result,
          calibration_company,
          document_id,
          document_no,
          file_name,
          file_path,
          note,
          created_by
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        req.params.id,
        calibration_date,
        calculatedNext,
        certificate_no || "",
        result || "Uygun",
        calibration_company || "",
        document_id || null,
        document_no || "",
        file_name || "",
        file_path || "",
        note || "",
        created_by || req.headers["x-user-name"] || "Sistem"
      ]);

      await dbRun(`
        UPDATE calibration_devices
        SET
          last_calibration_date = ?,
          next_calibration_date = ?,
          updated_at = datetime('now')
        WHERE id = ?
      `, [
        calibration_date,
        calculatedNext,
        req.params.id
      ]);

      await dbRun("COMMIT");

      res.json({
        success: true,
        message: "Kalibrasyon kaydı eklendi.",
        id: resultRow.lastID
      });

    } catch (err) {
      await dbRun("ROLLBACK");
      throw err;
    }

  } catch (err) {
    console.error("Kalibrasyon kaydı ekleme hatası:", err);
    res.status(500).json({ success: false, message: err.message });
  }
});

/* KALİBRASYON KAYITLARI LİSTELE */
app.get("/api/calibration/records", async (req, res) => {
  try {
    const { deviceId } = req.query;

    const where = [];
    const params = [];

    if (deviceId) {
      where.push("cr.device_id = ?");
      params.push(deviceId);
    }

    const whereSql = where.length ? "WHERE " + where.join(" AND ") : "";

    const rows = await dbAll(`
      SELECT 
        cr.*,
        cd.device_no,
        cd.device_name,
        cd.device_type,
        cd.serial_no
      FROM calibration_records cr
      JOIN calibration_devices cd ON cd.id = cr.device_id
      ${whereSql}
      ORDER BY cr.calibration_date DESC, cr.id DESC
    `, params);

    res.json({ success: true, records: rows });
  } catch (err) {
    console.error("Kalibrasyon kayıtları alınamadı:", err);
    res.status(500).json({ success: false, message: err.message });
  }
});

/* CİHAZ SİL */
app.delete("/api/calibration/devices/:id", async (req, res) => {
  try {
    const device = await dbGet(`
      SELECT *
      FROM calibration_devices
      WHERE id = ?
    `, [req.params.id]);

    if (!device) {
      return res.status(404).json({
        success: false,
        message: "Kalibrasyon cihazı bulunamadı."
      });
    }

    const recordCount = await dbGet(`
      SELECT COUNT(*) AS c
      FROM calibration_records
      WHERE device_id = ?
    `, [req.params.id]);

    if (recordCount.c > 0) {
      await dbRun(`
        UPDATE calibration_devices
        SET status = 'Pasif',
            updated_at = datetime('now')
        WHERE id = ?
      `, [req.params.id]);

      return res.json({
        success: true,
        message: "Cihazın kalibrasyon kayıtları olduğu için pasifleştirildi."
      });
    }

    await dbRun(`
      DELETE FROM calibration_devices
      WHERE id = ?
    `, [req.params.id]);

    res.json({
      success: true,
      message: "Kalibrasyon cihazı silindi."
    });

  } catch (err) {
    console.error("Kalibrasyon cihaz silme hatası:", err);
    res.status(500).json({ success: false, message: err.message });
  }
});

/* KAYIT SİL */
app.delete("/api/calibration/records/:id", async (req, res) => {
  try {
    const record = await dbGet(`
      SELECT *
      FROM calibration_records
      WHERE id = ?
    `, [req.params.id]);

    if (!record) {
      return res.status(404).json({
        success: false,
        message: "Kalibrasyon kaydı bulunamadı."
      });
    }

    await dbRun(`
      DELETE FROM calibration_records
      WHERE id = ?
    `, [req.params.id]);

    const latest = await dbGet(`
      SELECT *
      FROM calibration_records
      WHERE device_id = ?
      ORDER BY calibration_date DESC, id DESC
      LIMIT 1
    `, [record.device_id]);

    if (latest) {
      await dbRun(`
        UPDATE calibration_devices
        SET last_calibration_date = ?,
            next_calibration_date = ?,
            updated_at = datetime('now')
        WHERE id = ?
      `, [latest.calibration_date, latest.next_calibration_date, record.device_id]);
    }

    res.json({
      success: true,
      message: "Kalibrasyon kaydı silindi."
    });

  } catch (err) {
    console.error("Kalibrasyon kayıt silme hatası:", err);
    res.status(500).json({ success: false, message: err.message });
  }
});


/* DOKÜMANLARI LİSTELE */
app.get("/api/documents", async (req, res) => {
  try {
    const {
      workOrderId,
      type,
      status,
      q
    } = req.query;

    const where = [];
    const params = [];

    if (workOrderId) {
      where.push("d.work_order_id = ?");
      params.push(workOrderId);
    }

    if (type) {
      where.push("d.document_type = ?");
      params.push(type);
    }

    if (status) {
      where.push("d.status = ?");
      params.push(status);
    }

    if (q) {
      where.push(`(
        d.document_no LIKE ? OR
        d.title LIKE ? OR
        d.work_order_no LIKE ? OR
        d.original_file_name LIKE ?
      )`);
      params.push(`%${q}%`, `%${q}%`, `%${q}%`, `%${q}%`);
    }

    const whereSql = where.length ? "WHERE " + where.join(" AND ") : "";

    const rows = await dbAll(`
      SELECT d.*
      FROM documents d
      ${whereSql}
      ORDER BY d.id DESC
    `, params);

    res.json({ success: true, documents: rows });
  } catch (err) {
    console.error("Doküman listesi alınamadı:", err);
    res.status(500).json({ success: false, message: err.message });
  }
});

/* ==========================================================
   SERİ NO / LOT TAKİBİ BACKEND
   app.js / server.js içine ekle
========================================================== */

db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS lot_serials (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tracking_no TEXT UNIQUE,
      stock_id INTEGER,
      stock_code TEXT,
      part_name TEXT,
      lot_no TEXT,
      serial_no TEXT,
      supplier_id INTEGER,
      supplier_name TEXT,
      work_order_id INTEGER,
      work_order_no TEXT,
      entry_date DATE DEFAULT CURRENT_DATE,
      expiry_date DATE,
      initial_quantity REAL DEFAULT 0,
      remaining_quantity REAL DEFAULT 0,
      unit TEXT DEFAULT 'Adet',
      location TEXT,
      status TEXT DEFAULT 'Aktif',
      note TEXT,
      created_by TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS lot_serial_movements (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      lot_serial_id INTEGER NOT NULL,
      movement_no TEXT,
      movement_type TEXT,
      movement_date DATETIME DEFAULT CURRENT_TIMESTAMP,
      quantity REAL DEFAULT 0,
      previous_quantity REAL DEFAULT 0,
      next_quantity REAL DEFAULT 0,
      work_order_id INTEGER,
      work_order_no TEXT,
      customer_id INTEGER,
      customer_name TEXT,
      description TEXT,
      created_by TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(lot_serial_id) REFERENCES lot_serials(id)
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

function generateTrackingNo() {
  return "LOT" + Date.now();
}

function generateLotMovementNo() {
  return "LTH" + Date.now();
}

/* Stok select */
app.get("/api/lot-serial/stocks", async (req, res) => {
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
    console.error("Lot stokları alınamadı:", err);
    res.status(500).json({ success: false, message: err.message });
  }
});

/* İş emri select */
app.get("/api/lot-serial/work-orders", async (req, res) => {
  try {
    const rows = await dbAll(`
      SELECT 
        id,
        work_order_no,
        part_name,
        title,
        status
      FROM work_orders
      ORDER BY id DESC
    `);

    res.json({ success: true, workOrders: rows });
  } catch (err) {
    console.error("Lot iş emirleri alınamadı:", err);
    res.status(500).json({ success: false, message: err.message });
  }
});

/* Tedarikçi select */
app.get("/api/lot-serial/suppliers", async (req, res) => {
  try {
    const table = await dbGet(`
      SELECT name FROM sqlite_master WHERE type='table' AND name='suppliers'
    `);

    if (!table) return res.json({ success: true, suppliers: [] });

    const rows = await dbAll(`
      SELECT 
        id,
        company_name,
        supplier_name,
        name,
        authorized_person
      FROM suppliers
      ORDER BY id DESC
    `);

    res.json({
      success: true,
      suppliers: rows.map(s => ({
        id: s.id,
        supplier_name: s.company_name || s.supplier_name || s.name || s.authorized_person || ("Tedarikçi " + s.id)
      }))
    });
  } catch (err) {
    console.error("Lot tedarikçiler alınamadı:", err);
    res.json({ success: true, suppliers: [] });
  }
});

/* Lot / Seri listele */
app.get("/api/lot-serials", async (req, res) => {
  try {
    const { q, status, stockId } = req.query;

    const where = [];
    const params = [];

    if (status) {
      where.push("status = ?");
      params.push(status);
    }

    if (stockId) {
      where.push("stock_id = ?");
      params.push(stockId);
    }

    if (q) {
      where.push(`(
        tracking_no LIKE ? OR
        stock_code LIKE ? OR
        part_name LIKE ? OR
        lot_no LIKE ? OR
        serial_no LIKE ? OR
        supplier_name LIKE ? OR
        work_order_no LIKE ?
      )`);
      params.push(`%${q}%`, `%${q}%`, `%${q}%`, `%${q}%`, `%${q}%`, `%${q}%`, `%${q}%`);
    }

    const whereSql = where.length ? "WHERE " + where.join(" AND ") : "";

    const rows = await dbAll(`
      SELECT 
        *,
        CASE
          WHEN remaining_quantity <= 0 THEN 'Tükendi'
          WHEN status = 'Blokeli' THEN 'Blokeli'
          WHEN status = 'Pasif' THEN 'Pasif'
          ELSE 'Aktif'
        END AS calculated_status
      FROM lot_serials
      ${whereSql}
      ORDER BY id DESC
    `, params);

    res.json({ success: true, lotSerials: rows });
  } catch (err) {
    console.error("Lot/seri kayıtları alınamadı:", err);
    res.status(500).json({ success: false, message: err.message });
  }
});

/* KPI */
app.get("/api/lot-serials/kpi", async (req, res) => {
  try {
    const total = await dbGet(`SELECT COUNT(*) AS c FROM lot_serials`);
    const active = await dbGet(`SELECT COUNT(*) AS c FROM lot_serials WHERE status = 'Aktif' AND remaining_quantity > 0`);
    const consumed = await dbGet(`SELECT COUNT(*) AS c FROM lot_serials WHERE remaining_quantity <= 0`);
    const blocked = await dbGet(`SELECT COUNT(*) AS c FROM lot_serials WHERE status = 'Blokeli'`);
    const qty = await dbGet(`
      SELECT 
        IFNULL(SUM(initial_quantity), 0) AS initialQty,
        IFNULL(SUM(remaining_quantity), 0) AS remainingQty
      FROM lot_serials
    `);

    res.json({
      success: true,
      kpi: {
        total: total.c,
        active: active.c,
        consumed: consumed.c,
        blocked: blocked.c,
        initialQty: qty.initialQty,
        remainingQty: qty.remainingQty
      }
    });
  } catch (err) {
    console.error("Lot KPI alınamadı:", err);
    res.status(500).json({ success: false, message: err.message });
  }
});

/* Detay ve izlenebilirlik */
app.get("/api/lot-serials/:id", async (req, res) => {
  try {
    const lot = await dbGet(`
      SELECT *
      FROM lot_serials
      WHERE id = ?
    `, [req.params.id]);

    if (!lot) {
      return res.status(404).json({
        success: false,
        message: "Lot / seri kaydı bulunamadı."
      });
    }

    const movements = await dbAll(`
      SELECT *
      FROM lot_serial_movements
      WHERE lot_serial_id = ?
      ORDER BY id DESC
    `, [req.params.id]);

    res.json({ success: true, lot, movements });
  } catch (err) {
    console.error("Lot detay alınamadı:", err);
    res.status(500).json({ success: false, message: err.message });
  }
});

/* Lot / Seri oluştur */
app.post("/api/lot-serials", async (req, res) => {
  try {
    const {
      stock_id,
      lot_no,
      serial_no,
      supplier_id,
      supplier_name,
      work_order_id,
      entry_date,
      expiry_date,
      initial_quantity,
      location,
      note,
      created_by
    } = req.body;

    if (!stock_id) {
      return res.status(400).json({ success: false, message: "Stok seçimi zorunludur." });
    }

    if (!lot_no && !serial_no) {
      return res.status(400).json({ success: false, message: "Lot no veya seri no zorunludur." });
    }

    const stock = await dbGet(`
      SELECT *
      FROM stocks
      WHERE id = ?
    `, [stock_id]);

    if (!stock) {
      return res.status(404).json({ success: false, message: "Stok kartı bulunamadı." });
    }

    let workOrderNo = "";

    if (work_order_id) {
      const wo = await dbGet(`SELECT work_order_no FROM work_orders WHERE id = ?`, [work_order_id]);
      workOrderNo = wo?.work_order_no || "";
    }

    const qty = Number(initial_quantity || 0);

    if (qty <= 0) {
      return res.status(400).json({ success: false, message: "Giriş miktarı 0'dan büyük olmalıdır." });
    }

    await dbRun("BEGIN TRANSACTION");

    try {
      const trackingNo = generateTrackingNo();

      const result = await dbRun(`
        INSERT INTO lot_serials
        (
          tracking_no,
          stock_id,
          stock_code,
          part_name,
          lot_no,
          serial_no,
          supplier_id,
          supplier_name,
          work_order_id,
          work_order_no,
          entry_date,
          expiry_date,
          initial_quantity,
          remaining_quantity,
          unit,
          location,
          status,
          note,
          created_by
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Aktif', ?, ?)
      `, [
        trackingNo,
        stock.id,
        stock.stock_code || "",
        stock.part_name || "",
        lot_no || "",
        serial_no || "",
        supplier_id || null,
        supplier_name || "",
        work_order_id || null,
        workOrderNo,
        entry_date || new Date().toISOString().slice(0, 10),
        expiry_date || null,
        qty,
        qty,
        stock.unit || "Adet",
        location || stock.location || "",
        note || "",
        created_by || req.headers["x-user-name"] || "Sistem"
      ]);

      const lotId = result.lastID;

      await dbRun(`
        INSERT INTO lot_serial_movements
        (
          lot_serial_id,
          movement_no,
          movement_type,
          quantity,
          previous_quantity,
          next_quantity,
          work_order_id,
          work_order_no,
          description,
          created_by
        )
        VALUES (?, ?, 'Giriş', ?, 0, ?, ?, ?, ?, ?)
      `, [
        lotId,
        generateLotMovementNo(),
        qty,
        qty,
        work_order_id || null,
        workOrderNo,
        "Lot / seri ilk giriş kaydı",
        created_by || req.headers["x-user-name"] || "Sistem"
      ]);

      await dbRun("COMMIT");

      res.json({
        success: true,
        message: "Lot / seri kaydı oluşturuldu.",
        id: lotId,
        tracking_no: trackingNo
      });

    } catch (err) {
      await dbRun("ROLLBACK");
      throw err;
    }

  } catch (err) {
    console.error("Lot / seri oluşturma hatası:", err);
    res.status(500).json({ success: false, message: err.message });
  }
});

/* Lot / Seri hareket oluştur */
app.post("/api/lot-serials/:id/movements", async (req, res) => {
  try {
    const {
      movement_type,
      quantity,
      work_order_id,
      customer_id,
      customer_name,
      description,
      created_by
    } = req.body;

    const lot = await dbGet(`
      SELECT *
      FROM lot_serials
      WHERE id = ?
    `, [req.params.id]);

    if (!lot) {
      return res.status(404).json({ success: false, message: "Lot / seri kaydı bulunamadı." });
    }

    if (lot.status === "Blokeli") {
      return res.status(400).json({ success: false, message: "Blokeli lot hareket göremez." });
    }

    const qty = Number(quantity || 0);

    if (qty <= 0) {
      return res.status(400).json({ success: false, message: "Hareket miktarı 0'dan büyük olmalıdır." });
    }

    const type = movement_type || "Çıkış";
    const previousQty = Number(lot.remaining_quantity || 0);
    let nextQty = previousQty;

    if (type === "Giriş" || type === "İade") {
      nextQty = previousQty + qty;
    } else {
      if (qty > previousQty) {
        return res.status(400).json({
          success: false,
          message: `Yetersiz lot miktarı. Kalan: ${previousQty}, istenen: ${qty}`
        });
      }

      nextQty = previousQty - qty;
    }

    let workOrderNo = "";

    if (work_order_id) {
      const wo = await dbGet(`SELECT work_order_no FROM work_orders WHERE id = ?`, [work_order_id]);
      workOrderNo = wo?.work_order_no || "";
    }

    await dbRun("BEGIN TRANSACTION");

    try {
      await dbRun(`
        INSERT INTO lot_serial_movements
        (
          lot_serial_id,
          movement_no,
          movement_type,
          quantity,
          previous_quantity,
          next_quantity,
          work_order_id,
          work_order_no,
          customer_id,
          customer_name,
          description,
          created_by
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        lot.id,
        generateLotMovementNo(),
        type,
        qty,
        previousQty,
        nextQty,
        work_order_id || null,
        workOrderNo,
        customer_id || null,
        customer_name || "",
        description || "",
        created_by || req.headers["x-user-name"] || "Sistem"
      ]);

      await dbRun(`
        UPDATE lot_serials
        SET remaining_quantity = ?,
            status = CASE WHEN ? <= 0 THEN 'Tükendi' ELSE status END
        WHERE id = ?
      `, [nextQty, nextQty, lot.id]);

      await dbRun("COMMIT");

      res.json({
        success: true,
        message: "Lot / seri hareketi oluşturuldu.",
        next_quantity: nextQty
      });

    } catch (err) {
      await dbRun("ROLLBACK");
      throw err;
    }

  } catch (err) {
    console.error("Lot hareket oluşturma hatası:", err);
    res.status(500).json({ success: false, message: err.message });
  }
});

/* Lot / Seri güncelle */
app.put("/api/lot-serials/:id", async (req, res) => {
  try {
    const {
      lot_no,
      serial_no,
      supplier_name,
      entry_date,
      expiry_date,
      location,
      status,
      note
    } = req.body;

    const lot = await dbGet(`
      SELECT *
      FROM lot_serials
      WHERE id = ?
    `, [req.params.id]);

    if (!lot) {
      return res.status(404).json({ success: false, message: "Lot / seri kaydı bulunamadı." });
    }

    await dbRun(`
      UPDATE lot_serials
      SET
        lot_no = ?,
        serial_no = ?,
        supplier_name = ?,
        entry_date = ?,
        expiry_date = ?,
        location = ?,
        status = ?,
        note = ?
      WHERE id = ?
    `, [
      lot_no || "",
      serial_no || "",
      supplier_name || "",
      entry_date || lot.entry_date,
      expiry_date || null,
      location || "",
      status || lot.status,
      note || "",
      req.params.id
    ]);

    res.json({ success: true, message: "Lot / seri kaydı güncellendi." });

  } catch (err) {
    console.error("Lot güncelleme hatası:", err);
    res.status(500).json({ success: false, message: err.message });
  }
});

/* Lot / Seri sil */
app.delete("/api/lot-serials/:id", async (req, res) => {
  try {
    const lot = await dbGet(`
      SELECT *
      FROM lot_serials
      WHERE id = ?
    `, [req.params.id]);

    if (!lot) {
      return res.status(404).json({ success: false, message: "Lot / seri kaydı bulunamadı." });
    }

    const movementCount = await dbGet(`
      SELECT COUNT(*) AS c
      FROM lot_serial_movements
      WHERE lot_serial_id = ?
    `, [req.params.id]);

    if (movementCount.c > 1) {
      await dbRun(`UPDATE lot_serials SET status = 'Pasif' WHERE id = ?`, [req.params.id]);
      return res.json({
        success: true,
        message: "Hareket geçmişi olduğu için kayıt pasifleştirildi."
      });
    }

    await dbRun(`DELETE FROM lot_serial_movements WHERE lot_serial_id = ?`, [req.params.id]);
    await dbRun(`DELETE FROM lot_serials WHERE id = ?`, [req.params.id]);

    res.json({ success: true, message: "Lot / seri kaydı silindi." });
  } catch (err) {
    console.error("Lot silme hatası:", err);
    res.status(500).json({ success: false, message: err.message });
  }
});


/* İŞ EMİRLERİ SELECT İÇİN */
app.get("/api/documents/work-orders", async (req, res) => {
  try {
    const rows = await dbAll(`
      SELECT 
        id,
        work_order_no,
        part_name,
        title,
        status
      FROM work_orders
      ORDER BY id DESC
    `);

    res.json({ success: true, workOrders: rows });
  } catch (err) {
    console.error("Doküman iş emirleri alınamadı:", err);
    res.status(500).json({ success: false, message: err.message });
  }
});

/* ==========================================================
   BAKIM PLANLAMA 2.0 BACKEND
   app.js / server.js içine ekle
========================================================== */

db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS maintenance_plans (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      plan_no TEXT UNIQUE,
      machine_id INTEGER,
      machine_name TEXT NOT NULL,
      maintenance_type TEXT DEFAULT 'Periyodik Bakım',
      period_type TEXT DEFAULT 'Aylık',
      period_value INTEGER DEFAULT 1,
      last_maintenance_date DATE,
      next_maintenance_date DATE,
      estimated_duration_min INTEGER DEFAULT 60,
      responsible_person TEXT,
      priority TEXT DEFAULT 'Normal',
      status TEXT DEFAULT 'Aktif',
      description TEXT,
      created_by TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS maintenance_plan_tasks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      plan_id INTEGER NOT NULL,
      task_name TEXT NOT NULL,
      task_order INTEGER DEFAULT 1,
      is_required INTEGER DEFAULT 1,
      note TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(plan_id) REFERENCES maintenance_plans(id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS maintenance_executions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      execution_no TEXT UNIQUE,
      plan_id INTEGER,
      plan_no TEXT,
      machine_id INTEGER,
      machine_name TEXT,
      maintenance_date DATE DEFAULT CURRENT_DATE,
      completed_date DATETIME,
      status TEXT DEFAULT 'Açık',
      result TEXT DEFAULT 'Bekliyor',
      downtime_min INTEGER DEFAULT 0,
      cost REAL DEFAULT 0,
      responsible_person TEXT,
      note TEXT,
      created_by TEXT,
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

function generateMaintenancePlanNo() {
  return "BKP" + Date.now();
}
function generateMaintenanceExecutionNo() {
  return "BKM" + Date.now();
}

function calculateNextMaintenanceDate(lastDate, periodType, periodValue) {
  if (!lastDate) return null;
  const d = new Date(lastDate);
  const value = Number(periodValue || 1);

  if (periodType === "Günlük") d.setDate(d.getDate() + value);
  else if (periodType === "Haftalık") d.setDate(d.getDate() + (value * 7));
  else if (periodType === "Aylık") d.setMonth(d.getMonth() + value);
  else if (periodType === "Yıllık") d.setFullYear(d.getFullYear() + value);
  else d.setMonth(d.getMonth() + value);

  return d.toISOString().slice(0, 10);
}

/* Makine select */
app.get("/api/maintenance-planning/machines", async (req, res) => {
  try {
    const table = await dbGet(`SELECT name FROM sqlite_master WHERE type='table' AND name='machines'`);

    if (!table) {
      return res.json({ success: true, machines: [] });
    }

    const rows = await dbAll(`
      SELECT id, machine_name, name, code, status
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
    console.error("Bakım makineleri alınamadı:", err);
    res.json({ success: true, machines: [] });
  }
});

/* KPI */
app.get("/api/maintenance-planning/kpi", async (req, res) => {
  try {
    const activePlans = await dbGet(`
      SELECT COUNT(*) AS c
      FROM maintenance_plans
      WHERE status = 'Aktif'
    `);

    const overdue = await dbGet(`
      SELECT COUNT(*) AS c
      FROM maintenance_plans
      WHERE status = 'Aktif'
        AND next_maintenance_date IS NOT NULL
        AND date(next_maintenance_date) < date('now')
    `);

    const upcoming = await dbGet(`
      SELECT COUNT(*) AS c
      FROM maintenance_plans
      WHERE status = 'Aktif'
        AND next_maintenance_date IS NOT NULL
        AND date(next_maintenance_date) BETWEEN date('now') AND date('now', '+7 day')
    `);

    const openExec = await dbGet(`
      SELECT COUNT(*) AS c
      FROM maintenance_executions
      WHERE status IN ('Açık', 'Devam Ediyor')
    `);

    const cost = await dbGet(`
      SELECT IFNULL(SUM(cost), 0) AS total
      FROM maintenance_executions
      WHERE strftime('%Y-%m', maintenance_date) = strftime('%Y-%m', 'now')
    `);

    res.json({
      success: true,
      kpi: {
        activePlans: activePlans.c,
        overduePlans: overdue.c,
        upcomingPlans: upcoming.c,
        openExecutions: openExec.c,
        monthlyCost: cost.total
      }
    });
  } catch (err) {
    console.error("Bakım KPI alınamadı:", err);
    res.status(500).json({ success: false, message: err.message });
  }
});

/* Planları listele */
app.get("/api/maintenance-plans", async (req, res) => {
  try {
    const { q, status, alert } = req.query;
    const where = [];
    const params = [];

    if (status) {
      where.push("status = ?");
      params.push(status);
    }

    if (alert === "overdue") {
      where.push("date(next_maintenance_date) < date('now')");
    }

    if (alert === "upcoming") {
      where.push("date(next_maintenance_date) BETWEEN date('now') AND date('now', '+7 day')");
    }

    if (q) {
      where.push(`(
        plan_no LIKE ? OR
        machine_name LIKE ? OR
        maintenance_type LIKE ? OR
        responsible_person LIKE ?
      )`);
      params.push(`%${q}%`, `%${q}%`, `%${q}%`, `%${q}%`);
    }

    const whereSql = where.length ? "WHERE " + where.join(" AND ") : "";

    const rows = await dbAll(`
      SELECT 
        mp.*,
        CASE
          WHEN mp.next_maintenance_date IS NULL THEN 'Tarih Yok'
          WHEN date(mp.next_maintenance_date) < date('now') THEN 'Gecikti'
          WHEN date(mp.next_maintenance_date) BETWEEN date('now') AND date('now', '+7 day') THEN 'Yaklaşıyor'
          ELSE 'Normal'
        END AS plan_alert,
        (
          SELECT COUNT(*)
          FROM maintenance_plan_tasks mpt
          WHERE mpt.plan_id = mp.id
        ) AS task_count
      FROM maintenance_plans mp
      ${whereSql}
      ORDER BY
        CASE
          WHEN mp.next_maintenance_date IS NULL THEN 4
          WHEN date(mp.next_maintenance_date) < date('now') THEN 1
          WHEN date(mp.next_maintenance_date) BETWEEN date('now') AND date('now', '+7 day') THEN 2
          ELSE 3
        END,
        mp.next_maintenance_date ASC
    `, params);

    res.json({ success: true, plans: rows });
  } catch (err) {
    console.error("Bakım planları alınamadı:", err);
    res.status(500).json({ success: false, message: err.message });
  }
});

/* Plan detay */
app.get("/api/maintenance-plans/:id", async (req, res) => {
  try {
    const plan = await dbGet(`SELECT * FROM maintenance_plans WHERE id = ?`, [req.params.id]);

    if (!plan) {
      return res.status(404).json({ success: false, message: "Bakım planı bulunamadı." });
    }

    const tasks = await dbAll(`
      SELECT *
      FROM maintenance_plan_tasks
      WHERE plan_id = ?
      ORDER BY task_order ASC, id ASC
    `, [req.params.id]);

    const executions = await dbAll(`
      SELECT *
      FROM maintenance_executions
      WHERE plan_id = ?
      ORDER BY id DESC
    `, [req.params.id]);

    res.json({ success: true, plan, tasks, executions });
  } catch (err) {
    console.error("Bakım plan detay hatası:", err);
    res.status(500).json({ success: false, message: err.message });
  }
});

/* Plan oluştur */
app.post("/api/maintenance-plans", async (req, res) => {
  try {
    const {
      machine_id,
      machine_name,
      maintenance_type,
      period_type,
      period_value,
      last_maintenance_date,
      next_maintenance_date,
      estimated_duration_min,
      responsible_person,
      priority,
      description,
      tasks,
      created_by
    } = req.body;

    if (!machine_name) {
      return res.status(400).json({ success: false, message: "Makine adı zorunludur." });
    }

    const planNo = generateMaintenancePlanNo();
    const nextDate = next_maintenance_date || calculateNextMaintenanceDate(
      last_maintenance_date,
      period_type || "Aylık",
      period_value || 1
    );

    await dbRun("BEGIN TRANSACTION");

    try {
      const result = await dbRun(`
        INSERT INTO maintenance_plans
        (
          plan_no,
          machine_id,
          machine_name,
          maintenance_type,
          period_type,
          period_value,
          last_maintenance_date,
          next_maintenance_date,
          estimated_duration_min,
          responsible_person,
          priority,
          description,
          created_by
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        planNo,
        machine_id || null,
        machine_name,
        maintenance_type || "Periyodik Bakım",
        period_type || "Aylık",
        Number(period_value || 1),
        last_maintenance_date || null,
        nextDate || null,
        Number(estimated_duration_min || 60),
        responsible_person || "",
        priority || "Normal",
        description || "",
        created_by || req.headers["x-user-name"] || "Sistem"
      ]);

      const planId = result.lastID;
      const taskList = Array.isArray(tasks) && tasks.length ? tasks : [
        { task_name: "Genel temizlik kontrolü" },
        { task_name: "Yağlama kontrolü" },
        { task_name: "Emniyet ekipmanları kontrolü" }
      ];

      let order = 1;
      for (const t of taskList) {
        if (!t.task_name) continue;

        await dbRun(`
          INSERT INTO maintenance_plan_tasks
          (plan_id, task_name, task_order, is_required, note)
          VALUES (?, ?, ?, ?, ?)
        `, [
          planId,
          t.task_name,
          order++,
          t.is_required === 0 ? 0 : 1,
          t.note || ""
        ]);
      }

      await dbRun("COMMIT");

      res.json({
        success: true,
        message: "Bakım planı oluşturuldu.",
        id: planId,
        plan_no: planNo
      });
    } catch (err) {
      await dbRun("ROLLBACK");
      throw err;
    }

  } catch (err) {
    console.error("Bakım planı oluşturma hatası:", err);
    res.status(500).json({ success: false, message: err.message });
  }
});

/* Plan güncelle */
app.put("/api/maintenance-plans/:id", async (req, res) => {
  try {
    const {
      machine_name,
      maintenance_type,
      period_type,
      period_value,
      last_maintenance_date,
      next_maintenance_date,
      estimated_duration_min,
      responsible_person,
      priority,
      status,
      description
    } = req.body;

    const plan = await dbGet(`SELECT * FROM maintenance_plans WHERE id = ?`, [req.params.id]);

    if (!plan) {
      return res.status(404).json({ success: false, message: "Bakım planı bulunamadı." });
    }

    await dbRun(`
      UPDATE maintenance_plans
      SET
        machine_name = ?,
        maintenance_type = ?,
        period_type = ?,
        period_value = ?,
        last_maintenance_date = ?,
        next_maintenance_date = ?,
        estimated_duration_min = ?,
        responsible_person = ?,
        priority = ?,
        status = ?,
        description = ?,
        updated_at = datetime('now')
      WHERE id = ?
    `, [
      machine_name || plan.machine_name,
      maintenance_type || plan.maintenance_type,
      period_type || plan.period_type,
      Number(period_value || plan.period_value || 1),
      last_maintenance_date || null,
      next_maintenance_date || null,
      Number(estimated_duration_min || plan.estimated_duration_min || 60),
      responsible_person || "",
      priority || plan.priority,
      status || plan.status,
      description || "",
      req.params.id
    ]);

    res.json({ success: true, message: "Bakım planı güncellendi." });
  } catch (err) {
    console.error("Bakım planı güncelleme hatası:", err);
    res.status(500).json({ success: false, message: err.message });
  }
});

/* Plandan bakım emri oluştur */
app.post("/api/maintenance-plans/:id/create-execution", async (req, res) => {
  try {
    const { maintenance_date, created_by } = req.body;

    const plan = await dbGet(`SELECT * FROM maintenance_plans WHERE id = ?`, [req.params.id]);

    if (!plan) {
      return res.status(404).json({ success: false, message: "Bakım planı bulunamadı." });
    }

    const executionNo = generateMaintenanceExecutionNo();

    const result = await dbRun(`
      INSERT INTO maintenance_executions
      (
        execution_no,
        plan_id,
        plan_no,
        machine_id,
        machine_name,
        maintenance_date,
        status,
        result,
        responsible_person,
        note,
        created_by
      )
      VALUES (?, ?, ?, ?, ?, ?, 'Açık', 'Bekliyor', ?, ?, ?)
    `, [
      executionNo,
      plan.id,
      plan.plan_no,
      plan.machine_id || null,
      plan.machine_name,
      maintenance_date || plan.next_maintenance_date || new Date().toISOString().slice(0, 10),
      plan.responsible_person || "",
      plan.description || "",
      created_by || req.headers["x-user-name"] || "Sistem"
    ]);

    res.json({
      success: true,
      message: "Bakım emri oluşturuldu.",
      id: result.lastID,
      execution_no: executionNo
    });
  } catch (err) {
    console.error("Bakım emri oluşturma hatası:", err);
    res.status(500).json({ success: false, message: err.message });
  }
});

/* Bakım emirleri listele */
app.get("/api/maintenance-executions", async (req, res) => {
  try {
    const rows = await dbAll(`
      SELECT *
      FROM maintenance_executions
      ORDER BY id DESC
    `);

    res.json({ success: true, executions: rows });
  } catch (err) {
    console.error("Bakım emirleri alınamadı:", err);
    res.status(500).json({ success: false, message: err.message });
  }
});

/* Bakım emri tamamla */
app.put("/api/maintenance-executions/:id/complete", async (req, res) => {
  try {
    const { result, downtime_min, cost, note, completed_by } = req.body;

    const execution = await dbGet(`SELECT * FROM maintenance_executions WHERE id = ?`, [req.params.id]);

    if (!execution) {
      return res.status(404).json({ success: false, message: "Bakım emri bulunamadı." });
    }

    if (execution.status === "Tamamlandı") {
      return res.status(400).json({ success: false, message: "Bakım emri zaten tamamlanmış." });
    }

    await dbRun("BEGIN TRANSACTION");

    try {
      await dbRun(`
        UPDATE maintenance_executions
        SET
          status = 'Tamamlandı',
          result = ?,
          downtime_min = ?,
          cost = ?,
          note = ?,
          completed_date = datetime('now')
        WHERE id = ?
      `, [
        result || "Tamamlandı",
        Number(downtime_min || 0),
        Number(cost || 0),
        note || "",
        req.params.id
      ]);

      if (execution.plan_id) {
        const plan = await dbGet(`SELECT * FROM maintenance_plans WHERE id = ?`, [execution.plan_id]);

        if (plan) {
          const today = new Date().toISOString().slice(0, 10);
          const nextDate = calculateNextMaintenanceDate(today, plan.period_type, plan.period_value);

          await dbRun(`
            UPDATE maintenance_plans
            SET
              last_maintenance_date = ?,
              next_maintenance_date = ?,
              updated_at = datetime('now')
            WHERE id = ?
          `, [today, nextDate, plan.id]);
        }
      }

      await dbRun("COMMIT");

      res.json({ success: true, message: "Bakım emri tamamlandı." });
    } catch (err) {
      await dbRun("ROLLBACK");
      throw err;
    }

  } catch (err) {
    console.error("Bakım emri tamamlama hatası:", err);
    res.status(500).json({ success: false, message: err.message });
  }
});

/* Plan sil */
app.delete("/api/maintenance-plans/:id", async (req, res) => {
  try {
    const plan = await dbGet(`SELECT * FROM maintenance_plans WHERE id = ?`, [req.params.id]);

    if (!plan) {
      return res.status(404).json({ success: false, message: "Bakım planı bulunamadı." });
    }

    const execCount = await dbGet(`SELECT COUNT(*) AS c FROM maintenance_executions WHERE plan_id = ?`, [req.params.id]);

    if (execCount.c > 0) {
      await dbRun(`UPDATE maintenance_plans SET status = 'Pasif' WHERE id = ?`, [req.params.id]);
      return res.json({ success: true, message: "Geçmiş bakım emri olduğu için plan pasifleştirildi." });
    }

    await dbRun(`DELETE FROM maintenance_plan_tasks WHERE plan_id = ?`, [req.params.id]);
    await dbRun(`DELETE FROM maintenance_plans WHERE id = ?`, [req.params.id]);

    res.json({ success: true, message: "Bakım planı silindi." });
  } catch (err) {
    console.error("Bakım planı silme hatası:", err);
    res.status(500).json({ success: false, message: err.message });
  }
});

db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS shipment_barcode_plans (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      shipment_no TEXT UNIQUE,
      customer_id INTEGER,
      customer_name TEXT,
      work_order_id INTEGER,
      work_order_no TEXT,
      shipment_date DATE DEFAULT CURRENT_DATE,
      status TEXT DEFAULT 'Planlandı',
      description TEXT,
      created_by TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      approved_by TEXT,
      approved_at DATETIME,
      cancelled_by TEXT,
      cancelled_at DATETIME,
      cancel_reason TEXT
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS shipment_barcode_lines (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      shipment_id INTEGER NOT NULL,
      stock_id INTEGER,
      stock_code TEXT,
      part_name TEXT,
      lot_serial_id INTEGER,
      tracking_no TEXT,
      lot_no TEXT,
      serial_no TEXT,
      pallet_no TEXT,
      box_no TEXT,
      barcode_no TEXT,
      planned_qty REAL DEFAULT 0,
      scanned_qty REAL DEFAULT 0,
      shipped_qty REAL DEFAULT 0,
      unit TEXT DEFAULT 'Adet',
      status TEXT DEFAULT 'Bekliyor',
      note TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(shipment_id) REFERENCES shipment_barcode_plans(id)
    )
  `);
});

/* Promise helperlar sende varsa tekrar ekleme */
function dbAll(sql, params = []) {
  return new Promise((resolve, reject) => db.all(sql, params, (err, rows) => err ? reject(err) : resolve(rows)));
}
function dbGet(sql, params = []) {
  return new Promise((resolve, reject) => db.get(sql, params, (err, row) => err ? reject(err) : resolve(row)));
}
function dbRun(sql, params = []) {
  return new Promise((resolve, reject) => db.run(sql, params, function(err) { err ? reject(err) : resolve(this); }));
}

function generateShipmentBarcodeNo() {
  return "SVK" + Date.now();
}
function generateShipmentBarcodeLineNo(prefix = "BRK") {
  return prefix + Date.now() + Math.floor(Math.random() * 999);
}

/* Select verileri */
app.get("/api/shipment-barcode/customers", async (req, res) => {
  try {
    const rows = await dbAll(`
      SELECT id, company_name, customer_code, authorized_person
      FROM customers
      ORDER BY company_name ASC
    `);
    res.json({ success: true, customers: rows });
  } catch (err) {
    console.error("Sevkiyat müşterileri alınamadı:", err);
    res.status(500).json({ success: false, message: err.message });
  }
});

app.get("/api/shipment-barcode/work-orders", async (req, res) => {
  try {
    const rows = await dbAll(`
      SELECT id, work_order_no, part_name, title, status
      FROM work_orders
      ORDER BY id DESC
    `);
    res.json({ success: true, workOrders: rows });
  } catch (err) {
    console.error("Sevkiyat iş emirleri alınamadı:", err);
    res.status(500).json({ success: false, message: err.message });
  }
});

app.get("/api/shipment-barcode/stocks", async (req, res) => {
  try {
    const rows = await dbAll(`
      SELECT id, stock_code, part_name, quantity, unit, location
      FROM stocks
      WHERE IFNULL(status, 'active') != 'passive'
      ORDER BY part_name ASC
    `);
    res.json({ success: true, stocks: rows });
  } catch (err) {
    console.error("Sevkiyat stokları alınamadı:", err);
    res.status(500).json({ success: false, message: err.message });
  }
});

app.get("/api/shipment-barcode/lots", async (req, res) => {
  try {
    const { stockId } = req.query;

    const table = await dbGet(`SELECT name FROM sqlite_master WHERE type='table' AND name='lot_serials'`);
    if (!table) return res.json({ success: true, lots: [] });

    const where = ["remaining_quantity > 0", "status IN ('Aktif', 'Tükendi')"];
    const params = [];

    if (stockId) {
      where.push("stock_id = ?");
      params.push(stockId);
    }

    const rows = await dbAll(`
      SELECT *
      FROM lot_serials
      WHERE ${where.join(" AND ")}
      ORDER BY id DESC
    `, params);

    res.json({ success: true, lots: rows });
  } catch (err) {
    console.error("Sevkiyat lotları alınamadı:", err);
    res.status(500).json({ success: false, message: err.message });
  }
});

/* KPI */
app.get("/api/shipment-barcode/kpi", async (req, res) => {
  try {
    const planned = await dbGet(`SELECT COUNT(*) AS c FROM shipment_barcode_plans WHERE status = 'Planlandı'`);
    const ready = await dbGet(`SELECT COUNT(*) AS c FROM shipment_barcode_plans WHERE status = 'Hazır'`);
    const shipped = await dbGet(`SELECT COUNT(*) AS c FROM shipment_barcode_plans WHERE status = 'Sevk Edildi'`);
    const today = await dbGet(`
      SELECT COUNT(*) AS c
      FROM shipment_barcode_plans
      WHERE date(shipment_date) = date('now')
    `);
    const qty = await dbGet(`
      SELECT IFNULL(SUM(shipped_qty), 0) AS total
      FROM shipment_barcode_lines
    `);

    res.json({
      success: true,
      kpi: {
        planned: planned.c,
        ready: ready.c,
        shipped: shipped.c,
        today: today.c,
        shippedQty: qty.total
      }
    });
  } catch (err) {
    console.error("Sevkiyat KPI alınamadı:", err);
    res.status(500).json({ success: false, message: err.message });
  }
});

/* Sevkiyatları listele */
app.get("/api/shipment-barcode/plans", async (req, res) => {
  try {
    const { q, status } = req.query;
    const where = [];
    const params = [];

    if (status) {
      where.push("sbp.status = ?");
      params.push(status);
    }

    if (q) {
      where.push(`(
        sbp.shipment_no LIKE ? OR
        sbp.customer_name LIKE ? OR
        sbp.work_order_no LIKE ?
      )`);
      params.push(`%${q}%`, `%${q}%`, `%${q}%`);
    }

    const whereSql = where.length ? "WHERE " + where.join(" AND ") : "";

    const rows = await dbAll(`
      SELECT
        sbp.*,
        COUNT(sbl.id) AS line_count,
        IFNULL(SUM(sbl.planned_qty), 0) AS planned_qty,
        IFNULL(SUM(sbl.scanned_qty), 0) AS scanned_qty,
        IFNULL(SUM(sbl.shipped_qty), 0) AS shipped_qty
      FROM shipment_barcode_plans sbp
      LEFT JOIN shipment_barcode_lines sbl ON sbl.shipment_id = sbp.id
      ${whereSql}
      GROUP BY sbp.id
      ORDER BY sbp.id DESC
    `, params);

    res.json({ success: true, plans: rows });
  } catch (err) {
    console.error("Sevkiyat planları alınamadı:", err);
    res.status(500).json({ success: false, message: err.message });
  }
});

/* Detay */
app.get("/api/shipment-barcode/plans/:id", async (req, res) => {
  try {
    const plan = await dbGet(`SELECT * FROM shipment_barcode_plans WHERE id = ?`, [req.params.id]);
    if (!plan) return res.status(404).json({ success: false, message: "Sevkiyat bulunamadı." });

    const lines = await dbAll(`
      SELECT *
      FROM shipment_barcode_lines
      WHERE shipment_id = ?
      ORDER BY id ASC
    `, [req.params.id]);

    res.json({ success: true, plan, lines });
  } catch (err) {
    console.error("Sevkiyat detay alınamadı:", err);
    res.status(500).json({ success: false, message: err.message });
  }
});

/* Sevkiyat planı oluştur */
app.post("/api/shipment-barcode/plans", async (req, res) => {
  try {
    const {
      customer_id,
      customer_name,
      work_order_id,
      shipment_date,
      description,
      lines,
      created_by
    } = req.body;

    if (!customer_name) {
      return res.status(400).json({ success: false, message: "Müşteri zorunludur." });
    }

    if (!Array.isArray(lines) || !lines.length) {
      return res.status(400).json({ success: false, message: "En az bir sevkiyat satırı girilmelidir." });
    }

    let workOrderNo = "";
    if (work_order_id) {
      const wo = await dbGet(`SELECT work_order_no FROM work_orders WHERE id = ?`, [work_order_id]);
      workOrderNo = wo?.work_order_no || "";
    }

    await dbRun("BEGIN TRANSACTION");

    try {
      const shipmentNo = generateShipmentBarcodeNo();

      const result = await dbRun(`
        INSERT INTO shipment_barcode_plans
        (
          shipment_no,
          customer_id,
          customer_name,
          work_order_id,
          work_order_no,
          shipment_date,
          status,
          description,
          created_by
        )
        VALUES (?, ?, ?, ?, ?, ?, 'Planlandı', ?, ?)
      `, [
        shipmentNo,
        customer_id || null,
        customer_name,
        work_order_id || null,
        workOrderNo,
        shipment_date || new Date().toISOString().slice(0, 10),
        description || "",
        created_by || req.headers["x-user-name"] || "Sistem"
      ]);

      const shipmentId = result.lastID;

      for (const line of lines) {
        if (!line.stock_id || Number(line.planned_qty || 0) <= 0) {
          throw new Error("Satırlarda stok ve planlanan miktar zorunludur.");
        }

        const stock = await dbGet(`SELECT * FROM stocks WHERE id = ?`, [line.stock_id]);
        if (!stock) throw new Error("Stok kartı bulunamadı.");

        let lot = null;
        if (line.lot_serial_id) {
          lot = await dbGet(`SELECT * FROM lot_serials WHERE id = ?`, [line.lot_serial_id]);
        }

        await dbRun(`
          INSERT INTO shipment_barcode_lines
          (
            shipment_id,
            stock_id,
            stock_code,
            part_name,
            lot_serial_id,
            tracking_no,
            lot_no,
            serial_no,
            pallet_no,
            box_no,
            barcode_no,
            planned_qty,
            scanned_qty,
            shipped_qty,
            unit,
            status,
            note
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0, ?, 'Bekliyor', ?)
        `, [
          shipmentId,
          stock.id,
          stock.stock_code || "",
          stock.part_name || "",
          lot?.id || null,
          lot?.tracking_no || "",
          lot?.lot_no || "",
          lot?.serial_no || "",
          line.pallet_no || "",
          line.box_no || "",
          line.barcode_no || generateShipmentBarcodeLineNo(),
          Number(line.planned_qty || 0),
          stock.unit || line.unit || "Adet",
          line.note || ""
        ]);
      }

      await dbRun("COMMIT");

      res.json({
        success: true,
        message: "Sevkiyat planı oluşturuldu.",
        id: shipmentId,
        shipment_no: shipmentNo
      });

    } catch (err) {
      await dbRun("ROLLBACK");
      throw err;
    }

  } catch (err) {
    console.error("Sevkiyat oluşturma hatası:", err);
    res.status(500).json({ success: false, message: err.message });
  }
});

/* Barkod okut / satır onayla */
app.post("/api/shipment-barcode/plans/:id/scan", async (req, res) => {
  try {
    const { barcode_no, quantity, scanned_by } = req.body;

    if (!barcode_no) {
      return res.status(400).json({ success: false, message: "Barkod zorunludur." });
    }

    const plan = await dbGet(`SELECT * FROM shipment_barcode_plans WHERE id = ?`, [req.params.id]);
    if (!plan) return res.status(404).json({ success: false, message: "Sevkiyat bulunamadı." });

    if (plan.status === "Sevk Edildi") {
      return res.status(400).json({ success: false, message: "Sevk edilmiş plan okutulamaz." });
    }

    const line = await dbGet(`
      SELECT *
      FROM shipment_barcode_lines
      WHERE shipment_id = ?
        AND (
          barcode_no = ? OR
          pallet_no = ? OR
          box_no = ? OR
          tracking_no = ? OR
          lot_no = ? OR
          serial_no = ?
        )
    `, [req.params.id, barcode_no, barcode_no, barcode_no, barcode_no, barcode_no, barcode_no]);

    if (!line) {
      return res.status(404).json({ success: false, message: "Barkod bu sevkiyat planında bulunamadı." });
    }

    const qty = Number(quantity || line.planned_qty || 0);
    const planned = Number(line.planned_qty || 0);
    const newScanned = Number(line.scanned_qty || 0) + qty;

    if (newScanned > planned) {
      return res.status(400).json({
        success: false,
        message: `Okutulan miktar planlananı geçemez. Plan: ${planned}, okutulmuş: ${line.scanned_qty}`
      });
    }

    await dbRun(`
      UPDATE shipment_barcode_lines
      SET scanned_qty = ?,
          status = CASE WHEN ? >= planned_qty THEN 'Okutuldu' ELSE 'Kısmi Okutuldu' END
      WHERE id = ?
    `, [newScanned, newScanned, line.id]);

    const remaining = await dbGet(`
      SELECT COUNT(*) AS c
      FROM shipment_barcode_lines
      WHERE shipment_id = ?
        AND scanned_qty < planned_qty
    `, [req.params.id]);

    if (remaining.c === 0) {
      await dbRun(`UPDATE shipment_barcode_plans SET status = 'Hazır' WHERE id = ?`, [req.params.id]);
    }

    res.json({
      success: true,
      message: "Barkod okutuldu.",
      line_id: line.id,
      scanned_qty: newScanned
    });

  } catch (err) {
    console.error("Barkod okutma hatası:", err);
    res.status(500).json({ success: false, message: err.message });
  }
});

/* Sevkiyatı onayla */
app.put("/api/shipment-barcode/plans/:id/approve", async (req, res) => {
  try {
    const approvedBy = req.body.approved_by || req.headers["x-user-name"] || "Sistem";

    const plan = await dbGet(`SELECT * FROM shipment_barcode_plans WHERE id = ?`, [req.params.id]);
    if (!plan) return res.status(404).json({ success: false, message: "Sevkiyat bulunamadı." });

    if (plan.status === "Sevk Edildi") {
      return res.status(400).json({ success: false, message: "Bu sevkiyat zaten onaylanmış." });
    }

    const lines = await dbAll(`SELECT * FROM shipment_barcode_lines WHERE shipment_id = ?`, [req.params.id]);
    if (!lines.length) return res.status(400).json({ success: false, message: "Sevkiyat satırı yok." });

    const notReady = lines.filter(l => Number(l.scanned_qty || 0) < Number(l.planned_qty || 0));
    if (notReady.length) {
      return res.status(400).json({
        success: false,
        message: "Tüm satırlar okutulmadan sevkiyat onaylanamaz."
      });
    }

    await dbRun("BEGIN TRANSACTION");

    try {
      for (const line of lines) {
        const qty = Number(line.scanned_qty || line.planned_qty || 0);

        const stock = await dbGet(`SELECT * FROM stocks WHERE id = ?`, [line.stock_id]);
        if (!stock) throw new Error(`${line.part_name || line.stock_code} stok kartı bulunamadı.`);

        const previousStock = Number(stock.quantity || 0);
        if (previousStock < qty) {
          throw new Error(`${stock.part_name || stock.stock_code} için stok yetersiz. Mevcut: ${previousStock}, sevk: ${qty}`);
        }

        const nextStock = previousStock - qty;

        await dbRun(`UPDATE stocks SET quantity = ? WHERE id = ?`, [nextStock, stock.id]);

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
          VALUES (?, datetime('now'), ?, ?, ?, 'Sevkiyat Çıkış', ?, ?, ?, ?, ?, datetime('now'))
        `, [
          "HRK" + Date.now() + line.id,
          stock.id,
          stock.stock_code || "",
          stock.part_name || "",
          qty,
          previousStock,
          nextStock,
          `${plan.shipment_no} numaralı barkodlu sevkiyat`,
          approvedBy
        ]);

        if (line.lot_serial_id) {
          const lot = await dbGet(`SELECT * FROM lot_serials WHERE id = ?`, [line.lot_serial_id]);
          if (lot) {
            const prevLot = Number(lot.remaining_quantity || 0);
            if (prevLot < qty) {
              throw new Error(`${line.tracking_no || line.lot_no} lot miktarı yetersiz. Kalan: ${prevLot}, sevk: ${qty}`);
            }

            const nextLot = prevLot - qty;

            await dbRun(`
              INSERT INTO lot_serial_movements
              (
                lot_serial_id,
                movement_no,
                movement_type,
                quantity,
                previous_quantity,
                next_quantity,
                work_order_id,
                work_order_no,
                customer_id,
                customer_name,
                description,
                created_by
              )
              VALUES (?, ?, 'Sevkiyat', ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `, [
              lot.id,
              "LTH" + Date.now() + line.id,
              qty,
              prevLot,
              nextLot,
              plan.work_order_id || null,
              plan.work_order_no || "",
              plan.customer_id || null,
              plan.customer_name || "",
              `${plan.shipment_no} numaralı sevkiyat`,
              approvedBy
            ]);

            await dbRun(`
              UPDATE lot_serials
              SET remaining_quantity = ?,
                  status = CASE WHEN ? <= 0 THEN 'Tükendi' ELSE status END
              WHERE id = ?
            `, [nextLot, nextLot, lot.id]);
          }
        }

        await dbRun(`
          UPDATE shipment_barcode_lines
          SET shipped_qty = ?,
              status = 'Sevk Edildi'
          WHERE id = ?
        `, [qty, line.id]);
      }

      await dbRun(`
        UPDATE shipment_barcode_plans
        SET status = 'Sevk Edildi',
            approved_by = ?,
            approved_at = datetime('now')
        WHERE id = ?
      `, [approvedBy, req.params.id]);

      await dbRun("COMMIT");

      res.json({
        success: true,
        message: "Sevkiyat onaylandı, stok ve lot hareketleri oluşturuldu."
      });

    } catch (err) {
      await dbRun("ROLLBACK");
      throw err;
    }

  } catch (err) {
    console.error("Sevkiyat onaylama hatası:", err);
    res.status(500).json({ success: false, message: err.message });
  }
});

/* İptal */
app.put("/api/shipment-barcode/plans/:id/cancel", async (req, res) => {
  try {
    const { cancel_reason, cancelled_by } = req.body;

    const plan = await dbGet(`SELECT * FROM shipment_barcode_plans WHERE id = ?`, [req.params.id]);
    if (!plan) return res.status(404).json({ success: false, message: "Sevkiyat bulunamadı." });

    if (plan.status === "Sevk Edildi") {
      return res.status(400).json({ success: false, message: "Sevk edilmiş plan iptal edilemez." });
    }

    await dbRun(`
      UPDATE shipment_barcode_plans
      SET status = 'İptal',
          cancelled_by = ?,
          cancelled_at = datetime('now'),
          cancel_reason = ?
      WHERE id = ?
    `, [
      cancelled_by || req.headers["x-user-name"] || "Sistem",
      cancel_reason || "Sebep belirtilmedi",
      req.params.id
    ]);

    res.json({ success: true, message: "Sevkiyat iptal edildi." });
  } catch (err) {
    console.error("Sevkiyat iptal hatası:", err);
    res.status(500).json({ success: false, message: err.message });
  }
});

/* Sil */
app.delete("/api/shipment-barcode/plans/:id", async (req, res) => {
  try {
    const plan = await dbGet(`SELECT * FROM shipment_barcode_plans WHERE id = ?`, [req.params.id]);
    if (!plan) return res.status(404).json({ success: false, message: "Sevkiyat bulunamadı." });

    if (plan.status === "Sevk Edildi") {
      return res.status(400).json({ success: false, message: "Sevk edilmiş plan silinemez." });
    }

    await dbRun(`DELETE FROM shipment_barcode_lines WHERE shipment_id = ?`, [req.params.id]);
    await dbRun(`DELETE FROM shipment_barcode_plans WHERE id = ?`, [req.params.id]);

    res.json({ success: true, message: "Sevkiyat planı silindi." });
  } catch (err) {
    console.error("Sevkiyat silme hatası:", err);
    res.status(500).json({ success: false, message: err.message });
  }
});


app.get("/api/operator-performance", (req, res) => {
  const { startDate, endDate, operator } = req.query;

  let sql = `
    SELECT *
    FROM operator_performance
    WHERE 1=1
  `;

  const params = [];

  if (startDate) {
    sql += ` AND date(performance_date) >= date(?)`;
    params.push(startDate);
  }

  if (endDate) {
    sql += ` AND date(performance_date) <= date(?)`;
    params.push(endDate);
  }

  if (operator) {
    sql += ` AND operator_name LIKE ?`;
    params.push(`%${operator}%`);
  }

  sql += ` ORDER BY performance_date DESC, id DESC`;

  db.all(sql, params, (err, rows) => {
    if (err) {
      console.error("Operatör performans listeleme hatası:", err);
      return res.status(500).json({ success: false, message: err.message });
    }

    res.json({ success: true, data: rows });
  });
});


app.post("/api/operator-performance", (req, res) => {
  const {
    operator_name,
    work_order_no,
    machine_name,
    operation_name,
    target_qty,
    production_qty,
    scrap_qty,
    worked_minutes,
    is_completed,
    performance_date,
    note
  } = req.body;

  if (!operator_name) {
    return res.status(400).json({
      success: false,
      message: "Operatör adı zorunludur."
    });
  }

  db.run(`
    INSERT INTO operator_performance (
      operator_name,
      work_order_no,
      machine_name,
      operation_name,
      target_qty,
      production_qty,
      scrap_qty,
      worked_minutes,
      is_completed,
      performance_date,
      note
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, [
    operator_name,
    work_order_no || "",
    machine_name || "",
    operation_name || "",
    Number(target_qty || 0),
    Number(production_qty || 0),
    Number(scrap_qty || 0),
    Number(worked_minutes || 0),
    is_completed ? 1 : 0,
    performance_date || new Date().toISOString().slice(0, 10),
    note || ""
  ], function(err) {
    if (err) {
      console.error("Operatör performans ekleme hatası:", err);
      return res.status(500).json({ success: false, message: err.message });
    }

    res.json({
      success: true,
      message: "Operatör performans kaydı oluşturuldu.",
      id: this.lastID
    });
  });
});


app.put("/api/operator-performance/:id", (req, res) => {
  const { id } = req.params;

  const {
    operator_name,
    work_order_no,
    machine_name,
    operation_name,
    target_qty,
    production_qty,
    scrap_qty,
    worked_minutes,
    is_completed,
    performance_date,
    note
  } = req.body;

  db.run(`
    UPDATE operator_performance
    SET
      operator_name = ?,
      work_order_no = ?,
      machine_name = ?,
      operation_name = ?,
      target_qty = ?,
      production_qty = ?,
      scrap_qty = ?,
      worked_minutes = ?,
      is_completed = ?,
      performance_date = ?,
      note = ?
    WHERE id = ?
  `, [
    operator_name,
    work_order_no || "",
    machine_name || "",
    operation_name || "",
    Number(target_qty || 0),
    Number(production_qty || 0),
    Number(scrap_qty || 0),
    Number(worked_minutes || 0),
    is_completed ? 1 : 0,
    performance_date || new Date().toISOString().slice(0, 10),
    note || "",
    id
  ], function(err) {
    if (err) {
      console.error("Operatör performans güncelleme hatası:", err);
      return res.status(500).json({ success: false, message: err.message });
    }

    res.json({
      success: true,
      message: "Operatör performans kaydı güncellendi."
    });
  });
});


app.delete("/api/operator-performance/:id", (req, res) => {
  const { id } = req.params;

  db.run(`
    DELETE FROM operator_performance
    WHERE id = ?
  `, [id], function(err) {
    if (err) {
      console.error("Operatör performans silme hatası:", err);
      return res.status(500).json({ success: false, message: err.message });
    }

    res.json({
      success: true,
      message: "Operatör performans kaydı silindi."
    });
  });
});


app.get("/api/operator-performance/summary", (req, res) => {
  const { startDate, endDate } = req.query;

  let sql = `
    SELECT
      operator_name,
      SUM(production_qty) AS total_production,
      SUM(scrap_qty) AS total_scrap,
      SUM(worked_minutes) AS total_worked_minutes,
      SUM(is_completed) AS completed_work_orders,
      AVG(
        CASE 
          WHEN target_qty > 0 THEN (production_qty * 100.0 / target_qty)
          ELSE 0
        END
      ) AS efficiency_rate,
      CASE
        WHEN SUM(production_qty + scrap_qty) > 0
        THEN SUM(scrap_qty) * 100.0 / SUM(production_qty + scrap_qty)
        ELSE 0
      END AS scrap_rate
    FROM operator_performance
    WHERE 1=1
  `;

  const params = [];

  if (startDate) {
    sql += ` AND date(performance_date) >= date(?)`;
    params.push(startDate);
  }

  if (endDate) {
    sql += ` AND date(performance_date) <= date(?)`;
    params.push(endDate);
  }

  sql += `
    GROUP BY operator_name
    ORDER BY efficiency_rate DESC, total_production DESC
  `;

  db.all(sql, params, (err, rows) => {
    if (err) {
      console.error("Operatör performans özet hatası:", err);
      return res.status(500).json({ success: false, message: err.message });
    }

    res.json({ success: true, data: rows });
  });
});

app.get("/api/machine-downtimes", (req, res) => {
  const { startDate, endDate, machine } = req.query;

  let sql = `
    SELECT *
    FROM machine_downtimes
    WHERE 1=1
  `;

  const params = [];

  if (startDate) {
    sql += ` AND date(start_time) >= date(?)`;
    params.push(startDate);
  }

  if (endDate) {
    sql += ` AND date(start_time) <= date(?)`;
    params.push(endDate);
  }

  if (machine) {
    sql += ` AND machine_name LIKE ?`;
    params.push(`%${machine}%`);
  }

  sql += ` ORDER BY start_time DESC, id DESC`;

  db.all(sql, params, (err, rows) => {
    if (err) {
      console.error("Makine duruş listeleme hatası:", err);
      return res.status(500).json({ success:false, message:err.message });
    }

    res.json({ success:true, data:rows });
  });
});


app.post("/api/machine-downtimes", (req, res) => {
  const {
    machine_name,
    operator_name,
    work_order_no,
    downtime_reason,
    downtime_type,
    start_time,
    end_time,
    description
  } = req.body;

  if (!machine_name || !downtime_reason || !start_time) {
    return res.status(400).json({
      success:false,
      message:"Makine, duruş nedeni ve başlangıç zamanı zorunludur."
    });
  }

  const total_minutes = calculateMinutes(start_time, end_time);

  db.run(`
    INSERT INTO machine_downtimes (
      machine_name,
      operator_name,
      work_order_no,
      downtime_reason,
      downtime_type,
      start_time,
      end_time,
      total_minutes,
      description
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, [
    machine_name,
    operator_name || "",
    work_order_no || "",
    downtime_reason,
    downtime_type || "plansiz",
    start_time,
    end_time || null,
    total_minutes,
    description || ""
  ], function(err) {
    if (err) {
      console.error("Makine duruş ekleme hatası:", err);
      return res.status(500).json({ success:false, message:err.message });
    }

    res.json({
      success:true,
      message:"Makine duruş kaydı oluşturuldu.",
      id:this.lastID
    });
  });
});


app.put("/api/machine-downtimes/:id", (req, res) => {
  const { id } = req.params;

  const {
    machine_name,
    operator_name,
    work_order_no,
    downtime_reason,
    downtime_type,
    start_time,
    end_time,
    description
  } = req.body;

  const total_minutes = calculateMinutes(start_time, end_time);

  db.run(`
    UPDATE machine_downtimes
    SET
      machine_name = ?,
      operator_name = ?,
      work_order_no = ?,
      downtime_reason = ?,
      downtime_type = ?,
      start_time = ?,
      end_time = ?,
      total_minutes = ?,
      description = ?
    WHERE id = ?
  `, [
    machine_name,
    operator_name || "",
    work_order_no || "",
    downtime_reason,
    downtime_type || "plansiz",
    start_time,
    end_time || null,
    total_minutes,
    description || "",
    id
  ], function(err) {
    if (err) {
      console.error("Makine duruş güncelleme hatası:", err);
      return res.status(500).json({ success:false, message:err.message });
    }

    res.json({
      success:true,
      message:"Makine duruş kaydı güncellendi."
    });
  });
});


app.delete("/api/machine-downtimes/:id", (req, res) => {
  const { id } = req.params;

  db.run(`
    DELETE FROM machine_downtimes
    WHERE id = ?
  `, [id], function(err) {
    if (err) {
      console.error("Makine duruş silme hatası:", err);
      return res.status(500).json({ success:false, message:err.message });
    }

    res.json({
      success:true,
      message:"Makine duruş kaydı silindi."
    });
  });
});


app.get("/api/machine-downtimes/summary", (req, res) => {
  const { startDate, endDate } = req.query;

  let sql = `
    SELECT
      machine_name,
      COUNT(*) AS downtime_count,
      SUM(total_minutes) AS total_minutes,
      SUM(CASE WHEN downtime_type = 'planli' THEN total_minutes ELSE 0 END) AS planned_minutes,
      SUM(CASE WHEN downtime_type = 'plansiz' THEN total_minutes ELSE 0 END) AS unplanned_minutes
    FROM machine_downtimes
    WHERE 1=1
  `;

  const params = [];

  if (startDate) {
    sql += ` AND date(start_time) >= date(?)`;
    params.push(startDate);
  }

  if (endDate) {
    sql += ` AND date(start_time) <= date(?)`;
    params.push(endDate);
  }

  sql += `
    GROUP BY machine_name
    ORDER BY total_minutes DESC
  `;

  db.all(sql, params, (err, rows) => {
    if (err) {
      console.error("Makine duruş özet hatası:", err);
      return res.status(500).json({ success:false, message:err.message });
    }

    res.json({ success:true, data:rows });
  });
});

app.get("/api/notifications", (req, res) => {
  db.all(`
    SELECT *
    FROM notifications
    ORDER BY datetime(created_at) DESC
    LIMIT 100
  `, [], (err, rows) => {
    if (err) {
      console.error("Bildirim listeleme hatası:", err);
      return res.status(500).json({
        success: false,
        message: err.message
      });
    }

    db.get(`
      SELECT COUNT(*) AS unreadCount
      FROM notifications
      WHERE is_read = 0
    `, [], (countErr, countRow) => {
      if (countErr) {
        console.error("Bildirim sayısı hatası:", countErr);
        return res.status(500).json({
          success: false,
          message: countErr.message
        });
      }

      res.json({
        success: true,
        unreadCount: countRow?.unreadCount || 0,
        notifications: rows || []
      });
    });
  });
});

};
