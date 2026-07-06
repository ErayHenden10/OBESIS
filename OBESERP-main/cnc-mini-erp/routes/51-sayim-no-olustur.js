// SAYIM NO OLUŞTUR
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
// SAYIM NO OLUŞTUR
// ===============================
function generateStockCountNo(callback) {
  db.get(`
    SELECT COUNT(*) + 1 AS nextNo
    FROM stock_counts
  `, [], (err, row) => {
    if (err) return callback(err);

    const no = "SYM-" + String(row.nextNo).padStart(5, "0");
    callback(null, no);
  });
}

};
