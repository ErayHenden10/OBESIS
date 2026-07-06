// DOKÜMAN GÜNCELLE
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
// DOKÜMAN GÜNCELLE
// ===============================
app.put("/api/documents/:id", (req, res) => {
  const {
    document_name,
    document_type,
    related_type,
    related_id,
    description
  } = req.body;

  db.run(`
    UPDATE documents
    SET
      document_name = ?,
      document_type = ?,
      related_type = ?,
      related_id = ?,
      description = ?
    WHERE id = ?
  `, [
    document_name,
    document_type,
    related_type || null,
    related_id || null,
    description || null,
    req.params.id
  ], function(err) {
    if (err) {
      console.error("Doküman güncelleme hatası:", err);
      return res.status(500).json({
        success: false,
        message: err.message
      });
    }

    res.json({
      success: true,
      message: "Doküman güncellendi."
    });
  });
});

};
