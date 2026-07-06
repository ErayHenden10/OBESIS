// MAIL AYARLARI (Program içinden SMTP bilgilerini yönetme)
// Gmail, Hotmail/Outlook veya şirkete özel herhangi bir SMTP sunucusu desteklenir.
const mailer = require("../utils/mailer");

module.exports = function register(app, ctx) {
  const db = ctx.db;
  const dbGet = ctx.dbGet;
  const dbRun = ctx.dbRun;
  const onlySuperAdmin = ctx.onlySuperAdmin;

  db.run(`
    CREATE TABLE IF NOT EXISTS mail_settings (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      smtp_host TEXT,
      smtp_port INTEGER DEFAULT 587,
      smtp_secure INTEGER DEFAULT 0,
      smtp_user TEXT,
      smtp_pass TEXT,
      sender_name TEXT DEFAULT 'CNC Mini ERP',
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // ===============================
  // Mevcut ayarları getir (şifre asla ham olarak dönmez)
  // ===============================
  app.get("/api/mail-settings", async (req, res) => {
    try {
      const row = await dbGet(`SELECT * FROM mail_settings WHERE id = 1`);

      if (!row) {
        return res.json({
          success: true,
          configured: false,
          smtp_host: "",
          smtp_port: 587,
          smtp_secure: false,
          smtp_user: "",
          sender_name: "CNC Mini ERP",
          passwordSet: false
        });
      }

      res.json({
        success: true,
        configured: !!(row.smtp_user && row.smtp_pass),
        smtp_host: row.smtp_host || "",
        smtp_port: row.smtp_port || 587,
        smtp_secure: !!row.smtp_secure,
        smtp_user: row.smtp_user || "",
        sender_name: row.sender_name || "CNC Mini ERP",
        passwordSet: !!row.smtp_pass // şifre var mı bilgisi (kendisi değil)
      });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  });

  // ===============================
  // Ayarları kaydet (sadece Süper Admin)
  // ===============================
  app.post("/api/mail-settings", onlySuperAdmin, async (req, res) => {
    try {
      const { smtp_host, smtp_port, smtp_secure, smtp_user, smtp_pass, sender_name } = req.body;

      if (!smtp_host || !smtp_user) {
        return res.status(400).json({ success: false, message: "SMTP sunucu adresi ve gönderen e-posta zorunludur." });
      }

      const existing = await dbGet(`SELECT smtp_pass FROM mail_settings WHERE id = 1`);

      // Şifre alanı boş bırakıldıysa (kullanıcı tekrar girmek istemediyse) eski şifreyi koru
      const finalPass = (smtp_pass && smtp_pass.trim() !== "") ? smtp_pass.trim() : (existing?.smtp_pass || "");

      if (!finalPass) {
        return res.status(400).json({ success: false, message: "Şifre / Uygulama Şifresi zorunludur." });
      }

      await dbRun(
        `INSERT INTO mail_settings (id, smtp_host, smtp_port, smtp_secure, smtp_user, smtp_pass, sender_name, updated_at)
         VALUES (1, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
         ON CONFLICT(id) DO UPDATE SET
           smtp_host = excluded.smtp_host,
           smtp_port = excluded.smtp_port,
           smtp_secure = excluded.smtp_secure,
           smtp_user = excluded.smtp_user,
           smtp_pass = excluded.smtp_pass,
           sender_name = excluded.sender_name,
           updated_at = CURRENT_TIMESTAMP`,
        [
          smtp_host.trim(),
          Number(smtp_port) || 587,
          smtp_secure ? 1 : 0,
          smtp_user.trim(),
          finalPass,
          (sender_name || "CNC Mini ERP").trim()
        ]
      );

      // Yeni ayarları anında devreye al (sunucu yeniden başlatmaya gerek yok)
      const updated = await dbGet(`SELECT * FROM mail_settings WHERE id = 1`);
      mailer.setMailSettings(updated);

      res.json({ success: true, message: "Mail ayarları kaydedildi." });
    } catch (err) {
      console.error("Mail ayarları kaydetme hatası:", err.message);
      res.status(500).json({ success: false, message: err.message });
    }
  });
};
