module.exports = function (app, ctx = {}) {
  const db = ctx.db;

  function all(sql, params = []) {
    return new Promise((resolve, reject) => {
      if (db.all) {
        db.all(sql, params, (err, rows) => err ? reject(err) : resolve(rows || []));
      } else {
        try {
          resolve(db.prepare(sql).all(params));
        } catch (err) {
          reject(err);
        }
      }
    });
  }

  async function safeSearch(sql, params = []) {
    try {
      return await all(sql, params);
    } catch {
      return [];
    }
  }

  app.get("/api/universal-search", async (req, res) => {
    try {
      const q = String(req.query.q || "").trim();

      if (!q || q.length < 2) {
        return res.json({ success: true, data: [] });
      }

      const like = `%${q}%`;
      const results = [];

      const customers = await safeSearch(`
        SELECT 
          id,
          company_name AS title,
          customer_code AS subtitle,
          phone AS extra
        FROM customers
        WHERE company_name LIKE ? OR customer_code LIKE ? OR authorized_person LIKE ? OR phone LIKE ?
        LIMIT 10
      `, [like, like, like, like]);

      customers.forEach(x => results.push({
        type: "Müşteri",
        icon: "fa-users",
        title: x.title,
        subtitle: x.subtitle || "Müşteri",
        extra: x.extra || "",
        url: `musteriler.html?id=${x.id}`
      }));

      const stocks = await safeSearch(`
        SELECT 
          id,
          stock_code AS title,
          part_name AS subtitle,
          quantity AS extra
        FROM stocks
        WHERE stock_code LIKE ? OR part_name LIKE ? OR category LIKE ?
        LIMIT 10
      `, [like, like, like]);

      stocks.forEach(x => results.push({
        type: "Stok",
        icon: "fa-boxes-stacked",
        title: x.title,
        subtitle: x.subtitle || "Stok Kartı",
        extra: `Miktar: ${x.extra ?? 0}`,
        url: `stokyonetimi.html?id=${x.id}`
      }));

      const workOrders = await safeSearch(`
        SELECT 
          id,
          work_order_no AS title,
          part_name AS subtitle,
          status AS extra
        FROM work_orders
        WHERE work_order_no LIKE ? OR part_name LIKE ? OR title LIKE ? OR status LIKE ?
        LIMIT 10
      `, [like, like, like, like]);

      workOrders.forEach(x => results.push({
        type: "İş Emri",
        icon: "fa-industry",
        title: x.title,
        subtitle: x.subtitle || "İş Emri",
        extra: x.extra || "",
        url: `isemirleri.html?id=${x.id}`
      }));

      const offers = await safeSearch(`
        SELECT 
          o.id,
          o.offer_no AS title,
          COALESCE(o.title, c.company_name) AS subtitle,
          o.status AS extra
        FROM offers o
        LEFT JOIN customers c ON c.id = o.customer_id
        WHERE o.offer_no LIKE ? OR o.title LIKE ? OR c.company_name LIKE ? OR o.status LIKE ?
        LIMIT 10
      `, [like, like, like, like]);

      offers.forEach(x => results.push({
        type: "Teklif",
        icon: "fa-file-signature",
        title: x.title,
        subtitle: x.subtitle || "Teklif",
        extra: x.extra || "",
        url: `teklifler.html?id=${x.id}`
      }));

      const purchaseRequests = await safeSearch(`
        SELECT 
          id,
          request_no AS title,
          material AS subtitle,
          urgency AS extra
        FROM purchase_requests
        WHERE request_no LIKE ? OR requester LIKE ? OR material LIKE ? OR urgency LIKE ?
        LIMIT 10
      `, [like, like, like, like]);

      purchaseRequests.forEach(x => results.push({
        type: "Satınalma",
        icon: "fa-cart-shopping",
        title: x.title,
        subtitle: x.subtitle || "Satınalma Talebi",
        extra: x.extra || "",
        url: `satinalma.html?id=${x.id}`
      }));

      const invoices = await safeSearch(`
        SELECT 
          id,
          invoice_no AS title,
          customer_name AS subtitle,
          status AS extra
        FROM invoices
        WHERE invoice_no LIKE ? OR customer_name LIKE ? OR status LIKE ?
        LIMIT 10
      `, [like, like, like]);

      invoices.forEach(x => results.push({
        type: "Fatura",
        icon: "fa-file-invoice",
        title: x.title,
        subtitle: x.subtitle || "Fatura",
        extra: x.extra || "",
        url: `faturalar.html?id=${x.id}`
      }));

      res.json({
        success: true,
        count: results.length,
        data: results.slice(0, 40)
      });
    } catch (err) {
      res.status(500).json({
        success: false,
        message: "Universal Search hatası",
        error: err.message
      });
    }
  });

  console.log("✅ Universal Search aktif: /api/universal-search?q=");
};