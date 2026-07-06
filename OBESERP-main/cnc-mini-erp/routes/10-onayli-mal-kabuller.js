// ONAYLI MAL KABULLER
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
// ONAYLI MAL KABULLER
// ===============================
app.get("/api/goods-receipts-approved", (req, res) => {
  db.all(`
    SELECT 
      gr.*,
      s.stock_code,
      s.part_name,
      w.warehouse_name
    FROM goods_receipts gr
    LEFT JOIN stocks s ON s.id = gr.stock_id
    LEFT JOIN warehouses w ON w.id = gr.warehouse_id
    WHERE gr.status = 'Onaylandı'
    ORDER BY gr.id DESC
  `, [], (err, rows) => {
    if (err) {
      console.error("Onaylı mal kabuller alınamadı:", err);
      return res.status(500).json({ success:false, message:err.message });
    }

    res.json({ success:true, receipts:rows });
  });
});

};
