module.exports = function (app, ctx = {}) {
  const db = ctx.db;

  if (!db) {
    console.error("❌ Event Bus için ctx.db bulunamadı.");
    return;
  }

  function run(sql, params = []) {
    return new Promise((resolve, reject) => {
      if (typeof db.run === "function") {
        db.run(sql, params, function (err) {
          if (err) reject(err);
          else resolve(this);
        });
      } else if (typeof db.prepare === "function") {
        try {
          const stmt = db.prepare(sql);
          const result = stmt.run(params);
          resolve(result);
        } catch (err) {
          reject(err);
        }
      } else {
        reject(new Error("Desteklenmeyen DB adapter"));
      }
    });
  }

  function all(sql, params = []) {
    return new Promise((resolve, reject) => {
      if (typeof db.all === "function") {
        db.all(sql, params, (err, rows) => {
          if (err) reject(err);
          else resolve(rows || []);
        });
      } else if (typeof db.prepare === "function") {
        try {
          const stmt = db.prepare(sql);
          resolve(stmt.all(params));
        } catch (err) {
          reject(err);
        }
      } else {
        reject(new Error("Desteklenmeyen DB adapter"));
      }
    });
  }

  function get(sql, params = []) {
    return new Promise((resolve, reject) => {
      if (typeof db.get === "function") {
        db.get(sql, params, (err, row) => {
          if (err) reject(err);
          else resolve(row || null);
        });
      } else if (typeof db.prepare === "function") {
        try {
          const stmt = db.prepare(sql);
          resolve(stmt.get(params) || null);
        } catch (err) {
          reject(err);
        }
      } else {
        reject(new Error("Desteklenmeyen DB adapter"));
      }
    });
  }

  async function tableExists(tableName) {
    const row = await get(
      "SELECT name FROM sqlite_master WHERE type='table' AND name=?",
      [tableName]
    );
    return !!row;
  }

  async function initEventBusTables() {
    await run(`
      CREATE TABLE IF NOT EXISTS event_bus_events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        event_name TEXT NOT NULL,
        module_name TEXT,
        entity_type TEXT,
        entity_id TEXT,
        payload TEXT,
        status TEXT DEFAULT 'success',
        error_message TEXT,
        created_by TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await run(`
      CREATE TABLE IF NOT EXISTS event_bus_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        event_id INTEGER,
        target TEXT,
        status TEXT DEFAULT 'success',
        message TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
  }

  initEventBusTables().catch(err => {
    console.error("❌ Event Bus tablo oluşturma hatası:", err.message);
  });

  async function writeBusLog(eventId, target, status, message) {
    try {
      await run(
        `INSERT INTO event_bus_logs 
         (event_id, target, status, message) 
         VALUES (?, ?, ?, ?)`,
        [eventId, target, status, message]
      );
    } catch (err) {
      console.error("Event Bus log yazılamadı:", err.message);
    }
  }

  async function triggerAuditLog(eventId, eventName, data, createdBy) {
    try {
      const exists = await tableExists("audit_logs");
      if (!exists) {
        await writeBusLog(eventId, "audit_log", "skipped", "audit_logs tablosu yok");
        return;
      }

      await run(
        `INSERT INTO audit_logs 
         (action, module_name, description, created_by, created_at)
         VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)`,
        [
          eventName,
          data.module_name || data.module || "Event Bus",
          `${eventName} olayı tetiklendi`,
          createdBy || data.created_by || "system"
        ]
      );

      await writeBusLog(eventId, "audit_log", "success", "Audit log yazıldı");
    } catch (err) {
      await writeBusLog(eventId, "audit_log", "error", err.message);
    }
  }

  async function triggerNotification(eventId, eventName, data) {
    try {
      const exists = await tableExists("notifications");
      if (!exists) {
        await writeBusLog(eventId, "notification", "skipped", "notifications tablosu yok");
        return;
      }

      await run(
        `INSERT INTO notifications 
         (title, message, type, is_read, created_at)
         VALUES (?, ?, ?, 0, CURRENT_TIMESTAMP)`,
        [
          `Yeni Event: ${eventName}`,
          data.message || `${eventName} olayı sistemde oluştu.`,
          data.type || "info"
        ]
      );

      await writeBusLog(eventId, "notification", "success", "Bildirim oluşturuldu");
    } catch (err) {
      await writeBusLog(eventId, "notification", "error", err.message);
    }
  }

  async function triggerWebhook(eventId, eventName, data) {
    try {
      const exists = await tableExists("webhook_queue");
      if (!exists) {
        await writeBusLog(eventId, "webhook", "skipped", "webhook_queue tablosu yok");
        return;
      }

      await run(
        `INSERT INTO webhook_queue 
         (event_name, payload, status, created_at)
         VALUES (?, ?, 'pending', CURRENT_TIMESTAMP)`,
        [eventName, JSON.stringify(data || {})]
      );

      await writeBusLog(eventId, "webhook", "success", "Webhook kuyruğa alındı");
    } catch (err) {
      await writeBusLog(eventId, "webhook", "error", err.message);
    }
  }

  async function triggerWorkflow(eventId, eventName, data) {
    try {
      const exists = await tableExists("workflow_queue");
      if (!exists) {
        await writeBusLog(eventId, "workflow", "skipped", "workflow_queue tablosu yok");
        return;
      }

      await run(
        `INSERT INTO workflow_queue 
         (event_name, payload, status, created_at)
         VALUES (?, ?, 'pending', CURRENT_TIMESTAMP)`,
        [eventName, JSON.stringify(data || {})]
      );

      await writeBusLog(eventId, "workflow", "success", "Workflow kuyruğa alındı");
    } catch (err) {
      await writeBusLog(eventId, "workflow", "error", err.message);
    }
  }

  ctx.emitEvent = async function emitEvent(eventName, data = {}) {
    let eventId = null;

    try {
      const result = await run(
        `INSERT INTO event_bus_events 
         (event_name, module_name, entity_type, entity_id, payload, status, created_by)
         VALUES (?, ?, ?, ?, ?, 'success', ?)`,
        [
          eventName,
          data.module_name || data.module || null,
          data.entity_type || null,
          data.entity_id || data.id || null,
          JSON.stringify(data || {}),
          data.created_by || "system"
        ]
      );

      eventId = result.lastID || result.lastInsertRowid || null;

      await triggerAuditLog(eventId, eventName, data, data.created_by);
      await triggerNotification(eventId, eventName, data);
      await triggerWebhook(eventId, eventName, data);
      await triggerWorkflow(eventId, eventName, data);

      return {
        success: true,
        event_id: eventId,
        event_name: eventName
      };
    } catch (err) {
      console.error("❌ emitEvent hatası:", err.message);

      if (eventId) {
        await run(
          `UPDATE event_bus_events 
           SET status='error', error_message=? 
           WHERE id=?`,
          [err.message, eventId]
        );
      }

      return {
        success: false,
        error: err.message
      };
    }
  };

  app.get("/api/event-bus/events", async (req, res) => {
    try {
      const rows = await all(`
        SELECT *
        FROM event_bus_events
        ORDER BY id DESC
        LIMIT 200
      `);

      res.json({
        success: true,
        data: rows
      });
    } catch (err) {
      res.status(500).json({
        success: false,
        error: err.message
      });
    }
  });

  app.get("/api/event-bus/logs/:eventId", async (req, res) => {
    try {
      const rows = await all(
        `SELECT * FROM event_bus_logs WHERE event_id=? ORDER BY id ASC`,
        [req.params.eventId]
      );

      res.json({
        success: true,
        data: rows
      });
    } catch (err) {
      res.status(500).json({
        success: false,
        error: err.message
      });
    }
  });

  app.get("/api/event-bus/stats", async (req, res) => {
    try {
      const total = await get(`SELECT COUNT(*) AS count FROM event_bus_events`);
      const today = await get(`
        SELECT COUNT(*) AS count 
        FROM event_bus_events 
        WHERE DATE(created_at) = DATE('now')
      `);
      const failed = await get(`
        SELECT COUNT(*) AS count 
        FROM event_bus_events 
        WHERE status='error'
      `);
      const lastEvent = await get(`
        SELECT event_name, created_at 
        FROM event_bus_events 
        ORDER BY id DESC 
        LIMIT 1
      `);

      res.json({
        success: true,
        data: {
          total: total?.count || 0,
          today: today?.count || 0,
          failed: failed?.count || 0,
          last_event: lastEvent || null
        }
      });
    } catch (err) {
      res.status(500).json({
        success: false,
        error: err.message
      });
    }
  });

app.post("/api/event-bus/emit", async (req, res) => {
  try {
    const body = req.body || {};

    const eventName =
      body.event_name ||
      body.eventName ||
      body.name ||
      "system.manual";

    const payload =
      body.payload ||
      body.data ||
      {
        module_name: body.module_name || body.module || "Event Center",
        entity_type: body.entity_type || "manual",
        entity_id: body.entity_id || null,
        message: body.message || "Manuel event tetiklendi",
        created_by: body.created_by || req.headers["x-user-name"] || "system"
      };

    const result = await ctx.emitEvent(eventName, payload);

    res.json(result);
  } catch (err) {
    res.status(500).json({
      success: false,
      message: "Event gönderilemedi",
      error: err.message
    });
  }
});

  app.post("/api/event-bus/test", async (req, res) => {
    try {
      const result = await ctx.emitEvent("system.test", {
        module_name: "Event Center",
        entity_type: "system",
        entity_id: "test",
        message: "Event Bus test olayı tetiklendi",
        created_by: "admin"
      });

      res.json(result);
    } catch (err) {
      res.status(500).json({
        success: false,
        error: err.message
      });
    }
  });

  console.log("✅ Event Bus aktif: ctx.emitEvent(eventName, data)");
};