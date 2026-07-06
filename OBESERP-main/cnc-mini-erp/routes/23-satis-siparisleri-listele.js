// SATIŞ SİPARİŞLERİ LİSTELE
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
// SATIŞ SİPARİŞLERİ LİSTELE
// ===============================
app.get("/api/sales-orders", (req, res) => {
  const sql = `
    SELECT
      so.*,
      c.company_name AS customer_name,
      o.offer_no
    FROM sales_orders so
    LEFT JOIN customers c ON c.id = so.customer_id
    LEFT JOIN offers o ON o.id = so.offer_id
    ORDER BY so.id DESC
  `;

  db.all(sql, [], (err, orders) => {
    if (err) {
      console.error("Satış siparişleri listeleme hatası:", err);
      return res.status(500).json({ success: false, message: err.message });
    }

    res.json({ success: true, orders });
  });
});

};
