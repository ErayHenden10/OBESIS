// FIRE / HURDA LİSTELE
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
// FIRE / HURDA LİSTELE
// ===============================
app.get("/api/scrap-records", (req, res) => {
  db.all(`
    SELECT 
      sr.*,
      wo.work_order_no,
      wo.title AS work_order_title,
      s.stock_code,
      s.part_name,
      w.warehouse_name
    FROM scrap_records sr
    LEFT JOIN work_orders wo ON wo.id = sr.work_order_id
    LEFT JOIN stocks s ON s.id = sr.stock_id
    LEFT JOIN warehouses w ON w.id = sr.warehouse_id
    ORDER BY sr.id DESC
  `, [], (err, rows) => {
    if (err) {
      console.error("Fire/hurda kayıtları alınamadı:", err);
      return res.status(500).json({ success:false, message:err.message });
    }

    res.json({ success:true, records:rows });
  });
});

};
