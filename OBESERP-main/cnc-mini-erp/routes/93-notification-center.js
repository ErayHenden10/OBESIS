// routes/93-notification-center.js
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
      role: String(user.role || req.headers["x-user-role"] || "").toLowerCase()
    };
  }

  db.serialize(() => {
    db.run(`
      CREATE TABLE IF NOT EXISTS notifications (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER,
        role_key TEXT,
        title TEXT NOT NULL,
        message TEXT,
        module_key TEXT,
        notification_type TEXT DEFAULT 'info',
        url TEXT,
        record_id TEXT,
        is_read INTEGER DEFAULT 0,
        created_by INTEGER,
        created_by_name TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        read_at TEXT
      )
    `);

    // notifications tablosu daha önce (74-bildirim-ekle.js tarafından) eksik
    // sütunlarla oluşturulmuş olabilir; burada eksik olanları ekliyoruz.
    const notificationColumns = [
      "user_id INTEGER",
      "role_key TEXT",
      "module_key TEXT",
      "notification_type TEXT DEFAULT 'info'",
      "url TEXT",
      "record_id TEXT",
      "created_by_name TEXT",
      "read_at TEXT"
    ];

    notificationColumns.forEach((colDef) => {
      db.run(`ALTER TABLE notifications ADD COLUMN ${colDef}`, (err) => {
        if (err && !err.message.includes("duplicate column name")) {
          console.log("notifications kolon ekleme uyarısı:", err.message);
        }
      });
    });
  });

  ctx.createNotification = async function (options = {}) {
    try {
      const inserted = await run(
        `
        INSERT INTO notifications (
          user_id,
          role_key,
          title,
          message,
          module_key,
          notification_type,
          url,
          record_id,
          created_by,
          created_by_name
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
        [
          options.userId || options.user_id || null,
          options.role || options.roleKey || options.role_key || null,
          options.title || "Bildirim",
          options.message || null,
          options.module || options.moduleKey || options.module_key || null,
          options.type || options.notificationType || options.notification_type || "info",
          options.url || null,
          options.recordId || options.record_id || null,
          options.createdBy || options.created_by || null,
          options.createdByName || options.created_by_name || null
        ]
      );

      return {
        success: true,
        id: inserted.lastID
      };
    } catch (err) {
      console.error("Bildirim oluşturulamadı:", err.message);
      return {
        success: false,
        message: err.message
      };
    }
  };

  ctx.createNotificationFromReq = async function (req, options = {}) {
    const user = getUser(req);

    return ctx.createNotification({
      ...options,
      createdBy: user.id,
      createdByName: user.username
    });
  };

  app.post("/api/notifications", async (req, res) => {
    try {
      const result = await ctx.createNotificationFromReq(req, req.body);

      if (!result.success) {
        return res.status(500).json(result);
      }

      res.json({
        success: true,
        id: result.id,
        message: "Bildirim oluşturuldu."
      });
    } catch (err) {
      res.status(500).json({
        success: false,
        message: err.message
      });
    }
  });

  app.get("/api/notifications", async (req, res) => {
    try {
      const user = getUser(req);
      const limit = Number(req.query.limit || 50);
      const unreadOnly = String(req.query.unreadOnly || "0") === "1";

      let sql = `
        SELECT *
        FROM notifications
        WHERE 1 = 1
          AND (
            user_id = ?
            OR LOWER(role_key) = ?
            OR (user_id IS NULL AND role_key IS NULL)
          )
      `;

      const params = [user.id, user.role];

      if (unreadOnly) {
        sql += ` AND is_read = 0`;
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

  app.get("/api/notifications/count", async (req, res) => {
    try {
      const user = getUser(req);

      const rows = await all(
        `
        SELECT COUNT(*) AS unread_count
        FROM notifications
        WHERE is_read = 0
          AND (
            user_id = ?
            OR LOWER(role_key) = ?
            OR (user_id IS NULL AND role_key IS NULL)
          )
        `,
        [user.id, user.role]
      );

      res.json({
        success: true,
        unreadCount: rows[0]?.unread_count || 0
      });
    } catch (err) {
      res.status(500).json({
        success: false,
        message: err.message
      });
    }
  });

  app.put("/api/notifications/:id/read", async (req, res) => {
    try {
      await run(
        `
        UPDATE notifications
        SET is_read = 1,
            read_at = CURRENT_TIMESTAMP
        WHERE id = ?
        `,
        [req.params.id]
      );

      res.json({
        success: true,
        message: "Bildirim okundu yapıldı."
      });
    } catch (err) {
      res.status(500).json({
        success: false,
        message: err.message
      });
    }
  });

  app.put("/api/notifications/read-all", async (req, res) => {
    try {
      const user = getUser(req);

      await run(
        `
        UPDATE notifications
        SET is_read = 1,
            read_at = CURRENT_TIMESTAMP
        WHERE is_read = 0
          AND (
            user_id = ?
            OR LOWER(role_key) = ?
            OR (user_id IS NULL AND role_key IS NULL)
          )
        `,
        [user.id, user.role]
      );

      res.json({
        success: true,
        message: "Tüm bildirimler okundu yapıldı."
      });
    } catch (err) {
      res.status(500).json({
        success: false,
        message: err.message
      });
    }
  });

  app.delete("/api/notifications/:id", async (req, res) => {
    try {
      await run(`DELETE FROM notifications WHERE id = ?`, [req.params.id]);

      res.json({
        success: true,
        message: "Bildirim silindi."
      });
    } catch (err) {
      res.status(500).json({
        success: false,
        message: err.message
      });
    }
  });

  console.log("Notification Center 2.0 aktif.");
};