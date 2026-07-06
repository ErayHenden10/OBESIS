// SATIN ALMA SİPARİŞLERİ
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
// SATIN ALMA SİPARİŞLERİ
// ===============================

app.get("/api/purchase-orders", (req, res) => {
  const sql = `
    SELECT 
      po.*,
      s.company_name
    FROM purchase_orders po
    LEFT JOIN suppliers s ON s.id = po.supplier_id
    ORDER BY po.id DESC
  `;

  db.all(sql, [], (err, rows) => {
    if (err) {
      return res.status(500).json({ success: false, message: err.message, orders: [] });
    }

    res.json({
      success: true,
      orders: rows.map(o => ({
        id: o.id,
        orderNo: o.order_no,
        supplierId: o.supplier_id,
        supplierName: o.company_name,
        orderDate: o.order_date,
        deliveryDate: o.delivery_date,
        status: o.status
      }))
    });
  });
});

app.post("/api/purchase-orders", (req, res) => {
  const { orderNo, supplierId, orderDate, deliveryDate, status } = req.body;

  if (!orderNo || !supplierId) {
    return res.status(400).json({ success: false, message: "Sipariş no ve tedarikçi zorunludur." });
  }

  db.run(
    `
    INSERT INTO purchase_orders
    (order_no, supplier_id, order_date, delivery_date, status)
    VALUES (?, ?, ?, ?, ?)
    `,
    [orderNo, supplierId, orderDate, deliveryDate, status || "draft"],
    function (err) {
      if (err) {
        return res.status(500).json({ success: false, message: err.message });
      }

      res.json({ success: true, id: this.lastID });
    }
  );
});

app.put("/api/purchase-orders/:id", (req, res) => {
  const { orderNo, supplierId, orderDate, deliveryDate, status } = req.body;

  db.run(
    `
    UPDATE purchase_orders SET
      order_no = ?,
      supplier_id = ?,
      order_date = ?,
      delivery_date = ?,
      status = ?
    WHERE id = ?
    `,
    [orderNo, supplierId, orderDate, deliveryDate, status, req.params.id],
    function (err) {
      if (err) {
        return res.status(500).json({ success: false, message: err.message });
      }

      res.json({ success: true });
    }
  );
});

app.delete("/api/purchase-orders/:id", (req, res) => {
  db.run("DELETE FROM purchase_orders WHERE id = ?", [req.params.id], function (err) {
    if (err) {
      return res.status(500).json({ success: false, message: err.message });
    }

    res.json({ success: true });
  });
});


app.delete("/api/employee-documents/:id", (req, res) => {
  db.run("DELETE FROM employee_documents WHERE id = ?", [req.params.id], function (err) {
    if (err) {
      return res.status(500).json({ success: false, message: err.message });
    }

    res.json({ success: true });
  });
});

app.put("/api/employee-shifts/:id", (req, res) => {
  const { employeeId, shiftDate, startTime, endTime, overtimeHours, description } = req.body;

  db.run(
    `
    UPDATE employee_shifts SET
      employee_id = ?,
      shift_date = ?,
      start_time = ?,
      end_time = ?,
      overtime_hours = ?,
      description = ?
    WHERE id = ?
    `,
    [employeeId, shiftDate, startTime, endTime, Number(overtimeHours || 0), description, req.params.id],
    function (err) {
      if (err) {
        return res.status(500).json({ success: false, message: err.message });
      }

      res.json({ success: true });
    }
  );
});

app.delete("/api/employee-shifts/:id", (req, res) => {
  db.run("DELETE FROM employee_shifts WHERE id = ?", [req.params.id], function (err) {
    if (err) {
      return res.status(500).json({ success: false, message: err.message });
    }

    res.json({ success: true });
  });
});

app.delete("/api/employee-payments/:id", (req, res) => {
  db.run(
    "DELETE FROM employee_payments WHERE id = ?",
    [req.params.id],
    function (err) {
      if (err) {
        return res.status(500).json({
          success: false,
          message: err.message
        });
      }

      res.json({ success: true });
    }
  );
});

app.get("/api/users", (req, res) => {
  db.all(`
    SELECT
      id,
      username,
      password,
      full_name AS fullName,
      role,
      active,
      email
    FROM users
    ORDER BY id DESC
  `, [], (err, rows) => {
    if (err) {
      console.error("Kullanıcı listeleme hatası:", err.message);

      return res.status(500).json({
        success: false,
        message: err.message,
        users: []
      });
    }

    res.json({
      success: true,
      users: rows || []
    });
  });
});

