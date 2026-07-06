// SAYIMA STOK SATIRI EKLE
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
// SAYIMA STOK SATIRI EKLE
// ===============================
app.post("/api/stock-counts/:id/lines/add-stock", (req, res) => {
  const stockCountId = req.params.id;
  const { stock_id } = req.body;

  if (!stock_id) {
    return res.status(400).json({
      success: false,
      message: "Stok seçilmelidir."
    });
  }

  db.get(`
    SELECT *
    FROM stock_counts
    WHERE id = ?
  `, [stockCountId], (countErr, count) => {
    if (countErr) {
      return res.status(500).json({
        success: false,
        message: countErr.message
      });
    }

    if (!count) {
      return res.status(404).json({
        success: false,
        message: "Sayım fişi bulunamadı."
      });
    }

    if (count.status === "Onaylandı") {
      return res.status(400).json({
        success: false,
        message: "Onaylanmış sayım fişine satır eklenemez."
      });
    }

    db.get(`
      SELECT *
      FROM stocks
      WHERE id = ?
    `, [stock_id], (stockErr, stock) => {
      if (stockErr) {
        return res.status(500).json({
          success: false,
          message: stockErr.message
        });
      }

      if (!stock) {
        return res.status(404).json({
          success: false,
          message: "Stok bulunamadı."
        });
      }

      db.get(`
        SELECT id
        FROM stock_count_lines
        WHERE stock_count_id = ?
          AND stock_id = ?
      `, [stockCountId, stock_id], (existsErr, exists) => {
        if (existsErr) {
          return res.status(500).json({
            success: false,
            message: existsErr.message
          });
        }

        if (exists) {
          return res.status(400).json({
            success: false,
            message: "Bu stok zaten sayım fişinde mevcut."
          });
        }

        db.run(`
          INSERT INTO stock_count_lines (
            stock_count_id,
            stock_id,
            stock_code,
            part_name,
            unit,
            erp_quantity,
            counted_quantity,
            difference_quantity
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, 0)
        `, [
          stockCountId,
          stock.id,
          stock.stock_code || stock.code || "",
          stock.part_name || stock.name || "",
          stock.unit || "Adet",
          Number(stock.quantity || 0),
          Number(stock.quantity || 0)
        ], function(insertErr) {
          if (insertErr) {
            return res.status(500).json({
              success: false,
              message: insertErr.message
            });
          }

          res.json({
            success: true,
            message: "Stok satırı sayıma eklendi.",
            id: this.lastID
          });
        });
      });
    });
  });
});

};
