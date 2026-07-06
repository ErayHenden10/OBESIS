module.exports = function register(app, ctx) {
  const db = ctx.db;

  app.get("/api/smart-production/summary", (req, res) => {
    const result = {};

    db.get(`
      SELECT 
        COUNT(*) AS totalWorkOrders,
        SUM(CASE WHEN status IN ('progress','production','active','waiting') THEN 1 ELSE 0 END) AS activeWorkOrders,
        SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) AS completedWorkOrders
      FROM work_orders
    `, [], (err, workOrders) => {
      if (err) {
        return res.status(500).json({ success:false, message:err.message });
      }

      result.workOrders = workOrders || {
        totalWorkOrders: 0,
        activeWorkOrders: 0,
        completedWorkOrders: 0
      };

      db.get(`
        SELECT 
          COALESCE(SUM(completed_quantity), 0) AS totalProduced,
          COALESCE(SUM(scrap_quantity), 0) AS totalScrap
        FROM production_tracking
      `, [], (err, production) => {
        if (err) {
          production = { totalProduced: 0, totalScrap: 0 };
        }

        result.production = production || {
          totalProduced: 0,
          totalScrap: 0
        };

        db.all(`
          SELECT 
            COALESCE(m.machine_name, md.machine_name, '-') AS machine_name,
            COUNT(md.id) AS downtimeCount,
            COALESCE(SUM(md.duration_minute), 0) AS downtimeMinute
          FROM machine_downtimes md
          LEFT JOIN machines m ON m.id = md.machine_id
          GROUP BY md.machine_id, md.machine_name
          ORDER BY downtimeMinute DESC
          LIMIT 5
        `, [], (err, downtimes) => {
          if (err) {
            downtimes = [];
          }

          result.downtimes = downtimes || [];

          const produced = Number(result.production.totalProduced || 0);
          const scrap = Number(result.production.totalScrap || 0);
          const total = produced + scrap;

          const scrapRate = total > 0 ? (scrap / total) * 100 : 0;
          const completionRate = Number(result.workOrders.totalWorkOrders || 0) > 0
            ? (Number(result.workOrders.completedWorkOrders || 0) / Number(result.workOrders.totalWorkOrders || 0)) * 100
            : 0;

          result.kpi = {
            scrapRate: scrapRate.toFixed(2),
            completionRate: completionRate.toFixed(2),
            estimatedOee: Math.max(0, 100 - scrapRate).toFixed(2)
          };

          res.json({
            success: true,
            data: result
          });
        });
      });
    });
  });

  app.get("/api/smart-production/capacity", (req, res) => {
    db.all(`
      SELECT
        m.id,
        m.machine_name AS machineName,
        m.machine_code AS machineCode,
        m.machine_type AS machineType,
        COUNT(woo.id) AS workOrderCount,
        COALESCE(SUM(woo.planned_time), 0) AS plannedMinutes,
        ROUND((COALESCE(SUM(woo.planned_time), 0) / 2400.0) * 100, 2) AS weeklyLoadPercent
      FROM machines m
      LEFT JOIN work_order_operations woo 
        ON woo.machine_type = m.machine_type
        AND woo.status IN ('waiting','progress','active')
      GROUP BY m.id
      ORDER BY weeklyLoadPercent DESC
    `, [], (err, rows) => {
      if (err) {
        return res.json({
          success: true,
          capacity: []
        });
      }

      res.json({
        success: true,
        capacity: rows || []
      });
    });
  });

  app.get("/api/smart-production/delivery-risk", (req, res) => {
    db.all(`
      SELECT
        wo.id,
        wo.work_order_no AS workOrderNo,
        wo.title,
        wo.part_name AS partName,
        wo.delivery_date AS deliveryDate,
        wo.status,
        c.company_name AS customerName,
        CASE
          WHEN DATE(wo.delivery_date) < DATE('now') AND wo.status != 'completed' THEN 'high'
          WHEN DATE(wo.delivery_date) <= DATE('now', '+3 day') AND wo.status != 'completed' THEN 'medium'
          ELSE 'low'
        END AS riskLevel
      FROM work_orders wo
      LEFT JOIN customers c ON c.id = wo.customer_id
      WHERE wo.status != 'completed'
      ORDER BY wo.delivery_date ASC
      LIMIT 20
    `, [], (err, rows) => {
      if (err) {
        return res.status(500).json({
          success:false,
          message:err.message,
          risks:[]
        });
      }

      res.json({
        success: true,
        risks: rows || []
      });
    });
  });
};