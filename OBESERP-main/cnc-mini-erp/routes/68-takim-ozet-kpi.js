// TAKIM ÖZET KPI
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
// TAKIM ÖZET KPI
// ===============================
app.get("/api/tools-summary", (req, res) => {
  db.get(`
    SELECT
      COUNT(*) AS total_tools,
      SUM(CASE WHEN status = 'Aktif' THEN 1 ELSE 0 END) AS active_tools,
      SUM(CASE WHEN status = 'Kritik' THEN 1 ELSE 0 END) AS critical_tools,
      SUM(CASE WHEN status = 'Ömrü Bitti' THEN 1 ELSE 0 END) AS expired_tools
    FROM tools
  `, [], (err, row) => {
    if (err) {
      return res.status(500).json({
        success: false,
        message: err.message
      });
    }

    res.json({
      success: true,
      summary: row || {}
    });
  });
});

};
