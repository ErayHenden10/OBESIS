// ÜRETİM PLANLAMA / MAKİNE TAKVİMİ
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
// ÜRETİM PLANLAMA / MAKİNE TAKVİMİ
// ======================================

db.run(`
CREATE TABLE IF NOT EXISTS production_plans (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  work_order_id INTEGER NOT NULL,
  work_order_operation_id INTEGER NOT NULL,
  machine_id INTEGER NOT NULL,
  start_time TEXT NOT NULL,
  end_time TEXT NOT NULL,
  status TEXT DEFAULT 'planned',
  operator_name TEXT,
  description TEXT,
  created_by TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
)
`);

app.get("/api/production-plans", (req, res) => {
  const { machineId } = req.query;

  let sql = `
    SELECT
      pp.*,
      wo.work_order_no,
      woo.operation_name,
      woo.operation_code,
      m.machine_name
    FROM production_plans pp
    LEFT JOIN work_orders wo ON wo.id = pp.work_order_id
    LEFT JOIN work_order_operations woo ON woo.id = pp.work_order_operation_id
    LEFT JOIN machine_maintenance m ON m.id = pp.machine_id
    WHERE 1 = 1
  `;

  const params = [];

  if (machineId) {
    sql += ` AND pp.machine_id = ? `;
    params.push(machineId);
  }

  sql += ` ORDER BY datetime(pp.start_time) ASC `;

  db.all(sql, params, (err, rows) => {
    if (err) {
      console.error("Üretim planları listeleme hatası:", err.message);
      return res.status(500).json({
        success: false,
        message: err.message,
        plans: []
      });
    }

    res.json({
      success: true,
      plans: rows || []
    });
  });
});

app.post("/api/production-plans", (req, res) => {
  const {
    workOrderId,
    workOrderOperationId,
    machineId,
    startTime,
    endTime,
    status,
    operatorName,
    description
  } = req.body;

  if (!workOrderId || !workOrderOperationId || !machineId || !startTime || !endTime) {
    return res.status(400).json({
      success: false,
      message: "İş emri, operasyon, makine, başlangıç ve bitiş zorunludur."
    });
  }

  if (new Date(endTime) <= new Date(startTime)) {
    return res.status(400).json({
      success: false,
      message: "Bitiş zamanı başlangıçtan büyük olmalıdır."
    });
  }

  db.get(`
    SELECT id
    FROM production_plans
    WHERE machine_id = ?
      AND status IN ('planned', 'in_progress')
      AND datetime(start_time) < datetime(?)
      AND datetime(end_time) > datetime(?)
  `, [machineId, endTime, startTime], (err, conflict) => {
    if (err) {
      return res.status(500).json({
        success: false,
        message: err.message
      });
    }

    if (conflict) {
      return res.status(400).json({
        success: false,
        message: "Bu makinede seçilen saat aralığında başka plan var."
      });
    }

    db.run(`
      INSERT INTO production_plans
      (
        work_order_id,
        work_order_operation_id,
        machine_id,
        start_time,
        end_time,
        status,
        operator_name,
        description,
        created_by
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    [
      workOrderId,
      workOrderOperationId,
      machineId,
      startTime,
      endTime,
      status || "planned",
      operatorName || "",
      description || "",
      req.headers["x-user-name"] || "Bilinmeyen Kullanıcı"
    ],
    function(err) {
      if (err) {
        console.error("Üretim planı ekleme hatası:", err.message);
        return res.status(500).json({
          success: false,
          message: err.message
        });
      }

      if (typeof addActivityLog === "function") {
        addActivityLog(req, {
          moduleName: "Üretim Planlama",
          actionType: "CREATE",
          description: "Yeni üretim planı oluşturuldu.",
          recordId: this.lastID
        });
      }

      res.json({
        success: true,
        message: "Üretim planı oluşturuldu.",
        id: this.lastID
      });
    });
  });
});

app.put("/api/production-plans/:id/status", (req, res) => {
  const { status } = req.body;

  db.run(`
    UPDATE production_plans
    SET status = ?
    WHERE id = ?
  `, [status, req.params.id], function(err) {
    if (err) {
      return res.status(500).json({
        success: false,
        message: err.message
      });
    }

    res.json({ success: true });
  });
});

app.delete("/api/production-plans/:id", (req, res) => {
  db.run(`
    DELETE FROM production_plans
    WHERE id = ?
  `, [req.params.id], function(err) {
    if (err) {
      return res.status(500).json({
        success: false,
        message: err.message
      });
    }

    res.json({ success: true });
  });
});

};