app.put("/api/users/:id", (req, res) => {
  const {
    username,
    password,
    fullName,
    role,
    active,
    email
  } = req.body;

  if (!username || !fullName) {
    return res.status(400).json({
      success: false,
      message: "Ad soyad ve kullanıcı adı zorunludur."
    });
  }

  let sql = `
    UPDATE users
    SET
      username = ?,
      full_name = ?,
      role = ?,
      active = ?,
      email = ?
  `;

  const params = [
    username,
    fullName,
    role || "user",
    active ?? 1,
    email || ""
  ];

  if (password && password.trim() !== "") {
    sql += `, password = ?`;
    params.push(password);
  }

  sql += ` WHERE id = ?`;
  params.push(req.params.id);

  db.run(sql, params, function(err) {
    if (err) {
      return res.status(500).json({
        success: false,
        message: err.message
      });
    }

    res.json({
      success: true
    });
  });
});

app.put("/api/users/:id/status", (req, res) => {
  const { active } = req.body;

  db.run(`
    UPDATE users
    SET active = ?
    WHERE id = ?
  `, [active, req.params.id], function(err) {
    if (err) {
      return res.status(500).json({
        success: false,
        message: err.message
      });
    }

    res.json({
      success: true
    });
  });
});

app.delete("/api/users/:id", (req, res) => {
  db.run(`
    DELETE FROM users
    WHERE id = ?
  `, [req.params.id], function(err) {
    if (err) {
      return res.status(500).json({
        success: false,
        message: err.message
      });
    }

    res.json({
      success: true
    });
  });
});

app.get("/api/dashboard/:userId", async (req, res) => {

  const userId = req.params.userId;

  try {

    const user = await dbGet(`
      SELECT
        id,
        username,
        full_name,
        role
      FROM users
      WHERE id = ?
    `, [userId]);

    if (!user) {
      return res.status(404).json({
        error: "Kullanıcı bulunamadı"
      });
    }

    const dashboardData = {
      user: {
        id: user.id,
        fullName: user.full_name,
        role: user.role,
        avatar: user.full_name.charAt(0).toUpperCase()
      },
      notifications: 0,
      stats: {
        customers: 0,
        customerChange: 0,
        offers: 0,
        offerChange: 0,
        workOrders: 0,
        workOrderChange: 0,
        payments: 0,
        paymentChange: 0
      },
      workOrders: []
    };

    res.json(dashboardData);

  } catch (err) {

    res.status(500).json({
      error: err.message
    });

  }

});


app.get("/api/customers", async (req, res) => {
  try {
    const rows = await dbAll(`
      SELECT
        id,
        customer_code AS customerCode,
        company_name AS companyName,
        authorized_person AS authorizedPerson,
        phone,
        email,
        city,
        tax_no AS taxNo,
        status,
        strftime('%d.%m.%Y', created_at) AS createdAt
      FROM customers
      ORDER BY id DESC
    `);

    res.json({
      success: true,
      customers: rows || []
    });

  } catch (err) {
    res.status(500).json({
      success: false,
      message: "Müşteriler alınamadı.",
      detail: err.message
    });
  }
});

app.post("/api/customers", async (req, res) => {
  try {
    const {
      companyName,
      authorizedPerson,
      phone,
      email,
      city,
      taxNo
    } = req.body;

    if (!companyName) {
      return res.status(400).json({
        success: false,
        message: "Firma adı zorunludur."
      });
    }

    const lastCustomer = await dbGet(`
      SELECT id FROM customers ORDER BY id DESC LIMIT 1
    `);

    const nextNo = (lastCustomer?.id || 0) + 1;
    const customerCode = "MUS" + String(nextNo).padStart(5, "0");

    await new Promise((resolve, reject) => {
      db.run(
        `
        INSERT INTO customers (
          customer_code,
          company_name,
          authorized_person,
          phone,
          email,
          city,
          tax_no,
          status
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, 'active')
        `,
        [
          customerCode,
          companyName,
          authorizedPerson,
          phone,
          email,
          city,
          taxNo
        ],
        function (err) {
          if (err) reject(err);
          else resolve(this.lastID);
        }
      );
    });

    res.json({
      success: true,
      message: "Müşteri başarıyla oluşturuldu."
    });

  } catch (err) {
    res.status(500).json({
      success: false,
      message: "Müşteri oluşturulamadı.",
      detail: err.message
    });
  }
});

