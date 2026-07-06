module.exports = (app, ctx) => {
  const db = ctx.db;

  function run(sql, params = []) {
    return new Promise((resolve, reject) => {
      db.run(sql, params, function (err) {
        if (err) reject(err);
        else resolve(this);
      });
    });
  }

  function all(sql, params = []) {
    return new Promise((resolve, reject) => {
      db.all(sql, params, (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  }

  function get(sql, params = []) {
    return new Promise((resolve, reject) => {
      db.get(sql, params, (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
  }

  db.serialize(() => {
    db.run(`
      CREATE TABLE IF NOT EXISTS aps_plans (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        plan_no TEXT UNIQUE,
        work_order_no TEXT,
        operation_name TEXT NOT NULL,
        part_no TEXT,
        part_name TEXT,
        customer_name TEXT,
        machine_name TEXT NOT NULL,
        operator_name TEXT,
        planned_start TEXT NOT NULL,
        planned_end TEXT NOT NULL,
        duration_min INTEGER DEFAULT 0,
        quantity REAL DEFAULT 0,
        priority TEXT DEFAULT 'normal',
        status TEXT DEFAULT 'planned',
        progress INTEGER DEFAULT 0,
        notes TEXT,
        created_by TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT
      )
    `);

    db.run(`
      CREATE TABLE IF NOT EXISTS aps_machines (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        machine_name TEXT UNIQUE NOT NULL,
        capacity_hour REAL DEFAULT 8,
        status TEXT DEFAULT 'active',
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `);

    db.run(`
      CREATE TABLE IF NOT EXISTS aps_simulations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        simulation_no TEXT,
        machine_name TEXT,
        from_date TEXT,
        to_date TEXT,
        total_jobs INTEGER DEFAULT 0,
        total_minutes INTEGER DEFAULT 0,
        capacity_minutes INTEGER DEFAULT 0,
        load_percent REAL DEFAULT 0,
        bottleneck TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `);
  });

  async function createPlanNo() {
    const row = await get(`SELECT COUNT(*) + 1 AS no FROM aps_plans`);
    return "APS-" + String(row.no).padStart(5, "0");
  }

  app.get("/api/aps/kpi", async (req, res) => {
    try {
      const total = await get(`SELECT COUNT(*) AS c FROM aps_plans`);
      const planned = await get(`SELECT COUNT(*) AS c FROM aps_plans WHERE status='planned'`);
      const active = await get(`SELECT COUNT(*) AS c FROM aps_plans WHERE status='active'`);
      const completed = await get(`SELECT COUNT(*) AS c FROM aps_plans WHERE status='completed'`);
      const delayed = await get(`
        SELECT COUNT(*) AS c 
        FROM aps_plans 
        WHERE status != 'completed' 
          AND datetime(planned_end) < datetime('now')
      `);

      res.json({
        success: true,
        data: {
          total: total.c || 0,
          planned: planned.c || 0,
          active: active.c || 0,
          completed: completed.c || 0,
          delayed: delayed.c || 0
        }
      });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  });

  app.get("/api/aps", async (req, res) => {
    try {
      const rows = await all(`
        SELECT *
        FROM aps_plans
        ORDER BY datetime(planned_start) ASC
      `);

      res.json({ success: true, data: rows });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  });

  app.get("/api/aps/:id", async (req, res) => {
    try {
      const row = await get(`SELECT * FROM aps_plans WHERE id=?`, [req.params.id]);

      if (!row) {
        return res.status(404).json({ success: false, message: "APS planı bulunamadı." });
      }

      res.json({ success: true, data: row });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  });

  app.post("/api/aps", async (req, res) => {
    try {
      const b = req.body;
      const planNo = await createPlanNo();

      await run(`
        INSERT INTO aps_plans (
          plan_no, work_order_no, operation_name, part_no, part_name,
          customer_name, machine_name, operator_name, planned_start,
          planned_end, duration_min, quantity, priority, status,
          progress, notes, created_by
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        planNo,
        b.work_order_no || "",
        b.operation_name,
        b.part_no || "",
        b.part_name || "",
        b.customer_name || "",
        b.machine_name,
        b.operator_name || "",
        b.planned_start,
        b.planned_end,
        Number(b.duration_min || 0),
        Number(b.quantity || 0),
        b.priority || "normal",
        b.status || "planned",
        Number(b.progress || 0),
        b.notes || "",
        b.created_by || ""
      ]);

      await run(`
        INSERT OR IGNORE INTO aps_machines (machine_name)
        VALUES (?)
      `, [b.machine_name]);

      res.json({ success: true, message: "APS planı oluşturuldu." });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  });

  app.put("/api/aps/:id", async (req, res) => {
    try {
      const b = req.body;

      await run(`
        UPDATE aps_plans
        SET 
          work_order_no=?,
          operation_name=?,
          part_no=?,
          part_name=?,
          customer_name=?,
          machine_name=?,
          operator_name=?,
          planned_start=?,
          planned_end=?,
          duration_min=?,
          quantity=?,
          priority=?,
          status=?,
          progress=?,
          notes=?,
          updated_at=CURRENT_TIMESTAMP
        WHERE id=?
      `, [
        b.work_order_no || "",
        b.operation_name,
        b.part_no || "",
        b.part_name || "",
        b.customer_name || "",
        b.machine_name,
        b.operator_name || "",
        b.planned_start,
        b.planned_end,
        Number(b.duration_min || 0),
        Number(b.quantity || 0),
        b.priority || "normal",
        b.status || "planned",
        Number(b.progress || 0),
        b.notes || "",
        req.params.id
      ]);

      await run(`
        INSERT OR IGNORE INTO aps_machines (machine_name)
        VALUES (?)
      `, [b.machine_name]);

      res.json({ success: true, message: "APS planı güncellendi." });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  });

  app.delete("/api/aps/:id", async (req, res) => {
    try {
      await run(`DELETE FROM aps_plans WHERE id=?`, [req.params.id]);
      res.json({ success: true, message: "APS planı silindi." });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  });

  app.put("/api/aps/:id/status", async (req, res) => {
    try {
      await run(`
        UPDATE aps_plans
        SET status=?, progress=?, updated_at=CURRENT_TIMESTAMP
        WHERE id=?
      `, [
        req.body.status,
        Number(req.body.progress || 0),
        req.params.id
      ]);

      res.json({ success: true, message: "Durum güncellendi." });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  });

  app.put("/api/aps/:id/reschedule", async (req, res) => {
    try {
      const b = req.body;

      await run(`
        UPDATE aps_plans
        SET machine_name=?, planned_start=?, planned_end=?, updated_at=CURRENT_TIMESTAMP
        WHERE id=?
      `, [
        b.machine_name,
        b.planned_start,
        b.planned_end,
        req.params.id
      ]);

      await run(`
        INSERT OR IGNORE INTO aps_machines (machine_name)
        VALUES (?)
      `, [b.machine_name]);

      res.json({ success: true, message: "Plan yeniden çizelgelendi." });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  });

  app.get("/api/aps/machines/list", async (req, res) => {
    try {
      const rows = await all(`
        SELECT DISTINCT machine_name
        FROM aps_machines
        WHERE status='active'
        UNION
        SELECT DISTINCT machine_name
        FROM aps_plans
        WHERE machine_name IS NOT NULL AND machine_name <> ''
        ORDER BY machine_name
      `);

      res.json({ success: true, data: rows });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  });

  app.post("/api/aps/simulate", async (req, res) => {
    try {
      const { from_date, to_date, machine_name } = req.body;

      let where = `WHERE date(planned_start) >= date(?) AND date(planned_start) <= date(?)`;
      const params = [from_date, to_date];

      if (machine_name) {
        where += ` AND machine_name = ?`;
        params.push(machine_name);
      }

      const rows = await all(`
        SELECT 
          machine_name,
          COUNT(*) AS total_jobs,
          SUM(duration_min) AS total_minutes
        FROM aps_plans
        ${where}
        GROUP BY machine_name
        ORDER BY total_minutes DESC
      `, params);

      const result = rows.map(r => {
        const capacityMinutes = 8 * 60;
        const loadPercent = capacityMinutes > 0
          ? Math.round((Number(r.total_minutes || 0) / capacityMinutes) * 100)
          : 0;

        return {
          machine_name: r.machine_name,
          total_jobs: r.total_jobs || 0,
          total_minutes: r.total_minutes || 0,
          capacity_minutes: capacityMinutes,
          load_percent: loadPercent,
          bottleneck: loadPercent >= 100 ? "Kritik Yük" : loadPercent >= 80 ? "Yoğun" : "Normal"
        };
      });

      res.json({ success: true, data: result });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  });
};