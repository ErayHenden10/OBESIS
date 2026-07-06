module.exports = function (app, ctx) {
  const db = ctx.db;

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

  function formatDateTime(date) {
    const d = new Date(date);
    const pad = n => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }

  function addHours(date, hours) {
    const d = new Date(date);
    d.setMinutes(d.getMinutes() + Number(hours || 0) * 60);
    return d;
  }

  async function initApsTables() {
    await run(`
      CREATE TABLE IF NOT EXISTS aps_machines (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        machine_code TEXT,
        machine_name TEXT NOT NULL,
        capability TEXT,
        daily_capacity_hours REAL DEFAULT 8,
        status TEXT DEFAULT 'active',
        current_load_hours REAL DEFAULT 0,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await run(`
      CREATE TABLE IF NOT EXISTS aps_tools (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        tool_code TEXT,
        tool_name TEXT NOT NULL,
        compatible_capability TEXT,
        status TEXT DEFAULT 'available',
        remaining_life_min INTEGER DEFAULT 9999,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await run(`
      CREATE TABLE IF NOT EXISTS aps_operators (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        full_name TEXT NOT NULL,
        skill TEXT,
        status TEXT DEFAULT 'available',
        shift_hours REAL DEFAULT 8,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await run(`
      CREATE TABLE IF NOT EXISTS aps_maintenance (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        machine_id INTEGER,
        maintenance_date TEXT,
        start_time TEXT,
        end_time TEXT,
        description TEXT,
        status TEXT DEFAULT 'planned',
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await run(`
      CREATE TABLE IF NOT EXISTS aps_plans (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        work_order_id INTEGER,
        machine_id INTEGER,
        operator_id INTEGER,
        tool_id INTEGER,
        estimated_hours REAL,
        score INTEGER,
        decision TEXT,
        reason TEXT,
        planned_start TEXT,
        planned_finish TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `);

    const count = await get(`SELECT COUNT(*) AS total FROM aps_machines`);

    if (!count || Number(count.total || 0) === 0) {
      await run(`
        INSERT INTO aps_machines 
        (machine_code, machine_name, capability, daily_capacity_hours, status, current_load_hours)
        VALUES
        ('CNC-01', 'CNC Dik İşleme 1', 'milling', 8, 'active', 2),
        ('CNC-02', 'CNC Dik İşleme 2', 'milling', 8, 'active', 5),
        ('TORNA-01', 'CNC Torna 1', 'turning', 8, 'active', 3),
        ('CNC-03', 'CNC 5 Eksen', '5axis', 8, 'maintenance', 6)
      `);

      await run(`
        INSERT INTO aps_tools
        (tool_code, tool_name, compatible_capability, status, remaining_life_min)
        VALUES
        ('T10', 'Freze Takımı Ø10', 'milling', 'available', 420),
        ('T12', 'Freze Takımı Ø12', 'milling', 'available', 180),
        ('T20', 'Torna Kesici', 'turning', 'available', 360),
        ('T99', '5 Eksen Özel Takım', '5axis', 'available', 90)
      `);

      await run(`
        INSERT INTO aps_operators
        (full_name, skill, status, shift_hours)
        VALUES
        ('Ahmet Yılmaz', 'milling', 'available', 8),
        ('Mehmet Kaya', 'turning', 'available', 8),
        ('Eray Henden', '5axis', 'available', 8),
        ('Ali Usta', 'milling', 'busy', 8)
      `);
    }
  }

  const initPromise = initApsTables();

  async function waitInit() {
    await initPromise;
  }

  async function evaluateAps(payload) {
    await waitInit();

    const workOrderId = payload.work_order_id || null;
    const machineId = Number(payload.machine_id);
    const estimatedHours = Number(payload.estimated_hours || 0);
    const requiredCapability = payload.required_capability;
    const dueDate = payload.due_date || null;

    if (!machineId || !estimatedHours || !requiredCapability) {
      return {
        score: 0,
        decision: "reject",
        title: "Eksik planlama bilgisi",
        reasons: ["Makine, tahmini süre ve işlem tipi zorunludur."],
        machine: null,
        selected_tool: null,
        selected_operator: null,
        planned_start: null,
        planned_finish: null,
        work_order_id: workOrderId
      };
    }

    const machine = await get(`SELECT * FROM aps_machines WHERE id = ?`, [machineId]);

    if (!machine) {
      return {
        score: 0,
        decision: "reject",
        title: "Bu işi bu makinede yapma",
        reasons: ["Seçilen makine APS makine listesinde yok."],
        machine: null,
        selected_tool: null,
        selected_operator: null,
        planned_start: null,
        planned_finish: null,
        work_order_id: workOrderId
      };
    }

    const tools = await all(`
      SELECT * FROM aps_tools 
      WHERE compatible_capability = ?
    `, [requiredCapability]);

    const operators = await all(`
      SELECT * FROM aps_operators 
      WHERE skill = ?
    `, [requiredCapability]);

    const maintenances = await all(`
      SELECT * FROM aps_maintenance
      WHERE machine_id = ?
        AND status = 'planned'
    `, [machineId]);

    let score = 100;
    const reasons = [];

    if (machine.status !== "active") {
      score -= 45;
      reasons.push("Makine aktif değil veya bakımda görünüyor.");
    }

    if (machine.capability !== requiredCapability) {
      score -= 40;
      reasons.push(`Makine kabiliyeti uygun değil. Gerekli: ${requiredCapability}, Makine: ${machine.capability}`);
    }

    const availableTool = tools.find(t =>
      t.status === "available" &&
      Number(t.remaining_life_min || 0) >= estimatedHours * 60
    );

    if (!availableTool) {
      score -= 25;
      reasons.push("Uygun takım yok veya takım ömrü bu iş için yetersiz.");
    }

    const availableOperator = operators.find(o => o.status === "available");

    if (!availableOperator) {
      score -= 20;
      reasons.push("Bu iş için uygun ve müsait operatör bulunamadı.");
    }

    const totalLoad = Number(machine.current_load_hours || 0) + estimatedHours;

    if (totalLoad > Number(machine.daily_capacity_hours || 8)) {
      score -= 20;
      reasons.push("Makinenin günlük kapasitesi bu iş ile aşılacak.");
    }

    const now = new Date();
    const finishDate = addHours(now, totalLoad);
    const due = dueDate ? new Date(dueDate) : null;

    if (due && finishDate > due) {
      score -= 25;
      reasons.push("Tahmini bitiş tarihi teslim tarihini geçiyor.");
    }

    if (maintenances.length > 0) {
      score -= 10;
      reasons.push("Makine için planlı bakım kaydı var. Çakışma kontrolü önerilir.");
    }

    if (score < 0) score = 0;

    let decision = "approve";
    let title = "Bu makinede yapılabilir";

    if (score < 50) {
      decision = "reject";
      title = "Bu işi bu makinede yapma";
    } else if (score < 75) {
      decision = "warning";
      title = "Riskli plan";
    }

    if (reasons.length === 0) {
      reasons.push("Makine, takım, operatör ve teslim tarihi açısından uygun görünüyor.");
    }

    return {
      score,
      decision,
      title,
      reasons,
      machine,
      selected_tool: availableTool || null,
      selected_operator: availableOperator || null,
      planned_start: formatDateTime(now),
      planned_finish: formatDateTime(finishDate),
      work_order_id: workOrderId
    };
  }

  app.get("/api/aps/data", async (req, res) => {
    try {
      await waitInit();

      const machines = await all(`SELECT * FROM aps_machines ORDER BY id DESC`);
      const tools = await all(`SELECT * FROM aps_tools ORDER BY id DESC`);
      const operators = await all(`SELECT * FROM aps_operators ORDER BY id DESC`);

      const plans = await all(`
        SELECT 
          p.*,
          m.machine_name,
          o.full_name AS operator_name,
          t.tool_name
        FROM aps_plans p
        LEFT JOIN aps_machines m ON m.id = p.machine_id
        LEFT JOIN aps_operators o ON o.id = p.operator_id
        LEFT JOIN aps_tools t ON t.id = p.tool_id
        ORDER BY p.id DESC
        LIMIT 20
      `);

      let workOrders = [];

      try {
        workOrders = await all(`
          SELECT 
            id,
            work_order_no,
            part_name,
            delivery_date,
            status
          FROM work_orders
          ORDER BY id DESC
          LIMIT 50
        `);
      } catch (e) {
        workOrders = [];
      }

      res.json({
        success: true,
        machines,
        tools,
        operators,
        plans,
        workOrders
      });
    } catch (err) {
      res.status(500).json({
        success: false,
        message: err.message
      });
    }
  });

  app.post("/api/aps/evaluate", async (req, res) => {
    try {
      const result = await evaluateAps(req.body);

      res.json({
        success: true,
        result
      });
    } catch (err) {
      res.status(500).json({
        success: false,
        message: err.message
      });
    }
  });

  app.post("/api/aps/schedule", async (req, res) => {
    try {
      await waitInit();

      const payload = req.body;
      const result = await evaluateAps(payload);

      if (result.decision === "reject") {
        return res.json({
          success: false,
          message: "APS bu işi bu makinede planlamayı reddetti.",
          result
        });
      }

      const insert = await run(`
        INSERT INTO aps_plans
        (
          work_order_id,
          machine_id,
          operator_id,
          tool_id,
          estimated_hours,
          score,
          decision,
          reason,
          planned_start,
          planned_finish
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        payload.work_order_id || null,
        Number(payload.machine_id),
        result.selected_operator ? result.selected_operator.id : null,
        result.selected_tool ? result.selected_tool.id : null,
        Number(payload.estimated_hours || 0),
        Number(result.score || 0),
        result.decision,
        result.reasons.join(" | "),
        result.planned_start,
        result.planned_finish
      ]);

      await run(`
        UPDATE aps_machines
        SET current_load_hours = COALESCE(current_load_hours, 0) + ?
        WHERE id = ?
      `, [
        Number(payload.estimated_hours || 0),
        Number(payload.machine_id)
      ]);

      res.json({
        success: true,
        message: "APS planı oluşturuldu.",
        plan_id: insert.lastID,
        result
      });

    } catch (err) {
      res.status(500).json({
        success: false,
        message: err.message
      });
    }
  });

  app.get("/api/aps/plans/:id", async (req, res) => {
    try {
      await waitInit();

      const plan = await get(`
        SELECT 
          p.*,
          m.machine_name,
          o.full_name AS operator_name,
          t.tool_name
        FROM aps_plans p
        LEFT JOIN aps_machines m ON m.id = p.machine_id
        LEFT JOIN aps_operators o ON o.id = p.operator_id
        LEFT JOIN aps_tools t ON t.id = p.tool_id
        WHERE p.id = ?
      `, [req.params.id]);

      if (!plan) {
        return res.status(404).json({
          success: false,
          message: "APS planı bulunamadı."
        });
      }

      res.json({
        success: true,
        plan
      });
    } catch (err) {
      res.status(500).json({
        success: false,
        message: err.message
      });
    }
  });
};