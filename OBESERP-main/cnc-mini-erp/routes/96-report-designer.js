// routes/96-report-designer.js
module.exports = function (app, ctx) {
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
        else resolve(rows || []);
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

  function getUser(req) {
    const user = req.session?.user || req.user || {};

    return {
      id: user.id || req.headers["x-user-id"] || 0,
      username:
        user.username ||
        user.full_name ||
        user.fullName ||
        req.headers["x-user-name"] ||
        "Bilinmeyen Kullanıcı",
      role: String(user.role || req.headers["x-user-role"] || "").toLowerCase()
    };
  }

  function normalizeReportKey(value) {
    return String(value || "")
      .trim()
      .toLowerCase()
      .replaceAll("ı", "i")
      .replaceAll("ğ", "g")
      .replaceAll("ü", "u")
      .replaceAll("ş", "s")
      .replaceAll("ö", "o")
      .replaceAll("ç", "c")
      .replace(/[^a-z0-9_]+/g, "_")
      .replace(/^_+|_+$/g, "");
  }

  function validateSelectOnly(sql) {
    const s = String(sql || "").trim();

    if (!s) return "SQL boş olamaz.";

    const lower = s.toLowerCase();

    if (!lower.startsWith("select")) {
      return "Rapor SQL sadece SELECT ile başlamalıdır.";
    }

    const forbidden = [
      " insert ",
      " update ",
      " delete ",
      " drop ",
      " alter ",
      " create ",
      " truncate ",
      " replace ",
      " attach ",
      " detach ",
      " pragma ",
      " vacuum "
    ];

    const padded = ` ${lower.replace(/\s+/g, " ")} `;

    for (const word of forbidden) {
      if (padded.includes(word)) {
        return `Güvenlik nedeniyle ${word.trim().toUpperCase()} kullanılamaz.`;
      }
    }

    if (s.includes(";")) {
      return "SQL içinde noktalı virgül kullanma. Tek SELECT sorgusu yaz.";
    }

    return null;
  }

  function parseJson(value, fallback) {
    try {
      if (!value) return fallback;
      return JSON.parse(value);
    } catch {
      return fallback;
    }
  }

  function applyFilters(sql, filters = []) {
    let finalSql = String(sql || "");
    const params = [];

    for (const f of filters) {
      const name = f.name;
      const value = f.value;

      if (!name) continue;

      const token = `:${name}`;

      if (finalSql.includes(token)) {
        finalSql = finalSql.replaceAll(token, "?");
        params.push(value);
      }
    }

    return { sql: finalSql, params };
  }

  function toCsv(rows) {
    if (!rows || !rows.length) return "";

    const headers = Object.keys(rows[0]);

    const escapeCell = value => {
      const text = String(value ?? "");
      return `"${text.replaceAll('"', '""')}"`;
    };

    const lines = [
      headers.map(escapeCell).join(";"),
      ...rows.map(row => headers.map(h => escapeCell(row[h])).join(";"))
    ];

    return "\uFEFF" + lines.join("\n");
  }

  db.serialize(() => {
    db.run(`
      CREATE TABLE IF NOT EXISTS report_definitions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        report_key TEXT UNIQUE NOT NULL,
        report_name TEXT NOT NULL,
        module_key TEXT,
        description TEXT,
        sql_query TEXT NOT NULL,
        filters_json TEXT,
        active INTEGER DEFAULT 1,
        created_by INTEGER,
        created_by_name TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT
      )
    `);

    db.run(`
      CREATE TABLE IF NOT EXISTS report_run_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        report_id INTEGER,
        report_name TEXT,
        user_id INTEGER,
        username TEXT,
        filter_json TEXT,
        row_count INTEGER DEFAULT 0,
        run_type TEXT DEFAULT 'preview',
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `);
  });

  async function logReportRun(req, options = {}) {
    try {
      const user = getUser(req);

      await run(
        `
        INSERT INTO report_run_logs (
          report_id,
          report_name,
          user_id,
          username,
          filter_json,
          row_count,
          run_type
        )
        VALUES (?, ?, ?, ?, ?, ?, ?)
        `,
        [
          options.reportId || null,
          options.reportName || null,
          user.id,
          user.username,
          JSON.stringify(options.filters || []),
          Number(options.rowCount || 0),
          options.runType || "preview"
        ]
      );
    } catch (err) {
      console.warn("Rapor çalışma logu yazılamadı:", err.message);
    }
  }

  app.get("/api/report-designer", async (req, res) => {
    try {
      const rows = await all(`
        SELECT *
        FROM report_definitions
        ORDER BY id DESC
      `);

      rows.forEach(r => {
        r.filters = parseJson(r.filters_json, []);
      });

      res.json({
        success: true,
        data: rows
      });
    } catch (err) {
      res.status(500).json({
        success: false,
        message: err.message
      });
    }
  });

  app.get("/api/report-designer/:id", async (req, res) => {
    try {
      const row = await get(
        `SELECT * FROM report_definitions WHERE id = ?`,
        [req.params.id]
      );

      if (!row) {
        return res.status(404).json({
          success: false,
          message: "Rapor bulunamadı."
        });
      }

      row.filters = parseJson(row.filters_json, []);

      res.json({
        success: true,
        data: row
      });
    } catch (err) {
      res.status(500).json({
        success: false,
        message: err.message
      });
    }
  });

  app.post("/api/report-designer", async (req, res) => {
    try {
      const user = getUser(req);
      const body = req.body || {};

      const reportKey = normalizeReportKey(body.reportKey || body.reportName);

      if (!reportKey) {
        return res.status(400).json({
          success: false,
          message: "Rapor key üretilemedi. Rapor adı gir."
        });
      }

      const validationError = validateSelectOnly(body.sqlQuery);

      if (validationError) {
        return res.status(400).json({
          success: false,
          message: validationError
        });
      }

      const inserted = await run(
        `
        INSERT INTO report_definitions (
          report_key,
          report_name,
          module_key,
          description,
          sql_query,
          filters_json,
          active,
          created_by,
          created_by_name,
          updated_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
        `,
        [
          reportKey,
          body.reportName,
          body.moduleKey || null,
          body.description || null,
          body.sqlQuery,
          JSON.stringify(body.filters || []),
          body.active === false ? 0 : 1,
          user.id,
          user.username
        ]
      );

      if (ctx.auditLog) {
        await ctx.auditLog(req, {
          module: "report",
          action: "create",
          recordId: inserted.lastID,
          newData: body,
          description: "Rapor tanımı oluşturuldu."
        });
      }

      res.json({
        success: true,
        id: inserted.lastID,
        message: "Rapor oluşturuldu."
      });
    } catch (err) {
      res.status(500).json({
        success: false,
        message: err.message
      });
    }
  });

  app.put("/api/report-designer/:id", async (req, res) => {
    try {
      const body = req.body || {};

      const validationError = validateSelectOnly(body.sqlQuery);

      if (validationError) {
        return res.status(400).json({
          success: false,
          message: validationError
        });
      }

      await run(
        `
        UPDATE report_definitions
        SET report_name = ?,
            module_key = ?,
            description = ?,
            sql_query = ?,
            filters_json = ?,
            active = ?,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
        `,
        [
          body.reportName,
          body.moduleKey || null,
          body.description || null,
          body.sqlQuery,
          JSON.stringify(body.filters || []),
          body.active === false ? 0 : 1,
          req.params.id
        ]
      );

      if (ctx.auditLog) {
        await ctx.auditLog(req, {
          module: "report",
          action: "update",
          recordId: req.params.id,
          newData: body,
          description: "Rapor tanımı güncellendi."
        });
      }

      res.json({
        success: true,
        message: "Rapor güncellendi."
      });
    } catch (err) {
      res.status(500).json({
        success: false,
        message: err.message
      });
    }
  });

  app.delete("/api/report-designer/:id", async (req, res) => {
    try {
      const oldData = await get(
        `SELECT * FROM report_definitions WHERE id = ?`,
        [req.params.id]
      );

      await run(
        `DELETE FROM report_definitions WHERE id = ?`,
        [req.params.id]
      );

      if (ctx.auditLog) {
        await ctx.auditLog(req, {
          module: "report",
          action: "delete",
          recordId: req.params.id,
          oldData,
          description: "Rapor tanımı silindi."
        });
      }

      res.json({
        success: true,
        message: "Rapor silindi."
      });
    } catch (err) {
      res.status(500).json({
        success: false,
        message: err.message
      });
    }
  });

  app.post("/api/report-designer/test", async (req, res) => {
    try {
      const body = req.body || {};

      const validationError = validateSelectOnly(body.sqlQuery);

      if (validationError) {
        return res.status(400).json({
          success: false,
          message: validationError
        });
      }

      const filters = body.filters || [];
      const applied = applyFilters(body.sqlQuery, filters);

      const rows = await all(applied.sql, applied.params);

      res.json({
        success: true,
        columns: rows.length ? Object.keys(rows[0]) : [],
        rowCount: rows.length,
        data: rows.slice(0, Number(body.limit || 100))
      });
    } catch (err) {
      res.status(500).json({
        success: false,
        message: err.message
      });
    }
  });

  app.post("/api/report-designer/:id/run", async (req, res) => {
    try {
      const report = await get(
        `SELECT * FROM report_definitions WHERE id = ? AND active = 1`,
        [req.params.id]
      );

      if (!report) {
        return res.status(404).json({
          success: false,
          message: "Rapor bulunamadı veya pasif."
        });
      }

      const validationError = validateSelectOnly(report.sql_query);

      if (validationError) {
        return res.status(400).json({
          success: false,
          message: validationError
        });
      }

      const filters = req.body.filters || [];
      const applied = applyFilters(report.sql_query, filters);

      const rows = await all(applied.sql, applied.params);

      await logReportRun(req, {
        reportId: report.id,
        reportName: report.report_name,
        filters,
        rowCount: rows.length,
        runType: "preview"
      });

      res.json({
        success: true,
        report,
        columns: rows.length ? Object.keys(rows[0]) : [],
        rowCount: rows.length,
        data: rows
      });
    } catch (err) {
      res.status(500).json({
        success: false,
        message: err.message
      });
    }
  });

  app.post("/api/report-designer/:id/export-csv", async (req, res) => {
    try {
      const report = await get(
        `SELECT * FROM report_definitions WHERE id = ? AND active = 1`,
        [req.params.id]
      );

      if (!report) {
        return res.status(404).json({
          success: false,
          message: "Rapor bulunamadı veya pasif."
        });
      }

      const validationError = validateSelectOnly(report.sql_query);

      if (validationError) {
        return res.status(400).json({
          success: false,
          message: validationError
        });
      }

      const filters = req.body.filters || [];
      const applied = applyFilters(report.sql_query, filters);

      const rows = await all(applied.sql, applied.params);
      const csv = toCsv(rows);

      await logReportRun(req, {
        reportId: report.id,
        reportName: report.report_name,
        filters,
        rowCount: rows.length,
        runType: "csv"
      });

      const fileName = `${report.report_key || "rapor"}.csv`;

      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);
      res.send(csv);
    } catch (err) {
      res.status(500).json({
        success: false,
        message: err.message
      });
    }
  });

  app.get("/api/report-designer/run-logs/list", async (req, res) => {
    try {
      const rows = await all(`
        SELECT *
        FROM report_run_logs
        ORDER BY id DESC
        LIMIT 300
      `);

      res.json({
        success: true,
        data: rows
      });
    } catch (err) {
      res.status(500).json({
        success: false,
        message: err.message
      });
    }
  });

  console.log("Report Designer aktif.");
};