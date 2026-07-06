// MALİYET HESABI SİL / İPTAL
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
// MALİYET HESABI SİL / İPTAL
// ===============================
app.put("/api/cost-calculations/:id/cancel", (req, res) => {
  db.run(`
    UPDATE cost_calculations
    SET status = 'cancelled'
    WHERE id = ?
  `, [req.params.id], function(err) {
    if (err) {
      console.error("Maliyet iptal hatası:", err);
      return res.status(500).json({ success:false, message:err.message });
    }

    res.json({ success:true, message:"Maliyet hesabı iptal edildi." });
  });
});

};
