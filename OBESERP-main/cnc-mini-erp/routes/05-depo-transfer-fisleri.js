// DEPO TRANSFER FİŞLERİ
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
// DEPO TRANSFER FİŞLERİ
// ===============================

app.get("/api/stock-transfers", (req, res) => {
  db.all(`
    SELECT
      st.id,
      st.transfer_no,
      st.source_warehouse_id,
      sw.warehouse_name AS source_warehouse_name,
      st.target_warehouse_id,
      tw.warehouse_name AS target_warehouse_name,
      st.stock_id,
      s.stock_code,
      s.part_name,
      st.quantity,
      st.transfer_date,
      st.status,
      st.description,
      st.created_by,
      st.created_at
    FROM stock_transfers st
    LEFT JOIN warehouses sw ON sw.id = st.source_warehouse_id
    LEFT JOIN warehouses tw ON tw.id = st.target_warehouse_id
    LEFT JOIN stocks s ON s.id = st.stock_id
    ORDER BY st.id DESC
  `, [], (err, rows) => {
    if (err) {
      console.error("Transfer fişleri listeleme hatası:", err.message);

      return res.status(500).json({
        success: false,
        message: err.message,
        transfers: []
      });
    }

    res.json({
      success: true,
      transfers: rows || []
    });
  });
});

app.post("/api/stock-transfers", (req, res) => {
  const {
    sourceWarehouseId,
    targetWarehouseId,
    stockId,
    quantity,
    transferDate,
    description
  } = req.body;

  if (!sourceWarehouseId || !targetWarehouseId || !stockId || !quantity) {
    return res.status(400).json({
      success: false,
      message: "Kaynak depo, hedef depo, stok ve miktar zorunludur."
    });
  }

  if (String(sourceWarehouseId) === String(targetWarehouseId)) {
    return res.status(400).json({
      success: false,
      message: "Kaynak depo ve hedef depo aynı olamaz."
    });
  }

  const transferNo = "TRF" + Date.now();
  const createdBy = req.headers["x-user-name"] || "Bilinmeyen Kullanıcı";

  db.run(`
    INSERT INTO stock_transfers
    (
      transfer_no,
      source_warehouse_id,
      target_warehouse_id,
      stock_id,
      quantity,
      transfer_date,
      status,
      description,
      created_by
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `,
  [
    transferNo,
    sourceWarehouseId,
    targetWarehouseId,
    stockId,
    Number(quantity || 0),
    transferDate || new Date().toISOString().split("T")[0],
    "pending",
    description || "",
    createdBy
  ],
  function(err) {
    if (err) {
      console.error("Transfer fişi oluşturma hatası:", err.message);

      return res.status(500).json({
        success: false,
        message: err.message
      });
    }

    if (typeof addActivityLog === "function") {
      addActivityLog(req, {
        moduleName: "Transfer Fişleri",
        actionType: "CREATE",
        description: transferNo + " numaralı transfer fişi oluşturuldu.",
        recordId: this.lastID
      });
    }

    res.json({
      success: true,
      message: "Transfer fişi oluşturuldu.",
      id: this.lastID,
      transferNo
    });
  });
});

};
