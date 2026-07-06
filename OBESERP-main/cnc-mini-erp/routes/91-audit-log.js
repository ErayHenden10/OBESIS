// routes/90-audit-log.js
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
      id: user.id || req.headers["x-user-id"] || null,
      username:
        user.username ||
        user.full_name ||
        user.fullName ||
        req.headers["x-user-name"] ||
        "Bilinmeyen Kullanıcı",
      role: user.role || req.headers["x-user-role"] || null
    };
  }

  function getIp(req) {
    return (
      req.headers["x-forwarded-for"] ||
      req.socket?.remoteAddress ||
      req.ip ||
      null
    );
  }

  function safeJson(data) {
    if (data === undefined || data === null) return null;

    try {
      return JSON.stringify(data);
    } catch {
      return String(data);
    }
  }

  db.serialize(() => {
    db.run(`
      CREATE TABLE IF NOT EXISTS audit_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER,
        username TEXT,
        role TEXT,
        module_key TEXT,
        action_key TEXT,
        record_id TEXT,
        method TEXT,
        url TEXT,
        ip_address TEXT,
        old_data TEXT,
        new_data TEXT,
        description TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `);
  });

  ctx.auditLog = async function (req, options = {}) {
    try {
      const user = getUser(req);

      await run(
        `
        INSERT INTO audit_logs (
          user_id,
          username,
          role,
          module_key,
          action_key,
          record_id,
          method,
          url,
          ip_address,
          old_data,
          new_data,
          description
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
        [
          user.id,
          user.username,
          user.role,
          options.module || options.module_key || null,
          options.action || options.action_key || null,
          options.recordId || options.record_id || null,
          req.method || null,
          req.originalUrl || req.url || null,
          getIp(req),
          safeJson(options.oldData),
          safeJson(options.newData),
          options.description || null
        ]
      );
    } catch (err) {
      console.error("Audit log yazılamadı:", err.message);
    }
  };

  ctx.auditMiddleware = function (moduleKey, actionKey) {
    return async function (req, res, next) {
      const oldSend = res.send;

      res.send = function (body) {
        const statusCode = res.statusCode;

        if (statusCode >= 200 && statusCode < 300) {
          ctx.auditLog(req, {
            module: moduleKey,
            action: actionKey,
            recordId: req.params?.id || req.body?.id || null,
            oldData: null,
            newData: req.body || null,
            description: `${moduleKey} modülünde ${actionKey} işlemi yapıldı.`
          });
        }

        return oldSend.call(this, body);
      };

      next();
    };
  };

  app.get("/api/audit-logs", async (req, res) => {
    try {
      const limit = Number(req.query.limit || 100);
      const moduleKey = req.query.module || "";
      const username = req.query.username || "";

      let sql = `
        SELECT *
        FROM audit_logs
        WHERE 1 = 1
      `;

      const params = [];

      if (moduleKey) {
        sql += ` AND module_key = ?`;
        params.push(moduleKey);
      }

      if (username) {
        sql += ` AND username LIKE ?`;
        params.push(`%${username}%`);
      }

      sql += `
        ORDER BY id DESC
        LIMIT ?
      `;

      params.push(limit);

      const rows = await all(sql, params);

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

  app.delete("/api/audit-logs/clear", async (req, res) => {
    try {
      await run(`DELETE FROM audit_logs`);

      res.json({
        success: true,
        message: "Audit log kayıtları temizlendi."
      });
    } catch (err) {
      res.status(500).json({
        success: false,
        message: err.message
      });
    }
  });

  console.log("Audit Log sistemi aktif.");
};