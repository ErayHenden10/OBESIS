// DOKÜMAN LİSTELE
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
// DOKÜMAN LİSTELE
// ===============================
app.get("/api/documents", (req, res) => {
  const {
    search,
    document_type,
    related_type
  } = req.query;

  let sql = `
    SELECT *
    FROM documents
    WHERE 1 = 1
  `;

  const params = [];

  if (search) {
    sql += `
      AND (
        document_no LIKE ?
        OR document_name LIKE ?
        OR original_file_name LIKE ?
        OR description LIKE ?
      )
    `;
    params.push(
      `%${search}%`,
      `%${search}%`,
      `%${search}%`,
      `%${search}%`
    );
  }

  if (document_type && document_type !== "all") {
    sql += ` AND document_type = ? `;
    params.push(document_type);
  }

  if (related_type && related_type !== "all") {
    sql += ` AND related_type = ? `;
    params.push(related_type);
  }

  sql += `ORDER BY datetime(uploaded_at) DESC `;

  db.all(sql, params, (err, rows) => {
    if (err) {
      console.error("Doküman listeleme hatası:", err);
      return res.status(500).json({
        success: false,
        message: err.message
      });
    }

    res.json({
      success: true,
      documents: rows || []
    });
  });
});

};
