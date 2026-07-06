// MAL KABUL ONAYLA
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
// MAL KABUL ONAYLA
// ===============================
app.put("/api/goods-receipts/:id/approve", (req, res) => {
  const receiptId = req.params.id;

  db.get(`
    SELECT *
    FROM goods_receipts
    WHERE id = ?
  `, [receiptId], (err, receipt) => {
    if (err) {
      console.error("Mal kabul sorgu hatası:", err);
      return res.status(500).json({ success:false, message:err.message });
    }

    if (!receipt) {
      return res.status(404).json({
        success:false,
        message:"Mal kabul kaydı bulunamadı."
      });
    }

    if (receipt.status === "Onaylandı") {
      return res.status(400).json({
        success:false,
        message:"Bu mal kabul zaten onaylanmış."
      });
    }

    db.get(`
      SELECT quantity
      FROM warehouse_stocks
      WHERE warehouse_id = ? AND stock_id = ?
    `, [receipt.warehouse_id, receipt.stock_id], (err, currentStock) => {
      if (err) {
        console.error("Depo stok sorgu hatası:", err);
        return res.status(500).json({ success:false, message:err.message });
      }

      const previousQty = currentStock ? Number(currentStock.quantity) : 0;
      const nextQty = previousQty + Number(receipt.received_quantity);

      db.serialize(() => {
        db.run("BEGIN TRANSACTION");

        db.run(`
          INSERT INTO warehouse_stocks (
            warehouse_id,
            stock_id,
            quantity
          )
          VALUES (?, ?, ?)
          ON CONFLICT(warehouse_id, stock_id)
          DO UPDATE SET quantity = quantity + excluded.quantity
        `, [
          receipt.warehouse_id,
          receipt.stock_id,
          receipt.received_quantity
        ]);

        db.run(`
          UPDATE goods_receipts
          SET status = 'Onaylandı'
          WHERE id = ?
        `, [receiptId]);

db.run(`
  INSERT INTO stock_movements (
    movement_no,
    movement_date,
    stock_id,
    movement_type,
    quantity,
    before_qty,
    after_qty,
    document_no,
    description,
    created_by
  )
  VALUES (?, DATETIME('now'), ?, 'in', ?, ?, ?, ?, ?, ?)
`, [
  "HRK" + Date.now(),
  receipt.stock_id,
  receipt.received_quantity,
  previousQty,
  nextQty,
  receipt.receipt_no,
  "Mal kabul: " + receipt.receipt_no,
  receipt.created_by || "Admin"
]);

        if (receipt.purchase_order_id) {
          db.run(`
            UPDATE purchase_orders
            SET status = 'Mal Kabul Yapıldı'
            WHERE id = ?
          `, [receipt.purchase_order_id]);
        }

        db.run("COMMIT", (commitErr) => {
          if (commitErr) {
            db.run("ROLLBACK");
            console.error("Mal kabul commit hatası:", commitErr);
            return res.status(500).json({
              success:false,
              message:commitErr.message
            });
          }

          res.json({
            success:true,
            message:"Mal kabul onaylandı ve stok girişi yapıldı."
          });
        });
      });
    });
  });
});

};
