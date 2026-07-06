// SAYIM FİŞİ DETAY
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
// SAYIM FİŞİ DETAY
// ===============================
app.get("/api/stock-counts/:id", (req, res) => {
  const id = req.params.id;

  db.get(`
    SELECT *
    FROM stock_counts
    WHERE id = ?
  `, [id], (err, count) => {
    if (err) {
      return res.status(500).json({
        success: false,
        message: err.message
      });
    }

    if (!count) {
      return res.status(404).json({
        success: false,
        message: "Sayım fişi bulunamadı."
      });
    }

    db.all(`
      SELECT *
      FROM stock_count_lines
      WHERE stock_count_id = ?
      ORDER BY id ASC
    `, [id], (lineErr, lines) => {
      if (lineErr) {
        return res.status(500).json({
          success: false,
          message: lineErr.message
        });
      }

      res.json({
        success: true,
        stockCount: count,
        lines: lines || []
      });
    });
  });
});

};
