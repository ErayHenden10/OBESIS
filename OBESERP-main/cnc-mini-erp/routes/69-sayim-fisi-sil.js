// SAYIM FİŞİ SİL
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
// SAYIM FİŞİ SİL
// ===============================
app.delete("/api/stock-counts/:id", (req, res) => {
  const id = req.params.id;

  db.get(`
    SELECT *
    FROM stock_counts
    WHERE id = ?
  `, [id], (err, count) => {
    if (err) {
      return res.status(500).json({
        success: false,
        message: err.message
      });
    }

    if (!count) {
      return res.status(404).json({
        success: false,
        message: "Sayım fişi bulunamadı."
      });
    }

    if (count.status === "Onaylandı") {
      return res.status(400).json({
        success: false,
        message: "Onaylanmış sayım fişi silinemez."
      });
    }

    db.serialize(() => {
      db.run("DELETE FROM stock_count_lines WHERE stock_count_id = ?", [id]);
      db.run("DELETE FROM stock_counts WHERE id = ?", [id], function(deleteErr) {
        if (deleteErr) {
          return res.status(500).json({
            success: false,
            message: deleteErr.message
          });
        }

        res.json({
          success: true,
          message: "Sayım fişi silindi."
        });
      });
    });
  });
});

/* =========================================================
   CNC ERP - 6 MODÜL BACKEND
   1) Takım Yönetimi
   2) Kalibrasyon Takibi
   3) Üretim Planlama
   4) OEE Takibi
   5) Satış Siparişi Yönetimi
   6) Müşteri Portalı
========================================================= */

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
      else resolve(rows);
    });
  });
}

function get(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
}

/* ===================== TABLOLAR ===================== */

