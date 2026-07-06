// SERİ / LOT TAKİBİ LİSTELE
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
// SERİ / LOT TAKİBİ LİSTELE
// ===============================
app.get("/api/serial-lot-tracking", (req, res) => {
  db.all(`
    SELECT
      slt.*,
      s.stock_code,
      s.part_name,
      w.warehouse_name,
      gr.receipt_no,
      bl.label_no,
      bl.barcode_value
    FROM serial_lot_tracking slt
    LEFT JOIN stocks s ON s.id = slt.stock_id
    LEFT JOIN warehouses w ON w.id = slt.warehouse_id
    LEFT JOIN goods_receipts gr ON gr.id = slt.goods_receipt_id
    LEFT JOIN barcode_labels bl ON bl.id = slt.barcode_label_id
    ORDER BY slt.id DESC
  `, [], (err, rows) => {
    if (err) {
      console.error("Seri/lot kayıtları alınamadı:", err);
      return res.status(500).json({ success:false, message:err.message });
    }

    res.json({ success:true, records:rows });
  });
});

};
