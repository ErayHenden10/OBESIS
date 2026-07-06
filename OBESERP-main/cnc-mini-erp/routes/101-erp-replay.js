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

  function get(sql, params = []) {
    return new Promise((resolve, reject) => {
      if (db.get) {
        db.get(sql, params, (err, row) => err ? reject(err) : resolve(row || null));
      } else {
        try {
          resolve(db.prepare(sql).get(params) || null);
        } catch (err) {
          reject(err);
        }
      }
    });
  }

  async function tableExists(name) {
    const row = await get(
      "SELECT name FROM sqlite_master WHERE type='table' AND name=?",
      [name]
    );
    return !!row;
  }

  async function columns(table) {
    try {
      const rows = await all(`PRAGMA table_info(${table})`);
      return rows.map(x => x.name);
    } catch {
      return [];
    }
  }

  function has(cols, name) {
    return cols.includes(name);
  }

  function safeJson(v) {
    try { return JSON.parse(v || "{}"); }
    catch { return {}; }
  }

  function makeRange(date, time, minutes) {
    const safeTime = time || "00:00";
    const d = new Date(`${date}T${safeTime}:00`);

    if (Number.isNaN(d.getTime())) {
      throw new Error("Tarih/saat formatı hatalı.");
    }

    const start = `${date} ${safeTime}:00`;
    d.setMinutes(d.getMinutes() + Number(minutes || 60));

    const pad = n => String(n).padStart(2, "0");

    const end =
      `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ` +
      `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;

    return { start, end };
  }


  
  app.get("/api/erp-replay", async (req, res) => {
    try {
      const date = String(req.query.date || "").trim();
      const time = String(req.query.time || "00:00").trim();
      const minutes = Number(req.query.minutes || 60);

      if (!date) {
        return res.status(400).json({
          success: false,
          message: "date zorunlu"
        });
      }

      const range = makeRange(date, time, minutes);
      let timeline = [];

      if (await tableExists("event_bus_events")) {
        const cols = await columns("event_bus_events");

        const selectParts = [
          has(cols, "id") ? "id" : "rowid AS id",
          has(cols, "created_at") ? "created_at" : "datetime('now') AS created_at",
          has(cols, "event_name") ? "event_name" : "'event' AS event_name",
          has(cols, "module_name") ? "module_name" : "NULL AS module_name",
          has(cols, "entity_type") ? "entity_type" : "NULL AS entity_type",
          has(cols, "entity_id") ? "entity_id" : "NULL AS entity_id",
          has(cols, "payload") ? "payload" : "'{}' AS payload",
          has(cols, "status") ? "status" : "'success' AS status",
          has(cols, "created_by") ? "created_by" : "'system' AS created_by"
        ];

        const dateCol = has(cols, "created_at") ? "created_at" : "datetime('now')";

        const events = await all(`
          SELECT ${selectParts.join(", ")}
          FROM event_bus_events
          WHERE datetime(${dateCol}) >= datetime(?)
            AND datetime(${dateCol}) <= datetime(?)
          ORDER BY datetime(${dateCol}) ASC
          LIMIT 500
        `, [range.start, range.end]);

        timeline.push(...events.map(e => {
          const payload = safeJson(e.payload);

          return {
            id: `event-${e.id}`,
            time: e.created_at,
            actor: e.created_by || payload.created_by || "system",
            title: e.event_name || "Event",
            module: e.module_name || payload.module_name || "-",
            entity_type: e.entity_type || payload.entity_type || "-",
            entity_id: e.entity_id || payload.entity_id || "-",
            description: payload.message || `${e.event_name || "Event"} olayı tetiklendi.`,
            status: e.status || "success",
            source: "event_bus",
            raw: payload
          };
        }));
      }

      if (await tableExists("audit_logs")) {
        const cols = await columns("audit_logs");

        const selectParts = [
          has(cols, "id") ? "id" : "rowid AS id",
          has(cols, "created_at") ? "created_at" : "datetime('now') AS created_at",
          has(cols, "action") ? "action" : "'Audit Log' AS action",
          has(cols, "module_name") ? "module_name" : "NULL AS module_name",
          has(cols, "description") ? "description" : "NULL AS description",
          has(cols, "created_by") ? "created_by" : "'system' AS created_by"
        ];

        const dateCol = has(cols, "created_at") ? "created_at" : "datetime('now')";

        const audits = await all(`
          SELECT ${selectParts.join(", ")}
          FROM audit_logs
          WHERE datetime(${dateCol}) >= datetime(?)
            AND datetime(${dateCol}) <= datetime(?)
          ORDER BY datetime(${dateCol}) ASC
          LIMIT 500
        `, [range.start, range.end]);

        timeline.push(...audits.map(a => ({
          id: `audit-${a.id}`,
          time: a.created_at,
          actor: a.created_by || "system",
          title: a.action || "Audit Log",
          module: a.module_name || "-",
          entity_type: "audit",
          entity_id: a.id,
          description: a.description || "Sistem hareketi oluştu.",
          status: "success",
          source: "audit_log",
          raw: a
        })));
      }

      timeline = timeline.sort((a, b) => new Date(a.time) - new Date(b.time));

      res.json({
        success: true,
        range,
        stats: {
          total: timeline.length,
          users: [...new Set(timeline.map(x => x.actor).filter(Boolean))].length,
          modules: [...new Set(timeline.map(x => x.module).filter(Boolean))].length,
          errors: timeline.filter(x => x.status === "error").length
        },
        data: timeline
      });
    } catch (err) {
      console.error("ERP Replay hata:", err.message);

      res.status(500).json({
        success: false,
        message: "ERP Replay hatası",
        error: err.message
      });
    }
  });

  console.log("✅ ERP Replay aktif: /api/erp-replay");
};