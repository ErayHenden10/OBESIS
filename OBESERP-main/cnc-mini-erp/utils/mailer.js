// MAIL GÖNDERİM MODÜLÜ (Nodemailer) — Ayarlar veritabanından (mail_settings tablosu)
// okunur; program içinden "Mail Ayarları" ekranında girilen bilgiler kullanılır.
// Böylece Gmail/Hotmail/şirkete özel herhangi bir SMTP sunucusu desteklenir.
// Geriye dönük uyumluluk için, veritabanında ayar yoksa .env'deki SMTP_* değerlerine düşülür.
const nodemailer = require("nodemailer");

let transporter = null;
let dbSettings = null; // { smtp_host, smtp_port, smtp_secure, smtp_user, smtp_pass, sender_name }

/**
 * Sunucu açılışında veya "Mail Ayarları" ekranından kaydedince çağrılır.
 * Yeni ayarları belleğe alır ve mevcut transporter'ı sıfırlar (yeniden kurulsun diye).
 */
function setMailSettings(settings) {
  dbSettings = settings || null;
  transporter = null;
}

function getActiveConfig() {
  return {
    host: dbSettings?.smtp_host || process.env.SMTP_HOST || "smtp.gmail.com",
    port: Number(dbSettings?.smtp_port || process.env.SMTP_PORT || 587),
    secure: !!(dbSettings?.smtp_secure ?? false),
    user: dbSettings?.smtp_user || process.env.SMTP_USER,
    pass: dbSettings?.smtp_pass || process.env.SMTP_PASS,
    senderName: dbSettings?.sender_name || "CNC Mini ERP"
  };
}

/**
 * Sunucu ilk açıldığında veritabanındaki mail_settings satırını belleğe yükler.
 * @param {(sql:string, params?:any[]) => Promise<any>} dbGet - ctx.dbGet
 */
async function initMailSettingsFromDb(dbGet) {
  try {
    const row = await dbGet(`SELECT * FROM mail_settings WHERE id = 1`);
    if (row) setMailSettings(row);
  } catch (err) {
    console.warn("[mailer] mail_settings okunamadı, .env'e düşülüyor:", err.message);
  }
}

function getTransporter() {
  if (transporter) return transporter;

  const { host, port, secure, user, pass } = getActiveConfig();

  if (!user || !pass) {
    console.warn(
      "[mailer] Mail ayarları yapılandırılmamış (Ayarlar > Mail Ayarları ekranından girin). Mail gönderimi devre dışı."
    );
    return null;
  }

  const isSecure = secure || port === 465;

  transporter = nodemailer.createTransport({
    host,
    port,
    secure: isSecure,
    // Port 465 dışında (587/25 vb.) STARTTLS zorunlu kılınır — bazı şirket
    // sunucuları şifresiz bağlantıyı reddettiği için bu önemli.
    requireTLS: !isSecure,
    auth: { user, pass },
    // Şirket içi mail sunucularında sıkça self-signed sertifika kullanılır;
    // bu olmadan bağlantı "self signed certificate" hatasıyla reddedilir.
    tls: { rejectUnauthorized: false },
    // Bazı kurumsal sunucular yanıt vermekte yavaş olabiliyor; makul bir
    // bekleme süresi olmadan bağlantı zaman aşımına düşüp hata verebiliyor.
    connectionTimeout: 30000,
    greetingTimeout: 30000,
    socketTimeout: 30000
  });

  return transporter;
}

/**
 * Genel amaçlı mail gönderme fonksiyonu.
 * @param {{to: string|string[], subject: string, html: string}} opts
 */
async function sendMail({ to, subject, html }) {
  const t = getTransporter();
  if (!t) return { success: false, message: "SMTP yapılandırılmamış." };
  if (!to || (Array.isArray(to) && to.length === 0)) {
    return { success: false, message: "Alıcı belirtilmemiş." };
  }

  const { user, senderName } = getActiveConfig();

  try {
    await t.sendMail({
      from: `"${senderName}" <${user}>`,
      to: Array.isArray(to) ? to.join(",") : to,
      subject,
      html
    });
    return { success: true };
  } catch (err) {
    console.error("[mailer] Mail gönderim hatası:", err.message);
    return { success: false, message: err.message };
  }
}

/**
 * Yeni satış siparişi oluşturulduğunda seçilen kullanıcılara bildirim maili yollar.
 * @param {object} order - { orderNo, customerName, totalAmount, deliveryDate, orderDate, note, createdBy, lines }
 * @param {Array<{email: string, full_name?: string}>} users
 */
