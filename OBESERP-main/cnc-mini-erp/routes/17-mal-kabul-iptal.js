// MAL KABUL İPTAL
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
// MAL KABUL İPTAL
// ===============================
app.put("/api/goods-receipts/:id/cancel", (req, res) => {
  db.run(`
    UPDATE goods_receipts
    SET status = 'İptal'
    WHERE id = ? AND status = 'Beklemede'
  `, [req.params.id], function(err) {
    if (err) {
      console.error("Mal kabul iptal hatası:", err);
      return res.status(500).json({ success:false, message:err.message });
    }

    res.json({
      success:true,
      message:"Mal kabul iptal edildi."
    });
  });
});

app.get("/api/operations", (req, res) => {

  db.all(`
    SELECT *
    FROM operations
    ORDER BY operation_code
  `, [], (err, rows) => {

    if (err) {
      return res.status(500).json({
        success:false,
        message:err.message
      });
    }

    res.json({
      success:true,
      operations:rows
    });

  });

});

app.post("/api/operations", (req,res)=>{

  const {
    operationCode,
    operationName,
    machineType,
    standardTime,
    status,
    description
  } = req.body;

  db.run(`
    INSERT INTO operations
    (
      operation_code,
      operation_name,
      machine_type,
      standard_time,
      status,
      description
    )
    VALUES (?,?,?,?,?,?)
  `,
  [
    operationCode,
    operationName,
    machineType,
    standardTime || 0,
    status || "active",
    description || ""
  ],
  function(err){

    if(err){
      return res.status(500).json({
        success:false,
        message:err.message
      });
    }

    res.json({
      success:true,
      id:this.lastID
    });

  });

});

app.put("/api/operations/:id",(req,res)=>{

  const {
    operationCode,
    operationName,
    machineType,
    standardTime,
    status,
    description
  } = req.body;

  db.run(`
    UPDATE operations
    SET
      operation_code=?,
      operation_name=?,
      machine_type=?,
      standard_time=?,
      status=?,
      description=?
    WHERE id=?
  `,
  [
    operationCode,
    operationName,
    machineType,
    standardTime,
    status,
    description,
    req.params.id
  ],
  function(err){

    if(err){
      return res.status(500).json({
        success:false,
        message:err.message
      });
    }

    res.json({success:true});

  });

});

app.get("/api/product-routes/:productId",(req,res)=>{

  db.all(`
    SELECT
      pr.*,
      o.operation_code,
      o.operation_name,
      o.machine_type
    FROM product_routes pr
    LEFT JOIN operations o
      ON o.id = pr.operation_id
    WHERE pr.product_id = ?
    ORDER BY pr.sequence_no
  `,
  [req.params.productId],
  (err,rows)=>{

    if(err){
      return res.status(500).json({
        success:false,
        message:err.message
      });
    }

    res.json({
      success:true,
      routes:rows
    });

  });

});
app.post("/api/product-routes",(req,res)=>{

  const {
    productId,
    operationId,
    sequenceNo,
    plannedTime,
    status,
    description
  } = req.body;

  db.run(`
    INSERT INTO product_routes
    (
      product_id,
      operation_id,
      sequence_no,
      planned_time,
      status,
      description
    )
    VALUES (?,?,?,?,?,?)
  `,
  [
    productId,
    operationId,
    sequenceNo,
    plannedTime || 0,
    status || "active",
    description || ""
  ],
  function(err){

    if(err){
      return res.status(500).json({
        success:false,
        message:err.message
      });
    }

    res.json({
      success:true,
      id:this.lastID
    });

  });

});

};
