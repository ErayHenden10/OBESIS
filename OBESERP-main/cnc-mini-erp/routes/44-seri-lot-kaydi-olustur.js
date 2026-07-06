// SERİ / LOT KAYDI OLUŞTUR
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
// SERİ / LOT KAYDI OLUŞTUR
// ===============================
app.post("/api/serial-lot-tracking", (req, res) => {
  const {
    stockId,
    warehouseId,
    goodsReceiptId,
    barcodeLabelId,
    lotNo,
    serialNo,
    quantity,
    productionDate,
    expireDate,
    description,
    createdBy
  } = req.body;

  if (!stockId || !quantity) {
    return res.status(400).json({
      success:false,
      message:"Malzeme ve miktar zorunludur."
    });
  }

  if (!lotNo && !serialNo) {
    return res.status(400).json({
      success:false,
      message:"Lot no veya seri no alanlarından en az biri girilmelidir."
    });
  }

  const trackingNo = "SLT" + Date.now();

  db.run(`
    INSERT INTO serial_lot_tracking (
      tracking_no,
      stock_id,
      warehouse_id,
      goods_receipt_id,
      barcode_label_id,
      lot_no,
      serial_no,
      quantity,
      remaining_quantity,
      production_date,
      expire_date,
      status,
      description,
      created_by
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', ?, ?)
  `, [
    trackingNo,
    stockId,
    warehouseId || null,
    goodsReceiptId || null,
    barcodeLabelId || null,
    lotNo || "",
    serialNo || "",
    quantity,
    quantity,
    productionDate || null,
    expireDate || null,
    description || "",
    createdBy || "Admin"
  ], function(err) {
    if (err) {
      console.error("Seri/lot kaydı oluşturulamadı:", err);
      return res.status(500).json({ success:false, message:err.message });
    }

    res.json({
      success:true,
      message:"Seri/lot kaydı oluşturuldu.",
      id:this.lastID,
      trackingNo
    });
  });
});

};
