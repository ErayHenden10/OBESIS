// TEK BİLDİRİMİ OKUNDU YAP
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
// TEK BİLDİRİMİ OKUNDU YAP
// ===============================
app.put("/api/notifications/:id/read", (req, res) => {
  const id = req.params.id;

  db.run(`
    UPDATE notifications
    SET is_read = 1
    WHERE id = ?
  `, [id], function(err) {
    if (err) {
      console.error("Bildirim okundu hatası:", err);
      return res.status(500).json({
        success: false,
        message: err.message
      });
    }

    res.json({
      success: true,
      message: "Bildirim okundu olarak işaretlendi."
    });
  });
});

};
