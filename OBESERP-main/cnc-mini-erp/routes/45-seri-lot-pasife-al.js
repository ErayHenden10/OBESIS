// SERİ / LOT PASİFE AL
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
// SERİ / LOT PASİFE AL
// ===============================
app.put("/api/serial-lot-tracking/:id/passive", (req, res) => {
  db.run(`
    UPDATE serial_lot_tracking
    SET status = 'passive'
    WHERE id = ?
  `, [req.params.id], function(err) {
    if (err) {
      console.error("Seri/lot pasife alma hatası:", err);
      return res.status(500).json({ success:false, message:err.message });
    }

    res.json({ success:true, message:"Seri/lot kaydı pasife alındı." });
  });
});

};
