// SAYIM FİŞLERİ LİSTELE
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
// SAYIM FİŞLERİ LİSTELE
// ===============================
app.get("/api/stock-counts", (req, res) => {
  db.all(`
    SELECT 
      sc.*,
      COUNT(scl.id) AS line_count,
      SUM(ABS(IFNULL(scl.difference_quantity, 0))) AS total_difference
    FROM stock_counts sc
    LEFT JOIN stock_count_lines scl ON scl.stock_count_id = sc.id
    GROUP BY sc.id
    ORDER BY datetime(sc.created_at) DESC
  `, [], (err, rows) => {
    if (err) {
      console.error("Sayım listeleme hatası:", err);
      return res.status(500).json({
        success: false,
        message: err.message
      });
    }

    res.json({
      success: true,
      stockCounts: rows || []
    });
  });
});

};
