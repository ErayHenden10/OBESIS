// MALİYET HESAPLAMA OLUŞTUR
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
// MALİYET HESAPLAMA OLUŞTUR
// ===============================
app.post("/api/cost-calculations", (req, res) => {
  const {
    workOrderId,
    stockId,
    productionQuantity,
    materialCost,
    laborHours,
    laborHourRate,
    machineHours,
    machineHourRate,
    overheadCost,
    scrapRate,
    calculationDate,
    description,
    createdBy
  } = req.body;

  const qty = Number(productionQuantity || 1);
  const mat = Number(materialCost || 0);

  const lh = Number(laborHours || 0);
  const lhr = Number(laborHourRate || 0);
  const laborCost = lh * lhr;

  const mh = Number(machineHours || 0);
  const mhr = Number(machineHourRate || 0);
  const machineCost = mh * mhr;

  const overhead = Number(overheadCost || 0);
  const scrap = Number(scrapRate || 0);

  const subtotal = mat + laborCost + machineCost + overhead;
  const scrapCost = subtotal * scrap / 100;
  const totalCost = subtotal + scrapCost;
  const unitCost = qty > 0 ? totalCost / qty : 0;

  const calculationNo = "MAL" + Date.now();

  db.run(`
    INSERT INTO cost_calculations (
      calculation_no,
      work_order_id,
      stock_id,
      production_quantity,
      material_cost,
      labor_hours,
      labor_hour_rate,
      labor_cost,
      machine_hours,
      machine_hour_rate,
      machine_cost,
      overhead_cost,
      scrap_rate,
      scrap_cost,
      total_cost,
      unit_cost,
      calculation_date,
      status,
      description,
      created_by
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'draft', ?, ?)
  `, [
    calculationNo,
    workOrderId || null,
    stockId || null,
    qty,
    mat,
    lh,
    lhr,
    laborCost,
    mh,
    mhr,
    machineCost,
    overhead,
    scrap,
    scrapCost,
    totalCost,
    unitCost,
    calculationDate || new Date().toISOString().slice(0,10),
    description || "",
    createdBy || "Admin"
  ], function(err) {
    if (err) {
      console.error("Maliyet hesabı oluşturulamadı:", err);
      return res.status(500).json({ success:false, message:err.message });
    }

    res.json({
      success:true,
      message:"Maliyet hesabı oluşturuldu.",
      id:this.lastID,
      calculationNo,
      totalCost,
      unitCost
    });
  });
});

};
