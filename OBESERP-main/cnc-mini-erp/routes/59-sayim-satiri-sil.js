// SAYIM SATIRI SİL
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
// SAYIM SATIRI SİL
// ===============================
app.delete("/api/stock-count-lines/:id", (req, res) => {
  const lineId = req.params.id;

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
        message: "Onaylanmış sayım satırı silinemez."
      });
    }

    db.run(`
      DELETE FROM stock_count_lines
      WHERE id = ?
    `, [lineId], function(deleteErr) {
      if (deleteErr) {
        return res.status(500).json({
          success: false,
          message: deleteErr.message
        });
      }

      res.json({
        success: true,
        message: "Sayım satırı silindi."
      });
    });
  });
});

};
