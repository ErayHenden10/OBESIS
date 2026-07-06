// TAKIM SİL
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
// TAKIM SİL
// ===============================
app.delete("/api/tools/:id", (req, res) => {
  const id = req.params.id;

  db.serialize(() => {
    db.run(`
      DELETE FROM tool_movements
      WHERE tool_id = ?
    `, [id]);

    db.run(`
      DELETE FROM tools
      WHERE id = ?
    `, [id], function(err) {
      if (err) {
        console.error("Takım silme hatası:", err);
        return res.status(500).json({
          success: false,
          message: err.message
        });
      }

      res.json({
        success: true,
        message: "Takım silindi."
      });
    });
  });
});

};
