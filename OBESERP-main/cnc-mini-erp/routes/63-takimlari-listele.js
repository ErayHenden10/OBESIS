// TAKIMLARI LİSTELE
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
// TAKIMLARI LİSTELE
// ===============================
app.get("/api/tools", (req, res) => {
  const {
    search,
    status,
    tool_type
  } = req.query;

  let sql = `
    SELECT *
    FROM tools
    WHERE 1 = 1
  `;

  const params = [];

  if (search) {
    sql += `
      AND (
        tool_code LIKE ?
        OR tool_name LIKE ?
        OR brand LIKE ?
        OR model LIKE ?
        OR location LIKE ?
      )
    `;
    params.push(
      `%${search}%`,
      `%${search}%`,
      `%${search}%`,
      `%${search}%`,
      `%${search}%`
    );
  }

  if (status && status !== "all") {
    sql += ` AND status = ? `;
    params.push(status);
  }

  if (tool_type && tool_type !== "all") {
    sql += ` AND tool_type = ? `;
    params.push(tool_type);
  }

  sql += ` ORDER BY datetime(created_at) DESC `;

  db.all(sql, params, (err, rows) => {
    if (err) {
      console.error("Takım listeleme hatası:", err);
      return res.status(500).json({
        success: false,
        message: err.message
      });
    }

    res.json({
      success: true,
      tools: rows || []
    });
  });
});

};
