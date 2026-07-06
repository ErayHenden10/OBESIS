// TAKIM KODU OLUŞTUR
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
// TAKIM KODU OLUŞTUR
// ===============================
function generateToolCode(callback) {
  db.get(`
    SELECT COUNT(*) + 1 AS nextNo
    FROM tools
  `, [], (err, row) => {
    if (err) return callback(err);

    const code = "TLM-" + String(row.nextNo).padStart(5, "0");
    callback(null, code);
  });
}

};
