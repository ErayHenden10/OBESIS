// AKTİVİTE LOGLARI
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
// AKTİVİTE LOGLARI
// ======================================

app.get("/api/activity-logs", (req, res) => {
  const role = req.headers["x-user-role"];

  if (role !== "superadmin") {
    return res.status(403).json({
      success: false,
      message: "Logları sadece Süper Admin görüntüleyebilir.",
      logs: []
    });
  }

  db.all(`
    SELECT
      id,
      user_id,
      user_name,
      role_key,
      module_name,
      action_type,
      description,
      record_id,
      ip_address,
      created_at
    FROM activity_logs
    ORDER BY id DESC
    LIMIT 300
  `, [], (err, rows) => {
    if (err) {
      console.error("Log listeleme hatası:", err.message);

      return res.status(500).json({
        success: false,
        message: err.message,
        logs: []
      });
    }

    res.json({
      success: true,
      logs: rows || []
    });
  });
});

};
