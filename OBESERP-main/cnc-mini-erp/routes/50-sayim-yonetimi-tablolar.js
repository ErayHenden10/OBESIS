// SAYIM YÖNETİMİ - TABLOLAR
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
// SAYIM YÖNETİMİ - TABLOLAR
// ===============================
db.run(`
CREATE TABLE IF NOT EXISTS stock_counts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  count_no TEXT UNIQUE,
  count_date DATE DEFAULT CURRENT_DATE,
  warehouse_id INTEGER,
  description TEXT,
  status TEXT DEFAULT 'Taslak',
  created_by TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  approved_by TEXT,
  approved_at DATETIME
)
`);

db.run(`
CREATE TABLE IF NOT EXISTS stock_count_lines (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  stock_count_id INTEGER NOT NULL,
  stock_id INTEGER NOT NULL,
  stock_code TEXT,
  part_name TEXT,
  unit TEXT,
  erp_quantity REAL DEFAULT 0,
  counted_quantity REAL DEFAULT 0,
  difference_quantity REAL DEFAULT 0,
  description TEXT,
  FOREIGN KEY(stock_count_id) REFERENCES stock_counts(id)
)
`);

};