async function sendNewOrderMail(order, users) {
  const recipients = (users || [])
    .map((u) => u.email)
    .filter((email) => !!email);

  if (recipients.length === 0) {
    console.warn("[mailer] Bildirim için geçerli e-posta adresi bulunamadı.");
    return { success: false, message: "Geçerli e-posta adresi yok." };
  }

  const lines = Array.isArray(order.lines) ? order.lines : [];

  const linesHtml = lines.length
    ? `
      <table style="border-collapse:collapse;width:100%;margin-top:16px;font-size:13px;">
        <thead>
          <tr style="background:#f3f4f6;">
            <th style="text-align:left;padding:8px;border:1px solid #e5e7eb;">Ürün / Açıklama</th>
            <th style="text-align:right;padding:8px;border:1px solid #e5e7eb;">Miktar</th>
            <th style="text-align:right;padding:8px;border:1px solid #e5e7eb;">Birim Fiyat</th>
            <th style="text-align:right;padding:8px;border:1px solid #e5e7eb;">Tutar</th>
          </tr>
        </thead>
        <tbody>
          ${lines
            .map(
              (l) => `
            <tr>
              <td style="padding:8px;border:1px solid #e5e7eb;">
                <b>${l.part_name || "-"}</b>${l.description ? `<br><span style="color:#666;font-size:12px;">${l.description}</span>` : ""}
              </td>
              <td style="text-align:right;padding:8px;border:1px solid #e5e7eb;">${Number(l.quantity || 0).toLocaleString("tr-TR")} ${l.unit || ""}</td>
              <td style="text-align:right;padding:8px;border:1px solid #e5e7eb;">${Number(l.unit_price || 0).toLocaleString("tr-TR")} TL</td>
              <td style="text-align:right;padding:8px;border:1px solid #e5e7eb;">${Number(l.total_price || 0).toLocaleString("tr-TR")} TL</td>
            </tr>
          `
            )
            .join("")}
        </tbody>
      </table>
    `
    : `<p style="color:#888;margin-top:16px;">Bu siparişe ait kalem bilgisi girilmemiş.</p>`;

  const html = `
    <div style="font-family:Arial,sans-serif;font-size:14px;color:#222;max-width:640px;">
      <h2 style="color:#1a56db;margin-bottom:4px;">Yeni Satış Siparişi Oluşturuldu</h2>
      <p style="color:#666;margin-top:0;">Sistemde yeni bir satış siparişi oluşturuldu, detaylar aşağıdadır.</p>

      <table style="border-collapse:collapse;margin-top:10px;">
        <tr><td style="padding:4px 12px 4px 0;"><b>Sipariş No:</b></td><td>${order.orderNo}</td></tr>
        <tr><td style="padding:4px 12px 4px 0;"><b>Müşteri:</b></td><td>${order.customerName || "-"}</td></tr>
        <tr><td style="padding:4px 12px 4px 0;"><b>Sipariş Tarihi:</b></td><td>${order.orderDate || "-"}</td></tr>
        <tr><td style="padding:4px 12px 4px 0;"><b>Teslim Tarihi:</b></td><td>${order.deliveryDate || "-"}</td></tr>
        <tr><td style="padding:4px 12px 4px 0;"><b>Oluşturan:</b></td><td>${order.createdBy || "-"}</td></tr>
        ${order.note ? `<tr><td style="padding:4px 12px 4px 0;vertical-align:top;"><b>Not:</b></td><td>${order.note}</td></tr>` : ""}
      </table>

      ${linesHtml}

      <table style="margin-top:10px;">
        <tr>
          <td style="padding:4px 12px 4px 0;"><b>Genel Toplam:</b></td>
          <td style="font-size:16px;font-weight:bold;color:#1a56db;">
            ${Number(order.totalAmount || 0).toLocaleString("tr-TR")} TL
          </td>
        </tr>
      </table>

      <p style="margin-top:20px;color:#888;font-size:12px;">Bu mail CNC Mini ERP sistemi tarafından otomatik olarak gönderilmiştir.</p>
    </div>
  `;

  return sendMail({
    to: recipients,
    subject: `Yeni Sipariş Oluşturuldu - ${order.orderNo}`,
    html
  });
}

/**
 * Satın alma talebi/siparişi onaylandığında veya reddedildiğinde bildirim maili yollar.
 * @param {object} doc - { docNo, docTypeLabel, materialName, quantity, unit, supplierName, requestedBy, statusLabel, isRejected, note }
 * @param {Array<{email: string}>} users
 */
