// ETİKET PASİFE AL
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
// ETİKET PASİFE AL
// ===============================
app.put("/api/barcode-labels/:id/passive", (req, res) => {
  db.run(`
    UPDATE barcode_labels
    SET status = 'passive'
    WHERE id = ?
  `, [req.params.id], function(err) {
    if (err) {
      console.error("Etiket pasife alma hatası:", err);
      return res.status(500).json({ success:false, message:err.message });
    }

    res.json({ success:true, message:"Etiket pasife alındı." });
  });
});

};
