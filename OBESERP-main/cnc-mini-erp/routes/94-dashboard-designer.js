// routes/94-dashboard-designer.js
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

  db.serialize(() => {
    db.run(`
      CREATE TABLE IF NOT EXISTS dashboard_layouts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        dashboard_key TEXT DEFAULT 'main',
        dashboard_name TEXT DEFAULT 'Ana Dashboard',
        layout_json TEXT NOT NULL,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT,
        UNIQUE(user_id, dashboard_key)
      )
    `);

    db.run(`
      CREATE TABLE IF NOT EXISTS dashboard_widget_catalog (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        widget_key TEXT UNIQUE NOT NULL,
        widget_name TEXT NOT NULL,
        widget_type TEXT NOT NULL,
        module_key TEXT,
        icon TEXT,
        active INTEGER DEFAULT 1,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `);
  });

  async function seedWidgets() {
    const widgets = [
      ["kpi_oee", "OEE KPI", "kpi", "uretim", "fa-gauge-high"],
      ["kpi_work_orders", "Açık İş Emirleri", "kpi", "isemirleri", "fa-industry"],
      ["kpi_stock_critical", "Kritik Stok", "kpi", "stokyonetimi", "fa-boxes-stacked"],
      ["kpi_pending_workflow", "Bekleyen Onaylar", "kpi", "workflow", "fa-diagram-project"],
      ["chart_production", "Üretim Grafiği", "chart", "uretim", "fa-chart-line"],
      ["chart_scrap", "Fire Grafiği", "chart", "kalite", "fa-chart-pie"],
      ["machine_status", "Makine Durumları", "list", "uretim", "fa-microchip"],
      ["notification_list", "Son Bildirimler", "list", "notification", "fa-bell"],
      ["workflow_list", "Workflow Bekleyenler", "list", "workflow", "fa-list-check"],
      ["calendar_today", "Bugünkü Plan", "calendar", "uretim", "fa-calendar-days"]
    ];

    for (const w of widgets) {
      await run(
        `
        INSERT OR IGNORE INTO dashboard_widget_catalog
        (widget_key, widget_name, widget_type, module_key, icon)
        VALUES (?, ?, ?, ?, ?)
        `,
        w
      );
    }
  }

  seedWidgets().catch(err => {
    console.error("Dashboard widget seed hatası:", err.message);
  });

  app.get("/api/dashboard-designer/widgets", async (req, res) => {
    try {
      const rows = await all(`
        SELECT *
        FROM dashboard_widget_catalog
        WHERE active = 1
        ORDER BY widget_name
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

  app.get("/api/dashboard-designer/layout", async (req, res) => {
    try {
      const user = getUser(req);
      const dashboardKey = req.query.dashboardKey || "main";

      const rows = await all(
        `
        SELECT *
        FROM dashboard_layouts
        WHERE user_id = ?
          AND dashboard_key = ?
        LIMIT 1
        `,
        [user.id, dashboardKey]
      );

      if (!rows.length) {
        return res.json({
          success: true,
          data: null,
          widgets: []
        });
      }

      let widgets = [];

      try {
        widgets = JSON.parse(rows[0].layout_json || "[]");
      } catch {
        widgets = [];
      }

      res.json({
        success: true,
        data: rows[0],
        widgets
      });
    } catch (err) {
      res.status(500).json({
        success: false,
        message: err.message
      });
    }
  });

  app.post("/api/dashboard-designer/layout", async (req, res) => {
    try {
      const user = getUser(req);
      const dashboardKey = req.body.dashboardKey || "main";
      const dashboardName = req.body.dashboardName || "Ana Dashboard";
      const widgets = req.body.widgets || [];

      await run(
        `
        INSERT INTO dashboard_layouts (
          user_id,
          dashboard_key,
          dashboard_name,
          layout_json,
          updated_at
        )
        VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
        ON CONFLICT(user_id, dashboard_key)
        DO UPDATE SET
          dashboard_name = excluded.dashboard_name,
          layout_json = excluded.layout_json,
          updated_at = CURRENT_TIMESTAMP
        `,
        [
          user.id,
          dashboardKey,
          dashboardName,
          JSON.stringify(widgets)
        ]
      );

      if (ctx.auditLog) {
        await ctx.auditLog(req, {
          module: "dashboard",
          action: "save",
          recordId: dashboardKey,
          newData: widgets,
          description: "Dashboard layout kaydedildi."
        });
      }

      res.json({
        success: true,
        message: "Dashboard layout kaydedildi."
      });
    } catch (err) {
      res.status(500).json({
        success: false,
        message: err.message
      });
    }
  });

  app.delete("/api/dashboard-designer/layout", async (req, res) => {
    try {
      const user = getUser(req);
      const dashboardKey = req.query.dashboardKey || "main";

      await run(
        `
        DELETE FROM dashboard_layouts
        WHERE user_id = ?
          AND dashboard_key = ?
        `,
        [user.id, dashboardKey]
      );

      res.json({
        success: true,
        message: "Dashboard layout sıfırlandı."
      });
    } catch (err) {
      res.status(500).json({
        success: false,
        message: err.message
      });
    }
  });

  console.log("Dashboard Designer aktif.");
};