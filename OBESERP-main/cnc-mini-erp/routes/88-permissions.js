// routes/41-calisanlar.js
const path = require("path");
const fs = require("fs");
const multer = require("multer");

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

  async function columnExists(tableName, columnName) {
    const columns = await all(`PRAGMA table_info(${tableName})`);
    return columns.some(c => c.name === columnName);
  }

  async function addColumnIfMissing(tableName, columnName, columnSql) {
    const exists = await columnExists(tableName, columnName);
    if (!exists) {
      await run(`ALTER TABLE ${tableName} ADD COLUMN ${columnSql}`);
      console.log(`${tableName}.${columnName} eklendi`);
    }
  }

  async function initTable() {
    await run(`
      CREATE TABLE IF NOT EXISTS employees (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        full_name TEXT,
        identity_no TEXT,
        phone TEXT,
        department TEXT,
        position TEXT,
        hire_date TEXT,
        salary REAL,
        status TEXT DEFAULT 'Aktif',
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await addColumnIfMissing("employees", "photo", "photo TEXT");
    await addColumnIfMissing("employees", "photo_path", "photo_path TEXT");
    await addColumnIfMissing("employees", "photo_url", "photo_url TEXT");
  }

  initTable().catch(err => {
    console.error("Çalışanlar tablo hazırlama hatası:", err.message);
  });

  const uploadDir = path.join(__dirname, "..", "public", "uploads", "employees");

  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
  }

  const storage = multer.diskStorage({
    destination: function (req, file, cb) {
      cb(null, uploadDir);
    },
    filename: function (req, file, cb) {
      const ext = path.extname(file.originalname || "").toLowerCase();
      const safeName = `employee_${Date.now()}_${Math.round(Math.random() * 1e9)}${ext}`;
      cb(null, safeName);
    }
  });

  const upload = multer({
    storage,
    limits: {
      fileSize: 5 * 1024 * 1024
    },
    fileFilter: function (req, file, cb) {
      const allowed = ["image/jpeg", "image/jpg", "image/png", "image/webp"];

      if (!allowed.includes(file.mimetype)) {
        return cb(new Error("Sadece JPG, PNG veya WEBP fotoğraf yüklenebilir."));
      }

      cb(null, true);
    }
  });

  function normalizeEmployee(row) {
    if (!row) return row;

    return {
      ...row,
      photo_url:
        row.photo_url ||
        row.photo_path ||
        row.photo ||
        ""
    };
  }

  app.get("/api/employees", async (req, res) => {
    try {
      await initTable();

      const rows = await all(`
        SELECT *
        FROM employees
        ORDER BY id DESC
      `);

      res.json({
        success: true,
        data: rows.map(normalizeEmployee)
      });
    } catch (err) {
      console.error("Çalışan listeleme hatası:", err);
      res.status(500).json({
        success: false,
        message: err.message
      });
    }
  });

  app.get("/api/employees/:id", async (req, res) => {
    try {
      await initTable();

      const row = await get(
        `
        SELECT *
        FROM employees
        WHERE id = ?
        `,
        [req.params.id]
      );

      if (!row) {
        return res.status(404).json({
          success: false,
          message: "Çalışan bulunamadı."
        });
      }

      res.json({
        success: true,
        data: normalizeEmployee(row)
      });
    } catch (err) {
      console.error("Çalışan detay hatası:", err);
      res.status(500).json({
        success: false,
        message: err.message
      });
    }
  });

  app.post("/api/employees", upload.single("photo"), async (req, res) => {
    try {
      await initTable();

      const body = req.body || {};

      const photoUrl = req.file
        ? `/uploads/employees/${req.file.filename}`
        : "";

      const result = await run(
        `
        INSERT INTO employees
        (
          full_name,
          identity_no,
          phone,
          department,
          position,
          hire_date,
          salary,
          status,
          photo,
          photo_path,
          photo_url
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
        [
          body.full_name || "",
          body.identity_no || "",
          body.phone || "",
          body.department || "",
          body.position || "",
          body.hire_date || "",
          body.salary || 0,
          body.status || "Aktif",
          photoUrl,
          photoUrl,
          photoUrl
        ]
      );

      res.json({
        success: true,
        message: "Çalışan başarıyla eklendi.",
        id: result.lastID,
        photo_url: photoUrl
      });
    } catch (err) {
      console.error("Çalışan ekleme hatası:", err);
      res.status(500).json({
        success: false,
        message: err.message
      });
    }
  });

  app.put("/api/employees/:id", upload.single("photo"), async (req, res) => {
    try {
      await initTable();

      const id = req.params.id;
      const body = req.body || {};

      const oldEmployee = await get(
        `
        SELECT *
        FROM employees
        WHERE id = ?
        `,
        [id]
      );

      if (!oldEmployee) {
        return res.status(404).json({
          success: false,
          message: "Çalışan bulunamadı."
        });
      }

      const newPhotoUrl = req.file
        ? `/uploads/employees/${req.file.filename}`
        : (oldEmployee.photo_url || oldEmployee.photo_path || oldEmployee.photo || "");

      await run(
        `
        UPDATE employees
        SET
          full_name = ?,
          identity_no = ?,
          phone = ?,
          department = ?,
          position = ?,
          hire_date = ?,
          salary = ?,
          status = ?,
          photo = ?,
          photo_path = ?,
          photo_url = ?
        WHERE id = ?
        `,
        [
          body.full_name || "",
          body.identity_no || "",
          body.phone || "",
          body.department || "",
          body.position || "",
          body.hire_date || "",
          body.salary || 0,
          body.status || "Aktif",
          newPhotoUrl,
          newPhotoUrl,
          newPhotoUrl,
          id
        ]
      );

      res.json({
        success: true,
        message: "Çalışan başarıyla güncellendi.",
        photo_url: newPhotoUrl
      });
    } catch (err) {
      console.error("Çalışan güncelleme hatası:", err);
      res.status(500).json({
        success: false,
        message: err.message
      });
    }
  });

  app.delete("/api/employees/:id", async (req, res) => {
    try {
      await initTable();

      const oldEmployee = await get(
        `
        SELECT *
        FROM employees
        WHERE id = ?
        `,
        [req.params.id]
      );

      if (!oldEmployee) {
        return res.status(404).json({
          success: false,
          message: "Çalışan bulunamadı."
        });
      }

      await run(
        `
        DELETE FROM employees
        WHERE id = ?
        `,
        [req.params.id]
      );

      res.json({
        success: true,
        message: "Çalışan silindi."
      });
    } catch (err) {
      console.error("Çalışan silme hatası:", err);
      res.status(500).json({
        success: false,
        message: err.message
      });
    }
  });
};