module.exports = function (app, ctx = {}) {
  const db = ctx.db;

  function all(sql, params = []) {
    return new Promise((resolve, reject) => {
      if (db.all) {
        db.all(sql, params, (err, rows) => err ? reject(err) : resolve(rows || []));
      } else {
        try {
          resolve(db.prepare(sql).all(params));
        } catch (err) {
          reject(err);
        }
      }
    });
  }

  function run(sql, params = []) {
    return new Promise((resolve, reject) => {
      if (db.run) {
        db.run(sql, params, function (err) {
          err ? reject(err) : resolve(this);
        });
      } else {
        try {
          resolve(db.prepare(sql).run(params));
        } catch (err) {
          reject(err);
        }
      }
    });
  }

  function isSafeSelect(sql) {
    const q = String(sql || "").trim().toLowerCase();

    if (!q.startsWith("select")) return false;

    const blocked = [
      "insert ",
      "update ",
      "delete ",
      "drop ",
      "alter ",
      "create ",
      "replace ",
      "truncate ",
      "attach ",
      "detach ",
      "pragma ",
      "vacuum "
    ];

    return !blocked.some(x => q.includes(x));
  }

  async function init() {
    await run(`
      CREATE TABLE IF NOT EXISTS live_queries (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        query_name TEXT NOT NULL,
        description TEXT,
        sql_query TEXT NOT NULL,
        created_by TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
  }

  init().catch(err => console.error("Live Query init hata:", err.message));

  app.post("/api/live-query/run", async (req, res) => {
    try {
      const sql = String(req.body.sql || req.body.sql_query || "").trim();

      if (!sql) {
        return res.status(400).json({ success: false, message: "SQL boş olamaz." });
      }

      if (!isSafeSelect(sql)) {
        return res.status(403).json({
          success: false,
          message: "Güvenlik nedeniyle sadece SELECT sorgularına izin verilir."
        });
      }

      const finalSql = sql.toLowerCase().includes(" limit ")
        ? sql
        : `${sql} LIMIT 500`;

      const rows = await all(finalSql);
      const columns = rows.length ? Object.keys(rows[0]) : [];

      res.json({
        success: true,
        columns,
        data: rows,
        rowCount: rows.length
      });
    } catch (err) {
      res.status(500).json({
        success: false,
        message: "Sorgu çalıştırılamadı.",
        error: err.message
      });
    }
  });

  app.get("/api/live-query/saved", async (req, res) => {
    try {
      const rows = await all(`
        SELECT *
        FROM live_queries
        ORDER BY id DESC
      `);

      res.json({ success: true, data: rows });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  app.post("/api/live-query/save", async (req, res) => {
    try {
      const queryName = String(req.body.query_name || "").trim();
      const description = String(req.body.description || "").trim();
      const sqlQuery = String(req.body.sql_query || req.body.sql || "").trim();
      const createdBy = req.headers["x-user-name"] || "system";

      if (!queryName || !sqlQuery) {
        return res.status(400).json({
          success: false,
          message: "Sorgu adı ve SQL zorunlu."
        });
      }

      if (!isSafeSelect(sqlQuery)) {
        return res.status(403).json({
          success: false,
          message: "Sadece SELECT sorguları kaydedilebilir."
        });
      }

      const result = await run(`
        INSERT INTO live_queries
        (query_name, description, sql_query, created_by)
        VALUES (?, ?, ?, ?)
      `, [queryName, description, sqlQuery, createdBy]);

      if (ctx.emitEvent) {
        await ctx.emitEvent("live_query.saved", {
          module_name: "Live Query Studio",
          entity_type: "live_query",
          entity_id: result.lastID || null,
          message: "Live Query sorgusu kaydedildi.",
          created_by: createdBy
        });
      }

      res.json({ success: true, id: result.lastID || null });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  app.delete("/api/live-query/saved/:id", async (req, res) => {
    try {
      await run(`DELETE FROM live_queries WHERE id=?`, [req.params.id]);
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  app.get("/api/live-query/tables", async (req, res) => {
    try {
      const rows = await all(`
        SELECT name
        FROM sqlite_master
        WHERE type='table'
        ORDER BY name
      `);

      res.json({ success: true, data: rows });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  console.log("✅ Live Query Studio aktif");
};