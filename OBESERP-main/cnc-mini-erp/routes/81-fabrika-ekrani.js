module.exports = function register(app, ctx) {

  const db = ctx.db;

  app.get("/api/factory-screen", (req, res) => {

    const result = {};

    db.get(`
      SELECT COUNT(*) total
      FROM machines
      WHERE status='active'
    `, [], (err, activeMachines) => {

      result.activeMachines =
        activeMachines?.total || 0;

      db.get(`
        SELECT COUNT(*) total
        FROM machines
        WHERE status='downtime'
      `, [], (err, downtimeMachines) => {

        result.downtimeMachines =
          downtimeMachines?.total || 0;

        db.get(`
          SELECT
          COALESCE(SUM(completed_quantity),0) totalProduced,
          COALESCE(SUM(scrap_quantity),0) totalScrap
          FROM production_tracking
          WHERE DATE(created_at)=DATE('now')
        `, [], (err, production) => {

          result.production =
            production || {};

          db.all(`
            SELECT
            machine_name,
            status
            FROM machines
            ORDER BY machine_name
          `, [], (err, machines) => {

            result.machines =
              machines || [];

            db.all(`
              SELECT
              work_order_no,
              delivery_date,
              status
              FROM work_orders
              WHERE status!='completed'
              ORDER BY delivery_date ASC
              LIMIT 10
            `, [], (err, workOrders) => {

              result.workOrders =
                workOrders || [];

              db.all(`
                SELECT
                machine_name,
                reason,
                created_at
                FROM machine_downtimes
                ORDER BY id DESC
                LIMIT 10
              `, [], (err, downtimes) => {

                result.downtimes =
                  downtimes || [];

                res.json({
                  success:true,
                  data:result
                });

              });

            });

          });

        });

      });

    });

  });

};