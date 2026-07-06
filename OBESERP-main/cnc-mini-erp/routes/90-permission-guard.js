// routes/89-permission-guard.js
module.exports = function (app, ctx) {
  const db = ctx.db;

  function get(sql, params = []) {
    return new Promise((resolve, reject) => {
      db.get(sql, params, (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
  }

  function normalizeRole(role) {
    return String(role || "")
      .trim()
      .toLowerCase()
      .replace("yönetici", "admin")
      .replace("yonetici", "admin")
      .replace("süper admin", "superadmin")
      .replace("super admin", "superadmin");
  }

  function getRequestUser(req) {
    const sessionUser = req.session?.user || req.user || null;

    if (sessionUser) {
      return {
        id: sessionUser.id,
        username: sessionUser.username,
        role: normalizeRole(sessionUser.role || sessionUser.role_key)
      };
    }

    return {
      id: req.headers["x-user-id"] || null,
      username: req.headers["x-user-name"] || null,
      role: normalizeRole(req.headers["x-user-role"])
    };
  }

  async function checkPermission(user, moduleKey, permissionKey) {
    if (!user) return false;

    const roleName = normalizeRole(user.role);

    if (roleName === "superadmin") return true;

    if (user.id) {
      const userPerm = await get(
        `
        SELECT up.allowed
        FROM user_permissions up
        JOIN permissions p ON p.id = up.permission_id
        WHERE up.user_id = ?
          AND p.module_key = ?
          AND p.permission_key = ?
        `,
        [user.id, moduleKey, permissionKey]
      );

      if (userPerm) {
        return Number(userPerm.allowed) === 1;
      }
    }

    const rolePerm = await get(
      `
      SELECT rp.allowed
      FROM role_permissions rp
      JOIN permissions p ON p.id = rp.permission_id
      WHERE LOWER(rp.role_name) = ?
        AND p.module_key = ?
        AND p.permission_key = ?
      `,
      [roleName, moduleKey, permissionKey]
    );

    return !!rolePerm && Number(rolePerm.allowed) === 1;
  }

  ctx.can = checkPermission;

  ctx.requirePermission = function (moduleKey, permissionKey) {
    return async function (req, res, next) {
      try {
        const user = getRequestUser(req);
        const allowed = await checkPermission(user, moduleKey, permissionKey);

        if (!allowed) {
          return res.status(403).json({
            success: false,
            code: "PERMISSION_DENIED",
            module: moduleKey,
            permission: permissionKey,
            message: "Bu işlem için yetkiniz yok."
          });
        }

        next();
      } catch (err) {
        console.error("Permission guard error:", err);
        res.status(500).json({
          success: false,
          message: "Yetki kontrolü sırasında hata oluştu."
        });
      }
    };
  };

  app.get("/api/auth/can", async (req, res) => {
    try {
      const user = getRequestUser(req);
      const moduleKey = req.query.module;
      const permissionKey = req.query.permission;

      if (!moduleKey || !permissionKey) {
        return res.status(400).json({
          success: false,
          message: "module ve permission zorunludur."
        });
      }

      const allowed = await checkPermission(user, moduleKey, permissionKey);

      res.json({
        success: true,
        allowed
      });
    } catch (err) {
      res.status(500).json({
        success: false,
        message: err.message
      });
    }
  });

  app.post("/api/auth/can-bulk", async (req, res) => {
    try {
      const user = getRequestUser(req);
      const items = req.body.items || [];

      const result = {};

      for (const item of items) {
        const moduleKey = item.module;
        const permissionKey = item.permission;
        const key = `${moduleKey}.${permissionKey}`;

        result[key] = await checkPermission(user, moduleKey, permissionKey);
      }

      res.json({
        success: true,
        permissions: result
      });
    } catch (err) {
      res.status(500).json({
        success: false,
        message: err.message
      });
    }
  });

  console.log("Permission Guard aktif.");
};