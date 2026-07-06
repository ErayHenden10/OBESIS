const fs = require("fs");
const path = require("path");
const multer = require("multer");

module.exports = (app, ctx) => {
  const db = ctx.db || ctx.database || ctx.sqlite || ctx;

  if (!db || typeof db.run !== "function") {
    console.error("84-nc-program-yonetimi: db bulunamadı.");
    return;
  }

  const uploadDir = path.join(__dirname, "..", "public", "uploads", "nc-programs");

  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
  }

  const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadDir),
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname);
      const base = path.basename(file.originalname, ext).replace(/[^a-zA-Z0-9-_]/g, "_");
      cb(null, `${Date.now()}-${base}${ext}`);
    }
  });

  const upload = multer({
    storage,
    fileFilter: (req, file, cb) => {
      const allowed = [".nc", ".cnc", ".tap", ".txt", ".min", ".iso", ".eia"];
      const ext = path.extname(file.originalname).toLowerCase();

      if (!allowed.includes(ext)) {
        return cb(new Error("Sadece NC/CNC program dosyaları yüklenebilir."));
      }

      cb(null, true);
    }
  });

  db.run(`
    CREATE TABLE IF NOT EXISTS nc_programs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      program_no TEXT,
      program_name TEXT NOT NULL,
      part_no TEXT,
      part_name TEXT,
      machine_name TEXT,
      customer_name TEXT,
      work_order_no TEXT,
      operation_no TEXT,
      description TEXT,
      active_revision_id INTEGER,
      status TEXT DEFAULT 'active',
      created_by TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS nc_program_revisions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      program_id INTEGER NOT NULL,
      revision_no TEXT NOT NULL,
      file_name TEXT,
      original_file_name TEXT,
      file_path TEXT,
      file_size INTEGER DEFAULT 0,
      change_note TEXT,
      uploaded_by TEXT,
      is_active INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  function generateProgramNo(callback) {
    db.get(`
      SELECT COUNT(*) AS count 
      FROM nc_programs
    `, [], (err, row) => {
      if (err) return callback(err);

      const number = String((row?.count || 0) + 1).padStart(5, "0");
      callback(null, `NC-${number}`);
    });
  }

  app.get("/api/nc-programs", (req, res) => {
    db.all(`
      SELECT 
        p.*,
        r.revision_no AS active_revision_no,
        r.original_file_name AS active_file_name,
        r.file_path AS active_file_path,
        r.created_at AS active_revision_date
      FROM nc_programs p
      LEFT JOIN nc_program_revisions r ON r.id = p.active_revision_id
      ORDER BY p.id DESC
    `, [], (err, rows) => {
      if (err) {
        return res.status(500).json({ success:false, message:err.message });
      }

      res.json({ success:true, data:rows || [] });
    });
  });

  app.get("/api/nc-programs/:id", (req, res) => {
    const id = req.params.id;

    db.get(`
      SELECT 
        p.*,
        r.revision_no AS active_revision_no,
        r.original_file_name AS active_file_name,
        r.file_path AS active_file_path
      FROM nc_programs p
      LEFT JOIN nc_program_revisions r ON r.id = p.active_revision_id
      WHERE p.id = ?
    `, [id], (err, program) => {
      if (err) {
        return res.status(500).json({ success:false, message:err.message });
      }

      if (!program) {
        return res.status(404).json({ success:false, message:"NC program bulunamadı." });
      }

      db.all(`
        SELECT *
        FROM nc_program_revisions
        WHERE program_id = ?
        ORDER BY id DESC
      `, [id], (revErr, revisions) => {
        if (revErr) {
          return res.status(500).json({ success:false, message:revErr.message });
        }

        res.json({
          success:true,
          data:{
            program,
            revisions:revisions || []
          }
        });
      });
    });
  });

  app.post("/api/nc-programs", upload.single("file"), (req, res) => {
    const {
      program_name,
      part_no,
      part_name,
      machine_name,
      customer_name,
      work_order_no,
      operation_no,
      description,
      revision_no,
      change_note,
      created_by
    } = req.body;

    if (!program_name) {
      return res.status(400).json({
        success:false,
        message:"Program adı zorunludur."
      });
    }

    generateProgramNo((noErr, programNo) => {
      if (noErr) {
        return res.status(500).json({ success:false, message:noErr.message });
      }

      db.run(`
        INSERT INTO nc_programs (
          program_no,
          program_name,
          part_no,
          part_name,
          machine_name,
          customer_name,
          work_order_no,
          operation_no,
          description,
          status,
          created_by
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', ?)
      `, [
        programNo,
        program_name,
        part_no || "",
        part_name || "",
        machine_name || "",
        customer_name || "",
        work_order_no || "",
        operation_no || "",
        description || "",
        created_by || ""
      ], function (err) {
        if (err) {
          return res.status(500).json({ success:false, message:err.message });
        }

        const programId = this.lastID;

        if (!req.file) {
          return res.json({
            success:true,
            message:"NC program oluşturuldu.",
            id:programId
          });
        }

        const relativePath = `/uploads/nc-programs/${req.file.filename}`;

        db.run(`
          INSERT INTO nc_program_revisions (
            program_id,
            revision_no,
            file_name,
            original_file_name,
            file_path,
            file_size,
            change_note,
            uploaded_by,
            is_active
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)
        `, [
          programId,
          revision_no || "R0",
          req.file.filename,
          req.file.originalname,
          relativePath,
          req.file.size || 0,
          change_note || "İlk revizyon",
          created_by || ""
        ], function (revErr) {
          if (revErr) {
            return res.status(500).json({ success:false, message:revErr.message });
          }

          const revisionId = this.lastID;

          db.run(`
            UPDATE nc_programs
            SET active_revision_id = ?
            WHERE id = ?
          `, [revisionId, programId], (updateErr) => {
            if (updateErr) {
              return res.status(500).json({ success:false, message:updateErr.message });
            }

            res.json({
              success:true,
              message:"NC program ve ilk revizyon oluşturuldu.",
              id:programId,
              revision_id:revisionId
            });
          });
        });
      });
    });
  });

  app.put("/api/nc-programs/:id", (req, res) => {
    const id = req.params.id;

    const {
      program_name,
      part_no,
      part_name,
      machine_name,
      customer_name,
      work_order_no,
      operation_no,
      description,
      status
    } = req.body;

    if (!program_name) {
      return res.status(400).json({
        success:false,
        message:"Program adı zorunludur."
      });
    }

    db.run(`
      UPDATE nc_programs
      SET
        program_name = ?,
        part_no = ?,
        part_name = ?,
        machine_name = ?,
        customer_name = ?,
        work_order_no = ?,
        operation_no = ?,
        description = ?,
        status = ?
      WHERE id = ?
    `, [
      program_name,
      part_no || "",
      part_name || "",
      machine_name || "",
      customer_name || "",
      work_order_no || "",
      operation_no || "",
      description || "",
      status || "active",
      id
    ], function (err) {
      if (err) {
        return res.status(500).json({ success:false, message:err.message });
      }

      res.json({
        success:true,
        message:"NC program güncellendi."
      });
    });
  });

  app.post("/api/nc-programs/:id/revisions", upload.single("file"), (req, res) => {
    const programId = req.params.id;

    const {
      revision_no,
      change_note,
      uploaded_by
    } = req.body;

    if (!req.file) {
      return res.status(400).json({
        success:false,
        message:"Revizyon dosyası zorunludur."
      });
    }

    db.get(`
      SELECT *
      FROM nc_programs
      WHERE id = ?
    `, [programId], (findErr, program) => {
      if (findErr) {
        return res.status(500).json({ success:false, message:findErr.message });
      }

      if (!program) {
        return res.status(404).json({ success:false, message:"NC program bulunamadı." });
      }

      const relativePath = `/uploads/nc-programs/${req.file.filename}`;

      db.run(`
        UPDATE nc_program_revisions
        SET is_active = 0
        WHERE program_id = ?
      `, [programId], (passiveErr) => {
        if (passiveErr) {
          return res.status(500).json({ success:false, message:passiveErr.message });
        }

        db.run(`
          INSERT INTO nc_program_revisions (
            program_id,
            revision_no,
            file_name,
            original_file_name,
            file_path,
            file_size,
            change_note,
            uploaded_by,
            is_active
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)
        `, [
          programId,
          revision_no || "R1",
          req.file.filename,
          req.file.originalname,
          relativePath,
          req.file.size || 0,
          change_note || "",
          uploaded_by || ""
        ], function (revErr) {
          if (revErr) {
            return res.status(500).json({ success:false, message:revErr.message });
          }

          const revisionId = this.lastID;

          db.run(`
            UPDATE nc_programs
            SET active_revision_id = ?
            WHERE id = ?
          `, [revisionId, programId], (updateErr) => {
            if (updateErr) {
              return res.status(500).json({ success:false, message:updateErr.message });
            }

            res.json({
              success:true,
              message:"Yeni NC revizyonu yüklendi.",
              revision_id:revisionId
            });
          });
        });
      });
    });
  });

  app.put("/api/nc-program-revisions/:id/activate", (req, res) => {
    const revisionId = req.params.id;

    db.get(`
      SELECT *
      FROM nc_program_revisions
      WHERE id = ?
    `, [revisionId], (err, revision) => {
      if (err) {
        return res.status(500).json({ success:false, message:err.message });
      }

      if (!revision) {
        return res.status(404).json({ success:false, message:"Revizyon bulunamadı." });
      }

      db.run(`
        UPDATE nc_program_revisions
        SET is_active = 0
        WHERE program_id = ?
      `, [revision.program_id], (passiveErr) => {
        if (passiveErr) {
          return res.status(500).json({ success:false, message:passiveErr.message });
        }

        db.run(`
          UPDATE nc_program_revisions
          SET is_active = 1
          WHERE id = ?
        `, [revisionId], (activeErr) => {
          if (activeErr) {
            return res.status(500).json({ success:false, message:activeErr.message });
          }

          db.run(`
            UPDATE nc_programs
            SET active_revision_id = ?
            WHERE id = ?
          `, [revisionId, revision.program_id], (updateErr) => {
            if (updateErr) {
              return res.status(500).json({ success:false, message:updateErr.message });
            }

            res.json({
              success:true,
              message:"Aktif revizyon değiştirildi."
            });
          });
        });
      });
    });
  });

  app.put("/api/nc-programs/:id/status", (req, res) => {
    const id = req.params.id;
    const status = req.body.status || "passive";

    db.run(`
      UPDATE nc_programs
      SET status = ?
      WHERE id = ?
    `, [status, id], function (err) {
      if (err) {
        return res.status(500).json({ success:false, message:err.message });
      }

      res.json({
        success:true,
        message:"Program durumu güncellendi."
      });
    });
  });
};