const multer = require("multer");
const fs = require("fs");
const path = require("path");
const documentUpload = require("../middlewares/documentUpload");
const uploadDir = path.join(__dirname, "../public/uploads/documents");

if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const documentStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const safeName = Buffer.from(file.originalname, "latin1")
      .toString("utf8")
      .replace(/[^\wğüşöçıİĞÜŞÖÇ.\-]/gi, "_");

    cb(null, Date.now() + "_" + safeName);
  }
});


// DOKÜMAN YÜKLE
module.exports = function register(app, ctx) {
  var db = ctx.db;
  var dbGet = ctx.dbGet;
  var dbAll = ctx.dbAll;
  var dbRun = ctx.dbRun;
  var path = ctx.path;
  var rootDir = ctx.rootDir;
  var onlySuperAdmin = ctx.onlySuperAdmin;
  var addActivityLog = ctx.addActivityLog;

// ===============================
// DOKÜMAN YÜKLE
// ===============================
app.post("/api/documents", documentUpload.single("file"), (req, res) => {
  const {
    document_name,
    document_type,
    related_type,
    related_id,
    description
  } = req.body;

  if (!document_name) {
    return res.status(400).json({
      success: false,
      message: "Doküman adı zorunludur."
    });
  }

  if (!req.file) {
    return res.status(400).json({
      success: false,
      message: "Dosya seçilmelidir."
    });
  }

  generateDocumentNo((noErr, documentNo) => {
    if (noErr) {
      return res.status(500).json({
        success: false,
        message: noErr.message
      });
    }

    db.run(`
      INSERT INTO documents (
        document_no,
        document_name,
        document_type,
        file_name,
        original_file_name,
        file_path,
        file_ext,
        file_size,
        related_type,
        related_id,
        description,
        uploaded_by
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      documentNo,
      document_name,
      document_type || "Genel",
      req.file.filename,
      req.file.originalname,
      "/uploads/documents/" + req.file.filename,
      path.extname(req.file.originalname).toLowerCase(),
      req.file.size,
      related_type || null,
      related_id || null,
      description || null,
      req.headers["x-user-name"] || "Sistem"
    ], function(err) {
      if (err) {
        console.error("Doküman kayıt hatası:", err);
        return res.status(500).json({
          success: false,
          message: err.message
        });
      }

      res.json({
        success: true,
        message: "Doküman başarıyla yüklendi.",
        id: this.lastID,
        document_no: documentNo
      });
    });
  });
});

};
