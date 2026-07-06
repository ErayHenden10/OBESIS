// DOKÜMAN YÖNETİMİ - TABLO
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
// DOKÜMAN YÖNETİMİ - TABLO
// ===============================
db.run(`
CREATE TABLE IF NOT EXISTS documents (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  document_no TEXT UNIQUE,
  document_name TEXT NOT NULL,
  document_type TEXT,
  file_name TEXT,
  original_file_name TEXT,
  file_path TEXT,
  file_ext TEXT,
  file_size INTEGER,
  related_type TEXT,
  related_id INTEGER,
  description TEXT,
  uploaded_by TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
)
`);

};
