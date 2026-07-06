module.exports = (app, ctx) => {
  const db = ctx.db || ctx.database || ctx.sqlite || ctx;

  if (!db || typeof db.run !== "function") {
    console.error("85-fikstur-yonetimi: db bulunamadı.");
    return;
  }

  db.run(`
    CREATE TABLE IF NOT EXISTS fixtures (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      fixture_code TEXT,
      fixture_name TEXT NOT NULL,
      fixture_type TEXT,
      part_no TEXT,
      part_name TEXT,
      machine_name TEXT,
      location TEXT,
      maintenance_period_day INTEGER DEFAULT 0,
      last_maintenance_date TEXT,
      next_maintenance_date TEXT,
      usage_count INTEGER DEFAULT 0,
      status TEXT DEFAULT 'active',
      description TEXT,
      created_by TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS fixture_movements (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      fixture_id INTEGER NOT NULL,
      movement_type TEXT NOT NULL,
      work_order_no TEXT,
      operator_name TEXT,
      machine_name TEXT,
      note TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  function generateFixtureCode(callback) {
    db.get(`SELECT COUNT(*) AS count FROM fixtures`, [], (err, row) => {
      if (err) return callback(err);
      const no = String((row?.count || 0) + 1).padStart(5, "0");
      callback(null, `FX-${no}`);
    });
  }

  function calculateNextMaintenanceDate(lastDate, periodDay) {
    if (!lastDate || !periodDay) return "";
    const date = new Date(lastDate);
    if (isNaN(date.getTime())) return "";
    date.setDate(date.getDate() + Number(periodDay || 0));
    return date.toISOString().slice(0, 10);
  }

  app.get("/api/fixtures", (req, res) => {
    db.all(`
      SELECT *
      FROM fixtures
      ORDER BY id DESC
    `, [], (err, rows) => {
      if (err) {
        return res.status(500).json({ success:false, message:err.message });
      }

      res.json({ success:true, data:rows || [] });
    });
  });

  app.get("/api/fixtures/kpi", (req, res) => {
    db.all(`
      SELECT *
      FROM fixtures
    `, [], (err, rows) => {
      if (err) {
        return res.status(500).json({ success:false, message:err.message });
      }

      const today = new Date().toISOString().slice(0, 10);
      const list = rows || [];

      const total = list.length;
      const active = list.filter(x => x.status === "active").length;
      const passive = list.filter(x => x.status === "passive").length;
      const maintenanceDue = list.filter(x =>
        x.next_maintenance_date &&
        x.next_maintenance_date <= today &&
        x.status === "active"
      ).length;

      res.json({
        success:true,
        data:{
          total,
          active,
          passive,
          maintenanceDue
        }
      });
    });
  });

  app.get("/api/fixtures/:id", (req, res) => {
    const id = req.params.id;

    db.get(`
      SELECT *
      FROM fixtures
      WHERE id = ?
    `, [id], (err, fixture) => {
      if (err) {
        return res.status(500).json({ success:false, message:err.message });
      }

      if (!fixture) {
        return res.status(404).json({ success:false, message:"Fikstür bulunamadı." });
      }

      db.all(`
        SELECT *
        FROM fixture_movements
        WHERE fixture_id = ?
        ORDER BY id DESC
      `, [id], (moveErr, movements) => {
        if (moveErr) {
          return res.status(500).json({ success:false, message:moveErr.message });
        }

        res.json({
          success:true,
          data:{
            fixture,
            movements:movements || []
          }
        });
      });
    });
  });

  app.post("/api/fixtures", (req, res) => {
    const {
      fixture_name,
      fixture_type,
      part_no,
      part_name,
      machine_name,
      location,
      maintenance_period_day,
      last_maintenance_date,
      status,
      description,
      created_by
    } = req.body;

    if (!fixture_name) {
      return res.status(400).json({
        success:false,
        message:"Fikstür adı zorunludur."
      });
    }

    generateFixtureCode((codeErr, fixtureCode) => {
      if (codeErr) {
        return res.status(500).json({ success:false, message:codeErr.message });
      }

      const nextMaintenanceDate = calculateNextMaintenanceDate(
        last_maintenance_date,
        maintenance_period_day
      );

      db.run(`
        INSERT INTO fixtures (
          fixture_code,
          fixture_name,
          fixture_type,
          part_no,
          part_name,
          machine_name,
          location,
          maintenance_period_day,
          last_maintenance_date,
          next_maintenance_date,
          status,
          description,
          created_by
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        fixtureCode,
        fixture_name,
        fixture_type || "",
        part_no || "",
        part_name || "",
        machine_name || "",
        location || "",
        Number(maintenance_period_day || 0),
        last_maintenance_date || "",
        nextMaintenanceDate,
        status || "active",
        description || "",
        created_by || ""
      ], function(err) {
        if (err) {
          return res.status(500).json({ success:false, message:err.message });
        }

        res.json({
          success:true,
          message:"Fikstür oluşturuldu.",
          id:this.lastID,
          fixture_code:fixtureCode
        });
      });
    });
  });

  app.put("/api/fixtures/:id", (req, res) => {
    const id = req.params.id;

    const {
      fixture_name,
      fixture_type,
      part_no,
      part_name,
      machine_name,
      location,
      maintenance_period_day,
      last_maintenance_date,
      status,
      description
    } = req.body;

    if (!fixture_name) {
      return res.status(400).json({
        success:false,
        message:"Fikstür adı zorunludur."
      });
    }

    const nextMaintenanceDate = calculateNextMaintenanceDate(
      last_maintenance_date,
      maintenance_period_day
    );

    db.run(`
      UPDATE fixtures
      SET
        fixture_name = ?,
        fixture_type = ?,
        part_no = ?,
        part_name = ?,
        machine_name = ?,
        location = ?,
        maintenance_period_day = ?,
        last_maintenance_date = ?,
        next_maintenance_date = ?,
        status = ?,
        description = ?
      WHERE id = ?
    `, [
      fixture_name,
      fixture_type || "",
      part_no || "",
      part_name || "",
      machine_name || "",
      location || "",
      Number(maintenance_period_day || 0),
      last_maintenance_date || "",
      nextMaintenanceDate,
      status || "active",
      description || "",
      id
    ], function(err) {
      if (err) {
        return res.status(500).json({ success:false, message:err.message });
      }

      res.json({
        success:true,
        message:"Fikstür güncellendi."
      });
    });
  });

  app.put("/api/fixtures/:id/status", (req, res) => {
    const id = req.params.id;
    const status = req.body.status || "passive";

    db.run(`
      UPDATE fixtures
      SET status = ?
      WHERE id = ?
    `, [status, id], function(err) {
      if (err) {
        return res.status(500).json({ success:false, message:err.message });
      }

      res.json({
        success:true,
        message:"Fikstür durumu güncellendi."
      });
    });
  });

  app.post("/api/fixtures/:id/movement", (req, res) => {
    const fixtureId = req.params.id;

    const {
      movement_type,
      work_order_no,
      operator_name,
      machine_name,
      note
    } = req.body;

    if (!movement_type) {
      return res.status(400).json({
        success:false,
        message:"Hareket tipi zorunludur."
      });
    }

    db.get(`
      SELECT *
      FROM fixtures
      WHERE id = ?
    `, [fixtureId], (findErr, fixture) => {
      if (findErr) {
        return res.status(500).json({ success:false, message:findErr.message });
      }

      if (!fixture) {
        return res.status(404).json({ success:false, message:"Fikstür bulunamadı." });
      }

      db.run(`
        INSERT INTO fixture_movements (
          fixture_id,
          movement_type,
          work_order_no,
          operator_name,
          machine_name,
          note
        )
        VALUES (?, ?, ?, ?, ?, ?)
      `, [
        fixtureId,
        movement_type,
        work_order_no || "",
        operator_name || "",
        machine_name || "",
        note || ""
      ], function(moveErr) {
        if (moveErr) {
          return res.status(500).json({ success:false, message:moveErr.message });
        }

        if (movement_type === "USE") {
          db.run(`
            UPDATE fixtures
            SET usage_count = IFNULL(usage_count, 0) + 1
            WHERE id = ?
          `, [fixtureId]);
        }

        res.json({
          success:true,
          message:"Fikstür hareketi kaydedildi.",
          id:this.lastID
        });
      });
    });
  });

  app.post("/api/fixtures/:id/maintenance", (req, res) => {
    const fixtureId = req.params.id;

    const {
      maintenance_date,
      operator_name,
      note
    } = req.body;

    const date = maintenance_date || new Date().toISOString().slice(0, 10);

    db.get(`
      SELECT *
      FROM fixtures
      WHERE id = ?
    `, [fixtureId], (findErr, fixture) => {
      if (findErr) {
        return res.status(500).json({ success:false, message:findErr.message });
      }

      if (!fixture) {
        return res.status(404).json({ success:false, message:"Fikstür bulunamadı." });
      }

      const nextMaintenanceDate = calculateNextMaintenanceDate(
        date,
        fixture.maintenance_period_day
      );

      db.run(`
        INSERT INTO fixture_movements (
          fixture_id,
          movement_type,
          work_order_no,
          operator_name,
          machine_name,
          note
        )
        VALUES (?, 'MAINTENANCE', '', ?, ?, ?)
      `, [
        fixtureId,
        operator_name || "",
        fixture.machine_name || "",
        note || "Bakım yapıldı"
      ], function(moveErr) {
        if (moveErr) {
          return res.status(500).json({ success:false, message:moveErr.message });
        }

        db.run(`
          UPDATE fixtures
          SET
            last_maintenance_date = ?,
            next_maintenance_date = ?
          WHERE id = ?
        `, [date, nextMaintenanceDate, fixtureId], (updateErr) => {
          if (updateErr) {
            return res.status(500).json({ success:false, message:updateErr.message });
          }

          res.json({
            success:true,
            message:"Fikstür bakımı kaydedildi.",
            next_maintenance_date:nextMaintenanceDate
          });
        });
      });
    });
  });
};