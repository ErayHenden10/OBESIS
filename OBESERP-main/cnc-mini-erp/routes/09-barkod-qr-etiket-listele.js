// BARKOD / QR ETİKET LİSTELE
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
// BARKOD / QR ETİKET LİSTELE
// ===============================
app.get("/api/barcode-labels", (req, res) => {
  db.all(`
    SELECT 
      bl.*,
      gr.receipt_no,
      s.stock_code,
      s.part_name,
      w.warehouse_name
    FROM barcode_labels bl
    LEFT JOIN goods_receipts gr ON gr.id = bl.goods_receipt_id
    LEFT JOIN stocks s ON s.id = bl.stock_id
    LEFT JOIN warehouses w ON w.id = bl.warehouse_id
    ORDER BY bl.id DESC
  `, [], (err, rows) => {
    if (err) {
      console.error("Etiketler alınamadı:", err);
      return res.status(500).json({ success:false, message:err.message });
    }

    res.json({ success:true, labels:rows });
  });
});

};
