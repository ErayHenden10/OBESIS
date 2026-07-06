console.log("96-custom-screen-builder.js yüklendi");

module.exports = function (app, ctx = {}) {
  const db = ctx.db;

  function run(sql, params = []) {
    return new Promise((resolve, reject) => {
      if (db.run) {
        db.run(sql, params, function (err) {
          if (err) reject(err);
          else resolve({ lastID: this.lastID, changes: this.changes });
        });
      } else {
        try {
          const stmt = db.prepare(sql);
          const result = stmt.run(params);
          resolve({ lastID: result.lastInsertRowid, changes: result.changes });
        } catch (err) {
          reject(err);
        }
      }
    });
  }

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
        db.get(sql, params, (err, row) => err ? reject(err) : resolve(row));
      } else {
        try {
          resolve(db.prepare(sql).get(params));
        } catch (err) {
          reject(err);
        }
      }
    });
  }

  function slugify(value) {
    return String(value || "")
      .toLocaleLowerCase("tr-TR")
      .replaceAll("ı", "i")
      .replaceAll("ğ", "g")
      .replaceAll("ü", "u")
      .replaceAll("ş", "s")
      .replaceAll("ö", "o")
      .replaceAll("ç", "c")
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "");
  }

  function safeName(value) {
    const name = slugify(value);
    if (!name) return null;
    return name;
  }

  function columnType(fieldType) {
    switch (fieldType) {
      case "number":
      case "money":
        return "REAL";
      case "checkbox":
        return "INTEGER DEFAULT 0";
      case "customer":
      case "supplier":
      case "stock":
      case "employee":
        return "INTEGER";
      default:
        return "TEXT";
    }
  }

  async function init() {
    await run(`
      CREATE TABLE IF NOT EXISTS custom_screens (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        screen_name TEXT NOT NULL,
        table_name TEXT NOT NULL UNIQUE,
        icon TEXT DEFAULT 'fa-solid fa-layer-group',
        status TEXT DEFAULT 'active',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await run(`
      CREATE TABLE IF NOT EXISTS custom_screen_fields (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        screen_id INTEGER NOT NULL,
        field_label TEXT NOT NULL,
        field_name TEXT NOT NULL,
        field_type TEXT NOT NULL,
        list_source TEXT,
        is_required INTEGER DEFAULT 0,
        sort_order INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(screen_id) REFERENCES custom_screens(id)
      )
    `);
  }

  init().catch(err => console.error("Custom screen init hata:", err));

  app.get("/api/custom-screens", async (req, res) => {
    try {
      const rows = await all(`
        SELECT *
        FROM custom_screens
        WHERE status = 'active'
        ORDER BY id DESC
      `);

      res.json({ success: true, data: rows });
    } catch (err) {
      console.error(err);
      res.status(500).json({ success: false, message: err.message });
    }
  });

  app.get("/api/custom-screens/:id", async (req, res) => {
    try {
      const screen = await get(
        `SELECT * FROM custom_screens WHERE id = ?`,
        [req.params.id]
      );

      if (!screen) {
        return res.status(404).json({ success: false, message: "Ekran bulunamadı" });
      }

      const fields = await all(
        `SELECT * FROM custom_screen_fields WHERE screen_id = ? ORDER BY sort_order, id`,
        [req.params.id]
      );

      res.json({ success: true, data: { screen, fields } });
    } catch (err) {
      console.error(err);
      res.status(500).json({ success: false, message: err.message });
    }
  });

  app.post("/api/custom-screens", async (req, res) => {
    try {
      const { screenName, icon, fields } = req.body;

      if (!screenName) {
        return res.status(400).json({ success: false, message: "Ekran adı zorunlu" });
      }

      if (!Array.isArray(fields) || fields.length === 0) {
        return res.status(400).json({ success: false, message: "En az 1 alan eklenmeli" });
      }

      const baseName = safeName(screenName);
      const tableName = `custom_${baseName}`;

      const exists = await get(
        `SELECT id FROM custom_screens WHERE table_name = ?`,
        [tableName]
      );

      if (exists) {
        return res.status(400).json({
          success: false,
          message: "Bu isimde bir ekran zaten var"
        });
      }

      const cleanFields = fields.map((f, index) => {
        const fieldLabel = String(f.fieldLabel || "").trim();
        const fieldType = String(f.fieldType || "text").trim();
        const fieldName = safeName(f.fieldName || fieldLabel);

        if (!fieldLabel || !fieldName) {
          throw new Error("Alan adı boş olamaz");
        }

        return {
          fieldLabel,
          fieldName,
          fieldType,
          listSource: f.listSource || "",
          isRequired: f.isRequired ? 1 : 0,
          sortOrder: index + 1
        };
      });

      const createColumns = cleanFields.map(f => {
        return `"${f.fieldName}" ${columnType(f.fieldType)}`;
      });

      await run(`
        CREATE TABLE IF NOT EXISTS "${tableName}" (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          ${createColumns.join(",\n")},
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME
        )
      `);

      const inserted = await run(
        `
        INSERT INTO custom_screens (screen_name, table_name, icon, status)
        VALUES (?, ?, ?, 'active')
        `,
        [screenName, tableName, icon || "fa-solid fa-layer-group"]
      );

      const screenId = inserted.lastID;

      for (const f of cleanFields) {
        await run(
          `
          INSERT INTO custom_screen_fields
          (screen_id, field_label, field_name, field_type, list_source, is_required, sort_order)
          VALUES (?, ?, ?, ?, ?, ?, ?)
          `,
          [
            screenId,
            f.fieldLabel,
            f.fieldName,
            f.fieldType,
            f.listSource,
            f.isRequired,
            f.sortOrder
          ]
        );
      }

      res.json({
        success: true,
        message: "Ekran oluşturuldu",
        data: {
          id: screenId,
          screen_name: screenName,
          table_name: tableName
        }
      });
    } catch (err) {
      console.error(err);
      res.status(500).json({ success: false, message: err.message });
    }
  });

  app.get("/api/custom-data/:screenId", async (req, res) => {
    try {
      const screen = await get(
        `SELECT * FROM custom_screens WHERE id = ?`,
        [req.params.screenId]
      );

      if (!screen) {
        return res.status(404).json({ success: false, message: "Ekran bulunamadı" });
      }

      const rows = await all(
        `SELECT * FROM "${screen.table_name}" ORDER BY id DESC`
      );

      res.json({ success: true, data: rows });
    } catch (err) {
      console.error(err);
      res.status(500).json({ success: false, message: err.message });
    }
  });

  app.post("/api/custom-data/:screenId", async (req, res) => {
    try {
      const screen = await get(
        `SELECT * FROM custom_screens WHERE id = ?`,
        [req.params.screenId]
      );

      if (!screen) {
        return res.status(404).json({ success: false, message: "Ekran bulunamadı" });
      }

      const fields = await all(
        `SELECT * FROM custom_screen_fields WHERE screen_id = ? ORDER BY sort_order, id`,
        [req.params.screenId]
      );

      const body = req.body || {};
      const columns = [];
      const placeholders = [];
      const values = [];

      for (const field of fields) {
        if (field.is_required && (body[field.field_name] === undefined || body[field.field_name] === "")) {
          return res.status(400).json({
            success: false,
            message: `${field.field_label} zorunlu`
          });
        }

        columns.push(`"${field.field_name}"`);
        placeholders.push("?");
        values.push(body[field.field_name] ?? "");
      }

      const result = await run(
        `
        INSERT INTO "${screen.table_name}" (${columns.join(",")})
        VALUES (${placeholders.join(",")})
        `,
        values
      );

      res.json({ success: true, message: "Kayıt eklendi", id: result.lastID });
    } catch (err) {
      console.error(err);
      res.status(500).json({ success: false, message: err.message });
    }
  });

  app.put("/api/custom-data/:screenId/:id", async (req, res) => {
    try {
      const screen = await get(
        `SELECT * FROM custom_screens WHERE id = ?`,
        [req.params.screenId]
      );

      if (!screen) {
        return res.status(404).json({ success: false, message: "Ekran bulunamadı" });
      }

      const fields = await all(
        `SELECT * FROM custom_screen_fields WHERE screen_id = ? ORDER BY sort_order, id`,
        [req.params.screenId]
      );

      const body = req.body || {};
      const sets = [];
      const values = [];

      for (const field of fields) {
        sets.push(`"${field.field_name}" = ?`);
        values.push(body[field.field_name] ?? "");
      }

      sets.push(`updated_at = CURRENT_TIMESTAMP`);
      values.push(req.params.id);

      await run(
        `
        UPDATE "${screen.table_name}"
        SET ${sets.join(", ")}
        WHERE id = ?
        `,
        values
      );

      res.json({ success: true, message: "Kayıt güncellendi" });
    } catch (err) {
      console.error(err);
      res.status(500).json({ success: false, message: err.message });
    }
  });

  app.delete("/api/custom-data/:screenId/:id", async (req, res) => {
    try {
      const screen = await get(
        `SELECT * FROM custom_screens WHERE id = ?`,
        [req.params.screenId]
      );

      if (!screen) {
        return res.status(404).json({ success: false, message: "Ekran bulunamadı" });
      }

      await run(
        `DELETE FROM "${screen.table_name}" WHERE id = ?`,
        [req.params.id]
      );

      res.json({ success: true, message: "Kayıt silindi" });
    } catch (err) {
      console.error(err);
      res.status(500).json({ success: false, message: err.message });
    }
  });

  app.get("/api/custom-list/:source", async (req, res) => {
    try {
      const source = req.params.source;

      let rows = [];

      if (source === "customers") {
        rows = await all(`SELECT id, company_name AS name FROM customers ORDER BY company_name`);
      } else if (source === "suppliers") {
        rows = await all(`SELECT id, company_name AS name FROM suppliers ORDER BY company_name`);
      } else if (source === "stocks") {
        rows = await all(`SELECT id, part_name AS name FROM stocks ORDER BY part_name`);
      } else if (source === "employees") {
        rows = await all(`SELECT id, full_name AS name FROM employees ORDER BY full_name`);
      } else {
        rows = [];
      }

      res.json({ success: true, data: rows });
    } catch (err) {
      console.error(err);
      res.status(500).json({ success: false, message: err.message });
    }
  });
};