db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS cutting_tools (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tool_code TEXT UNIQUE,
      tool_name TEXT NOT NULL,
      tool_type TEXT,
      diameter REAL,
      brand TEXT,
      stock_qty INTEGER DEFAULT 0,
      min_qty INTEGER DEFAULT 0,
      max_life_minutes INTEGER DEFAULT 0,
      used_minutes INTEGER DEFAULT 0,
      status TEXT DEFAULT 'Aktif',
      location TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS tool_usages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tool_id INTEGER,
      work_order_id INTEGER,
      machine_id INTEGER,
      operator_id INTEGER,
      usage_minutes INTEGER DEFAULT 0,
      usage_date DATETIME DEFAULT CURRENT_TIMESTAMP,
      note TEXT
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS calibration_devices (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      device_code TEXT UNIQUE,
      device_name TEXT NOT NULL,
      device_type TEXT,
      brand TEXT,
      serial_no TEXT,
      last_calibration_date DATE,
      next_calibration_date DATE,
      certificate_no TEXT,
      status TEXT DEFAULT 'Aktif',
      location TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS calibration_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      device_id INTEGER,
      calibration_date DATE,
      next_date DATE,
      company TEXT,
      result TEXT,
      certificate_file TEXT,
      note TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS production_schedule (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      schedule_no TEXT UNIQUE,
      work_order_id INTEGER,
      machine_id INTEGER,
      operator_id INTEGER,
      planned_start DATETIME,
      planned_end DATETIME,
      priority TEXT DEFAULT 'Normal',
      status TEXT DEFAULT 'Planlandı',
      note TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS machine_capacity (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      machine_id INTEGER,
      work_date DATE,
      available_minutes INTEGER DEFAULT 480,
      planned_minutes INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS oee_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      machine_id INTEGER,
      work_date DATE,
      planned_minutes INTEGER DEFAULT 0,
      working_minutes INTEGER DEFAULT 0,
      ideal_cycle_time REAL DEFAULT 0,
      produced_qty INTEGER DEFAULT 0,
      good_qty INTEGER DEFAULT 0,
      scrap_qty INTEGER DEFAULT 0,
      availability REAL DEFAULT 0,
      performance REAL DEFAULT 0,
      quality REAL DEFAULT 0,
      oee REAL DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS sales_orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_no TEXT UNIQUE,
      customer_id INTEGER,
      offer_id INTEGER,
      order_date DATE,
      delivery_date DATE,
      status TEXT DEFAULT 'Açık',
      total_amount REAL DEFAULT 0,
      note TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS sales_order_lines (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sales_order_id INTEGER,
      part_name TEXT,
      description TEXT,
      quantity REAL DEFAULT 0,
      unit TEXT DEFAULT 'Adet',
      unit_price REAL DEFAULT 0,
      total_price REAL DEFAULT 0,
      delivery_date DATE,
      status TEXT DEFAULT 'Açık'
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS customer_portal_users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      customer_id INTEGER,
      username TEXT UNIQUE,
      password TEXT,
      full_name TEXT,
      email TEXT,
      active INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
});

/* ===================== 1. TAKIM YÖNETİMİ ===================== */

app.get("/api/tools", async (req, res) => {
  try {
    const rows = await all(`
      SELECT *,
      CASE
        WHEN max_life_minutes > 0 AND used_minutes >= max_life_minutes THEN 'Ömrü Bitti'
        WHEN max_life_minutes > 0 AND used_minutes >= max_life_minutes * 0.8 THEN 'Yakında Değişmeli'
        ELSE status
      END AS life_status
      FROM cutting_tools
      ORDER BY id DESC
    `);
    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.post("/api/tools", async (req, res) => {
  try {
    const {
      tool_code, tool_name, tool_type, diameter, brand,
      stock_qty, min_qty, max_life_minutes, location
    } = req.body;

    await run(`
      INSERT INTO cutting_tools
      (tool_code, tool_name, tool_type, diameter, brand, stock_qty, min_qty, max_life_minutes, location)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      tool_code, tool_name, tool_type, diameter, brand,
      stock_qty || 0, min_qty || 0, max_life_minutes || 0, location
    ]);

    res.json({ success: true, message: "Takım eklendi." });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.put("/api/tools/:id", async (req, res) => {
  try {
    const {
      tool_code, tool_name, tool_type, diameter, brand,
      stock_qty, min_qty, max_life_minutes, used_minutes, status, location
    } = req.body;

    await run(`
      UPDATE cutting_tools SET
      tool_code=?, tool_name=?, tool_type=?, diameter=?, brand=?,
      stock_qty=?, min_qty=?, max_life_minutes=?, used_minutes=?, status=?, location=?
      WHERE id=?
    `, [
      tool_code, tool_name, tool_type, diameter, brand,
      stock_qty || 0, min_qty || 0, max_life_minutes || 0,
      used_minutes || 0, status || "Aktif", location, req.params.id
    ]);

    res.json({ success: true, message: "Takım güncellendi." });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.delete("/api/tools/:id", async (req, res) => {
  try {
    await run(`DELETE FROM cutting_tools WHERE id=?`, [req.params.id]);
    res.json({ success: true, message: "Takım silindi." });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.post("/api/tools/:id/usage", async (req, res) => {
  try {
    const { work_order_id, machine_id, operator_id, usage_minutes, note } = req.body;

    await run(`
      INSERT INTO tool_usages
      (tool_id, work_order_id, machine_id, operator_id, usage_minutes, note)
      VALUES (?, ?, ?, ?, ?, ?)
    `, [req.params.id, work_order_id, machine_id, operator_id, usage_minutes || 0, note]);

    await run(`
      UPDATE cutting_tools
      SET used_minutes = used_minutes + ?
      WHERE id=?
    `, [usage_minutes || 0, req.params.id]);

    res.json({ success: true, message: "Takım kullanımı işlendi." });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

/* ===================== 2. KALİBRASYON ===================== */

app.get("/api/calibration-devices", async (req, res) => {
  try {
    const rows = await all(`
      SELECT *,
      CASE
        WHEN next_calibration_date < date('now') THEN 'Gecikti'
        WHEN next_calibration_date <= date('now', '+15 day') THEN 'Yaklaşıyor'
        ELSE 'Uygun'
      END AS calibration_status
      FROM calibration_devices
      ORDER BY next_calibration_date ASC
    `);
    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.post("/api/calibration-devices", async (req, res) => {
  try {
    const {
      device_code, device_name, device_type, brand, serial_no,
      last_calibration_date, next_calibration_date, certificate_no, location
    } = req.body;

    await run(`
      INSERT INTO calibration_devices
      (device_code, device_name, device_type, brand, serial_no,
       last_calibration_date, next_calibration_date, certificate_no, location)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      device_code, device_name, device_type, brand, serial_no,
      last_calibration_date, next_calibration_date, certificate_no, location
    ]);

    res.json({ success: true, message: "Cihaz eklendi." });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.put("/api/calibration-devices/:id", async (req, res) => {
  try {
    const {
      device_code, device_name, device_type, brand, serial_no,
      last_calibration_date, next_calibration_date, certificate_no, status, location
    } = req.body;

    await run(`
      UPDATE calibration_devices SET
      device_code=?, device_name=?, device_type=?, brand=?, serial_no=?,
      last_calibration_date=?, next_calibration_date=?, certificate_no=?, status=?, location=?
      WHERE id=?
    `, [
      device_code, device_name, device_type, brand, serial_no,
      last_calibration_date, next_calibration_date, certificate_no,
      status || "Aktif", location, req.params.id
    ]);

    res.json({ success: true, message: "Cihaz güncellendi." });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.delete("/api/calibration-devices/:id", async (req, res) => {
  try {
    await run(`DELETE FROM calibration_devices WHERE id=?`, [req.params.id]);
    res.json({ success: true, message: "Cihaz silindi." });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.post("/api/calibration-devices/:id/record", async (req, res) => {
  try {
    const { calibration_date, next_date, company, result, certificate_file, note } = req.body;

    await run(`
      INSERT INTO calibration_records
      (device_id, calibration_date, next_date, company, result, certificate_file, note)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [req.params.id, calibration_date, next_date, company, result, certificate_file, note]);

    await run(`
      UPDATE calibration_devices
      SET last_calibration_date=?, next_calibration_date=?, status='Aktif'
      WHERE id=?
    `, [calibration_date, next_date, req.params.id]);

    res.json({ success: true, message: "Kalibrasyon kaydı işlendi." });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

/* ===================== 3. ÜRETİM PLANLAMA ===================== */

app.get("/api/production-schedule", async (req, res) => {
  try {
    const rows = await all(`
      SELECT ps.*,
             wo.work_order_no,
             wo.title AS work_order_title,
             m.machine_name,
             e.full_name AS operator_name
      FROM production_schedule ps
      LEFT JOIN work_orders wo ON wo.id = ps.work_order_id
      LEFT JOIN machines m ON m.id = ps.machine_id
      LEFT JOIN employees e ON e.id = ps.operator_id
      ORDER BY ps.planned_start ASC
    `);
    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.post("/api/production-schedule", async (req, res) => {
  try {
    const {
      schedule_no, work_order_id, machine_id, operator_id,
      planned_start, planned_end, priority, note
    } = req.body;

    await run(`
      INSERT INTO production_schedule
      (schedule_no, work_order_id, machine_id, operator_id, planned_start, planned_end, priority, note)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      schedule_no, work_order_id, machine_id, operator_id,
      planned_start, planned_end, priority || "Normal", note
    ]);

    res.json({ success: true, message: "Üretim planı eklendi." });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.put("/api/production-schedule/:id", async (req, res) => {
  try {
    const {
      schedule_no, work_order_id, machine_id, operator_id,
      planned_start, planned_end, priority, status, note
    } = req.body;

    await run(`
      UPDATE production_schedule SET
      schedule_no=?, work_order_id=?, machine_id=?, operator_id=?,
      planned_start=?, planned_end=?, priority=?, status=?, note=?
      WHERE id=?
    `, [
      schedule_no, work_order_id, machine_id, operator_id,
      planned_start, planned_end, priority || "Normal", status || "Planlandı", note, req.params.id
    ]);

    res.json({ success: true, message: "Üretim planı güncellendi." });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.delete("/api/production-schedule/:id", async (req, res) => {
  try {
    await run(`DELETE FROM production_schedule WHERE id=?`, [req.params.id]);
    res.json({ success: true, message: "Üretim planı silindi." });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

/* ===================== 4. OEE ===================== */

app.get("/api/oee", async (req, res) => {
  db.all(`
    SELECT *
    FROM oee_records
    ORDER BY work_date DESC, id DESC
  `, [], (err, rows) => {
    if (err) {
      console.error("OEE listeleme hatası:", err.message);
      return res.status(500).json({
        success: false,
        message: err.message
      });
    }

    res.json({
      success: true,
      data: rows.map(x => ({
        ...x,
        machine_name: "Makine #" + (x.machine_id || "-")
      }))
    });
  });
});

app.post("/api/oee", async (req, res) => {
  try {
    const {
      machine_id, work_date, planned_minutes, working_minutes,
      ideal_cycle_time, produced_qty, good_qty, scrap_qty
    } = req.body;

    const availability =
      planned_minutes > 0 ? (working_minutes / planned_minutes) * 100 : 0;

    const performance =
      working_minutes > 0 && ideal_cycle_time > 0
        ? ((ideal_cycle_time * produced_qty) / working_minutes) * 100
        : 0;

    const quality =
      produced_qty > 0 ? (good_qty / produced_qty) * 100 : 0;

    const oee =
      (availability * performance * quality) / 10000;

    await run(`
      INSERT INTO oee_records
      (machine_id, work_date, planned_minutes, working_minutes,
       ideal_cycle_time, produced_qty, good_qty, scrap_qty,
       availability, performance, quality, oee)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      machine_id, work_date, planned_minutes || 0, working_minutes || 0,
      ideal_cycle_time || 0, produced_qty || 0, good_qty || 0, scrap_qty || 0,
      availability.toFixed(2), performance.toFixed(2), quality.toFixed(2), oee.toFixed(2)
    ]);

    res.json({ success: true, message: "OEE kaydı eklendi." });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.get("/api/oee/dashboard", async (req, res) => {
  try {
    const rows = await all(`
      SELECT
        ROUND(AVG(availability), 2) AS avg_availability,
        ROUND(AVG(performance), 2) AS avg_performance,
        ROUND(AVG(quality), 2) AS avg_quality,
        ROUND(AVG(oee), 2) AS avg_oee,
        SUM(produced_qty) AS total_produced,
        SUM(good_qty) AS total_good,
        SUM(scrap_qty) AS total_scrap
      FROM oee_records
      WHERE work_date >= date('now', '-30 day')
    `);

    res.json({ success: true, data: rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

/* ===================== 5. SATIŞ SİPARİŞİ ===================== */

app.get("/api/sales-orders", (req, res) => {
  db.all(`
    SELECT *
    FROM sales_orders
    ORDER BY id DESC
  `, [], (err, rows) => {
    if (err) {
      console.error("Satış siparişi listeleme hatası:", err.message);
      return res.status(500).json({
        success: false,
        message: err.message
      });
    }

    res.json({
      success: true,
      data: rows.map(x => ({
        ...x,
        company_name: "Müşteri #" + (x.customer_id || "-")
      }))
    });
  });
});

app.get("/api/sales-orders/:id", async (req, res) => {
  try {
    const order = await get(`
      SELECT so.*, c.company_name
      FROM sales_orders so
      LEFT JOIN customers c ON c.id = so.customer_id
      WHERE so.id=?
    `, [req.params.id]);

    const lines = await all(`
      SELECT *
      FROM sales_order_lines
      WHERE sales_order_id=?
    `, [req.params.id]);

    res.json({ success: true, data: { order, lines } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.post("/api/sales-orders", async (req, res) => {
  try {
    const {
      order_no, customer_id, offer_id, order_date,
      delivery_date, status, note, lines
    } = req.body;

    let total = 0;
    if (Array.isArray(lines)) {
      total = lines.reduce((sum, l) => {
        return sum + ((Number(l.quantity) || 0) * (Number(l.unit_price) || 0));
      }, 0);
    }

    const result = await run(`
      INSERT INTO sales_orders
      (order_no, customer_id, offer_id, order_date, delivery_date, status, total_amount, note)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      order_no, customer_id, offer_id || null, order_date,
      delivery_date, status || "Açık", total, note
    ]);

    const salesOrderId = result.lastID;

    if (Array.isArray(lines)) {
      for (const l of lines) {
        const qty = Number(l.quantity) || 0;
        const price = Number(l.unit_price) || 0;

        await run(`
          INSERT INTO sales_order_lines
          (sales_order_id, part_name, description, quantity, unit, unit_price, total_price, delivery_date, status)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
          salesOrderId, l.part_name, l.description, qty,
          l.unit || "Adet", price, qty * price,
          l.delivery_date || delivery_date, l.status || "Açık"
        ]);
      }
    }

    res.json({ success: true, message: "Satış siparişi oluşturuldu.", id: salesOrderId });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.put("/api/sales-orders/:id/status", async (req, res) => {
  try {
    await run(`
      UPDATE sales_orders
      SET status=?
      WHERE id=?
    `, [req.body.status, req.params.id]);

    res.json({ success: true, message: "Sipariş durumu güncellendi." });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.delete("/api/sales-orders/:id", async (req, res) => {
  try {
    await run(`DELETE FROM sales_order_lines WHERE sales_order_id=?`, [req.params.id]);
    await run(`DELETE FROM sales_orders WHERE id=?`, [req.params.id]);

    res.json({ success: true, message: "Satış siparişi silindi." });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

/* ===================== 6. MÜŞTERİ PORTALI ===================== */

app.post("/api/customer-portal/login", async (req, res) => {
  try {
    const { username, password } = req.body;

    const user = await get(`
      SELECT cpu.*, c.company_name
      FROM customer_portal_users cpu
      LEFT JOIN customers c ON c.id = cpu.customer_id
      WHERE cpu.username=? AND cpu.password=? AND cpu.active=1
    `, [username, password]);

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Kullanıcı adı veya şifre hatalı."
      });
    }

    res.json({
      success: true,
      message: "Giriş başarılı.",
      user: {
        id: user.id,
        customer_id: user.customer_id,
        full_name: user.full_name,
        company_name: user.company_name,
        email: user.email
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.get("/api/customer-portal/:customerId/summary", async (req, res) => {
  try {
    const customerId = req.params.customerId;

    const offers = await get(`
      SELECT COUNT(*) AS total
      FROM offers
      WHERE customer_id=?
    `, [customerId]);

    const orders = await get(`
      SELECT COUNT(*) AS total
      FROM sales_orders
      WHERE customer_id=?
    `, [customerId]);

    const workOrders = await get(`
      SELECT COUNT(*) AS total
      FROM work_orders
      WHERE customer_id=?
    `, [customerId]);

    const shipments = await get(`
      SELECT COUNT(*) AS total
      FROM shipments
      WHERE customer_id=?
    `, [customerId]);

    res.json({
      success: true,
      data: {
        offers: offers.total,
        sales_orders: orders.total,
        work_orders: workOrders.total,
        shipments: shipments.total
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.get("/api/customer-portal/:customerId/offers", async (req, res) => {
  try {
    const rows = await all(`
      SELECT *
      FROM offers
      WHERE customer_id=?
      ORDER BY id DESC
    `, [req.params.customerId]);

    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.get("/api/customer-portal/:customerId/orders", async (req, res) => {
  try {
    const rows = await all(`
      SELECT *
      FROM sales_orders
      WHERE customer_id=?
      ORDER BY id DESC
    `, [req.params.customerId]);

    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.get("/api/customer-portal/:customerId/work-orders", async (req, res) => {
  try {
    const rows = await all(`
      SELECT *
      FROM work_orders
      WHERE customer_id=?
      ORDER BY id DESC
    `, [req.params.customerId]);

    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.get("/api/customer-portal/:customerId/shipments", async (req, res) => {
  try {
    const rows = await all(`
      SELECT *
      FROM shipments
      WHERE customer_id=?
      ORDER BY id DESC
    `, [req.params.customerId]);

    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.post("/api/customer-portal/users", async (req, res) => {
  try {
    const { customer_id, username, password, full_name, email } = req.body;

    await run(`
      INSERT INTO customer_portal_users
      (customer_id, username, password, full_name, email)
      VALUES (?, ?, ?, ?, ?)
    `, [customer_id, username, password, full_name, email]);

    res.json({ success: true, message: "Portal kullanıcısı oluşturuldu." });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

};
