// routes/95-kpi-designer.js
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

  function normalizeKpiKey(value) {
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
      return "KPI SQL sadece SELECT ile başlamalıdır.";
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

  function getKpiStatus(value, target, warningLimit, dangerLimit, direction) {
    const v = Number(value || 0);
    const t = Number(target || 0);
    const w = Number(warningLimit || 0);
    const d = Number(dangerLimit || 0);

    if (direction === "lower_better") {
      if (d > 0 && v >= d) return "danger";
      if (w > 0 && v >= w) return "warning";
      return "success";
    }

    if (t > 0 && v >= t) return "success";
    if (w > 0 && v >= w) return "warning";
    return "danger";
  }

  db.serialize(() => {
    db.run(`
      CREATE TABLE IF NOT EXISTS kpi_definitions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        kpi_key TEXT UNIQUE NOT NULL,
        kpi_name TEXT NOT NULL,
        module_key TEXT,
        description TEXT,
        sql_query TEXT NOT NULL,
        target_value REAL DEFAULT 0,
        warning_value REAL DEFAULT 0,
        danger_value REAL DEFAULT 0,
        direction TEXT DEFAULT 'higher_better',
        unit TEXT,
        icon TEXT DEFAULT 'fa-gauge-high',
        active INTEGER DEFAULT 1,
        created_by INTEGER,
        created_by_name TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT
      )
    `);
  });

  async function registerKpiWidget(kpi) {
    try {
      await run(
        `
        INSERT OR IGNORE INTO dashboard_widget_catalog
        (widget_key, widget_name, widget_type, module_key, icon)
        VALUES (?, ?, ?, ?, ?)
        `,
        [
          `custom_${kpi.kpi_key}`,
          kpi.kpi_name,
          "custom_kpi",
          kpi.module_key || "kpi",
          kpi.icon || "fa-gauge-high"
        ]
      );
    } catch (err) {
      console.warn("KPI dashboard widget kataloğuna eklenemedi:", err.message);
    }
  }

  async function executeKpi(kpi) {
    const validationError = validateSelectOnly(kpi.sql_query);

    if (validationError) {
      throw new Error(validationError);
    }

    const row = await get(kpi.sql_query);

    let value = 0;

    if (row) {
      const firstKey = Object.keys(row)[0];
      value = Number(row[firstKey] || 0);
    }

    const status = getKpiStatus(
      value,
      kpi.target_value,
      kpi.warning_value,
      kpi.danger_value,
      kpi.direction
    );

    return {
      value,
      status,
      unit: kpi.unit || "",
      targetValue: Number(kpi.target_value || 0),
      warningValue: Number(kpi.warning_value || 0),
      dangerValue: Number(kpi.danger_value || 0)
    };
  }

  ctx.executeKpi = executeKpi;

  app.get("/api/kpi-designer", async (req, res) => {
    try {
      const rows = await all(`
        SELECT *
        FROM kpi_definitions
        ORDER BY id DESC
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

  app.get("/api/kpi-designer/:id", async (req, res) => {
    try {
      const row = await get(
        `SELECT * FROM kpi_definitions WHERE id = ?`,
        [req.params.id]
      );

      if (!row) {
        return res.status(404).json({
          success: false,
          message: "KPI bulunamadı."
        });
      }

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

  app.post("/api/kpi-designer", async (req, res) => {
    try {
      const user = getUser(req);
      const body = req.body || {};

      const kpiKey = normalizeKpiKey(body.kpiKey || body.kpiName);

      if (!kpiKey) {
        return res.status(400).json({
          success: false,
          message: "KPI key üretilemedi. KPI adı gir."
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
        INSERT INTO kpi_definitions (
          kpi_key,
          kpi_name,
          module_key,
          description,
          sql_query,
          target_value,
          warning_value,
          danger_value,
          direction,
          unit,
          icon,
          active,
          created_by,
          created_by_name,
          updated_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
        `,
        [
          kpiKey,
          body.kpiName,
          body.moduleKey || null,
          body.description || null,
          body.sqlQuery,
          Number(body.targetValue || 0),
          Number(body.warningValue || 0),
          Number(body.dangerValue || 0),
          body.direction || "higher_better",
          body.unit || null,
          body.icon || "fa-gauge-high",
          body.active === false ? 0 : 1,
          user.id,
          user.username
        ]
      );

      const kpi = await get(
        `SELECT * FROM kpi_definitions WHERE id = ?`,
        [inserted.lastID]
      );

      await registerKpiWidget(kpi);

      if (ctx.auditLog) {
        await ctx.auditLog(req, {
          module: "kpi",
          action: "create",
          recordId: inserted.lastID,
          newData: body,
          description: "KPI tanımı oluşturuldu."
        });
      }

      res.json({
        success: true,
        id: inserted.lastID,
        message: "KPI oluşturuldu."
      });
    } catch (err) {
      res.status(500).json({
        success: false,
        message: err.message
      });
    }
  });

  app.put("/api/kpi-designer/:id", async (req, res) => {
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
        UPDATE kpi_definitions
        SET kpi_name = ?,
            module_key = ?,
            description = ?,
            sql_query = ?,
            target_value = ?,
            warning_value = ?,
            danger_value = ?,
            direction = ?,
            unit = ?,
            icon = ?,
            active = ?,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
        `,
        [
          body.kpiName,
          body.moduleKey || null,
          body.description || null,
          body.sqlQuery,
          Number(body.targetValue || 0),
          Number(body.warningValue || 0),
          Number(body.dangerValue || 0),
          body.direction || "higher_better",
          body.unit || null,
          body.icon || "fa-gauge-high",
          body.active === false ? 0 : 1,
          req.params.id
        ]
      );

      const kpi = await get(
        `SELECT * FROM kpi_definitions WHERE id = ?`,
        [req.params.id]
      );

      if (kpi) {
        await registerKpiWidget(kpi);
      }

      if (ctx.auditLog) {
        await ctx.auditLog(req, {
          module: "kpi",
          action: "update",
          recordId: req.params.id,
          newData: body,
          description: "KPI tanımı güncellendi."
        });
      }

      res.json({
        success: true,
        message: "KPI güncellendi."
      });
    } catch (err) {
      res.status(500).json({
        success: false,
        message: err.message
      });
    }
  });

  app.delete("/api/kpi-designer/:id", async (req, res) => {
    try {
      const oldData = await get(
        `SELECT * FROM kpi_definitions WHERE id = ?`,
        [req.params.id]
      );

      await run(
        `DELETE FROM kpi_definitions WHERE id = ?`,
        [req.params.id]
      );

      if (oldData) {
        await run(
          `DELETE FROM dashboard_widget_catalog WHERE widget_key = ?`,
          [`custom_${oldData.kpi_key}`]
        );
      }

      if (ctx.auditLog) {
        await ctx.auditLog(req, {
          module: "kpi",
          action: "delete",
          recordId: req.params.id,
          oldData,
          description: "KPI tanımı silindi."
        });
      }

      res.json({
        success: true,
        message: "KPI silindi."
      });
    } catch (err) {
      res.status(500).json({
        success: false,
        message: err.message
      });
    }
  });

  app.post("/api/kpi-designer/test", async (req, res) => {
    try {
      const body = req.body || {};

      const validationError = validateSelectOnly(body.sqlQuery);

      if (validationError) {
        return res.status(400).json({
          success: false,
          message: validationError
        });
      }

      const tempKpi = {
        sql_query: body.sqlQuery,
        target_value: Number(body.targetValue || 0),
        warning_value: Number(body.warningValue || 0),
        danger_value: Number(body.dangerValue || 0),
        direction: body.direction || "higher_better",
        unit: body.unit || ""
      };

      const result = await executeKpi(tempKpi);

      res.json({
        success: true,
        result
      });
    } catch (err) {
      res.status(500).json({
        success: false,
        message: err.message
      });
    }
  });

  app.get("/api/kpi-designer/:id/value", async (req, res) => {
    try {
      const kpi = await get(
        `SELECT * FROM kpi_definitions WHERE id = ? AND active = 1`,
        [req.params.id]
      );

      if (!kpi) {
        return res.status(404).json({
          success: false,
          message: "KPI bulunamadı veya pasif."
        });
      }

      const result = await executeKpi(kpi);

      res.json({
        success: true,
        kpi,
        result
      });
    } catch (err) {
      res.status(500).json({
        success: false,
        message: err.message
      });
    }
  });

  app.get("/api/kpi-designer/key/:key/value", async (req, res) => {
    try {
      const kpi = await get(
        `SELECT * FROM kpi_definitions WHERE kpi_key = ? AND active = 1`,
        [req.params.key]
      );

      if (!kpi) {
        return res.status(404).json({
          success: false,
          message: "KPI bulunamadı veya pasif."
        });
      }

      const result = await executeKpi(kpi);

      res.json({
        success: true,
        kpi,
        result
      });
    } catch (err) {
      res.status(500).json({
        success: false,
        message: err.message
      });
    }
  });

  console.log("KPI Designer aktif.");
};