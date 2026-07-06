// ETİKET OLUŞTUR
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
// ETİKET OLUŞTUR
// ===============================
app.post("/api/barcode-labels", (req, res) => {
  const {
    goodsReceiptId,
    stockId,
    warehouseId,
    lotNo,
    quantity,
    labelDate,
    description,
    createdBy
  } = req.body;

  if (!stockId || !quantity) {
    return res.status(400).json({
      success:false,
      message:"Malzeme ve miktar zorunludur."
    });
  }

  const now = Date.now();
  const labelNo = "ETK" + now;
  const barcodeValue = "BC" + now;
  const qrValue = JSON.stringify({
    labelNo,
    barcodeValue,
    stockId,
    warehouseId,
    lotNo: lotNo || "",
    quantity
  });

  db.run(`
    INSERT INTO barcode_labels (
      label_no,
      barcode_value,
      qr_value,
      goods_receipt_id,
      stock_id,
      warehouse_id,
      lot_no,
      quantity,
      label_date,
      status,
      description,
      created_by
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', ?, ?)
  `, [
    labelNo,
    barcodeValue,
    qrValue,
    goodsReceiptId || null,
    stockId,
    warehouseId || null,
    lotNo || "",
    quantity,
    labelDate || new Date().toISOString().slice(0,10),
    description || "",
    createdBy || "Admin"
  ], function(err) {
    if (err) {
      console.error("Etiket oluşturulamadı:", err);
      return res.status(500).json({ success:false, message:err.message });
    }

    res.json({
      success:true,
      message:"Etiket oluşturuldu.",
      id:this.lastID,
      labelNo,
      barcodeValue,
      qrValue
    });
  });
});

};
