// SATIŞ SİPARİŞ DETAY
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
// SATIŞ SİPARİŞ DETAY
// ===============================
app.get("/api/sales-orders/:id", (req, res) => {
  const { id } = req.params;

  db.get(
    `
    SELECT
      so.*,
      c.company_name AS customer_name,
      o.offer_no
    FROM sales_orders so
    LEFT JOIN customers c ON c.id = so.customer_id
    LEFT JOIN offers o ON o.id = so.offer_id
    WHERE so.id = ?
    `,
    [id],
    (err, order) => {
      if (err) {
        return res.status(500).json({ success: false, message: err.message });
      }

      if (!order) {
        return res.status(404).json({ success: false, message: "Sipariş bulunamadı." });
      }

      db.all(
        `SELECT * FROM sales_order_lines WHERE sales_order_id = ? ORDER BY id ASC`,
        [id],
        (lineErr, lines) => {
          if (lineErr) {
            return res.status(500).json({ success: false, message: lineErr.message });
          }

          res.json({ success: true, order, lines });
        }
      );
    }
  );
});

};
