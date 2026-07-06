// Admin / Muhasebe / Satın Alma rolündeki kullanıcıları bulmak için ortak yardımcı.
// NOT: role alanı veritabanında bazen role_key (örn. "accounting"),
// bazen role_name (örn. "Muhasebe") olarak girilmiş olabiliyor; ikisini de kapsıyoruz.
// Tam eşleşme kullanılır (includes değil) — örn. "satınalmahariç" gibi benzer
// görünen ama farklı anlam taşıyan bir rolle yanlışlıkla eşleşmesin diye.
const AUTO_NOTIFY_ROLES = new Set([
  "admin", "superadmin", "süper admin",
  "accounting", "muhasebe",
  "purchasing", "satın alma", "satin alma"
]);

function isAutoNotifyRole(role) {
  if (!role) return false;
  return AUTO_NOTIFY_ROLES.has(String(role).trim().toLowerCase());
}

/**
 * Manuel seçilen kullanıcı ID'leri + admin/muhasebe/satın alma rolündeki
 * tüm aktif kullanıcıları tekilleştirilmiş şekilde döndürür.
 * @param {object} db - sqlite3 db instance
 * @param {number[]} manualUserIds
 * @param {(err: Error|null, recipients: Array<{id:number,email:string,full_name:string,role:string}>) => void} callback
 */
function getNotifyRecipients(db, manualUserIds, callback) {
  db.all(`SELECT id, email, full_name, role FROM users WHERE active = 1`, [], (err, allUsers) => {
    if (err) return callback(err);

    const manualIds = new Set((manualUserIds || []).map(Number));
    const recipientsMap = new Map();

    allUsers.forEach((u) => {
      if (!u.email) return;
      if (manualIds.has(u.id) || isAutoNotifyRole(u.role)) {
        recipientsMap.set(u.id, u);
      }
    });

    callback(null, Array.from(recipientsMap.values()));
  });
}

module.exports = { AUTO_NOTIFY_ROLES, isAutoNotifyRole, getNotifyRecipients };
