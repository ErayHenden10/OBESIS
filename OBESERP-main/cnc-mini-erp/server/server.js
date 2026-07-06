console.log("Mail Backup çalışıyor")
const express = require("express");
const cors = require("cors");
const path = require("path");
const fs = require("fs");
const cron = require("node-cron");
require("dotenv").config();

const { db, dbGet, dbAll, dbRun } = require("../config/db");
const { onlySuperAdmin } = require("../middlewares/auth");
const { addActivityLog } = require("../utils/activityLog");
const mailer = require("../utils/mailer");
const { sendMail, sendNewOrderMail, sendPurchaseApprovalMail, sendNewPurchaseRequestMail } = mailer;
const registerRoutes = require("../routes");

const app = express();
const PORT = process.env.PORT || 3000;
const rootDir = path.join(__dirname, "..");

const dbPath = "C:\\sqlitedbs\\erpcnc.db";
const backupDir = "C:\\sqlitedbs\\backups";

function backupDatabase() {
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }

  const now = new Date();

  const fileName =
    "erpcnc_backup_" +
    now.getFullYear() + "-" +
    String(now.getMonth() + 1).padStart(2, "0") + "-" +
    String(now.getDate()).padStart(2, "0") +
    "_" +
    String(now.getHours()).padStart(2, "0") + "-" +
    String(now.getMinutes()).padStart(2, "0") +
    ".db";

  const backupPath = path.join(backupDir, fileName);

  fs.copyFile(dbPath, backupPath, (err) => {
    if (err) {
      console.error("❌ SQLite yedek alınamadı:", err.message);
      return;
    }

    console.log("✅ SQLite yedek alındı:", backupPath);
  });
}

cron.schedule("0 0 * * *", () => {
  console.log("📦 Günlük veritabanı yedekleme başladı...");
  backupDatabase();
});

app.locals.db = db;

app.use(cors());
app.use(express.json({ limit: "25mb" }));
app.use(express.urlencoded({ extended: true, limit: "25mb" }));

app.use(express.static(path.join(rootDir, "public")));

app.get("/", (req, res) => {
  res.redirect("/giris.html");
});

registerRoutes(app, {
  db,
  dbGet,
  dbAll,
  dbRun,
  onlySuperAdmin,
  addActivityLog,
  sendMail,
  sendNewOrderMail,
  sendPurchaseApprovalMail,
  sendNewPurchaseRequestMail,
  path,
  rootDir
});

app.listen(PORT, async () => {
  console.log(`CNC Mini ERP ${PORT} portunda çalışıyor`);
  await mailer.initMailSettingsFromDb(dbGet);
  console.log("[mailer] Mail ayarları veritabanından yüklendi.");
});