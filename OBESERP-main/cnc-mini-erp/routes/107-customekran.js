module.exports = function (app, ctx = {}) {
  const db = ctx.db;

  function run(sql, params = []) {
    return new Promise((resolve, reject) => {
      if (db.run) {
        db.run(sql, params, function (err) {
          if (err) reject(err);
          else resolve({ id: this.lastID, changes: this.changes });
        });
      } else {
        try {
          const info = db.prepare(sql).run(params);
          resolve({ id: info.lastInsertRowid, changes: info.changes });
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

  function cleanName(value) {
    return String(value || "")
      .trim()
      .toLowerCase()
      .replaceAll("ı", "i")
      .replaceAll("ğ", "g")
      .replaceAll("ü", "u")
      .replaceAll("ş", "s")
      .replaceAll("ö", "o")
      .replaceAll("ç", "c")
      .replace(/[^a-z0-9_]/g, "_")
      .replace(/_+/g, "_")
      .replace(/^_+|_+$/g, "");
  }

  function columnType(fieldType) {
    if (["number", "money"].includes(fieldType)) return "REAL";
    if (fieldType === "checkbox") return "INTEGER DEFAULT 0";
    return "TEXT";
  }

  async function initTables() {
    await run(`
      CREATE TABLE IF NOT EXISTS custom_screens (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        screen_name TEXT NOT NULL,
        table_name TEXT NOT NULL UNIQUE,
        icon TEXT DEFAULT 'fa-solid fa-layer-group',
        description TEXT,
        active INTEGER DEFAULT 1,
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
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
  }

  async function createDynamicTable(screenId, fields) {
    const tableName = `custom_data_${screenId}`;

    await run(`
      CREATE TABLE IF NOT EXISTS ${tableName} (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME
      )
    `);

    const existingColumns = await all(`PRAGMA table_info(${tableName})`);
    const existingNames = existingColumns.map(x => x.name);

    for (const field of fields) {
      const fieldName = cleanName(field.field_name || field.field_label);

      if (!fieldName || existingNames.includes(fieldName)) continue;

      await run(`
        ALTER TABLE ${tableName}
        ADD COLUMN ${fieldName} ${columnType(field.field_type)}
      `);
    }

    return tableName;
  }

  initTables();

  app.get("/api/custom-screens", async (req, res) => {
    try {
      const rows = await all(`
        SELECT *
        FROM custom_screens
        WHERE active = 1
        ORDER BY id DESC
      `);

      res.json({ success: true, data: rows });
    } catch (err) {
      res.status(500).json({
        success: false,
        message: "Özel ekranlar alınamadı",
        error: err.message
      });
    }
  });

  app.get("/api/custom-screens/:id", async (req, res) => {
    try {
      const id = req.params.id;

      const screen = await get(`
        SELECT *
        FROM custom_screens
        WHERE id = ?
      `, [id]);

      if (!screen) {
        return res.status(404).json({
          success: false,
          message: "Ekran bulunamadı"
        });
      }

      const fields = await all(`
        SELECT *
        FROM custom_screen_fields
        WHERE screen_id = ?
        ORDER BY sort_order ASC, id ASC
      `, [id]);

      res.json({
        success: true,
        data: {
          screen,
          fields
        }
      });
    } catch (err) {
      res.status(500).json({
        success: false,
        message: "Ekran detayı alınamadı",
        error: err.message
      });
    }
  });

  app.post("/api/custom-screens", async (req, res) => {
    try {
      const body = req.body || {};

      const screenName = body.screen_name || body.name || body.title;
      const icon = body.icon || "fa-solid fa-layer-group";
      const description = body.description || "";
      const fields = Array.isArray(body.fields) ? body.fields : [];

      if (!screenName) {
        return res.status(400).json({
          success: false,
          message: "Ekran adı zorunludur"
        });
      }

      if (fields.length === 0) {
        return res.status(400).json({
          success: false,
          message: "En az 1 alan eklemelisin"
        });
      }

      const tempTableName = "custom_data_pending";

      const inserted = await run(`
        INSERT INTO custom_screens
        (screen_name, table_name, icon, description)
        VALUES (?, ?, ?, ?)
      `, [screenName, tempTableName + "_" + Date.now(), icon, description]);

      const screenId = inserted.id;
      const tableName = `custom_data_${screenId}`;

      await run(`
        UPDATE custom_screens
        SET table_name = ?
        WHERE id = ?
      `, [tableName, screenId]);

      const normalizedFields = fields.map((field, index) => {
        const fieldLabel = field.field_label || field.label || field.name || `Alan ${index + 1}`;
        const fieldName = cleanName(field.field_name || field.name || fieldLabel);

        return {
          field_label: fieldLabel,
          field_name: fieldName,
          field_type: field.field_type || field.type || "text",
          list_source: field.list_source || field.options || "",
          is_required: field.is_required ? 1 : 0,
          sort_order: index + 1
        };
      });

      for (const field of normalizedFields) {
        await run(`
          INSERT INTO custom_screen_fields
          (screen_id, field_label, field_name, field_type, list_source, is_required, sort_order)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `, [
          screenId,
          field.field_label,
          field.field_name,
          field.field_type,
          field.list_source,
          field.is_required,
          field.sort_order
        ]);
      }

      await createDynamicTable(screenId, normalizedFields);

      res.json({
        success: true,
        message: "Ekran oluşturuldu",
        id: screenId,
        data: {
          id: screenId,
          screen_name: screenName,
          table_name: tableName,
          url: `custom-ekran.html?id=${screenId}`
        }
      });
    } catch (err) {
      res.status(500).json({
        success: false,
        message: "Ekran oluşturulamadı",
        error: err.message
      });
    }
  });

  app.get("/api/custom-data/:screenId", async (req, res) => {
    try {
      const screenId = req.params.screenId;

      const screen = await get(`
        SELECT *
        FROM custom_screens
        WHERE id = ?
      `, [screenId]);

      if (!screen) {
        return res.status(404).json({
          success: false,
          message: "Ekran bulunamadı"
        });
      }

      const rows = await all(`
        SELECT *
        FROM ${screen.table_name}
        ORDER BY id DESC
      `);

      res.json({
        success: true,
        data: rows
      });
    } catch (err) {
      res.status(500).json({
        success: false,
        message: "Kayıtlar alınamadı",
        error: err.message
      });
    }
  });

  app.post("/api/custom-data/:screenId", async (req, res) => {
    try {
      const screenId = req.params.screenId;
      const body = req.body || {};

      const screen = await get(`
        SELECT *
        FROM custom_screens
        WHERE id = ?
      `, [screenId]);

      if (!screen) {
        return res.status(404).json({
          success: false,
          message: "Ekran bulunamadı"
        });
      }

      const fields = await all(`
        SELECT *
        FROM custom_screen_fields
        WHERE screen_id = ?
        ORDER BY sort_order ASC
      `, [screenId]);

      const columns = [];
      const placeholders = [];
      const values = [];

      for (const field of fields) {
        columns.push(field.field_name);
        placeholders.push("?");
        values.push(body[field.field_name] ?? "");
      }

      const result = await run(`
        INSERT INTO ${screen.table_name}
        (${columns.join(", ")})
        VALUES (${placeholders.join(", ")})
      `, values);

      res.json({
        success: true,
        message: "Kayıt eklendi",
        id: result.id
      });
    } catch (err) {
      res.status(500).json({
        success: false,
        message: "Kayıt eklenemedi",
        error: err.message
      });
    }
  });

  app.put("/api/custom-data/:screenId/:id", async (req, res) => {
    try {
      const screenId = req.params.screenId;
      const id = req.params.id;
      const body = req.body || {};

      const screen = await get(`
        SELECT *
        FROM custom_screens
        WHERE id = ?
      `, [screenId]);

      if (!screen) {
        return res.status(404).json({
          success: false,
          message: "Ekran bulunamadı"
        });
      }

      const fields = await all(`
        SELECT *
        FROM custom_screen_fields
        WHERE screen_id = ?
        ORDER BY sort_order ASC
      `, [screenId]);

      const sets = [];
      const values = [];

      for (const field of fields) {
        sets.push(`${field.field_name} = ?`);
        values.push(body[field.field_name] ?? "");
      }

      sets.push("updated_at = CURRENT_TIMESTAMP");
      values.push(id);

      await run(`
        UPDATE ${screen.table_name}
        SET ${sets.join(", ")}
        WHERE id = ?
      `, values);

      res.json({
        success: true,
        message: "Kayıt güncellendi"
      });
    } catch (err) {
      res.status(500).json({
        success: false,
        message: "Kayıt güncellenemedi",
        error: err.message
      });
    }
  });

  app.delete("/api/custom-data/:screenId/:id", async (req, res) => {
    try {
      const screenId = req.params.screenId;
      const id = req.params.id;

      const screen = await get(`
        SELECT *
        FROM custom_screens
        WHERE id = ?
      `, [screenId]);

      if (!screen) {
        return res.status(404).json({
          success: false,
          message: "Ekran bulunamadı"
        });
      }

      await run(`
        DELETE FROM ${screen.table_name}
        WHERE id = ?
      `, [id]);

      res.json({
        success: true,
        message: "Kayıt silindi"
      });
    } catch (err) {
      res.status(500).json({
        success: false,
        message: "Kayıt silinemedi",
        error: err.message
      });
    }
  });

  app.get("/api/custom-list/:source", async (req, res) => {
    try {
      const source = req.params.source;

      const map = {
        customers: {
          table: "customers",
          id: "id",
          name: "company_name"
        },
        suppliers: {
          table: "suppliers",
          id: "id",
          name: "company_name"
        },
        stocks: {
          table: "stocks",
          id: "id",
          name: "part_name"
        },
        employees: {
          table: "employees",
          id: "id",
          name: "full_name"
        }
      };

      const cfg = map[source];

      if (!cfg) {
        return res.json({
          success: true,
          data: []
        });
      }

      const rows = await all(`
        SELECT
          ${cfg.id} AS id,
          ${cfg.name} AS name
        FROM ${cfg.table}
        ORDER BY ${cfg.name} ASC
        LIMIT 500
      `);

      res.json({
        success: true,
        data: rows
      });
    } catch (err) {
      res.json({
        success: true,
        data: []
      });
    }
  });

  console.log("✅ Custom Screens aktif");
};