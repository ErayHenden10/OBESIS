// routes/98-api-webhook-manager.js
module.exports = function (app, ctx) {
  const http = require("http");
  const https = require("https");

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
        "Sistem",
      role: String(user.role || req.headers["x-user-role"] || "").toLowerCase()
    };
  }

  function normalizeKey(value) {
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

  function safeJson(value, fallback = {}) {
    try {
      if (!value) return fallback;
      if (typeof value === "object") return value;
      return JSON.parse(value);
    } catch {
      return fallback;
    }
  }

  function requestPost(url, payload, headers = {}, timeoutMs = 10000) {
    return new Promise((resolve, reject) => {
      const parsedUrl = new URL(url);
      const isHttps = parsedUrl.protocol === "https:";
      const body = JSON.stringify(payload || {});

      const options = {
        hostname: parsedUrl.hostname,
        port: parsedUrl.port || (isHttps ? 443 : 80),
        path: parsedUrl.pathname + parsedUrl.search,
        method: "POST",
        timeout: timeoutMs,
        headers: {
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(body),
          ...headers
        }
      };

      const client = isHttps ? https : http;

      const req = client.request(options, res => {
        let responseBody = "";

        res.on("data", chunk => {
          responseBody += chunk;
        });

        res.on("end", () => {
          resolve({
            statusCode: res.statusCode,
            headers: res.headers,
            body: responseBody
          });
        });
      });

      req.on("timeout", () => {
        req.destroy(new Error("Webhook timeout."));
      });

      req.on("error", err => {
        reject(err);
      });

      req.write(body);
      req.end();
    });
  }

  db.serialize(() => {
    db.run(`
      CREATE TABLE IF NOT EXISTS webhook_endpoints (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        webhook_key TEXT UNIQUE NOT NULL,
        webhook_name TEXT NOT NULL,
        event_key TEXT NOT NULL,
        target_url TEXT NOT NULL,
        method TEXT DEFAULT 'POST',
        headers_json TEXT,
        secret_token TEXT,
        active INTEGER DEFAULT 1,
        retry_count INTEGER DEFAULT 0,
        timeout_ms INTEGER DEFAULT 10000,
        description TEXT,
        created_by INTEGER,
        created_by_name TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT
      )
    `);

    db.run(`
      CREATE TABLE IF NOT EXISTS webhook_delivery_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        webhook_id INTEGER,
        webhook_key TEXT,
        webhook_name TEXT,
        event_key TEXT,
        target_url TEXT,
        status TEXT,
        http_status INTEGER,
        request_payload TEXT,
        response_body TEXT,
        error_message TEXT,
        duration_ms INTEGER,
        delivered_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `);

    db.run(`
      CREATE TABLE IF NOT EXISTS api_tokens (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        token_name TEXT NOT NULL,
        token_value TEXT UNIQUE NOT NULL,
        active INTEGER DEFAULT 1,
        description TEXT,
        created_by INTEGER,
        created_by_name TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        last_used_at TEXT
      )
    `);
  });

  async function logDelivery(options = {}) {
    await run(
      `
      INSERT INTO webhook_delivery_logs (
        webhook_id,
        webhook_key,
        webhook_name,
        event_key,
        target_url,
        status,
        http_status,
        request_payload,
        response_body,
        error_message,
        duration_ms
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        options.webhookId || null,
        options.webhookKey || null,
        options.webhookName || null,
        options.eventKey || null,
        options.targetUrl || null,
        options.status || null,
        options.httpStatus || null,
        JSON.stringify(options.requestPayload || {}),
        options.responseBody || null,
        options.errorMessage || null,
        options.durationMs || 0
      ]
    );
  }

  async function deliverWebhook(webhook, payload) {
    const startedAt = Date.now();

    const headers = safeJson(webhook.headers_json, {});

    if (webhook.secret_token) {
      headers["X-ERP-Webhook-Token"] = webhook.secret_token;
    }

    try {
      const response = await requestPost(
        webhook.target_url,
        payload,
        headers,
        Number(webhook.timeout_ms || 10000)
      );

      const durationMs = Date.now() - startedAt;
      const ok = response.statusCode >= 200 && response.statusCode < 300;

      await logDelivery({
        webhookId: webhook.id,
        webhookKey: webhook.webhook_key,
        webhookName: webhook.webhook_name,
        eventKey: webhook.event_key,
        targetUrl: webhook.target_url,
        status: ok ? "SUCCESS" : "ERROR",
        httpStatus: response.statusCode,
        requestPayload: payload,
        responseBody: response.body,
        errorMessage: ok ? null : `HTTP ${response.statusCode}`,
        durationMs
      });

      return {
        success: ok,
        statusCode: response.statusCode,
        body: response.body,
        durationMs
      };
    } catch (err) {
      const durationMs = Date.now() - startedAt;

      await logDelivery({
        webhookId: webhook.id,
        webhookKey: webhook.webhook_key,
        webhookName: webhook.webhook_name,
        eventKey: webhook.event_key,
        targetUrl: webhook.target_url,
        status: "ERROR",
        httpStatus: null,
        requestPayload: payload,
        responseBody: null,
        errorMessage: err.message,
        durationMs
      });

      return {
        success: false,
        message: err.message,
        durationMs
      };
    }
  }

  async function emitEvent(eventKey, data = {}, meta = {}) {
    const hooks = await all(
      `
      SELECT *
      FROM webhook_endpoints
      WHERE active = 1
        AND event_key = ?
      ORDER BY id ASC
      `,
      [eventKey]
    );

    const eventPayload = {
      event: eventKey,
      source: "CNC_MINI_ERP",
      timestamp: new Date().toISOString(),
      meta,
      data
    };

    const results = [];

    for (const hook of hooks) {
      const result = await deliverWebhook(hook, eventPayload);
      results.push({
        webhookId: hook.id,
        webhookKey: hook.webhook_key,
        webhookName: hook.webhook_name,
        ...result
      });
    }

    return {
      success: true,
      eventKey,
      deliveredCount: results.filter(x => x.success).length,
      totalCount: results.length,
      results
    };
  }

  ctx.emitWebhookEvent = emitEvent;

  app.get("/api/webhooks", async (req, res) => {
    try {
      const rows = await all(`
        SELECT *
        FROM webhook_endpoints
        ORDER BY id DESC
      `);

      res.json({
        success: true,
        data: rows.map(r => ({
          ...r,
          headers: safeJson(r.headers_json)
        }))
      });
    } catch (err) {
      res.status(500).json({
        success: false,
        message: err.message
      });
    }
  });

  app.post("/api/webhooks", async (req, res) => {
    try {
      const user = getUser(req);
      const body = req.body || {};
      const webhookKey = normalizeKey(body.webhookKey || body.webhookName);

      if (!webhookKey) {
        return res.status(400).json({
          success: false,
          message: "Webhook key üretilemedi."
        });
      }

      if (!body.targetUrl) {
        return res.status(400).json({
          success: false,
          message: "Target URL zorunludur."
        });
      }

      const inserted = await run(
        `
        INSERT INTO webhook_endpoints (
          webhook_key,
          webhook_name,
          event_key,
          target_url,
          method,
          headers_json,
          secret_token,
          active,
          retry_count,
          timeout_ms,
          description,
          created_by,
          created_by_name,
          updated_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
        `,
        [
          webhookKey,
          body.webhookName,
          body.eventKey,
          body.targetUrl,
          "POST",
          JSON.stringify(body.headers || {}),
          body.secretToken || null,
          body.active === false ? 0 : 1,
          Number(body.retryCount || 0),
          Number(body.timeoutMs || 10000),
          body.description || null,
          user.id,
          user.username
        ]
      );

      if (ctx.auditLog) {
        await ctx.auditLog(req, {
          module: "webhook",
          action: "create",
          recordId: inserted.lastID,
          newData: body,
          description: "Webhook endpoint oluşturuldu."
        });
      }

      res.json({
        success: true,
        id: inserted.lastID,
        message: "Webhook oluşturuldu."
      });
    } catch (err) {
      res.status(500).json({
        success: false,
        message: err.message
      });
    }
  });

  app.put("/api/webhooks/:id", async (req, res) => {
    try {
      const body = req.body || {};

      await run(
        `
        UPDATE webhook_endpoints
        SET webhook_name = ?,
            event_key = ?,
            target_url = ?,
            headers_json = ?,
            secret_token = ?,
            active = ?,
            retry_count = ?,
            timeout_ms = ?,
            description = ?,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
        `,
        [
          body.webhookName,
          body.eventKey,
          body.targetUrl,
          JSON.stringify(body.headers || {}),
          body.secretToken || null,
          body.active === false ? 0 : 1,
          Number(body.retryCount || 0),
          Number(body.timeoutMs || 10000),
          body.description || null,
          req.params.id
        ]
      );

      if (ctx.auditLog) {
        await ctx.auditLog(req, {
          module: "webhook",
          action: "update",
          recordId: req.params.id,
          newData: body,
          description: "Webhook endpoint güncellendi."
        });
      }

      res.json({
        success: true,
        message: "Webhook güncellendi."
      });
    } catch (err) {
      res.status(500).json({
        success: false,
        message: err.message
      });
    }
  });

  app.delete("/api/webhooks/:id", async (req, res) => {
    try {
      const oldData = await get(
        `SELECT * FROM webhook_endpoints WHERE id = ?`,
        [req.params.id]
      );

      await run(
        `DELETE FROM webhook_endpoints WHERE id = ?`,
        [req.params.id]
      );

      if (ctx.auditLog) {
        await ctx.auditLog(req, {
          module: "webhook",
          action: "delete",
          recordId: req.params.id,
          oldData,
          description: "Webhook endpoint silindi."
        });
      }

      res.json({
        success: true,
        message: "Webhook silindi."
      });
    } catch (err) {
      res.status(500).json({
        success: false,
        message: err.message
      });
    }
  });

  app.post("/api/webhooks/:id/test", async (req, res) => {
    try {
      const hook = await get(
        `SELECT * FROM webhook_endpoints WHERE id = ?`,
        [req.params.id]
      );

      if (!hook) {
        return res.status(404).json({
          success: false,
          message: "Webhook bulunamadı."
        });
      }

      const payload = {
        event: hook.event_key,
        source: "CNC_MINI_ERP",
        timestamp: new Date().toISOString(),
        test: true,
        data: req.body?.data || {
          message: "Bu bir test webhook gönderimidir."
        }
      };

      const result = await deliverWebhook(hook, payload);

      res.json({
        success: result.success,
        message: result.success ? "Test webhook gönderildi." : result.message,
        result
      });
    } catch (err) {
      res.status(500).json({
        success: false,
        message: err.message
      });
    }
  });

  app.post("/api/webhooks/emit", async (req, res) => {
    try {
      const body = req.body || {};

      if (!body.eventKey) {
        return res.status(400).json({
          success: false,
          message: "eventKey zorunludur."
        });
      }

      const result = await emitEvent(
        body.eventKey,
        body.data || {},
        {
          manual: true,
          user: getUser(req)
        }
      );

      res.json(result);
    } catch (err) {
      res.status(500).json({
        success: false,
        message: err.message
      });
    }
  });

  app.get("/api/webhooks/logs", async (req, res) => {
    try {
      const rows = await all(`
        SELECT *
        FROM webhook_delivery_logs
        ORDER BY id DESC
        LIMIT 300
      `);

      res.json({
        success: true,
        data: rows.map(r => ({
          ...r,
          requestPayload: safeJson(r.request_payload)
        }))
      });
    } catch (err) {
      res.status(500).json({
        success: false,
        message: err.message
      });
    }
  });

  app.post("/api/tokens", async (req, res) => {
    try {
      const user = getUser(req);
      const body = req.body || {};

      const tokenValue =
        body.tokenValue ||
        `erp_${Date.now()}_${Math.random().toString(36).slice(2, 18)}`;

      const inserted = await run(
        `
        INSERT INTO api_tokens (
          token_name,
          token_value,
          active,
          description,
          created_by,
          created_by_name
        )
        VALUES (?, ?, ?, ?, ?, ?)
        `,
        [
          body.tokenName || "API Token",
          tokenValue,
          body.active === false ? 0 : 1,
          body.description || null,
          user.id,
          user.username
        ]
      );

      res.json({
        success: true,
        id: inserted.lastID,
        tokenValue,
        message: "API token oluşturuldu."
      });
    } catch (err) {
      res.status(500).json({
        success: false,
        message: err.message
      });
    }
  });

  app.get("/api/tokens", async (req, res) => {
    try {
      const rows = await all(`
        SELECT
          id,
          token_name,
          active,
          description,
          created_by,
          created_by_name,
          created_at,
          last_used_at,
          substr(token_value, 1, 8) || '********' AS masked_token
        FROM api_tokens
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

  console.log("API Manager / Webhook Sistemi aktif.");
};