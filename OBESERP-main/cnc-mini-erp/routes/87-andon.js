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
      CREATE TABLE IF NOT EXISTS andon_calls (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        call_no TEXT UNIQUE,
        call_type TEXT NOT NULL,
        priority TEXT DEFAULT 'normal',
        machine_name TEXT,
        work_order_no TEXT,
        operator_name TEXT,
        title TEXT NOT NULL,
        description TEXT,
        status TEXT DEFAULT 'open',
        opened_at TEXT DEFAULT CURRENT_TIMESTAMP,
        acknowledged_at TEXT,
        resolved_at TEXT,
        resolved_by TEXT,
        created_by TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT
      )
    `);

    db.run(`
      CREATE TABLE IF NOT EXISTS andon_call_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        call_id INTEGER NOT NULL,
        old_status TEXT,
        new_status TEXT,
        note TEXT,
        changed_by TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `);
  });

  async function createCallNo() {
    const row = await get(`SELECT COUNT(*) + 1 AS no FROM andon_calls`);
    return "AND-" + String(row.no).padStart(5, "0");
  }

  app.get("/api/andon/kpi", async (req, res) => {
    try {
      const total = await get(`SELECT COUNT(*) AS c FROM andon_calls`);
      const open = await get(`SELECT COUNT(*) AS c FROM andon_calls WHERE status='open'`);
      const progress = await get(`SELECT COUNT(*) AS c FROM andon_calls WHERE status='progress'`);
      const resolved = await get(`SELECT COUNT(*) AS c FROM andon_calls WHERE status='resolved'`);
      const critical = await get(`
        SELECT COUNT(*) AS c 
        FROM andon_calls 
        WHERE priority='critical' AND status != 'resolved'
      `);

      res.json({
        success: true,
        data: {
          total: total.c || 0,
          open: open.c || 0,
          progress: progress.c || 0,
          resolved: resolved.c || 0,
          critical: critical.c || 0
        }
      });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  });

  app.get("/api/andon", async (req, res) => {
    try {
      const rows = await all(`
        SELECT *
        FROM andon_calls
        ORDER BY 
          CASE priority
            WHEN 'critical' THEN 1
            WHEN 'high' THEN 2
            WHEN 'normal' THEN 3
            WHEN 'low' THEN 4
            ELSE 5
          END,
          datetime(opened_at) DESC
      `);

      res.json({ success: true, data: rows });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  });

  app.get("/api/andon/open", async (req, res) => {
    try {
      const rows = await all(`
        SELECT *
        FROM andon_calls
        WHERE status != 'resolved'
        ORDER BY 
          CASE priority
            WHEN 'critical' THEN 1
            WHEN 'high' THEN 2
            WHEN 'normal' THEN 3
            WHEN 'low' THEN 4
            ELSE 5
          END,
          datetime(opened_at) DESC
      `);

      res.json({ success: true, data: rows });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  });

  app.get("/api/andon/:id", async (req, res) => {
    try {
      const call = await get(`SELECT * FROM andon_calls WHERE id=?`, [req.params.id]);

      if (!call) {
        return res.status(404).json({ success: false, message: "Andon çağrısı bulunamadı." });
      }

      const logs = await all(`
        SELECT *
        FROM andon_call_logs
        WHERE call_id=?
        ORDER BY datetime(created_at) DESC
      `, [req.params.id]);

      res.json({ success: true, data: { call, logs } });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  });

  app.post("/api/andon", async (req, res) => {
    try {
      const b = req.body;
      const callNo = await createCallNo();

      const result = await run(`
        INSERT INTO andon_calls (
          call_no, call_type, priority, machine_name, work_order_no,
          operator_name, title, description, status, created_by
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'open', ?)
      `, [
        callNo,
        b.call_type,
        b.priority || "normal",
        b.machine_name || "",
        b.work_order_no || "",
        b.operator_name || "",
        b.title,
        b.description || "",
        b.created_by || ""
      ]);

      await run(`
        INSERT INTO andon_call_logs (
          call_id, old_status, new_status, note, changed_by
        )
        VALUES (?, ?, ?, ?, ?)
      `, [
        result.lastID,
        "",
        "open",
        "Andon çağrısı açıldı.",
        b.created_by || ""
      ]);

      res.json({ success: true, message: "Andon çağrısı açıldı.", id: result.lastID });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  });

  app.put("/api/andon/:id/status", async (req, res) => {
    try {
      const call = await get(`SELECT * FROM andon_calls WHERE id=?`, [req.params.id]);

      if (!call) {
        return res.status(404).json({ success: false, message: "Andon çağrısı bulunamadı." });
      }

      const newStatus = req.body.status;
      const changedBy = req.body.changed_by || "";
      const note = req.body.note || "";

      let extraSql = "";
      if (newStatus === "progress") {
        extraSql = ", acknowledged_at = COALESCE(acknowledged_at, CURRENT_TIMESTAMP)";
      }

      if (newStatus === "resolved") {
        extraSql = ", resolved_at = CURRENT_TIMESTAMP, resolved_by = ?";
      }

      const params = newStatus === "resolved"
        ? [newStatus, changedBy, req.params.id]
        : [newStatus, req.params.id];

      await run(`
        UPDATE andon_calls
        SET status=?, updated_at=CURRENT_TIMESTAMP ${extraSql}
        WHERE id=?
      `, params);

      await run(`
        INSERT INTO andon_call_logs (
          call_id, old_status, new_status, note, changed_by
        )
        VALUES (?, ?, ?, ?, ?)
      `, [
        req.params.id,
        call.status,
        newStatus,
        note,
        changedBy
      ]);

      res.json({ success: true, message: "Andon durumu güncellendi." });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  });

  app.delete("/api/andon/:id", async (req, res) => {
    try {
      await run(`DELETE FROM andon_call_logs WHERE call_id=?`, [req.params.id]);
      await run(`DELETE FROM andon_calls WHERE id=?`, [req.params.id]);

      res.json({ success: true, message: "Andon çağrısı silindi." });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  });
};