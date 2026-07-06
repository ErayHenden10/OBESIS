// routes/41-calisanlar.js

module.exports = function register(app, ctx) {
  const db = ctx.db;

  db.run(`
    CREATE TABLE IF NOT EXISTS employees (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      full_name TEXT NOT NULL,
      identity_no TEXT,
      phone TEXT,
      department TEXT,
      position TEXT,
      hire_date TEXT,
      salary REAL DEFAULT 0,
      status TEXT DEFAULT 'active',
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);

  app.get("/api/employees", (req, res) => {
    db.all("SELECT * FROM employees ORDER BY id DESC", [], (err, rows) => {
      if (err) {
        return res.json({ success: false, message: err.message, employees: [] });
      }

      res.json({
        success: true,
        employees: rows.map(e => ({
          id: e.id,
          fullName: e.full_name,
          identityNo: e.identity_no,
          phone: e.phone,
          department: e.department,
          position: e.position,
          hireDate: e.hire_date,
          salary: e.salary,
          status: e.status
        }))
      });
    });
  });

  app.post("/api/employees", (req, res) => {
    const {
      fullName,
      identityNo,
      phone,
      department,
      position,
      hireDate,
      salary
    } = req.body || {};

    if (!fullName) {
      return res.json({ success: false, message: "Ad soyad zorunludur." });
    }

    db.run(
      `
      INSERT INTO employees
      (full_name, identity_no, phone, department, position, hire_date, salary, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'active')
      `,
      [
        fullName,
        identityNo || "",
        phone || "",
        department || "",
        position || "",
        hireDate || "",
        salary || 0
      ],
      function (err) {
        if (err) {
          return res.json({ success: false, message: err.message });
        }

        res.json({ success: true, id: this.lastID });
      }
    );
  });

  app.put("/api/employees/:id", (req, res) => {
    const {
      fullName,
      identityNo,
      phone,
      department,
      position,
      hireDate,
      salary
    } = req.body || {};

    db.run(
      `
      UPDATE employees SET
        full_name = ?,
        identity_no = ?,
        phone = ?,
        department = ?,
        position = ?,
        hire_date = ?,
        salary = ?
      WHERE id = ?
      `,
      [
        fullName || "",
        identityNo || "",
        phone || "",
        department || "",
        position || "",
        hireDate || "",
        salary || 0,
        req.params.id
      ],
      function (err) {
        if (err) {
          return res.json({ success: false, message: err.message });
        }

        res.json({ success: true });
      }
    );
  });

  app.put("/api/employees/:id/status", (req, res) => {
    const { status } = req.body || {};

    db.run(
      "UPDATE employees SET status = ? WHERE id = ?",
      [status || "active", req.params.id],
      function (err) {
        if (err) {
          return res.json({ success: false, message: err.message });
        }

        res.json({ success: true });
      }
    );
  });
};