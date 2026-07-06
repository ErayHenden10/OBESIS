// MAL KABUL OLUŞTUR
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
// MAL KABUL OLUŞTUR
// ===============================
app.post("/api/goods-receipts", (req, res) => {
  const {
    purchaseOrderId,
    stockId,
    warehouseId,
    receivedQuantity,
    deliveryNoteNo,
    receiptDate,
    description,
    createdBy
  } = req.body;

  if (!stockId || !warehouseId || !receivedQuantity) {
    return res.status(400).json({
      success:false,
      message:"Malzeme, depo ve gelen miktar zorunludur."
    });
  }

  const receiptNo = "MK" + Date.now();

  db.run(`
    INSERT INTO goods_receipts (
      receipt_no,
      purchase_order_id,
      stock_id,
      warehouse_id,
      received_quantity,
      delivery_note_no,
      receipt_date,
      status,
      description,
      created_by
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, 'Beklemede', ?, ?)
  `, [
    receiptNo,
    purchaseOrderId || null,
    stockId,
    warehouseId,
    receivedQuantity,
    deliveryNoteNo || "",
    receiptDate || new Date().toISOString().slice(0,10),
    description || "",
    createdBy || "Admin"
  ], function(err) {
    if (err) {
      console.error("Mal kabul oluşturulamadı:", err);
      return res.status(500).json({ success:false, message:err.message });
    }

    res.json({
      success:true,
      message:"Mal kabul kaydı oluşturuldu.",
      id:this.lastID,
      receiptNo
    });
  });
});

};
