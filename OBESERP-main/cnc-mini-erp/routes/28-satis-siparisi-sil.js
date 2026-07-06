// SATIŞ SİPARİŞİ SİL
module.exports = function register(app, ctx) {
  var db = ctx.db;
  var dbGet = ctx.dbGet;
  var dbAll = ctx.dbAll;
  var dbRun = ctx.dbRun;
  var path = ctx.path;
  var rootDir = ctx.rootDir;
  var onlySuperAdmin = ctx.onlySuperAdmin;
  var addActivityLog = ctx.addActivityLog;
  var sendPurchaseApprovalMail = ctx.sendPurchaseApprovalMail;
  var sendNewPurchaseRequestMail = ctx.sendNewPurchaseRequestMail;
  var getNotifyRecipients = require("../utils/roleNotify").getNotifyRecipients;

// ===============================
// SATIŞ SİPARİŞİ SİL
// ===============================
app.delete("/api/sales-orders/:id", (req, res) => {
  const { id } = req.params;

  db.serialize(() => {
    db.run("BEGIN TRANSACTION");

    db.run(`DELETE FROM sales_order_lines WHERE sales_order_id = ?`, [id], (lineErr) => {
      if (lineErr) {
        db.run("ROLLBACK");
        return res.status(500).json({ success: false, message: lineErr.message });
      }

      db.run(`DELETE FROM sales_orders WHERE id = ?`, [id], function (err) {
        if (err) {
          db.run("ROLLBACK");
          return res.status(500).json({ success: false, message: err.message });
        }

        db.run("COMMIT");

        res.json({
          success: true,
          message: "Satış siparişi silindi."
        });
      });
    });
  });
});

app.post("/api/invoices", (req, res) => {
  const {
    customer_id,
    invoice_date,
    due_date,
    invoice_type,
    item_name,
    quantity,
    unit,
    unit_price,
    vat_rate,
    note
  } = req.body;

  if (!customer_id || !item_name || !quantity) {
    return res.status(400).json({
      success: false,
      message: "Müşteri, malzeme ve miktar zorunludur."
    });
  }

  const invoice_no = "FAT" + Date.now();
  const qty = Number(quantity || 0);
  const price = Number(unit_price || 0);
  const vat = Number(vat_rate || 20);

  const subtotal = qty * price;
  const vat_amount = subtotal * vat / 100;
  const total_amount = subtotal + vat_amount;

  db.run(`
    INSERT INTO invoices
    (
      invoice_no, customer_id, invoice_date, due_date,
      invoice_type, subtotal, vat_rate, vat_amount,
      total_amount, status, note
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, [
    invoice_no,
    customer_id,
    invoice_date,
    due_date,
    invoice_type || "Satış",
    subtotal,
    vat,
    vat_amount,
    total_amount,
    "Beklemede",
    note || ""
  ], function (err) {
    if (err) {
      console.error("Fatura ekleme hatası:", err);
      return res.status(500).json({ success: false, message: err.message });
    }

    const invoiceId = this.lastID;

    db.run(`
      INSERT INTO invoice_items
      (
        invoice_id, item_name, quantity, unit,
        unit_price, vat_rate, total_amount
      )
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [
      invoiceId,
      item_name,
      qty,
      unit || "Adet",
      price,
      vat,
      total_amount
    ]);

    res.json({
      success: true,
      message: "Fatura başarıyla oluşturuldu.",
      invoiceId
    });
  });
});

app.put("/api/invoices/:id/status", (req, res) => {
  const { status } = req.body;

  db.run(`
    UPDATE invoices
    SET status = ?
    WHERE id = ?
  `, [status, req.params.id], function (err) {
    if (err) {
      console.error("Fatura durum güncelleme hatası:", err);
      return res.status(500).json({ success: false, message: err.message });
    }

    res.json({
      success: true,
      message: "Fatura durumu güncellendi."
    });
  });
});

app.delete("/api/invoices/:id", (req, res) => {
  db.run(`DELETE FROM invoice_items WHERE invoice_id = ?`, [req.params.id]);

  db.run(`DELETE FROM invoices WHERE id = ?`, [req.params.id], function (err) {
    if (err) {
      console.error("Fatura silme hatası:", err);
      return res.status(500).json({ success: false, message: err.message });
    }

    res.json({
      success: true,
      message: "Fatura silindi."
    });
  });
});

app.post("/api/purchase-requests", (req, res) => {
  const {
    requestNo,
    requestedBy,
    supplierId,
    materialName,
    quantity,
    urgency,
    status
  } = req.body;

  if (!requestNo || !materialName) {
    return res.status(400).json({
      success: false,
      message: "Talep no ve malzeme zorunludur."
    });
  }

  db.run(
  `
  INSERT INTO purchase_requests
  (request_no, requested_by, supplier_id, material_name, quantity, urgency, status)
  VALUES (?, ?, ?, ?, ?, ?, ?)
  `,
  [
    requestNo,
    requestedBy,
    supplierId || null,
    materialName,
    Number(quantity || 0),
    urgency || "normal",
    status || "pending"
  ],
  function (err) {
    if (err) {
      return res.status(500).json({
        success: false,
        message: err.message
      });
    }

    const requestId = this.lastID;

    // Bildirim oluştur
    ctx.createNotification({
      role: "admin",
      title: "Yeni Satın Alma Talebi",
      message: `${requestedBy} tarafından ${materialName} talebi oluşturuldu.`,
      module: "satin-alma",
      type: "info",
      recordId: requestId
    });

    // Admin/Muhasebe/Satın Alma rolündeki kullanıcılara mail bildirimi
    const sendNewRequestMail = (supplierName) => {
      getNotifyRecipients(db, [], (notifyErr, recipients) => {
        if (notifyErr) {
          console.error("Bildirim için kullanıcılar alınamadı:", notifyErr.message);
          return;
        }
        if (!sendNewPurchaseRequestMail || recipients.length === 0) return;

        sendNewPurchaseRequestMail(
          {
            docNo: requestNo,
            materialName,
            quantity: Number(quantity || 0),
            unit: "",
            urgency: urgency || "normal",
            requestedBy,
            supplierName
          },
          recipients
        ).then((result) => {
          if (result.success) {
            console.log(
              `[mailer] Yeni satın alma talebi maili gönderildi -> ${recipients.map(u => u.email).join(", ")}`
            );
          } else {
            console.warn("Yeni satın alma talebi maili gönderilemedi:", result.message);
          }
        });
      });
    };

    if (supplierId) {
      db.get(`SELECT company_name FROM suppliers WHERE id = ?`, [supplierId], (supErr, supRow) => {
        sendNewRequestMail(supRow ? supRow.company_name : null);
      });
    } else {
      sendNewRequestMail(null);
    }

    res.json({
      success: true,
      id: requestId
    });
  }
);
});

app.put("/api/purchase-requests/:id", (req, res) => {
  const {
    requestNo,
    requestedBy,
    supplierId,
    materialName,
    quantity,
    urgency,
    status
  } = req.body;

  db.run(
    `
    UPDATE purchase_requests SET
      request_no = ?,
      requested_by = ?,
      supplier_id = ?,
      material_name = ?,
      quantity = ?,
      urgency = ?,
      status = ?
    WHERE id = ?
    `,
    [
      requestNo,
      requestedBy,
      supplierId || null,
      materialName,
      Number(quantity || 0),
      urgency || "normal",
      status || "pending",
      req.params.id
    ],
    function (err) {
      if (err) {
        return res.status(500).json({
          success: false,
          message: err.message
        });
      }

      res.json({
        success: true
      });
    }
  );
});

