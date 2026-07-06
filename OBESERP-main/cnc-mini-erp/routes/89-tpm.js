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
      CREATE TABLE IF NOT EXISTS tpm_tasks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        task_no TEXT UNIQUE,
        machine_name TEXT NOT NULL,
        task_title TEXT NOT NULL,
        task_type TEXT DEFAULT 'daily',
        responsible_type TEXT DEFAULT 'operator',
        checklist TEXT,
        planned_date TEXT NOT NULL,
        completed_date TEXT,
        status TEXT DEFAULT 'planned',
        priority TEXT DEFAULT 'normal',
        note TEXT,
        created_by TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT
      )
    `);

    db.run(`
      CREATE TABLE IF NOT EXISTS tpm_records (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        task_id INTEGER NOT NULL,
        result TEXT DEFAULT 'ok',
        description TEXT,
        completed_by TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `);
  });

  async function createTaskNo() {
    const row = await get(`SELECT COUNT(*) + 1 AS no FROM tpm_tasks`);
    return "TPM-" + String(row.no).padStart(5, "0");
  }

  app.get("/api/tpm/kpi", async (req, res) => {
    try {
      const total = await get(`SELECT COUNT(*) AS c FROM tpm_tasks`);
      const planned = await get(`SELECT COUNT(*) AS c FROM tpm_tasks WHERE status='planned'`);
      const completed = await get(`SELECT COUNT(*) AS c FROM tpm_tasks WHERE status='completed'`);
      const delayed = await get(`
        SELECT COUNT(*) AS c
        FROM tpm_tasks
        WHERE status!='completed'
          AND date(planned_date) < date('now')
      `);
      const issue = await get(`
        SELECT COUNT(*) AS c
        FROM tpm_records
        WHERE result='issue'
      `);

      res.json({
        success: true,
        data: {
          total: total.c || 0,
          planned: planned.c || 0,
          completed: completed.c || 0,
          delayed: delayed.c || 0,
          issue: issue.c || 0
        }
      });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  });

  app.get("/api/tpm", async (req, res) => {
    try {
      const rows = await all(`
        SELECT *
        FROM tpm_tasks
        ORDER BY 
          CASE status
            WHEN 'delayed' THEN 1
            WHEN 'planned' THEN 2
            WHEN 'completed' THEN 3
            ELSE 4
          END,
          date(planned_date) ASC
      `);

      res.json({ success: true, data: rows });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  });

  app.get("/api/tpm/:id", async (req, res) => {
    try {
      const task = await get(`SELECT * FROM tpm_tasks WHERE id=?`, [req.params.id]);

      if (!task) {
        return res.status(404).json({
          success: false,
          message: "TPM görevi bulunamadı."
        });
      }

      const records = await all(`
        SELECT *
        FROM tpm_records
        WHERE task_id=?
        ORDER BY datetime(created_at) DESC
      `, [req.params.id]);

      res.json({ success: true, data: { task, records } });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  });

  app.post("/api/tpm", async (req, res) => {
    try {
      const b = req.body;
      const taskNo = await createTaskNo();

      await run(`
        INSERT INTO tpm_tasks (
          task_no, machine_name, task_title, task_type,
          responsible_type, checklist, planned_date,
          status, priority, note, created_by
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        taskNo,
        b.machine_name,
        b.task_title,
        b.task_type || "daily",
        b.responsible_type || "operator",
        b.checklist || "",
        b.planned_date,
        b.status || "planned",
        b.priority || "normal",
        b.note || "",
        b.created_by || ""
      ]);

      res.json({ success: true, message: "TPM görevi oluşturuldu." });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  });

  app.put("/api/tpm/:id", async (req, res) => {
    try {
      const b = req.body;

      await run(`
        UPDATE tpm_tasks
        SET
          machine_name=?,
          task_title=?,
          task_type=?,
          responsible_type=?,
          checklist=?,
          planned_date=?,
          status=?,
          priority=?,
          note=?,
          updated_at=CURRENT_TIMESTAMP
        WHERE id=?
      `, [
        b.machine_name,
        b.task_title,
        b.task_type || "daily",
        b.responsible_type || "operator",
        b.checklist || "",
        b.planned_date,
        b.status || "planned",
        b.priority || "normal",
        b.note || "",
        req.params.id
      ]);

      res.json({ success: true, message: "TPM görevi güncellendi." });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  });

  app.post("/api/tpm/:id/complete", async (req, res) => {
    try {
      const b = req.body;

      await run(`
        UPDATE tpm_tasks
        SET status='completed',
            completed_date=CURRENT_TIMESTAMP,
            updated_at=CURRENT_TIMESTAMP
        WHERE id=?
      `, [req.params.id]);

      await run(`
        INSERT INTO tpm_records (
          task_id, result, description, completed_by
        )
        VALUES (?, ?, ?, ?)
      `, [
        req.params.id,
        b.result || "ok",
        b.description || "",
        b.completed_by || ""
      ]);

      res.json({ success: true, message: "TPM görevi tamamlandı." });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  });

  app.delete("/api/tpm/:id", async (req, res) => {
    try {
      await run(`DELETE FROM tpm_records WHERE task_id=?`, [req.params.id]);
      await run(`DELETE FROM tpm_tasks WHERE id=?`, [req.params.id]);

      res.json({ success: true, message: "TPM görevi silindi." });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  });
};