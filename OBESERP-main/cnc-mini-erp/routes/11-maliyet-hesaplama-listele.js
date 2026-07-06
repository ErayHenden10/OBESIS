// MALİYET HESAPLAMA LİSTELE
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
// MALİYET HESAPLAMA LİSTELE
// ===============================
app.get("/api/cost-calculations", (req, res) => {
  db.all(`
    SELECT 
      cc.*,
      wo.work_order_no,
      wo.title AS work_order_title,
      s.stock_code,
      s.part_name
    FROM cost_calculations cc
    LEFT JOIN work_orders wo ON wo.id = cc.work_order_id
    LEFT JOIN stocks s ON s.id = cc.stock_id
    ORDER BY cc.id DESC
  `, [], (err, rows) => {
    if (err) {
      console.error("Maliyet hesapları alınamadı:", err);
      return res.status(500).json({ success:false, message:err.message });
    }

    res.json({ success:true, calculations:rows });
  });
});

};