app.delete("/api/purchase-requests/:id", (req, res) => {
  db.run("DELETE FROM purchase_requests WHERE id = ?", [req.params.id], function (err) {
    if (err) {
      return res.status(500).json({ success: false, message: err.message });
    }

    res.json({ success: true });
  });
});



app.get("/api/production-tracking", (req, res) => {
  const sql = `
    SELECT
      pt.*,
      m.machine_name
    FROM production_tracking pt
    LEFT JOIN machine_maintenance m ON m.id = pt.machine_id
    ORDER BY pt.id DESC
  `;

  db.all(sql, [], (err, rows) => {
    if (err) {
      return res.status(500).json({
        success: false,
        message: err.message,
        productions: []
      });
    }

    res.json({
      success: true,
      productions: rows.map(p => ({
        id: p.id,
        workOrderNo: p.work_order_no,
        operationName: p.operation_name,
        machineId: p.machine_id,
        machineName: p.machine_name,
        operatorName: p.operator_name,
        startDatetime: p.start_datetime,
        endDatetime: p.end_datetime,
        progress: p.progress,
        status: p.status,
        description: p.description
      }))
    });
  });
});

app.post("/api/production-tracking", (req, res) => {
  const {
    workOrderNo,
    operationName,
    machineId,
    operatorName,
    startDatetime,
    endDatetime,
    progress,
    status,
    description
  } = req.body;

  if (!workOrderNo || !operationName) {
    return res.status(400).json({
      success: false,
      message: "İş emri ve operasyon zorunludur."
    });
  }

  db.run(
    `
    INSERT INTO production_tracking
    (
      work_order_no,
      operation_name,
      machine_id,
      operator_name,
      start_datetime,
      end_datetime,
      progress,
      status,
      description
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    [
      workOrderNo,
      operationName,
      machineId || null,
      operatorName,
      startDatetime,
      endDatetime,
      Number(progress || 0),
      status || "waiting",
      description
    ],
    function (err) {
      if (err) {
        return res.status(500).json({
          success: false,
          message: err.message
        });
      }

      res.json({
        success: true,
        id: this.lastID
      });
    }
  );
});

db.run(`
  CREATE TABLE IF NOT EXISTS current_accounts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    account_code TEXT UNIQUE,
    company_name TEXT NOT NULL,
    contact_person TEXT,
    phone TEXT,
    email TEXT,
    tax_no TEXT,
    tax_office TEXT,
    address TEXT,
    risk_limit REAL DEFAULT 0,
    account_type TEXT DEFAULT 'customer',
    status TEXT DEFAULT 'active',
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  )
`);

app.get("/api/current-accounts", (req, res) => {
  db.all(`SELECT * FROM current_accounts ORDER BY id DESC`, [], (err, rows) => {
    if (err) {
      return res.status(500).json({ success: false, message: err.message, accounts: [] });
    }

    res.json({
      success: true,
      accounts: rows.map(a => ({
        id: a.id,
        accountCode: a.account_code,
        companyName: a.company_name,
        contactPerson: a.contact_person,
        phone: a.phone,
        email: a.email,
        taxNo: a.tax_no,
        taxOffice: a.tax_office,
        address: a.address,
        riskLimit: a.risk_limit,
        accountType: a.account_type,
        status: a.status
      }))
    });
  });
});

app.post("/api/current-accounts", (req, res) => {
  const {
    accountCode,
    companyName,
    contactPerson,
    phone,
    email,
    taxNo,
    taxOffice,
    address,
    riskLimit,
    accountType,
    status
  } = req.body;

  if (!companyName) {
    return res.status(400).json({ success: false, message: "Firma adı zorunludur." });
  }

  const finalCode = accountCode || "CAR" + Date.now();

  db.run(
    `
    INSERT INTO current_accounts
    (
      account_code,
      company_name,
      contact_person,
      phone,
      email,
      tax_no,
      tax_office,
      address,
      risk_limit,
      account_type,
      status
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    [
      finalCode,
      companyName,
      contactPerson,
      phone,
      email,
      taxNo,
      taxOffice,
      address,
      Number(riskLimit || 0),
      accountType || "customer",
      status || "active"
    ],
    function (err) {
      if (err) {
        return res.status(500).json({ success: false, message: err.message });
      }

      res.json({ success: true, id: this.lastID });
    }
  );
});

app.put("/api/current-accounts/:id", (req, res) => {
  const {
    accountCode,
    companyName,
    contactPerson,
    phone,
    email,
    taxNo,
    taxOffice,
    address,
    riskLimit,
    accountType,
    status
  } = req.body;

  db.run(
    `
    UPDATE current_accounts SET
      account_code = ?,
      company_name = ?,
      contact_person = ?,
      phone = ?,
      email = ?,
      tax_no = ?,
      tax_office = ?,
      address = ?,
      risk_limit = ?,
      account_type = ?,
      status = ?
    WHERE id = ?
    `,
    [
      accountCode,
      companyName,
      contactPerson,
      phone,
      email,
      taxNo,
      taxOffice,
      address,
      Number(riskLimit || 0),
      accountType || "customer",
      status || "active",
      req.params.id
    ],
    function (err) {
      if (err) {
        return res.status(500).json({ success: false, message: err.message });
      }

      res.json({ success: true });
    }
  );
});

app.delete("/api/current-accounts/:id", (req, res) => {
  db.run(`DELETE FROM current_accounts WHERE id = ?`, [req.params.id], function (err) {
    if (err) {
      return res.status(500).json({ success: false, message: err.message });
    }

    res.json({ success: true });
  });
});

db.run(`
  CREATE TABLE IF NOT EXISTS current_account_transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    account_id INTEGER NOT NULL,
    transaction_date TEXT NOT NULL,
    transaction_type TEXT DEFAULT 'debit',
    debit REAL DEFAULT 0,
    credit REAL DEFAULT 0,
    description TEXT,
    document_no TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (account_id) REFERENCES current_accounts(id)
  )
`);

app.get("/api/current-account-transactions", (req, res) => {
  const sql = `
    SELECT 
      t.*,
      c.account_code,
      c.company_name
    FROM current_account_transactions t
    LEFT JOIN current_accounts c ON c.id = t.account_id
    ORDER BY t.id DESC
  `;

  db.all(sql, [], (err, rows) => {
    if (err) {
      return res.status(500).json({ success: false, message: err.message, transactions: [] });
    }

    res.json({
      success: true,
      transactions: rows.map(t => ({
        id: t.id,
        accountId: t.account_id,
        accountCode: t.account_code,
        companyName: t.company_name,
        transactionDate: t.transaction_date,
        transactionType: t.transaction_type,
        debit: t.debit,
        credit: t.credit,
        description: t.description,
        documentNo: t.document_no
      }))
    });
  });
});

app.post("/api/current-account-transactions", (req, res) => {
  const {
    accountId,
    transactionDate,
    transactionType,
    debit,
    credit,
    description,
    documentNo
  } = req.body;

  if (!accountId || !transactionDate) {
    return res.status(400).json({
      success: false,
      message: "Cari ve tarih zorunludur."
    });
  }

  db.run(
    `
    INSERT INTO current_account_transactions
    (
      account_id,
      transaction_date,
      transaction_type,
      debit,
      credit,
      description,
      document_no
    )
    VALUES (?, ?, ?, ?, ?, ?, ?)
    `,
    [
      accountId,
      transactionDate,
      transactionType || "debit",
      Number(debit || 0),
      Number(credit || 0),
      description || "",
      documentNo || ""
    ],
    function (err) {
      if (err) {
        return res.status(500).json({ success: false, message: err.message });
      }

      res.json({ success: true, id: this.lastID });
    }
  );
});

