// SATIŞ SİPARİŞİ OLUŞTUR
module.exports = function register(app, ctx) {
  var db = ctx.db;
  var dbGet = ctx.dbGet;
  var dbAll = ctx.dbAll;
  var dbRun = ctx.dbRun;
  var path = ctx.path;
  var rootDir = ctx.rootDir;
  var onlySuperAdmin = ctx.onlySuperAdmin;
  var addActivityLog = ctx.addActivityLog;
  var sendNewOrderMail = ctx.sendNewOrderMail;

// ===============================
// SATIŞ SİPARİŞİ OLUŞTUR
// ===============================
app.post("/api/sales-orders", (req, res) => {
  const {
    customer_id,
    offer_id,
    order_date,
    delivery_date,
    status,
    note,
    created_by,
    lines,
    notify_user_ids
  } = req.body;

  if (!customer_id || !order_date || !delivery_date) {
    return res.status(400).json({
      success: false,
      message: "Müşteri, sipariş tarihi ve termin tarihi zorunludur."
    });
  }

  const orderNo = "SS-" + Date.now();
  const orderLines = Array.isArray(lines) ? lines : [];

  const totalAmount = orderLines.reduce((sum, line) => {
    const qty = Number(line.quantity || 0);
    const price = Number(line.unit_price || 0);
    return sum + qty * price;
  }, 0);

  db.serialize(() => {
    db.run("BEGIN TRANSACTION");

    db.run(
      `
      INSERT INTO sales_orders (
        order_no,
        customer_id,
        offer_id,
        order_date,
        delivery_date,
        status,
        total_amount,
        note,
        created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        orderNo,
        customer_id,
        offer_id || null,
        order_date,
        delivery_date,
        status || "draft",
        totalAmount,
        note || "",
        created_by || "Sistem"
      ],
      function (err) {
        if (err) {
          db.run("ROLLBACK");
          console.error("Satış siparişi kayıt hatası:", err);
          return res.status(500).json({ success: false, message: err.message });
        }

        const salesOrderId = this.lastID;

        if (!orderLines.length) {
          db.run("COMMIT");

          notifySelectedUsers({
            db,
            sendNewOrderMail,
            notifyUserIds: notify_user_ids,
            customerId: customer_id,
            order: {
              orderNo,
              orderDate: order_date,
              deliveryDate: delivery_date,
              totalAmount,
              note,
              createdBy: created_by || "Sistem",
              lines: []
            }
          });

          return res.json({
            success: true,
            message: "Satış siparişi oluşturuldu.",
            orderId: salesOrderId,
            orderNo
          });
        }

        const stmt = db.prepare(`
          INSERT INTO sales_order_lines (
            sales_order_id,
            part_name,
            description,
            quantity,
            unit,
            unit_price,
            total_price
          ) VALUES (?, ?, ?, ?, ?, ?, ?)
        `);

        for (const line of orderLines) {
          const qty = Number(line.quantity || 0);
          const price = Number(line.unit_price || 0);
          const total = qty * price;

          stmt.run([
            salesOrderId,
            line.part_name || "",
            line.description || "",
            qty,
            line.unit || "Adet",
            price,
            total
          ]);
        }

        stmt.finalize((finalErr) => {
          if (finalErr) {
            db.run("ROLLBACK");
            return res.status(500).json({ success: false, message: finalErr.message });
          }

          db.run("COMMIT");

          notifySelectedUsers({
            db,
            sendNewOrderMail,
            notifyUserIds: notify_user_ids,
            customerId: customer_id,
            order: {
              orderNo,
              orderDate: order_date,
              deliveryDate: delivery_date,
              totalAmount,
              note,
              createdBy: created_by || "Sistem",
              lines: orderLines.map((l) => ({
                part_name: l.part_name,
                description: l.description,
                quantity: l.quantity,
                unit: l.unit || "Adet",
                unit_price: l.unit_price,
                total_price: Number(l.quantity || 0) * Number(l.unit_price || 0)
              }))
            }
          });

          res.json({
            success: true,
            message: "Satış siparişi oluşturuldu.",
            orderId: salesOrderId,
            orderNo
          });
        });
      }
    );
  });
});

};

// ===============================
// Seçilen kullanıcılara + admin/muhasebe/satın alma rolündeki kullanıcılara
// sipariş bildirim maili gönder
// ===============================
const { getNotifyRecipients } = require("../utils/roleNotify");

function notifySelectedUsers({ db, sendNewOrderMail, notifyUserIds, customerId, order }) {
  if (!sendNewOrderMail) return; // mailer ctx'e eklenmemişse sessizce geç

  getNotifyRecipients(db, notifyUserIds, (err, recipients) => {
    if (err) {
      console.error("Bildirim için kullanıcılar alınamadı:", err.message);
      return;
    }

    if (recipients.length === 0) return;

    db.get(
      `SELECT company_name FROM customers WHERE id = ?`,
      [customerId],
      (custErr, customerRow) => {
        if (custErr) {
          console.error("Müşteri bilgisi alınamadı:", custErr.message);
        }

        sendNewOrderMail(
          { ...order, customerName: customerRow ? customerRow.company_name : "-" },
          recipients
        ).then((result) => {
          if (result.success) {
            console.log(
              `[mailer] Sipariş bildirim maili gönderildi -> ${recipients.map(u => u.email).join(", ")}`
            );
          } else {
            console.warn("Sipariş bildirim maili gönderilemedi:", result.message);
          }
        });
      }
    );
  });
}
