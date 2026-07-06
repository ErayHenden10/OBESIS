// TAKIM HAREKETİ EKLE
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
// TAKIM HAREKETİ EKLE
// ===============================
app.post("/api/tools/:id/movements", (req, res) => {
  const toolId = req.params.id;

  const {
    movement_type,
    machine_id,
    machine_name,
    work_order_id,
    work_order_no,
    used_minutes,
    description
  } = req.body;

  if (!movement_type) {
    return res.status(400).json({
      success: false,
      message: "Hareket tipi zorunludur."
    });
  }

  db.get(`
    SELECT *
    FROM tools
    WHERE id = ?
  `, [toolId], (err, tool) => {
    if (err) {
      return res.status(500).json({
        success: false,
        message: err.message
      });
    }

    if (!tool) {
      return res.status(404).json({
        success: false,
        message: "Takım bulunamadı."
      });
    }

    const usedMinutes = Number(used_minutes || 0);
    const beforeUsed = Number(tool.used_life_minutes || 0);
    const beforeRemaining = Number(tool.remaining_life_minutes || 0);

    let afterUsed = beforeUsed;
    let afterRemaining = beforeRemaining;
    let newStatus = tool.status;

    if (movement_type === "Kullanım") {
      afterUsed = beforeUsed + usedMinutes;
      afterRemaining = Math.max(Number(tool.total_life_minutes || 0) - afterUsed, 0);

      if (afterRemaining <= 0) {
        newStatus = "Ömrü Bitti";
      } else if (Number(tool.total_life_minutes || 0) > 0 && afterRemaining <= Number(tool.total_life_minutes || 0) * 0.1) {
        newStatus = "Kritik";
      }
    }

    if (movement_type === "Değişim") {
      afterUsed = 0;
      afterRemaining = Number(tool.total_life_minutes || 0);
      newStatus = "Aktif";
    }

    db.serialize(() => {
      db.run("BEGIN TRANSACTION");

      db.run(`
        INSERT INTO tool_movements (
          tool_id,
          movement_type,
          machine_id,
          machine_name,
          work_order_id,
          work_order_no,
          used_minutes,
          before_used_minutes,
          after_used_minutes,
          before_remaining_minutes,
          after_remaining_minutes,
          description,
          created_by
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        toolId,
        movement_type,
        machine_id || null,
        machine_name || null,
        work_order_id || null,
        work_order_no || null,
        usedMinutes,
        beforeUsed,
        afterUsed,
        beforeRemaining,
        afterRemaining,
        description || null,
        req.headers["x-user-name"] || "Sistem"
      ], function(moveErr) {
        if (moveErr) {
          db.run("ROLLBACK");
          return res.status(500).json({
            success: false,
            message: moveErr.message
          });
        }

        db.run(`
          UPDATE tools
          SET
            used_life_minutes = ?,
            remaining_life_minutes = ?,
            status = ?,
            last_change_date = CASE WHEN ? = 'Değişim' THEN CURRENT_DATE ELSE last_change_date END
          WHERE id = ?
        `, [
          afterUsed,
          afterRemaining,
          newStatus,
          movement_type,
          toolId
        ], function(updateErr) {
          if (updateErr) {
            db.run("ROLLBACK");
            return res.status(500).json({
              success: false,
              message: updateErr.message
            });
          }

          db.run("COMMIT");

          res.json({
            success: true,
            message: "Takım hareketi kaydedildi.",
            remaining_life_minutes: afterRemaining,
            status: newStatus
          });
        });
      });
    });
  });
});

};
