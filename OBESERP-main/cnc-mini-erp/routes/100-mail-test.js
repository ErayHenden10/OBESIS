// MAIL TEST (SMTP ayarlarının doğru çalışıp çalışmadığını kontrol etmek için)
module.exports = function register(app, ctx) {
  var sendMail = ctx.sendMail;

  // Kullanım: GET /api/test-mail?to=ornek@gmail.com
  app.get("/api/test-mail", async (req, res) => {
    const to = req.query.to;

    if (!to) {
      return res.status(400).json({
        success: false,
        message: "Örnek kullanım: /api/test-mail?to=mail-adresi@gmail.com"
      });
    }

    const result = await sendMail({
      to,
      subject: "CNC Mini ERP - Test Maili",
      html: `
        <div style="font-family:Arial,sans-serif;">
          <h3>Test Başarılı ✅</h3>
          <p>Bu mail, Gmail SMTP ayarlarınızın doğru çalıştığını doğrulamak için gönderildi.</p>
          <p>Gönderim zamanı: ${new Date().toLocaleString("tr-TR")}</p>
        </div>
      `
    });

    if (result.success) {
      console.log(`[mailer] Test maili gönderildi -> ${to}`);
      return res.json({ success: true, message: `Test maili ${to} adresine gönderildi.` });
    }

    console.warn("[mailer] Test maili gönderilemedi:", result.message);
    return res.status(500).json({ success: false, message: result.message });
  });
};