app.put("/api/current-account-transactions/:id", (req, res) => {
  const {
    accountId,
    transactionDate,
    transactionType,
    debit,
    credit,
    description,
    documentNo
  } = req.body;

  db.run(
    `
    UPDATE current_account_transactions SET
      account_id = ?,
      transaction_date = ?,
      transaction_type = ?,
      debit = ?,
      credit = ?,
      description = ?,
      document_no = ?
    WHERE id = ?
    `,
    [
      accountId,
      transactionDate,
      transactionType || "debit",
      Number(debit || 0),
      Number(credit || 0),
      description || "",
      documentNo || "",
      req.params.id
    ],
    function (err) {
      if (err) {
        return res.status(500).json({ success: false, message: err.message });
      }

      res.json({ success: true });
    }
  );
});

app.delete("/api/current-account-transactions/:id", (req, res) => {
  db.run(
    `DELETE FROM current_account_transactions WHERE id = ?`,
    [req.params.id],
    function (err) {
      if (err) {
        return res.status(500).json({ success: false, message: err.message });
      }

      res.json({ success: true });
    }
  );
});

// CARİ EKSTRE - Cari listesi
app.get('/api/cari-ekstre/accounts', (req, res) => {
  db.all(`
    SELECT 
      id,
      accountCode,
      companyName,
      contactPerson,
      phone,
      email,
      accountType,
      status
    FROM current_accounts
    ORDER BY companyName ASC
  `, [], (err, rows) => {
    if (err) {
      console.error("Cari listeleme hatası:", err.message);
      return res.status(500).json({
        success: false,
        message: err.message,
        accounts: []
      });
    }

    res.json({
      success: true,
      accounts: rows
    });
  });
});


// CARİ EKSTRE - Hareketler
app.get('/api/cari-ekstre/:accountId', (req, res) => {
  const { accountId } = req.params;
  const { startDate, endDate } = req.query;

  let params = [accountId];
  let dateFilter = "";

  if (startDate) {
    dateFilter += " AND date(transaction_date) >= date(?) ";
    params.push(startDate);
  }

  if (endDate) {
    dateFilter += " AND date(transaction_date) <= date(?) ";
    params.push(endDate);
  }

  const sql = `
    SELECT 
      id,
      account_id AS accountId,
      transaction_date AS transactionDate,
      transaction_type AS transactionType,
      description,
      debit,
      credit,
      document_no AS documentNo,
      created_at
    FROM current_account_transactions
    WHERE account_id = ?
    ${dateFilter}
    ORDER BY date(transaction_date) ASC, id ASC
  `;

  db.all(sql, params, (err, rows) => {
    if (err) {
      console.error("Cari ekstre hatası:", err.message);
      return res.status(500).json({
        success: false,
        message: err.message,
        transactions: []
      });
    }

    let balance = 0;

    const transactions = rows.map(row => {
      const debit = Number(row.debit || 0);
      const credit = Number(row.credit || 0);

      balance += debit - credit;

      return {
        ...row,
        debit,
        credit,
        balance
      };
    });

    const totalDebit = transactions.reduce((sum, x) => sum + Number(x.debit || 0), 0);
    const totalCredit = transactions.reduce((sum, x) => sum + Number(x.credit || 0), 0);
    const finalBalance = totalDebit - totalCredit;

    res.json({
      success: true,
      transactions,
      summary: {
        totalDebit,
        totalCredit,
        finalBalance
      }
    });
  });
});

// KASA LİSTELE
app.get('/api/cash-accounts', (req, res) => {
  db.all(`
    SELECT 
      id,
      cash_code AS cashCode,
      cash_name AS cashName,
      currency,
      opening_balance AS openingBalance,
      status,
      created_at
    FROM cash_accounts
    ORDER BY id DESC
  `, [], (err, rows) => {
    if (err) {
      return res.status(500).json({ success:false, message:err.message, cashAccounts:[] });
    }

    res.json({ success:true, cashAccounts: rows });
  });
});


// KASA EKLE
app.post('/api/cash-accounts', (req, res) => {
  const {
    cashName,
    currency,
    openingBalance,
    status
  } = req.body;

  if (!cashName) {
    return res.status(400).json({ success:false, message:"Kasa adı zorunludur." });
  }

  const cashCode = "KASA" + Date.now();

  db.run(`
    INSERT INTO cash_accounts
    (
      cash_code,
      cash_name,
      currency,
      opening_balance,
      status
    )
    VALUES (?, ?, ?, ?, ?)
  `, [
    cashCode,
    cashName,
    currency || "TRY",
    Number(openingBalance || 0),
    status || "active"
  ], function(err) {
    if (err) {
      return res.status(500).json({ success:false, message:err.message });
    }

    res.json({
      success:true,
      message:"Kasa başarıyla oluşturuldu.",
      id:this.lastID
    });
  });
});


// KASA GÜNCELLE
app.put('/api/cash-accounts/:id', (req, res) => {
  const { id } = req.params;

  const {
    cashName,
    currency,
    openingBalance,
    status
  } = req.body;

  db.run(`
    UPDATE cash_accounts SET
      cash_name = ?,
      currency = ?,
      opening_balance = ?,
      status = ?
    WHERE id = ?
  `, [
    cashName,
    currency || "TRY",
    Number(openingBalance || 0),
    status || "active",
    id
  ], function(err) {
    if (err) {
      return res.status(500).json({ success:false, message:err.message });
    }

    res.json({ success:true, message:"Kasa güncellendi." });
  });
});


// KASA SİL
app.delete('/api/cash-accounts/:id', (req, res) => {
  const { id } = req.params;

  db.run(`DELETE FROM cash_accounts WHERE id = ?`, [id], function(err) {
    if (err) {
      return res.status(500).json({ success:false, message:err.message });
    }

    res.json({ success:true, message:"Kasa silindi." });
  });
});


// KASA HAREKETLERİ LİSTELE
app.get('/api/cash-transactions', (req, res) => {
  db.all(`
    SELECT
      ct.id,
      ct.cash_id AS cashId,
      ca.cash_code AS cashCode,
      ca.cash_name AS cashName,
      ct.transaction_date AS transactionDate,
      ct.transaction_type AS transactionType,
      ct.amount,
      ct.document_no AS documentNo,
      ct.description,
      ct.created_at
    FROM cash_transactions ct
    LEFT JOIN cash_accounts ca ON ca.id = ct.cash_id
    ORDER BY date(ct.transaction_date) DESC, ct.id DESC
  `, [], (err, rows) => {
    if (err) {
      return res.status(500).json({ success:false, message:err.message, transactions:[] });
    }

    res.json({ success:true, transactions: rows });
  });
});


// KASA HAREKETİ EKLE
app.post('/api/cash-transactions', (req, res) => {
  const {
    cashId,
    transactionDate,
    transactionType,
    amount,
    documentNo,
    description
  } = req.body;

  if (!cashId || !transactionDate || !amount) {
    return res.status(400).json({
      success:false,
      message:"Kasa, tarih ve tutar zorunludur."
    });
  }

  db.run(`
    INSERT INTO cash_transactions
    (
      cash_id,
      transaction_date,
      transaction_type,
      amount,
      document_no,
      description
    )
    VALUES (?, ?, ?, ?, ?, ?)
  `, [
    cashId,
    transactionDate,
    transactionType || "income",
    Number(amount || 0),
    documentNo || "",
    description || ""
  ], function(err) {
    if (err) {
      return res.status(500).json({ success:false, message:err.message });
    }

    res.json({
      success:true,
      message:"Kasa hareketi kaydedildi.",
      id:this.lastID
    });
  });
});


