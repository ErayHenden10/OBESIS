console.log("92-sirket-bilgileri.js yüklendi");

module.exports = function registerRoutes(app, ctx) {
  const { dbRun, dbGet, addActivityLog } = ctx;

  async function ensureCompanySettingsTable() {
    await dbRun(`
      CREATE TABLE IF NOT EXISTS company_settings (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        company_name TEXT DEFAULT '',
        brand_name TEXT DEFAULT '',
        tax_office TEXT DEFAULT '',
        tax_no TEXT DEFAULT '',
        mersis_no TEXT DEFAULT '',
        trade_registry_no TEXT DEFAULT '',
        phone TEXT DEFAULT '',
        email TEXT DEFAULT '',
        website TEXT DEFAULT '',
        authorized_person TEXT DEFAULT '',
        iban TEXT DEFAULT '',
        bank_name TEXT DEFAULT '',
        address TEXT DEFAULT '',
        footer_note TEXT DEFAULT '',
        logo TEXT DEFAULT '',
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await dbRun(`
      INSERT OR IGNORE INTO company_settings (id, company_name, brand_name)
      VALUES (1, '', '')
    `);
  }

  app.get("/api/company-info", async (req, res) => {
    try {
      await ensureCompanySettingsTable();

      const row = await dbGet(`
        SELECT *
        FROM company_settings
        WHERE id = 1
      `);

      res.json({
        success: true,
        data: row || {}
      });
    } catch (err) {
      console.error("Şirket bilgileri GET hatası:", err);
      res.status(500).json({
        success: false,
        message: "Şirket bilgileri alınamadı."
      });
    }
  });

  app.post("/api/company-info", async (req, res) => {
    try {
      await ensureCompanySettingsTable();

      const b = req.body || {};

      await dbRun(`
        UPDATE company_settings SET
          company_name = ?,
          brand_name = ?,
          tax_office = ?,
          tax_no = ?,
          mersis_no = ?,
          trade_registry_no = ?,
          phone = ?,
          email = ?,
          website = ?,
          authorized_person = ?,
          iban = ?,
          bank_name = ?,
          address = ?,
          footer_note = ?,
          logo = ?,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = 1
      `, [
        b.company_name || "",
        b.brand_name || "",
        b.tax_office || "",
        b.tax_no || "",
        b.mersis_no || "",
        b.trade_registry_no || "",
        b.phone || "",
        b.email || "",
        b.website || "",
        b.authorized_person || "",
        b.iban || "",
        b.bank_name || "",
        b.address || "",
        b.footer_note || "",
        b.logo || ""
      ]);

      const row = await dbGet(`
        SELECT *
        FROM company_settings
        WHERE id = 1
      `);

      try {
        if (typeof addActivityLog === "function") {
          await addActivityLog({
            actor: b.updated_by || "system",
            module: "Şirket Bilgileri",
            action: "Güncelleme",
            description: "Şirket bilgileri güncellendi.",
            status: "success"
          });
        }
      } catch (logErr) {
        console.warn("Activity log yazılamadı:", logErr.message);
      }

      res.json({
        success: true,
        message: "Şirket bilgileri kaydedildi.",
        data: row
      });
    } catch (err) {
      console.error("Şirket bilgileri POST hatası:", err);
      res.status(500).json({
        success: false,
        message: "Şirket bilgileri kaydedilemedi."
      });
    }
  });

  app.put("/api/company-info", async (req, res) => {
    try {
      await ensureCompanySettingsTable();

      const b = req.body || {};

      await dbRun(`
        UPDATE company_settings SET
          company_name = ?,
          brand_name = ?,
          tax_office = ?,
          tax_no = ?,
          mersis_no = ?,
          trade_registry_no = ?,
          phone = ?,
          email = ?,
          website = ?,
          authorized_person = ?,
          iban = ?,
          bank_name = ?,
          address = ?,
          footer_note = ?,
          logo = ?,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = 1
      `, [
        b.company_name || "",
        b.brand_name || "",
        b.tax_office || "",
        b.tax_no || "",
        b.mersis_no || "",
        b.trade_registry_no || "",
        b.phone || "",
        b.email || "",
        b.website || "",
        b.authorized_person || "",
        b.iban || "",
        b.bank_name || "",
        b.address || "",
        b.footer_note || "",
        b.logo || ""
      ]);

      const row = await dbGet(`
        SELECT *
        FROM company_settings
        WHERE id = 1
      `);

      res.json({
        success: true,
        message: "Şirket bilgileri kaydedildi.",
        data: row
      });
    } catch (err) {
      console.error("Şirket bilgileri PUT hatası:", err);
      res.status(500).json({
        success: false,
        message: "Şirket bilgileri kaydedilemedi."
      });
    }
  });
};