app.put("/api/customers/:id/status", async (req, res) => {
  try {
    const { status } = req.body;
    const { id } = req.params;

    await new Promise((resolve, reject) => {
      db.run(
        `UPDATE customers SET status = ? WHERE id = ?`,
        [status, id],
        function (err) {
          if (err) reject(err);
          else resolve();
        }
      );
    });

    res.json({
      success: true,
      message: "Müşteri durumu güncellendi."
    });

  } catch (err) {
    res.status(500).json({
      success: false,
      message: "Durum güncellenemedi.",
      detail: err.message
    });
  }
});

app.put("/api/customers/:id", async (req, res) => {
  try {
    const { id } = req.params;

    const {
      companyName,
      authorizedPerson,
      phone,
      email,
      city,
      taxNo
    } = req.body;

    if (!companyName) {
      return res.status(400).json({
        success: false,
        message: "Firma adı zorunludur."
      });
    }

    await new Promise((resolve, reject) => {
      db.run(
        `
        UPDATE customers
        SET
          company_name = ?,
          authorized_person = ?,
          phone = ?,
          email = ?,
          city = ?,
          tax_no = ?
        WHERE id = ?
        `,
        [
          companyName,
          authorizedPerson,
          phone,
          email,
          city,
          taxNo,
          id
        ],
        function (err) {
          if (err) reject(err);
          else resolve();
        }
      );
    });

    res.json({
      success: true,
      message: "Müşteri bilgileri güncellendi."
    });

  } catch (err) {
    res.status(500).json({
      success: false,
      message: "Müşteri güncellenemedi.",
      detail: err.message
    });
  }
});

app.get("/api/offers", async (req, res) => {
  try {
    const rows = await dbAll(`
      SELECT
        o.id,
        o.offer_no AS offerNo,
        o.title,
        COALESCE(c.company_name, '-') AS customerName,
        o.offer_date AS offerDate,
        o.valid_until AS validUntil,
        o.status,
        o.total_amount AS totalAmount,
        o.note
      FROM offers o
      LEFT JOIN customers c ON c.id = o.customer_id
      ORDER BY o.id DESC
    `);

    res.json({ success: true, offers: rows || [] });

  } catch (err) {
    res.status(500).json({
      success: false,
      message: "Teklifler alınamadı.",
      detail: err.message
    });
  }
});

app.get("/api/offers/:id", async (req, res) => {
  try {
    const offer = await dbGet(`
      SELECT
        id,
        offer_no AS offerNo,
        customer_id AS customerId,
        title,
        offer_date AS offerDate,
        valid_until AS validUntil,
        status,
        note,
        total_amount AS totalAmount
      FROM offers
      WHERE id = ?
    `, [req.params.id]);

    const items = await dbAll(`
      SELECT
        id,
        item_name AS itemName,
        quantity,
        unit_price AS unitPrice,
        total_price AS totalPrice
      FROM offer_items
      WHERE offer_id = ?
    `, [req.params.id]);

    res.json({ success: true, offer, items });

  } catch (err) {
    res.status(500).json({
      success: false,
      message: "Teklif detayı alınamadı.",
      detail: err.message
    });
  }
});

