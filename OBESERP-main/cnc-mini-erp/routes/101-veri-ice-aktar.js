// EXCEL İLE VERİ İÇE AKTARMA (Müşteri, Stok/Ürün, İş Emri)
const multer = require("multer");
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });
const { parseExcelBuffer, buildTemplateBuffer, buildErrorReportBuffer } = require("../utils/excelImport");

module.exports = function register(app, ctx) {
  const db = ctx.db;
  const dbGet = ctx.dbGet;
  const dbAll = ctx.dbAll;
  const dbRun = ctx.dbRun;

  // -------------------------------
  // Yardımcılar
  // -------------------------------
  function normalizeRow(row) {
    const map = {};
    Object.keys(row).forEach((k) => {
      map[String(k).trim().toLowerCase()] = typeof row[k] === "string" ? row[k].trim() : row[k];
    });
    return map;
  }

  function getField(normalizedRow, variants) {
    for (const v of variants) {
      const val = normalizedRow[v];
      if (val !== undefined && val !== null && String(val).trim() !== "") return val;
    }
    return "";
  }

  function toNumberOrNull(val) {
    if (val === "" || val === undefined || val === null) return null;
    const n = Number(String(val).replace(",", "."));
    return isNaN(n) ? undefined : n; // undefined = geçersiz sayı
  }

  function parseDateFlexible(val) {
    if (!val) return null;
    if (val instanceof Date && !isNaN(val)) {
      return val.toISOString().slice(0, 10);
    }
    const s = String(val).trim();
    // YYYY-MM-DD
    if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
    // DD.MM.YYYY veya DD/MM/YYYY
    const m = s.match(/^(\d{1,2})[.\/](\d{1,2})[.\/](\d{4})$/);
    if (m) return `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
    return undefined; // geçersiz format
  }

  function buildErrorReportBase64(errorRows) {
    if (!errorRows.length) return null;
    return buildErrorReportBuffer(errorRows).toString("base64");
  }

  // ===============================
  // ŞABLON İNDİRME
  // ===============================
  const TEMPLATES = {
    customers: {
      headers: ["Firma Adı", "Yetkili Kişi", "Telefon", "E-posta", "Şehir", "Vergi No"],
      example: [{
        "Firma Adı": "ABC Metal San. Tic. Ltd. Şti.",
        "Yetkili Kişi": "Ahmet Yılmaz",
        "Telefon": "05551234567",
        "E-posta": "ahmet@abcmetal.com",
        "Şehir": "İstanbul",
        "Vergi No": "1234567890"
      }]
    },
    stocks: {
      headers: ["Stok Kodu", "Parça Adı", "Kategori", "Birim", "Miktar", "Min. Miktar", "Lokasyon"],
      example: [{
        "Stok Kodu": "STK00001",
        "Parça Adı": "Flanş 100mm",
        "Kategori": "Hammadde",
        "Birim": "Adet",
        "Miktar": 50,
        "Min. Miktar": 10,
        "Lokasyon": "A-Depo Raf 3"
      }]
    },
    "work-orders": {
      headers: ["İş Emri No", "Müşteri", "Parça Adı", "Teslim Tarihi", "Öncelik", "Durum"],
      example: [{
        "İş Emri No": "IS-2026-001",
        "Müşteri": "ABC Metal San. Tic. Ltd. Şti.",
        "Parça Adı": "Mil 25x300",
        "Teslim Tarihi": "15.07.2026",
        "Öncelik": "Normal",
        "Durum": "Açık"
      }]
    },
    suppliers: {
      headers: ["Firma Adı", "Yetkili Kişi", "Telefon", "E-posta", "Vergi No"],
      example: [{
        "Firma Adı": "Demir Metal A.Ş.",
        "Yetkili Kişi": "Ali Veli",
        "Telefon": "05551112233",
        "E-posta": "info@demirmetal.com",
        "Vergi No": "9876543210"
      }]
    },
    "current-accounts": {
      headers: ["Firma Adı", "Yetkili Kişi", "Telefon", "E-posta", "Vergi No", "Vergi Dairesi", "Adres", "Risk Limiti", "Hesap Tipi"],
      example: [{
        "Firma Adı": "XYZ Sanayi Ltd. Şti.",
        "Yetkili Kişi": "Zeynep Kaya",
        "Telefon": "05559998877",
        "E-posta": "zeynep@xyzsanayi.com",
        "Vergi No": "1122334455",
        "Vergi Dairesi": "Kadıköy",
        "Adres": "Örnek Mah. Örnek Cad. No:1 İstanbul",
        "Risk Limiti": 50000,
        "Hesap Tipi": "Müşteri"
      }]
    }
  };

  app.get("/api/import/template/:type", (req, res) => {
    const tpl = TEMPLATES[req.params.type];
    if (!tpl) return res.status(404).json({ success: false, message: "Bilinmeyen şablon türü." });

    const buffer = buildTemplateBuffer(tpl.headers, tpl.example);
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename="${req.params.type}-sablon.xlsx"`);
    res.send(buffer);
  });

  // ===============================
  // MÜŞTERİ İÇE AKTARMA
  // ===============================
  app.post("/api/import/customers", upload.single("file"), async (req, res) => {
    try {
      if (!req.file) return res.status(400).json({ success: false, message: "Dosya yüklenmedi." });

      const rows = parseExcelBuffer(req.file.buffer);
      const errors = [];
      const validRows = [];

      const lastCustomer = await dbGet(`SELECT id FROM customers ORDER BY id DESC LIMIT 1`);
      let nextNo = (lastCustomer?.id || 0) + 1;

      rows.forEach((raw, idx) => {
        const rowNum = idx + 2; // 1. satır başlık
        const r = normalizeRow(raw);
        const rowErrors = [];

        const companyName = getField(r, ["firma adı", "firma adi", "müşteri", "musteri", "şirket adı", "company name"]);
        const email = getField(r, ["e-posta", "eposta", "email", "e mail"]);

        if (!companyName) rowErrors.push("Firma adı zorunludur.");
        if (email && !String(email).includes("@")) rowErrors.push("Geçersiz e-posta formatı.");

        if (rowErrors.length) {
          errors.push({ row: rowNum, errors: rowErrors, data: raw });
          return;
        }

        validRows.push({
          customerCode: "MUS" + String(nextNo++).padStart(5, "0"),
          companyName,
          authorizedPerson: getField(r, ["yetkili kişi", "yetkili", "yetkili kisi", "authorized person"]),
          phone: getField(r, ["telefon", "phone"]),
          email,
          city: getField(r, ["şehir", "sehir", "city"]),
          taxNo: getField(r, ["vergi no", "vergi numarası", "tax no"])
        });
      });

      for (const c of validRows) {
        await dbRun(
          `INSERT INTO customers (customer_code, company_name, authorized_person, phone, email, city, tax_no, status)
           VALUES (?, ?, ?, ?, ?, ?, ?, 'active')`,
          [c.customerCode, c.companyName, c.authorizedPerson, c.phone, c.email, c.city, c.taxNo]
        );
      }

      res.json({
        success: true,
        totalRows: rows.length,
        insertedCount: validRows.length,
        errorCount: errors.length,
        errors,
        errorReportBase64: buildErrorReportBase64(errors)
      });
    } catch (err) {
      console.error("Müşteri içe aktarma hatası:", err.message);
      res.status(500).json({ success: false, message: "İçe aktarma başarısız: " + err.message });
    }
  });

  // ===============================
  // STOK / ÜRÜN İÇE AKTARMA
  // ===============================
  app.post("/api/import/stocks", upload.single("file"), async (req, res) => {
    try {
      if (!req.file) return res.status(400).json({ success: false, message: "Dosya yüklenmedi." });

      const rows = parseExcelBuffer(req.file.buffer);
      const errors = [];
      const validRows = [];
      const usedCodes = new Set();

      const lastStock = await dbGet(`SELECT id FROM stocks ORDER BY id DESC LIMIT 1`);
      let nextNo = (lastStock?.id || 0) + 1;

      for (let idx = 0; idx < rows.length; idx++) {
        const raw = rows[idx];
        const rowNum = idx + 2;
        const r = normalizeRow(raw);
        const rowErrors = [];

        const partName = getField(r, ["parça adı", "parca adi", "ürün adı", "urun adi", "part name"]);
        let stockCode = getField(r, ["stok kodu", "kod", "stock code"]);
        const quantity = toNumberOrNull(getField(r, ["miktar", "quantity", "stok miktarı"]));
        const minQuantity = toNumberOrNull(getField(r, ["min. miktar", "min miktar", "minimum miktar", "min quantity"]));

        if (!partName) rowErrors.push("Parça/Ürün adı zorunludur.");
        if (quantity === undefined) rowErrors.push("Miktar sayısal olmalıdır.");
        if (minQuantity === undefined) rowErrors.push("Min. Miktar sayısal olmalıdır.");

        if (stockCode) {
          if (usedCodes.has(stockCode)) {
            rowErrors.push("Bu stok kodu dosya içinde birden fazla kez kullanılmış.");
          } else {
            const existing = await dbGet(`SELECT id FROM stocks WHERE stock_code = ?`, [stockCode]);
            if (existing) rowErrors.push("Bu stok kodu zaten sistemde kayıtlı: " + stockCode);
          }
        } else {
          stockCode = "STK" + String(nextNo++).padStart(5, "0");
        }

        if (rowErrors.length) {
          errors.push({ row: rowNum, errors: rowErrors, data: raw });
          continue;
        }

        usedCodes.add(stockCode);
        validRows.push({
          stockCode,
          partName,
          category: getField(r, ["kategori", "category"]),
          unit: getField(r, ["birim", "unit"]) || "Adet",
          quantity: quantity || 0,
          minQuantity: minQuantity || 0,
          location: getField(r, ["lokasyon", "konum", "location", "depo"])
        });
      }

      for (const s of validRows) {
        await dbRun(
          `INSERT INTO stocks (stock_code, part_name, category, unit, quantity, min_quantity, location, status)
           VALUES (?, ?, ?, ?, ?, ?, ?, 'active')`,
          [s.stockCode, s.partName, s.category, s.unit, s.quantity, s.minQuantity, s.location]
        );
      }

      res.json({
        success: true,
        totalRows: rows.length,
        insertedCount: validRows.length,
        errorCount: errors.length,
        errors,
        errorReportBase64: buildErrorReportBase64(errors)
      });
    } catch (err) {
      console.error("Stok içe aktarma hatası:", err.message);
      res.status(500).json({ success: false, message: "İçe aktarma başarısız: " + err.message });
    }
  });

  // ===============================
  // İŞ EMRİ İÇE AKTARMA
  // ===============================
  const STATUS_MAP = { "açık": "open", "acik": "open", "devam ediyor": "progress", "tamamlandı": "done", "tamamlandi": "done", "iptal": "cancelled" };
  const PRIORITY_MAP = { "düşük": "low", "dusuk": "low", "normal": "normal", "yüksek": "high", "yuksek": "high", "acil": "urgent" };

  app.post("/api/import/work-orders", upload.single("file"), async (req, res) => {
    try {
      if (!req.file) return res.status(400).json({ success: false, message: "Dosya yüklenmedi." });

      const rows = parseExcelBuffer(req.file.buffer);
      const errors = [];
      const validRows = [];
      const customerCache = new Map();

      for (let idx = 0; idx < rows.length; idx++) {
        const raw = rows[idx];
        const rowNum = idx + 2;
        const r = normalizeRow(raw);
        const rowErrors = [];

        const workOrderNo = getField(r, ["iş emri no", "is emri no", "work order no"]);
        const title = getField(r, ["parça adı", "parca adi", "iş adı", "başlık", "title"]);
        const customerName = getField(r, ["müşteri", "musteri", "firma adı", "customer"]);
        const dueDateRaw = getField(r, ["teslim tarihi", "due date", "bitiş tarihi"]);
        const priorityRaw = getField(r, ["öncelik", "priority"]);
        const statusRaw = getField(r, ["durum", "status"]);

        if (!workOrderNo) rowErrors.push("İş Emri No zorunludur.");
        if (!title) rowErrors.push("Parça/İş adı zorunludur.");

        let customerId = null;
        if (customerName) {
          const key = String(customerName).trim().toLowerCase();
          if (customerCache.has(key)) {
            customerId = customerCache.get(key);
          } else {
            const cust = await dbGet(
              `SELECT id FROM customers WHERE LOWER(company_name) = LOWER(?)`,
              [customerName]
            );
            customerId = cust ? cust.id : null;
            customerCache.set(key, customerId);
          }
          if (!customerId) rowErrors.push("Müşteri bulunamadı: " + customerName);
        }

        const dueDate = parseDateFlexible(dueDateRaw);
        if (dueDate === undefined) rowErrors.push("Geçersiz teslim tarihi formatı (GG.AA.YYYY olmalı).");

        if (rowErrors.length) {
          errors.push({ row: rowNum, errors: rowErrors, data: raw });
          continue;
        }

        validRows.push({
          workOrderNo,
          customerId,
          title,
          dueDate: dueDate || null,
          priority: PRIORITY_MAP[String(priorityRaw).trim().toLowerCase()] || "normal",
          status: STATUS_MAP[String(statusRaw).trim().toLowerCase()] || "open"
        });
      }

      for (const w of validRows) {
        await dbRun(
          `INSERT INTO work_orders (work_order_no, customer_id, part_name, delivery_date, status, priority)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [w.workOrderNo, w.customerId, w.title, w.dueDate, w.status, w.priority]
        );
      }

      res.json({
        success: true,
        totalRows: rows.length,
        insertedCount: validRows.length,
        errorCount: errors.length,
        errors,
        errorReportBase64: buildErrorReportBase64(errors)
      });
    } catch (err) {
      console.error("İş emri içe aktarma hatası:", err.message);
      res.status(500).json({ success: false, message: "İçe aktarma başarısız: " + err.message });
    }
  });

  // ===============================
  // TEDARİKÇİ İÇE AKTARMA
  // ===============================
  app.post("/api/import/suppliers", upload.single("file"), async (req, res) => {
    try {
      if (!req.file) return res.status(400).json({ success: false, message: "Dosya yüklenmedi." });

      const rows = parseExcelBuffer(req.file.buffer);
      const errors = [];
      const validRows = [];

      rows.forEach((raw, idx) => {
        const rowNum = idx + 2;
        const r = normalizeRow(raw);
        const rowErrors = [];

        const companyName = getField(r, ["firma adı", "firma adi", "tedarikçi", "tedarikci", "company name"]);
        const email = getField(r, ["e-posta", "eposta", "email", "e mail"]);

        if (!companyName) rowErrors.push("Firma adı zorunludur.");
        if (email && !String(email).includes("@")) rowErrors.push("Geçersiz e-posta formatı.");

        if (rowErrors.length) {
          errors.push({ row: rowNum, errors: rowErrors, data: raw });
          return;
        }

        validRows.push({
          companyName,
          authorizedPerson: getField(r, ["yetkili kişi", "yetkili", "yetkili kisi", "authorized person"]),
          phone: getField(r, ["telefon", "phone"]),
          email,
          taxNo: getField(r, ["vergi no", "vergi numarası", "tax no"])
        });
      });

      for (const s of validRows) {
        await dbRun(
          `INSERT INTO suppliers (company_name, authorized_person, phone, email, tax_no, status)
           VALUES (?, ?, ?, ?, ?, 'active')`,
          [s.companyName, s.authorizedPerson, s.phone, s.email, s.taxNo]
        );
      }

      res.json({
        success: true,
        totalRows: rows.length,
        insertedCount: validRows.length,
        errorCount: errors.length,
        errors,
        errorReportBase64: buildErrorReportBase64(errors)
      });
    } catch (err) {
      console.error("Tedarikçi içe aktarma hatası:", err.message);
      res.status(500).json({ success: false, message: "İçe aktarma başarısız: " + err.message });
    }
  });

  // ===============================
  // CARİ HESAP İÇE AKTARMA
  // ===============================
  const ACCOUNT_TYPE_MAP = { "müşteri": "customer", "musteri": "customer", "tedarikçi": "supplier", "tedarikci": "supplier", "her ikisi": "both", "both": "both" };

  app.post("/api/import/current-accounts", upload.single("file"), async (req, res) => {
    try {
      if (!req.file) return res.status(400).json({ success: false, message: "Dosya yüklenmedi." });

      const rows = parseExcelBuffer(req.file.buffer);
      const errors = [];
      const validRows = [];

      const lastAccount = await dbGet(`SELECT id FROM current_accounts ORDER BY id DESC LIMIT 1`);
      let nextNo = (lastAccount?.id || 0) + 1;

      rows.forEach((raw, idx) => {
        const rowNum = idx + 2;
        const r = normalizeRow(raw);
        const rowErrors = [];

        const companyName = getField(r, ["firma adı", "firma adi", "cari", "company name"]);
        const email = getField(r, ["e-posta", "eposta", "email", "e mail"]);
        const riskLimit = toNumberOrNull(getField(r, ["risk limiti", "risk limit", "risk"]));

        if (!companyName) rowErrors.push("Firma adı zorunludur.");
        if (email && !String(email).includes("@")) rowErrors.push("Geçersiz e-posta formatı.");
        if (riskLimit === undefined) rowErrors.push("Risk limiti sayısal olmalıdır.");

        if (rowErrors.length) {
          errors.push({ row: rowNum, errors: rowErrors, data: raw });
          return;
        }

        validRows.push({
          accountCode: "CAR" + String(nextNo++).padStart(5, "0"),
          companyName,
          contactPerson: getField(r, ["yetkili kişi", "yetkili", "yetkili kisi", "contact person"]),
          phone: getField(r, ["telefon", "phone"]),
          email,
          taxNo: getField(r, ["vergi no", "vergi numarası", "tax no"]),
          taxOffice: getField(r, ["vergi dairesi", "tax office"]),
          address: getField(r, ["adres", "address"]),
          riskLimit: riskLimit || 0,
          accountType: ACCOUNT_TYPE_MAP[String(getField(r, ["hesap tipi", "account type"])).trim().toLowerCase()] || "customer"
        });
      });

      for (const a of validRows) {
        await dbRun(
          `INSERT INTO current_accounts
           (account_code, company_name, contact_person, phone, email, tax_no, tax_office, address, risk_limit, account_type, status)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active')`,
          [a.accountCode, a.companyName, a.contactPerson, a.phone, a.email, a.taxNo, a.taxOffice, a.address, a.riskLimit, a.accountType]
        );
      }

      res.json({
        success: true,
        totalRows: rows.length,
        insertedCount: validRows.length,
        errorCount: errors.length,
        errors,
        errorReportBase64: buildErrorReportBase64(errors)
      });
    } catch (err) {
      console.error("Cari hesap içe aktarma hatası:", err.message);
      res.status(500).json({ success: false, message: "İçe aktarma başarısız: " + err.message });
    }
  });
};
