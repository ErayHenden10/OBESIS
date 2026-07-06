// KULLANICILAR API
module.exports = function register(app, ctx) {
  var db = ctx.db;
  var onlySuperAdmin = ctx.onlySuperAdmin;

  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL UNIQUE,
      password TEXT NOT NULL,
      full_name TEXT NOT NULL,
      role TEXT DEFAULT 'user',
      active INTEGER DEFAULT 1,
      email TEXT,
      profile_photo TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.run(`ALTER TABLE users ADD COLUMN email TEXT`, (err) => {
    if (err && !err.message.includes("duplicate column name")) {
      console.log("email kolonu ekleme uyarısı:", err.message);
    }
  });

  db.run(`ALTER TABLE users ADD COLUMN active INTEGER DEFAULT 1`, (err) => {
    if (err && !err.message.includes("duplicate column name")) {
      console.log("active kolonu ekleme uyarısı:", err.message);
    }
  });

  db.run(`ALTER TABLE users ADD COLUMN profile_photo TEXT`, (err) => {
    if (err && !err.message.includes("duplicate column name")) {
      console.log("profile_photo kolonu ekleme uyarısı:", err.message);
    }
  });

  app.get("/api/users", (req, res) => {
    db.all(`
      SELECT
        id,
        username,
        full_name AS fullName,
        role,
        active,
        email,
        profile_photo AS profilePhoto
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

  app.post("/api/users", (req, res) => {
    const {
      username,
      password,
      fullName,
      role,
      active,
      email,
      profilePhoto
    } = req.body;

    if (!username || !password || !fullName) {
      return res.status(400).json({
        success: false,
        message: "Ad soyad, kullanıcı adı ve şifre zorunludur."
      });
    }

    db.run(`
      INSERT INTO users
      (
        username,
        password,
        full_name,
        role,
        active,
        email,
        profile_photo
      )
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `,
    [
      username,
      password,
      fullName,
      role || "Kullanıcı",
      active ?? 1,
      email || "",
      profilePhoto || ""
    ],
    function(err) {
      if (err) {
        return res.status(500).json({
          success: false,
          message: err.message
        });
      }

      res.json({
        success: true,
        id: this.lastID
      });
    });
  });

  app.get("/api/users/:id", (req, res) => {
    db.get(`
      SELECT
        id,
        username,
        password,
        full_name AS fullName,
        role,
        active,
        email,
        profile_photo AS profilePhoto
      FROM users
      WHERE id = ?
    `, [req.params.id], (err, row) => {
      if (err) {
        return res.status(500).json({
          success: false,
          message: err.message
        });
      }

      res.json({
        success: true,
        user: row
      });
    });
  });

  app.put("/api/users/:id", (req, res) => {
    const {
      username,
      password,
      fullName,
      role,
      active,
      email,
      profilePhoto
    } = req.body;

    if (!username || !fullName) {
      return res.status(400).json({
        success: false,
        message: "Ad soyad ve kullanıcı adı zorunludur."
      });
    }

    db.run(`
      UPDATE users
      SET
        username = ?,
        password = COALESCE(NULLIF(?, ''), password),
        full_name = ?,
        role = ?,
        active = ?,
        email = ?,
        profile_photo = COALESCE(NULLIF(?, ''), profile_photo)
      WHERE id = ?
    `,
    [
      username,
      password || "",
      fullName,
      role || "Kullanıcı",
      active ?? 1,
      email || "",
      profilePhoto || "",
      req.params.id
    ],
    function(err) {
      if (err) {
        return res.status(500).json({
          success: false,
          message: err.message
        });
      }

      res.json({
        success: true
      });
    });
  });

  function addActivityLog(req, data = {}) {
    const userId = req.headers["x-user-id"] || null;
    const userName = req.headers["x-user-name"] || "Bilinmeyen Kullanıcı";
    const roleKey = req.headers["x-user-role"] || "";

    db.run(`
      INSERT INTO activity_logs
      (
        user_id,
        user_name,
        role_key,
        module_name,
        action_type,
        description,
        record_id,
        ip_address
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `,
    [
      userId,
      userName,
      roleKey,
      data.moduleName || "",
      data.actionType || "",
      data.description || "",
      data.recordId || null,
      req.ip || ""
    ]);
  }

  app.get("/api/activity-logs", onlySuperAdmin, (req, res) => {
    db.all(`
      SELECT *
      FROM activity_logs
      ORDER BY id DESC
      LIMIT 300
    `, [], (err, rows) => {
      if (err) {
        return res.status(500).json({
          success: false,
          message: err.message,
          logs: []
        });
      }

      res.json({
        success: true,
        logs: rows
      });
    });
  });
};