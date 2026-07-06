module.exports = function (app, ctx) {
  const db = ctx.db;

  console.log("104-digital-twin.js yüklendi");

  function run(sql, params = []) {
    return new Promise((resolve, reject) => {
      db.run(sql, params, function (err) {
        if (err) reject(err);
        else resolve(this);
      });
    });
  }

  function all(sql, params = []) {
    return new Promise((resolve, reject) => {
      db.all(sql, params, (err, rows) => {
        if (err) reject(err);
        else resolve(rows || []);
      });
    });
  }

  function get(sql, params = []) {
    return new Promise((resolve, reject) => {
      db.get(sql, params, (err, row) => {
        if (err) reject(err);
        else resolve(row || null);
      });
    });
  }

  async function initDigitalTwinTables() {
    await run(`
      CREATE TABLE IF NOT EXISTS digital_twin_machines (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        machine_code TEXT,
        machine_name TEXT NOT NULL,
        machine_type TEXT,
        status TEXT DEFAULT 'running',
        program_no TEXT,
        operator_name TEXT,
        work_order_no TEXT,
        part_name TEXT,
        current_tool TEXT,
        spindle_rpm INTEGER DEFAULT 0,
        feed_rate INTEGER DEFAULT 0,
        temperature REAL DEFAULT 0,
        vibration_status TEXT DEFAULT 'normal',
        oee REAL DEFAULT 0,
        cycle_time TEXT,
        estimated_finish TEXT,
        last_signal_at TEXT DEFAULT CURRENT_TIMESTAMP,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await run(`
      CREATE TABLE IF NOT EXISTS digital_twin_events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        machine_id INTEGER,
        event_type TEXT,
        title TEXT,
        description TEXT,
        severity TEXT DEFAULT 'info',
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await run(`
      CREATE TABLE IF NOT EXISTS digital_twin_alarms (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        machine_id INTEGER,
        alarm_code TEXT,
        alarm_text TEXT,
        severity TEXT DEFAULT 'warning',
        status TEXT DEFAULT 'open',
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `);

    const count = await get(`SELECT COUNT(*) AS total FROM digital_twin_machines`);

    if (!count || Number(count.total || 0) === 0) {
      await run(`
        INSERT INTO digital_twin_machines
        (
          machine_code,
          machine_name,
          machine_type,
          status,
          program_no,
          operator_name,
          work_order_no,
          part_name,
          current_tool,
          spindle_rpm,
          feed_rate,
          temperature,
          vibration_status,
          oee,
          cycle_time,
          estimated_finish
        )
        VALUES
        ('CNC-01', 'CNC Dik İşleme 1', 'Dik İşleme', 'running', 'O1542', 'Ahmet Yılmaz', 'WO-1035', 'Flanş', 'T12', 9800, 4500, 37.5, 'normal', 92, '00:01:42', '14:42'),
        ('CNC-02', 'CNC Dik İşleme 2', 'Dik İşleme', 'idle', 'O1180', 'Ali Usta', 'WO-1036', 'Kapak', 'T10', 0, 0, 31.2, 'normal', 74, '00:00:00', 'Beklemede'),
        ('TORNA-01', 'CNC Torna 1', 'Torna', 'running', 'O2205', 'Mehmet Kaya', 'WO-1037', 'Mil', 'T20', 4200, 1800, 39.1, 'normal', 88, '00:02:18', '15:10'),
        ('CNC-03', 'CNC 5 Eksen', '5 Eksen', 'alarm', 'O5001', 'Eray Henden', 'WO-1038', 'Özel Parça', 'T99', 0, 0, 42.8, 'yüksek', 55, '00:00:00', 'Duruşta')
      `);

      await run(`
        INSERT INTO digital_twin_events
        (machine_id, event_type, title, description, severity)
        VALUES
        (1, 'start', 'İş emri başladı', 'WO-1035 üretime alındı.', 'success'),
        (1, 'tool', 'Takım değişimi', 'T10 yerine T12 bağlandı.', 'info'),
        (1, 'quality', 'Kalite kontrol', 'İlk parça onayı alındı.', 'success'),
        (2, 'idle', 'Makine beklemede', 'Operatör ataması bekleniyor.', 'warning'),
        (3, 'start', 'Çevrim başladı', 'Torna operasyonu başladı.', 'success'),
        (4, 'alarm', 'Makine alarm verdi', 'Titreşim seviyesi yüksek.', 'danger')
      `);

      await run(`
        INSERT INTO digital_twin_alarms
        (machine_id, alarm_code, alarm_text, severity, status)
        VALUES
        (4, 'ALM-220', 'Titreşim limiti aşıldı.', 'danger', 'open'),
        (2, 'WRN-105', 'Uzun bekleme süresi.', 'warning', 'open')
      `);
    }
  }

  const initPromise = initDigitalTwinTables();

  async function waitInit() {
    await initPromise;
  }

  app.get("/api/digital-twin/data", async (req, res) => {
    try {
      await waitInit();

      const machines = await all(`
        SELECT *
        FROM digital_twin_machines
        ORDER BY 
          CASE status
            WHEN 'alarm' THEN 1
            WHEN 'running' THEN 2
            WHEN 'idle' THEN 3
            WHEN 'maintenance' THEN 4
            ELSE 5
          END,
          id ASC
      `);

      const events = await all(`
        SELECT 
          e.*,
          m.machine_name,
          m.machine_code
        FROM digital_twin_events e
        LEFT JOIN digital_twin_machines m ON m.id = e.machine_id
        ORDER BY e.id DESC
        LIMIT 30
      `);

      const alarms = await all(`
        SELECT 
          a.*,
          m.machine_name,
          m.machine_code
        FROM digital_twin_alarms a
        LEFT JOIN digital_twin_machines m ON m.id = a.machine_id
        WHERE a.status = 'open'
        ORDER BY a.id DESC
      `);

      const running = machines.filter(x => x.status === "running").length;
      const idle = machines.filter(x => x.status === "idle").length;
      const alarm = machines.filter(x => x.status === "alarm").length;

      const avgOee = machines.length
        ? Math.round(machines.reduce((sum, x) => sum + Number(x.oee || 0), 0) / machines.length)
        : 0;

      res.json({
        success: true,
        summary: {
          totalMachines: machines.length,
          running,
          idle,
          alarm,
          avgOee
        },
        machines,
        events,
        alarms
      });

    } catch (err) {
      res.status(500).json({
        success: false,
        message: err.message
      });
    }
  });

  app.get("/api/digital-twin/machines/:id", async (req, res) => {
    try {
      await waitInit();

      const machine = await get(`
        SELECT *
        FROM digital_twin_machines
        WHERE id = ?
      `, [req.params.id]);

      if (!machine) {
        return res.status(404).json({
          success: false,
          message: "Makine dijital ikizi bulunamadı."
        });
      }

      const events = await all(`
        SELECT *
        FROM digital_twin_events
        WHERE machine_id = ?
        ORDER BY id DESC
        LIMIT 20
      `, [req.params.id]);

      const alarms = await all(`
        SELECT *
        FROM digital_twin_alarms
        WHERE machine_id = ?
        ORDER BY id DESC
        LIMIT 20
      `, [req.params.id]);

      res.json({
        success: true,
        machine,
        events,
        alarms
      });

    } catch (err) {
      res.status(500).json({
        success: false,
        message: err.message
      });
    }
  });

  app.post("/api/digital-twin/machines/:id/signal", async (req, res) => {
    try {
      await waitInit();

      const {
        status,
        program_no,
        operator_name,
        work_order_no,
        part_name,
        current_tool,
        spindle_rpm,
        feed_rate,
        temperature,
        vibration_status,
        oee,
        cycle_time,
        estimated_finish
      } = req.body;

      await run(`
        UPDATE digital_twin_machines
        SET
          status = COALESCE(?, status),
          program_no = COALESCE(?, program_no),
          operator_name = COALESCE(?, operator_name),
          work_order_no = COALESCE(?, work_order_no),
          part_name = COALESCE(?, part_name),
          current_tool = COALESCE(?, current_tool),
          spindle_rpm = COALESCE(?, spindle_rpm),
          feed_rate = COALESCE(?, feed_rate),
          temperature = COALESCE(?, temperature),
          vibration_status = COALESCE(?, vibration_status),
          oee = COALESCE(?, oee),
          cycle_time = COALESCE(?, cycle_time),
          estimated_finish = COALESCE(?, estimated_finish),
          last_signal_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `, [
        status || null,
        program_no || null,
        operator_name || null,
        work_order_no || null,
        part_name || null,
        current_tool || null,
        spindle_rpm ?? null,
        feed_rate ?? null,
        temperature ?? null,
        vibration_status || null,
        oee ?? null,
        cycle_time || null,
        estimated_finish || null,
        req.params.id
      ]);

      await run(`
        INSERT INTO digital_twin_events
        (machine_id, event_type, title, description, severity)
        VALUES (?, 'signal', 'Canlı sinyal güncellendi', 'Makine canlı verileri güncellendi.', 'info')
      `, [req.params.id]);

      res.json({
        success: true,
        message: "Makine sinyali güncellendi."
      });

    } catch (err) {
      res.status(500).json({
        success: false,
        message: err.message
      });
    }
  });
};