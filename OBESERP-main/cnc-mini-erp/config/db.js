const sqlite3 = require("sqlite3").verbose();

const dbPath = process.env.DB_PATH || "C:\\sqlitedbs\\erpcnc.db";

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) console.error("SQLite bağlantı hatası:", err.message);
  else console.log("SQLite bağlantısı başarılı:", dbPath);
});

function dbGet(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => err ? reject(err) : resolve(row));
  });
}

function dbAll(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => err ? reject(err) : resolve(rows));
  });
}

function dbRun(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function(err) { err ? reject(err) : resolve(this); });
  });
}

module.exports = { db, dbGet, dbAll, dbRun, dbPath };
