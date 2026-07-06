// DOKÜMAN NO OLUŞTUR
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
// DOKÜMAN NO OLUŞTUR
// ===============================
function generateDocumentNo(callback) {
  db.get(`
    SELECT COUNT(*) + 1 AS nextNo
    FROM documents
  `, [], (err, row) => {
    if (err) return callback(err);

    const no = "DOC-" + String(row.nextNo).padStart(5, "0");
    callback(null, no);
  });
}

};
