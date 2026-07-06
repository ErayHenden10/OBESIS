// FIRE / HURDA ONAYLA
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
// FIRE / HURDA ONAYLA
// ===============================
app.put("/api/scrap-records/:id/approve", (req, res) => {
  const recordId = req.params.id;

  db.get(`
    SELECT *
    FROM scrap_records
    WHERE id = ?
  `, [recordId], (err, record) => {
    if (err) {
      console.error("Fire/hurda sorgu hatası:", err);
      return res.status(500).json({ success:false, message:err.message });
    }

    if (!record) {
      return res.status(404).json({
        success:false,
        message:"Fire/hurda kaydı bulunamadı."
      });
    }

    if (record.status === "Onaylandı") {
      return res.status(400).json({
        success:false,
        message:"Bu kayıt zaten onaylanmış."
      });
    }

    if (!record.warehouse_id) {
      return res.status(400).json({
        success:false,
        message:"Stok düşümü için depo seçimi zorunludur."
      });
    }

    db.get(`
      SELECT quantity
      FROM warehouse_stocks
      WHERE warehouse_id = ? AND stock_id = ?
    `, [record.warehouse_id, record.stock_id], (err, currentStock) => {
      if (err) {
        console.error("Depo stok sorgu hatası:", err);
        return res.status(500).json({ success:false, message:err.message });
      }

      const previousQty = currentStock ? Number(currentStock.quantity) : 0;
      const scrapQty = Number(record.quantity || 0);
      const nextQty = previousQty - scrapQty;

      if (previousQty < scrapQty) {
        return res.status(400).json({
          success:false,
          message:"Depoda yeterli stok yok."
        });
      }

      db.serialize(() => {
        db.run("BEGIN TRANSACTION");

        db.run(`
          UPDATE warehouse_stocks
          SET quantity = quantity - ?
          WHERE warehouse_id = ? AND stock_id = ?
        `, [
          scrapQty,
          record.warehouse_id,
          record.stock_id
        ]);

        db.run(`
          UPDATE scrap_records
          SET status = 'Onaylandı'
          WHERE id = ?
        `, [recordId]);

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
          VALUES (?, DATETIME('now'), ?, 'out', ?, ?, ?, ?, ?, ?)
        `, [
          "HRK" + Date.now(),
          record.stock_id,
          scrapQty,
          previousQty,
          nextQty,
          record.scrap_no,
          "Fire/Hurda çıkışı: " + record.scrap_no,
          record.created_by || "Admin"
        ]);

        db.run("COMMIT", (commitErr) => {
          if (commitErr) {
            db.run("ROLLBACK");
            console.error("Fire/hurda commit hatası:", commitErr);
            return res.status(500).json({
              success:false,
              message:commitErr.message
            });
          }

          res.json({
            success:true,
            message:"Fire/hurda onaylandı ve stok düşümü yapıldı."
          });
        });
      });
    });
  });
});

};
