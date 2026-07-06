// routes/01-yetki-roller.js

module.exports = function register(app, ctx) {
  const db = ctx.db;

  function onlySuperAdmin(req, res, next) {
    const role = req.headers["x-user-role"];

    if (role !== "superadmin") {
      return res.status(403).json({
        success: false,
        message: "Bu işlem için Süper Admin yetkisi gerekir."
      });
    }

    next();
  }

  // ======================
  // TABLOLAR
  // ======================

  db.run(`
    CREATE TABLE IF NOT EXISTS roles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      role_key TEXT NOT NULL UNIQUE,
      role_name TEXT NOT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS pages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      page_key TEXT NOT NULL UNIQUE,
      page_name TEXT NOT NULL,
      page_url TEXT NOT NULL UNIQUE,
      module_group TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS role_permissions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      role_id INTEGER NOT NULL,
      page_id INTEGER NOT NULL,
      can_access INTEGER DEFAULT 1,
      UNIQUE(role_id, page_id)
    )
  `);

  // users tablosunda role yoksa ekle
  db.run(`ALTER TABLE users ADD COLUMN role TEXT DEFAULT 'user'`, (err) => {
    if (err && !err.message.includes("duplicate column name")) {
      console.log("users.role kolon uyarısı:", err.message);
    }
  });

  // Default roller
  db.run(`
    INSERT OR IGNORE INTO roles (role_key, role_name)
    VALUES 
      ('superadmin', 'Süper Admin'),
      ('admin', 'Admin'),
      ('user', 'Kullanıcı')
  `);

  // ======================
  // SAYFA YETKİ KONTROL
  // ======================

 app.get("/api/auth/can-access", (req, res) => {
  let { roleKey, pageUrl } = req.query;

  roleKey = String(roleKey || "")
    .trim()
    .toLowerCase()
    .replace("yönetici", "admin")
    .replace("yonetici", "admin")
    .replace("süper admin", "superadmin")
    .replace("super admin", "superadmin");

  if (!roleKey || !pageUrl) {
    return res.status(400).json({
      success: false,
      canAccess: false,
      message: "Rol ve sayfa bilgisi zorunludur."
    });
  }

  if (roleKey === "superadmin") {
    return res.json({
      success: true,
      canAccess: true
    });
  }

  const cleanPageUrl = String(pageUrl).startsWith("/")
    ? String(pageUrl)
    : "/" + String(pageUrl);

  const plainPageUrl = cleanPageUrl.replace("/", "");

  db.get(`
    SELECT rp.id
    FROM roles r
    INNER JOIN role_permissions rp
      ON rp.role_id = r.id
    INNER JOIN pages p
      ON p.id = rp.page_id
    WHERE LOWER(r.role_key) = ?
      AND (
        p.page_url = ?
        OR p.page_url = ?
      )
      AND rp.can_access = 1
  `,
  [roleKey, cleanPageUrl, plainPageUrl],
  (err, row) => {
    if (err) {
      return res.status(500).json({
        success: false,
        canAccess: false,
        message: err.message
      });
    }

    return res.json({
      success: true,
      canAccess: !!row
    });
  });
});

  // ======================
  // ROLLER
  // ======================

  app.get("/api/admin/roles", onlySuperAdmin, (req, res) => {
    db.all(`
      SELECT 
        id,
        role_key,
        role_name,
        created_at
      FROM roles
      ORDER BY id ASC
    `, [], (err, rows) => {
      if (err) {
        return res.status(500).json({
          success: false,
          message: err.message,
          roles: []
        });
      }

      res.json({
        success: true,
        roles: rows || []
      });
    });
  });

  app.post("/api/admin/roles", onlySuperAdmin, (req, res) => {
    let { roleKey, roleName } = req.body;

    roleKey = String(roleKey || "")
      .trim()
      .toLowerCase()
      .replace(/\s+/g, "_");

    roleName = String(roleName || "").trim();

    if (!roleKey || !roleName) {
      return res.status(400).json({
        success: false,
        message: "Rol kodu ve rol adı zorunludur."
      });
    }

    db.run(`
      INSERT INTO roles (role_key, role_name)
      VALUES (?, ?)
    `,
    [roleKey, roleName],
    function(err) {
      if (err) {
        if (err.message.includes("UNIQUE")) {
          return res.status(400).json({
            success: false,
            message: "Bu rol kodu zaten var."
          });
        }

        return res.status(500).json({
          success: false,
          message: err.message
        });
      }

      res.json({
        success: true,
        id: this.lastID,
        message: "Rol oluşturuldu."
      });
    });
  });

  app.delete("/api/admin/roles/:roleId", onlySuperAdmin, (req, res) => {
    const roleId = req.params.roleId;

    db.get(`SELECT * FROM roles WHERE id = ?`, [roleId], (err, role) => {
      if (err) {
        return res.status(500).json({ success: false, message: err.message });
      }

      if (!role) {
        return res.status(404).json({ success: false, message: "Rol bulunamadı." });
      }

      if (["superadmin", "admin", "user"].includes(role.role_key)) {
        return res.status(400).json({
          success: false,
          message: "Sistem rolleri silinemez."
        });
      }

      db.serialize(() => {
        db.run(`DELETE FROM role_permissions WHERE role_id = ?`, [roleId]);
        db.run(`DELETE FROM roles WHERE id = ?`, [roleId], function(deleteErr) {
          if (deleteErr) {
            return res.status(500).json({
              success: false,
              message: deleteErr.message
            });
          }

          res.json({
            success: true,
            message: "Rol silindi."
          });
        });
      });
    });
  });

  // ======================
  // SAYFALAR
  // ======================

  app.get("/api/admin/pages", onlySuperAdmin, (req, res) => {
    db.all(`
      SELECT *
      FROM pages
      ORDER BY module_group, page_name
    `, [], (err, rows) => {
      if (err) {
        return res.status(500).json({
          success: false,
          message: err.message,
          pages: []
        });
      }

      res.json({
        success: true,
        pages: rows || []
      });
    });
  });

  // Frontend DEFAULT_PAGES'i DB'ye basar
  app.post("/api/admin/pages/sync", onlySuperAdmin, (req, res) => {
    const { pages } = req.body;

    if (!Array.isArray(pages)) {
      return res.status(400).json({
        success: false,
        message: "pages array gönderilmelidir."
      });
    }

    const stmt = db.prepare(`
      INSERT INTO pages 
      (page_key, page_name, page_url, module_group)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(page_key)
      DO UPDATE SET
        page_name = excluded.page_name,
        page_url = excluded.page_url,
        module_group = excluded.module_group
    `);

    pages.forEach(page => {
      const cleanUrl = String(page.pageUrl || "").replace(/^\//, "");

      stmt.run([
        page.pageKey,
        page.pageName,
        cleanUrl,
        page.moduleGroup
      ]);
    });

    stmt.finalize(err => {
      if (err) {
        return res.status(500).json({
          success: false,
          message: err.message
        });
      }

      res.json({
        success: true,
        message: "Sayfalar senkronize edildi."
      });
    });
  });

  // ======================
  // ROL YETKİLERİ
  // ======================

  app.get("/api/admin/roles/:roleId/permissions", onlySuperAdmin, (req, res) => {
    db.all(`
      SELECT
        p.id AS pageId,
        p.page_key AS pageKey,
        p.page_name AS pageName,
        p.page_url AS pageUrl,
        p.module_group AS moduleGroup,
        COALESCE(rp.can_access, 0) AS canAccess
      FROM pages p
      LEFT JOIN role_permissions rp
        ON rp.page_id = p.id
        AND rp.role_id = ?
      ORDER BY p.module_group, p.page_name
    `,
    [req.params.roleId],
    (err, rows) => {
      if (err) {
        return res.status(500).json({
          success: false,
          message: err.message,
          permissions: []
        });
      }

      res.json({
        success: true,
        permissions: rows || []
      });
    });
  });

  app.post("/api/admin/roles/:roleId/permissions", onlySuperAdmin, (req, res) => {
    const roleId = req.params.roleId;
    const { permissions } = req.body;

    if (!Array.isArray(permissions)) {
      return res.status(400).json({
        success: false,
        message: "permissions array gönderilmelidir."
      });
    }

    db.serialize(() => {
      db.run(`DELETE FROM role_permissions WHERE role_id = ?`, [roleId]);

      const pageStmt = db.prepare(`
        INSERT INTO pages
        (page_key, page_name, page_url, module_group)
        VALUES (?, ?, ?, ?)
        ON CONFLICT(page_key)
        DO UPDATE SET
          page_name = excluded.page_name,
          page_url = excluded.page_url,
          module_group = excluded.module_group
      `);

      permissions.forEach(page => {
        const cleanUrl = String(page.pageUrl || "").replace(/^\//, "");

        pageStmt.run([
          page.pageKey,
          page.pageName,
          cleanUrl,
          page.moduleGroup
        ]);
      });

      pageStmt.finalize(err => {
        if (err) {
          return res.status(500).json({
            success: false,
            message: err.message
          });
        }

        const keys = permissions.map(p => p.pageKey);

        if (!keys.length) {
          return res.json({
            success: true,
            message: "Rol yetkileri temizlendi."
          });
        }

        const placeholders = keys.map(() => "?").join(",");

        db.all(`
          SELECT id, page_key
          FROM pages
          WHERE page_key IN (${placeholders})
        `, keys, (selectErr, pages) => {
          if (selectErr) {
            return res.status(500).json({
              success: false,
              message: selectErr.message
            });
          }

          const permStmt = db.prepare(`
            INSERT OR REPLACE INTO role_permissions
            (role_id, page_id, can_access)
            VALUES (?, ?, 1)
          `);

          pages.forEach(page => {
            permStmt.run([roleId, page.id]);
          });

          permStmt.finalize(finalErr => {
            if (finalErr) {
              return res.status(500).json({
                success: false,
                message: finalErr.message
              });
            }

            res.json({
              success: true,
              message: "Rol yetkileri güncellendi."
            });
          });
        });
      });
    });
  });

  // ======================
  // KULLANICIYA ROL ATAMA
  // ======================

  app.get("/api/admin/users", onlySuperAdmin, (req, res) => {
    db.all(`
      SELECT
        id,
        username,
        full_name AS fullName,
        email,
        role,
        active
      FROM users
      ORDER BY id DESC
    `, [], (err, rows) => {
      if (err) {
        return res.status(500).json({
          success: false,
          message: err.message,
          users: []
        });
      }

      res.json({
        success: true,
        users: rows || []
      });
    });
  });

  app.put("/api/admin/users/:userId/role", onlySuperAdmin, (req, res) => {
    const { roleKey } = req.body;

    if (!roleKey) {
      return res.status(400).json({
        success: false,
        message: "Rol zorunludur."
      });
    }

    db.get(`SELECT id FROM roles WHERE role_key = ?`, [roleKey], (err, role) => {
      if (err) {
        return res.status(500).json({
          success: false,
          message: err.message
        });
      }

      if (!role) {
        return res.status(404).json({
          success: false,
          message: "Rol bulunamadı."
        });
      }

      db.run(`
        UPDATE users
        SET role = ?
        WHERE id = ?
      `,
      [roleKey, req.params.userId],
      function(updateErr) {
        if (updateErr) {
          return res.status(500).json({
            success: false,
            message: updateErr.message
          });
        }

        res.json({
          success: true,
          message: "Kullanıcı rolü güncellendi."
        });
      });
    });
  });
};