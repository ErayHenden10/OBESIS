// TAKIM DETAY
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
// TAKIM DETAY
// ===============================
app.get("/api/tools/:id", (req, res) => {
  const id = req.params.id;

  db.get(`
    SELECT *
    FROM tools
    WHERE id = ?
  `, [id], (err, tool) => {
    if (err) {
      return res.status(500).json({
        success: false,
        message: err.message
      });
    }

    if (!tool) {
      return res.status(404).json({
        success: false,
        message: "Takım bulunamadı."
      });
    }

    db.all(`
      SELECT *
      FROM tool_movements
      WHERE tool_id = ?
      ORDER BY datetime(created_at) DESC
    `, [id], (moveErr, movements) => {
      if (moveErr) {
        return res.status(500).json({
          success: false,
          message: moveErr.message
        });
      }

      res.json({
        success: true,
        tool,
        movements: movements || []
      });
    });
  });
});

};