app.post("/api/offers", async (req, res) => {
  try {
    const { customerId, title, offerDate, validUntil, status, note, items } = req.body;

    if (!customerId || !title) {
      return res.status(400).json({
        success: false,
        message: "Müşteri ve teklif başlığı zorunludur."
      });
    }

    const lastOffer = await dbGet(`SELECT id FROM offers ORDER BY id DESC LIMIT 1`);
    const nextNo = (lastOffer?.id || 0) + 1;
    const offerNo = "TEK" + new Date().getFullYear() + String(nextNo).padStart(5, "0");

    const totalAmount = (items || []).reduce((sum, item) => {
      return sum + Number(item.quantity || 0) * Number(item.unitPrice || 0);
    }, 0);

    const offerId = await new Promise((resolve, reject) => {
      db.run(`
        INSERT INTO offers (
          offer_no,
          customer_id,
          title,
          offer_date,
          valid_until,
          status,
          note,
          total_amount
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        offerNo,
        customerId,
        title,
        offerDate || null,
        validUntil || null,
        status || "draft",
        note || "",
        totalAmount
      ], function (err) {
        if (err) reject(err);
        else resolve(this.lastID);
      });
    });

    for (const item of items || []) {
      const quantity = Number(item.quantity || 0);
      const unitPrice = Number(item.unitPrice || 0);

      await new Promise((resolve, reject) => {
        db.run(`
          INSERT INTO offer_items (
            offer_id,
            item_name,
            quantity,
            unit_price,
            total_price
          )
          VALUES (?, ?, ?, ?, ?)
        `, [
          offerId,
          item.itemName,
          quantity,
          unitPrice,
          quantity * unitPrice
        ], err => err ? reject(err) : resolve());
      });
    }

    res.json({
      success: true,
      message: "Teklif başarıyla oluşturuldu."
    });

  } catch (err) {
    res.status(500).json({
      success: false,
      message: "Teklif oluşturulamadı.",
      detail: err.message
    });
  }
});

app.put("/api/offers/:id", async (req, res) => {
  try {
    const { customerId, title, offerDate, validUntil, status, note, items } = req.body;

    const totalAmount = (items || []).reduce((sum, item) => {
      return sum + Number(item.quantity || 0) * Number(item.unitPrice || 0);
    }, 0);

    await new Promise((resolve, reject) => {
      db.run(`
        UPDATE offers
        SET
          customer_id = ?,
          title = ?,
          offer_date = ?,
          valid_until = ?,
          status = ?,
          note = ?,
          total_amount = ?
        WHERE id = ?
      `, [
        customerId,
        title,
        offerDate || null,
        validUntil || null,
        status || "draft",
        note || "",
        totalAmount,
        req.params.id
      ], err => err ? reject(err) : resolve());
    });

    await new Promise((resolve, reject) => {
      db.run(`DELETE FROM offer_items WHERE offer_id = ?`, [req.params.id], err => {
        if (err) reject(err);
        else resolve();
      });
    });

    for (const item of items || []) {
      const quantity = Number(item.quantity || 0);
      const unitPrice = Number(item.unitPrice || 0);

      await new Promise((resolve, reject) => {
        db.run(`
          INSERT INTO offer_items (
            offer_id,
            item_name,
            quantity,
            unit_price,
            total_price
          )
          VALUES (?, ?, ?, ?, ?)
        `, [
          req.params.id,
          item.itemName,
          quantity,
          unitPrice,
          quantity * unitPrice
        ], err => err ? reject(err) : resolve());
      });
    }

    res.json({
      success: true,
      message: "Teklif güncellendi."
    });

  } catch (err) {
    res.status(500).json({
      success: false,
      message: "Teklif güncellenemedi.",
      detail: err.message
    });
  }
});

app.put("/api/offers/:id/status", async (req, res) => {
  try {
    const { status } = req.body;

    await new Promise((resolve, reject) => {
      db.run(
        `UPDATE offers SET status = ? WHERE id = ?`,
        [status, req.params.id],
        err => err ? reject(err) : resolve()
      );
    });

    res.json({
      success: true,
      message: "Teklif durumu güncellendi."
    });

  } catch (err) {
    res.status(500).json({
      success: false,
      message: "Teklif durumu güncellenemedi.",
      detail: err.message
    });
  }
});

app.post('/api/work-orders', (req, res) => {
  const {
    workOrderNo,
    customerId,
    title,
    description,
    startDate,
    dueDate,
    priority,
    status
  } = req.body;

  const sql = `
    INSERT INTO work_orders
    (
      work_order_no,
      customer_id,
      part_name,
      delivery_date,
      status
    )
    VALUES (?, ?, ?, ?, ?)
  `;

  db.run(sql, [
    workOrderNo,
    customerId,
    title,
    dueDate,
    status || 'waiting'
  ], function (err) {
    if (err) {
      console.error('İş emri ekleme hatası:', err);
      return res.status(500).json({ success: false, message: 'İş emri eklenemedi' });
    }

    res.json({ success: true, id: this.lastID });
  });
});

app.get('/api/work-orders', (req, res) => {
  const sql = `
    SELECT 
      wo.id,
      wo.work_order_no,
      wo.customer_id,
      wo.part_name AS title,
      wo.delivery_date AS due_date,
      wo.status,
      c.company_name AS customer_name
    FROM work_orders wo
    LEFT JOIN customers c ON c.id = wo.customer_id
    ORDER BY wo.id DESC
  `;

  db.all(sql, [], (err, rows) => {
    if (err) {
      console.error('İş emirleri listeleme hatası:', err);
      return res.status(500).json({ success: false, message: 'İş emirleri getirilemedi' });
    }

    res.json({ success: true, workOrders: rows });
  });
});

app.put('/api/work-orders/:id', (req, res) => {
  const { id } = req.params;

  const {
    workOrderNo,
    customerId,
    title,
    dueDate,
    status
  } = req.body;

  const sql = `
    UPDATE work_orders
    SET
      work_order_no = ?,
      customer_id = ?,
      part_name = ?,
      delivery_date = ?,
      status = ?
    WHERE id = ?
  `;

  db.run(sql, [
    workOrderNo,
    customerId,
    title,
    dueDate,
    status || 'waiting',
    id
  ], function (err) {
    if (err) {
      console.error('İş emri güncelleme hatası:', err);
      return res.status(500).json({ success: false, message: 'İş emri güncellenemedi' });
    }

    res.json({ success: true });
  });
});
app.delete('/api/work-orders/:id', (req, res) => {
  const { id } = req.params;

  db.run(`DELETE FROM work_orders WHERE id = ?`, [id], function (err) {
    if (err) {
      console.error('İş emri silme hatası:', err);
      return res.status(500).json({ success: false, message: 'İş emri silinemedi' });
    }

    res.json({ success: true });
  });
});

app.put('/api/work-orders/:id/status', (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  db.run(
    `UPDATE work_orders SET status = ? WHERE id = ?`,
    [status, id],
    function (err) {
      if (err) {
        console.error('İş emri durum güncelleme hatası:', err);
        return res.status(500).json({ success: false, message: 'Durum güncellenemedi' });
      }

      res.json({ success: true });
    }
  );
});


app.get('/api/stocks', (req, res) => {
  db.all(`SELECT * FROM stocks ORDER BY id DESC`, [], (err, rows) => {
    if (err) {
      console.error('Stok listeleme hatası:', err);
      return res.status(500).json({ success: false, message: 'Stoklar getirilemedi' });
    }

    res.json({ success: true, stocks: rows });
  });
});

app.post('/api/stocks', (req, res) => {
  const {
    stockCode,
    partName,
    category,
    unit,
    quantity,
    minQuantity,
    location,
    status
  } = req.body;

  const sql = `
    INSERT INTO stocks
    (
      stock_code,
      part_name,
      category,
      unit,
      quantity,
      min_quantity,
      location,
      status
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `;

  db.run(sql, [
    stockCode,
    partName,
    category,
    unit || 'Adet',
    quantity || 0,
    minQuantity || 0,
    location,
    status || 'active'
  ], function (err) {
    if (err) {
      console.error('Stok ekleme hatası:', err);
      return res.status(500).json({ success: false, message: 'Stok eklenemedi' });
    }

    res.json({ success: true, id: this.lastID });
  });
});

app.get('/api/stocks/:id', (req, res) => {
  db.get(`SELECT * FROM stocks WHERE id = ?`, [req.params.id], (err, row) => {
    if (err) {
      console.error('Stok detay hatası:', err);
      return res.status(500).json({ success: false, message: 'Stok detayı alınamadı' });
    }

    res.json({ success: true, stock: row });
  });
});

app.put('/api/stocks/:id', (req, res) => {
  const {
    stockCode,
    partName,
    category,
    unit,
    quantity,
    minQuantity,
    location,
    status
  } = req.body;

  const sql = `
    UPDATE stocks
    SET
      stock_code = ?,
      part_name = ?,
      category = ?,
      unit = ?,
      quantity = ?,
      min_quantity = ?,
      location = ?,
      status = ?
    WHERE id = ?
  `;

  db.run(sql, [
    stockCode,
    partName,
    category,
    unit || 'Adet',
    quantity || 0,
    minQuantity || 0,
    location,
    status || 'active',
    req.params.id
  ], function (err) {
    if (err) {
      console.error('Stok güncelleme hatası:', err);
      return res.status(500).json({ success: false, message: 'Stok güncellenemedi' });
    }

    res.json({ success: true });
  });
});

app.delete('/api/stocks/:id', (req, res) => {
  db.run(`DELETE FROM stocks WHERE id = ?`, [req.params.id], function (err) {
    if (err) {
      console.error('Stok silme hatası:', err);
      return res.status(500).json({ success: false, message: 'Stok silinemedi' });
    }

    res.json({ success: true });
  });
});

app.get('/api/machines', (req, res) => {
    db.all(`
        SELECT *
        FROM machine_maintenance
        ORDER BY id DESC
    `, [], (err, rows) => {
        if (err) {
            return res.status(500).json({
                success: false,
                message: err.message
            });
        }

        res.json({
            success: true,
            machines: rows
        });
    });
});

};
