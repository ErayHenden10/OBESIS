// FIRE / HURDA OLUŞTUR
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
// FIRE / HURDA OLUŞTUR
// ===============================
app.post("/api/scrap-records", (req, res) => {
  const {
    workOrderId,
    stockId,
    warehouseId,
    scrapType,
    quantity,
    reason,
    scrapDate,
    description,
    createdBy
  } = req.body;

  if (!stockId || !quantity) {
    return res.status(400).json({
      success:false,
      message:"Malzeme ve miktar zorunludur."
    });
  }

  const scrapNo = "FRH" + Date.now();

  db.run(`
    INSERT INTO scrap_records (
      scrap_no,
      work_order_id,
      stock_id,
      warehouse_id,
      scrap_type,
      quantity,
      reason,
      scrap_date,
      status,
      description,
      created_by
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'Beklemede', ?, ?)
  `, [
    scrapNo,
    workOrderId || null,
    stockId,
    warehouseId || null,
    scrapType || "scrap",
    quantity,
    reason || "",
    scrapDate || new Date().toISOString().slice(0,10),
    description || "",
    createdBy || "Admin"
  ], function(err) {
    if (err) {
      console.error("Fire/hurda oluşturulamadı:", err);
      return res.status(500).json({ success:false, message:err.message });
    }

    res.json({
      success:true,
      message:"Fire/hurda kaydı oluşturuldu.",
      id:this.lastID,
      scrapNo
    });
  });
});

};
