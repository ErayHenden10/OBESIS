// TAKIM GÜNCELLE
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
// TAKIM GÜNCELLE
// ===============================
app.put("/api/tools/:id", (req, res) => {
  const id = req.params.id;

  const {
    tool_name,
    tool_type,
    brand,
    model,
    diameter,
    total_life_minutes,
    used_life_minutes,
    location,
    status,
    last_change_date,
    description
  } = req.body;

  const totalLife = Number(total_life_minutes || 0);
  const usedLife = Number(used_life_minutes || 0);
  const remainingLife = Math.max(totalLife - usedLife, 0);

  db.run(`
    UPDATE tools
    SET
      tool_name = ?,
      tool_type = ?,
      brand = ?,
      model = ?,
      diameter = ?,
      total_life_minutes = ?,
      used_life_minutes = ?,
      remaining_life_minutes = ?,
      location = ?,
      status = ?,
      last_change_date = ?,
      description = ?
    WHERE id = ?
  `, [
    tool_name,
    tool_type || null,
    brand || null,
    model || null,
    diameter || null,
    totalLife,
    usedLife,
    remainingLife,
    location || null,
    status || "Aktif",
    last_change_date || null,
    description || null,
    id
  ], function(err) {
    if (err) {
      console.error("Takım güncelleme hatası:", err);
      return res.status(500).json({
        success: false,
        message: err.message
      });
    }

    res.json({
      success: true,
      message: "Takım güncellendi."
    });
  });
});

};