// KASA HAREKETİ SİL
app.delete('/api/cash-transactions/:id', (req, res) => {
  const { id } = req.params;

  db.run(`DELETE FROM cash_transactions WHERE id = ?`, [id], function(err) {
    if (err) {
      return res.status(500).json({ success:false, message:err.message });
    }

    res.json({ success:true, message:"Kasa hareketi silindi." });
  });
});

// KASA EKSTRE
app.get('/api/cash-statement/:cashId', (req, res) => {
  const { cashId } = req.params;
  const { startDate, endDate } = req.query;

  let params = [cashId];
  let dateFilter = "";

  if (startDate) {
    dateFilter += " AND date(ct.transaction_date) >= date(?) ";
    params.push(startDate);
  }

  if (endDate) {
    dateFilter += " AND date(ct.transaction_date) <= date(?) ";
    params.push(endDate);
  }

  const sql = `
    SELECT
      ct.id,
      ct.cash_id AS cashId,
      ca.cash_code AS cashCode,
      ca.cash_name AS cashName,
      ca.currency,
      ct.transaction_date AS transactionDate,
      ct.transaction_type AS transactionType,
      ct.amount,
      ct.document_no AS documentNo,
      ct.description,
      ct.created_at
    FROM cash_transactions ct
    LEFT JOIN cash_accounts ca ON ca.id = ct.cash_id
    WHERE ct.cash_id = ?
    ${dateFilter}
    ORDER BY date(ct.transaction_date) ASC, ct.id ASC
  `;

  db.all(sql, params, (err, rows) => {
    if (err) {
      console.error("Kasa ekstre hatası:", err.message);
      return res.status(500).json({
        success: false,
        message: err.message,
        transactions: []
      });
    }

    let balance = 0;

    const transactions = rows.map(row => {
      const amount = Number(row.amount || 0);

      if (row.transactionType === "income") {
        balance += amount;
      } else {
        balance -= amount;
      }

      return {
        ...row,
        income: row.transactionType === "income" ? amount : 0,
        expense: row.transactionType === "expense" ? amount : 0,
        balance
      };
    });

    const totalIncome = transactions.reduce((sum, x) => sum + Number(x.income || 0), 0);
    const totalExpense = transactions.reduce((sum, x) => sum + Number(x.expense || 0), 0);
    const finalBalance = totalIncome - totalExpense;

    res.json({
      success: true,
      transactions,
      summary: {
        totalIncome,
        totalExpense,
        finalBalance
      }
    });
  });
});

app.get('/api/bank-accounts', (req, res) => {
  db.all(`
    SELECT
      id,
      bank_code AS bankCode,
      bank_name AS bankName,
      branch_name AS branchName,
      iban,
      account_no AS accountNo,
      currency,
      opening_balance AS openingBalance,
      status,
      created_at
    FROM bank_accounts
    ORDER BY id DESC
  `, [], (err, rows) => {
    if (err) {
      return res.status(500).json({
        success: false,
        message: err.message,
        bankAccounts: []
      });
    }

    res.json({
      success: true,
      bankAccounts: rows
    });
  });
});


// BANKA KARTI EKLE
app.post('/api/bank-accounts', (req, res) => {
  const {
    bankName,
    branchName,
    iban,
    accountNo,
    currency,
    openingBalance,
    status
  } = req.body;

  if (!bankName) {
    return res.status(400).json({
      success: false,
      message: "Banka adı zorunludur."
    });
  }

  const bankCode = "BANK" + Date.now();

  db.run(`
    INSERT INTO bank_accounts
    (
      bank_code,
      bank_name,
      branch_name,
      iban,
      account_no,
      currency,
      opening_balance,
      status
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `, [
    bankCode,
    bankName,
    branchName || "",
    iban || "",
    accountNo || "",
    currency || "TRY",
    Number(openingBalance || 0),
    status || "active"
  ], function(err) {
    if (err) {
      return res.status(500).json({
        success: false,
        message: err.message
      });
    }

    res.json({
      success: true,
      message: "Banka kartı başarıyla oluşturuldu.",
      id: this.lastID
    });
  });
});


// BANKA KARTI GÜNCELLE
app.put('/api/bank-accounts/:id', (req, res) => {
  const { id } = req.params;

  const {
    bankName,
    branchName,
    iban,
    accountNo,
    currency,
    openingBalance,
    status
  } = req.body;

  db.run(`
    UPDATE bank_accounts SET
      bank_name = ?,
      branch_name = ?,
      iban = ?,
      account_no = ?,
      currency = ?,
      opening_balance = ?,
      status = ?
    WHERE id = ?
  `, [
    bankName,
    branchName || "",
    iban || "",
    accountNo || "",
    currency || "TRY",
    Number(openingBalance || 0),
    status || "active",
    id
  ], function(err) {
    if (err) {
      return res.status(500).json({
        success: false,
        message: err.message
      });
    }

    res.json({
      success: true,
      message: "Banka kartı güncellendi."
    });
  });
});


// BANKA KARTI SİL
app.delete('/api/bank-accounts/:id', (req, res) => {
  const { id } = req.params;

  db.run(`DELETE FROM bank_accounts WHERE id = ?`, [id], function(err) {
    if (err) {
      return res.status(500).json({
        success: false,
        message: err.message
      });
    }

    res.json({
      success: true,
      message: "Banka kartı silindi."
    });
  });
});


// BANKA HAREKETLERİ LİSTELE
app.get('/api/bank-transactions', (req, res) => {
  db.all(`
    SELECT
      bt.id,
      bt.bank_id AS bankId,
      ba.bank_code AS bankCode,
      ba.bank_name AS bankName,
      ba.branch_name AS branchName,
      ba.currency,
      bt.transaction_date AS transactionDate,
      bt.transaction_type AS transactionType,
      bt.amount,
      bt.document_no AS documentNo,
      bt.description,
      bt.created_at
    FROM bank_transactions bt
    LEFT JOIN bank_accounts ba ON ba.id = bt.bank_id
    ORDER BY date(bt.transaction_date) DESC, bt.id DESC
  `, [], (err, rows) => {
    if (err) {
      return res.status(500).json({
        success: false,
        message: err.message,
        transactions: []
      });
    }

    res.json({
      success: true,
      transactions: rows
    });
  });
});


// BANKA HAREKETİ EKLE
app.post('/api/bank-transactions', (req, res) => {
  const {
    bankId,
    transactionDate,
    transactionType,
    amount,
    documentNo,
    description
  } = req.body;

  if (!bankId || !transactionDate || !amount) {
    return res.status(400).json({
      success: false,
      message: "Banka, tarih ve tutar zorunludur."
    });
  }

  db.run(`
    INSERT INTO bank_transactions
    (
      bank_id,
      transaction_date,
      transaction_type,
      amount,
      document_no,
      description
    )
    VALUES (?, ?, ?, ?, ?, ?)
  `, [
    bankId,
    transactionDate,
    transactionType || "income",
    Number(amount || 0),
    documentNo || "",
    description || ""
  ], function(err) {
    if (err) {
      return res.status(500).json({
        success: false,
        message: err.message
      });
    }

    res.json({
      success: true,
      message: "Banka hareketi kaydedildi.",
      id: this.lastID
    });
  });
});


