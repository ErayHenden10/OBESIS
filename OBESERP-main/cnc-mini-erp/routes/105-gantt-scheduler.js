module.exports = function (app, ctx) {
  const db = ctx.db;

  console.log("105-gantt-scheduler.js yüklendi");

  function all(sql, params = []) {
    return new Promise((resolve, reject) => {
      db.all(sql, params, (err, rows) => {
        if (err) reject(err);
        else resolve(rows || []);
      });
    });
  }

  app.get("/api/gantt-scheduler/data", async (req, res) => {
    try {
      const machines = await all(`
        SELECT 
          id,
          machine_code,
          machine_name,
          capability,
          daily_capacity_hours,
          status,
          current_load_hours
        FROM aps_machines
        ORDER BY id ASC
      `);

      const plans = await all(`
        SELECT 
          p.id,
          p.work_order_id,
          p.machine_id,
          p.operator_id,
          p.tool_id,
          p.estimated_hours,
          p.score,
          p.decision,
          p.reason,
          p.planned_start,
          p.planned_finish,
          p.created_at,
          m.machine_code,
          m.machine_name,
          o.full_name AS operator_name,
          t.tool_name
        FROM aps_plans p
        LEFT JOIN aps_machines m ON m.id = p.machine_id
        LEFT JOIN aps_operators o ON o.id = p.operator_id
        LEFT JOIN aps_tools t ON t.id = p.tool_id
        ORDER BY p.planned_start ASC, p.id ASC
      `);

      const totalPlans = plans.length;
      const approved = plans.filter(x => x.decision === "approve").length;
      const warning = plans.filter(x => x.decision === "warning").length;
      const rejected = plans.filter(x => x.decision === "reject").length;

      const totalHours = plans.reduce((sum, x) => {
        return sum + Number(x.estimated_hours || 0);
      }, 0);

      res.json({
        success: true,
        summary: {
          totalPlans,
          approved,
          warning,
          rejected,
          totalHours
        },
        machines,
        plans
      });

    } catch (err) {
      res.status(500).json({
        success: false,
        message: err.message
      });
    }
  });
};