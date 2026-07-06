// MAL KABUL LİSTELE
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
// MAL KABUL LİSTELE
// ===============================
app.get("/api/goods-receipts", (req, res) => {
  db.all(`
    SELECT 
      gr.*,
      po.order_no AS purchase_order_no,
      s.stock_code,
      s.part_name,
      w.warehouse_name
    FROM goods_receipts gr
    LEFT JOIN purchase_orders po ON po.id = gr.purchase_order_id
    LEFT JOIN stocks s ON s.id = gr.stock_id
    LEFT JOIN warehouses w ON w.id = gr.warehouse_id
    ORDER BY gr.id DESC
  `, [], (err, rows) => {
    if (err) {
      console.error("Mal kabul listesi alınamadı:", err);
      return res.status(500).json({ success:false, message:err.message });
    }

    res.json({ success:true, receipts:rows });
  });
});

};