// BANKA HAREKETİ SİL
app.delete('/api/bank-transactions/:id', (req, res) => {
  const { id } = req.params;

  db.run(`DELETE FROM bank_transactions WHERE id = ?`, [id], function(err) {
    if (err) {
      return res.status(500).json({
        success: false,
        message: err.message
      });
    }

    res.json({
      success: true,
      message: "Banka hareketi silindi."
    });
  });
});


// BANKA EKSTRE
app.get('/api/bank-statement/:bankId', (req, res) => {
  const { bankId } = req.params;
  const { startDate, endDate } = req.query;

  let params = [bankId];
  let dateFilter = "";

  if (startDate) {
    dateFilter += " AND date(bt.transaction_date) >= date(?) ";
    params.push(startDate);
  }

  if (endDate) {
    dateFilter += " AND date(bt.transaction_date) <= date(?) ";
    params.push(endDate);
  }

  const sql = `
    SELECT
      bt.id,
      bt.bank_id AS bankId,
      ba.bank_code AS bankCode,
      ba.bank_name AS bankName,
      ba.branch_name AS branchName,
      ba.currency,
      bt.transaction_date AS transactionDate,
      bt.transaction_type AS transactionType,
      bt.amount,
      bt.document_no AS documentNo,
      bt.description,
      bt.created_at
    FROM bank_transactions bt
    LEFT JOIN bank_accounts ba ON ba.id = bt.bank_id
    WHERE bt.bank_id = ?
    ${dateFilter}
    ORDER BY date(bt.transaction_date) ASC, bt.id ASC
  `;

  db.all(sql, params, (err, rows) => {
    if (err) {
      console.error("Banka ekstre hatası:", err.message);
      return res.status(500).json({
        success: false,
        message: err.message,
        transactions: []
      });
    }

    let balance = 0;

    const transactions = rows.map(row => {
      const amount = Number(row.amount || 0);

      if (row.transactionType === "income") {
        balance += amount;
      } else {
        balance -= amount;
      }

      return {
        ...row,
        income: row.transactionType === "income" ? amount : 0,
        expense: row.transactionType === "expense" ? amount : 0,
        balance
      };
    });

    const totalIncome = transactions.reduce((sum, x) => sum + Number(x.income || 0), 0);
    const totalExpense = transactions.reduce((sum, x) => sum + Number(x.expense || 0), 0);
    const finalBalance = totalIncome - totalExpense;

    res.json({
      success: true,
      transactions,
      summary: {
        totalIncome,
        totalExpense,
        finalBalance
      }
    });
  });
});

app.get('/api/bank-accounts', (req, res) => {
  res.json({
    success: true,
    bankAccounts: []
  });
});

app.put("/api/bom/:id", (req, res) => {
  const id = req.params.id;

  const {
    product_id,
    material_id,
    quantity_per_unit,
    unit,
    description
  } = req.body;

  db.run(
    `
    UPDATE product_bom
    SET 
      product_id = ?,
      material_id = ?,
      quantity_per_unit = ?,
      unit = ?,
      description = ?
    WHERE id = ?
    `,
    [
      product_id,
      material_id,
      quantity_per_unit,
      unit || "adet",
      description || "",
      id
    ],
    function (err) {
      if (err) {
        console.error("BOM güncelleme hatası:", err.message);
        return res.status(500).json({
          success: false,
          message: err.message
        });
      }

      res.json({
        success: true,
        message: "Reçete satırı güncellendi."
      });
    }
  );
});

app.delete("/api/bom/:id", (req, res) => {
  const id = req.params.id;

  db.run(
    `DELETE FROM product_bom WHERE id = ?`,
    [id],
    function (err) {
      if (err) {
        console.error("BOM silme hatası:", err.message);
        return res.status(500).json({
          success: false,
          message: err.message
        });
      }

      res.json({
        success: true,
        message: "Reçete satırı silindi."
      });
    }
  );
});
// Ürün reçetesi ekle
app.post("/api/bom", (req, res) => {
  const {
    product_id,
    material_id,
    quantity_per_unit,
    unit,
    description
  } = req.body;

  if (!product_id || !material_id || !quantity_per_unit) {
    return res.status(400).json({
      success: false,
      message: "Ürün, malzeme ve birim ihtiyaç zorunlu."
    });
  }

  db.run(
    `
    INSERT INTO product_bom
    (
      product_id,
      material_id,
      quantity_per_unit,
      unit,
      description
    )
    VALUES (?, ?, ?, ?, ?)
    `,
    [
      product_id,
      material_id,
      quantity_per_unit,
      unit || "adet",
      description || ""
    ],
    function (err) {
      if (err) {
        console.error("BOM ekleme hatası:", err.message);
        return res.status(500).json({
          success: false,
          message: err.message
        });
      }

      res.json({
        success: true,
        message: "Reçete satırı eklendi.",
        id: this.lastID
      });
    }
  );
});

// Ürün reçetesi listele
app.get("/api/bom/:productId", (req, res) => {
  const productId = req.params.productId;

  db.all(
    `
    SELECT 
      b.id,
      b.product_id,
      b.material_id,
      b.quantity_per_unit,
      b.unit,
      b.description,
      b.created_at,

      p.part_name AS product_name,
      p.stock_code AS product_stock_code,

      s.part_name AS material_name,
      s.stock_code AS stock_code,
      s.quantity AS stock_qty

    FROM product_bom b
    LEFT JOIN stocks p ON p.id = b.product_id
    LEFT JOIN stocks s ON s.id = b.material_id
    WHERE b.product_id = ?
    ORDER BY b.id DESC
    `,
    [productId],
    (err, rows) => {
      if (err) {
        console.error("BOM listeleme hatası:", err.message);
        return res.status(500).json({
          success: false,
          message: err.message
        });
      }

      res.json({
        success: true,
        bom: rows
      });
    }
  );
});

// SATIN ALMA TALEBİ ONAYLA
app.put("/api/purchase-requests/:id/approve", (req, res) => {
  const requestId = req.params.id;
  const { approvedBy } = req.body;

  db.run(
    `
    UPDATE purchase_requests
    SET 
      approval_status = 'approved',
      approved_by = ?,
      approved_at = datetime('now')
    WHERE id = ?
    `,
    [approvedBy || "Admin", requestId],
    function (err) {
      if (err) {
        console.error("Satın alma talep onay hatası:", err);
        return res.status(500).json({
          success: false,
          message: err.message
        });
      }

      db.run(
        `
        INSERT INTO purchase_approvals
        (request_id, status, approved_by, approved_at)
        VALUES (?, 'approved', ?, datetime('now'))
        `,
        [requestId, approvedBy || "Admin"]
      );

      res.json({
        success: true,
        message: "Satın alma talebi onaylandı."
      });
    }
  );
});

// SATIN ALMA TALEBİ REDDET
app.put("/api/purchase-requests/:id/reject", (req, res) => {
  const requestId = req.params.id;
  const { rejectedBy, reason } = req.body;

  db.run(
    `
    UPDATE purchase_requests
    SET 
      approval_status = 'rejected',
      approved_by = ?,
      approved_at = datetime('now')
    WHERE id = ?
    `,
    [rejectedBy || "Admin", requestId],
    function (err) {
      if (err) {
        console.error("Satın alma talep red hatası:", err);
        return res.status(500).json({
          success: false,
          message: err.message
        });
      }

      db.run(
        `
        INSERT INTO purchase_approvals
        (request_id, status, approved_by, approved_at, reject_reason)
        VALUES (?, 'rejected', ?, datetime('now'), ?)
        `,
        [requestId, rejectedBy || "Admin", reason || ""]
      );

      res.json({
        success: true,
        message: "Satın alma talebi reddedildi."
      });
    }
  );
});

