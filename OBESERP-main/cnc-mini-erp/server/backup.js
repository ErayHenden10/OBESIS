 const fs = require("fs");
const path = require("path");
const cron = require("node-cron");

const DB_PATH = "C:\\sqlitedbs\\erpcnc.db";
const BACKUP_FOLDER = "C:\\sqlitedbs\\backups";

// klasör yoksa oluştur
if (!fs.existsSync(BACKUP_FOLDER)) {
    fs.mkdirSync(BACKUP_FOLDER, { recursive: true });
}

function backupDatabase() {

    const now = new Date();

    const fileName =
        `${now.getFullYear()}-` +
        `${String(now.getMonth() + 1).padStart(2, "0")}-` +
        `${String(now.getDate()).padStart(2, "0")}_` +
        `${String(now.getHours()).padStart(2, "0")}-` +
        `${String(now.getMinutes()).padStart(2, "0")}.db`;

    const backupPath = path.join(BACKUP_FOLDER, fileName);

    fs.copyFile(DB_PATH, backupPath, (err) => {

        if (err) {
            console.error("❌ Backup alınamadı:", err);
            return;
        }

        console.log("✅ Backup oluşturuldu:", backupPath);

        deleteOldBackups();
    });
}

// Son 30 günlük yedeği sakla
function deleteOldBackups() {

    const files = fs.readdirSync(BACKUP_FOLDER)
        .map(file => ({
            file,
            time: fs.statSync(path.join(BACKUP_FOLDER, file)).mtime.getTime()
        }))
        .sort((a, b) => b.time - a.time);

    if (files.length <= 30) return;

    files.slice(30).forEach(f => {
        fs.unlinkSync(path.join(BACKUP_FOLDER, f.file));
        console.log("🗑 Silindi:", f.file);
    });

}

// Her gün 00:00
cron.schedule("0 0 * * *", () => {

    console.log("📦 Günlük SQLite Backup başladı...");

    backupDatabase();

});

console.log("📦 Backup Scheduler Aktif");