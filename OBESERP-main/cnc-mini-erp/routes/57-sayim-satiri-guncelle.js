// SAYIM SATIRI GÜNCELLE
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
// SAYIM SATIRI GÜNCELLE
// ===============================
app.put("/api/stock-count-lines/:id", (req, res) => {
  const lineId = req.params.id;
  const {
    counted_quantity,
    description
  } = req.body;

  db.get(`
    SELECT 
      scl.*,
      sc.status
    FROM stock_count_lines scl
    JOIN stock_counts sc ON sc.id = scl.stock_count_id
    WHERE scl.id = ?
  `, [lineId], (err, line) => {
    if (err) {
      return res.status(500).json({
        success: false,
        message: err.message
      });
    }

    if (!line) {
      return res.status(404).json({
        success: false,
        message: "Sayım satırı bulunamadı."
      });
    }

    if (line.status === "Onaylandı") {
      return res.status(400).json({
        success: false,
        message: "Onaylanmış sayım satırı güncellenemez."
      });
    }

    const countedQty = Number(counted_quantity || 0);
    const erpQty = Number(line.erp_quantity || 0);
    const diffQty = countedQty - erpQty;

    db.run(`
      UPDATE stock_count_lines
      SET
        counted_quantity = ?,
        difference_quantity = ?,
        description = ?
      WHERE id = ?
    `, [
      countedQty,
      diffQty,
      description || null,
      lineId
    ], function(updateErr) {
      if (updateErr) {
        return res.status(500).json({
          success: false,
          message: updateErr.message
        });
      }

      res.json({
        success: true,
        message: "Sayım satırı güncellendi.",
        difference_quantity: diffQty
      });
    });
  });
});

};