app.put("/api/purchase-requests/:id/status", (req, res) => {
  const { id } = req.params;
  const { status, note, approved_by } = req.body;

  if (!status) {
    return res.status(400).json({
      success: false,
      message: "Durum zorunlu."
    });
  }

  db.run(
    `
    UPDATE purchase_requests
    SET status = ?
    WHERE id = ?
    `,
    [status, id],
    function (err) {
      if (err) {
        console.error("Talep durum güncelleme hatası:", err.message);
        return res.status(500).json({
          success: false,
          message: err.message
        });
      }

      db.run(
        `
        INSERT INTO purchase_approvals
        (
          approval_type,
          document_id,
          status,
          note,
          approved_by,
          approved_at
        )
        VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
        `,
        [
          "request",
          id,
          status,
          note || "",
          approved_by || ""
        ]
      );

      db.get(
        `SELECT request_no, material_name, quantity, requested_by, supplier_id FROM purchase_requests WHERE id = ?`,
        [id],
        (reqErr, reqRow) => {
          if (!reqErr && reqRow) {
            notifyPurchaseStatusChange({
              db,
              sendPurchaseApprovalMail,
              getNotifyRecipients,
              docTypeLabel: "Satın Alma Talebi",
              docNo: reqRow.request_no,
              materialName: reqRow.material_name,
              quantity: reqRow.quantity,
              unit: "",
              supplierId: reqRow.supplier_id,
              requestedBy: reqRow.requested_by,
              status,
              note
            });
          }
        }
      );

      res.json({
        success: true,
        message: "Satın alma talebi durumu güncellendi."
      });
    }
  );
});

app.delete("/api/purchase-requests/:id", (req, res) => {
  const { id } = req.params;

  db.run(
    `DELETE FROM purchase_requests WHERE id = ?`,
    [id],
    function (err) {
      if (err) {
        console.error("Satın alma talebi silme hatası:", err.message);
        return res.status(500).json({
          success: false,
          message: err.message
        });
      }

      res.json({
        success: true,
        message: "Satın alma talebi silindi."
      });
    }
  );
});

app.get("/api/purchase-orders", (req, res) => {
  db.all(
    `
    SELECT
      po.id,
      po.order_no,
      po.purchase_request_id,
      po.supplier_id,
      po.material_id,
      po.quantity,
      po.unit,
      po.unit_price,
      po.total_amount,
      po.delivery_date,
      po.note,
      po.status,
      po.created_at,

      pr.request_no,
      s.stock_code,
      s.part_name AS material_name,

      sup.company_name AS supplier_name

    FROM purchase_orders po
    LEFT JOIN purchase_requests pr ON pr.id = po.purchase_request_id
    LEFT JOIN stocks s ON s.id = po.material_id
    LEFT JOIN suppliers sup ON sup.id = po.supplier_id
    ORDER BY po.id DESC
    `,
    [],
    (err, rows) => {
      if (err) {
        console.error("Satın alma sipariş listeleme hatası:", err.message);
        return res.status(500).json({
          success: false,
          message: err.message
        });
      }

      res.json({
        success: true,
        orders: rows
      });
    }
  );
});


