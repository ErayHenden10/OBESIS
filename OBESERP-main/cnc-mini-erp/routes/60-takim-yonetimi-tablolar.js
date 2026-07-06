// TAKIM YÖNETİMİ - TABLOLAR
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
// TAKIM YÖNETİMİ - TABLOLAR
// ===============================
db.run(`
CREATE TABLE IF NOT EXISTS tools (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tool_code TEXT UNIQUE,
  tool_name TEXT NOT NULL,
  tool_type TEXT,
  brand TEXT,
  model TEXT,
  diameter REAL,
  total_life_minutes INTEGER DEFAULT 0,
  used_life_minutes INTEGER DEFAULT 0,
  remaining_life_minutes INTEGER DEFAULT 0,
  location TEXT,
  status TEXT DEFAULT 'Aktif',
  last_change_date DATE,
  description TEXT,
  created_by TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
)
`);

db.run(`
CREATE TABLE IF NOT EXISTS tool_movements (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tool_id INTEGER NOT NULL,
  movement_type TEXT NOT NULL,
  movement_date DATETIME DEFAULT CURRENT_TIMESTAMP,
  machine_id INTEGER,
  machine_name TEXT,
  work_order_id INTEGER,
  work_order_no TEXT,
  used_minutes INTEGER DEFAULT 0,
  before_used_minutes INTEGER DEFAULT 0,
  after_used_minutes INTEGER DEFAULT 0,
  before_remaining_minutes INTEGER DEFAULT 0,
  after_remaining_minutes INTEGER DEFAULT 0,
  description TEXT,
  created_by TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(tool_id) REFERENCES tools(id)
)
`);

};