async function sendPurchaseApprovalMail(doc, users) {
  const recipients = (users || [])
    .map((u) => u.email)
    .filter((email) => !!email);

  if (recipients.length === 0) {
    console.warn("[mailer] Bildirim için geçerli e-posta adresi bulunamadı.");
    return { success: false, message: "Geçerli e-posta adresi yok." };
  }

  const statusColor = doc.isRejected ? "#dc2626" : "#15803d";

  const html = `
    <div style="font-family:Arial,sans-serif;font-size:14px;color:#222;max-width:640px;">
      <h2 style="color:${statusColor};margin-bottom:4px;">
        ${doc.docTypeLabel} ${doc.statusLabel}
      </h2>
      <p style="color:#666;margin-top:0;">${doc.docTypeLabel} için durum güncellendi, detaylar aşağıdadır.</p>

      <table style="border-collapse:collapse;margin-top:10px;">
        <tr><td style="padding:4px 12px 4px 0;"><b>Belge No:</b></td><td>${doc.docNo || "-"}</td></tr>
        <tr><td style="padding:4px 12px 4px 0;"><b>Malzeme:</b></td><td>${doc.materialName || "-"}</td></tr>
        <tr><td style="padding:4px 12px 4px 0;"><b>Miktar:</b></td><td>${Number(doc.quantity || 0).toLocaleString("tr-TR")} ${doc.unit || ""}</td></tr>
        ${doc.supplierName ? `<tr><td style="padding:4px 12px 4px 0;"><b>Tedarikçi:</b></td><td>${doc.supplierName}</td></tr>` : ""}
        ${doc.requestedBy ? `<tr><td style="padding:4px 12px 4px 0;"><b>Talep Eden:</b></td><td>${doc.requestedBy}</td></tr>` : ""}
        <tr>
          <td style="padding:4px 12px 4px 0;"><b>Durum:</b></td>
          <td>
            <span style="color:${statusColor};font-weight:bold;">${doc.statusLabel}</span>
          </td>
        </tr>
        ${doc.isRejected && doc.note ? `<tr><td style="padding:4px 12px 4px 0;vertical-align:top;"><b>Red Sebebi:</b></td><td>${doc.note}</td></tr>` : ""}
      </table>

      <p style="margin-top:20px;color:#888;font-size:12px;">Bu mail CNC Mini ERP sistemi tarafından otomatik olarak gönderilmiştir.</p>
    </div>
  `;

  return sendMail({
    to: recipients,
    subject: `${doc.docTypeLabel} ${doc.statusLabel} - ${doc.docNo || ""}`,
    html
  });
}

/**
 * Yeni bir satın alma talebi oluşturulduğunda admin/muhasebe/satın alma
 * rolündeki kullanıcılara bildirim maili yollar.
 * @param {object} doc - { docNo, materialName, quantity, unit, urgency, requestedBy, supplierName }
 * @param {Array<{email: string}>} users
 */
async function sendNewPurchaseRequestMail(doc, users) {
  const recipients = (users || [])
    .map((u) => u.email)
    .filter((email) => !!email);

  if (recipients.length === 0) {
    console.warn("[mailer] Bildirim için geçerli e-posta adresi bulunamadı.");
    return { success: false, message: "Geçerli e-posta adresi yok." };
  }

  const html = `
    <div style="font-family:Arial,sans-serif;font-size:14px;color:#222;max-width:640px;">
      <h2 style="color:#1a56db;margin-bottom:4px;">Yeni Satın Alma Talebi Oluşturuldu</h2>
      <p style="color:#666;margin-top:0;">Sistemde onay bekleyen yeni bir satın alma talebi oluşturuldu.</p>

      <table style="border-collapse:collapse;margin-top:10px;">
        <tr><td style="padding:4px 12px 4px 0;"><b>Talep No:</b></td><td>${doc.docNo || "-"}</td></tr>
        <tr><td style="padding:4px 12px 4px 0;"><b>Malzeme:</b></td><td>${doc.materialName || "-"}</td></tr>
        <tr><td style="padding:4px 12px 4px 0;"><b>Miktar:</b></td><td>${Number(doc.quantity || 0).toLocaleString("tr-TR")} ${doc.unit || ""}</td></tr>
        ${doc.supplierName ? `<tr><td style="padding:4px 12px 4px 0;"><b>Tedarikçi:</b></td><td>${doc.supplierName}</td></tr>` : ""}
        <tr><td style="padding:4px 12px 4px 0;"><b>Aciliyet:</b></td><td>${doc.urgency || "Normal"}</td></tr>
        <tr><td style="padding:4px 12px 4px 0;"><b>Talep Eden:</b></td><td>${doc.requestedBy || "-"}</td></tr>
      </table>

      <p style="margin-top:20px;color:#888;font-size:12px;">Bu mail CNC Mini ERP sistemi tarafından otomatik olarak gönderilmiştir.</p>
    </div>
  `;

  return sendMail({
    to: recipients,
    subject: `Yeni Satın Alma Talebi - ${doc.docNo || ""}`,
    html
  });
}

module.exports = {
  sendMail,
  sendNewOrderMail,
  sendPurchaseApprovalMail,
  sendNewPurchaseRequestMail,
  setMailSettings,
  getActiveConfig,
  initMailSettingsFromDb
};