app.post("/api/purchase-orders", (req, res) => {
  console.log(req.body);
  const {
    order_no,
    purchase_request_id,
    supplier_id,
    quantity,
    unit,
    unit_price,
    total_amount,
    delivery_date,
    note,
    status
  } = req.body;

  if (!purchase_request_id || !supplier_id || !quantity) {
    return res.status(400).json({
      success: false,
      message: "Talep, tedarikçi ve miktar zorunlu."
    });
  }

  db.get(
    `
    SELECT material_id
    FROM purchase_requests
    WHERE id = ?
    `,
    [purchase_request_id],
    (err, request) => {
      if (err) {
        console.error("Talep getirme hatası:", err.message);
        return res.status(500).json({
          success: false,
          message: err.message
        });
      }

      if (!request) {
        return res.status(404).json({
          success: false,
          message: "Satın alma talebi bulunamadı."
        });
      }

      const finalOrderNo = order_no || "SAS" + Date.now();

      db.run(
        `
        INSERT INTO purchase_orders
        (
          order_no,
          purchase_request_id,
          supplier_id,
          material_id,
          quantity,
          unit,
          unit_price,
          total_amount,
          delivery_date,
          note,
          status
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
        [
          finalOrderNo,
          purchase_request_id,
          supplier_id,
          request.material_id,
          quantity,
          unit || "adet",
          unit_price || 0,
          total_amount || Number(quantity || 0) * Number(unit_price || 0),
          delivery_date || "",
          note || "",
          status || "open"
        ],
        function (err) {
          if (err) {
            console.error("Satın alma sipariş oluşturma hatası:", err.message);
            return res.status(500).json({
              success: false,
              message: err.message
            });
          }

          db.run(
            `
            UPDATE purchase_requests
            SET status = 'ordered'
            WHERE id = ?
            `,
            [purchase_request_id]
          );

          res.json({
            success: true,
            message: "Satın alma siparişi oluşturuldu.",
            id: this.lastID
          });
        }
      );
    }
  );
});

app.put("/api/purchase-orders/:id/status", (req, res) => {
  const { id } = req.params;
  const { status, note, approved_by } = req.body;

  if (!status) {
    return res.status(400).json({
      success: false,
      message: "Durum zorunlu."
    });
  }

  db.run(
    `
    UPDATE purchase_orders
    SET status = ?
    WHERE id = ?
    `,
    [status, id],
    function (err) {
      if (err) {
        console.error("Sipariş durum güncelleme hatası:", err.message);
        return res.status(500).json({
          success: false,
          message: err.message
        });
      }

      db.run(
        `
        INSERT INTO purchase_approvals
        (
          approval_type,
          document_id,
          status,
          note,
          approved_by,
          approved_at
        )
        VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
        `,
        [
          "order",
          id,
          status,
          note || "",
          approved_by || ""
        ]
      );

      db.get(
        `SELECT order_no, material_name, quantity, unit, supplier_id FROM purchase_orders WHERE id = ?`,
        [id],
        (ordErr, ordRow) => {
          if (!ordErr && ordRow) {
            notifyPurchaseStatusChange({
              db,
              sendPurchaseApprovalMail,
              getNotifyRecipients,
              docTypeLabel: "Satın Alma Siparişi",
              docNo: ordRow.order_no,
              materialName: ordRow.material_name,
              quantity: ordRow.quantity,
              unit: ordRow.unit,
              supplierId: ordRow.supplier_id,
              requestedBy: null,
              status,
              note
            });
          }
        }
      );

      res.json({
        success: true,
        message: "Satın alma siparişi durumu güncellendi."
      });
    }
  );
});

app.delete("/api/purchase-orders/:id", (req, res) => {
  const { id } = req.params;

  db.run(
    `DELETE FROM purchase_orders WHERE id = ?`,
    [id],
    function (err) {
      if (err) {
        console.error("Satın alma siparişi silme hatası:", err.message);
        return res.status(500).json({
          success: false,
          message: err.message
        });
      }

      res.json({
        success: true,
        message: "Satın alma siparişi silindi."
      });
    }
  );
});
function addColumnIfMissing(tableName, columnName, columnDefinition) {
  db.all(`PRAGMA table_info(${tableName})`, [], (err, columns) => {
    if (err) {
      console.error(`${tableName} kolon kontrol hatası:`, err.message);
      return;
    }

    const exists = columns.some(col => col.name === columnName);

    if (!exists) {
      db.run(
        `ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${columnDefinition}`,
        (alterErr) => {
          if (alterErr) {
            console.error(`${tableName}.${columnName} ekleme hatası:`, alterErr.message);
          } else {
            console.log(`${tableName}.${columnName} eklendi.`);
          }
        }
      );
    }
  });
}
// MRP hesapla
app.post("/api/mrp/calculate", (req, res) => {
  const { work_order_id } = req.body;

  if (!work_order_id) {
    return res.status(400).json({
      success: false,
      message: "İş emri zorunlu"
    });
  }

  db.get(
    `SELECT * FROM work_orders WHERE id = ?`,
    [work_order_id],
    (err, workOrder) => {
      if (err) {
        console.error("İş emri sorgu hatası:", err);
        return res.status(500).json({
          success: false,
          message: err.message
        });
      }

      if (!workOrder) {
        return res.status(404).json({
          success: false,
          message: "İş emri bulunamadı"
        });
      }

      return res.json({
        success: true,
        results: []
      });
    }
  );
});


app.get("/api/production/work-orders", (req, res) => {
  db.all(`
    SELECT 
      wo.*,
      IFNULL(SUM(pr.produced_qty), 0) AS total_produced,
      IFNULL(SUM(pr.scrap_qty), 0) AS total_scrap
    FROM work_orders wo
    LEFT JOIN production_records pr ON pr.work_order_id = wo.id
    GROUP BY wo.id
    ORDER BY wo.id DESC
  `, [], (err, rows) => {
    if (err) {
      console.error("Üretim iş emirleri hatası:", err);
      return res.status(500).json({ success: false, message: err.message });
    }

    res.json({ success: true, workOrders: rows });
  });
});

app.get("/api/production/records/:workOrderId", (req, res) => {
  const { workOrderId } = req.params;

  db.all(`
    SELECT *
    FROM production_records
    WHERE work_order_id = ?
    ORDER BY id DESC
  `, [workOrderId], (err, rows) => {
    if (err) {
      console.error("Üretim kayıtları hatası:", err);
      return res.status(500).json({ success: false, message: err.message });
    }

    res.json({ success: true, records: rows });
  });
});

app.post("/api/production/records", (req, res) => {
  const {
    work_order_id,
    operation_name,
    produced_qty,
    scrap_qty,
    downtime_min,
    operator_name,
    note
  } = req.body;

  if (!work_order_id) {
    return res.status(400).json({
      success: false,
      message: "İş emri zorunlu"
    });
  }

  if (!produced_qty && !scrap_qty) {
    return res.status(400).json({
      success: false,
      message: "Üretilen veya hurda miktarı girilmeli"
    });
  }

  db.run(`
    INSERT INTO production_records
    (
      work_order_id,
      operation_name,
      produced_qty,
      scrap_qty,
      downtime_min,
      operator_name,
      note
    )
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `, [
    work_order_id,
    operation_name || "",
    Number(produced_qty || 0),
    Number(scrap_qty || 0),
    Number(downtime_min || 0),
    operator_name || "",
    note || ""
  ], function(err) {
    if (err) {
      console.error("Üretim kaydı ekleme hatası:", err);
      return res.status(500).json({ success: false, message: err.message });
    }

    res.json({
      success: true,
      message: "Üretim kaydı başarıyla eklendi",
      id: this.lastID
    });
  });
});

app.delete("/api/production/records/:id", (req, res) => {
  const { id } = req.params;

  db.run(`DELETE FROM production_records WHERE id = ?`, [id], function(err) {
    if (err) {
      console.error("Üretim kaydı silme hatası:", err);
      return res.status(500).json({ success: false, message: err.message });
    }

    res.json({
      success: true,
      message: "Üretim kaydı silindi"
    });
  });
});

app.get("/api/quality/work-orders", (req, res) => {
  db.all(
    `
    SELECT *
    FROM work_orders
    ORDER BY id DESC
    `,
    [],
    (err, rows) => {
      if (err) {
        console.error("Kalite iş emirleri hatası:", err.message);
        return res.status(500).json({
          success: false,
          message: err.message
        });
      }

      res.json({
        success: true,
        workOrders: rows
      });
    }
  );
});

app.get("/api/shipments/work-orders", (req, res) => {
  db.all(
    `
    SELECT *
    FROM work_orders
    ORDER BY id DESC
    `,
    [],
    (err, rows) => {
      if (err) {
        console.error("Sevkiyat iş emirleri hatası:", err.message);
        return res.status(500).json({
          success: false,
          message: err.message
        });
      }

      res.json({
        success: true,
        workOrders: rows
      });
    }
  );
});

app.get("/api/shipments/customers", (req, res) => {
  db.all(
    `
    SELECT *
    FROM customers
    ORDER BY id DESC
    `,
    [],
    (err, rows) => {
      if (err) {
        console.error("Sevkiyat müşteri liste hatası:", err.message);
        return res.status(500).json({
          success: false,
          message: err.message
        });
      }

      res.json({
        success: true,
        customers: rows
      });
    }
  );
});

app.get("/api/shipments", (req, res) => {
  db.all(
    `
    SELECT *
    FROM shipments
    ORDER BY id DESC
    `,
    [],
    (err, rows) => {
      if (err) {
        console.error("Sevkiyat listeleme hatası:", err.message);
        return res.status(500).json({
          success: false,
          message: err.message
        });
      }

      res.json({
        success: true,
        shipments: rows
      });
    }
  );
});

app.get("/api/shipments", (req, res) => {
  db.all(
    `
    SELECT 
      s.*
    FROM shipments s
    ORDER BY s.id DESC
    `,
    [],
    (err, rows) => {
      if (err) {
        console.error("Sevkiyat listeleme hatası:", err.message);
        return res.status(500).json({
          success: false,
          message: err.message
        });
      }

      res.json({
        success: true,
        shipments: rows
      });
    }
  );
});

app.post("/api/shipments", (req, res) => {
  const {
    shipment_no,
    work_order_id,
    customer_id,
    shipment_date,
    delivery_note_no,
    shipped_qty,
    vehicle_plate,
    driver_name,
    delivery_status,
    note
  } = req.body;

  if (!work_order_id) {
    return res.status(400).json({
      success: false,
      message: "İş emri zorunludur."
    });
  }

  const shipmentNo = shipment_no || "SVK" + Date.now();

  db.run(
    `
    INSERT INTO shipments
    (
      shipment_no,
      work_order_id,
      customer_id,
      shipment_date,
      delivery_note_no,
      shipped_qty,
      vehicle_plate,
      driver_name,
      delivery_status,
      note
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    [
      shipmentNo,
      work_order_id,
      customer_id || null,
      shipment_date || new Date().toISOString().split("T")[0],
      delivery_note_no || "",
      shipped_qty || 0,
      vehicle_plate || "",
      driver_name || "",
      delivery_status || "prepared",
      note || ""
    ],
    function (err) {
      if (err) {
        console.error("Sevkiyat ekleme hatası:", err.message);
        return res.status(500).json({
          success: false,
          message: err.message
        });
      }

      res.json({
        success: true,
        message: "Sevkiyat kaydı oluşturuldu.",
        id: this.lastID
      });
    }
  );
});

app.put("/api/shipments/:id/status", (req, res) => {
  const { id } = req.params;
  const { delivery_status } = req.body;

  db.run(
    `
    UPDATE shipments
    SET delivery_status = ?
    WHERE id = ?
    `,
    [delivery_status || "prepared", id],
    function (err) {
      if (err) {
        console.error("Sevkiyat durum güncelleme hatası:", err.message);
        return res.status(500).json({
          success: false,
          message: err.message
        });
      }

      res.json({
        success: true,
        message: "Sevkiyat durumu güncellendi."
      });
    }
  );
});

app.delete("/api/shipments/:id", (req, res) => {
  const { id } = req.params;

  db.run(
    `
    DELETE FROM shipments
    WHERE id = ?
    `,
    [id],
    function (err) {
      if (err) {
        console.error("Sevkiyat silme hatası:", err.message);
        return res.status(500).json({
          success: false,
          message: err.message
        });
      }

      res.json({
        success: true,
        message: "Sevkiyat kaydı silindi."
      });
    }
  );
});

app.get("/api/quality/records/:workOrderId", (req, res) => {
  const workOrderId = req.params.workOrderId;

  db.all(
    `
    SELECT *
    FROM quality_controls
    WHERE work_order_id = ?
    ORDER BY id DESC
    `,
    [workOrderId],
    (err, rows) => {
      if (err) {
        console.error("Kalite kayıtları listeleme hatası:", err.message);
        return res.status(500).json({
          success: false,
          message: err.message
        });
      }

      res.json({
        success: true,
        records: rows
      });
    }
  );
});

app.post("/api/quality/records", (req, res) => {
  const {
    work_order_id,
    control_date,
    checked_qty,
    accepted_qty,
    rejected_qty,
    defect_reason,
    measurement_note,
    inspector_name,
    status
  } = req.body;

  if (!work_order_id) {
    return res.status(400).json({
      success: false,
      message: "İş emri zorunludur."
    });
  }

  db.run(
    `
    INSERT INTO quality_controls
    (
      work_order_id,
      control_date,
      checked_qty,
      accepted_qty,
      rejected_qty,
      defect_reason,
      measurement_note,
      inspector_name,
      status
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    [
      work_order_id,
      control_date || new Date().toISOString().split("T")[0],
      checked_qty || 0,
      accepted_qty || 0,
      rejected_qty || 0,
      defect_reason || "",
      measurement_note || "",
      inspector_name || "",
      status || "pending"
    ],
    function (err) {
      if (err) {
        console.error("Kalite kaydı ekleme hatası:", err.message);
        return res.status(500).json({
          success: false,
          message: err.message
        });
      }

      res.json({
        success: true,
        message: "Kalite kontrol kaydı eklendi.",
        id: this.lastID
      });
    }
  );
});

app.delete("/api/quality/records/:id", (req, res) => {
  const id = req.params.id;

  db.run(
    `DELETE FROM quality_controls WHERE id = ?`,
    [id],
    function (err) {
      if (err) {
        console.error("Kalite kaydı silme hatası:", err.message);
        return res.status(500).json({
          success: false,
          message: err.message
        });
      }

      res.json({
        success: true,
        message: "Kalite kaydı silindi."
      });
    }
  );
});
app.post("/api/mrp/create-purchase-requests", (req, res) => {
  const { work_order_id } = req.body;

  if (!work_order_id) {
    return res.status(400).json({ success: false, message: "İş emri zorunlu." });
  }

  db.all(
    `
    SELECT r.*, b.unit
    FROM mrp_results r
    LEFT JOIN product_bom b 
      ON b.product_id = r.product_id 
      AND b.material_id = r.material_id
    WHERE r.work_order_id = ?
      AND r.shortage_qty > 0
    `,
    [work_order_id],
    (err, rows) => {
      if (err) return res.status(500).json({ success: false, message: err.message });

      if (!rows.length) {
        return res.json({
          success: true,
          message: "Eksik malzeme yok. Satın alma talebi oluşturulmadı."
        });
      }

      rows.forEach(row => {
        const requestNo = "SAT" + Date.now() + Math.floor(Math.random() * 999);

        db.run(
          `
          INSERT INTO purchase_requests
          (request_no, material_id, quantity, unit, source_type, work_order_id, status)
          VALUES (?, ?, ?, ?, 'MRP', ?, 'pending')
          `,
          [
            requestNo,
            row.material_id,
            row.shortage_qty,
            row.unit || "adet",
            work_order_id
          ]
        );
      });

      res.json({
        success: true,
        message: `${rows.length} adet satın alma talebi oluşturuldu.`
      });
    }
  );
});
app.get("/api/mrp/results/:workOrderId", (req, res) => {
  const workOrderId = req.params.workOrderId;

  db.all(
    `
    SELECT 
      r.id,
      r.work_order_id,
      r.product_id,
      r.material_id,
      s.name AS material_name,
      s.stock_code,
      r.required_qty,
      r.stock_qty,
      r.shortage_qty,
      r.status,
      r.created_at
    FROM mrp_results r
    LEFT JOIN stocks s ON s.id = r.material_id
    WHERE r.work_order_id = ?
    ORDER BY r.id DESC
    `,
    [workOrderId],
    (err, rows) => {
      if (err) {
        console.error("MRP sonuç listeleme hatası:", err.message);
        return res.status(500).json({
          success: false,
          message: err.message
        });
      }

      res.json({
        success: true,
        results: rows
      });
    }
  );
});

app.put("/api/production-tracking/:id", (req, res) => {
  const {
    workOrderNo,
    operationName,
    machineId,
    operatorName,
    startDatetime,
    endDatetime,
    progress,
    status,
    description
  } = req.body;

  db.run(
    `
    UPDATE production_tracking SET
      work_order_no = ?,
      operation_name = ?,
      machine_id = ?,
      operator_name = ?,
      start_datetime = ?,
      end_datetime = ?,
      progress = ?,
      status = ?,
      description = ?
    WHERE id = ?
    `,
    [
      workOrderNo,
      operationName,
      machineId || null,
      operatorName,
      startDatetime,
      endDatetime,
      Number(progress || 0),
      status || "waiting",
      description,
      req.params.id
    ],
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
app.delete("/api/production-tracking/:id", (req, res) => {
  db.run(
    "DELETE FROM production_tracking WHERE id = ?",
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

};

// ===============================
// Satın alma talebi / siparişi onaylandığında ya da reddedildiğinde
// admin/muhasebe/satın alma rolündeki kullanıcılara mail bildirimi gönder
// ===============================
function notifyPurchaseStatusChange({
  db,
  sendPurchaseApprovalMail,
  getNotifyRecipients,
  docTypeLabel,
  docNo,
  materialName,
  quantity,
  unit,
  supplierId,
  requestedBy,
  status,
  note
}) {
  if (!sendPurchaseApprovalMail || !getNotifyRecipients) return;

  const isRejected = status !== "approved";
  const statusLabel = isRejected ? "Reddedildi" : "Onaylandı";

  const buildAndSend = (supplierName) => {
    getNotifyRecipients(db, [], (err, recipients) => {
      if (err) {
        console.error("Bildirim için kullanıcılar alınamadı:", err.message);
        return;
      }
      if (recipients.length === 0) return;

      sendPurchaseApprovalMail(
        {
          docNo,
          docTypeLabel,
          materialName,
          quantity,
          unit,
          supplierName,
          requestedBy,
          statusLabel,
          isRejected,
          note
        },
        recipients
      ).then((result) => {
        if (result.success) {
          console.log(
            `[mailer] ${docTypeLabel} ${statusLabel.toLowerCase()} maili gönderildi -> ${recipients.map(u => u.email).join(", ")}`
          );
        } else {
          console.warn(`${docTypeLabel} bildirim maili gönderilemedi:`, result.message);
        }
      });
    });
  };

  if (supplierId) {
    db.get(`SELECT company_name FROM suppliers WHERE id = ?`, [supplierId], (err, row) => {
      buildAndSend(row ? row.company_name : null);
    });
  } else {
    buildAndSend(null);
  }
}
