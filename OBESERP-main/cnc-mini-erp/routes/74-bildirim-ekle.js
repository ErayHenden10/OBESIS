// BİLDİRİM EKLE
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
// BİLDİRİM EKLE
// ===============================
app.post("/api/notifications", (req, res) => {
  const {
    title,
    message,
    type,
    related_type,
    related_id
  } = req.body;

  if (!title || !message) {
    return res.status(400).json({
      success: false,
      message: "Başlık ve mesaj zorunludur."
    });
  }

  db.run(`
    INSERT INTO notifications (
      title,
      message,
      type,
      related_type,
      related_id,
      is_read,
      created_by
    )
    VALUES (?, ?, ?, ?, ?, 0, ?)
  `, [
    title,
    message,
    type || "info",
    related_type || null,
    related_id || null,
    req.headers["x-user-name"] || "Sistem"
  ], function(err) {
    if (err) {
      console.error("Bildirim ekleme hatası:", err);
      return res.status(500).json({
        success: false,
        message: err.message
      });
    }

    res.json({
      success: true,
      message: "Bildirim oluşturuldu.",
      id: this.lastID
    });
  });
});

};
