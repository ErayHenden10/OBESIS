// const express = require("express");
// const cors = require("cors");
// const path = require("path");
// const sqlite3 = require("sqlite3").verbose();
// require("dotenv").config();

// const app = express();
// const PORT = process.env.PORT || 3000;

// const dbPath = "C:\\sqlitedbs\\erpcnc.db";

// const db = new sqlite3.Database(dbPath, (err) => {
//   if (err) {
//     console.error("SQLite bağlantı hatası:", err.message);
//   } else {
//     console.log("SQLite bağlantısı başarılı:", dbPath);
//   }
// });

// app.use(cors());
// app.use(express.json());
// app.use(express.urlencoded({ extended: true }));

// app.use(express.static(path.join(__dirname, "../public")));

// app.get("/", (req, res) => {
//   res.redirect("/giris.html");
// });

// function dbGet(sql, params = []) {
//   return new Promise((resolve, reject) => {
//     db.get(sql, params, (err, row) => {
//       if (err) reject(err);
//       else resolve(row);
//     });
//   });
// }

// function dbAll(sql, params = []) {
//   return new Promise((resolve, reject) => {
//     db.all(sql, params, (err, rows) => {
//       if (err) reject(err);
//       else resolve(rows);
//     });
//   });
// }

// function dbAll(sql, params = []) {
//   return new Promise((resolve, reject) => {
//     db.all(sql, params, (err, rows) => {
//       if (err) reject(err);
//       else resolve(rows);
//     });
//   });
// }

// // ======================
// // YETKİ KONTROL
// // ======================

// app.get("/api/auth/can-access", (req, res) => {
//   const { roleKey, pageUrl } = req.query;

//   if (!roleKey || !pageUrl) {
//     return res.status(400).json({
//       success: false,
//       canAccess: false
//     });
//   }

//   if (roleKey === "superadmin") {
//     return res.json({
//       success: true,
//       canAccess: true
//     });
//   }

//   const cleanPageUrl = pageUrl.startsWith("/")
//     ? pageUrl
//     : "/" + pageUrl;

//   db.get(`
//     SELECT rp.id
//     FROM roles r
//     INNER JOIN role_permissions rp
//       ON rp.role_id = r.id
//     INNER JOIN pages p
//       ON p.id = rp.page_id
//     WHERE r.role_key = ?
//       AND p.page_url = ?
//       AND rp.can_access = 1
//   `,
//   [roleKey, cleanPageUrl],
//   (err, row) => {
//     if (err) {
//       return res.status(500).json({
//         success: false,
//         canAccess: false,
//         message: err.message
//       });
//     }

//     res.json({
//       success: true,
//       canAccess: !!row
//     });
//   });
// });
// function onlySuperAdmin(req, res, next) {
//   const role = req.headers["x-user-role"];

//   if (role !== "superadmin") {
//     return res.status(403).json({
//       success: false,
//       message: "Bu ekrana sadece Süper Admin erişebilir."
//     });
//   }

//   next();
// }

// app.get("/api/admin/roles", onlySuperAdmin, (req, res) => {
//   db.all(`SELECT * FROM roles ORDER BY id ASC`, [], (err, rows) => {
//     if (err) return res.status(500).json({ success:false, message:err.message });
//     res.json({ success:true, roles: rows });
//   });
// });

// app.post("/api/admin/roles", onlySuperAdmin, (req, res) => {
//   const { roleKey, roleName } = req.body;

//   if (!roleKey || !roleName) {
//     return res.status(400).json({
//       success:false,
//       message:"Rol kodu ve rol adı zorunludur."
//     });
//   }

//   db.run(
//     `INSERT INTO roles (role_key, role_name) VALUES (?, ?)`,
//     [roleKey, roleName],
//     function(err) {
//       if (err) return res.status(500).json({ success:false, message:err.message });
//       res.json({ success:true, id:this.lastID });
//     }
//   );
// });

// app.get("/api/admin/pages", onlySuperAdmin, (req, res) => {
//   db.all(`SELECT * FROM pages ORDER BY module_group, page_name`, [], (err, rows) => {
//     if (err) return res.status(500).json({ success:false, message:err.message });
//     res.json({ success:true, pages: rows });
//   });
// });

// app.get("/api/admin/roles/:roleId/permissions", onlySuperAdmin, (req, res) => {
//   db.all(`
//     SELECT
//       p.id AS pageId,
//       p.page_key AS pageKey,
//       p.page_name AS pageName,
//       p.page_url AS pageUrl,
//       p.module_group AS moduleGroup,
//       COALESCE(rp.can_access, 0) AS canAccess
//     FROM pages p
//     LEFT JOIN role_permissions rp 
//       ON rp.page_id = p.id 
//       AND rp.role_id = ?
//     ORDER BY p.module_group, p.page_name
//   `, [req.params.roleId], (err, rows) => {
//     if (err) return res.status(500).json({ success:false, message:err.message });
//     res.json({ success:true, permissions: rows });
//   });
// });

// app.post("/api/admin/roles/:roleId/permissions", onlySuperAdmin, (req, res) => {
//   const { pageIds } = req.body;
//   const roleId = req.params.roleId;

//   db.serialize(() => {
//     db.run(`DELETE FROM role_permissions WHERE role_id = ?`, [roleId]);

//     const stmt = db.prepare(`
//       INSERT INTO role_permissions (role_id, page_id, can_access)
//       VALUES (?, ?, 1)
//     `);

//     (pageIds || []).forEach(pageId => {
//       stmt.run([roleId, pageId]);
//     });

//     stmt.finalize(err => {
//       if (err) return res.status(500).json({ success:false, message:err.message });

//       res.json({
//         success:true,
//         message:"Rol yetkileri güncellendi."
//       });
//     });
//   });
// });


// // BURADAN SONRA APILER BAŞLASIN

// app.get("/api/dashboard", async (req, res) => {
//   try {
//     const activeCustomers = await dbGet(`
//       SELECT COUNT(*) AS count
//       FROM customers
//       WHERE status = 'active'
//     `);

//     const openOffers = await dbGet(`
//       SELECT COUNT(*) AS count
//       FROM offers
//       WHERE status IN ('draft', 'sent', 'open')
//     `);

//     const activeWorkOrders = await dbGet(`
//       SELECT COUNT(*) AS count
//       FROM work_orders
//       WHERE status IN ('waiting', 'progress', 'production', 'active')
//     `);

//     const pendingPayments = await dbGet(`
//       SELECT COALESCE(SUM(amount), 0) AS total
//       FROM payments
//       WHERE status = 'pending'
//     `);

//     const lastWorkOrders = await dbAll(`
//       SELECT
//         wo.work_order_no AS no,
//         COALESCE(c.company_name, '-') AS customer,
//         wo.part_name AS part,
//         wo.delivery_date AS deliveryDate,
//         wo.status
//       FROM work_orders wo
//       LEFT JOIN customers c ON c.id = wo.customer_id
//       ORDER BY wo.id DESC
//       LIMIT 5
//     `);

//     const defaultUser = {
//       fullName: "Admin Kullanıcı",
//       role: "Admin",
//       avatar: "A"
//     };

//     res.json({
//       user: defaultUser,
//       notifications: 0,
//       stats: {
//         customers: activeCustomers?.count || 0,
//         customerChange: 0,

//         offers: openOffers?.count || 0,
//         offerChange: 0,

//         workOrders: activeWorkOrders?.count || 0,
//         workOrderChange: 0,

//         payments: pendingPayments?.total || 0,
//         paymentChange: 0
//       },
//       workOrders: (lastWorkOrders || []).map(order => ({
//         no: order.no,
//         customer: order.customer,
//         part: order.part,
//         deliveryDate: order.deliveryDate,
//         status: order.status,
//         statusText:
//           order.status === "completed" ? "Tamamlandı" :
//           order.status === "progress" ? "Üretimde" :
//           order.status === "production" ? "Üretimde" :
//           order.status === "cancelled" ? "İptal" :
//           "Beklemede"
//       }))
//     });

//   } catch (err) {
//     console.error("Dashboard veri hatası:", err.message);

//     res.status(500).json({
//       success: false,
//       message: err.message
//     });
//   }
// });

// // ===============================
// // KULLANICILAR API
// // ===============================

// db.run(`
// CREATE TABLE IF NOT EXISTS users (
//   id INTEGER PRIMARY KEY AUTOINCREMENT,
//   username TEXT NOT NULL UNIQUE,
//   password TEXT NOT NULL,
//   full_name TEXT NOT NULL,
//   role TEXT DEFAULT 'user',
//   active INTEGER DEFAULT 1,
//   email TEXT,
//   created_at DATETIME DEFAULT CURRENT_TIMESTAMP
// )
// `);

// app.get("/api/users", (req, res) => {
//   db.all(`
//     SELECT
//       id,
//       username,
//       full_name AS fullName,
//       role,
//       active,
//       email
//     FROM users
//     ORDER BY id DESC
//   `, [], (err, rows) => {
//     if (err) {
//       console.error("Kullanıcı listeleme hatası:", err.message);

//       return res.status(500).json({
//         success: false,
//         message: err.message,
//         users: []
//       });
//     }

//     res.json({
//       success: true,
//       users: rows || []
//     });
//   });
// });
// app.post("/api/users", (req, res) => {
//   const { username, password, fullName, role, active, email } = req.body;

//   if (!username || !password || !fullName) {
//     return res.status(400).json({
//       success: false,
//       message: "Ad soyad, kullanıcı adı ve şifre zorunludur."
//     });
//   }

//   db.run(`
//     INSERT INTO users
//     (
//       username,
//       password,
//       full_name,
//       role,
//       active,
//       email
//     )
//     VALUES (?, ?, ?, ?, ?, ?)
//   `,
//   [
//     username,
//     password,
//     fullName,
//     role || "Kullanıcı",
//     active ?? 1,
//     email || ""
//   ],
//   function(err) {
//     if (err) {
//       console.error("Kullanıcı ekleme hatası:", err.message);

//       return res.status(500).json({
//         success: false,
//         message: err.message
//       });
//     }

//     res.json({
//       success: true,
//       id: this.lastID
//     });
//   });
// });
// app.get("/api/users/:id", (req, res) => {
//   db.get(`
//     SELECT
//       id,
//       username,
//       password,
//       full_name AS fullName,
//       role,
//       active,
//       email
//     FROM users
//     WHERE id = ?
//   `, [req.params.id], (err, row) => {
//     if (err) {
//       console.error("Kullanıcı detay hatası:", err.message);

//       return res.status(500).json({
//         success: false,
//         message: err.message
//       });
//     }

//     res.json({
//       success: true,
//       user: row
//     });
//   });
// });

// // users tablosunda email yoksa eklemek için
// db.run(`ALTER TABLE users ADD COLUMN email TEXT`, (err) => {
//   if (err && !err.message.includes("duplicate column name")) {
//     console.log("email kolonu ekleme uyarısı:", err.message);
//   }
// });

// // users tablosunda active yoksa eklemek için
// db.run(`ALTER TABLE users ADD COLUMN active INTEGER DEFAULT 1`, (err) => {
//   if (err && !err.message.includes("duplicate column name")) {
//     console.log("active kolonu ekleme uyarısı:", err.message);
//   }
// });

// function addActivityLog(req, data = {}) {
//   const userId = req.headers["x-user-id"] || null;
//   const userName = req.headers["x-user-name"] || "Bilinmeyen Kullanıcı";
//   const roleKey = req.headers["x-user-role"] || "";

//   db.run(`
//     INSERT INTO activity_logs
//     (
//       user_id,
//       user_name,
//       role_key,
//       module_name,
//       action_type,
//       description,
//       record_id,
//       ip_address
//     )
//     VALUES (?, ?, ?, ?, ?, ?, ?, ?)
//   `,
//   [
//     userId,
//     userName,
//     roleKey,
//     data.moduleName || "",
//     data.actionType || "",
//     data.description || "",
//     data.recordId || null,
//     req.ip || ""
//   ]);
// }

// app.get("/api/activity-logs", onlySuperAdmin, (req, res) => {
//   db.all(`
//     SELECT *
//     FROM activity_logs
//     ORDER BY id DESC
//     LIMIT 300
//   `, [], (err, rows) => {
//     if (err) {
//       return res.status(500).json({
//         success: false,
//         message: err.message,
//         logs: []
//       });
//     }

//     res.json({
//       success: true,
//       logs: rows
//     });
//   });
// });

// // ======================================
// // AKTİVİTE LOGLARI
// // ======================================

// app.get("/api/activity-logs", (req, res) => {
//   const role = req.headers["x-user-role"];

//   if (role !== "superadmin") {
//     return res.status(403).json({
//       success: false,
//       message: "Logları sadece Süper Admin görüntüleyebilir.",
//       logs: []
//     });
//   }

//   db.all(`
//     SELECT
//       id,
//       user_id,
//       user_name,
//       role_key,
//       module_name,
//       action_type,
//       description,
//       record_id,
//       ip_address,
//       created_at
//     FROM activity_logs
//     ORDER BY id DESC
//     LIMIT 300
//   `, [], (err, rows) => {
//     if (err) {
//       console.error("Log listeleme hatası:", err.message);

//       return res.status(500).json({
//         success: false,
//         message: err.message,
//         logs: []
//       });
//     }

//     res.json({
//       success: true,
//       logs: rows || []
//     });
//   });
// });


// // ===============================
// // STOK HAREKETLERİ
// // ===============================

// app.get("/api/stock-movements", (req, res) => {
//   db.all(`
//     SELECT 
//       sm.*,
//       s.stock_code,
//       s.part_name,
//       s.unit
//     FROM stock_movements sm
//     LEFT JOIN stocks s ON s.id = sm.stock_id
//     ORDER BY sm.id DESC
//   `, [], (err, rows) => {
//     if (err) {
//       return res.status(500).json({
//         success: false,
//         message: err.message,
//         movements: []
//       });
//     }

//     res.json({
//       success: true,
//       movements: rows || []
//     });
//   });
// });

// app.post("/api/stock-movements", (req, res) => {
//   const {
//     stockId,
//     movementType,
//     quantity,
//     documentNo,
//     description
//   } = req.body;

//   if (!stockId || !movementType || !quantity) {
//     return res.status(400).json({
//       success: false,
//       message: "Stok, hareket tipi ve miktar zorunludur."
//     });
//   }

//   db.get(
//     `SELECT id, quantity, part_name FROM stocks WHERE id = ?`,
//     [stockId],
//     (err, stock) => {
//       if (err) {
//         return res.status(500).json({
//           success: false,
//           message: err.message
//         });
//       }

//       if (!stock) {
//         return res.status(404).json({
//           success: false,
//           message: "Stok bulunamadı."
//         });
//       }

//       const beforeQty = Number(stock.quantity || 0);
//       const qty = Number(quantity || 0);

//       let afterQty = beforeQty;

//       if (movementType === "in") {
//         afterQty = beforeQty + qty;
//       } else if (movementType === "out") {
//         afterQty = beforeQty - qty;
//       } else if (movementType === "count") {
//         afterQty = qty;
//       } else {
//         return res.status(400).json({
//           success: false,
//           message: "Geçersiz hareket tipi."
//         });
//       }

//       if (afterQty < 0) {
//         return res.status(400).json({
//           success: false,
//           message: "Stok miktarı eksiye düşemez."
//         });
//       }

//       db.run(
//         `
//         INSERT INTO stock_movements
//         (
//           stock_id,
//           movement_type,
//           quantity,
//           before_qty,
//           after_qty,
//           document_no,
//           description,
//           created_by
//         )
//         VALUES (?, ?, ?, ?, ?, ?, ?, ?)
//         `,
//         [
//           stockId,
//           movementType,
//           qty,
//           beforeQty,
//           afterQty,
//           documentNo || "",
//           description || "",
//           req.headers["x-user-name"] || "Bilinmeyen Kullanıcı"
//         ],
//         function (err) {
//           if (err) {
//             return res.status(500).json({
//               success: false,
//               message: err.message
//             });
//           }

//           db.run(
//             `UPDATE stocks SET quantity = ? WHERE id = ?`,
//             [afterQty, stockId],
//             updateErr => {
//               if (updateErr) {
//                 return res.status(500).json({
//                   success: false,
//                   message: updateErr.message
//                 });
//               }

//               if (typeof addActivityLog === "function") {
//                 addActivityLog(req, {
//                   moduleName: "Stok Hareketleri",
//                   actionType: "CREATE",
//                   description: `${stock.part_name} için stok hareketi oluşturuldu.`,
//                   recordId: this.lastID
//                 });
//               }

//               res.json({
//                 success: true,
//                 message: "Stok hareketi kaydedildi.",
//                 id: this.lastID,
//                 beforeQty,
//                 afterQty
//               });
//             }
//           );
//         }
//       );
//     }
//   );
// });

// app.get("/api/notifications", (req, res) => {
//   const userId = req.headers["x-user-id"];
//   const roleKey = req.headers["x-user-role"];

//   db.all(`
//     SELECT *
//     FROM notifications
//     WHERE 
//       (user_id = ? OR user_id IS NULL)
//       AND (role_key = ? OR role_key IS NULL OR role_key = '')
//     ORDER BY id DESC
//     LIMIT 50
//   `, [userId, roleKey], (err, rows) => {
//     if (err) {
//       return res.status(500).json({
//         success: false,
//         message: err.message,
//         notifications: []
//       });
//     }

//     const unreadCount = rows.filter(x => Number(x.is_read) === 0).length;

//     res.json({
//       success: true,
//       unreadCount,
//       notifications: rows || []
//     });
//   });
// });

// app.put("/api/notifications/:id/read", (req, res) => {
//   db.run(`
//     UPDATE notifications
//     SET is_read = 1
//     WHERE id = ?
//   `, [req.params.id], function(err) {
//     if (err) {
//       return res.status(500).json({
//         success: false,
//         message: err.message
//       });
//     }

//     res.json({ success: true });
//   });
// });

// app.put("/api/notifications/read-all", (req, res) => {
//   const userId = req.headers["x-user-id"];
//   const roleKey = req.headers["x-user-role"];

//   db.run(`
//     UPDATE notifications
//     SET is_read = 1
//     WHERE 
//       (user_id = ? OR user_id IS NULL)
//       AND (role_key = ? OR role_key IS NULL OR role_key = '')
//   `, [userId, roleKey], function(err) {
//     if (err) {
//       return res.status(500).json({
//         success: false,
//         message: err.message
//       });
//     }

//     res.json({ success: true });
//   });
// });



// // Kullanıcı profil güncelleme
// app.put("/api/users/:id/profile", (req, res) => {
//   const { fullName, username, email } = req.body;
//   const { id } = req.params;

//   if (!fullName || !username) {
//     return res.status(400).json({
//       success: false,
//       message: "Ad soyad ve kullanıcı adı zorunludur."
//     });
//   }

//   db.run(`
//     UPDATE users
//     SET
//       full_name = ?,
//       username = ?,
//       email = ?
//     WHERE id = ?
//   `,
//   [
//     fullName,
//     username,
//     email || "",
//     id
//   ],
//   function(err) {
//     if (err) {
//       if (err.message.includes("UNIQUE constraint failed")) {
//         return res.status(400).json({
//           success: false,
//           message: "Bu kullanıcı adı zaten kullanılıyor."
//         });
//       }

//       return res.status(500).json({
//         success: false,
//         message: err.message
//       });
//     }

//     res.json({
//       success: true,
//       message: "Profil bilgileri güncellendi."
//     });
//   });
// });

// // Şifre değiştirme
// app.put("/api/users/:id/password", (req, res) => {
//   const { currentPassword, newPassword } = req.body;
//   const { id } = req.params;

//   if (!currentPassword || !newPassword) {
//     return res.status(400).json({
//       success: false,
//       message: "Mevcut şifre ve yeni şifre zorunludur."
//     });
//   }

//   if (newPassword.length < 6) {
//     return res.status(400).json({
//       success: false,
//       message: "Yeni şifre en az 6 karakter olmalıdır."
//     });
//   }

//   db.get(`
//     SELECT id, password
//     FROM users
//     WHERE id = ?
//   `, [id], (err, user) => {
//     if (err) {
//       return res.status(500).json({
//         success: false,
//         message: err.message
//       });
//     }

//     if (!user) {
//       return res.status(404).json({
//         success: false,
//         message: "Kullanıcı bulunamadı."
//       });
//     }

//     if (user.password !== currentPassword) {
//       return res.status(400).json({
//         success: false,
//         message: "Mevcut şifre hatalı."
//       });
//     }

//     db.run(`
//       UPDATE users
//       SET password = ?
//       WHERE id = ?
//     `, [newPassword, id], function(err) {
//       if (err) {
//         return res.status(500).json({
//           success: false,
//           message: err.message
//         });
//       }

//       res.json({
//         success: true,
//         message: "Şifre başarıyla güncellendi."
//       });
//     });
//   });
// });

// app.get("/api/employees", (req, res) => {
//   db.all("SELECT * FROM employees ORDER BY id DESC", [], (err, rows) => {
//     if (err) {
//       return res.json({ success: false, message: err.message, employees: [] });
//     }

//     res.json({
//       success: true,
//       employees: rows.map(e => ({
//         id: e.id,
//         fullName: e.full_name,
//         identityNo: e.identity_no,
//         phone: e.phone,
//         department: e.department,
//         position: e.position,
//         hireDate: e.hire_date,
//         salary: e.salary,
//         status: e.status
//       }))
//     });
//   });
// });
// db.run(`
//   CREATE TABLE IF NOT EXISTS employees (
//     id INTEGER PRIMARY KEY AUTOINCREMENT,
//     full_name TEXT NOT NULL,
//     identity_no TEXT,
//     phone TEXT,
//     department TEXT,
//     position TEXT,
//     hire_date TEXT,
//     salary REAL DEFAULT 0,
//     status TEXT DEFAULT 'active',
//     created_at TEXT DEFAULT CURRENT_TIMESTAMP
//   )
// `);
// app.post("/api/employees", (req, res) => {
//   const {
//     fullName,
//     identityNo,
//     phone,
//     department,
//     position,
//     hireDate,
//     salary
//   } = req.body;

//   if (!fullName) {
//     return res.json({ success: false, message: "Ad soyad zorunludur." });
//   }

//   const sql = `
//     INSERT INTO employees
//     (full_name, identity_no, phone, department, position, hire_date, salary, status)
//     VALUES (?, ?, ?, ?, ?, ?, ?, 'active')
//   `;

//   db.run(sql, [
//     fullName,
//     identityNo,
//     phone,
//     department,
//     position,
//     hireDate,
//     salary || 0
//   ], function (err) {
//     if (err) {
//       return res.json({ success: false, message: err.message });
//     }

//     res.json({ success: true, id: this.lastID });
//   });
// });

// app.put("/api/employees/:id", (req, res) => {
//   const {
//     fullName,
//     identityNo,
//     phone,
//     department,
//     position,
//     hireDate,
//     salary
//   } = req.body;

//   const sql = `
//     UPDATE employees SET
//       full_name = ?,
//       identity_no = ?,
//       phone = ?,
//       department = ?,
//       position = ?,
//       hire_date = ?,
//       salary = ?
//     WHERE id = ?
//   `;

//   db.run(sql, [
//     fullName,
//     identityNo,
//     phone,
//     department,
//     position,
//     hireDate,
//     salary || 0,
//     req.params.id
//   ], function (err) {
//     if (err) {
//       return res.json({ success: false, message: err.message });
//     }

//     res.json({ success: true });
//   });
// });

// app.put("/api/employees/:id/status", (req, res) => {
//   const { status } = req.body;

//   db.run(
//     "UPDATE employees SET status = ? WHERE id = ?",
//     [status, req.params.id],
//     function (err) {
//       if (err) {
//         return res.json({ success: false, message: err.message });
//       }

//       res.json({ success: true });
//     }
//   );
// });

// app.get("/api/employee-leaves", (req, res) => {
//   const sql = `
//     SELECT 
//       l.*,
//       e.full_name
//     FROM employee_leaves l
//     LEFT JOIN employees e ON e.id = l.employee_id
//     ORDER BY l.id DESC
//   `;

//   db.all(sql, [], (err, rows) => {
//     if (err) {
//       return res.status(500).json({ success: false, message: err.message, leaves: [] });
//     }

//     res.json({
//       success: true,
//       leaves: rows.map(l => ({
//         id: l.id,
//         employeeId: l.employee_id,
//         employeeName: l.full_name,
//         leaveType: l.leave_type,
//         startDate: l.start_date,
//         endDate: l.end_date,
//         totalDays: l.total_days,
//         description: l.description,
//         status: l.status
//       }))
//     });
//   });
// });

// app.post("/api/employee-leaves", (req, res) => {
//   const { employeeId, leaveType, startDate, endDate, totalDays, description, status } = req.body;

//   if (!employeeId || !leaveType || !startDate || !endDate) {
//     return res.status(400).json({ success: false, message: "Zorunlu alanlar eksik." });
//   }

//   db.run(
//     `
//     INSERT INTO employee_leaves
//     (employee_id, leave_type, start_date, end_date, total_days, description, status)
//     VALUES (?, ?, ?, ?, ?, ?, ?)
//     `,
//     [employeeId, leaveType, startDate, endDate, Number(totalDays || 0), description, status || "pending"],
//     function (err) {
//       if (err) {
//         return res.status(500).json({ success: false, message: err.message });
//       }

//       res.json({ success: true, id: this.lastID });
//     }
//   );
// });

// app.put("/api/employee-leaves/:id", (req, res) => {
//   const { employeeId, leaveType, startDate, endDate, totalDays, description, status } = req.body;

//   db.run(
//     `
//     UPDATE employee_leaves SET
//       employee_id = ?,
//       leave_type = ?,
//       start_date = ?,
//       end_date = ?,
//       total_days = ?,
//       description = ?,
//       status = ?
//     WHERE id = ?
//     `,
//     [employeeId, leaveType, startDate, endDate, Number(totalDays || 0), description, status, req.params.id],
//     function (err) {
//       if (err) {
//         return res.status(500).json({ success: false, message: err.message });
//       }

//       res.json({ success: true });
//     }
//   );
// });

// app.put("/api/employee-leaves/:id/status", (req, res) => {
//   const { status } = req.body;

//   db.run(
//     "UPDATE employee_leaves SET status = ? WHERE id = ?",
//     [status, req.params.id],
//     function (err) {
//       if (err) {
//         return res.status(500).json({ success: false, message: err.message });
//       }

//       res.json({ success: true });
//     }
//   );
// });

// app.get("/api/employee-payments", (req, res) => {
//   const sql = `
//     SELECT 
//       p.*,
//       e.full_name
//     FROM employee_payments p
//     LEFT JOIN employees e ON e.id = p.employee_id
//     ORDER BY p.id DESC
//   `;

//   db.all(sql, [], (err, rows) => {
//     if (err) {
//       return res.status(500).json({
//         success: false,
//         message: err.message,
//         payments: []
//       });
//     }

//     res.json({
//       success: true,
//       payments: rows.map(p => ({
//         id: p.id,
//         employeeId: p.employee_id,
//         employeeName: p.full_name,
//         paymentType: p.payment_type,
//         amount: p.amount,
//         paymentDate: p.payment_date,
//         description: p.description
//       }))
//     });
//   });
// });

// app.post("/api/employee-payments", (req, res) => {
//   const { employeeId, paymentType, amount, paymentDate, description } = req.body;

//   if (!employeeId || !paymentType || !amount || !paymentDate) {
//     return res.status(400).json({
//       success: false,
//       message: "Zorunlu alanlar eksik."
//     });
//   }

//   db.run(
//     `
//     INSERT INTO employee_payments
//     (employee_id, payment_type, amount, payment_date, description)
//     VALUES (?, ?, ?, ?, ?)
//     `,
//     [
//       employeeId,
//       paymentType,
//       Number(amount || 0),
//       paymentDate,
//       description
//     ],
//     function (err) {
//       if (err) {
//         return res.status(500).json({
//           success: false,
//           message: err.message
//         });
//       }

//       res.json({
//         success: true,
//         id: this.lastID
//       });
//     }
//   );
// });

// app.put("/api/employee-payments/:id", (req, res) => {
//   const { employeeId, paymentType, amount, paymentDate, description } = req.body;

//   db.run(
//     `
//     UPDATE employee_payments SET
//       employee_id = ?,
//       payment_type = ?,
//       amount = ?,
//       payment_date = ?,
//       description = ?
//     WHERE id = ?
//     `,
//     [
//       employeeId,
//       paymentType,
//       Number(amount || 0),
//       paymentDate,
//       description,
//       req.params.id
//     ],
//     function (err) {
//       if (err) {
//         return res.status(500).json({
//           success: false,
//           message: err.message
//         });
//       }

//       res.json({ success: true });
//     }
//   );
// });

// app.get("/api/employee-shifts", (req, res) => {
//   const sql = `
//     SELECT s.*, e.full_name
//     FROM employee_shifts s
//     LEFT JOIN employees e ON e.id = s.employee_id
//     ORDER BY s.id DESC
//   `;

//   db.all(sql, [], (err, rows) => {
//     if (err) {
//       return res.status(500).json({ success: false, message: err.message, shifts: [] });
//     }

//     res.json({
//       success: true,
//       shifts: rows.map(s => ({
//         id: s.id,
//         employeeId: s.employee_id,
//         employeeName: s.full_name,
//         shiftDate: s.shift_date,
//         startTime: s.start_time,
//         endTime: s.end_time,
//         overtimeHours: s.overtime_hours,
//         description: s.description
//       }))
//     });
//   });
// });

// app.post("/api/employee-shifts", (req, res) => {
//   const { employeeId, shiftDate, startTime, endTime, overtimeHours, description } = req.body;

//   if (!employeeId || !shiftDate) {
//     return res.status(400).json({ success: false, message: "Çalışan ve tarih zorunludur." });
//   }

//   db.run(
//     `
//     INSERT INTO employee_shifts
//     (employee_id, shift_date, start_time, end_time, overtime_hours, description)
//     VALUES (?, ?, ?, ?, ?, ?)
//     `,
//     [employeeId, shiftDate, startTime, endTime, Number(overtimeHours || 0), description],
//     function (err) {
//       if (err) {
//         return res.status(500).json({ success: false, message: err.message });
//       }

//       res.json({ success: true, id: this.lastID });
//     }
//   );
// });

// app.get("/api/employee-documents", (req, res) => {
//   const sql = `
//     SELECT d.*, e.full_name
//     FROM employee_documents d
//     LEFT JOIN employees e ON e.id = d.employee_id
//     ORDER BY d.id DESC
//   `;

//   db.all(sql, [], (err, rows) => {
//     if (err) {
//       return res.status(500).json({ success: false, message: err.message, documents: [] });
//     }

//     res.json({
//       success: true,
//       documents: rows.map(d => ({
//         id: d.id,
//         employeeId: d.employee_id,
//         employeeName: d.full_name,
//         documentName: d.document_name,
//         expireDate: d.expire_date,
//         description: d.description
//       }))
//     });
//   });
// });

// app.post("/api/employee-documents", (req, res) => {
//   const { employeeId, documentName, expireDate, description } = req.body;

//   if (!employeeId || !documentName) {
//     return res.status(400).json({ success: false, message: "Çalışan ve evrak adı zorunludur." });
//   }

//   db.run(
//     `
//     INSERT INTO employee_documents
//     (employee_id, document_name, expire_date, description)
//     VALUES (?, ?, ?, ?)
//     `,
//     [employeeId, documentName, expireDate, description],
//     function (err) {
//       if (err) {
//         return res.status(500).json({ success: false, message: err.message });
//       }

//       res.json({ success: true, id: this.lastID });
//     }
//   );
// });

// app.put("/api/employee-documents/:id", (req, res) => {
//   const { employeeId, documentName, expireDate, description } = req.body;

//   db.run(
//     `
//     UPDATE employee_documents SET
//       employee_id = ?,
//       document_name = ?,
//       expire_date = ?,
//       description = ?
//     WHERE id = ?
//     `,
//     [employeeId, documentName, expireDate, description, req.params.id],
//     function (err) {
//       if (err) {
//         return res.status(500).json({ success: false, message: err.message });
//       }

//       res.json({ success: true });
//     }
//   );
// });



// app.get("/api/quality-controls", (req, res) => {

//     db.all(
//         `SELECT * FROM quality_controls
//          ORDER BY id DESC`,
//         [],
//         (err, rows) => {

//             if (err) {
//                 return res.status(500).json({
//                     success: false,
//                     message: err.message,
//                     qualityControls: []
//                 });
//             }

//             res.json({
//                 success: true,
//                 qualityControls: rows.map(q => ({
//                     id: q.id,
//                     workOrderId: q.work_order_id,
//                     partNo: q.part_no,
//                     measurementResult: q.measurement_result,
//                     resultStatus: q.result_status,
//                     scrapReason: q.scrap_reason,
//                     checkedBy: q.checked_by,
//                     checkDate: q.check_date,

//                     createdBy: q.created_by,
//                     createdByName: q.created_by_name,

//                     updatedBy: q.updated_by,
//                     updatedByName: q.updated_by_name,

//                     createdAt: q.created_at,
//                     updatedAt: q.updated_at
//                 }))
//             });

//         }
//     );

// });

// app.post("/api/quality-controls", (req, res) => {

//     const {
//         workOrderId,
//         partNo,
//         measurementResult,
//         resultStatus,
//         scrapReason,
//         checkedBy,
//         checkDate,

//         createdBy,
//         createdByName
//     } = req.body;

//     if (
//         !workOrderId ||
//         !partNo ||
//         !resultStatus ||
//         !checkDate
//     ) {
//         return res.status(400).json({
//             success: false,
//             message: "Zorunlu alanlar eksik."
//         });
//     }

//     db.run(
//         `
//         INSERT INTO quality_controls
//         (
//             work_order_id,
//             part_no,
//             measurement_result,
//             result_status,
//             scrap_reason,
//             checked_by,
//             check_date,

//             created_by,
//             created_by_name,

//             updated_by,
//             updated_by_name
//         )
//         VALUES
//         (?,?,?,?,?,?,?,?,?,?,?)
//         `,
//         [
//             workOrderId,
//             partNo,
//             measurementResult,
//             resultStatus,
//             scrapReason,
//             checkedBy,
//             checkDate,

//             createdBy,
//             createdByName,

//             createdBy,
//             createdByName
//         ],
//         function (err) {

//             if (err) {
//                 return res.status(500).json({
//                     success: false,
//                     message: err.message
//                 });
//             }

//             res.json({
//                 success: true,
//                 id: this.lastID
//             });

//         }
//     );

// });

// app.put("/api/quality-controls/:id", (req, res) => {

//     const {
//         workOrderId,
//         partNo,
//         measurementResult,
//         resultStatus,
//         scrapReason,
//         checkedBy,
//         checkDate,

//         updatedBy,
//         updatedByName
//     } = req.body;

//     db.run(
//         `
//         UPDATE quality_controls
//         SET
//             work_order_id = ?,
//             part_no = ?,
//             measurement_result = ?,
//             result_status = ?,
//             scrap_reason = ?,
//             checked_by = ?,
//             check_date = ?,

//             updated_by = ?,
//             updated_by_name = ?,

//             updated_at = CURRENT_TIMESTAMP

//         WHERE id = ?
//         `,
//         [
//             workOrderId,
//             partNo,
//             measurementResult,
//             resultStatus,
//             scrapReason,
//             checkedBy,
//             checkDate,

//             updatedBy,
//             updatedByName,

//             req.params.id
//         ],
//         function (err) {

//             if (err) {
//                 return res.status(500).json({
//                     success: false,
//                     message: err.message
//                 });
//             }

//             res.json({
//                 success: true
//             });

//         }
//     );

// });

// app.delete("/api/quality-controls/:id", (req, res) => {

//     db.run(
//         `DELETE FROM quality_controls WHERE id = ?`,
//         [req.params.id],
//         function (err) {

//             if (err) {
//                 return res.status(500).json({
//                     success: false,
//                     message: err.message
//                 });
//             }

//             res.json({
//                 success: true
//             });

//         }
//     );

// });

// // app.get("/api/warehouses", (req,res)=>{

// //   db.all(`
// //     SELECT *
// //     FROM warehouses
// //     ORDER BY warehouse_name
// //   `,(err,rows)=>{

// //     if(err){
// //       return res.status(500).json({
// //         success:false,
// //         message:err.message
// //       });
// //     }

// //     res.json({
// //       success:true,
// //       warehouses:rows
// //     });

// //   });

// // });

// // app.post("/api/warehouses",(req,res)=>{

// //   const {
// //     warehouseCode,
// //     warehouseName,
// //     warehouseType,
// //     description
// //   } = req.body;

// //   db.run(`
// //     INSERT INTO warehouses
// //     (
// //       warehouse_code,
// //       warehouse_name,
// //       warehouse_type,
// //       description
// //     )
// //     VALUES (?,?,?,?)
// //   `,
// //   [
// //     warehouseCode,
// //     warehouseName,
// //     warehouseType,
// //     description
// //   ],
// //   function(err){

// //     if(err){
// //       return res.status(500).json({
// //         success:false,
// //         message:err.message
// //       });
// //     }

// //     res.json({
// //       success:true
// //     });

// //   });

// // });

// // // ===============================
// // // DEPO TRANSFER FİŞLERİ
// // // ===============================

// // app.get("/api/stock-transfers", (req, res) => {
// //   db.all(`
// //     SELECT
// //       st.id,
// //       st.transfer_no,
// //       st.source_warehouse_id,
// //       sw.warehouse_name AS source_warehouse_name,
// //       st.target_warehouse_id,
// //       tw.warehouse_name AS target_warehouse_name,
// //       st.stock_id,
// //       s.stock_code,
// //       s.part_name,
// //       st.quantity,
// //       st.transfer_date,
// //       st.status,
// //       st.description,
// //       st.created_by,
// //       st.created_at
// //     FROM stock_transfers st
// //     LEFT JOIN warehouses sw ON sw.id = st.source_warehouse_id
// //     LEFT JOIN warehouses tw ON tw.id = st.target_warehouse_id
// //     LEFT JOIN stocks s ON s.id = st.stock_id
// //     ORDER BY st.id DESC
// //   `, [], (err, rows) => {
// //     if (err) {
// //       console.error("Transfer fişleri listeleme hatası:", err.message);

// //       return res.status(500).json({
// //         success: false,
// //         message: err.message,
// //         transfers: []
// //       });
// //     }

// //     res.json({
// //       success: true,
// //       transfers: rows || []
// //     });
// //   });
// // });

// // app.post("/api/stock-transfers", (req, res) => {
// //   const {
// //     sourceWarehouseId,
// //     targetWarehouseId,
// //     stockId,
// //     quantity,
// //     transferDate,
// //     description
// //   } = req.body;

// //   if (!sourceWarehouseId || !targetWarehouseId || !stockId || !quantity) {
// //     return res.status(400).json({
// //       success: false,
// //       message: "Kaynak depo, hedef depo, stok ve miktar zorunludur."
// //     });
// //   }

// //   if (String(sourceWarehouseId) === String(targetWarehouseId)) {
// //     return res.status(400).json({
// //       success: false,
// //       message: "Kaynak depo ve hedef depo aynı olamaz."
// //     });
// //   }

// //   const transferNo = "TRF" + Date.now();
// //   const createdBy = req.headers["x-user-name"] || "Bilinmeyen Kullanıcı";

// //   db.run(`
// //     INSERT INTO stock_transfers
// //     (
// //       transfer_no,
// //       source_warehouse_id,
// //       target_warehouse_id,
// //       stock_id,
// //       quantity,
// //       transfer_date,
// //       status,
// //       description,
// //       created_by
// //     )
// //     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
// //   `,
// //   [
// //     transferNo,
// //     sourceWarehouseId,
// //     targetWarehouseId,
// //     stockId,
// //     Number(quantity || 0),
// //     transferDate || new Date().toISOString().split("T")[0],
// //     "pending",
// //     description || "",
// //     createdBy
// //   ],
// //   function(err) {
// //     if (err) {
// //       console.error("Transfer fişi oluşturma hatası:", err.message);

// //       return res.status(500).json({
// //         success: false,
// //         message: err.message
// //       });
// //     }

// //     if (typeof addActivityLog === "function") {
// //       addActivityLog(req, {
// //         moduleName: "Transfer Fişleri",
// //         actionType: "CREATE",
// //         description: transferNo + " numaralı transfer fişi oluşturuldu.",
// //         recordId: this.lastID
// //       });
// //     }

// //     res.json({
// //       success: true,
// //       message: "Transfer fişi oluşturuldu.",
// //       id: this.lastID,
// //       transferNo
// //     });
// //   });
// // });

// app.get("/api/warehouses", (req,res)=>{

//   db.all(`
//     SELECT *
//     FROM warehouses
//     ORDER BY warehouse_name
//   `,(err,rows)=>{

//     if(err){
//       return res.status(500).json({
//         success:false,
//         message:err.message
//       });
//     }

//     res.json({
//       success:true,
//       warehouses:rows
//     });

//   });

// });

// app.post("/api/warehouses",(req,res)=>{

//   const {
//     warehouseCode,
//     warehouseName,
//     warehouseType,
//     description
//   } = req.body;

//   db.run(`
//     INSERT INTO warehouses
//     (
//       warehouse_code,
//       warehouse_name,
//       warehouse_type,
//       description
//     )
//     VALUES (?,?,?,?)
//   `,
//   [
//     warehouseCode,
//     warehouseName,
//     warehouseType,
//     description
//   ],
//   function(err){

//     if(err){
//       return res.status(500).json({
//         success:false,
//         message:err.message
//       });
//     }

//     res.json({
//       success:true
//     });

//   });

// });

// // ===============================
// // DEPO TRANSFER FİŞLERİ
// // ===============================

// app.get("/api/stock-transfers", (req, res) => {
//   db.all(`
//     SELECT
//       st.id,
//       st.transfer_no,
//       st.source_warehouse_id,
//       sw.warehouse_name AS source_warehouse_name,
//       st.target_warehouse_id,
//       tw.warehouse_name AS target_warehouse_name,
//       st.stock_id,
//       s.stock_code,
//       s.part_name,
//       st.quantity,
//       st.transfer_date,
//       st.status,
//       st.description,
//       st.created_by,
//       st.created_at
//     FROM stock_transfers st
//     LEFT JOIN warehouses sw ON sw.id = st.source_warehouse_id
//     LEFT JOIN warehouses tw ON tw.id = st.target_warehouse_id
//     LEFT JOIN stocks s ON s.id = st.stock_id
//     ORDER BY st.id DESC
//   `, [], (err, rows) => {
//     if (err) {
//       console.error("Transfer fişleri listeleme hatası:", err.message);

//       return res.status(500).json({
//         success: false,
//         message: err.message,
//         transfers: []
//       });
//     }

//     res.json({
//       success: true,
//       transfers: rows || []
//     });
//   });
// });

// app.post("/api/stock-transfers", (req, res) => {
//   const {
//     sourceWarehouseId,
//     targetWarehouseId,
//     stockId,
//     quantity,
//     transferDate,
//     description
//   } = req.body;

//   if (!sourceWarehouseId || !targetWarehouseId || !stockId || !quantity) {
//     return res.status(400).json({
//       success: false,
//       message: "Kaynak depo, hedef depo, stok ve miktar zorunludur."
//     });
//   }

//   if (String(sourceWarehouseId) === String(targetWarehouseId)) {
//     return res.status(400).json({
//       success: false,
//       message: "Kaynak depo ve hedef depo aynı olamaz."
//     });
//   }

//   const transferNo = "TRF" + Date.now();
//   const createdBy = req.headers["x-user-name"] || "Bilinmeyen Kullanıcı";

//   db.run(`
//     INSERT INTO stock_transfers
//     (
//       transfer_no,
//       source_warehouse_id,
//       target_warehouse_id,
//       stock_id,
//       quantity,
//       transfer_date,
//       status,
//       description,
//       created_by
//     )
//     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
//   `,
//   [
//     transferNo,
//     sourceWarehouseId,
//     targetWarehouseId,
//     stockId,
//     Number(quantity || 0),
//     transferDate || new Date().toISOString().split("T")[0],
//     "pending",
//     description || "",
//     createdBy
//   ],
//   function(err) {
//     if (err) {
//       console.error("Transfer fişi oluşturma hatası:", err.message);

//       return res.status(500).json({
//         success: false,
//         message: err.message
//       });
//     }

//     if (typeof addActivityLog === "function") {
//       addActivityLog(req, {
//         moduleName: "Transfer Fişleri",
//         actionType: "CREATE",
//         description: transferNo + " numaralı transfer fişi oluşturuldu.",
//         recordId: this.lastID
//       });
//     }

//     res.json({
//       success: true,
//       message: "Transfer fişi oluşturuldu.",
//       id: this.lastID,
//       transferNo
//     });
//   });
// });

// // ===============================
// // MAL KABUL LİSTELE
// // ===============================
// app.get("/api/goods-receipts", (req, res) => {
//   db.all(`
//     SELECT 
//       gr.*,
//       po.order_no AS purchase_order_no,
//       s.stock_code,
//       s.part_name,
//       w.warehouse_name
//     FROM goods_receipts gr
//     LEFT JOIN purchase_orders po ON po.id = gr.purchase_order_id
//     LEFT JOIN stocks s ON s.id = gr.stock_id
//     LEFT JOIN warehouses w ON w.id = gr.warehouse_id
//     ORDER BY gr.id DESC
//   `, [], (err, rows) => {
//     if (err) {
//       console.error("Mal kabul listesi alınamadı:", err);
//       return res.status(500).json({ success:false, message:err.message });
//     }

//     res.json({ success:true, receipts:rows });
//   });
// });


// // ===============================
// // MAL KABUL OLUŞTUR
// // ===============================
// app.post("/api/goods-receipts", (req, res) => {
//   const {
//     purchaseOrderId,
//     stockId,
//     warehouseId,
//     receivedQuantity,
//     deliveryNoteNo,
//     receiptDate,
//     description,
//     createdBy
//   } = req.body;

//   if (!stockId || !warehouseId || !receivedQuantity) {
//     return res.status(400).json({
//       success:false,
//       message:"Malzeme, depo ve gelen miktar zorunludur."
//     });
//   }

//   const receiptNo = "MK" + Date.now();

//   db.run(`
//     INSERT INTO goods_receipts (
//       receipt_no,
//       purchase_order_id,
//       stock_id,
//       warehouse_id,
//       received_quantity,
//       delivery_note_no,
//       receipt_date,
//       status,
//       description,
//       created_by
//     )
//     VALUES (?, ?, ?, ?, ?, ?, ?, 'Beklemede', ?, ?)
//   `, [
//     receiptNo,
//     purchaseOrderId || null,
//     stockId,
//     warehouseId,
//     receivedQuantity,
//     deliveryNoteNo || "",
//     receiptDate || new Date().toISOString().slice(0,10),
//     description || "",
//     createdBy || "Admin"
//   ], function(err) {
//     if (err) {
//       console.error("Mal kabul oluşturulamadı:", err);
//       return res.status(500).json({ success:false, message:err.message });
//     }

//     res.json({
//       success:true,
//       message:"Mal kabul kaydı oluşturuldu.",
//       id:this.lastID,
//       receiptNo
//     });
//   });
// });


// // ===============================
// // MAL KABUL ONAYLA
// // ===============================
// app.put("/api/goods-receipts/:id/approve", (req, res) => {
//   const receiptId = req.params.id;

//   db.get(`
//     SELECT *
//     FROM goods_receipts
//     WHERE id = ?
//   `, [receiptId], (err, receipt) => {
//     if (err) {
//       console.error("Mal kabul sorgu hatası:", err);
//       return res.status(500).json({ success:false, message:err.message });
//     }

//     if (!receipt) {
//       return res.status(404).json({
//         success:false,
//         message:"Mal kabul kaydı bulunamadı."
//       });
//     }

//     if (receipt.status === "Onaylandı") {
//       return res.status(400).json({
//         success:false,
//         message:"Bu mal kabul zaten onaylanmış."
//       });
//     }

//     db.get(`
//       SELECT quantity
//       FROM warehouse_stocks
//       WHERE warehouse_id = ? AND stock_id = ?
//     `, [receipt.warehouse_id, receipt.stock_id], (err, currentStock) => {
//       if (err) {
//         console.error("Depo stok sorgu hatası:", err);
//         return res.status(500).json({ success:false, message:err.message });
//       }

//       const previousQty = currentStock ? Number(currentStock.quantity) : 0;
//       const nextQty = previousQty + Number(receipt.received_quantity);

//       db.serialize(() => {
//         db.run("BEGIN TRANSACTION");

//         db.run(`
//           INSERT INTO warehouse_stocks (
//             warehouse_id,
//             stock_id,
//             quantity
//           )
//           VALUES (?, ?, ?)
//           ON CONFLICT(warehouse_id, stock_id)
//           DO UPDATE SET quantity = quantity + excluded.quantity
//         `, [
//           receipt.warehouse_id,
//           receipt.stock_id,
//           receipt.received_quantity
//         ]);

//         db.run(`
//           UPDATE goods_receipts
//           SET status = 'Onaylandı'
//           WHERE id = ?
//         `, [receiptId]);

// db.run(`
//   INSERT INTO stock_movements (
//     movement_no,
//     movement_date,
//     stock_id,
//     movement_type,
//     quantity,
//     before_qty,
//     after_qty,
//     document_no,
//     description,
//     created_by
//   )
//   VALUES (?, DATETIME('now'), ?, 'in', ?, ?, ?, ?, ?, ?)
// `, [
//   "HRK" + Date.now(),
//   receipt.stock_id,
//   receipt.received_quantity,
//   previousQty,
//   nextQty,
//   receipt.receipt_no,
//   "Mal kabul: " + receipt.receipt_no,
//   receipt.created_by || "Admin"
// ]);

//         if (receipt.purchase_order_id) {
//           db.run(`
//             UPDATE purchase_orders
//             SET status = 'Mal Kabul Yapıldı'
//             WHERE id = ?
//           `, [receipt.purchase_order_id]);
//         }

//         db.run("COMMIT", (commitErr) => {
//           if (commitErr) {
//             db.run("ROLLBACK");
//             console.error("Mal kabul commit hatası:", commitErr);
//             return res.status(500).json({
//               success:false,
//               message:commitErr.message
//             });
//           }

//           res.json({
//             success:true,
//             message:"Mal kabul onaylandı ve stok girişi yapıldı."
//           });
//         });
//       });
//     });
//   });
// });

// // ===============================
// // BARKOD / QR ETİKET LİSTELE
// // ===============================
// app.get("/api/barcode-labels", (req, res) => {
//   db.all(`
//     SELECT 
//       bl.*,
//       gr.receipt_no,
//       s.stock_code,
//       s.part_name,
//       w.warehouse_name
//     FROM barcode_labels bl
//     LEFT JOIN goods_receipts gr ON gr.id = bl.goods_receipt_id
//     LEFT JOIN stocks s ON s.id = bl.stock_id
//     LEFT JOIN warehouses w ON w.id = bl.warehouse_id
//     ORDER BY bl.id DESC
//   `, [], (err, rows) => {
//     if (err) {
//       console.error("Etiketler alınamadı:", err);
//       return res.status(500).json({ success:false, message:err.message });
//     }

//     res.json({ success:true, labels:rows });
//   });
// });


// // ===============================
// // ONAYLI MAL KABULLER
// // ===============================
// app.get("/api/goods-receipts-approved", (req, res) => {
//   db.all(`
//     SELECT 
//       gr.*,
//       s.stock_code,
//       s.part_name,
//       w.warehouse_name
//     FROM goods_receipts gr
//     LEFT JOIN stocks s ON s.id = gr.stock_id
//     LEFT JOIN warehouses w ON w.id = gr.warehouse_id
//     WHERE gr.status = 'Onaylandı'
//     ORDER BY gr.id DESC
//   `, [], (err, rows) => {
//     if (err) {
//       console.error("Onaylı mal kabuller alınamadı:", err);
//       return res.status(500).json({ success:false, message:err.message });
//     }

//     res.json({ success:true, receipts:rows });
//   });
// });

// // ===============================
// // MALİYET HESAPLAMA LİSTELE
// // ===============================
// app.get("/api/cost-calculations", (req, res) => {
//   db.all(`
//     SELECT 
//       cc.*,
//       wo.work_order_no,
//       wo.title AS work_order_title,
//       s.stock_code,
//       s.part_name
//     FROM cost_calculations cc
//     LEFT JOIN work_orders wo ON wo.id = cc.work_order_id
//     LEFT JOIN stocks s ON s.id = cc.stock_id
//     ORDER BY cc.id DESC
//   `, [], (err, rows) => {
//     if (err) {
//       console.error("Maliyet hesapları alınamadı:", err);
//       return res.status(500).json({ success:false, message:err.message });
//     }

//     res.json({ success:true, calculations:rows });
//   });
// });


// // ===============================
// // MALİYET HESAPLAMA OLUŞTUR
// // ===============================
// app.post("/api/cost-calculations", (req, res) => {
//   const {
//     workOrderId,
//     stockId,
//     productionQuantity,
//     materialCost,
//     laborHours,
//     laborHourRate,
//     machineHours,
//     machineHourRate,
//     overheadCost,
//     scrapRate,
//     calculationDate,
//     description,
//     createdBy
//   } = req.body;

//   const qty = Number(productionQuantity || 1);
//   const mat = Number(materialCost || 0);

//   const lh = Number(laborHours || 0);
//   const lhr = Number(laborHourRate || 0);
//   const laborCost = lh * lhr;

//   const mh = Number(machineHours || 0);
//   const mhr = Number(machineHourRate || 0);
//   const machineCost = mh * mhr;

//   const overhead = Number(overheadCost || 0);
//   const scrap = Number(scrapRate || 0);

//   const subtotal = mat + laborCost + machineCost + overhead;
//   const scrapCost = subtotal * scrap / 100;
//   const totalCost = subtotal + scrapCost;
//   const unitCost = qty > 0 ? totalCost / qty : 0;

//   const calculationNo = "MAL" + Date.now();

//   db.run(`
//     INSERT INTO cost_calculations (
//       calculation_no,
//       work_order_id,
//       stock_id,
//       production_quantity,
//       material_cost,
//       labor_hours,
//       labor_hour_rate,
//       labor_cost,
//       machine_hours,
//       machine_hour_rate,
//       machine_cost,
//       overhead_cost,
//       scrap_rate,
//       scrap_cost,
//       total_cost,
//       unit_cost,
//       calculation_date,
//       status,
//       description,
//       created_by
//     )
//     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'draft', ?, ?)
//   `, [
//     calculationNo,
//     workOrderId || null,
//     stockId || null,
//     qty,
//     mat,
//     lh,
//     lhr,
//     laborCost,
//     mh,
//     mhr,
//     machineCost,
//     overhead,
//     scrap,
//     scrapCost,
//     totalCost,
//     unitCost,
//     calculationDate || new Date().toISOString().slice(0,10),
//     description || "",
//     createdBy || "Admin"
//   ], function(err) {
//     if (err) {
//       console.error("Maliyet hesabı oluşturulamadı:", err);
//       return res.status(500).json({ success:false, message:err.message });
//     }

//     res.json({
//       success:true,
//       message:"Maliyet hesabı oluşturuldu.",
//       id:this.lastID,
//       calculationNo,
//       totalCost,
//       unitCost
//     });
//   });
// });


// // ===============================
// // MALİYET HESABI ONAYLA
// // ===============================
// app.put("/api/cost-calculations/:id/approve", (req, res) => {
//   db.run(`
//     UPDATE cost_calculations
//     SET status = 'approved'
//     WHERE id = ?
//   `, [req.params.id], function(err) {
//     if (err) {
//       console.error("Maliyet onay hatası:", err);
//       return res.status(500).json({ success:false, message:err.message });
//     }

//     res.json({ success:true, message:"Maliyet hesabı onaylandı." });
//   });
// });


// // ===============================
// // MALİYET HESABI SİL / İPTAL
// // ===============================
// app.put("/api/cost-calculations/:id/cancel", (req, res) => {
//   db.run(`
//     UPDATE cost_calculations
//     SET status = 'cancelled'
//     WHERE id = ?
//   `, [req.params.id], function(err) {
//     if (err) {
//       console.error("Maliyet iptal hatası:", err);
//       return res.status(500).json({ success:false, message:err.message });
//     }

//     res.json({ success:true, message:"Maliyet hesabı iptal edildi." });
//   });
// });

// // ===============================
// // ETİKET OLUŞTUR
// // ===============================
// app.post("/api/barcode-labels", (req, res) => {
//   const {
//     goodsReceiptId,
//     stockId,
//     warehouseId,
//     lotNo,
//     quantity,
//     labelDate,
//     description,
//     createdBy
//   } = req.body;

//   if (!stockId || !quantity) {
//     return res.status(400).json({
//       success:false,
//       message:"Malzeme ve miktar zorunludur."
//     });
//   }

//   const now = Date.now();
//   const labelNo = "ETK" + now;
//   const barcodeValue = "BC" + now;
//   const qrValue = JSON.stringify({
//     labelNo,
//     barcodeValue,
//     stockId,
//     warehouseId,
//     lotNo: lotNo || "",
//     quantity
//   });

//   db.run(`
//     INSERT INTO barcode_labels (
//       label_no,
//       barcode_value,
//       qr_value,
//       goods_receipt_id,
//       stock_id,
//       warehouse_id,
//       lot_no,
//       quantity,
//       label_date,
//       status,
//       description,
//       created_by
//     )
//     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', ?, ?)
//   `, [
//     labelNo,
//     barcodeValue,
//     qrValue,
//     goodsReceiptId || null,
//     stockId,
//     warehouseId || null,
//     lotNo || "",
//     quantity,
//     labelDate || new Date().toISOString().slice(0,10),
//     description || "",
//     createdBy || "Admin"
//   ], function(err) {
//     if (err) {
//       console.error("Etiket oluşturulamadı:", err);
//       return res.status(500).json({ success:false, message:err.message });
//     }

//     res.json({
//       success:true,
//       message:"Etiket oluşturuldu.",
//       id:this.lastID,
//       labelNo,
//       barcodeValue,
//       qrValue
//     });
//   });
// });


// // ===============================
// // ETİKET PASİFE AL
// // ===============================
// app.put("/api/barcode-labels/:id/passive", (req, res) => {
//   db.run(`
//     UPDATE barcode_labels
//     SET status = 'passive'
//     WHERE id = ?
//   `, [req.params.id], function(err) {
//     if (err) {
//       console.error("Etiket pasife alma hatası:", err);
//       return res.status(500).json({ success:false, message:err.message });
//     }

//     res.json({ success:true, message:"Etiket pasife alındı." });
//   });
// });

// // ===============================
// // MAL KABUL İPTAL
// // ===============================
// app.put("/api/goods-receipts/:id/cancel", (req, res) => {
//   db.run(`
//     UPDATE goods_receipts
//     SET status = 'İptal'
//     WHERE id = ? AND status = 'Beklemede'
//   `, [req.params.id], function(err) {
//     if (err) {
//       console.error("Mal kabul iptal hatası:", err);
//       return res.status(500).json({ success:false, message:err.message });
//     }

//     res.json({
//       success:true,
//       message:"Mal kabul iptal edildi."
//     });
//   });
// });

// app.get("/api/operations", (req, res) => {

//   db.all(`
//     SELECT *
//     FROM operations
//     ORDER BY operation_code
//   `, [], (err, rows) => {

//     if (err) {
//       return res.status(500).json({
//         success:false,
//         message:err.message
//       });
//     }

//     res.json({
//       success:true,
//       operations:rows
//     });

//   });

// });

// app.post("/api/operations", (req,res)=>{

//   const {
//     operationCode,
//     operationName,
//     machineType,
//     standardTime,
//     status,
//     description
//   } = req.body;

//   db.run(`
//     INSERT INTO operations
//     (
//       operation_code,
//       operation_name,
//       machine_type,
//       standard_time,
//       status,
//       description
//     )
//     VALUES (?,?,?,?,?,?)
//   `,
//   [
//     operationCode,
//     operationName,
//     machineType,
//     standardTime || 0,
//     status || "active",
//     description || ""
//   ],
//   function(err){

//     if(err){
//       return res.status(500).json({
//         success:false,
//         message:err.message
//       });
//     }

//     res.json({
//       success:true,
//       id:this.lastID
//     });

//   });

// });

// app.put("/api/operations/:id",(req,res)=>{

//   const {
//     operationCode,
//     operationName,
//     machineType,
//     standardTime,
//     status,
//     description
//   } = req.body;

//   db.run(`
//     UPDATE operations
//     SET
//       operation_code=?,
//       operation_name=?,
//       machine_type=?,
//       standard_time=?,
//       status=?,
//       description=?
//     WHERE id=?
//   `,
//   [
//     operationCode,
//     operationName,
//     machineType,
//     standardTime,
//     status,
//     description,
//     req.params.id
//   ],
//   function(err){

//     if(err){
//       return res.status(500).json({
//         success:false,
//         message:err.message
//       });
//     }

//     res.json({success:true});

//   });

// });

// app.get("/api/product-routes/:productId",(req,res)=>{

//   db.all(`
//     SELECT
//       pr.*,
//       o.operation_code,
//       o.operation_name,
//       o.machine_type
//     FROM product_routes pr
//     LEFT JOIN operations o
//       ON o.id = pr.operation_id
//     WHERE pr.product_id = ?
//     ORDER BY pr.sequence_no
//   `,
//   [req.params.productId],
//   (err,rows)=>{

//     if(err){
//       return res.status(500).json({
//         success:false,
//         message:err.message
//       });
//     }

//     res.json({
//       success:true,
//       routes:rows
//     });

//   });

// });
// app.post("/api/product-routes",(req,res)=>{

//   const {
//     productId,
//     operationId,
//     sequenceNo,
//     plannedTime,
//     status,
//     description
//   } = req.body;

//   db.run(`
//     INSERT INTO product_routes
//     (
//       product_id,
//       operation_id,
//       sequence_no,
//       planned_time,
//       status,
//       description
//     )
//     VALUES (?,?,?,?,?,?)
//   `,
//   [
//     productId,
//     operationId,
//     sequenceNo,
//     plannedTime || 0,
//     status || "active",
//     description || ""
//   ],
//   function(err){

//     if(err){
//       return res.status(500).json({
//         success:false,
//         message:err.message
//       });
//     }

//     res.json({
//       success:true,
//       id:this.lastID
//     });

//   });

// });
// // ===============================
// // TEDARİKÇİLER
// // ===============================

// app.get("/api/suppliers", (req, res) => {
//   db.all("SELECT * FROM suppliers ORDER BY id DESC", [], (err, rows) => {
//     if (err) {
//       return res.status(500).json({ success: false, message: err.message, suppliers: [] });
//     }

//     res.json({
//       success: true,
//       suppliers: rows.map(s => ({
//         id: s.id,
//         companyName: s.company_name,
//         authorizedPerson: s.authorized_person,
//         phone: s.phone,
//         email: s.email,
//         taxNo: s.tax_no,
//         status: s.status
//       }))
//     });
//   });
// });

// app.post("/api/suppliers", (req, res) => {
//   const { companyName, authorizedPerson, phone, email, taxNo, status } = req.body;

//   if (!companyName) {
//     return res.status(400).json({ success: false, message: "Firma adı zorunludur." });
//   }

//   db.run(
//     `
//     INSERT INTO suppliers
//     (company_name, authorized_person, phone, email, tax_no, status)
//     VALUES (?, ?, ?, ?, ?, ?)
//     `,
//     [companyName, authorizedPerson, phone, email, taxNo, status || "active"],
//     function (err) {
//       if (err) {
//         return res.status(500).json({ success: false, message: err.message });
//       }

//       res.json({ success: true, id: this.lastID });
//     }
//   );
// });

// app.put("/api/suppliers/:id", (req, res) => {
//   const { companyName, authorizedPerson, phone, email, taxNo, status } = req.body;

//   db.run(
//     `
//     UPDATE suppliers SET
//       company_name = ?,
//       authorized_person = ?,
//       phone = ?,
//       email = ?,
//       tax_no = ?,
//       status = ?
//     WHERE id = ?
//     `,
//     [companyName, authorizedPerson, phone, email, taxNo, status || "active", req.params.id],
//     function (err) {
//       if (err) {
//         return res.status(500).json({ success: false, message: err.message });
//       }

//       res.json({ success: true });
//     }
//   );
// });

// app.delete("/api/suppliers/:id", (req, res) => {
//   db.run("DELETE FROM suppliers WHERE id = ?", [req.params.id], function (err) {
//     if (err) {
//       return res.status(500).json({ success: false, message: err.message });
//     }

//     res.json({ success: true });
//   });
// });

// app.delete("/api/product-routes/:id",(req,res)=>{

//   db.run(`
//     DELETE FROM product_routes
//     WHERE id = ?
//   `,
//   [req.params.id],
//   function(err){

//     if(err){
//       return res.status(500).json({
//         success:false,
//         message:err.message
//       });
//     }

//     res.json({
//       success:true
//     });

//   });

// });

// // ======================================
// // İŞ EMRİ OPERASYON TAKİBİ
// // ======================================

// db.run(`
// CREATE TABLE IF NOT EXISTS work_order_operations (
//   id INTEGER PRIMARY KEY AUTOINCREMENT,
//   work_order_id INTEGER NOT NULL,
//   product_id INTEGER,
//   operation_id INTEGER,
//   sequence_no INTEGER,
//   operation_code TEXT,
//   operation_name TEXT,
//   machine_type TEXT,
//   planned_time REAL DEFAULT 0,
//   status TEXT DEFAULT 'waiting',
//   start_time TEXT,
//   end_time TEXT,
//   operator_name TEXT,
//   description TEXT,
//   created_at TEXT DEFAULT CURRENT_TIMESTAMP
// )
// `);

// // İş emrine ait operasyonları listele
// app.get("/api/work-orders/:workOrderId/operations", (req, res) => {
//   const { workOrderId } = req.params;

//   db.all(`
//     SELECT *
//     FROM work_order_operations
//     WHERE work_order_id = ?
//     ORDER BY sequence_no ASC, id ASC
//   `, [workOrderId], (err, rows) => {
//     if (err) {
//       console.error("İş emri operasyon listeleme hatası:", err.message);

//       return res.status(500).json({
//         success: false,
//         message: err.message,
//         operations: []
//       });
//     }

//     res.json({
//       success: true,
//       operations: rows || []
//     });
//   });
// });

// // Ürün rotasından iş emrine operasyon oluştur
// app.post("/api/work-orders/:workOrderId/create-operations", (req, res) => {
//   const { workOrderId } = req.params;

//   db.get(`
//     SELECT *
//     FROM work_orders
//     WHERE id = ?
//   `, [workOrderId], (err, workOrder) => {
//     if (err) {
//       return res.status(500).json({
//         success: false,
//         message: err.message
//       });
//     }

//     if (!workOrder) {
//       return res.status(404).json({
//         success: false,
//         message: "İş emri bulunamadı."
//       });
//     }

//     const productId =
//       workOrder.product_id ||
//       workOrder.stock_id ||
//       workOrder.part_id ||
//       null;

//     if (!productId) {
//       return res.status(400).json({
//         success: false,
//         message: "Bu iş emrinde ürün/stok bağlantısı bulunamadı. work_orders tablosunda product_id veya stock_id olmalı."
//       });
//     }

//     db.get(`
//       SELECT COUNT(*) AS count
//       FROM work_order_operations
//       WHERE work_order_id = ?
//     `, [workOrderId], (err, existing) => {
//       if (err) {
//         return res.status(500).json({
//           success: false,
//           message: err.message
//         });
//       }

//       if (existing && existing.count > 0) {
//         return res.status(400).json({
//           success: false,
//           message: "Bu iş emri için operasyonlar zaten oluşturulmuş."
//         });
//       }

//       db.all(`
//         SELECT
//           pr.product_id,
//           pr.operation_id,
//           pr.sequence_no,
//           pr.planned_time,
//           pr.description,
//           o.operation_code,
//           o.operation_name,
//           o.machine_type
//         FROM product_routes pr
//         LEFT JOIN operations o ON o.id = pr.operation_id
//         WHERE pr.product_id = ?
//           AND IFNULL(pr.status, 'active') = 'active'
//         ORDER BY pr.sequence_no ASC
//       `, [productId], (err, routes) => {
//         if (err) {
//           return res.status(500).json({
//             success: false,
//             message: err.message
//           });
//         }

//         if (!routes || routes.length === 0) {
//           return res.status(404).json({
//             success: false,
//             message: "Bu ürün için rota bulunamadı. Önce Ürün Rotaları ekranından rota tanımla."
//           });
//         }

//         const stmt = db.prepare(`
//           INSERT INTO work_order_operations
//           (
//             work_order_id,
//             product_id,
//             operation_id,
//             sequence_no,
//             operation_code,
//             operation_name,
//             machine_type,
//             planned_time,
//             status,
//             description
//           )
//           VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'waiting', ?)
//         `);

//         routes.forEach(r => {
//           stmt.run([
//             workOrderId,
//             r.product_id,
//             r.operation_id,
//             r.sequence_no,
//             r.operation_code || "",
//             r.operation_name || "",
//             r.machine_type || "",
//             Number(r.planned_time || 0),
//             r.description || ""
//           ]);
//         });

//         stmt.finalize(finalErr => {
//           if (finalErr) {
//             return res.status(500).json({
//               success: false,
//               message: finalErr.message
//             });
//           }

//           if (typeof addActivityLog === "function") {
//             addActivityLog(req, {
//               moduleName: "İş Emri Operasyonları",
//               actionType: "CREATE",
//               description: "İş emri için rota operasyonları oluşturuldu.",
//               recordId: workOrderId
//             });
//           }

//           res.json({
//             success: true,
//             message: `${routes.length} operasyon iş emrine aktarıldı.`
//           });
//         });
//       });
//     });
//   });
// });

// // Operasyon başlat
// app.put("/api/work-order-operations/:id/start", (req, res) => {
//   const { id } = req.params;
//   const { operatorName } = req.body;

//   db.get(`
//     SELECT *
//     FROM work_order_operations
//     WHERE id = ?
//   `, [id], (err, operation) => {
//     if (err) {
//       return res.status(500).json({
//         success: false,
//         message: err.message
//       });
//     }

//     if (!operation) {
//       return res.status(404).json({
//         success: false,
//         message: "Operasyon bulunamadı."
//       });
//     }

//     if (operation.status !== "waiting") {
//       return res.status(400).json({
//         success: false,
//         message: "Sadece bekleyen operasyon başlatılabilir."
//       });
//     }

//     db.run(`
//       UPDATE work_order_operations
//       SET
//         status = 'in_progress',
//         start_time = datetime('now'),
//         operator_name = ?
//       WHERE id = ?
//     `, [
//       operatorName || req.headers["x-user-name"] || "Operatör",
//       id
//     ], function(err) {
//       if (err) {
//         return res.status(500).json({
//           success: false,
//           message: err.message
//         });
//       }

//       if (typeof addActivityLog === "function") {
//         addActivityLog(req, {
//           moduleName: "İş Emri Operasyonları",
//           actionType: "START",
//           description: `${operation.operation_name} operasyonu başlatıldı.`,
//           recordId: id
//         });
//       }

//       res.json({
//         success: true,
//         message: "Operasyon başlatıldı."
//       });
//     });
//   });
// });

// // Operasyon bitir
// app.put("/api/work-order-operations/:id/finish", (req, res) => {
//   const { id } = req.params;

//   db.get(`
//     SELECT *
//     FROM work_order_operations
//     WHERE id = ?
//   `, [id], (err, operation) => {
//     if (err) {
//       return res.status(500).json({
//         success: false,
//         message: err.message
//       });
//     }

//     if (!operation) {
//       return res.status(404).json({
//         success: false,
//         message: "Operasyon bulunamadı."
//       });
//     }

//     if (operation.status !== "in_progress") {
//       return res.status(400).json({
//         success: false,
//         message: "Sadece devam eden operasyon bitirilebilir."
//       });
//     }

//     db.run(`
//       UPDATE work_order_operations
//       SET
//         status = 'completed',
//         end_time = datetime('now')
//       WHERE id = ?
//     `, [id], function(err) {
//       if (err) {
//         return res.status(500).json({
//           success: false,
//           message: err.message
//         });
//       }

//       if (typeof addActivityLog === "function") {
//         addActivityLog(req, {
//           moduleName: "İş Emri Operasyonları",
//           actionType: "FINISH",
//           description: `${operation.operation_name} operasyonu tamamlandı.`,
//           recordId: id
//         });
//       }

//       res.json({
//         success: true,
//         message: "Operasyon tamamlandı."
//       });
//     });
//   });
// });

// // ======================================
// // ÜRETİM PLANLAMA / MAKİNE TAKVİMİ
// // ======================================

// db.run(`
// CREATE TABLE IF NOT EXISTS production_plans (
//   id INTEGER PRIMARY KEY AUTOINCREMENT,
//   work_order_id INTEGER NOT NULL,
//   work_order_operation_id INTEGER NOT NULL,
//   machine_id INTEGER NOT NULL,
//   start_time TEXT NOT NULL,
//   end_time TEXT NOT NULL,
//   status TEXT DEFAULT 'planned',
//   operator_name TEXT,
//   description TEXT,
//   created_by TEXT,
//   created_at TEXT DEFAULT CURRENT_TIMESTAMP
// )
// `);

// app.get("/api/production-plans", (req, res) => {
//   const { machineId } = req.query;

//   let sql = `
//     SELECT
//       pp.*,
//       wo.work_order_no,
//       woo.operation_name,
//       woo.operation_code,
//       m.machine_name
//     FROM production_plans pp
//     LEFT JOIN work_orders wo ON wo.id = pp.work_order_id
//     LEFT JOIN work_order_operations woo ON woo.id = pp.work_order_operation_id
//     LEFT JOIN machine_maintenance m ON m.id = pp.machine_id
//     WHERE 1 = 1
//   `;

//   const params = [];

//   if (machineId) {
//     sql += ` AND pp.machine_id = ? `;
//     params.push(machineId);
//   }

//   sql += ` ORDER BY datetime(pp.start_time) ASC `;

//   db.all(sql, params, (err, rows) => {
//     if (err) {
//       console.error("Üretim planları listeleme hatası:", err.message);
//       return res.status(500).json({
//         success: false,
//         message: err.message,
//         plans: []
//       });
//     }

//     res.json({
//       success: true,
//       plans: rows || []
//     });
//   });
// });

// app.post("/api/production-plans", (req, res) => {
//   const {
//     workOrderId,
//     workOrderOperationId,
//     machineId,
//     startTime,
//     endTime,
//     status,
//     operatorName,
//     description
//   } = req.body;

//   if (!workOrderId || !workOrderOperationId || !machineId || !startTime || !endTime) {
//     return res.status(400).json({
//       success: false,
//       message: "İş emri, operasyon, makine, başlangıç ve bitiş zorunludur."
//     });
//   }

//   if (new Date(endTime) <= new Date(startTime)) {
//     return res.status(400).json({
//       success: false,
//       message: "Bitiş zamanı başlangıçtan büyük olmalıdır."
//     });
//   }

//   db.get(`
//     SELECT id
//     FROM production_plans
//     WHERE machine_id = ?
//       AND status IN ('planned', 'in_progress')
//       AND datetime(start_time) < datetime(?)
//       AND datetime(end_time) > datetime(?)
//   `, [machineId, endTime, startTime], (err, conflict) => {
//     if (err) {
//       return res.status(500).json({
//         success: false,
//         message: err.message
//       });
//     }

//     if (conflict) {
//       return res.status(400).json({
//         success: false,
//         message: "Bu makinede seçilen saat aralığında başka plan var."
//       });
//     }

//     db.run(`
//       INSERT INTO production_plans
//       (
//         work_order_id,
//         work_order_operation_id,
//         machine_id,
//         start_time,
//         end_time,
//         status,
//         operator_name,
//         description,
//         created_by
//       )
//       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
//     `,
//     [
//       workOrderId,
//       workOrderOperationId,
//       machineId,
//       startTime,
//       endTime,
//       status || "planned",
//       operatorName || "",
//       description || "",
//       req.headers["x-user-name"] || "Bilinmeyen Kullanıcı"
//     ],
//     function(err) {
//       if (err) {
//         console.error("Üretim planı ekleme hatası:", err.message);
//         return res.status(500).json({
//           success: false,
//           message: err.message
//         });
//       }

//       if (typeof addActivityLog === "function") {
//         addActivityLog(req, {
//           moduleName: "Üretim Planlama",
//           actionType: "CREATE",
//           description: "Yeni üretim planı oluşturuldu.",
//           recordId: this.lastID
//         });
//       }

//       res.json({
//         success: true,
//         message: "Üretim planı oluşturuldu.",
//         id: this.lastID
//       });
//     });
//   });
// });

// app.put("/api/production-plans/:id/status", (req, res) => {
//   const { status } = req.body;

//   db.run(`
//     UPDATE production_plans
//     SET status = ?
//     WHERE id = ?
//   `, [status, req.params.id], function(err) {
//     if (err) {
//       return res.status(500).json({
//         success: false,
//         message: err.message
//       });
//     }

//     res.json({ success: true });
//   });
// });

// app.delete("/api/production-plans/:id", (req, res) => {
//   db.run(`
//     DELETE FROM production_plans
//     WHERE id = ?
//   `, [req.params.id], function(err) {
//     if (err) {
//       return res.status(500).json({
//         success: false,
//         message: err.message
//       });
//     }

//     res.json({ success: true });
//   });
// });

// // ===============================
// // SATIN ALMA TALEPLERİ
// // ===============================

// app.get("/api/purchase-requests", (req, res) => {
//   const sql = `
//     SELECT 
//       pr.*,
//       s.company_name AS supplier_name
//     FROM purchase_requests pr
//     LEFT JOIN suppliers s ON s.id = pr.supplier_id
//     ORDER BY pr.id DESC
//   `;

//   db.all(sql, [], (err, rows) => {
//     if (err) {
//       return res.status(500).json({ success: false, message: err.message, requests: [] });
//     }

//     res.json({
//       success: true,
//       requests: rows.map(r => ({
//         id: r.id,
//         requestNo: r.request_no,
//         requestedBy: r.requested_by,
//         supplierId: r.supplier_id,
//         supplierName: r.supplier_name,
//         materialName: r.material_name,
//         quantity: r.quantity,
//         urgency: r.urgency,
//         status: r.status
//       }))
//     });
//   });
// });

// app.post("/api/purchase-approvals", (req, res) => {
//   const {
//     request_id,
//     approval_type,
//     status,
//     note,
//     approved_by
//   } = req.body;

//   if (!request_id) {
//     return res.status(400).json({
//       success: false,
//       message: "Satın alma talebi seçilmeden onay kaydı oluşturulamaz."
//     });
//   }

//   db.run(
//     `
//     INSERT INTO purchase_approvals
//     (request_id, approval_type, status, note, approved_by)
//     VALUES (?, ?, ?, ?, ?)
//     `,
//     [
//       request_id,
//       approval_type || "Satın Alma Talebi",
//       status || "Beklemede",
//       note || "",
//       approved_by || ""
//     ],
//     function (err) {
//       if (err) {
//         console.error("Satın alma onayı ekleme hatası:", err);
//         return res.status(500).json({
//           success: false,
//           message: err.message
//         });
//       }

//       res.json({
//         success: true,
//         message: "Satın alma onayı oluşturuldu.",
//         id: this.lastID
//       });
//     }
//   );
// });

// // ===============================
// // FATURALAR MODÜLÜ
// // ===============================

// db.run(`
// CREATE TABLE IF NOT EXISTS invoices (
//   id INTEGER PRIMARY KEY AUTOINCREMENT,
//   invoice_no TEXT,
//   customer_id INTEGER,
//   invoice_date DATE,
//   due_date DATE,
//   invoice_type TEXT DEFAULT 'Satış',
//   subtotal REAL DEFAULT 0,
//   vat_rate REAL DEFAULT 20,
//   vat_amount REAL DEFAULT 0,
//   total_amount REAL DEFAULT 0,
//   status TEXT DEFAULT 'Beklemede',
//   note TEXT,
//   created_at DATETIME DEFAULT CURRENT_TIMESTAMP
// )
// `);

// db.run(`
// CREATE TABLE IF NOT EXISTS invoice_items (
//   id INTEGER PRIMARY KEY AUTOINCREMENT,
//   invoice_id INTEGER,
//   item_name TEXT,
//   quantity REAL DEFAULT 0,
//   unit TEXT DEFAULT 'Adet',
//   unit_price REAL DEFAULT 0,
//   vat_rate REAL DEFAULT 20,
//   total_amount REAL DEFAULT 0
// )
// `);

// app.get("/api/invoices", (req, res) => {
//   db.all(`
//     SELECT 
//       i.*,
// COALESCE(c.company_name, '-') AS customer_name    FROM invoices i
//     LEFT JOIN customers c ON c.id = i.customer_id
//     ORDER BY i.id DESC
//   `, [], (err, rows) => {
//     if (err) {
//       console.error("Fatura listeleme hatası:", err);
//       return res.status(500).json({ success: false, message: err.message });
//     }

//     res.json({ success: true, invoices: rows });
//   });
// });

// app.get("/api/invoices/:id", (req, res) => {
//   db.get(`
//     SELECT 
//       i.*,
//       COALESCE(c.company_name, '-') AS customer_name,
//       COALESCE(c.tax_no, '-') AS tax_no,
//       COALESCE(c.tax_office, '-') AS tax_office,
//       COALESCE(c.address, '-') AS address,
//       COALESCE(c.phone, '-') AS phone,
//       COALESCE(c.email, '-') AS email
//     FROM invoices i
//     LEFT JOIN customers c ON c.id = i.customer_id
//     WHERE i.id = ?
//   `, [req.params.id], (err, invoice) => {
//     if (err) {
//       console.error("Fatura detay hatası:", err);
//       return res.status(500).json({ success: false, message: err.message });
//     }

//     if (!invoice) {
//       return res.status(404).json({ success: false, message: "Fatura bulunamadı." });
//     }

//     db.all(`
//       SELECT *
//       FROM invoice_items
//       WHERE invoice_id = ?
//       ORDER BY id ASC
//     `, [req.params.id], (err2, items) => {
//       if (err2) {
//         console.error("Fatura kalemleri hatası:", err2);
//         return res.status(500).json({ success: false, message: err2.message });
//       }

//       res.json({
//         success: true,
//         invoice,
//         items
//       });
//     });
//   });
// });

// app.get("/api/stock-movements", (req, res) => {
//   const sql = `
//     SELECT 
//       sm.*,
//       s.stock_code,
//       s.part_name,
//       s.unit
//     FROM stock_movements sm
//     LEFT JOIN stocks s ON s.id = sm.stock_id
//     ORDER BY sm.id DESC
//   `;

//   db.all(sql, [], (err, rows) => {
//     if (err) {
//       console.error("Stok hareketleri listeleme hatası:", err);
//       return res.status(500).json({
//         success: false,
//         message: err.message
//       });
//     }

//     res.json({
//       success: true,
//       movements: rows
//     });
//   });
// });

// // ===============================
// // STOK HAREKETİ OLUŞTUR
// // giriş, çıkış, sayım, hurda, transfer
// // ===============================
// app.post("/api/stock-movements", (req, res) => {
//   const {
//     stock_id,
//     movement_type,
//     quantity,
//     description,
//     created_by
//   } = req.body;

//   if (!stock_id || !movement_type || !quantity) {
//     return res.status(400).json({
//       success: false,
//       message: "Malzeme, hareket tipi ve miktar zorunludur."
//     });
//   }

//   db.get(`SELECT * FROM stocks WHERE id = ?`, [stock_id], (err, stock) => {
//     if (err) {
//       console.error("Stok sorgu hatası:", err);
//       return res.status(500).json({
//         success: false,
//         message: err.message
//       });
//     }

//     if (!stock) {
//       return res.status(404).json({
//         success: false,
//         message: "Stok bulunamadı."
//       });
//     }

//     const previousQuantity = Number(stock.quantity || 0);
//     const qty = Number(quantity);
//     let nextQuantity = previousQuantity;

//     if (movement_type === "giris") {
//       nextQuantity = previousQuantity + qty;
//     } else if (
//       movement_type === "cikis" ||
//       movement_type === "hurda" ||
//       movement_type === "transfer"
//     ) {
//       nextQuantity = previousQuantity - qty;
//     } else if (movement_type === "sayim") {
//       nextQuantity = qty;
//     } else {
//       return res.status(400).json({
//         success: false,
//         message: "Geçersiz hareket tipi."
//       });
//     }

//     if (nextQuantity < 0) {
//       return res.status(400).json({
//         success: false,
//         message: "Stok miktarı eksiye düşemez."
//       });
//     }

//     const movementNo = "SH-" + Date.now();

//     db.serialize(() => {
//       db.run("BEGIN TRANSACTION");

//       db.run(
//         `
//         INSERT INTO stock_movements (
//           movement_no,
//           stock_id,
//           movement_type,
//           quantity,
//           previous_quantity,
//           next_quantity,
//           description,
//           created_by
//         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
//         `,
//         [
//           movementNo,
//           stock_id,
//           movement_type,
//           qty,
//           previousQuantity,
//           nextQuantity,
//           description || "",
//           created_by || "Sistem"
//         ],
//         function (insertErr) {
//           if (insertErr) {
//             db.run("ROLLBACK");
//             console.error("Stok hareketi kayıt hatası:", insertErr);
//             return res.status(500).json({
//               success: false,
//               message: insertErr.message
//             });
//           }

//           db.run(
//             `UPDATE stocks SET quantity = ? WHERE id = ?`,
//             [nextQuantity, stock_id],
//             function (updateErr) {
//               if (updateErr) {
//                 db.run("ROLLBACK");
//                 console.error("Stok güncelleme hatası:", updateErr);
//                 return res.status(500).json({
//                   success: false,
//                   message: updateErr.message
//                 });
//               }

//               db.run("COMMIT");

//               res.json({
//                 success: true,
//                 message: "Stok hareketi başarıyla oluşturuldu.",
//                 movementNo,
//                 previousQuantity,
//                 nextQuantity
//               });
//             }
//           );
//         }
//       );
//     });
//   });
// });

// // ===============================
// // SATIŞ SİPARİŞLERİ LİSTELE
// // ===============================
// app.get("/api/sales-orders", (req, res) => {
//   const sql = `
//     SELECT
//       so.*,
//       c.company_name AS customer_name,
//       o.offer_no
//     FROM sales_orders so
//     LEFT JOIN customers c ON c.id = so.customer_id
//     LEFT JOIN offers o ON o.id = so.offer_id
//     ORDER BY so.id DESC
//   `;

//   db.all(sql, [], (err, orders) => {
//     if (err) {
//       console.error("Satış siparişleri listeleme hatası:", err);
//       return res.status(500).json({ success: false, message: err.message });
//     }

//     res.json({ success: true, orders });
//   });
// });

// // ===============================
// // SATIŞ SİPARİŞLERİ LİSTELE
// // ===============================
// app.get("/api/sales-orders", (req, res) => {
//   const sql = `
//     SELECT
//       so.*,
//       c.company_name AS customer_name,
//       o.offer_no
//     FROM sales_orders so
//     LEFT JOIN customers c ON c.id = so.customer_id
//     LEFT JOIN offers o ON o.id = so.offer_id
//     ORDER BY so.id DESC
//   `;

//   db.all(sql, [], (err, orders) => {
//     if (err) {
//       console.error("Satış siparişleri listeleme hatası:", err);
//       return res.status(500).json({ success: false, message: err.message });
//     }

//     res.json({ success: true, orders });
//   });
// });

// // ===============================
// // SATIŞ SİPARİŞ DETAY
// // ===============================
// app.get("/api/sales-orders/:id", (req, res) => {
//   const { id } = req.params;

//   db.get(
//     `
//     SELECT
//       so.*,
//       c.company_name AS customer_name,
//       o.offer_no
//     FROM sales_orders so
//     LEFT JOIN customers c ON c.id = so.customer_id
//     LEFT JOIN offers o ON o.id = so.offer_id
//     WHERE so.id = ?
//     `,
//     [id],
//     (err, order) => {
//       if (err) {
//         return res.status(500).json({ success: false, message: err.message });
//       }

//       if (!order) {
//         return res.status(404).json({ success: false, message: "Sipariş bulunamadı." });
//       }

//       db.all(
//         `SELECT * FROM sales_order_lines WHERE sales_order_id = ? ORDER BY id ASC`,
//         [id],
//         (lineErr, lines) => {
//           if (lineErr) {
//             return res.status(500).json({ success: false, message: lineErr.message });
//           }

//           res.json({ success: true, order, lines });
//         }
//       );
//     }
//   );
// });

// // ===============================
// // SATIŞ SİPARİŞİ OLUŞTUR
// // ===============================
// app.post("/api/sales-orders", (req, res) => {
//   const {
//     customer_id,
//     offer_id,
//     order_date,
//     delivery_date,
//     status,
//     note,
//     created_by,
//     lines
//   } = req.body;

//   if (!customer_id || !order_date || !delivery_date) {
//     return res.status(400).json({
//       success: false,
//       message: "Müşteri, sipariş tarihi ve termin tarihi zorunludur."
//     });
//   }

//   const orderNo = "SS-" + Date.now();
//   const orderLines = Array.isArray(lines) ? lines : [];

//   const totalAmount = orderLines.reduce((sum, line) => {
//     const qty = Number(line.quantity || 0);
//     const price = Number(line.unit_price || 0);
//     return sum + qty * price;
//   }, 0);

//   db.serialize(() => {
//     db.run("BEGIN TRANSACTION");

//     db.run(
//       `
//       INSERT INTO sales_orders (
//         order_no,
//         customer_id,
//         offer_id,
//         order_date,
//         delivery_date,
//         status,
//         total_amount,
//         note,
//         created_by
//       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
//       `,
//       [
//         orderNo,
//         customer_id,
//         offer_id || null,
//         order_date,
//         delivery_date,
//         status || "draft",
//         totalAmount,
//         note || "",
//         created_by || "Sistem"
//       ],
//       function (err) {
//         if (err) {
//           db.run("ROLLBACK");
//           console.error("Satış siparişi kayıt hatası:", err);
//           return res.status(500).json({ success: false, message: err.message });
//         }

//         const salesOrderId = this.lastID;

//         if (!orderLines.length) {
//           db.run("COMMIT");
//           return res.json({
//             success: true,
//             message: "Satış siparişi oluşturuldu.",
//             orderId: salesOrderId,
//             orderNo
//           });
//         }

//         const stmt = db.prepare(`
//           INSERT INTO sales_order_lines (
//             sales_order_id,
//             part_name,
//             description,
//             quantity,
//             unit,
//             unit_price,
//             total_price
//           ) VALUES (?, ?, ?, ?, ?, ?, ?)
//         `);

//         for (const line of orderLines) {
//           const qty = Number(line.quantity || 0);
//           const price = Number(line.unit_price || 0);
//           const total = qty * price;

//           stmt.run([
//             salesOrderId,
//             line.part_name || "",
//             line.description || "",
//             qty,
//             line.unit || "Adet",
//             price,
//             total
//           ]);
//         }

//         stmt.finalize((finalErr) => {
//           if (finalErr) {
//             db.run("ROLLBACK");
//             return res.status(500).json({ success: false, message: finalErr.message });
//           }

//           db.run("COMMIT");

//           res.json({
//             success: true,
//             message: "Satış siparişi oluşturuldu.",
//             orderId: salesOrderId,
//             orderNo
//           });
//         });
//       }
//     );
//   });
// });

// // ===============================
// // SATIŞ SİPARİŞİ OLUŞTUR
// // ===============================
// app.post("/api/sales-orders", (req, res) => {
//   const {
//     customer_id,
//     offer_id,
//     order_date,
//     delivery_date,
//     status,
//     note,
//     created_by,
//     lines
//   } = req.body;

//   if (!customer_id || !order_date || !delivery_date) {
//     return res.status(400).json({
//       success: false,
//       message: "Müşteri, sipariş tarihi ve termin tarihi zorunludur."
//     });
//   }

//   const orderNo = "SS-" + Date.now();
//   const orderLines = Array.isArray(lines) ? lines : [];

//   const totalAmount = orderLines.reduce((sum, line) => {
//     const qty = Number(line.quantity || 0);
//     const price = Number(line.unit_price || 0);
//     return sum + qty * price;
//   }, 0);

//   db.serialize(() => {
//     db.run("BEGIN TRANSACTION");

//     db.run(
//       `
//       INSERT INTO sales_orders (
//         order_no,
//         customer_id,
//         offer_id,
//         order_date,
//         delivery_date,
//         status,
//         total_amount,
//         note,
//         created_by
//       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
//       `,
//       [
//         orderNo,
//         customer_id,
//         offer_id || null,
//         order_date,
//         delivery_date,
//         status || "draft",
//         totalAmount,
//         note || "",
//         created_by || "Sistem"
//       ],
//       function (err) {
//         if (err) {
//           db.run("ROLLBACK");
//           console.error("Satış siparişi kayıt hatası:", err);
//           return res.status(500).json({ success: false, message: err.message });
//         }

//         const salesOrderId = this.lastID;

//         if (!orderLines.length) {
//           db.run("COMMIT");
//           return res.json({
//             success: true,
//             message: "Satış siparişi oluşturuldu.",
//             orderId: salesOrderId,
//             orderNo
//           });
//         }

//         const stmt = db.prepare(`
//           INSERT INTO sales_order_lines (
//             sales_order_id,
//             part_name,
//             description,
//             quantity,
//             unit,
//             unit_price,
//             total_price
//           ) VALUES (?, ?, ?, ?, ?, ?, ?)
//         `);

//         for (const line of orderLines) {
//           const qty = Number(line.quantity || 0);
//           const price = Number(line.unit_price || 0);
//           const total = qty * price;

//           stmt.run([
//             salesOrderId,
//             line.part_name || "",
//             line.description || "",
//             qty,
//             line.unit || "Adet",
//             price,
//             total
//           ]);
//         }

//         stmt.finalize((finalErr) => {
//           if (finalErr) {
//             db.run("ROLLBACK");
//             return res.status(500).json({ success: false, message: finalErr.message });
//           }

//           db.run("COMMIT");

//           res.json({
//             success: true,
//             message: "Satış siparişi oluşturuldu.",
//             orderId: salesOrderId,
//             orderNo
//           });
//         });
//       }
//     );
//   });
// });

// // ===============================
// // SATIŞ SİPARİŞİ SİL
// // ===============================
// app.delete("/api/sales-orders/:id", (req, res) => {
//   const { id } = req.params;

//   db.serialize(() => {
//     db.run("BEGIN TRANSACTION");

//     db.run(`DELETE FROM sales_order_lines WHERE sales_order_id = ?`, [id], (lineErr) => {
//       if (lineErr) {
//         db.run("ROLLBACK");
//         return res.status(500).json({ success: false, message: lineErr.message });
//       }

//       db.run(`DELETE FROM sales_orders WHERE id = ?`, [id], function (err) {
//         if (err) {
//           db.run("ROLLBACK");
//           return res.status(500).json({ success: false, message: err.message });
//         }

//         db.run("COMMIT");

//         res.json({
//           success: true,
//           message: "Satış siparişi silindi."
//         });
//       });
//     });
//   });
// });

// app.post("/api/invoices", (req, res) => {
//   const {
//     customer_id,
//     invoice_date,
//     due_date,
//     invoice_type,
//     item_name,
//     quantity,
//     unit,
//     unit_price,
//     vat_rate,
//     note
//   } = req.body;

//   if (!customer_id || !item_name || !quantity) {
//     return res.status(400).json({
//       success: false,
//       message: "Müşteri, malzeme ve miktar zorunludur."
//     });
//   }

//   const invoice_no = "FAT" + Date.now();
//   const qty = Number(quantity || 0);
//   const price = Number(unit_price || 0);
//   const vat = Number(vat_rate || 20);

//   const subtotal = qty * price;
//   const vat_amount = subtotal * vat / 100;
//   const total_amount = subtotal + vat_amount;

//   db.run(`
//     INSERT INTO invoices
//     (
//       invoice_no, customer_id, invoice_date, due_date,
//       invoice_type, subtotal, vat_rate, vat_amount,
//       total_amount, status, note
//     )
//     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
//   `, [
//     invoice_no,
//     customer_id,
//     invoice_date,
//     due_date,
//     invoice_type || "Satış",
//     subtotal,
//     vat,
//     vat_amount,
//     total_amount,
//     "Beklemede",
//     note || ""
//   ], function (err) {
//     if (err) {
//       console.error("Fatura ekleme hatası:", err);
//       return res.status(500).json({ success: false, message: err.message });
//     }

//     const invoiceId = this.lastID;

//     db.run(`
//       INSERT INTO invoice_items
//       (
//         invoice_id, item_name, quantity, unit,
//         unit_price, vat_rate, total_amount
//       )
//       VALUES (?, ?, ?, ?, ?, ?, ?)
//     `, [
//       invoiceId,
//       item_name,
//       qty,
//       unit || "Adet",
//       price,
//       vat,
//       total_amount
//     ]);

//     res.json({
//       success: true,
//       message: "Fatura başarıyla oluşturuldu.",
//       invoiceId
//     });
//   });
// });

// app.put("/api/invoices/:id/status", (req, res) => {
//   const { status } = req.body;

//   db.run(`
//     UPDATE invoices
//     SET status = ?
//     WHERE id = ?
//   `, [status, req.params.id], function (err) {
//     if (err) {
//       console.error("Fatura durum güncelleme hatası:", err);
//       return res.status(500).json({ success: false, message: err.message });
//     }

//     res.json({
//       success: true,
//       message: "Fatura durumu güncellendi."
//     });
//   });
// });

// app.delete("/api/invoices/:id", (req, res) => {
//   db.run(`DELETE FROM invoice_items WHERE invoice_id = ?`, [req.params.id]);

//   db.run(`DELETE FROM invoices WHERE id = ?`, [req.params.id], function (err) {
//     if (err) {
//       console.error("Fatura silme hatası:", err);
//       return res.status(500).json({ success: false, message: err.message });
//     }

//     res.json({
//       success: true,
//       message: "Fatura silindi."
//     });
//   });
// });

// app.post("/api/purchase-requests", (req, res) => {
//   const {
//     requestNo,
//     requestedBy,
//     supplierId,
//     materialName,
//     quantity,
//     urgency,
//     status
//   } = req.body;

//   if (!requestNo || !materialName) {
//     return res.status(400).json({
//       success: false,
//       message: "Talep no ve malzeme zorunludur."
//     });
//   }

//   db.run(
//     `
//     INSERT INTO purchase_requests
//     (request_no, requested_by, supplier_id, material_name, quantity, urgency, status)
//     VALUES (?, ?, ?, ?, ?, ?, ?)
//     `,
//     [
//       requestNo,
//       requestedBy,
//       supplierId || null,
//       materialName,
//       Number(quantity || 0),
//       urgency || "normal",
//       status || "pending"
//     ],
//     function (err) {
//       if (err) {
//         return res.status(500).json({
//           success: false,
//           message: err.message
//         });
//       }

//       res.json({
//         success: true,
//         id: this.lastID
//       });
//     }
//   );
// });

// app.put("/api/purchase-requests/:id", (req, res) => {
//   const {
//     requestNo,
//     requestedBy,
//     supplierId,
//     materialName,
//     quantity,
//     urgency,
//     status
//   } = req.body;

//   db.run(
//     `
//     UPDATE purchase_requests SET
//       request_no = ?,
//       requested_by = ?,
//       supplier_id = ?,
//       material_name = ?,
//       quantity = ?,
//       urgency = ?,
//       status = ?
//     WHERE id = ?
//     `,
//     [
//       requestNo,
//       requestedBy,
//       supplierId || null,
//       materialName,
//       Number(quantity || 0),
//       urgency || "normal",
//       status || "pending",
//       req.params.id
//     ],
//     function (err) {
//       if (err) {
//         return res.status(500).json({
//           success: false,
//           message: err.message
//         });
//       }

//       res.json({
//         success: true
//       });
//     }
//   );
// });

// app.delete("/api/purchase-requests/:id", (req, res) => {
//   db.run("DELETE FROM purchase_requests WHERE id = ?", [req.params.id], function (err) {
//     if (err) {
//       return res.status(500).json({ success: false, message: err.message });
//     }

//     res.json({ success: true });
//   });
// });



// app.get("/api/production-tracking", (req, res) => {
//   const sql = `
//     SELECT
//       pt.*,
//       m.machine_name
//     FROM production_tracking pt
//     LEFT JOIN machine_maintenance m ON m.id = pt.machine_id
//     ORDER BY pt.id DESC
//   `;

//   db.all(sql, [], (err, rows) => {
//     if (err) {
//       return res.status(500).json({
//         success: false,
//         message: err.message,
//         productions: []
//       });
//     }

//     res.json({
//       success: true,
//       productions: rows.map(p => ({
//         id: p.id,
//         workOrderNo: p.work_order_no,
//         operationName: p.operation_name,
//         machineId: p.machine_id,
//         machineName: p.machine_name,
//         operatorName: p.operator_name,
//         startDatetime: p.start_datetime,
//         endDatetime: p.end_datetime,
//         progress: p.progress,
//         status: p.status,
//         description: p.description
//       }))
//     });
//   });
// });

// app.post("/api/production-tracking", (req, res) => {
//   const {
//     workOrderNo,
//     operationName,
//     machineId,
//     operatorName,
//     startDatetime,
//     endDatetime,
//     progress,
//     status,
//     description
//   } = req.body;

//   if (!workOrderNo || !operationName) {
//     return res.status(400).json({
//       success: false,
//       message: "İş emri ve operasyon zorunludur."
//     });
//   }

//   db.run(
//     `
//     INSERT INTO production_tracking
//     (
//       work_order_no,
//       operation_name,
//       machine_id,
//       operator_name,
//       start_datetime,
//       end_datetime,
//       progress,
//       status,
//       description
//     )
//     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
//     `,
//     [
//       workOrderNo,
//       operationName,
//       machineId || null,
//       operatorName,
//       startDatetime,
//       endDatetime,
//       Number(progress || 0),
//       status || "waiting",
//       description
//     ],
//     function (err) {
//       if (err) {
//         return res.status(500).json({
//           success: false,
//           message: err.message
//         });
//       }

//       res.json({
//         success: true,
//         id: this.lastID
//       });
//     }
//   );
// });

// db.run(`
//   CREATE TABLE IF NOT EXISTS current_accounts (
//     id INTEGER PRIMARY KEY AUTOINCREMENT,
//     account_code TEXT UNIQUE,
//     company_name TEXT NOT NULL,
//     contact_person TEXT,
//     phone TEXT,
//     email TEXT,
//     tax_no TEXT,
//     tax_office TEXT,
//     address TEXT,
//     risk_limit REAL DEFAULT 0,
//     account_type TEXT DEFAULT 'customer',
//     status TEXT DEFAULT 'active',
//     created_at TEXT DEFAULT CURRENT_TIMESTAMP
//   )
// `);

// app.get("/api/current-accounts", (req, res) => {
//   db.all(`SELECT * FROM current_accounts ORDER BY id DESC`, [], (err, rows) => {
//     if (err) {
//       return res.status(500).json({ success: false, message: err.message, accounts: [] });
//     }

//     res.json({
//       success: true,
//       accounts: rows.map(a => ({
//         id: a.id,
//         accountCode: a.account_code,
//         companyName: a.company_name,
//         contactPerson: a.contact_person,
//         phone: a.phone,
//         email: a.email,
//         taxNo: a.tax_no,
//         taxOffice: a.tax_office,
//         address: a.address,
//         riskLimit: a.risk_limit,
//         accountType: a.account_type,
//         status: a.status
//       }))
//     });
//   });
// });

// app.post("/api/current-accounts", (req, res) => {
//   const {
//     accountCode,
//     companyName,
//     contactPerson,
//     phone,
//     email,
//     taxNo,
//     taxOffice,
//     address,
//     riskLimit,
//     accountType,
//     status
//   } = req.body;

//   if (!companyName) {
//     return res.status(400).json({ success: false, message: "Firma adı zorunludur." });
//   }

//   const finalCode = accountCode || "CAR" + Date.now();

//   db.run(
//     `
//     INSERT INTO current_accounts
//     (
//       account_code,
//       company_name,
//       contact_person,
//       phone,
//       email,
//       tax_no,
//       tax_office,
//       address,
//       risk_limit,
//       account_type,
//       status
//     )
//     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
//     `,
//     [
//       finalCode,
//       companyName,
//       contactPerson,
//       phone,
//       email,
//       taxNo,
//       taxOffice,
//       address,
//       Number(riskLimit || 0),
//       accountType || "customer",
//       status || "active"
//     ],
//     function (err) {
//       if (err) {
//         return res.status(500).json({ success: false, message: err.message });
//       }

//       res.json({ success: true, id: this.lastID });
//     }
//   );
// });

// app.put("/api/current-accounts/:id", (req, res) => {
//   const {
//     accountCode,
//     companyName,
//     contactPerson,
//     phone,
//     email,
//     taxNo,
//     taxOffice,
//     address,
//     riskLimit,
//     accountType,
//     status
//   } = req.body;

//   db.run(
//     `
//     UPDATE current_accounts SET
//       account_code = ?,
//       company_name = ?,
//       contact_person = ?,
//       phone = ?,
//       email = ?,
//       tax_no = ?,
//       tax_office = ?,
//       address = ?,
//       risk_limit = ?,
//       account_type = ?,
//       status = ?
//     WHERE id = ?
//     `,
//     [
//       accountCode,
//       companyName,
//       contactPerson,
//       phone,
//       email,
//       taxNo,
//       taxOffice,
//       address,
//       Number(riskLimit || 0),
//       accountType || "customer",
//       status || "active",
//       req.params.id
//     ],
//     function (err) {
//       if (err) {
//         return res.status(500).json({ success: false, message: err.message });
//       }

//       res.json({ success: true });
//     }
//   );
// });

// app.delete("/api/current-accounts/:id", (req, res) => {
//   db.run(`DELETE FROM current_accounts WHERE id = ?`, [req.params.id], function (err) {
//     if (err) {
//       return res.status(500).json({ success: false, message: err.message });
//     }

//     res.json({ success: true });
//   });
// });

// db.run(`
//   CREATE TABLE IF NOT EXISTS current_account_transactions (
//     id INTEGER PRIMARY KEY AUTOINCREMENT,
//     account_id INTEGER NOT NULL,
//     transaction_date TEXT NOT NULL,
//     transaction_type TEXT DEFAULT 'debit',
//     debit REAL DEFAULT 0,
//     credit REAL DEFAULT 0,
//     description TEXT,
//     document_no TEXT,
//     created_at TEXT DEFAULT CURRENT_TIMESTAMP,
//     FOREIGN KEY (account_id) REFERENCES current_accounts(id)
//   )
// `);

// app.get("/api/current-account-transactions", (req, res) => {
//   const sql = `
//     SELECT 
//       t.*,
//       c.account_code,
//       c.company_name
//     FROM current_account_transactions t
//     LEFT JOIN current_accounts c ON c.id = t.account_id
//     ORDER BY t.id DESC
//   `;

//   db.all(sql, [], (err, rows) => {
//     if (err) {
//       return res.status(500).json({ success: false, message: err.message, transactions: [] });
//     }

//     res.json({
//       success: true,
//       transactions: rows.map(t => ({
//         id: t.id,
//         accountId: t.account_id,
//         accountCode: t.account_code,
//         companyName: t.company_name,
//         transactionDate: t.transaction_date,
//         transactionType: t.transaction_type,
//         debit: t.debit,
//         credit: t.credit,
//         description: t.description,
//         documentNo: t.document_no
//       }))
//     });
//   });
// });

// app.post("/api/current-account-transactions", (req, res) => {
//   const {
//     accountId,
//     transactionDate,
//     transactionType,
//     debit,
//     credit,
//     description,
//     documentNo
//   } = req.body;

//   if (!accountId || !transactionDate) {
//     return res.status(400).json({
//       success: false,
//       message: "Cari ve tarih zorunludur."
//     });
//   }

//   db.run(
//     `
//     INSERT INTO current_account_transactions
//     (
//       account_id,
//       transaction_date,
//       transaction_type,
//       debit,
//       credit,
//       description,
//       document_no
//     )
//     VALUES (?, ?, ?, ?, ?, ?, ?)
//     `,
//     [
//       accountId,
//       transactionDate,
//       transactionType || "debit",
//       Number(debit || 0),
//       Number(credit || 0),
//       description || "",
//       documentNo || ""
//     ],
//     function (err) {
//       if (err) {
//         return res.status(500).json({ success: false, message: err.message });
//       }

//       res.json({ success: true, id: this.lastID });
//     }
//   );
// });

// app.put("/api/current-account-transactions/:id", (req, res) => {
//   const {
//     accountId,
//     transactionDate,
//     transactionType,
//     debit,
//     credit,
//     description,
//     documentNo
//   } = req.body;

//   db.run(
//     `
//     UPDATE current_account_transactions SET
//       account_id = ?,
//       transaction_date = ?,
//       transaction_type = ?,
//       debit = ?,
//       credit = ?,
//       description = ?,
//       document_no = ?
//     WHERE id = ?
//     `,
//     [
//       accountId,
//       transactionDate,
//       transactionType || "debit",
//       Number(debit || 0),
//       Number(credit || 0),
//       description || "",
//       documentNo || "",
//       req.params.id
//     ],
//     function (err) {
//       if (err) {
//         return res.status(500).json({ success: false, message: err.message });
//       }

//       res.json({ success: true });
//     }
//   );
// });

// app.delete("/api/current-account-transactions/:id", (req, res) => {
//   db.run(
//     `DELETE FROM current_account_transactions WHERE id = ?`,
//     [req.params.id],
//     function (err) {
//       if (err) {
//         return res.status(500).json({ success: false, message: err.message });
//       }

//       res.json({ success: true });
//     }
//   );
// });

// // CARİ EKSTRE - Cari listesi
// app.get('/api/cari-ekstre/accounts', (req, res) => {
//   db.all(`
//     SELECT 
//       id,
//       accountCode,
//       companyName,
//       contactPerson,
//       phone,
//       email,
//       accountType,
//       status
//     FROM current_accounts
//     ORDER BY companyName ASC
//   `, [], (err, rows) => {
//     if (err) {
//       console.error("Cari listeleme hatası:", err.message);
//       return res.status(500).json({
//         success: false,
//         message: err.message,
//         accounts: []
//       });
//     }

//     res.json({
//       success: true,
//       accounts: rows
//     });
//   });
// });


// // CARİ EKSTRE - Hareketler
// app.get('/api/cari-ekstre/:accountId', (req, res) => {
//   const { accountId } = req.params;
//   const { startDate, endDate } = req.query;

//   let params = [accountId];
//   let dateFilter = "";

//   if (startDate) {
//     dateFilter += " AND date(transaction_date) >= date(?) ";
//     params.push(startDate);
//   }

//   if (endDate) {
//     dateFilter += " AND date(transaction_date) <= date(?) ";
//     params.push(endDate);
//   }

//   const sql = `
//     SELECT 
//       id,
//       account_id AS accountId,
//       transaction_date AS transactionDate,
//       transaction_type AS transactionType,
//       description,
//       debit,
//       credit,
//       document_no AS documentNo,
//       created_at
//     FROM current_account_transactions
//     WHERE account_id = ?
//     ${dateFilter}
//     ORDER BY date(transaction_date) ASC, id ASC
//   `;

//   db.all(sql, params, (err, rows) => {
//     if (err) {
//       console.error("Cari ekstre hatası:", err.message);
//       return res.status(500).json({
//         success: false,
//         message: err.message,
//         transactions: []
//       });
//     }

//     let balance = 0;

//     const transactions = rows.map(row => {
//       const debit = Number(row.debit || 0);
//       const credit = Number(row.credit || 0);

//       balance += debit - credit;

//       return {
//         ...row,
//         debit,
//         credit,
//         balance
//       };
//     });

//     const totalDebit = transactions.reduce((sum, x) => sum + Number(x.debit || 0), 0);
//     const totalCredit = transactions.reduce((sum, x) => sum + Number(x.credit || 0), 0);
//     const finalBalance = totalDebit - totalCredit;

//     res.json({
//       success: true,
//       transactions,
//       summary: {
//         totalDebit,
//         totalCredit,
//         finalBalance
//       }
//     });
//   });
// });

// // KASA LİSTELE
// app.get('/api/cash-accounts', (req, res) => {
//   db.all(`
//     SELECT 
//       id,
//       cash_code AS cashCode,
//       cash_name AS cashName,
//       currency,
//       opening_balance AS openingBalance,
//       status,
//       created_at
//     FROM cash_accounts
//     ORDER BY id DESC
//   `, [], (err, rows) => {
//     if (err) {
//       return res.status(500).json({ success:false, message:err.message, cashAccounts:[] });
//     }

//     res.json({ success:true, cashAccounts: rows });
//   });
// });


// // KASA EKLE
// app.post('/api/cash-accounts', (req, res) => {
//   const {
//     cashName,
//     currency,
//     openingBalance,
//     status
//   } = req.body;

//   if (!cashName) {
//     return res.status(400).json({ success:false, message:"Kasa adı zorunludur." });
//   }

//   const cashCode = "KASA" + Date.now();

//   db.run(`
//     INSERT INTO cash_accounts
//     (
//       cash_code,
//       cash_name,
//       currency,
//       opening_balance,
//       status
//     )
//     VALUES (?, ?, ?, ?, ?)
//   `, [
//     cashCode,
//     cashName,
//     currency || "TRY",
//     Number(openingBalance || 0),
//     status || "active"
//   ], function(err) {
//     if (err) {
//       return res.status(500).json({ success:false, message:err.message });
//     }

//     res.json({
//       success:true,
//       message:"Kasa başarıyla oluşturuldu.",
//       id:this.lastID
//     });
//   });
// });


// // KASA GÜNCELLE
// app.put('/api/cash-accounts/:id', (req, res) => {
//   const { id } = req.params;

//   const {
//     cashName,
//     currency,
//     openingBalance,
//     status
//   } = req.body;

//   db.run(`
//     UPDATE cash_accounts SET
//       cash_name = ?,
//       currency = ?,
//       opening_balance = ?,
//       status = ?
//     WHERE id = ?
//   `, [
//     cashName,
//     currency || "TRY",
//     Number(openingBalance || 0),
//     status || "active",
//     id
//   ], function(err) {
//     if (err) {
//       return res.status(500).json({ success:false, message:err.message });
//     }

//     res.json({ success:true, message:"Kasa güncellendi." });
//   });
// });


// // KASA SİL
// app.delete('/api/cash-accounts/:id', (req, res) => {
//   const { id } = req.params;

//   db.run(`DELETE FROM cash_accounts WHERE id = ?`, [id], function(err) {
//     if (err) {
//       return res.status(500).json({ success:false, message:err.message });
//     }

//     res.json({ success:true, message:"Kasa silindi." });
//   });
// });


// // KASA HAREKETLERİ LİSTELE
// app.get('/api/cash-transactions', (req, res) => {
//   db.all(`
//     SELECT
//       ct.id,
//       ct.cash_id AS cashId,
//       ca.cash_code AS cashCode,
//       ca.cash_name AS cashName,
//       ct.transaction_date AS transactionDate,
//       ct.transaction_type AS transactionType,
//       ct.amount,
//       ct.document_no AS documentNo,
//       ct.description,
//       ct.created_at
//     FROM cash_transactions ct
//     LEFT JOIN cash_accounts ca ON ca.id = ct.cash_id
//     ORDER BY date(ct.transaction_date) DESC, ct.id DESC
//   `, [], (err, rows) => {
//     if (err) {
//       return res.status(500).json({ success:false, message:err.message, transactions:[] });
//     }

//     res.json({ success:true, transactions: rows });
//   });
// });


// // KASA HAREKETİ EKLE
// app.post('/api/cash-transactions', (req, res) => {
//   const {
//     cashId,
//     transactionDate,
//     transactionType,
//     amount,
//     documentNo,
//     description
//   } = req.body;

//   if (!cashId || !transactionDate || !amount) {
//     return res.status(400).json({
//       success:false,
//       message:"Kasa, tarih ve tutar zorunludur."
//     });
//   }

//   db.run(`
//     INSERT INTO cash_transactions
//     (
//       cash_id,
//       transaction_date,
//       transaction_type,
//       amount,
//       document_no,
//       description
//     )
//     VALUES (?, ?, ?, ?, ?, ?)
//   `, [
//     cashId,
//     transactionDate,
//     transactionType || "income",
//     Number(amount || 0),
//     documentNo || "",
//     description || ""
//   ], function(err) {
//     if (err) {
//       return res.status(500).json({ success:false, message:err.message });
//     }

//     res.json({
//       success:true,
//       message:"Kasa hareketi kaydedildi.",
//       id:this.lastID
//     });
//   });
// });


// // KASA HAREKETİ SİL
// app.delete('/api/cash-transactions/:id', (req, res) => {
//   const { id } = req.params;

//   db.run(`DELETE FROM cash_transactions WHERE id = ?`, [id], function(err) {
//     if (err) {
//       return res.status(500).json({ success:false, message:err.message });
//     }

//     res.json({ success:true, message:"Kasa hareketi silindi." });
//   });
// });

// // KASA EKSTRE
// app.get('/api/cash-statement/:cashId', (req, res) => {
//   const { cashId } = req.params;
//   const { startDate, endDate } = req.query;

//   let params = [cashId];
//   let dateFilter = "";

//   if (startDate) {
//     dateFilter += " AND date(ct.transaction_date) >= date(?) ";
//     params.push(startDate);
//   }

//   if (endDate) {
//     dateFilter += " AND date(ct.transaction_date) <= date(?) ";
//     params.push(endDate);
//   }

//   const sql = `
//     SELECT
//       ct.id,
//       ct.cash_id AS cashId,
//       ca.cash_code AS cashCode,
//       ca.cash_name AS cashName,
//       ca.currency,
//       ct.transaction_date AS transactionDate,
//       ct.transaction_type AS transactionType,
//       ct.amount,
//       ct.document_no AS documentNo,
//       ct.description,
//       ct.created_at
//     FROM cash_transactions ct
//     LEFT JOIN cash_accounts ca ON ca.id = ct.cash_id
//     WHERE ct.cash_id = ?
//     ${dateFilter}
//     ORDER BY date(ct.transaction_date) ASC, ct.id ASC
//   `;

//   db.all(sql, params, (err, rows) => {
//     if (err) {
//       console.error("Kasa ekstre hatası:", err.message);
//       return res.status(500).json({
//         success: false,
//         message: err.message,
//         transactions: []
//       });
//     }

//     let balance = 0;

//     const transactions = rows.map(row => {
//       const amount = Number(row.amount || 0);

//       if (row.transactionType === "income") {
//         balance += amount;
//       } else {
//         balance -= amount;
//       }

//       return {
//         ...row,
//         income: row.transactionType === "income" ? amount : 0,
//         expense: row.transactionType === "expense" ? amount : 0,
//         balance
//       };
//     });

//     const totalIncome = transactions.reduce((sum, x) => sum + Number(x.income || 0), 0);
//     const totalExpense = transactions.reduce((sum, x) => sum + Number(x.expense || 0), 0);
//     const finalBalance = totalIncome - totalExpense;

//     res.json({
//       success: true,
//       transactions,
//       summary: {
//         totalIncome,
//         totalExpense,
//         finalBalance
//       }
//     });
//   });
// });

// app.get('/api/bank-accounts', (req, res) => {
//   db.all(`
//     SELECT
//       id,
//       bank_code AS bankCode,
//       bank_name AS bankName,
//       branch_name AS branchName,
//       iban,
//       account_no AS accountNo,
//       currency,
//       opening_balance AS openingBalance,
//       status,
//       created_at
//     FROM bank_accounts
//     ORDER BY id DESC
//   `, [], (err, rows) => {
//     if (err) {
//       return res.status(500).json({
//         success: false,
//         message: err.message,
//         bankAccounts: []
//       });
//     }

//     res.json({
//       success: true,
//       bankAccounts: rows
//     });
//   });
// });


// // BANKA KARTI EKLE
// app.post('/api/bank-accounts', (req, res) => {
//   const {
//     bankName,
//     branchName,
//     iban,
//     accountNo,
//     currency,
//     openingBalance,
//     status
//   } = req.body;

//   if (!bankName) {
//     return res.status(400).json({
//       success: false,
//       message: "Banka adı zorunludur."
//     });
//   }

//   const bankCode = "BANK" + Date.now();

//   db.run(`
//     INSERT INTO bank_accounts
//     (
//       bank_code,
//       bank_name,
//       branch_name,
//       iban,
//       account_no,
//       currency,
//       opening_balance,
//       status
//     )
//     VALUES (?, ?, ?, ?, ?, ?, ?, ?)
//   `, [
//     bankCode,
//     bankName,
//     branchName || "",
//     iban || "",
//     accountNo || "",
//     currency || "TRY",
//     Number(openingBalance || 0),
//     status || "active"
//   ], function(err) {
//     if (err) {
//       return res.status(500).json({
//         success: false,
//         message: err.message
//       });
//     }

//     res.json({
//       success: true,
//       message: "Banka kartı başarıyla oluşturuldu.",
//       id: this.lastID
//     });
//   });
// });


// // BANKA KARTI GÜNCELLE
// app.put('/api/bank-accounts/:id', (req, res) => {
//   const { id } = req.params;

//   const {
//     bankName,
//     branchName,
//     iban,
//     accountNo,
//     currency,
//     openingBalance,
//     status
//   } = req.body;

//   db.run(`
//     UPDATE bank_accounts SET
//       bank_name = ?,
//       branch_name = ?,
//       iban = ?,
//       account_no = ?,
//       currency = ?,
//       opening_balance = ?,
//       status = ?
//     WHERE id = ?
//   `, [
//     bankName,
//     branchName || "",
//     iban || "",
//     accountNo || "",
//     currency || "TRY",
//     Number(openingBalance || 0),
//     status || "active",
//     id
//   ], function(err) {
//     if (err) {
//       return res.status(500).json({
//         success: false,
//         message: err.message
//       });
//     }

//     res.json({
//       success: true,
//       message: "Banka kartı güncellendi."
//     });
//   });
// });


// // BANKA KARTI SİL
// app.delete('/api/bank-accounts/:id', (req, res) => {
//   const { id } = req.params;

//   db.run(`DELETE FROM bank_accounts WHERE id = ?`, [id], function(err) {
//     if (err) {
//       return res.status(500).json({
//         success: false,
//         message: err.message
//       });
//     }

//     res.json({
//       success: true,
//       message: "Banka kartı silindi."
//     });
//   });
// });


// // BANKA HAREKETLERİ LİSTELE
// app.get('/api/bank-transactions', (req, res) => {
//   db.all(`
//     SELECT
//       bt.id,
//       bt.bank_id AS bankId,
//       ba.bank_code AS bankCode,
//       ba.bank_name AS bankName,
//       ba.branch_name AS branchName,
//       ba.currency,
//       bt.transaction_date AS transactionDate,
//       bt.transaction_type AS transactionType,
//       bt.amount,
//       bt.document_no AS documentNo,
//       bt.description,
//       bt.created_at
//     FROM bank_transactions bt
//     LEFT JOIN bank_accounts ba ON ba.id = bt.bank_id
//     ORDER BY date(bt.transaction_date) DESC, bt.id DESC
//   `, [], (err, rows) => {
//     if (err) {
//       return res.status(500).json({
//         success: false,
//         message: err.message,
//         transactions: []
//       });
//     }

//     res.json({
//       success: true,
//       transactions: rows
//     });
//   });
// });


// // BANKA HAREKETİ EKLE
// app.post('/api/bank-transactions', (req, res) => {
//   const {
//     bankId,
//     transactionDate,
//     transactionType,
//     amount,
//     documentNo,
//     description
//   } = req.body;

//   if (!bankId || !transactionDate || !amount) {
//     return res.status(400).json({
//       success: false,
//       message: "Banka, tarih ve tutar zorunludur."
//     });
//   }

//   db.run(`
//     INSERT INTO bank_transactions
//     (
//       bank_id,
//       transaction_date,
//       transaction_type,
//       amount,
//       document_no,
//       description
//     )
//     VALUES (?, ?, ?, ?, ?, ?)
//   `, [
//     bankId,
//     transactionDate,
//     transactionType || "income",
//     Number(amount || 0),
//     documentNo || "",
//     description || ""
//   ], function(err) {
//     if (err) {
//       return res.status(500).json({
//         success: false,
//         message: err.message
//       });
//     }

//     res.json({
//       success: true,
//       message: "Banka hareketi kaydedildi.",
//       id: this.lastID
//     });
//   });
// });


// // BANKA HAREKETİ SİL
// app.delete('/api/bank-transactions/:id', (req, res) => {
//   const { id } = req.params;

//   db.run(`DELETE FROM bank_transactions WHERE id = ?`, [id], function(err) {
//     if (err) {
//       return res.status(500).json({
//         success: false,
//         message: err.message
//       });
//     }

//     res.json({
//       success: true,
//       message: "Banka hareketi silindi."
//     });
//   });
// });


// // BANKA EKSTRE
// app.get('/api/bank-statement/:bankId', (req, res) => {
//   const { bankId } = req.params;
//   const { startDate, endDate } = req.query;

//   let params = [bankId];
//   let dateFilter = "";

//   if (startDate) {
//     dateFilter += " AND date(bt.transaction_date) >= date(?) ";
//     params.push(startDate);
//   }

//   if (endDate) {
//     dateFilter += " AND date(bt.transaction_date) <= date(?) ";
//     params.push(endDate);
//   }

//   const sql = `
//     SELECT
//       bt.id,
//       bt.bank_id AS bankId,
//       ba.bank_code AS bankCode,
//       ba.bank_name AS bankName,
//       ba.branch_name AS branchName,
//       ba.currency,
//       bt.transaction_date AS transactionDate,
//       bt.transaction_type AS transactionType,
//       bt.amount,
//       bt.document_no AS documentNo,
//       bt.description,
//       bt.created_at
//     FROM bank_transactions bt
//     LEFT JOIN bank_accounts ba ON ba.id = bt.bank_id
//     WHERE bt.bank_id = ?
//     ${dateFilter}
//     ORDER BY date(bt.transaction_date) ASC, bt.id ASC
//   `;

//   db.all(sql, params, (err, rows) => {
//     if (err) {
//       console.error("Banka ekstre hatası:", err.message);
//       return res.status(500).json({
//         success: false,
//         message: err.message,
//         transactions: []
//       });
//     }

//     let balance = 0;

//     const transactions = rows.map(row => {
//       const amount = Number(row.amount || 0);

//       if (row.transactionType === "income") {
//         balance += amount;
//       } else {
//         balance -= amount;
//       }

//       return {
//         ...row,
//         income: row.transactionType === "income" ? amount : 0,
//         expense: row.transactionType === "expense" ? amount : 0,
//         balance
//       };
//     });

//     const totalIncome = transactions.reduce((sum, x) => sum + Number(x.income || 0), 0);
//     const totalExpense = transactions.reduce((sum, x) => sum + Number(x.expense || 0), 0);
//     const finalBalance = totalIncome - totalExpense;

//     res.json({
//       success: true,
//       transactions,
//       summary: {
//         totalIncome,
//         totalExpense,
//         finalBalance
//       }
//     });
//   });
// });

// app.get('/api/bank-accounts', (req, res) => {
//   res.json({
//     success: true,
//     bankAccounts: []
//   });
// });

// app.put("/api/bom/:id", (req, res) => {
//   const id = req.params.id;

//   const {
//     product_id,
//     material_id,
//     quantity_per_unit,
//     unit,
//     description
//   } = req.body;

//   db.run(
//     `
//     UPDATE product_bom
//     SET 
//       product_id = ?,
//       material_id = ?,
//       quantity_per_unit = ?,
//       unit = ?,
//       description = ?
//     WHERE id = ?
//     `,
//     [
//       product_id,
//       material_id,
//       quantity_per_unit,
//       unit || "adet",
//       description || "",
//       id
//     ],
//     function (err) {
//       if (err) {
//         console.error("BOM güncelleme hatası:", err.message);
//         return res.status(500).json({
//           success: false,
//           message: err.message
//         });
//       }

//       res.json({
//         success: true,
//         message: "Reçete satırı güncellendi."
//       });
//     }
//   );
// });

// app.delete("/api/bom/:id", (req, res) => {
//   const id = req.params.id;

//   db.run(
//     `DELETE FROM product_bom WHERE id = ?`,
//     [id],
//     function (err) {
//       if (err) {
//         console.error("BOM silme hatası:", err.message);
//         return res.status(500).json({
//           success: false,
//           message: err.message
//         });
//       }

//       res.json({
//         success: true,
//         message: "Reçete satırı silindi."
//       });
//     }
//   );
// });
// // Ürün reçetesi ekle
// app.post("/api/bom", (req, res) => {
//   const {
//     product_id,
//     material_id,
//     quantity_per_unit,
//     unit,
//     description
//   } = req.body;

//   if (!product_id || !material_id || !quantity_per_unit) {
//     return res.status(400).json({
//       success: false,
//       message: "Ürün, malzeme ve birim ihtiyaç zorunlu."
//     });
//   }

//   db.run(
//     `
//     INSERT INTO product_bom
//     (
//       product_id,
//       material_id,
//       quantity_per_unit,
//       unit,
//       description
//     )
//     VALUES (?, ?, ?, ?, ?)
//     `,
//     [
//       product_id,
//       material_id,
//       quantity_per_unit,
//       unit || "adet",
//       description || ""
//     ],
//     function (err) {
//       if (err) {
//         console.error("BOM ekleme hatası:", err.message);
//         return res.status(500).json({
//           success: false,
//           message: err.message
//         });
//       }

//       res.json({
//         success: true,
//         message: "Reçete satırı eklendi.",
//         id: this.lastID
//       });
//     }
//   );
// });

// // Ürün reçetesi listele
// app.get("/api/bom/:productId", (req, res) => {
//   const productId = req.params.productId;

//   db.all(
//     `
//     SELECT 
//       b.id,
//       b.product_id,
//       b.material_id,
//       b.quantity_per_unit,
//       b.unit,
//       b.description,
//       b.created_at,

//       p.part_name AS product_name,
//       p.stock_code AS product_stock_code,

//       s.part_name AS material_name,
//       s.stock_code AS stock_code,
//       s.quantity AS stock_qty

//     FROM product_bom b
//     LEFT JOIN stocks p ON p.id = b.product_id
//     LEFT JOIN stocks s ON s.id = b.material_id
//     WHERE b.product_id = ?
//     ORDER BY b.id DESC
//     `,
//     [productId],
//     (err, rows) => {
//       if (err) {
//         console.error("BOM listeleme hatası:", err.message);
//         return res.status(500).json({
//           success: false,
//           message: err.message
//         });
//       }

//       res.json({
//         success: true,
//         bom: rows
//       });
//     }
//   );
// });

// // SATIN ALMA TALEBİ ONAYLA
// app.put("/api/purchase-requests/:id/approve", (req, res) => {
//   const requestId = req.params.id;
//   const { approvedBy } = req.body;

//   db.run(
//     `
//     UPDATE purchase_requests
//     SET 
//       approval_status = 'approved',
//       approved_by = ?,
//       approved_at = datetime('now')
//     WHERE id = ?
//     `,
//     [approvedBy || "Admin", requestId],
//     function (err) {
//       if (err) {
//         console.error("Satın alma talep onay hatası:", err);
//         return res.status(500).json({
//           success: false,
//           message: err.message
//         });
//       }

//       db.run(
//         `
//         INSERT INTO purchase_approvals
//         (request_id, status, approved_by, approved_at)
//         VALUES (?, 'approved', ?, datetime('now'))
//         `,
//         [requestId, approvedBy || "Admin"]
//       );

//       res.json({
//         success: true,
//         message: "Satın alma talebi onaylandı."
//       });
//     }
//   );
// });

// // SATIN ALMA TALEBİ REDDET
// app.put("/api/purchase-requests/:id/reject", (req, res) => {
//   const requestId = req.params.id;
//   const { rejectedBy, reason } = req.body;

//   db.run(
//     `
//     UPDATE purchase_requests
//     SET 
//       approval_status = 'rejected',
//       approved_by = ?,
//       approved_at = datetime('now')
//     WHERE id = ?
//     `,
//     [rejectedBy || "Admin", requestId],
//     function (err) {
//       if (err) {
//         console.error("Satın alma talep red hatası:", err);
//         return res.status(500).json({
//           success: false,
//           message: err.message
//         });
//       }

//       db.run(
//         `
//         INSERT INTO purchase_approvals
//         (request_id, status, approved_by, approved_at, reject_reason)
//         VALUES (?, 'rejected', ?, datetime('now'), ?)
//         `,
//         [requestId, rejectedBy || "Admin", reason || ""]
//       );

//       res.json({
//         success: true,
//         message: "Satın alma talebi reddedildi."
//       });
//     }
//   );
// });

// app.put("/api/purchase-requests/:id/status", (req, res) => {
//   const { id } = req.params;
//   const { status, note, approved_by } = req.body;

//   if (!status) {
//     return res.status(400).json({
//       success: false,
//       message: "Durum zorunlu."
//     });
//   }

//   db.run(
//     `
//     UPDATE purchase_requests
//     SET status = ?
//     WHERE id = ?
//     `,
//     [status, id],
//     function (err) {
//       if (err) {
//         console.error("Talep durum güncelleme hatası:", err.message);
//         return res.status(500).json({
//           success: false,
//           message: err.message
//         });
//       }

//       db.run(
//         `
//         INSERT INTO purchase_approvals
//         (
//           approval_type,
//           document_id,
//           status,
//           note,
//           approved_by,
//           approved_at
//         )
//         VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
//         `,
//         [
//           "request",
//           id,
//           status,
//           note || "",
//           approved_by || ""
//         ]
//       );

//       res.json({
//         success: true,
//         message: "Satın alma talebi durumu güncellendi."
//       });
//     }
//   );
// });

// app.delete("/api/purchase-requests/:id", (req, res) => {
//   const { id } = req.params;

//   db.run(
//     `DELETE FROM purchase_requests WHERE id = ?`,
//     [id],
//     function (err) {
//       if (err) {
//         console.error("Satın alma talebi silme hatası:", err.message);
//         return res.status(500).json({
//           success: false,
//           message: err.message
//         });
//       }

//       res.json({
//         success: true,
//         message: "Satın alma talebi silindi."
//       });
//     }
//   );
// });

// app.get("/api/purchase-orders", (req, res) => {
//   db.all(
//     `
//     SELECT
//       po.id,
//       po.order_no,
//       po.purchase_request_id,
//       po.supplier_id,
//       po.material_id,
//       po.quantity,
//       po.unit,
//       po.unit_price,
//       po.total_amount,
//       po.delivery_date,
//       po.note,
//       po.status,
//       po.created_at,

//       pr.request_no,
//       s.stock_code,
//       s.part_name AS material_name,

//       sup.company_name AS supplier_name

//     FROM purchase_orders po
//     LEFT JOIN purchase_requests pr ON pr.id = po.purchase_request_id
//     LEFT JOIN stocks s ON s.id = po.material_id
//     LEFT JOIN suppliers sup ON sup.id = po.supplier_id
//     ORDER BY po.id DESC
//     `,
//     [],
//     (err, rows) => {
//       if (err) {
//         console.error("Satın alma sipariş listeleme hatası:", err.message);
//         return res.status(500).json({
//           success: false,
//           message: err.message
//         });
//       }

//       res.json({
//         success: true,
//         orders: rows
//       });
//     }
//   );
// });


// app.post("/api/purchase-orders", (req, res) => {
//   const {
//     order_no,
//     purchase_request_id,
//     supplier_id,
//     quantity,
//     unit,
//     unit_price,
//     total_amount,
//     delivery_date,
//     note,
//     status
//   } = req.body;

//   if (!purchase_request_id || !supplier_id || !quantity) {
//     return res.status(400).json({
//       success: false,
//       message: "Talep, tedarikçi ve miktar zorunlu."
//     });
//   }

//   db.get(
//     `
//     SELECT material_id
//     FROM purchase_requests
//     WHERE id = ?
//     `,
//     [purchase_request_id],
//     (err, request) => {
//       if (err) {
//         console.error("Talep getirme hatası:", err.message);
//         return res.status(500).json({
//           success: false,
//           message: err.message
//         });
//       }

//       if (!request) {
//         return res.status(404).json({
//           success: false,
//           message: "Satın alma talebi bulunamadı."
//         });
//       }

//       const finalOrderNo = order_no || "SAS" + Date.now();

//       db.run(
//         `
//         INSERT INTO purchase_orders
//         (
//           order_no,
//           purchase_request_id,
//           supplier_id,
//           material_id,
//           quantity,
//           unit,
//           unit_price,
//           total_amount,
//           delivery_date,
//           note,
//           status
//         )
//         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
//         `,
//         [
//           finalOrderNo,
//           purchase_request_id,
//           supplier_id,
//           request.material_id,
//           quantity,
//           unit || "adet",
//           unit_price || 0,
//           total_amount || Number(quantity || 0) * Number(unit_price || 0),
//           delivery_date || "",
//           note || "",
//           status || "open"
//         ],
//         function (err) {
//           if (err) {
//             console.error("Satın alma sipariş oluşturma hatası:", err.message);
//             return res.status(500).json({
//               success: false,
//               message: err.message
//             });
//           }

//           db.run(
//             `
//             UPDATE purchase_requests
//             SET status = 'ordered'
//             WHERE id = ?
//             `,
//             [purchase_request_id]
//           );

//           res.json({
//             success: true,
//             message: "Satın alma siparişi oluşturuldu.",
//             id: this.lastID
//           });
//         }
//       );
//     }
//   );
// });

// app.put("/api/purchase-orders/:id/status", (req, res) => {
//   const { id } = req.params;
//   const { status, note, approved_by } = req.body;

//   if (!status) {
//     return res.status(400).json({
//       success: false,
//       message: "Durum zorunlu."
//     });
//   }

//   db.run(
//     `
//     UPDATE purchase_orders
//     SET status = ?
//     WHERE id = ?
//     `,
//     [status, id],
//     function (err) {
//       if (err) {
//         console.error("Sipariş durum güncelleme hatası:", err.message);
//         return res.status(500).json({
//           success: false,
//           message: err.message
//         });
//       }

//       db.run(
//         `
//         INSERT INTO purchase_approvals
//         (
//           approval_type,
//           document_id,
//           status,
//           note,
//           approved_by,
//           approved_at
//         )
//         VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
//         `,
//         [
//           "order",
//           id,
//           status,
//           note || "",
//           approved_by || ""
//         ]
//       );

//       res.json({
//         success: true,
//         message: "Satın alma siparişi durumu güncellendi."
//       });
//     }
//   );
// });

// app.delete("/api/purchase-orders/:id", (req, res) => {
//   const { id } = req.params;

//   db.run(
//     `DELETE FROM purchase_orders WHERE id = ?`,
//     [id],
//     function (err) {
//       if (err) {
//         console.error("Satın alma siparişi silme hatası:", err.message);
//         return res.status(500).json({
//           success: false,
//           message: err.message
//         });
//       }

//       res.json({
//         success: true,
//         message: "Satın alma siparişi silindi."
//       });
//     }
//   );
// });
// function addColumnIfMissing(tableName, columnName, columnDefinition) {
//   db.all(`PRAGMA table_info(${tableName})`, [], (err, columns) => {
//     if (err) {
//       console.error(`${tableName} kolon kontrol hatası:`, err.message);
//       return;
//     }

//     const exists = columns.some(col => col.name === columnName);

//     if (!exists) {
//       db.run(
//         `ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${columnDefinition}`,
//         (alterErr) => {
//           if (alterErr) {
//             console.error(`${tableName}.${columnName} ekleme hatası:`, alterErr.message);
//           } else {
//             console.log(`${tableName}.${columnName} eklendi.`);
//           }
//         }
//       );
//     }
//   });
// }
// // MRP hesapla
// app.post("/api/mrp/calculate", (req, res) => {
//   const { work_order_id } = req.body;

//   if (!work_order_id) {
//     return res.status(400).json({
//       success: false,
//       message: "İş emri zorunlu"
//     });
//   }

//   db.get(
//     `SELECT * FROM work_orders WHERE id = ?`,
//     [work_order_id],
//     (err, workOrder) => {
//       if (err) {
//         console.error("İş emri sorgu hatası:", err);
//         return res.status(500).json({
//           success: false,
//           message: err.message
//         });
//       }

//       if (!workOrder) {
//         return res.status(404).json({
//           success: false,
//           message: "İş emri bulunamadı"
//         });
//       }

//       return res.json({
//         success: true,
//         results: []
//       });
//     }
//   );
// });


// app.get("/api/production/work-orders", (req, res) => {
//   db.all(`
//     SELECT 
//       wo.*,
//       IFNULL(SUM(pr.produced_qty), 0) AS total_produced,
//       IFNULL(SUM(pr.scrap_qty), 0) AS total_scrap
//     FROM work_orders wo
//     LEFT JOIN production_records pr ON pr.work_order_id = wo.id
//     GROUP BY wo.id
//     ORDER BY wo.id DESC
//   `, [], (err, rows) => {
//     if (err) {
//       console.error("Üretim iş emirleri hatası:", err);
//       return res.status(500).json({ success: false, message: err.message });
//     }

//     res.json({ success: true, workOrders: rows });
//   });
// });

// app.get("/api/production/records/:workOrderId", (req, res) => {
//   const { workOrderId } = req.params;

//   db.all(`
//     SELECT *
//     FROM production_records
//     WHERE work_order_id = ?
//     ORDER BY id DESC
//   `, [workOrderId], (err, rows) => {
//     if (err) {
//       console.error("Üretim kayıtları hatası:", err);
//       return res.status(500).json({ success: false, message: err.message });
//     }

//     res.json({ success: true, records: rows });
//   });
// });

// app.post("/api/production/records", (req, res) => {
//   const {
//     work_order_id,
//     operation_name,
//     produced_qty,
//     scrap_qty,
//     downtime_min,
//     operator_name,
//     note
//   } = req.body;

//   if (!work_order_id) {
//     return res.status(400).json({
//       success: false,
//       message: "İş emri zorunlu"
//     });
//   }

//   if (!produced_qty && !scrap_qty) {
//     return res.status(400).json({
//       success: false,
//       message: "Üretilen veya hurda miktarı girilmeli"
//     });
//   }

//   db.run(`
//     INSERT INTO production_records
//     (
//       work_order_id,
//       operation_name,
//       produced_qty,
//       scrap_qty,
//       downtime_min,
//       operator_name,
//       note
//     )
//     VALUES (?, ?, ?, ?, ?, ?, ?)
//   `, [
//     work_order_id,
//     operation_name || "",
//     Number(produced_qty || 0),
//     Number(scrap_qty || 0),
//     Number(downtime_min || 0),
//     operator_name || "",
//     note || ""
//   ], function(err) {
//     if (err) {
//       console.error("Üretim kaydı ekleme hatası:", err);
//       return res.status(500).json({ success: false, message: err.message });
//     }

//     res.json({
//       success: true,
//       message: "Üretim kaydı başarıyla eklendi",
//       id: this.lastID
//     });
//   });
// });

// app.delete("/api/production/records/:id", (req, res) => {
//   const { id } = req.params;

//   db.run(`DELETE FROM production_records WHERE id = ?`, [id], function(err) {
//     if (err) {
//       console.error("Üretim kaydı silme hatası:", err);
//       return res.status(500).json({ success: false, message: err.message });
//     }

//     res.json({
//       success: true,
//       message: "Üretim kaydı silindi"
//     });
//   });
// });

// app.get("/api/quality/work-orders", (req, res) => {
//   db.all(
//     `
//     SELECT *
//     FROM work_orders
//     ORDER BY id DESC
//     `,
//     [],
//     (err, rows) => {
//       if (err) {
//         console.error("Kalite iş emirleri hatası:", err.message);
//         return res.status(500).json({
//           success: false,
//           message: err.message
//         });
//       }

//       res.json({
//         success: true,
//         workOrders: rows
//       });
//     }
//   );
// });

// app.get("/api/shipments/work-orders", (req, res) => {
//   db.all(
//     `
//     SELECT *
//     FROM work_orders
//     ORDER BY id DESC
//     `,
//     [],
//     (err, rows) => {
//       if (err) {
//         console.error("Sevkiyat iş emirleri hatası:", err.message);
//         return res.status(500).json({
//           success: false,
//           message: err.message
//         });
//       }

//       res.json({
//         success: true,
//         workOrders: rows
//       });
//     }
//   );
// });

// app.get("/api/shipments/customers", (req, res) => {
//   db.all(
//     `
//     SELECT *
//     FROM customers
//     ORDER BY id DESC
//     `,
//     [],
//     (err, rows) => {
//       if (err) {
//         console.error("Sevkiyat müşteri liste hatası:", err.message);
//         return res.status(500).json({
//           success: false,
//           message: err.message
//         });
//       }

//       res.json({
//         success: true,
//         customers: rows
//       });
//     }
//   );
// });

// app.get("/api/shipments", (req, res) => {
//   db.all(
//     `
//     SELECT *
//     FROM shipments
//     ORDER BY id DESC
//     `,
//     [],
//     (err, rows) => {
//       if (err) {
//         console.error("Sevkiyat listeleme hatası:", err.message);
//         return res.status(500).json({
//           success: false,
//           message: err.message
//         });
//       }

//       res.json({
//         success: true,
//         shipments: rows
//       });
//     }
//   );
// });

// app.get("/api/shipments", (req, res) => {
//   db.all(
//     `
//     SELECT 
//       s.*
//     FROM shipments s
//     ORDER BY s.id DESC
//     `,
//     [],
//     (err, rows) => {
//       if (err) {
//         console.error("Sevkiyat listeleme hatası:", err.message);
//         return res.status(500).json({
//           success: false,
//           message: err.message
//         });
//       }

//       res.json({
//         success: true,
//         shipments: rows
//       });
//     }
//   );
// });

// app.post("/api/shipments", (req, res) => {
//   const {
//     shipment_no,
//     work_order_id,
//     customer_id,
//     shipment_date,
//     delivery_note_no,
//     shipped_qty,
//     vehicle_plate,
//     driver_name,
//     delivery_status,
//     note
//   } = req.body;

//   if (!work_order_id) {
//     return res.status(400).json({
//       success: false,
//       message: "İş emri zorunludur."
//     });
//   }

//   const shipmentNo = shipment_no || "SVK" + Date.now();

//   db.run(
//     `
//     INSERT INTO shipments
//     (
//       shipment_no,
//       work_order_id,
//       customer_id,
//       shipment_date,
//       delivery_note_no,
//       shipped_qty,
//       vehicle_plate,
//       driver_name,
//       delivery_status,
//       note
//     )
//     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
//     `,
//     [
//       shipmentNo,
//       work_order_id,
//       customer_id || null,
//       shipment_date || new Date().toISOString().split("T")[0],
//       delivery_note_no || "",
//       shipped_qty || 0,
//       vehicle_plate || "",
//       driver_name || "",
//       delivery_status || "prepared",
//       note || ""
//     ],
//     function (err) {
//       if (err) {
//         console.error("Sevkiyat ekleme hatası:", err.message);
//         return res.status(500).json({
//           success: false,
//           message: err.message
//         });
//       }

//       res.json({
//         success: true,
//         message: "Sevkiyat kaydı oluşturuldu.",
//         id: this.lastID
//       });
//     }
//   );
// });

// app.put("/api/shipments/:id/status", (req, res) => {
//   const { id } = req.params;
//   const { delivery_status } = req.body;

//   db.run(
//     `
//     UPDATE shipments
//     SET delivery_status = ?
//     WHERE id = ?
//     `,
//     [delivery_status || "prepared", id],
//     function (err) {
//       if (err) {
//         console.error("Sevkiyat durum güncelleme hatası:", err.message);
//         return res.status(500).json({
//           success: false,
//           message: err.message
//         });
//       }

//       res.json({
//         success: true,
//         message: "Sevkiyat durumu güncellendi."
//       });
//     }
//   );
// });

// app.delete("/api/shipments/:id", (req, res) => {
//   const { id } = req.params;

//   db.run(
//     `
//     DELETE FROM shipments
//     WHERE id = ?
//     `,
//     [id],
//     function (err) {
//       if (err) {
//         console.error("Sevkiyat silme hatası:", err.message);
//         return res.status(500).json({
//           success: false,
//           message: err.message
//         });
//       }

//       res.json({
//         success: true,
//         message: "Sevkiyat kaydı silindi."
//       });
//     }
//   );
// });

// app.get("/api/quality/records/:workOrderId", (req, res) => {
//   const workOrderId = req.params.workOrderId;

//   db.all(
//     `
//     SELECT *
//     FROM quality_controls
//     WHERE work_order_id = ?
//     ORDER BY id DESC
//     `,
//     [workOrderId],
//     (err, rows) => {
//       if (err) {
//         console.error("Kalite kayıtları listeleme hatası:", err.message);
//         return res.status(500).json({
//           success: false,
//           message: err.message
//         });
//       }

//       res.json({
//         success: true,
//         records: rows
//       });
//     }
//   );
// });

// app.post("/api/quality/records", (req, res) => {
//   const {
//     work_order_id,
//     control_date,
//     checked_qty,
//     accepted_qty,
//     rejected_qty,
//     defect_reason,
//     measurement_note,
//     inspector_name,
//     status
//   } = req.body;

//   if (!work_order_id) {
//     return res.status(400).json({
//       success: false,
//       message: "İş emri zorunludur."
//     });
//   }

//   db.run(
//     `
//     INSERT INTO quality_controls
//     (
//       work_order_id,
//       control_date,
//       checked_qty,
//       accepted_qty,
//       rejected_qty,
//       defect_reason,
//       measurement_note,
//       inspector_name,
//       status
//     )
//     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
//     `,
//     [
//       work_order_id,
//       control_date || new Date().toISOString().split("T")[0],
//       checked_qty || 0,
//       accepted_qty || 0,
//       rejected_qty || 0,
//       defect_reason || "",
//       measurement_note || "",
//       inspector_name || "",
//       status || "pending"
//     ],
//     function (err) {
//       if (err) {
//         console.error("Kalite kaydı ekleme hatası:", err.message);
//         return res.status(500).json({
//           success: false,
//           message: err.message
//         });
//       }

//       res.json({
//         success: true,
//         message: "Kalite kontrol kaydı eklendi.",
//         id: this.lastID
//       });
//     }
//   );
// });

// app.delete("/api/quality/records/:id", (req, res) => {
//   const id = req.params.id;

//   db.run(
//     `DELETE FROM quality_controls WHERE id = ?`,
//     [id],
//     function (err) {
//       if (err) {
//         console.error("Kalite kaydı silme hatası:", err.message);
//         return res.status(500).json({
//           success: false,
//           message: err.message
//         });
//       }

//       res.json({
//         success: true,
//         message: "Kalite kaydı silindi."
//       });
//     }
//   );
// });
// app.post("/api/mrp/create-purchase-requests", (req, res) => {
//   const { work_order_id } = req.body;

//   if (!work_order_id) {
//     return res.status(400).json({ success: false, message: "İş emri zorunlu." });
//   }

//   db.all(
//     `
//     SELECT r.*, b.unit
//     FROM mrp_results r
//     LEFT JOIN product_bom b 
//       ON b.product_id = r.product_id 
//       AND b.material_id = r.material_id
//     WHERE r.work_order_id = ?
//       AND r.shortage_qty > 0
//     `,
//     [work_order_id],
//     (err, rows) => {
//       if (err) return res.status(500).json({ success: false, message: err.message });

//       if (!rows.length) {
//         return res.json({
//           success: true,
//           message: "Eksik malzeme yok. Satın alma talebi oluşturulmadı."
//         });
//       }

//       rows.forEach(row => {
//         const requestNo = "SAT" + Date.now() + Math.floor(Math.random() * 999);

//         db.run(
//           `
//           INSERT INTO purchase_requests
//           (request_no, material_id, quantity, unit, source_type, work_order_id, status)
//           VALUES (?, ?, ?, ?, 'MRP', ?, 'pending')
//           `,
//           [
//             requestNo,
//             row.material_id,
//             row.shortage_qty,
//             row.unit || "adet",
//             work_order_id
//           ]
//         );
//       });

//       res.json({
//         success: true,
//         message: `${rows.length} adet satın alma talebi oluşturuldu.`
//       });
//     }
//   );
// });
// app.get("/api/mrp/results/:workOrderId", (req, res) => {
//   const workOrderId = req.params.workOrderId;

//   db.all(
//     `
//     SELECT 
//       r.id,
//       r.work_order_id,
//       r.product_id,
//       r.material_id,
//       s.name AS material_name,
//       s.stock_code,
//       r.required_qty,
//       r.stock_qty,
//       r.shortage_qty,
//       r.status,
//       r.created_at
//     FROM mrp_results r
//     LEFT JOIN stocks s ON s.id = r.material_id
//     WHERE r.work_order_id = ?
//     ORDER BY r.id DESC
//     `,
//     [workOrderId],
//     (err, rows) => {
//       if (err) {
//         console.error("MRP sonuç listeleme hatası:", err.message);
//         return res.status(500).json({
//           success: false,
//           message: err.message
//         });
//       }

//       res.json({
//         success: true,
//         results: rows
//       });
//     }
//   );
// });

// app.put("/api/production-tracking/:id", (req, res) => {
//   const {
//     workOrderNo,
//     operationName,
//     machineId,
//     operatorName,
//     startDatetime,
//     endDatetime,
//     progress,
//     status,
//     description
//   } = req.body;

//   db.run(
//     `
//     UPDATE production_tracking SET
//       work_order_no = ?,
//       operation_name = ?,
//       machine_id = ?,
//       operator_name = ?,
//       start_datetime = ?,
//       end_datetime = ?,
//       progress = ?,
//       status = ?,
//       description = ?
//     WHERE id = ?
//     `,
//     [
//       workOrderNo,
//       operationName,
//       machineId || null,
//       operatorName,
//       startDatetime,
//       endDatetime,
//       Number(progress || 0),
//       status || "waiting",
//       description,
//       req.params.id
//     ],
//     function (err) {
//       if (err) {
//         return res.status(500).json({
//           success: false,
//           message: err.message
//         });
//       }

//       res.json({ success: true });
//     }
//   );
// });
// app.delete("/api/production-tracking/:id", (req, res) => {
//   db.run(
//     "DELETE FROM production_tracking WHERE id = ?",
//     [req.params.id],
//     function (err) {
//       if (err) {
//         return res.status(500).json({
//           success: false,
//           message: err.message
//         });
//       }

//       res.json({ success: true });
//     }
//   );
// });
// // ===============================
// // SATIN ALMA SİPARİŞLERİ
// // ===============================

// app.get("/api/purchase-orders", (req, res) => {
//   const sql = `
//     SELECT 
//       po.*,
//       s.company_name
//     FROM purchase_orders po
//     LEFT JOIN suppliers s ON s.id = po.supplier_id
//     ORDER BY po.id DESC
//   `;

//   db.all(sql, [], (err, rows) => {
//     if (err) {
//       return res.status(500).json({ success: false, message: err.message, orders: [] });
//     }

//     res.json({
//       success: true,
//       orders: rows.map(o => ({
//         id: o.id,
//         orderNo: o.order_no,
//         supplierId: o.supplier_id,
//         supplierName: o.company_name,
//         orderDate: o.order_date,
//         deliveryDate: o.delivery_date,
//         status: o.status
//       }))
//     });
//   });
// });

// app.post("/api/purchase-orders", (req, res) => {
//   const { orderNo, supplierId, orderDate, deliveryDate, status } = req.body;

//   if (!orderNo || !supplierId) {
//     return res.status(400).json({ success: false, message: "Sipariş no ve tedarikçi zorunludur." });
//   }

//   db.run(
//     `
//     INSERT INTO purchase_orders
//     (order_no, supplier_id, order_date, delivery_date, status)
//     VALUES (?, ?, ?, ?, ?)
//     `,
//     [orderNo, supplierId, orderDate, deliveryDate, status || "draft"],
//     function (err) {
//       if (err) {
//         return res.status(500).json({ success: false, message: err.message });
//       }

//       res.json({ success: true, id: this.lastID });
//     }
//   );
// });

// app.put("/api/purchase-orders/:id", (req, res) => {
//   const { orderNo, supplierId, orderDate, deliveryDate, status } = req.body;

//   db.run(
//     `
//     UPDATE purchase_orders SET
//       order_no = ?,
//       supplier_id = ?,
//       order_date = ?,
//       delivery_date = ?,
//       status = ?
//     WHERE id = ?
//     `,
//     [orderNo, supplierId, orderDate, deliveryDate, status, req.params.id],
//     function (err) {
//       if (err) {
//         return res.status(500).json({ success: false, message: err.message });
//       }

//       res.json({ success: true });
//     }
//   );
// });

// app.delete("/api/purchase-orders/:id", (req, res) => {
//   db.run("DELETE FROM purchase_orders WHERE id = ?", [req.params.id], function (err) {
//     if (err) {
//       return res.status(500).json({ success: false, message: err.message });
//     }

//     res.json({ success: true });
//   });
// });


// app.delete("/api/employee-documents/:id", (req, res) => {
//   db.run("DELETE FROM employee_documents WHERE id = ?", [req.params.id], function (err) {
//     if (err) {
//       return res.status(500).json({ success: false, message: err.message });
//     }

//     res.json({ success: true });
//   });
// });

// app.put("/api/employee-shifts/:id", (req, res) => {
//   const { employeeId, shiftDate, startTime, endTime, overtimeHours, description } = req.body;

//   db.run(
//     `
//     UPDATE employee_shifts SET
//       employee_id = ?,
//       shift_date = ?,
//       start_time = ?,
//       end_time = ?,
//       overtime_hours = ?,
//       description = ?
//     WHERE id = ?
//     `,
//     [employeeId, shiftDate, startTime, endTime, Number(overtimeHours || 0), description, req.params.id],
//     function (err) {
//       if (err) {
//         return res.status(500).json({ success: false, message: err.message });
//       }

//       res.json({ success: true });
//     }
//   );
// });

// app.delete("/api/employee-shifts/:id", (req, res) => {
//   db.run("DELETE FROM employee_shifts WHERE id = ?", [req.params.id], function (err) {
//     if (err) {
//       return res.status(500).json({ success: false, message: err.message });
//     }

//     res.json({ success: true });
//   });
// });

// app.delete("/api/employee-payments/:id", (req, res) => {
//   db.run(
//     "DELETE FROM employee_payments WHERE id = ?",
//     [req.params.id],
//     function (err) {
//       if (err) {
//         return res.status(500).json({
//           success: false,
//           message: err.message
//         });
//       }

//       res.json({ success: true });
//     }
//   );
// });

// app.get("/api/users", (req, res) => {
//   db.all(`
//     SELECT
//       id,
//       username,
//       password,
//       full_name AS fullName,
//       role,
//       active,
//       email
//     FROM users
//     ORDER BY id DESC
//   `, [], (err, rows) => {
//     if (err) {
//       console.error("Kullanıcı listeleme hatası:", err.message);

//       return res.status(500).json({
//         success: false,
//         message: err.message,
//         users: []
//       });
//     }

//     res.json({
//       success: true,
//       users: rows || []
//     });
//   });
// });

// app.put("/api/users/:id", (req, res) => {
//   const {
//     username,
//     password,
//     fullName,
//     role,
//     active,
//     email
//   } = req.body;

//   if (!username || !fullName) {
//     return res.status(400).json({
//       success: false,
//       message: "Ad soyad ve kullanıcı adı zorunludur."
//     });
//   }

//   let sql = `
//     UPDATE users
//     SET
//       username = ?,
//       full_name = ?,
//       role = ?,
//       active = ?,
//       email = ?
//   `;

//   const params = [
//     username,
//     fullName,
//     role || "user",
//     active ?? 1,
//     email || ""
//   ];

//   if (password && password.trim() !== "") {
//     sql += `, password = ?`;
//     params.push(password);
//   }

//   sql += ` WHERE id = ?`;
//   params.push(req.params.id);

//   db.run(sql, params, function(err) {
//     if (err) {
//       return res.status(500).json({
//         success: false,
//         message: err.message
//       });
//     }

//     res.json({
//       success: true
//     });
//   });
// });

// app.put("/api/users/:id/status", (req, res) => {
//   const { active } = req.body;

//   db.run(`
//     UPDATE users
//     SET active = ?
//     WHERE id = ?
//   `, [active, req.params.id], function(err) {
//     if (err) {
//       return res.status(500).json({
//         success: false,
//         message: err.message
//       });
//     }

//     res.json({
//       success: true
//     });
//   });
// });

// app.delete("/api/users/:id", (req, res) => {
//   db.run(`
//     DELETE FROM users
//     WHERE id = ?
//   `, [req.params.id], function(err) {
//     if (err) {
//       return res.status(500).json({
//         success: false,
//         message: err.message
//       });
//     }

//     res.json({
//       success: true
//     });
//   });
// });

// app.get("/api/dashboard/:userId", async (req, res) => {

//   const userId = req.params.userId;

//   try {

//     const user = await dbGet(`
//       SELECT
//         id,
//         username,
//         full_name,
//         role
//       FROM users
//       WHERE id = ?
//     `, [userId]);

//     if (!user) {
//       return res.status(404).json({
//         error: "Kullanıcı bulunamadı"
//       });
//     }

//     const dashboardData = {
//       user: {
//         id: user.id,
//         fullName: user.full_name,
//         role: user.role,
//         avatar: user.full_name.charAt(0).toUpperCase()
//       },
//       notifications: 0,
//       stats: {
//         customers: 0,
//         customerChange: 0,
//         offers: 0,
//         offerChange: 0,
//         workOrders: 0,
//         workOrderChange: 0,
//         payments: 0,
//         paymentChange: 0
//       },
//       workOrders: []
//     };

//     res.json(dashboardData);

//   } catch (err) {

//     res.status(500).json({
//       error: err.message
//     });

//   }

// });


// app.get("/api/customers", async (req, res) => {
//   try {
//     const rows = await dbAll(`
//       SELECT
//         id,
//         customer_code AS customerCode,
//         company_name AS companyName,
//         authorized_person AS authorizedPerson,
//         phone,
//         email,
//         city,
//         tax_no AS taxNo,
//         status,
//         strftime('%d.%m.%Y', created_at) AS createdAt
//       FROM customers
//       ORDER BY id DESC
//     `);

//     res.json({
//       success: true,
//       customers: rows || []
//     });

//   } catch (err) {
//     res.status(500).json({
//       success: false,
//       message: "Müşteriler alınamadı.",
//       detail: err.message
//     });
//   }
// });

// app.post("/api/customers", async (req, res) => {
//   try {
//     const {
//       companyName,
//       authorizedPerson,
//       phone,
//       email,
//       city,
//       taxNo
//     } = req.body;

//     if (!companyName) {
//       return res.status(400).json({
//         success: false,
//         message: "Firma adı zorunludur."
//       });
//     }

//     const lastCustomer = await dbGet(`
//       SELECT id FROM customers ORDER BY id DESC LIMIT 1
//     `);

//     const nextNo = (lastCustomer?.id || 0) + 1;
//     const customerCode = "MUS" + String(nextNo).padStart(5, "0");

//     await new Promise((resolve, reject) => {
//       db.run(
//         `
//         INSERT INTO customers (
//           customer_code,
//           company_name,
//           authorized_person,
//           phone,
//           email,
//           city,
//           tax_no,
//           status
//         )
//         VALUES (?, ?, ?, ?, ?, ?, ?, 'active')
//         `,
//         [
//           customerCode,
//           companyName,
//           authorizedPerson,
//           phone,
//           email,
//           city,
//           taxNo
//         ],
//         function (err) {
//           if (err) reject(err);
//           else resolve(this.lastID);
//         }
//       );
//     });

//     res.json({
//       success: true,
//       message: "Müşteri başarıyla oluşturuldu."
//     });

//   } catch (err) {
//     res.status(500).json({
//       success: false,
//       message: "Müşteri oluşturulamadı.",
//       detail: err.message
//     });
//   }
// });

// app.put("/api/customers/:id/status", async (req, res) => {
//   try {
//     const { status } = req.body;
//     const { id } = req.params;

//     await new Promise((resolve, reject) => {
//       db.run(
//         `UPDATE customers SET status = ? WHERE id = ?`,
//         [status, id],
//         function (err) {
//           if (err) reject(err);
//           else resolve();
//         }
//       );
//     });

//     res.json({
//       success: true,
//       message: "Müşteri durumu güncellendi."
//     });

//   } catch (err) {
//     res.status(500).json({
//       success: false,
//       message: "Durum güncellenemedi.",
//       detail: err.message
//     });
//   }
// });

// app.put("/api/customers/:id", async (req, res) => {
//   try {
//     const { id } = req.params;

//     const {
//       companyName,
//       authorizedPerson,
//       phone,
//       email,
//       city,
//       taxNo
//     } = req.body;

//     if (!companyName) {
//       return res.status(400).json({
//         success: false,
//         message: "Firma adı zorunludur."
//       });
//     }

//     await new Promise((resolve, reject) => {
//       db.run(
//         `
//         UPDATE customers
//         SET
//           company_name = ?,
//           authorized_person = ?,
//           phone = ?,
//           email = ?,
//           city = ?,
//           tax_no = ?
//         WHERE id = ?
//         `,
//         [
//           companyName,
//           authorizedPerson,
//           phone,
//           email,
//           city,
//           taxNo,
//           id
//         ],
//         function (err) {
//           if (err) reject(err);
//           else resolve();
//         }
//       );
//     });

//     res.json({
//       success: true,
//       message: "Müşteri bilgileri güncellendi."
//     });

//   } catch (err) {
//     res.status(500).json({
//       success: false,
//       message: "Müşteri güncellenemedi.",
//       detail: err.message
//     });
//   }
// });

// app.get("/api/offers", async (req, res) => {
//   try {
//     const rows = await dbAll(`
//       SELECT
//         o.id,
//         o.offer_no AS offerNo,
//         o.title,
//         COALESCE(c.company_name, '-') AS customerName,
//         o.offer_date AS offerDate,
//         o.valid_until AS validUntil,
//         o.status,
//         o.total_amount AS totalAmount,
//         o.note
//       FROM offers o
//       LEFT JOIN customers c ON c.id = o.customer_id
//       ORDER BY o.id DESC
//     `);

//     res.json({ success: true, offers: rows || [] });

//   } catch (err) {
//     res.status(500).json({
//       success: false,
//       message: "Teklifler alınamadı.",
//       detail: err.message
//     });
//   }
// });

// app.get("/api/offers/:id", async (req, res) => {
//   try {
//     const offer = await dbGet(`
//       SELECT
//         id,
//         offer_no AS offerNo,
//         customer_id AS customerId,
//         title,
//         offer_date AS offerDate,
//         valid_until AS validUntil,
//         status,
//         note,
//         total_amount AS totalAmount
//       FROM offers
//       WHERE id = ?
//     `, [req.params.id]);

//     const items = await dbAll(`
//       SELECT
//         id,
//         item_name AS itemName,
//         quantity,
//         unit_price AS unitPrice,
//         total_price AS totalPrice
//       FROM offer_items
//       WHERE offer_id = ?
//     `, [req.params.id]);

//     res.json({ success: true, offer, items });

//   } catch (err) {
//     res.status(500).json({
//       success: false,
//       message: "Teklif detayı alınamadı.",
//       detail: err.message
//     });
//   }
// });

// app.post("/api/offers", async (req, res) => {
//   try {
//     const { customerId, title, offerDate, validUntil, status, note, items } = req.body;

//     if (!customerId || !title) {
//       return res.status(400).json({
//         success: false,
//         message: "Müşteri ve teklif başlığı zorunludur."
//       });
//     }

//     const lastOffer = await dbGet(`SELECT id FROM offers ORDER BY id DESC LIMIT 1`);
//     const nextNo = (lastOffer?.id || 0) + 1;
//     const offerNo = "TEK" + new Date().getFullYear() + String(nextNo).padStart(5, "0");

//     const totalAmount = (items || []).reduce((sum, item) => {
//       return sum + Number(item.quantity || 0) * Number(item.unitPrice || 0);
//     }, 0);

//     const offerId = await new Promise((resolve, reject) => {
//       db.run(`
//         INSERT INTO offers (
//           offer_no,
//           customer_id,
//           title,
//           offer_date,
//           valid_until,
//           status,
//           note,
//           total_amount
//         )
//         VALUES (?, ?, ?, ?, ?, ?, ?, ?)
//       `, [
//         offerNo,
//         customerId,
//         title,
//         offerDate || null,
//         validUntil || null,
//         status || "draft",
//         note || "",
//         totalAmount
//       ], function (err) {
//         if (err) reject(err);
//         else resolve(this.lastID);
//       });
//     });

//     for (const item of items || []) {
//       const quantity = Number(item.quantity || 0);
//       const unitPrice = Number(item.unitPrice || 0);

//       await new Promise((resolve, reject) => {
//         db.run(`
//           INSERT INTO offer_items (
//             offer_id,
//             item_name,
//             quantity,
//             unit_price,
//             total_price
//           )
//           VALUES (?, ?, ?, ?, ?)
//         `, [
//           offerId,
//           item.itemName,
//           quantity,
//           unitPrice,
//           quantity * unitPrice
//         ], err => err ? reject(err) : resolve());
//       });
//     }

//     res.json({
//       success: true,
//       message: "Teklif başarıyla oluşturuldu."
//     });

//   } catch (err) {
//     res.status(500).json({
//       success: false,
//       message: "Teklif oluşturulamadı.",
//       detail: err.message
//     });
//   }
// });

// app.put("/api/offers/:id", async (req, res) => {
//   try {
//     const { customerId, title, offerDate, validUntil, status, note, items } = req.body;

//     const totalAmount = (items || []).reduce((sum, item) => {
//       return sum + Number(item.quantity || 0) * Number(item.unitPrice || 0);
//     }, 0);

//     await new Promise((resolve, reject) => {
//       db.run(`
//         UPDATE offers
//         SET
//           customer_id = ?,
//           title = ?,
//           offer_date = ?,
//           valid_until = ?,
//           status = ?,
//           note = ?,
//           total_amount = ?
//         WHERE id = ?
//       `, [
//         customerId,
//         title,
//         offerDate || null,
//         validUntil || null,
//         status || "draft",
//         note || "",
//         totalAmount,
//         req.params.id
//       ], err => err ? reject(err) : resolve());
//     });

//     await new Promise((resolve, reject) => {
//       db.run(`DELETE FROM offer_items WHERE offer_id = ?`, [req.params.id], err => {
//         if (err) reject(err);
//         else resolve();
//       });
//     });

//     for (const item of items || []) {
//       const quantity = Number(item.quantity || 0);
//       const unitPrice = Number(item.unitPrice || 0);

//       await new Promise((resolve, reject) => {
//         db.run(`
//           INSERT INTO offer_items (
//             offer_id,
//             item_name,
//             quantity,
//             unit_price,
//             total_price
//           )
//           VALUES (?, ?, ?, ?, ?)
//         `, [
//           req.params.id,
//           item.itemName,
//           quantity,
//           unitPrice,
//           quantity * unitPrice
//         ], err => err ? reject(err) : resolve());
//       });
//     }

//     res.json({
//       success: true,
//       message: "Teklif güncellendi."
//     });

//   } catch (err) {
//     res.status(500).json({
//       success: false,
//       message: "Teklif güncellenemedi.",
//       detail: err.message
//     });
//   }
// });

// app.put("/api/offers/:id/status", async (req, res) => {
//   try {
//     const { status } = req.body;

//     await new Promise((resolve, reject) => {
//       db.run(
//         `UPDATE offers SET status = ? WHERE id = ?`,
//         [status, req.params.id],
//         err => err ? reject(err) : resolve()
//       );
//     });

//     res.json({
//       success: true,
//       message: "Teklif durumu güncellendi."
//     });

//   } catch (err) {
//     res.status(500).json({
//       success: false,
//       message: "Teklif durumu güncellenemedi.",
//       detail: err.message
//     });
//   }
// });

// app.post('/api/work-orders', (req, res) => {
//   const {
//     workOrderNo,
//     customerId,
//     title,
//     description,
//     startDate,
//     dueDate,
//     priority,
//     status
//   } = req.body;

//   const sql = `
//     INSERT INTO work_orders
//     (
//       work_order_no,
//       customer_id,
//       part_name,
//       delivery_date,
//       status
//     )
//     VALUES (?, ?, ?, ?, ?)
//   `;

//   db.run(sql, [
//     workOrderNo,
//     customerId,
//     title,
//     dueDate,
//     status || 'waiting'
//   ], function (err) {
//     if (err) {
//       console.error('İş emri ekleme hatası:', err);
//       return res.status(500).json({ success: false, message: 'İş emri eklenemedi' });
//     }

//     res.json({ success: true, id: this.lastID });
//   });
// });

// app.get('/api/work-orders', (req, res) => {
//   const sql = `
//     SELECT 
//       wo.id,
//       wo.work_order_no,
//       wo.customer_id,
//       wo.part_name AS title,
//       wo.delivery_date AS due_date,
//       wo.status,
//       c.company_name AS customer_name
//     FROM work_orders wo
//     LEFT JOIN customers c ON c.id = wo.customer_id
//     ORDER BY wo.id DESC
//   `;

//   db.all(sql, [], (err, rows) => {
//     if (err) {
//       console.error('İş emirleri listeleme hatası:', err);
//       return res.status(500).json({ success: false, message: 'İş emirleri getirilemedi' });
//     }

//     res.json({ success: true, workOrders: rows });
//   });
// });

// app.put('/api/work-orders/:id', (req, res) => {
//   const { id } = req.params;

//   const {
//     workOrderNo,
//     customerId,
//     title,
//     dueDate,
//     status
//   } = req.body;

//   const sql = `
//     UPDATE work_orders
//     SET
//       work_order_no = ?,
//       customer_id = ?,
//       part_name = ?,
//       delivery_date = ?,
//       status = ?
//     WHERE id = ?
//   `;

//   db.run(sql, [
//     workOrderNo,
//     customerId,
//     title,
//     dueDate,
//     status || 'waiting',
//     id
//   ], function (err) {
//     if (err) {
//       console.error('İş emri güncelleme hatası:', err);
//       return res.status(500).json({ success: false, message: 'İş emri güncellenemedi' });
//     }

//     res.json({ success: true });
//   });
// });
// app.delete('/api/work-orders/:id', (req, res) => {
//   const { id } = req.params;

//   db.run(`DELETE FROM work_orders WHERE id = ?`, [id], function (err) {
//     if (err) {
//       console.error('İş emri silme hatası:', err);
//       return res.status(500).json({ success: false, message: 'İş emri silinemedi' });
//     }

//     res.json({ success: true });
//   });
// });

// app.put('/api/work-orders/:id/status', (req, res) => {
//   const { id } = req.params;
//   const { status } = req.body;

//   db.run(
//     `UPDATE work_orders SET status = ? WHERE id = ?`,
//     [status, id],
//     function (err) {
//       if (err) {
//         console.error('İş emri durum güncelleme hatası:', err);
//         return res.status(500).json({ success: false, message: 'Durum güncellenemedi' });
//       }

//       res.json({ success: true });
//     }
//   );
// });


// app.get('/api/stocks', (req, res) => {
//   db.all(`SELECT * FROM stocks ORDER BY id DESC`, [], (err, rows) => {
//     if (err) {
//       console.error('Stok listeleme hatası:', err);
//       return res.status(500).json({ success: false, message: 'Stoklar getirilemedi' });
//     }

//     res.json({ success: true, stocks: rows });
//   });
// });

// app.post('/api/stocks', (req, res) => {
//   const {
//     stockCode,
//     partName,
//     category,
//     unit,
//     quantity,
//     minQuantity,
//     location,
//     status
//   } = req.body;

//   const sql = `
//     INSERT INTO stocks
//     (
//       stock_code,
//       part_name,
//       category,
//       unit,
//       quantity,
//       min_quantity,
//       location,
//       status
//     )
//     VALUES (?, ?, ?, ?, ?, ?, ?, ?)
//   `;

//   db.run(sql, [
//     stockCode,
//     partName,
//     category,
//     unit || 'Adet',
//     quantity || 0,
//     minQuantity || 0,
//     location,
//     status || 'active'
//   ], function (err) {
//     if (err) {
//       console.error('Stok ekleme hatası:', err);
//       return res.status(500).json({ success: false, message: 'Stok eklenemedi' });
//     }

//     res.json({ success: true, id: this.lastID });
//   });
// });

// app.get('/api/stocks/:id', (req, res) => {
//   db.get(`SELECT * FROM stocks WHERE id = ?`, [req.params.id], (err, row) => {
//     if (err) {
//       console.error('Stok detay hatası:', err);
//       return res.status(500).json({ success: false, message: 'Stok detayı alınamadı' });
//     }

//     res.json({ success: true, stock: row });
//   });
// });

// app.put('/api/stocks/:id', (req, res) => {
//   const {
//     stockCode,
//     partName,
//     category,
//     unit,
//     quantity,
//     minQuantity,
//     location,
//     status
//   } = req.body;

//   const sql = `
//     UPDATE stocks
//     SET
//       stock_code = ?,
//       part_name = ?,
//       category = ?,
//       unit = ?,
//       quantity = ?,
//       min_quantity = ?,
//       location = ?,
//       status = ?
//     WHERE id = ?
//   `;

//   db.run(sql, [
//     stockCode,
//     partName,
//     category,
//     unit || 'Adet',
//     quantity || 0,
//     minQuantity || 0,
//     location,
//     status || 'active',
//     req.params.id
//   ], function (err) {
//     if (err) {
//       console.error('Stok güncelleme hatası:', err);
//       return res.status(500).json({ success: false, message: 'Stok güncellenemedi' });
//     }

//     res.json({ success: true });
//   });
// });

// app.delete('/api/stocks/:id', (req, res) => {
//   db.run(`DELETE FROM stocks WHERE id = ?`, [req.params.id], function (err) {
//     if (err) {
//       console.error('Stok silme hatası:', err);
//       return res.status(500).json({ success: false, message: 'Stok silinemedi' });
//     }

//     res.json({ success: true });
//   });
// });

// app.get('/api/machines', (req, res) => {
//     db.all(`
//         SELECT *
//         FROM machine_maintenance
//         ORDER BY id DESC
//     `, [], (err, rows) => {
//         if (err) {
//             return res.status(500).json({
//                 success: false,
//                 message: err.message
//             });
//         }

//         res.json({
//             success: true,
//             machines: rows
//         });
//     });
// });


// // ===============================
// // TEK MAKİNE GETİR
// // ===============================

// app.get('/api/machines/:id', (req, res) => {
//     db.get(`
//         SELECT *
//         FROM machine_maintenance
//         WHERE id = ?
//     `, [req.params.id], (err, row) => {
//         if (err) {
//             return res.status(500).json({
//                 success: false,
//                 message: err.message
//             });
//         }

//         res.json({
//             success: true,
//             machine: row
//         });
//     });
// });

// // ===============================
// // BAKIM EMİRLERİ
// // ===============================

// db.run(`
// CREATE TABLE IF NOT EXISTS maintenance_orders (
//     id INTEGER PRIMARY KEY AUTOINCREMENT,
//     order_no TEXT NOT NULL,
//     machine_id INTEGER,
//     machine_name TEXT,
//     title TEXT NOT NULL,
//     description TEXT,
//     priority TEXT DEFAULT 'normal',
//     status TEXT DEFAULT 'open',
//     planned_date TEXT,
//     responsible_person TEXT,
//     created_at DATETIME DEFAULT CURRENT_TIMESTAMP
// )
// `);

// app.get('/api/maintenance-orders', (req, res) => {
//     db.all(`
//         SELECT *
//         FROM maintenance_orders
//         ORDER BY id DESC
//     `, [], (err, rows) => {
//         if (err) {
//             console.error("Bakım emirleri listeleme hatası:", err.message);

//             return res.status(500).json({
//                 success: false,
//                 message: err.message,
//                 orders: []
//             });
//         }

//         res.json({
//             success: true,
//             orders: rows || []
//         });
//     });
// });

// app.post('/api/maintenance-orders', (req, res) => {
//     const {
//         orderNo,
//         machineId,
//         machineName,
//         title,
//         description,
//         priority,
//         status,
//         plannedDate,
//         responsiblePerson
//     } = req.body;

//     const finalOrderNo = orderNo || `BE-${Date.now()}`;

//     db.run(`
//         INSERT INTO maintenance_orders
//         (
//             order_no,
//             machine_id,
//             machine_name,
//             title,
//             description,
//             priority,
//             status,
//             planned_date,
//             responsible_person
//         )
//         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
//     `,
//     [
//         finalOrderNo,
//         machineId || null,
//         machineName || "",
//         title || "Bakım Emri",
//         description || "",
//         priority || "normal",
//         status || "open",
//         plannedDate || "",
//         responsiblePerson || ""
//     ],
//     function (err) {
//         if (err) {
//             console.error("Bakım emri ekleme hatası:", err.message);

//             return res.status(500).json({
//                 success: false,
//                 message: err.message
//             });
//         }

//         res.json({
//             success: true,
//             id: this.lastID
//         });
//     });
// });

// // ======================================
// // TAHSİLAT LİSTELE
// // ======================================

// app.get('/api/payments', (req, res) => {

//     db.all(`
//         SELECT *
//         FROM payments
//         ORDER BY id DESC
//     `, [], (err, rows) => {

//         if (err) {
//             console.error('Tahsilat listeleme hatası:', err);

//             return res.status(500).json({
//                 success: false,
//                 message: err.message,
//                 payments: []
//             });
//         }

//         res.json({
//             success: true,
//             payments: rows || []
//         });

//     });

// });


// // ======================================
// // TEK TAHSİLAT GETİR
// // ======================================

// app.get('/api/payments/:id', (req, res) => {

//     db.get(`
//         SELECT *
//         FROM payments
//         WHERE id = ?
//     `, [req.params.id], (err, row) => {

//         if (err) {
//             console.error('Tahsilat detay hatası:', err);

//             return res.status(500).json({
//                 success: false,
//                 message: err.message
//             });
//         }

//         res.json({
//             success: true,
//             payment: row
//         });

//     });

// });


// // ======================================
// // TAHSİLAT EKLE
// // ======================================

// app.post('/api/payments', (req, res) => {

//     const {
//         paymentNo,
//         customerId,
//         customerName,
//         amount,
//         paymentMethod,
//         dueDate,
//         paymentDate,
//         status,
//         referenceNo,
//         description
//     } = req.body;

//     db.run(`
//         INSERT INTO payments
//         (
//             payment_no,
//             customer_id,
//             customer_name,
//             amount,
//             payment_method,
//             due_date,
//             payment_date,
//             status,
//             reference_no,
//             description
//         )
//         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
//     `,
//     [
//         paymentNo,
//         customerId,
//         customerName,
//         amount || 0,
//         paymentMethod || 'cash',
//         dueDate || '',
//         paymentDate || '',
//         status || 'pending',
//         referenceNo || '',
//         description || ''
//     ],
//     function(err){

//         if(err){
//             console.error('Tahsilat ekleme hatası:', err);

//             return res.status(500).json({
//                 success:false,
//                 message:err.message
//             });
//         }

//         res.json({
//             success:true,
//             id:this.lastID
//         });

//     });

// });


// // ======================================
// // TAHSİLAT GÜNCELLE
// // ======================================

// app.put('/api/payments/:id', (req, res) => {

//     const {
//         paymentNo,
//         customerId,
//         customerName,
//         amount,
//         paymentMethod,
//         dueDate,
//         paymentDate,
//         status,
//         referenceNo,
//         description
//     } = req.body;

//     db.run(`
//         UPDATE payments
//         SET
//             payment_no = ?,
//             customer_id = ?,
//             customer_name = ?,
//             amount = ?,
//             payment_method = ?,
//             due_date = ?,
//             payment_date = ?,
//             status = ?,
//             reference_no = ?,
//             description = ?
//         WHERE id = ?
//     `,
//     [
//         paymentNo,
//         customerId,
//         customerName,
//         amount || 0,
//         paymentMethod || 'cash',
//         dueDate || '',
//         paymentDate || '',
//         status || 'pending',
//         referenceNo || '',
//         description || '',
//         req.params.id
//     ],
//     function(err){

//         if(err){
//             console.error('Tahsilat güncelleme hatası:', err);

//             return res.status(500).json({
//                 success:false,
//                 message:err.message
//             });
//         }

//         res.json({
//             success:true
//         });

//     });

// });


// // ======================================
// // TAHSİLAT SİL
// // ======================================

// app.delete('/api/payments/:id', (req, res) => {

//     db.run(`
//         DELETE FROM payments
//         WHERE id = ?
//     `,
//     [req.params.id],
//     function(err){

//         if(err){
//             console.error('Tahsilat silme hatası:', err);

//             return res.status(500).json({
//                 success:false,
//                 message:err.message
//             });
//         }

//         res.json({
//             success:true
//         });

//     });

// });


// // ===============================
// // MAKİNE EKLE
// // ===============================

// app.post('/api/machines', (req, res) => {
//     const {
//         machine_code,
//         machineCode,
//         machine_name,
//         machineName,
//         machine_type,
//         machineType,
//         location,
//         serial_no,
//         serialNo,
//         brand_model,
//         brandModel,
//         last_maintenance,
//         lastMaintenance,
//         next_maintenance,
//         nextMaintenance,
//         status,
//         responsible_person,
//         responsiblePerson,
//         description,
//         note
//     } = req.body;

//     const finalMachineCode = machine_code || machineCode;
//     const finalMachineName = machine_name || machineName;

//     if (!finalMachineCode || !finalMachineName) {
//         return res.status(400).json({
//             success: false,
//             message: "Makine kodu ve makine adı zorunludur."
//         });
//     }

//     db.run(`
//         INSERT INTO machine_maintenance
//         (
//             machine_code,
//             machine_name,
//             machine_type,
//             location,
//             serial_no,
//             brand_model,
//             last_maintenance,
//             next_maintenance,
//             status,
//             responsible_person,
//             description
//         )
//         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
//     `,
//     [
//         finalMachineCode,
//         finalMachineName,
//         machine_type || machineType || "",
//         location || "",
//         serial_no || serialNo || "",
//         brand_model || brandModel || "",
//         last_maintenance || lastMaintenance || "",
//         next_maintenance || nextMaintenance || "",
//         status || "active",
//         responsible_person || responsiblePerson || "",
//         description || note || ""
//     ],
//     function (err) {
//         if (err) {
//             return res.status(500).json({
//                 success: false,
//                 message: err.message
//             });
//         }

//         res.json({
//             success: true,
//             id: this.lastID
//         });
//     });
// });


// // ===============================
// // MAKİNE GÜNCELLE
// // ===============================

// app.put('/api/machines/:id', (req, res) => {
//     const {
//         machine_code,
//         machine_name,
//         department,
//         last_maintenance,
//         next_maintenance,
//         maintenance_period,
//         status,
//         note
//     } = req.body;

//     db.run(`
//         UPDATE machine_maintenance
//         SET
//             machine_code = ?,
//             machine_name = ?,
//             department = ?,
//             last_maintenance = ?,
//             next_maintenance = ?,
//             maintenance_period = ?,
//             status = ?,
//             note = ?
//         WHERE id = ?
//     `,
//     [
//         machine_code,
//         machine_name,
//         department,
//         last_maintenance,
//         next_maintenance,
//         maintenance_period,
//         status || 'active',
//         note,
//         req.params.id
//     ],
//     function (err) {
//         if (err) {
//             return res.status(500).json({
//                 success: false,
//                 message: err.message
//             });
//         }

//         res.json({
//             success: true
//         });
//     });
// });


// // ===============================
// // MAKİNE SİL
// // ===============================

// app.delete('/api/machines/:id', (req, res) => {
//     db.run(`
//         DELETE FROM machine_maintenance
//         WHERE id = ?
//     `, [req.params.id], function (err) {
//         if (err) {
//             return res.status(500).json({
//                 success: false,
//                 message: err.message
//             });
//         }

//         res.json({
//             success: true
//         });
//     });
// });

// // ===============================
// // FIRE / HURDA LİSTELE
// // ===============================
// app.get("/api/scrap-records", (req, res) => {
//   db.all(`
//     SELECT 
//       sr.*,
//       wo.work_order_no,
//       wo.title AS work_order_title,
//       s.stock_code,
//       s.part_name,
//       w.warehouse_name
//     FROM scrap_records sr
//     LEFT JOIN work_orders wo ON wo.id = sr.work_order_id
//     LEFT JOIN stocks s ON s.id = sr.stock_id
//     LEFT JOIN warehouses w ON w.id = sr.warehouse_id
//     ORDER BY sr.id DESC
//   `, [], (err, rows) => {
//     if (err) {
//       console.error("Fire/hurda kayıtları alınamadı:", err);
//       return res.status(500).json({ success:false, message:err.message });
//     }

//     res.json({ success:true, records:rows });
//   });
// });


// // ===============================
// // FIRE / HURDA OLUŞTUR
// // ===============================
// app.post("/api/scrap-records", (req, res) => {
//   const {
//     workOrderId,
//     stockId,
//     warehouseId,
//     scrapType,
//     quantity,
//     reason,
//     scrapDate,
//     description,
//     createdBy
//   } = req.body;

//   if (!stockId || !quantity) {
//     return res.status(400).json({
//       success:false,
//       message:"Malzeme ve miktar zorunludur."
//     });
//   }

//   const scrapNo = "FRH" + Date.now();

//   db.run(`
//     INSERT INTO scrap_records (
//       scrap_no,
//       work_order_id,
//       stock_id,
//       warehouse_id,
//       scrap_type,
//       quantity,
//       reason,
//       scrap_date,
//       status,
//       description,
//       created_by
//     )
//     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'Beklemede', ?, ?)
//   `, [
//     scrapNo,
//     workOrderId || null,
//     stockId,
//     warehouseId || null,
//     scrapType || "scrap",
//     quantity,
//     reason || "",
//     scrapDate || new Date().toISOString().slice(0,10),
//     description || "",
//     createdBy || "Admin"
//   ], function(err) {
//     if (err) {
//       console.error("Fire/hurda oluşturulamadı:", err);
//       return res.status(500).json({ success:false, message:err.message });
//     }

//     res.json({
//       success:true,
//       message:"Fire/hurda kaydı oluşturuldu.",
//       id:this.lastID,
//       scrapNo
//     });
//   });
// });


// // ===============================
// // FIRE / HURDA ONAYLA
// // ===============================
// app.put("/api/scrap-records/:id/approve", (req, res) => {
//   const recordId = req.params.id;

//   db.get(`
//     SELECT *
//     FROM scrap_records
//     WHERE id = ?
//   `, [recordId], (err, record) => {
//     if (err) {
//       console.error("Fire/hurda sorgu hatası:", err);
//       return res.status(500).json({ success:false, message:err.message });
//     }

//     if (!record) {
//       return res.status(404).json({
//         success:false,
//         message:"Fire/hurda kaydı bulunamadı."
//       });
//     }

//     if (record.status === "Onaylandı") {
//       return res.status(400).json({
//         success:false,
//         message:"Bu kayıt zaten onaylanmış."
//       });
//     }

//     if (!record.warehouse_id) {
//       return res.status(400).json({
//         success:false,
//         message:"Stok düşümü için depo seçimi zorunludur."
//       });
//     }

//     db.get(`
//       SELECT quantity
//       FROM warehouse_stocks
//       WHERE warehouse_id = ? AND stock_id = ?
//     `, [record.warehouse_id, record.stock_id], (err, currentStock) => {
//       if (err) {
//         console.error("Depo stok sorgu hatası:", err);
//         return res.status(500).json({ success:false, message:err.message });
//       }

//       const previousQty = currentStock ? Number(currentStock.quantity) : 0;
//       const scrapQty = Number(record.quantity || 0);
//       const nextQty = previousQty - scrapQty;

//       if (previousQty < scrapQty) {
//         return res.status(400).json({
//           success:false,
//           message:"Depoda yeterli stok yok."
//         });
//       }

//       db.serialize(() => {
//         db.run("BEGIN TRANSACTION");

//         db.run(`
//           UPDATE warehouse_stocks
//           SET quantity = quantity - ?
//           WHERE warehouse_id = ? AND stock_id = ?
//         `, [
//           scrapQty,
//           record.warehouse_id,
//           record.stock_id
//         ]);

//         db.run(`
//           UPDATE scrap_records
//           SET status = 'Onaylandı'
//           WHERE id = ?
//         `, [recordId]);

//         db.run(`
//           INSERT INTO stock_movements (
//             movement_no,
//             movement_date,
//             stock_id,
//             movement_type,
//             quantity,
//             before_qty,
//             after_qty,
//             document_no,
//             description,
//             created_by
//           )
//           VALUES (?, DATETIME('now'), ?, 'out', ?, ?, ?, ?, ?, ?)
//         `, [
//           "HRK" + Date.now(),
//           record.stock_id,
//           scrapQty,
//           previousQty,
//           nextQty,
//           record.scrap_no,
//           "Fire/Hurda çıkışı: " + record.scrap_no,
//           record.created_by || "Admin"
//         ]);

//         db.run("COMMIT", (commitErr) => {
//           if (commitErr) {
//             db.run("ROLLBACK");
//             console.error("Fire/hurda commit hatası:", commitErr);
//             return res.status(500).json({
//               success:false,
//               message:commitErr.message
//             });
//           }

//           res.json({
//             success:true,
//             message:"Fire/hurda onaylandı ve stok düşümü yapıldı."
//           });
//         });
//       });
//     });
//   });
// });


// // ===============================
// // SERİ / LOT TAKİBİ LİSTELE
// // ===============================
// app.get("/api/serial-lot-tracking", (req, res) => {
//   db.all(`
//     SELECT
//       slt.*,
//       s.stock_code,
//       s.part_name,
//       w.warehouse_name,
//       gr.receipt_no,
//       bl.label_no,
//       bl.barcode_value
//     FROM serial_lot_tracking slt
//     LEFT JOIN stocks s ON s.id = slt.stock_id
//     LEFT JOIN warehouses w ON w.id = slt.warehouse_id
//     LEFT JOIN goods_receipts gr ON gr.id = slt.goods_receipt_id
//     LEFT JOIN barcode_labels bl ON bl.id = slt.barcode_label_id
//     ORDER BY slt.id DESC
//   `, [], (err, rows) => {
//     if (err) {
//       console.error("Seri/lot kayıtları alınamadı:", err);
//       return res.status(500).json({ success:false, message:err.message });
//     }

//     res.json({ success:true, records:rows });
//   });
// });


// // ===============================
// // SERİ / LOT KAYDI OLUŞTUR
// // ===============================
// app.post("/api/serial-lot-tracking", (req, res) => {
//   const {
//     stockId,
//     warehouseId,
//     goodsReceiptId,
//     barcodeLabelId,
//     lotNo,
//     serialNo,
//     quantity,
//     productionDate,
//     expireDate,
//     description,
//     createdBy
//   } = req.body;

//   if (!stockId || !quantity) {
//     return res.status(400).json({
//       success:false,
//       message:"Malzeme ve miktar zorunludur."
//     });
//   }

//   if (!lotNo && !serialNo) {
//     return res.status(400).json({
//       success:false,
//       message:"Lot no veya seri no alanlarından en az biri girilmelidir."
//     });
//   }

//   const trackingNo = "SLT" + Date.now();

//   db.run(`
//     INSERT INTO serial_lot_tracking (
//       tracking_no,
//       stock_id,
//       warehouse_id,
//       goods_receipt_id,
//       barcode_label_id,
//       lot_no,
//       serial_no,
//       quantity,
//       remaining_quantity,
//       production_date,
//       expire_date,
//       status,
//       description,
//       created_by
//     )
//     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', ?, ?)
//   `, [
//     trackingNo,
//     stockId,
//     warehouseId || null,
//     goodsReceiptId || null,
//     barcodeLabelId || null,
//     lotNo || "",
//     serialNo || "",
//     quantity,
//     quantity,
//     productionDate || null,
//     expireDate || null,
//     description || "",
//     createdBy || "Admin"
//   ], function(err) {
//     if (err) {
//       console.error("Seri/lot kaydı oluşturulamadı:", err);
//       return res.status(500).json({ success:false, message:err.message });
//     }

//     res.json({
//       success:true,
//       message:"Seri/lot kaydı oluşturuldu.",
//       id:this.lastID,
//       trackingNo
//     });
//   });
// });


// // ===============================
// // SERİ / LOT PASİFE AL
// // ===============================
// app.put("/api/serial-lot-tracking/:id/passive", (req, res) => {
//   db.run(`
//     UPDATE serial_lot_tracking
//     SET status = 'passive'
//     WHERE id = ?
//   `, [req.params.id], function(err) {
//     if (err) {
//       console.error("Seri/lot pasife alma hatası:", err);
//       return res.status(500).json({ success:false, message:err.message });
//     }

//     res.json({ success:true, message:"Seri/lot kaydı pasife alındı." });
//   });
// });


// // ===============================
// // SERİ / LOT MİKTAR DÜŞ
// // ===============================
// app.put("/api/serial-lot-tracking/:id/consume", (req, res) => {
//   const { quantity } = req.body;

//   if (!quantity || Number(quantity) <= 0) {
//     return res.status(400).json({
//       success:false,
//       message:"Düşülecek miktar zorunludur."
//     });
//   }

//   db.get(`
//     SELECT *
//     FROM serial_lot_tracking
//     WHERE id = ?
//   `, [req.params.id], (err, record) => {
//     if (err) {
//       console.error("Seri/lot sorgu hatası:", err);
//       return res.status(500).json({ success:false, message:err.message });
//     }

//     if (!record) {
//       return res.status(404).json({
//         success:false,
//         message:"Seri/lot kaydı bulunamadı."
//       });
//     }

//     const currentQty = Number(record.remaining_quantity || 0);
//     const consumeQty = Number(quantity);

//     if (currentQty < consumeQty) {
//       return res.status(400).json({
//         success:false,
//         message:"Kalan miktar yetersiz."
//       });
//     }

//     const nextQty = currentQty - consumeQty;
//     const newStatus = nextQty <= 0 ? "closed" : record.status;

//     db.run(`
//       UPDATE serial_lot_tracking
//       SET remaining_quantity = ?, status = ?
//       WHERE id = ?
//     `, [nextQty, newStatus, req.params.id], function(updateErr) {
//       if (updateErr) {
//         console.error("Seri/lot miktar düşme hatası:", updateErr);
//         return res.status(500).json({ success:false, message:updateErr.message });
//       }

//       res.json({
//         success:true,
//         message:"Seri/lot miktarı güncellendi."
//       });
//     });
//   });
// });

// /* ================================
//    SAYIM YÖNETİMİ BACKEND
//    app.js içine ekle
// ================================ */

// // TABLOLAR
// db.serialize(() => {
//   db.run(`
//     CREATE TABLE IF NOT EXISTS stock_counts (
//       id INTEGER PRIMARY KEY AUTOINCREMENT,
//       count_no TEXT UNIQUE,
//       warehouse_id INTEGER,
//       warehouse_name TEXT,
//       count_date DATE DEFAULT CURRENT_DATE,
//       status TEXT DEFAULT 'Taslak',
//       description TEXT,
//       created_by TEXT,
//       created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
//       approved_by TEXT,
//       approved_at DATETIME
//     )
//   `);

//   db.run(`
//     CREATE TABLE IF NOT EXISTS stock_count_lines (
//       id INTEGER PRIMARY KEY AUTOINCREMENT,
//       count_id INTEGER,
//       stock_id INTEGER,
//       stock_code TEXT,
//       part_name TEXT,
//       system_quantity REAL DEFAULT 0,
//       counted_quantity REAL DEFAULT 0,
//       difference_quantity REAL DEFAULT 0,
//       unit TEXT DEFAULT 'Adet',
//       location TEXT,
//       note TEXT,
//       FOREIGN KEY(count_id) REFERENCES stock_counts(id)
//     )
//   `);
// });

// function generateCountNo() {
//   return "SYM" + Date.now();
// }

// function dbAll(sql, params = []) {
//   return new Promise((resolve, reject) => {
//     db.all(sql, params, (err, rows) => err ? reject(err) : resolve(rows));
//   });
// }

// function dbGet(sql, params = []) {
//   return new Promise((resolve, reject) => {
//     db.get(sql, params, (err, row) => err ? reject(err) : resolve(row));
//   });
// }

// function dbRun(sql, params = []) {
//   return new Promise((resolve, reject) => {
//     db.run(sql, params, function(err) {
//       if (err) reject(err);
//       else resolve(this);
//     });
//   });
// }

// // SAYIM FİŞLERİ LİSTELE
// app.get("/api/stock-counts", async (req, res) => {
//   try {
//     const rows = await dbAll(`
//       SELECT 
//         sc.*,
//         COUNT(scl.id) AS line_count,
//         IFNULL(SUM(CASE WHEN scl.difference_quantity != 0 THEN 1 ELSE 0 END), 0) AS diff_line_count
//       FROM stock_counts sc
//       LEFT JOIN stock_count_lines scl ON scl.count_id = sc.id
//       GROUP BY sc.id
//       ORDER BY sc.id DESC
//     `);

//     res.json({ success: true, counts: rows });
//   } catch (err) {
//     console.error("Sayım fişleri alınamadı:", err);
//     res.status(500).json({ success: false, message: err.message });
//   }
// });

// // SAYIM FİŞİ DETAY
// app.get("/api/stock-counts/:id", async (req, res) => {
//   try {
//     const count = await dbGet(`SELECT * FROM stock_counts WHERE id = ?`, [req.params.id]);

//     if (!count) {
//       return res.status(404).json({ success: false, message: "Sayım fişi bulunamadı." });
//     }

//     const lines = await dbAll(`
//       SELECT *
//       FROM stock_count_lines
//       WHERE count_id = ?
//       ORDER BY id ASC
//     `, [req.params.id]);

//     res.json({ success: true, count, lines });
//   } catch (err) {
//     console.error("Sayım detayı alınamadı:", err);
//     res.status(500).json({ success: false, message: err.message });
//   }
// });

// // SAYIM FİŞİ OLUŞTUR
// app.post("/api/stock-counts", async (req, res) => {
//   try {
//     const { warehouse_id, warehouse_name, count_date, description, created_by } = req.body;
//     const countNo = generateCountNo();

//     const result = await dbRun(`
//       INSERT INTO stock_counts
//       (count_no, warehouse_id, warehouse_name, count_date, description, created_by)
//       VALUES (?, ?, ?, ?, ?, ?)
//     `, [countNo, warehouse_id || null, warehouse_name || "Genel Depo", count_date || new Date().toISOString().slice(0, 10), description || "", created_by || "Sistem"]);

//     res.json({ success: true, message: "Sayım fişi oluşturuldu.", id: result.lastID, count_no: countNo });
//   } catch (err) {
//     console.error("Sayım fişi oluşturma hatası:", err);
//     res.status(500).json({ success: false, message: err.message });
//   }
// });

// // STOKLARI SAYIMA AKTAR
// app.post("/api/stock-counts/:id/import-stocks", async (req, res) => {
//   try {
//     const countId = req.params.id;
//     const count = await dbGet(`SELECT * FROM stock_counts WHERE id = ?`, [countId]);

//     if (!count) return res.status(404).json({ success: false, message: "Sayım fişi bulunamadı." });
//     if (count.status === "Onaylandı") return res.status(400).json({ success: false, message: "Onaylı sayım fişine stok aktarılamaz." });

//     const exists = await dbGet(`SELECT COUNT(*) AS total FROM stock_count_lines WHERE count_id = ?`, [countId]);
//     if (exists.total > 0) return res.status(400).json({ success: false, message: "Bu sayım fişine stoklar zaten aktarılmış." });

//     const stocks = await dbAll(`
//       SELECT id, stock_code, part_name, quantity, unit, location
//       FROM stocks
//       WHERE IFNULL(status, 'active') != 'passive'
//       ORDER BY part_name ASC
//     `);

//     for (const s of stocks) {
//       await dbRun(`
//         INSERT INTO stock_count_lines
//         (count_id, stock_id, stock_code, part_name, system_quantity, counted_quantity, difference_quantity, unit, location)
//         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
//       `, [countId, s.id, s.stock_code || "", s.part_name || "", Number(s.quantity || 0), Number(s.quantity || 0), 0, s.unit || "Adet", s.location || ""]);
//     }

//     res.json({ success: true, message: "Stoklar sayım fişine aktarıldı.", importedCount: stocks.length });
//   } catch (err) {
//     console.error("Stokları sayım fişine aktarma hatası:", err);
//     res.status(500).json({ success: false, message: err.message });
//   }
// });

// // SAYILAN MİKTAR GÜNCELLE
// app.put("/api/stock-count-lines/:lineId", async (req, res) => {
//   try {
//     const { counted_quantity, note } = req.body;

//     const line = await dbGet(`
//       SELECT scl.*, sc.status
//       FROM stock_count_lines scl
//       JOIN stock_counts sc ON sc.id = scl.count_id
//       WHERE scl.id = ?
//     `, [req.params.lineId]);

//     if (!line) return res.status(404).json({ success: false, message: "Sayım satırı bulunamadı." });
//     if (line.status === "Onaylandı") return res.status(400).json({ success: false, message: "Onaylı sayım satırı değiştirilemez." });

//     const counted = Number(counted_quantity || 0);
//     const systemQty = Number(line.system_quantity || 0);
//     const diff = counted - systemQty;

//     await dbRun(`
//       UPDATE stock_count_lines
//       SET counted_quantity = ?, difference_quantity = ?, note = ?
//       WHERE id = ?
//     `, [counted, diff, note || "", req.params.lineId]);

//     res.json({ success: true, message: "Sayım satırı güncellendi.", difference_quantity: diff });
//   } catch (err) {
//     console.error("Sayım satırı güncelleme hatası:", err);
//     res.status(500).json({ success: false, message: err.message });
//   }
// });

// // SAYIM ONAYLA
// app.put("/api/stock-counts/:id/approve", async (req, res) => {
//   try {
//     const countId = req.params.id;
//     const approvedBy = req.body.approved_by || req.headers["x-user-name"] || "Sistem";
//     const count = await dbGet(`SELECT * FROM stock_counts WHERE id = ?`, [countId]);

//     if (!count) return res.status(404).json({ success: false, message: "Sayım fişi bulunamadı." });
//     if (count.status === "Onaylandı") return res.status(400).json({ success: false, message: "Bu sayım fişi zaten onaylanmış." });

//     const lines = await dbAll(`SELECT * FROM stock_count_lines WHERE count_id = ?`, [countId]);
//     if (!lines.length) return res.status(400).json({ success: false, message: "Sayım fişinde satır yok." });

//     await dbRun("BEGIN TRANSACTION");

//     try {
//       for (const line of lines) {
//         const diff = Number(line.difference_quantity || 0);
//         if (diff === 0) continue;

//         const stock = await dbGet(`SELECT * FROM stocks WHERE id = ?`, [line.stock_id]);
//         if (!stock) continue;

//         const previousQty = Number(stock.quantity || 0);
//         const nextQty = Number(line.counted_quantity || 0);

//         await dbRun(`UPDATE stocks SET quantity = ? WHERE id = ?`, [nextQty, line.stock_id]);

//         await dbRun(`
//           INSERT INTO stock_movements
//           (movement_no, movement_date, stock_id, stock_code, part_name, movement_type, quantity, previous_stock, next_stock, description, created_by, created_at)
//           VALUES (?, datetime('now'), ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
//         `, [
//           "HRK" + Date.now() + line.id,
//           line.stock_id,
//           line.stock_code || stock.stock_code || "",
//           line.part_name || stock.part_name || "",
//           diff > 0 ? "Sayım Fazlası" : "Sayım Eksiği",
//           Math.abs(diff),
//           previousQty,
//           nextQty,
//           `${count.count_no} numaralı sayım fişi onayı`,
//           approvedBy
//         ]);
//       }

//       await dbRun(`UPDATE stock_counts SET status = 'Onaylandı', approved_by = ?, approved_at = datetime('now') WHERE id = ?`, [approvedBy, countId]);
//       await dbRun("COMMIT");
//       res.json({ success: true, message: "Sayım fişi onaylandı ve stoklar güncellendi." });
//     } catch (err) {
//       await dbRun("ROLLBACK");
//       throw err;
//     }
//   } catch (err) {
//     console.error("Sayım onaylama hatası:", err);
//     res.status(500).json({ success: false, message: err.message });
//   }
// });

// /* ==========================================================
//    DEPOLAR ARASI TRANSFER ONAYI BACKEND
//    app.js içine ekle
//    Not: Mevcut db ve app değişkenlerini kullanır.
// ========================================================== */

// db.serialize(() => {
//   db.run(`
//     CREATE TABLE IF NOT EXISTS transfer_approvals (
//       id INTEGER PRIMARY KEY AUTOINCREMENT,
//       transfer_id INTEGER NOT NULL,
//       approved_by TEXT,
//       approved_date DATETIME,
//       status TEXT DEFAULT 'Onay Bekliyor',
//       note TEXT,
//       created_at DATETIME DEFAULT CURRENT_TIMESTAMP
//     )
//   `);

//   db.run(`
//     CREATE TABLE IF NOT EXISTS stock_transfer_lines (
//       id INTEGER PRIMARY KEY AUTOINCREMENT,
//       transfer_id INTEGER NOT NULL,
//       stock_id INTEGER,
//       stock_code TEXT,
//       part_name TEXT,
//       quantity REAL DEFAULT 0,
//       unit TEXT DEFAULT 'Adet',
//       source_location TEXT,
//       target_location TEXT,
//       note TEXT,
//       created_at DATETIME DEFAULT CURRENT_TIMESTAMP
//     )
//   `);
// });

// /* Promise helperlar sende varsa tekrar ekleme */
// function dbAll(sql, params = []) {
//   return new Promise((resolve, reject) => {
//     db.all(sql, params, (err, rows) => err ? reject(err) : resolve(rows));
//   });
// }

// function dbGet(sql, params = []) {
//   return new Promise((resolve, reject) => {
//     db.get(sql, params, (err, row) => err ? reject(err) : resolve(row));
//   });
// }

// function dbRun(sql, params = []) {
//   return new Promise((resolve, reject) => {
//     db.run(sql, params, function(err) {
//       if (err) reject(err);
//       else resolve(this);
//     });
//   });
// }

// function generateTransferNo() {
//   return "TRF" + Date.now();
// }

// /* Transfer tablonda kolon eksikse güvenli şekilde ekler */
// function ensureTransferColumns() {
//   const columns = [
//     ["transfer_no", "TEXT"],
//     ["source_warehouse_id", "INTEGER"],
//     ["target_warehouse_id", "INTEGER"],
//     ["source_warehouse_name", "TEXT"],
//     ["target_warehouse_name", "TEXT"],
//     ["transfer_date", "DATE"],
//     ["status", "TEXT DEFAULT 'Onay Bekliyor'"],
//     ["description", "TEXT"],
//     ["created_by", "TEXT"],
//     ["approved_by", "TEXT"],
//     ["approved_at", "DATETIME"],
//     ["rejected_by", "TEXT"],
//     ["rejected_at", "DATETIME"],
//     ["reject_reason", "TEXT"],
//     ["created_at", "DATETIME DEFAULT CURRENT_TIMESTAMP"]
//   ];

//   db.all(`PRAGMA table_info(stock_transfers)`, [], (err, rows) => {
//     if (err) return;

//     const existing = rows.map(r => r.name);

//     columns.forEach(([name, type]) => {
//       if (!existing.includes(name)) {
//         db.run(`ALTER TABLE stock_transfers ADD COLUMN ${name} ${type}`, [], alterErr => {
//           if (alterErr) console.log("Transfer kolon ekleme uyarısı:", name, alterErr.message);
//         });
//       }
//     });
//   });
// }

// db.run(`
//   CREATE TABLE IF NOT EXISTS stock_transfers (
//     id INTEGER PRIMARY KEY AUTOINCREMENT,
//     transfer_no TEXT UNIQUE,
//     source_warehouse_id INTEGER,
//     target_warehouse_id INTEGER,
//     source_warehouse_name TEXT,
//     target_warehouse_name TEXT,
//     transfer_date DATE DEFAULT CURRENT_DATE,
//     status TEXT DEFAULT 'Onay Bekliyor',
//     description TEXT,
//     created_by TEXT,
//     approved_by TEXT,
//     approved_at DATETIME,
//     rejected_by TEXT,
//     rejected_at DATETIME,
//     reject_reason TEXT,
//     created_at DATETIME DEFAULT CURRENT_TIMESTAMP
//   )
// `, ensureTransferColumns);

// /* TRANSFERLERİ LİSTELE */
// app.get("/api/transfers", async (req, res) => {
//   try {
//     const rows = await dbAll(`
//       SELECT 
//         st.*,
//         COUNT(stl.id) AS line_count,
//         IFNULL(SUM(stl.quantity), 0) AS total_quantity
//       FROM stock_transfers st
//       LEFT JOIN stock_transfer_lines stl ON stl.transfer_id = st.id
//       GROUP BY st.id
//       ORDER BY st.id DESC
//     `);

//     res.json({ success: true, transfers: rows });
//   } catch (err) {
//     console.error("Transferler alınamadı:", err);
//     res.status(500).json({ success: false, message: err.message });
//   }
// });

// /* TRANSFER DETAY */
// app.get("/api/transfers/:id", async (req, res) => {
//   try {
//     const transfer = await dbGet(`
//       SELECT *
//       FROM stock_transfers
//       WHERE id = ?
//     `, [req.params.id]);

//     if (!transfer) {
//       return res.status(404).json({
//         success: false,
//         message: "Transfer kaydı bulunamadı."
//       });
//     }

//     const lines = await dbAll(`
//       SELECT *
//       FROM stock_transfer_lines
//       WHERE transfer_id = ?
//       ORDER BY id ASC
//     `, [req.params.id]);

//     res.json({ success: true, transfer, lines });
//   } catch (err) {
//     console.error("Transfer detay hatası:", err);
//     res.status(500).json({ success: false, message: err.message });
//   }
// });

// /* STOKLARI LİSTELE - sayfada malzeme seçimi için */
// app.get("/api/transfer/stocks", async (req, res) => {
//   try {
//     const rows = await dbAll(`
//       SELECT 
//         id,
//         stock_code,
//         part_name,
//         quantity,
//         unit,
//         location
//       FROM stocks
//       WHERE IFNULL(status, 'active') != 'passive'
//       ORDER BY part_name ASC
//     `);

//     res.json({ success: true, stocks: rows });
//   } catch (err) {
//     console.error("Transfer stok listesi hatası:", err);
//     res.status(500).json({ success: false, message: err.message });
//   }
// });

// /* TRANSFER OLUŞTUR */
// app.post("/api/transfers", async (req, res) => {
//   try {
//     const {
//       source_warehouse_id,
//       target_warehouse_id,
//       source_warehouse_name,
//       target_warehouse_name,
//       transfer_date,
//       description,
//       created_by,
//       lines
//     } = req.body;

//     if (!source_warehouse_name || !target_warehouse_name) {
//       return res.status(400).json({
//         success: false,
//         message: "Kaynak depo ve hedef depo zorunludur."
//       });
//     }

//     if (source_warehouse_name === target_warehouse_name) {
//       return res.status(400).json({
//         success: false,
//         message: "Kaynak depo ile hedef depo aynı olamaz."
//       });
//     }

//     if (!Array.isArray(lines) || lines.length === 0) {
//       return res.status(400).json({
//         success: false,
//         message: "En az bir transfer satırı girilmelidir."
//       });
//     }

//     await dbRun("BEGIN TRANSACTION");

//     try {
//       const transferNo = generateTransferNo();

//       const result = await dbRun(`
//         INSERT INTO stock_transfers
//         (
//           transfer_no,
//           source_warehouse_id,
//           target_warehouse_id,
//           source_warehouse_name,
//           target_warehouse_name,
//           transfer_date,
//           status,
//           description,
//           created_by
//         )
//         VALUES (?, ?, ?, ?, ?, ?, 'Onay Bekliyor', ?, ?)
//       `, [
//         transferNo,
//         source_warehouse_id || null,
//         target_warehouse_id || null,
//         source_warehouse_name,
//         target_warehouse_name,
//         transfer_date || new Date().toISOString().slice(0, 10),
//         description || "",
//         created_by || "Sistem"
//       ]);

//       const transferId = result.lastID;

//       for (const line of lines) {
//         if (!line.stock_id || Number(line.quantity || 0) <= 0) {
//           throw new Error("Transfer satırlarında malzeme ve miktar zorunludur.");
//         }

//         const stock = await dbGet(`
//           SELECT *
//           FROM stocks
//           WHERE id = ?
//         `, [line.stock_id]);

//         if (!stock) {
//           throw new Error("Seçilen stok bulunamadı.");
//         }

//         await dbRun(`
//           INSERT INTO stock_transfer_lines
//           (
//             transfer_id,
//             stock_id,
//             stock_code,
//             part_name,
//             quantity,
//             unit,
//             source_location,
//             target_location,
//             note
//           )
//           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
//         `, [
//           transferId,
//           stock.id,
//           stock.stock_code || "",
//           stock.part_name || "",
//           Number(line.quantity || 0),
//           stock.unit || line.unit || "Adet",
//           line.source_location || stock.location || "",
//           line.target_location || target_warehouse_name || "",
//           line.note || ""
//         ]);
//       }

//       await dbRun(`
//         INSERT INTO transfer_approvals
//         (transfer_id, status, note)
//         VALUES (?, 'Onay Bekliyor', 'Transfer onay bekliyor')
//       `, [transferId]);

//       await dbRun("COMMIT");

//       res.json({
//         success: true,
//         message: "Transfer oluşturuldu ve onaya gönderildi.",
//         id: transferId,
//         transfer_no: transferNo
//       });

//     } catch (err) {
//       await dbRun("ROLLBACK");
//       throw err;
//     }

//   } catch (err) {
//     console.error("Transfer oluşturma hatası:", err);
//     res.status(500).json({ success: false, message: err.message });
//   }
// });

// /* TRANSFER ONAYLA */
// app.put("/api/transfers/:id/approve", async (req, res) => {
//   try {
//     const transferId = req.params.id;
//     const approvedBy = req.body.approved_by || req.headers["x-user-name"] || "Sistem";

//     const transfer = await dbGet(`
//       SELECT *
//       FROM stock_transfers
//       WHERE id = ?
//     `, [transferId]);

//     if (!transfer) {
//       return res.status(404).json({
//         success: false,
//         message: "Transfer kaydı bulunamadı."
//       });
//     }

//     if (transfer.status === "Onaylandı") {
//       return res.status(400).json({
//         success: false,
//         message: "Bu transfer zaten onaylanmış."
//       });
//     }

//     if (transfer.status === "Reddedildi") {
//       return res.status(400).json({
//         success: false,
//         message: "Reddedilmiş transfer onaylanamaz."
//       });
//     }

//     const lines = await dbAll(`
//       SELECT *
//       FROM stock_transfer_lines
//       WHERE transfer_id = ?
//     `, [transferId]);

//     if (!lines.length) {
//       return res.status(400).json({
//         success: false,
//         message: "Transfer satırı bulunamadı."
//       });
//     }

//     await dbRun("BEGIN TRANSACTION");

//     try {
//       for (const line of lines) {
//         const stock = await dbGet(`
//           SELECT *
//           FROM stocks
//           WHERE id = ?
//         `, [line.stock_id]);

//         if (!stock) {
//           throw new Error(`${line.part_name || line.stock_code} stok kartı bulunamadı.`);
//         }

//         const qty = Number(line.quantity || 0);
//         const previousQty = Number(stock.quantity || 0);

//         if (previousQty < qty) {
//           throw new Error(`${stock.part_name || stock.stock_code} için yeterli stok yok. Mevcut: ${previousQty}, İstenen: ${qty}`);
//         }

//         const nextQty = previousQty - qty;

//         await dbRun(`
//           UPDATE stocks
//           SET quantity = ?
//           WHERE id = ?
//         `, [nextQty, stock.id]);

//         await dbRun(`
//           INSERT INTO stock_movements
//           (
//             movement_no,
//             movement_date,
//             stock_id,
//             stock_code,
//             part_name,
//             movement_type,
//             quantity,
//             previous_stock,
//             next_stock,
//             description,
//             created_by,
//             created_at
//           )
//           VALUES (?, datetime('now'), ?, ?, ?, 'Transfer Çıkış', ?, ?, ?, ?, ?, datetime('now'))
//         `, [
//           "HRK" + Date.now() + line.id + "C",
//           stock.id,
//           stock.stock_code || "",
//           stock.part_name || "",
//           qty,
//           previousQty,
//           nextQty,
//           `${transfer.transfer_no} - ${transfer.source_warehouse_name} → ${transfer.target_warehouse_name}`,
//           approvedBy
//         ]);

//         /*
//           Not:
//           Tek stok kartında quantity tuttuğun için hedef depoya ayrı stok kartı açmıyoruz.
//           Depo bazlı stok yapısına geçtiğinde burada target warehouse stok satırı artırılır.
//           Şimdilik genel stoktan düşüp transfer hareketi logluyoruz.
//         */

//         await dbRun(`
//           INSERT INTO stock_movements
//           (
//             movement_no,
//             movement_date,
//             stock_id,
//             stock_code,
//             part_name,
//             movement_type,
//             quantity,
//             previous_stock,
//             next_stock,
//             description,
//             created_by,
//             created_at
//           )
//           VALUES (?, datetime('now'), ?, ?, ?, 'Transfer Giriş', ?, ?, ?, ?, ?, datetime('now'))
//         `, [
//           "HRK" + Date.now() + line.id + "G",
//           stock.id,
//           stock.stock_code || "",
//           stock.part_name || "",
//           qty,
//           nextQty,
//           nextQty,
//           `${transfer.transfer_no} - ${transfer.target_warehouse_name} deposuna giriş kaydı`,
//           approvedBy
//         ]);
//       }

//       await dbRun(`
//         UPDATE stock_transfers
//         SET status = 'Onaylandı',
//             approved_by = ?,
//             approved_at = datetime('now')
//         WHERE id = ?
//       `, [approvedBy, transferId]);

//       await dbRun(`
//         UPDATE transfer_approvals
//         SET status = 'Onaylandı',
//             approved_by = ?,
//             approved_date = datetime('now'),
//             note = 'Transfer onaylandı'
//         WHERE transfer_id = ?
//       `, [approvedBy, transferId]);

//       await dbRun("COMMIT");

//       res.json({
//         success: true,
//         message: "Transfer onaylandı ve stok hareketleri oluşturuldu."
//       });

//     } catch (err) {
//       await dbRun("ROLLBACK");
//       throw err;
//     }

//   } catch (err) {
//     console.error("Transfer onaylama hatası:", err);
//     res.status(500).json({ success: false, message: err.message });
//   }
// });

// /* TRANSFER REDDET */
// app.put("/api/transfers/:id/reject", async (req, res) => {
//   try {
//     const transferId = req.params.id;
//     const rejectedBy = req.body.rejected_by || req.headers["x-user-name"] || "Sistem";
//     const rejectReason = req.body.reject_reason || "Sebep belirtilmedi";

//     const transfer = await dbGet(`
//       SELECT *
//       FROM stock_transfers
//       WHERE id = ?
//     `, [transferId]);

//     if (!transfer) {
//       return res.status(404).json({
//         success: false,
//         message: "Transfer kaydı bulunamadı."
//       });
//     }

//     if (transfer.status === "Onaylandı") {
//       return res.status(400).json({
//         success: false,
//         message: "Onaylanmış transfer reddedilemez."
//       });
//     }

//     await dbRun(`
//       UPDATE stock_transfers
//       SET status = 'Reddedildi',
//           rejected_by = ?,
//           rejected_at = datetime('now'),
//           reject_reason = ?
//       WHERE id = ?
//     `, [rejectedBy, rejectReason, transferId]);

//     await dbRun(`
//       UPDATE transfer_approvals
//       SET status = 'Reddedildi',
//           approved_by = ?,
//           approved_date = datetime('now'),
//           note = ?
//       WHERE transfer_id = ?
//     `, [rejectedBy, rejectReason, transferId]);

//     res.json({
//       success: true,
//       message: "Transfer reddedildi."
//     });

//   } catch (err) {
//     console.error("Transfer reddetme hatası:", err);
//     res.status(500).json({ success: false, message: err.message });
//   }
// });

// /* TRANSFER SİL */
// app.delete("/api/transfers/:id", async (req, res) => {
//   try {
//     const transfer = await dbGet(`
//       SELECT *
//       FROM stock_transfers
//       WHERE id = ?
//     `, [req.params.id]);

//     if (!transfer) {
//       return res.status(404).json({
//         success: false,
//         message: "Transfer kaydı bulunamadı."
//       });
//     }

//     if (transfer.status === "Onaylandı") {
//       return res.status(400).json({
//         success: false,
//         message: "Onaylanmış transfer silinemez."
//       });
//     }

//     await dbRun(`DELETE FROM transfer_approvals WHERE transfer_id = ?`, [req.params.id]);
//     await dbRun(`DELETE FROM stock_transfer_lines WHERE transfer_id = ?`, [req.params.id]);
//     await dbRun(`DELETE FROM stock_transfers WHERE id = ?`, [req.params.id]);

//     res.json({
//       success: true,
//       message: "Transfer silindi."
//     });

//   } catch (err) {
//     console.error("Transfer silme hatası:", err);
//     res.status(500).json({ success: false, message: err.message });
//   }
// });

// const multer = require("multer");
// const fs = require("fs");

// const documentUploadDir = path.join(__dirname, "uploads", "documents");

// if (!fs.existsSync(documentUploadDir)) {
//   fs.mkdirSync(documentUploadDir, { recursive: true });
// }

// const documentStorage = multer.diskStorage({
//   destination: function(req, file, cb) {
//     cb(null, documentUploadDir);
//   },
//   filename: function(req, file, cb) {
//     const safeOriginal = file.originalname
//       .replace(/[^\wğüşöçıİĞÜŞÖÇ.\- ]/gi, "")
//       .replace(/\s+/g, "_");

//     cb(null, Date.now() + "_" + safeOriginal);
//   }
// });

// const documentUpload = multer({
//   storage: documentStorage,
//   limits: {
//     fileSize: 50 * 1024 * 1024
//   },
//   fileFilter: function(req, file, cb) {
// const allowed = [
//   ".pdf",
//   ".dxf",
//   ".dwg",
//   ".step",
//   ".stp",
//   ".stl",
//   ".igs",
//   ".iges",
//   ".x_t",
//   ".x_b",
//   ".sldprt",
//   ".sldasm",
//   ".ipt",
//   ".iam",
//   ".jpg",
//   ".jpeg",
//   ".png",
//   ".webp",
//   ".bmp",
//   ".xlsx",
//   ".xls",
//   ".csv",
//   ".docx",
//   ".doc",
//   ".txt",
//   ".zip",
//   ".rar",
//   ".7z"
// ];


//     const ext = path.extname(file.originalname).toLowerCase();

//     if (!allowed.includes(ext)) {
//       return cb(new Error("Bu dosya türüne izin verilmiyor."));
//     }

//     cb(null, true);
//   }
// });

// db.serialize(() => {
//   db.run(`
//     CREATE TABLE IF NOT EXISTS documents (
//       id INTEGER PRIMARY KEY AUTOINCREMENT,
//       document_no TEXT UNIQUE,
//       work_order_id INTEGER,
//       work_order_no TEXT,
//       document_type TEXT,
//       title TEXT NOT NULL,
//       revision_no TEXT DEFAULT 'R0',
//       file_name TEXT,
//       original_file_name TEXT,
//       file_path TEXT,
//       file_ext TEXT,
//       file_size INTEGER DEFAULT 0,
//       description TEXT,
//       status TEXT DEFAULT 'Aktif',
//       uploaded_by TEXT,
//       uploaded_at DATETIME DEFAULT CURRENT_TIMESTAMP
//     )
//   `);
// });

// function generateDocumentNo() {
//   return "DOC" + Date.now();
// }

// /* Promise helperlar sende varsa tekrar ekleme */
// function dbAll(sql, params = []) {
//   return new Promise((resolve, reject) => {
//     db.all(sql, params, (err, rows) => err ? reject(err) : resolve(rows));
//   });
// }

// function dbGet(sql, params = []) {
//   return new Promise((resolve, reject) => {
//     db.get(sql, params, (err, row) => err ? reject(err) : resolve(row));
//   });
// }

// function dbRun(sql, params = []) {
//   return new Promise((resolve, reject) => {
//     db.run(sql, params, function(err) {
//       if (err) reject(err);
//       else resolve(this);
//     });
//   });
// }

// /* ==========================================================
//    MES LITE / OPERASYON TAKİBİ BACKEND
//    app.js / server.js içine ekle
// ========================================================== */

// db.serialize(() => {
//   db.run(`
//     CREATE TABLE IF NOT EXISTS production_operations (
//       id INTEGER PRIMARY KEY AUTOINCREMENT,
//       operation_no TEXT,
//       work_order_id INTEGER NOT NULL,
//       work_order_no TEXT,
//       operation_name TEXT NOT NULL,
//       machine_id INTEGER,
//       machine_name TEXT,
//       operator_id INTEGER,
//       operator_name TEXT,
//       planned_minutes INTEGER DEFAULT 0,
//       actual_minutes INTEGER DEFAULT 0,
//       start_time DATETIME,
//       end_time DATETIME,
//       status TEXT DEFAULT 'Beklemede',
//       scrap_quantity REAL DEFAULT 0,
//       good_quantity REAL DEFAULT 0,
//       note TEXT,
//       created_by TEXT,
//       created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
//       updated_at DATETIME
//     )
//   `);
// });

// /* Promise helperlar sende varsa tekrar ekleme */
// function dbAll(sql, params = []) {
//   return new Promise((resolve, reject) => {
//     db.all(sql, params, (err, rows) => err ? reject(err) : resolve(rows));
//   });
// }

// function dbGet(sql, params = []) {
//   return new Promise((resolve, reject) => {
//     db.get(sql, params, (err, row) => err ? reject(err) : resolve(row));
//   });
// }

// function dbRun(sql, params = []) {
//   return new Promise((resolve, reject) => {
//     db.run(sql, params, function(err) {
//       if (err) reject(err);
//       else resolve(this);
//     });
//   });
// }

// function generateOperationNo() {
//   return "OPR" + Date.now();
// }

// /* İş emirleri select için */
// app.get("/api/mes/work-orders", async (req, res) => {
//   try {
//     const rows = await dbAll(`
//       SELECT 
//         id,
//         work_order_no,
//         part_name,
//         title,
//         status,
//         delivery_date,
//         due_date
//       FROM work_orders
//       WHERE IFNULL(status, '') NOT IN ('Tamamlandı', 'completed', 'cancelled', 'İptal')
//       ORDER BY id DESC
//     `);

//     res.json({ success: true, workOrders: rows });
//   } catch (err) {
//     console.error("MES iş emirleri alınamadı:", err);
//     res.status(500).json({ success: false, message: err.message });
//   }
// });

// /* Makine listesi select için - tablo yoksa boş döner */
// app.get("/api/mes/machines", async (req, res) => {
//   try {
//     const table = await dbGet(`
//       SELECT name 
//       FROM sqlite_master 
//       WHERE type='table' AND name='machines'
//     `);

//     if (!table) {
//       return res.json({ success: true, machines: [] });
//     }

//     const rows = await dbAll(`
//       SELECT 
//         id,
//         machine_name,
//         name,
//         code,
//         status
//       FROM machines
//       ORDER BY id DESC
//     `);

//     res.json({
//       success: true,
//       machines: rows.map(m => ({
//         id: m.id,
//         machine_name: m.machine_name || m.name || m.code || ("Makine " + m.id),
//         status: m.status || ""
//       }))
//     });
//   } catch (err) {
//     console.error("MES makineler alınamadı:", err);
//     res.json({ success: true, machines: [] });
//   }
// });

// // ===============================
// // DOKÜMAN YÖNETİMİ - MULTER
// // ===============================


// // ===============================
// // DOKÜMAN YÖNETİMİ - TABLO
// // ===============================
// db.run(`
// CREATE TABLE IF NOT EXISTS documents (
//   id INTEGER PRIMARY KEY AUTOINCREMENT,
//   document_no TEXT UNIQUE,
//   document_name TEXT NOT NULL,
//   document_type TEXT,
//   file_name TEXT,
//   original_file_name TEXT,
//   file_path TEXT,
//   file_ext TEXT,
//   file_size INTEGER,
//   related_type TEXT,
//   related_id INTEGER,
//   description TEXT,
//   uploaded_by TEXT,
//   created_at DATETIME DEFAULT CURRENT_TIMESTAMP
// )
// `);

// // ===============================
// // DOKÜMAN NO OLUŞTUR
// // ===============================
// function generateDocumentNo(callback) {
//   db.get(`
//     SELECT COUNT(*) + 1 AS nextNo
//     FROM documents
//   `, [], (err, row) => {
//     if (err) return callback(err);

//     const no = "DOC-" + String(row.nextNo).padStart(5, "0");
//     callback(null, no);
//   });
// }

// // ===============================
// // DOKÜMAN LİSTELE
// // ===============================
// app.get("/api/documents", (req, res) => {
//   const {
//     search,
//     document_type,
//     related_type
//   } = req.query;

//   let sql = `
//     SELECT *
//     FROM documents
//     WHERE 1 = 1
//   `;

//   const params = [];

//   if (search) {
//     sql += `
//       AND (
//         document_no LIKE ?
//         OR document_name LIKE ?
//         OR original_file_name LIKE ?
//         OR description LIKE ?
//       )
//     `;
//     params.push(
//       `%${search}%`,
//       `%${search}%`,
//       `%${search}%`,
//       `%${search}%`
//     );
//   }

//   if (document_type && document_type !== "all") {
//     sql += ` AND document_type = ? `;
//     params.push(document_type);
//   }

//   if (related_type && related_type !== "all") {
//     sql += ` AND related_type = ? `;
//     params.push(related_type);
//   }

//   sql += `ORDER BY datetime(uploaded_at) DESC `;

//   db.all(sql, params, (err, rows) => {
//     if (err) {
//       console.error("Doküman listeleme hatası:", err);
//       return res.status(500).json({
//         success: false,
//         message: err.message
//       });
//     }

//     res.json({
//       success: true,
//       documents: rows || []
//     });
//   });
// });


// // ===============================
// // SAYIM YÖNETİMİ - TABLOLAR
// // ===============================
// db.run(`
// CREATE TABLE IF NOT EXISTS stock_counts (
//   id INTEGER PRIMARY KEY AUTOINCREMENT,
//   count_no TEXT UNIQUE,
//   count_date DATE DEFAULT CURRENT_DATE,
//   warehouse_id INTEGER,
//   description TEXT,
//   status TEXT DEFAULT 'Taslak',
//   created_by TEXT,
//   created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
//   approved_by TEXT,
//   approved_at DATETIME
// )
// `);

// db.run(`
// CREATE TABLE IF NOT EXISTS stock_count_lines (
//   id INTEGER PRIMARY KEY AUTOINCREMENT,
//   stock_count_id INTEGER NOT NULL,
//   stock_id INTEGER NOT NULL,
//   stock_code TEXT,
//   part_name TEXT,
//   unit TEXT,
//   erp_quantity REAL DEFAULT 0,
//   counted_quantity REAL DEFAULT 0,
//   difference_quantity REAL DEFAULT 0,
//   description TEXT,
//   FOREIGN KEY(stock_count_id) REFERENCES stock_counts(id)
// )
// `);

// // ===============================
// // SAYIM NO OLUŞTUR
// // ===============================
// function generateStockCountNo(callback) {
//   db.get(`
//     SELECT COUNT(*) + 1 AS nextNo
//     FROM stock_counts
//   `, [], (err, row) => {
//     if (err) return callback(err);

//     const no = "SYM-" + String(row.nextNo).padStart(5, "0");
//     callback(null, no);
//   });
// }


// // ===============================
// // SAYIM FİŞLERİ LİSTELE
// // ===============================
// app.get("/api/stock-counts", (req, res) => {
//   db.all(`
//     SELECT 
//       sc.*,
//       COUNT(scl.id) AS line_count,
//       SUM(ABS(IFNULL(scl.difference_quantity, 0))) AS total_difference
//     FROM stock_counts sc
//     LEFT JOIN stock_count_lines scl ON scl.stock_count_id = sc.id
//     GROUP BY sc.id
//     ORDER BY datetime(sc.created_at) DESC
//   `, [], (err, rows) => {
//     if (err) {
//       console.error("Sayım listeleme hatası:", err);
//       return res.status(500).json({
//         success: false,
//         message: err.message
//       });
//     }

//     res.json({
//       success: true,
//       stockCounts: rows || []
//     });
//   });
// });

// // ===============================
// // SAYIM FİŞLERİ LİSTELE
// // ===============================
// app.get("/api/stock-counts", (req, res) => {
//   db.all(`
//     SELECT 
//       sc.*,
//       COUNT(scl.id) AS line_count,
//       SUM(ABS(IFNULL(scl.difference_quantity, 0))) AS total_difference
//     FROM stock_counts sc
//     LEFT JOIN stock_count_lines scl ON scl.stock_count_id = sc.id
//     GROUP BY sc.id
//     ORDER BY datetime(sc.created_at) DESC
//   `, [], (err, rows) => {
//     if (err) {
//       console.error("Sayım listeleme hatası:", err);
//       return res.status(500).json({
//         success: false,
//         message: err.message
//       });
//     }

//     res.json({
//       success: true,
//       stockCounts: rows || []
//     });
//   });
// });

// // ===============================
// // SAYIM FİŞİ DETAY
// // ===============================
// app.get("/api/stock-counts/:id", (req, res) => {
//   const id = req.params.id;

//   db.get(`
//     SELECT *
//     FROM stock_counts
//     WHERE id = ?
//   `, [id], (err, count) => {
//     if (err) {
//       return res.status(500).json({
//         success: false,
//         message: err.message
//       });
//     }

//     if (!count) {
//       return res.status(404).json({
//         success: false,
//         message: "Sayım fişi bulunamadı."
//       });
//     }

//     db.all(`
//       SELECT *
//       FROM stock_count_lines
//       WHERE stock_count_id = ?
//       ORDER BY id ASC
//     `, [id], (lineErr, lines) => {
//       if (lineErr) {
//         return res.status(500).json({
//           success: false,
//           message: lineErr.message
//         });
//       }

//       res.json({
//         success: true,
//         stockCount: count,
//         lines: lines || []
//       });
//     });
//   });
// });

// // ===============================
// // SAYIMA STOK SATIRI EKLE
// // ===============================
// app.post("/api/stock-counts/:id/lines/add-stock", (req, res) => {
//   const stockCountId = req.params.id;
//   const { stock_id } = req.body;

//   if (!stock_id) {
//     return res.status(400).json({
//       success: false,
//       message: "Stok seçilmelidir."
//     });
//   }

//   db.get(`
//     SELECT *
//     FROM stock_counts
//     WHERE id = ?
//   `, [stockCountId], (countErr, count) => {
//     if (countErr) {
//       return res.status(500).json({
//         success: false,
//         message: countErr.message
//       });
//     }

//     if (!count) {
//       return res.status(404).json({
//         success: false,
//         message: "Sayım fişi bulunamadı."
//       });
//     }

//     if (count.status === "Onaylandı") {
//       return res.status(400).json({
//         success: false,
//         message: "Onaylanmış sayım fişine satır eklenemez."
//       });
//     }

//     db.get(`
//       SELECT *
//       FROM stocks
//       WHERE id = ?
//     `, [stock_id], (stockErr, stock) => {
//       if (stockErr) {
//         return res.status(500).json({
//           success: false,
//           message: stockErr.message
//         });
//       }

//       if (!stock) {
//         return res.status(404).json({
//           success: false,
//           message: "Stok bulunamadı."
//         });
//       }

//       db.get(`
//         SELECT id
//         FROM stock_count_lines
//         WHERE stock_count_id = ?
//           AND stock_id = ?
//       `, [stockCountId, stock_id], (existsErr, exists) => {
//         if (existsErr) {
//           return res.status(500).json({
//             success: false,
//             message: existsErr.message
//           });
//         }

//         if (exists) {
//           return res.status(400).json({
//             success: false,
//             message: "Bu stok zaten sayım fişinde mevcut."
//           });
//         }

//         db.run(`
//           INSERT INTO stock_count_lines (
//             stock_count_id,
//             stock_id,
//             stock_code,
//             part_name,
//             unit,
//             erp_quantity,
//             counted_quantity,
//             difference_quantity
//           )
//           VALUES (?, ?, ?, ?, ?, ?, ?, 0)
//         `, [
//           stockCountId,
//           stock.id,
//           stock.stock_code || stock.code || "",
//           stock.part_name || stock.name || "",
//           stock.unit || "Adet",
//           Number(stock.quantity || 0),
//           Number(stock.quantity || 0)
//         ], function(insertErr) {
//           if (insertErr) {
//             return res.status(500).json({
//               success: false,
//               message: insertErr.message
//             });
//           }

//           res.json({
//             success: true,
//             message: "Stok satırı sayıma eklendi.",
//             id: this.lastID
//           });
//         });
//       });
//     });
//   });
// });

// // ===============================
// // SAYIMA STOK SATIRI EKLE
// // ===============================
// app.post("/api/stock-counts/:id/lines/add-stock", (req, res) => {
//   const stockCountId = req.params.id;
//   const { stock_id } = req.body;

//   if (!stock_id) {
//     return res.status(400).json({
//       success: false,
//       message: "Stok seçilmelidir."
//     });
//   }

//   db.get(`
//     SELECT *
//     FROM stock_counts
//     WHERE id = ?
//   `, [stockCountId], (countErr, count) => {
//     if (countErr) {
//       return res.status(500).json({
//         success: false,
//         message: countErr.message
//       });
//     }

//     if (!count) {
//       return res.status(404).json({
//         success: false,
//         message: "Sayım fişi bulunamadı."
//       });
//     }

//     if (count.status === "Onaylandı") {
//       return res.status(400).json({
//         success: false,
//         message: "Onaylanmış sayım fişine satır eklenemez."
//       });
//     }

//     db.get(`
//       SELECT *
//       FROM stocks
//       WHERE id = ?
//     `, [stock_id], (stockErr, stock) => {
//       if (stockErr) {
//         return res.status(500).json({
//           success: false,
//           message: stockErr.message
//         });
//       }

//       if (!stock) {
//         return res.status(404).json({
//           success: false,
//           message: "Stok bulunamadı."
//         });
//       }

//       db.get(`
//         SELECT id
//         FROM stock_count_lines
//         WHERE stock_count_id = ?
//           AND stock_id = ?
//       `, [stockCountId, stock_id], (existsErr, exists) => {
//         if (existsErr) {
//           return res.status(500).json({
//             success: false,
//             message: existsErr.message
//           });
//         }

//         if (exists) {
//           return res.status(400).json({
//             success: false,
//             message: "Bu stok zaten sayım fişinde mevcut."
//           });
//         }

//         db.run(`
//           INSERT INTO stock_count_lines (
//             stock_count_id,
//             stock_id,
//             stock_code,
//             part_name,
//             unit,
//             erp_quantity,
//             counted_quantity,
//             difference_quantity
//           )
//           VALUES (?, ?, ?, ?, ?, ?, ?, 0)
//         `, [
//           stockCountId,
//           stock.id,
//           stock.stock_code || stock.code || "",
//           stock.part_name || stock.name || "",
//           stock.unit || "Adet",
//           Number(stock.quantity || 0),
//           Number(stock.quantity || 0)
//         ], function(insertErr) {
//           if (insertErr) {
//             return res.status(500).json({
//               success: false,
//               message: insertErr.message
//             });
//           }

//           res.json({
//             success: true,
//             message: "Stok satırı sayıma eklendi.",
//             id: this.lastID
//           });
//         });
//       });
//     });
//   });
// });

// // ===============================
// // SAYIM SATIRI GÜNCELLE
// // ===============================
// app.put("/api/stock-count-lines/:id", (req, res) => {
//   const lineId = req.params.id;
//   const {
//     counted_quantity,
//     description
//   } = req.body;

//   db.get(`
//     SELECT 
//       scl.*,
//       sc.status
//     FROM stock_count_lines scl
//     JOIN stock_counts sc ON sc.id = scl.stock_count_id
//     WHERE scl.id = ?
//   `, [lineId], (err, line) => {
//     if (err) {
//       return res.status(500).json({
//         success: false,
//         message: err.message
//       });
//     }

//     if (!line) {
//       return res.status(404).json({
//         success: false,
//         message: "Sayım satırı bulunamadı."
//       });
//     }

//     if (line.status === "Onaylandı") {
//       return res.status(400).json({
//         success: false,
//         message: "Onaylanmış sayım satırı güncellenemez."
//       });
//     }

//     const countedQty = Number(counted_quantity || 0);
//     const erpQty = Number(line.erp_quantity || 0);
//     const diffQty = countedQty - erpQty;

//     db.run(`
//       UPDATE stock_count_lines
//       SET
//         counted_quantity = ?,
//         difference_quantity = ?,
//         description = ?
//       WHERE id = ?
//     `, [
//       countedQty,
//       diffQty,
//       description || null,
//       lineId
//     ], function(updateErr) {
//       if (updateErr) {
//         return res.status(500).json({
//           success: false,
//           message: updateErr.message
//         });
//       }

//       res.json({
//         success: true,
//         message: "Sayım satırı güncellendi.",
//         difference_quantity: diffQty
//       });
//     });
//   });
// });

// // ===============================
// // SAYIM SATIRI SİL
// // ===============================
// app.delete("/api/stock-count-lines/:id", (req, res) => {
//   const lineId = req.params.id;

//   db.get(`
//     SELECT 
//       scl.*,
//       sc.status
//     FROM stock_count_lines scl
//     JOIN stock_counts sc ON sc.id = scl.stock_count_id
//     WHERE scl.id = ?
//   `, [lineId], (err, line) => {
//     if (err) {
//       return res.status(500).json({
//         success: false,
//         message: err.message
//       });
//     }

//     if (!line) {
//       return res.status(404).json({
//         success: false,
//         message: "Sayım satırı bulunamadı."
//       });
//     }

//     if (line.status === "Onaylandı") {
//       return res.status(400).json({
//         success: false,
//         message: "Onaylanmış sayım satırı silinemez."
//       });
//     }

//     db.run(`
//       DELETE FROM stock_count_lines
//       WHERE id = ?
//     `, [lineId], function(deleteErr) {
//       if (deleteErr) {
//         return res.status(500).json({
//           success: false,
//           message: deleteErr.message
//         });
//       }

//       res.json({
//         success: true,
//         message: "Sayım satırı silindi."
//       });
//     });
//   });
// });

// // ===============================
// // SAYIM SATIRI SİL
// // ===============================
// app.delete("/api/stock-count-lines/:id", (req, res) => {
//   const lineId = req.params.id;

//   db.get(`
//     SELECT 
//       scl.*,
//       sc.status
//     FROM stock_count_lines scl
//     JOIN stock_counts sc ON sc.id = scl.stock_count_id
//     WHERE scl.id = ?
//   `, [lineId], (err, line) => {
//     if (err) {
//       return res.status(500).json({
//         success: false,
//         message: err.message
//       });
//     }

//     if (!line) {
//       return res.status(404).json({
//         success: false,
//         message: "Sayım satırı bulunamadı."
//       });
//     }

//     if (line.status === "Onaylandı") {
//       return res.status(400).json({
//         success: false,
//         message: "Onaylanmış sayım satırı silinemez."
//       });
//     }

//     db.run(`
//       DELETE FROM stock_count_lines
//       WHERE id = ?
//     `, [lineId], function(deleteErr) {
//       if (deleteErr) {
//         return res.status(500).json({
//           success: false,
//           message: deleteErr.message
//         });
//       }

//       res.json({
//         success: true,
//         message: "Sayım satırı silindi."
//       });
//     });
//   });
// });

// // ===============================
// // TAKIM YÖNETİMİ - TABLOLAR
// // ===============================
// db.run(`
// CREATE TABLE IF NOT EXISTS tools (
//   id INTEGER PRIMARY KEY AUTOINCREMENT,
//   tool_code TEXT UNIQUE,
//   tool_name TEXT NOT NULL,
//   tool_type TEXT,
//   brand TEXT,
//   model TEXT,
//   diameter REAL,
//   total_life_minutes INTEGER DEFAULT 0,
//   used_life_minutes INTEGER DEFAULT 0,
//   remaining_life_minutes INTEGER DEFAULT 0,
//   location TEXT,
//   status TEXT DEFAULT 'Aktif',
//   last_change_date DATE,
//   description TEXT,
//   created_by TEXT,
//   created_at DATETIME DEFAULT CURRENT_TIMESTAMP
// )
// `);

// db.run(`
// CREATE TABLE IF NOT EXISTS tool_movements (
//   id INTEGER PRIMARY KEY AUTOINCREMENT,
//   tool_id INTEGER NOT NULL,
//   movement_type TEXT NOT NULL,
//   movement_date DATETIME DEFAULT CURRENT_TIMESTAMP,
//   machine_id INTEGER,
//   machine_name TEXT,
//   work_order_id INTEGER,
//   work_order_no TEXT,
//   used_minutes INTEGER DEFAULT 0,
//   before_used_minutes INTEGER DEFAULT 0,
//   after_used_minutes INTEGER DEFAULT 0,
//   before_remaining_minutes INTEGER DEFAULT 0,
//   after_remaining_minutes INTEGER DEFAULT 0,
//   description TEXT,
//   created_by TEXT,
//   created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
//   FOREIGN KEY(tool_id) REFERENCES tools(id)
// )
// `);

// // ===============================
// // TAKIM KODU OLUŞTUR
// // ===============================
// function generateToolCode(callback) {
//   db.get(`
//     SELECT COUNT(*) + 1 AS nextNo
//     FROM tools
//   `, [], (err, row) => {
//     if (err) return callback(err);

//     const code = "TLM-" + String(row.nextNo).padStart(5, "0");
//     callback(null, code);
//   });
// }
// // ===============================
// // TAKIMLARI LİSTELE
// // ===============================
// app.get("/api/tools", (req, res) => {
//   const {
//     search,
//     status,
//     tool_type
//   } = req.query;

//   let sql = `
//     SELECT *
//     FROM tools
//     WHERE 1 = 1
//   `;

//   const params = [];

//   if (search) {
//     sql += `
//       AND (
//         tool_code LIKE ?
//         OR tool_name LIKE ?
//         OR brand LIKE ?
//         OR model LIKE ?
//         OR location LIKE ?
//       )
//     `;
//     params.push(
//       `%${search}%`,
//       `%${search}%`,
//       `%${search}%`,
//       `%${search}%`,
//       `%${search}%`
//     );
//   }

//   if (status && status !== "all") {
//     sql += ` AND status = ? `;
//     params.push(status);
//   }

//   if (tool_type && tool_type !== "all") {
//     sql += ` AND tool_type = ? `;
//     params.push(tool_type);
//   }

//   sql += ` ORDER BY datetime(created_at) DESC `;

//   db.all(sql, params, (err, rows) => {
//     if (err) {
//       console.error("Takım listeleme hatası:", err);
//       return res.status(500).json({
//         success: false,
//         message: err.message
//       });
//     }

//     res.json({
//       success: true,
//       tools: rows || []
//     });
//   });
// });
// // ===============================
// // TAKIMLARI LİSTELE
// // ===============================
// app.get("/api/tools", (req, res) => {
//   const {
//     search,
//     status,
//     tool_type
//   } = req.query;

//   let sql = `
//     SELECT *
//     FROM tools
//     WHERE 1 = 1
//   `;

//   const params = [];

//   if (search) {
//     sql += `
//       AND (
//         tool_code LIKE ?
//         OR tool_name LIKE ?
//         OR brand LIKE ?
//         OR model LIKE ?
//         OR location LIKE ?
//       )
//     `;
//     params.push(
//       `%${search}%`,
//       `%${search}%`,
//       `%${search}%`,
//       `%${search}%`,
//       `%${search}%`
//     );
//   }

//   if (status && status !== "all") {
//     sql += ` AND status = ? `;
//     params.push(status);
//   }

//   if (tool_type && tool_type !== "all") {
//     sql += ` AND tool_type = ? `;
//     params.push(tool_type);
//   }

//   sql += ` ORDER BY datetime(created_at) DESC `;

//   db.all(sql, params, (err, rows) => {
//     if (err) {
//       console.error("Takım listeleme hatası:", err);
//       return res.status(500).json({
//         success: false,
//         message: err.message
//       });
//     }

//     res.json({
//       success: true,
//       tools: rows || []
//     });
//   });
// });

// // ===============================
// // TAKIM DETAY
// // ===============================
// app.get("/api/tools/:id", (req, res) => {
//   const id = req.params.id;

//   db.get(`
//     SELECT *
//     FROM tools
//     WHERE id = ?
//   `, [id], (err, tool) => {
//     if (err) {
//       return res.status(500).json({
//         success: false,
//         message: err.message
//       });
//     }

//     if (!tool) {
//       return res.status(404).json({
//         success: false,
//         message: "Takım bulunamadı."
//       });
//     }

//     db.all(`
//       SELECT *
//       FROM tool_movements
//       WHERE tool_id = ?
//       ORDER BY datetime(created_at) DESC
//     `, [id], (moveErr, movements) => {
//       if (moveErr) {
//         return res.status(500).json({
//           success: false,
//           message: moveErr.message
//         });
//       }

//       res.json({
//         success: true,
//         tool,
//         movements: movements || []
//       });
//     });
//   });
// });

// // ===============================
// // TAKIM GÜNCELLE
// // ===============================
// app.put("/api/tools/:id", (req, res) => {
//   const id = req.params.id;

//   const {
//     tool_name,
//     tool_type,
//     brand,
//     model,
//     diameter,
//     total_life_minutes,
//     used_life_minutes,
//     location,
//     status,
//     last_change_date,
//     description
//   } = req.body;

//   const totalLife = Number(total_life_minutes || 0);
//   const usedLife = Number(used_life_minutes || 0);
//   const remainingLife = Math.max(totalLife - usedLife, 0);

//   db.run(`
//     UPDATE tools
//     SET
//       tool_name = ?,
//       tool_type = ?,
//       brand = ?,
//       model = ?,
//       diameter = ?,
//       total_life_minutes = ?,
//       used_life_minutes = ?,
//       remaining_life_minutes = ?,
//       location = ?,
//       status = ?,
//       last_change_date = ?,
//       description = ?
//     WHERE id = ?
//   `, [
//     tool_name,
//     tool_type || null,
//     brand || null,
//     model || null,
//     diameter || null,
//     totalLife,
//     usedLife,
//     remainingLife,
//     location || null,
//     status || "Aktif",
//     last_change_date || null,
//     description || null,
//     id
//   ], function(err) {
//     if (err) {
//       console.error("Takım güncelleme hatası:", err);
//       return res.status(500).json({
//         success: false,
//         message: err.message
//       });
//     }

//     res.json({
//       success: true,
//       message: "Takım güncellendi."
//     });
//   });
// });

// // ===============================
// // TAKIM SİL
// // ===============================
// app.delete("/api/tools/:id", (req, res) => {
//   const id = req.params.id;

//   db.serialize(() => {
//     db.run(`
//       DELETE FROM tool_movements
//       WHERE tool_id = ?
//     `, [id]);

//     db.run(`
//       DELETE FROM tools
//       WHERE id = ?
//     `, [id], function(err) {
//       if (err) {
//         console.error("Takım silme hatası:", err);
//         return res.status(500).json({
//           success: false,
//           message: err.message
//         });
//       }

//       res.json({
//         success: true,
//         message: "Takım silindi."
//       });
//     });
//   });
// });

// // ===============================
// // TAKIM HAREKETİ EKLE
// // ===============================
// app.post("/api/tools/:id/movements", (req, res) => {
//   const toolId = req.params.id;

//   const {
//     movement_type,
//     machine_id,
//     machine_name,
//     work_order_id,
//     work_order_no,
//     used_minutes,
//     description
//   } = req.body;

//   if (!movement_type) {
//     return res.status(400).json({
//       success: false,
//       message: "Hareket tipi zorunludur."
//     });
//   }

//   db.get(`
//     SELECT *
//     FROM tools
//     WHERE id = ?
//   `, [toolId], (err, tool) => {
//     if (err) {
//       return res.status(500).json({
//         success: false,
//         message: err.message
//       });
//     }

//     if (!tool) {
//       return res.status(404).json({
//         success: false,
//         message: "Takım bulunamadı."
//       });
//     }

//     const usedMinutes = Number(used_minutes || 0);
//     const beforeUsed = Number(tool.used_life_minutes || 0);
//     const beforeRemaining = Number(tool.remaining_life_minutes || 0);

//     let afterUsed = beforeUsed;
//     let afterRemaining = beforeRemaining;
//     let newStatus = tool.status;

//     if (movement_type === "Kullanım") {
//       afterUsed = beforeUsed + usedMinutes;
//       afterRemaining = Math.max(Number(tool.total_life_minutes || 0) - afterUsed, 0);

//       if (afterRemaining <= 0) {
//         newStatus = "Ömrü Bitti";
//       } else if (Number(tool.total_life_minutes || 0) > 0 && afterRemaining <= Number(tool.total_life_minutes || 0) * 0.1) {
//         newStatus = "Kritik";
//       }
//     }

//     if (movement_type === "Değişim") {
//       afterUsed = 0;
//       afterRemaining = Number(tool.total_life_minutes || 0);
//       newStatus = "Aktif";
//     }

//     db.serialize(() => {
//       db.run("BEGIN TRANSACTION");

//       db.run(`
//         INSERT INTO tool_movements (
//           tool_id,
//           movement_type,
//           machine_id,
//           machine_name,
//           work_order_id,
//           work_order_no,
//           used_minutes,
//           before_used_minutes,
//           after_used_minutes,
//           before_remaining_minutes,
//           after_remaining_minutes,
//           description,
//           created_by
//         )
//         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
//       `, [
//         toolId,
//         movement_type,
//         machine_id || null,
//         machine_name || null,
//         work_order_id || null,
//         work_order_no || null,
//         usedMinutes,
//         beforeUsed,
//         afterUsed,
//         beforeRemaining,
//         afterRemaining,
//         description || null,
//         req.headers["x-user-name"] || "Sistem"
//       ], function(moveErr) {
//         if (moveErr) {
//           db.run("ROLLBACK");
//           return res.status(500).json({
//             success: false,
//             message: moveErr.message
//           });
//         }

//         db.run(`
//           UPDATE tools
//           SET
//             used_life_minutes = ?,
//             remaining_life_minutes = ?,
//             status = ?,
//             last_change_date = CASE WHEN ? = 'Değişim' THEN CURRENT_DATE ELSE last_change_date END
//           WHERE id = ?
//         `, [
//           afterUsed,
//           afterRemaining,
//           newStatus,
//           movement_type,
//           toolId
//         ], function(updateErr) {
//           if (updateErr) {
//             db.run("ROLLBACK");
//             return res.status(500).json({
//               success: false,
//               message: updateErr.message
//             });
//           }

//           db.run("COMMIT");

//           res.json({
//             success: true,
//             message: "Takım hareketi kaydedildi.",
//             remaining_life_minutes: afterRemaining,
//             status: newStatus
//           });
//         });
//       });
//     });
//   });
// });

// // ===============================
// // TAKIM ÖZET KPI
// // ===============================
// app.get("/api/tools-summary", (req, res) => {
//   db.get(`
//     SELECT
//       COUNT(*) AS total_tools,
//       SUM(CASE WHEN status = 'Aktif' THEN 1 ELSE 0 END) AS active_tools,
//       SUM(CASE WHEN status = 'Kritik' THEN 1 ELSE 0 END) AS critical_tools,
//       SUM(CASE WHEN status = 'Ömrü Bitti' THEN 1 ELSE 0 END) AS expired_tools
//     FROM tools
//   `, [], (err, row) => {
//     if (err) {
//       return res.status(500).json({
//         success: false,
//         message: err.message
//       });
//     }

//     res.json({
//       success: true,
//       summary: row || {}
//     });
//   });
// });

// // ===============================
// // SAYIM FİŞİ SİL
// // ===============================
// app.delete("/api/stock-counts/:id", (req, res) => {
//   const id = req.params.id;

//   db.get(`
//     SELECT *
//     FROM stock_counts
//     WHERE id = ?
//   `, [id], (err, count) => {
//     if (err) {
//       return res.status(500).json({
//         success: false,
//         message: err.message
//       });
//     }

//     if (!count) {
//       return res.status(404).json({
//         success: false,
//         message: "Sayım fişi bulunamadı."
//       });
//     }

//     if (count.status === "Onaylandı") {
//       return res.status(400).json({
//         success: false,
//         message: "Onaylanmış sayım fişi silinemez."
//       });
//     }

//     db.serialize(() => {
//       db.run("DELETE FROM stock_count_lines WHERE stock_count_id = ?", [id]);
//       db.run("DELETE FROM stock_counts WHERE id = ?", [id], function(deleteErr) {
//         if (deleteErr) {
//           return res.status(500).json({
//             success: false,
//             message: deleteErr.message
//           });
//         }

//         res.json({
//           success: true,
//           message: "Sayım fişi silindi."
//         });
//       });
//     });
//   });
// });

// /* =========================================================
//    CNC ERP - 6 MODÜL BACKEND
//    1) Takım Yönetimi
//    2) Kalibrasyon Takibi
//    3) Üretim Planlama
//    4) OEE Takibi
//    5) Satış Siparişi Yönetimi
//    6) Müşteri Portalı
// ========================================================= */

// function run(sql, params = []) {
//   return new Promise((resolve, reject) => {
//     db.run(sql, params, function (err) {
//       if (err) reject(err);
//       else resolve(this);
//     });
//   });
// }

// function all(sql, params = []) {
//   return new Promise((resolve, reject) => {
//     db.all(sql, params, (err, rows) => {
//       if (err) reject(err);
//       else resolve(rows);
//     });
//   });
// }

// function get(sql, params = []) {
//   return new Promise((resolve, reject) => {
//     db.get(sql, params, (err, row) => {
//       if (err) reject(err);
//       else resolve(row);
//     });
//   });
// }

// /* ===================== TABLOLAR ===================== */

// db.serialize(() => {
//   db.run(`
//     CREATE TABLE IF NOT EXISTS cutting_tools (
//       id INTEGER PRIMARY KEY AUTOINCREMENT,
//       tool_code TEXT UNIQUE,
//       tool_name TEXT NOT NULL,
//       tool_type TEXT,
//       diameter REAL,
//       brand TEXT,
//       stock_qty INTEGER DEFAULT 0,
//       min_qty INTEGER DEFAULT 0,
//       max_life_minutes INTEGER DEFAULT 0,
//       used_minutes INTEGER DEFAULT 0,
//       status TEXT DEFAULT 'Aktif',
//       location TEXT,
//       created_at DATETIME DEFAULT CURRENT_TIMESTAMP
//     )
//   `);

//   db.run(`
//     CREATE TABLE IF NOT EXISTS tool_usages (
//       id INTEGER PRIMARY KEY AUTOINCREMENT,
//       tool_id INTEGER,
//       work_order_id INTEGER,
//       machine_id INTEGER,
//       operator_id INTEGER,
//       usage_minutes INTEGER DEFAULT 0,
//       usage_date DATETIME DEFAULT CURRENT_TIMESTAMP,
//       note TEXT
//     )
//   `);

//   db.run(`
//     CREATE TABLE IF NOT EXISTS calibration_devices (
//       id INTEGER PRIMARY KEY AUTOINCREMENT,
//       device_code TEXT UNIQUE,
//       device_name TEXT NOT NULL,
//       device_type TEXT,
//       brand TEXT,
//       serial_no TEXT,
//       last_calibration_date DATE,
//       next_calibration_date DATE,
//       certificate_no TEXT,
//       status TEXT DEFAULT 'Aktif',
//       location TEXT,
//       created_at DATETIME DEFAULT CURRENT_TIMESTAMP
//     )
//   `);

//   db.run(`
//     CREATE TABLE IF NOT EXISTS calibration_records (
//       id INTEGER PRIMARY KEY AUTOINCREMENT,
//       device_id INTEGER,
//       calibration_date DATE,
//       next_date DATE,
//       company TEXT,
//       result TEXT,
//       certificate_file TEXT,
//       note TEXT,
//       created_at DATETIME DEFAULT CURRENT_TIMESTAMP
//     )
//   `);

//   db.run(`
//     CREATE TABLE IF NOT EXISTS production_schedule (
//       id INTEGER PRIMARY KEY AUTOINCREMENT,
//       schedule_no TEXT UNIQUE,
//       work_order_id INTEGER,
//       machine_id INTEGER,
//       operator_id INTEGER,
//       planned_start DATETIME,
//       planned_end DATETIME,
//       priority TEXT DEFAULT 'Normal',
//       status TEXT DEFAULT 'Planlandı',
//       note TEXT,
//       created_at DATETIME DEFAULT CURRENT_TIMESTAMP
//     )
//   `);

//   db.run(`
//     CREATE TABLE IF NOT EXISTS machine_capacity (
//       id INTEGER PRIMARY KEY AUTOINCREMENT,
//       machine_id INTEGER,
//       work_date DATE,
//       available_minutes INTEGER DEFAULT 480,
//       planned_minutes INTEGER DEFAULT 0,
//       created_at DATETIME DEFAULT CURRENT_TIMESTAMP
//     )
//   `);

//   db.run(`
//     CREATE TABLE IF NOT EXISTS oee_records (
//       id INTEGER PRIMARY KEY AUTOINCREMENT,
//       machine_id INTEGER,
//       work_date DATE,
//       planned_minutes INTEGER DEFAULT 0,
//       working_minutes INTEGER DEFAULT 0,
//       ideal_cycle_time REAL DEFAULT 0,
//       produced_qty INTEGER DEFAULT 0,
//       good_qty INTEGER DEFAULT 0,
//       scrap_qty INTEGER DEFAULT 0,
//       availability REAL DEFAULT 0,
//       performance REAL DEFAULT 0,
//       quality REAL DEFAULT 0,
//       oee REAL DEFAULT 0,
//       created_at DATETIME DEFAULT CURRENT_TIMESTAMP
//     )
//   `);

//   db.run(`
//     CREATE TABLE IF NOT EXISTS sales_orders (
//       id INTEGER PRIMARY KEY AUTOINCREMENT,
//       order_no TEXT UNIQUE,
//       customer_id INTEGER,
//       offer_id INTEGER,
//       order_date DATE,
//       delivery_date DATE,
//       status TEXT DEFAULT 'Açık',
//       total_amount REAL DEFAULT 0,
//       note TEXT,
//       created_at DATETIME DEFAULT CURRENT_TIMESTAMP
//     )
//   `);

//   db.run(`
//     CREATE TABLE IF NOT EXISTS sales_order_lines (
//       id INTEGER PRIMARY KEY AUTOINCREMENT,
//       sales_order_id INTEGER,
//       part_name TEXT,
//       description TEXT,
//       quantity REAL DEFAULT 0,
//       unit TEXT DEFAULT 'Adet',
//       unit_price REAL DEFAULT 0,
//       total_price REAL DEFAULT 0,
//       delivery_date DATE,
//       status TEXT DEFAULT 'Açık'
//     )
//   `);

//   db.run(`
//     CREATE TABLE IF NOT EXISTS customer_portal_users (
//       id INTEGER PRIMARY KEY AUTOINCREMENT,
//       customer_id INTEGER,
//       username TEXT UNIQUE,
//       password TEXT,
//       full_name TEXT,
//       email TEXT,
//       active INTEGER DEFAULT 1,
//       created_at DATETIME DEFAULT CURRENT_TIMESTAMP
//     )
//   `);
// });

// /* ===================== 1. TAKIM YÖNETİMİ ===================== */

// app.get("/api/tools", async (req, res) => {
//   try {
//     const rows = await all(`
//       SELECT *,
//       CASE
//         WHEN max_life_minutes > 0 AND used_minutes >= max_life_minutes THEN 'Ömrü Bitti'
//         WHEN max_life_minutes > 0 AND used_minutes >= max_life_minutes * 0.8 THEN 'Yakında Değişmeli'
//         ELSE status
//       END AS life_status
//       FROM cutting_tools
//       ORDER BY id DESC
//     `);
//     res.json({ success: true, data: rows });
//   } catch (err) {
//     res.status(500).json({ success: false, message: err.message });
//   }
// });

// app.post("/api/tools", async (req, res) => {
//   try {
//     const {
//       tool_code, tool_name, tool_type, diameter, brand,
//       stock_qty, min_qty, max_life_minutes, location
//     } = req.body;

//     await run(`
//       INSERT INTO cutting_tools
//       (tool_code, tool_name, tool_type, diameter, brand, stock_qty, min_qty, max_life_minutes, location)
//       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
//     `, [
//       tool_code, tool_name, tool_type, diameter, brand,
//       stock_qty || 0, min_qty || 0, max_life_minutes || 0, location
//     ]);

//     res.json({ success: true, message: "Takım eklendi." });
//   } catch (err) {
//     res.status(500).json({ success: false, message: err.message });
//   }
// });

// app.put("/api/tools/:id", async (req, res) => {
//   try {
//     const {
//       tool_code, tool_name, tool_type, diameter, brand,
//       stock_qty, min_qty, max_life_minutes, used_minutes, status, location
//     } = req.body;

//     await run(`
//       UPDATE cutting_tools SET
//       tool_code=?, tool_name=?, tool_type=?, diameter=?, brand=?,
//       stock_qty=?, min_qty=?, max_life_minutes=?, used_minutes=?, status=?, location=?
//       WHERE id=?
//     `, [
//       tool_code, tool_name, tool_type, diameter, brand,
//       stock_qty || 0, min_qty || 0, max_life_minutes || 0,
//       used_minutes || 0, status || "Aktif", location, req.params.id
//     ]);

//     res.json({ success: true, message: "Takım güncellendi." });
//   } catch (err) {
//     res.status(500).json({ success: false, message: err.message });
//   }
// });

// app.delete("/api/tools/:id", async (req, res) => {
//   try {
//     await run(`DELETE FROM cutting_tools WHERE id=?`, [req.params.id]);
//     res.json({ success: true, message: "Takım silindi." });
//   } catch (err) {
//     res.status(500).json({ success: false, message: err.message });
//   }
// });

// app.post("/api/tools/:id/usage", async (req, res) => {
//   try {
//     const { work_order_id, machine_id, operator_id, usage_minutes, note } = req.body;

//     await run(`
//       INSERT INTO tool_usages
//       (tool_id, work_order_id, machine_id, operator_id, usage_minutes, note)
//       VALUES (?, ?, ?, ?, ?, ?)
//     `, [req.params.id, work_order_id, machine_id, operator_id, usage_minutes || 0, note]);

//     await run(`
//       UPDATE cutting_tools
//       SET used_minutes = used_minutes + ?
//       WHERE id=?
//     `, [usage_minutes || 0, req.params.id]);

//     res.json({ success: true, message: "Takım kullanımı işlendi." });
//   } catch (err) {
//     res.status(500).json({ success: false, message: err.message });
//   }
// });

// /* ===================== 2. KALİBRASYON ===================== */

// app.get("/api/calibration-devices", async (req, res) => {
//   try {
//     const rows = await all(`
//       SELECT *,
//       CASE
//         WHEN next_calibration_date < date('now') THEN 'Gecikti'
//         WHEN next_calibration_date <= date('now', '+15 day') THEN 'Yaklaşıyor'
//         ELSE 'Uygun'
//       END AS calibration_status
//       FROM calibration_devices
//       ORDER BY next_calibration_date ASC
//     `);
//     res.json({ success: true, data: rows });
//   } catch (err) {
//     res.status(500).json({ success: false, message: err.message });
//   }
// });

// app.post("/api/calibration-devices", async (req, res) => {
//   try {
//     const {
//       device_code, device_name, device_type, brand, serial_no,
//       last_calibration_date, next_calibration_date, certificate_no, location
//     } = req.body;

//     await run(`
//       INSERT INTO calibration_devices
//       (device_code, device_name, device_type, brand, serial_no,
//        last_calibration_date, next_calibration_date, certificate_no, location)
//       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
//     `, [
//       device_code, device_name, device_type, brand, serial_no,
//       last_calibration_date, next_calibration_date, certificate_no, location
//     ]);

//     res.json({ success: true, message: "Cihaz eklendi." });
//   } catch (err) {
//     res.status(500).json({ success: false, message: err.message });
//   }
// });

// app.put("/api/calibration-devices/:id", async (req, res) => {
//   try {
//     const {
//       device_code, device_name, device_type, brand, serial_no,
//       last_calibration_date, next_calibration_date, certificate_no, status, location
//     } = req.body;

//     await run(`
//       UPDATE calibration_devices SET
//       device_code=?, device_name=?, device_type=?, brand=?, serial_no=?,
//       last_calibration_date=?, next_calibration_date=?, certificate_no=?, status=?, location=?
//       WHERE id=?
//     `, [
//       device_code, device_name, device_type, brand, serial_no,
//       last_calibration_date, next_calibration_date, certificate_no,
//       status || "Aktif", location, req.params.id
//     ]);

//     res.json({ success: true, message: "Cihaz güncellendi." });
//   } catch (err) {
//     res.status(500).json({ success: false, message: err.message });
//   }
// });

// app.delete("/api/calibration-devices/:id", async (req, res) => {
//   try {
//     await run(`DELETE FROM calibration_devices WHERE id=?`, [req.params.id]);
//     res.json({ success: true, message: "Cihaz silindi." });
//   } catch (err) {
//     res.status(500).json({ success: false, message: err.message });
//   }
// });

// app.post("/api/calibration-devices/:id/record", async (req, res) => {
//   try {
//     const { calibration_date, next_date, company, result, certificate_file, note } = req.body;

//     await run(`
//       INSERT INTO calibration_records
//       (device_id, calibration_date, next_date, company, result, certificate_file, note)
//       VALUES (?, ?, ?, ?, ?, ?, ?)
//     `, [req.params.id, calibration_date, next_date, company, result, certificate_file, note]);

//     await run(`
//       UPDATE calibration_devices
//       SET last_calibration_date=?, next_calibration_date=?, status='Aktif'
//       WHERE id=?
//     `, [calibration_date, next_date, req.params.id]);

//     res.json({ success: true, message: "Kalibrasyon kaydı işlendi." });
//   } catch (err) {
//     res.status(500).json({ success: false, message: err.message });
//   }
// });

// /* ===================== 3. ÜRETİM PLANLAMA ===================== */

// app.get("/api/production-schedule", async (req, res) => {
//   try {
//     const rows = await all(`
//       SELECT ps.*,
//              wo.work_order_no,
//              wo.title AS work_order_title,
//              m.machine_name,
//              e.full_name AS operator_name
//       FROM production_schedule ps
//       LEFT JOIN work_orders wo ON wo.id = ps.work_order_id
//       LEFT JOIN machines m ON m.id = ps.machine_id
//       LEFT JOIN employees e ON e.id = ps.operator_id
//       ORDER BY ps.planned_start ASC
//     `);
//     res.json({ success: true, data: rows });
//   } catch (err) {
//     res.status(500).json({ success: false, message: err.message });
//   }
// });

// app.post("/api/production-schedule", async (req, res) => {
//   try {
//     const {
//       schedule_no, work_order_id, machine_id, operator_id,
//       planned_start, planned_end, priority, note
//     } = req.body;

//     await run(`
//       INSERT INTO production_schedule
//       (schedule_no, work_order_id, machine_id, operator_id, planned_start, planned_end, priority, note)
//       VALUES (?, ?, ?, ?, ?, ?, ?, ?)
//     `, [
//       schedule_no, work_order_id, machine_id, operator_id,
//       planned_start, planned_end, priority || "Normal", note
//     ]);

//     res.json({ success: true, message: "Üretim planı eklendi." });
//   } catch (err) {
//     res.status(500).json({ success: false, message: err.message });
//   }
// });

// app.put("/api/production-schedule/:id", async (req, res) => {
//   try {
//     const {
//       schedule_no, work_order_id, machine_id, operator_id,
//       planned_start, planned_end, priority, status, note
//     } = req.body;

//     await run(`
//       UPDATE production_schedule SET
//       schedule_no=?, work_order_id=?, machine_id=?, operator_id=?,
//       planned_start=?, planned_end=?, priority=?, status=?, note=?
//       WHERE id=?
//     `, [
//       schedule_no, work_order_id, machine_id, operator_id,
//       planned_start, planned_end, priority || "Normal", status || "Planlandı", note, req.params.id
//     ]);

//     res.json({ success: true, message: "Üretim planı güncellendi." });
//   } catch (err) {
//     res.status(500).json({ success: false, message: err.message });
//   }
// });

// app.delete("/api/production-schedule/:id", async (req, res) => {
//   try {
//     await run(`DELETE FROM production_schedule WHERE id=?`, [req.params.id]);
//     res.json({ success: true, message: "Üretim planı silindi." });
//   } catch (err) {
//     res.status(500).json({ success: false, message: err.message });
//   }
// });

// /* ===================== 4. OEE ===================== */

// app.get("/api/oee", async (req, res) => {
//   db.all(`
//     SELECT *
//     FROM oee_records
//     ORDER BY work_date DESC, id DESC
//   `, [], (err, rows) => {
//     if (err) {
//       console.error("OEE listeleme hatası:", err.message);
//       return res.status(500).json({
//         success: false,
//         message: err.message
//       });
//     }

//     res.json({
//       success: true,
//       data: rows.map(x => ({
//         ...x,
//         machine_name: "Makine #" + (x.machine_id || "-")
//       }))
//     });
//   });
// });

// app.post("/api/oee", async (req, res) => {
//   try {
//     const {
//       machine_id, work_date, planned_minutes, working_minutes,
//       ideal_cycle_time, produced_qty, good_qty, scrap_qty
//     } = req.body;

//     const availability =
//       planned_minutes > 0 ? (working_minutes / planned_minutes) * 100 : 0;

//     const performance =
//       working_minutes > 0 && ideal_cycle_time > 0
//         ? ((ideal_cycle_time * produced_qty) / working_minutes) * 100
//         : 0;

//     const quality =
//       produced_qty > 0 ? (good_qty / produced_qty) * 100 : 0;

//     const oee =
//       (availability * performance * quality) / 10000;

//     await run(`
//       INSERT INTO oee_records
//       (machine_id, work_date, planned_minutes, working_minutes,
//        ideal_cycle_time, produced_qty, good_qty, scrap_qty,
//        availability, performance, quality, oee)
//       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
//     `, [
//       machine_id, work_date, planned_minutes || 0, working_minutes || 0,
//       ideal_cycle_time || 0, produced_qty || 0, good_qty || 0, scrap_qty || 0,
//       availability.toFixed(2), performance.toFixed(2), quality.toFixed(2), oee.toFixed(2)
//     ]);

//     res.json({ success: true, message: "OEE kaydı eklendi." });
//   } catch (err) {
//     res.status(500).json({ success: false, message: err.message });
//   }
// });

// app.get("/api/oee/dashboard", async (req, res) => {
//   try {
//     const rows = await all(`
//       SELECT
//         ROUND(AVG(availability), 2) AS avg_availability,
//         ROUND(AVG(performance), 2) AS avg_performance,
//         ROUND(AVG(quality), 2) AS avg_quality,
//         ROUND(AVG(oee), 2) AS avg_oee,
//         SUM(produced_qty) AS total_produced,
//         SUM(good_qty) AS total_good,
//         SUM(scrap_qty) AS total_scrap
//       FROM oee_records
//       WHERE work_date >= date('now', '-30 day')
//     `);

//     res.json({ success: true, data: rows[0] });
//   } catch (err) {
//     res.status(500).json({ success: false, message: err.message });
//   }
// });

// /* ===================== 5. SATIŞ SİPARİŞİ ===================== */

// app.get("/api/sales-orders", (req, res) => {
//   db.all(`
//     SELECT *
//     FROM sales_orders
//     ORDER BY id DESC
//   `, [], (err, rows) => {
//     if (err) {
//       console.error("Satış siparişi listeleme hatası:", err.message);
//       return res.status(500).json({
//         success: false,
//         message: err.message
//       });
//     }

//     res.json({
//       success: true,
//       data: rows.map(x => ({
//         ...x,
//         company_name: "Müşteri #" + (x.customer_id || "-")
//       }))
//     });
//   });
// });

// app.get("/api/sales-orders/:id", async (req, res) => {
//   try {
//     const order = await get(`
//       SELECT so.*, c.company_name
//       FROM sales_orders so
//       LEFT JOIN customers c ON c.id = so.customer_id
//       WHERE so.id=?
//     `, [req.params.id]);

//     const lines = await all(`
//       SELECT *
//       FROM sales_order_lines
//       WHERE sales_order_id=?
//     `, [req.params.id]);

//     res.json({ success: true, data: { order, lines } });
//   } catch (err) {
//     res.status(500).json({ success: false, message: err.message });
//   }
// });

// app.post("/api/sales-orders", async (req, res) => {
//   try {
//     const {
//       order_no, customer_id, offer_id, order_date,
//       delivery_date, status, note, lines
//     } = req.body;

//     let total = 0;
//     if (Array.isArray(lines)) {
//       total = lines.reduce((sum, l) => {
//         return sum + ((Number(l.quantity) || 0) * (Number(l.unit_price) || 0));
//       }, 0);
//     }

//     const result = await run(`
//       INSERT INTO sales_orders
//       (order_no, customer_id, offer_id, order_date, delivery_date, status, total_amount, note)
//       VALUES (?, ?, ?, ?, ?, ?, ?, ?)
//     `, [
//       order_no, customer_id, offer_id || null, order_date,
//       delivery_date, status || "Açık", total, note
//     ]);

//     const salesOrderId = result.lastID;

//     if (Array.isArray(lines)) {
//       for (const l of lines) {
//         const qty = Number(l.quantity) || 0;
//         const price = Number(l.unit_price) || 0;

//         await run(`
//           INSERT INTO sales_order_lines
//           (sales_order_id, part_name, description, quantity, unit, unit_price, total_price, delivery_date, status)
//           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
//         `, [
//           salesOrderId, l.part_name, l.description, qty,
//           l.unit || "Adet", price, qty * price,
//           l.delivery_date || delivery_date, l.status || "Açık"
//         ]);
//       }
//     }

//     res.json({ success: true, message: "Satış siparişi oluşturuldu.", id: salesOrderId });
//   } catch (err) {
//     res.status(500).json({ success: false, message: err.message });
//   }
// });

// app.put("/api/sales-orders/:id/status", async (req, res) => {
//   try {
//     await run(`
//       UPDATE sales_orders
//       SET status=?
//       WHERE id=?
//     `, [req.body.status, req.params.id]);

//     res.json({ success: true, message: "Sipariş durumu güncellendi." });
//   } catch (err) {
//     res.status(500).json({ success: false, message: err.message });
//   }
// });

// app.delete("/api/sales-orders/:id", async (req, res) => {
//   try {
//     await run(`DELETE FROM sales_order_lines WHERE sales_order_id=?`, [req.params.id]);
//     await run(`DELETE FROM sales_orders WHERE id=?`, [req.params.id]);

//     res.json({ success: true, message: "Satış siparişi silindi." });
//   } catch (err) {
//     res.status(500).json({ success: false, message: err.message });
//   }
// });

// /* ===================== 6. MÜŞTERİ PORTALI ===================== */

// app.post("/api/customer-portal/login", async (req, res) => {
//   try {
//     const { username, password } = req.body;

//     const user = await get(`
//       SELECT cpu.*, c.company_name
//       FROM customer_portal_users cpu
//       LEFT JOIN customers c ON c.id = cpu.customer_id
//       WHERE cpu.username=? AND cpu.password=? AND cpu.active=1
//     `, [username, password]);

//     if (!user) {
//       return res.status(401).json({
//         success: false,
//         message: "Kullanıcı adı veya şifre hatalı."
//       });
//     }

//     res.json({
//       success: true,
//       message: "Giriş başarılı.",
//       user: {
//         id: user.id,
//         customer_id: user.customer_id,
//         full_name: user.full_name,
//         company_name: user.company_name,
//         email: user.email
//       }
//     });
//   } catch (err) {
//     res.status(500).json({ success: false, message: err.message });
//   }
// });

// app.get("/api/customer-portal/:customerId/summary", async (req, res) => {
//   try {
//     const customerId = req.params.customerId;

//     const offers = await get(`
//       SELECT COUNT(*) AS total
//       FROM offers
//       WHERE customer_id=?
//     `, [customerId]);

//     const orders = await get(`
//       SELECT COUNT(*) AS total
//       FROM sales_orders
//       WHERE customer_id=?
//     `, [customerId]);

//     const workOrders = await get(`
//       SELECT COUNT(*) AS total
//       FROM work_orders
//       WHERE customer_id=?
//     `, [customerId]);

//     const shipments = await get(`
//       SELECT COUNT(*) AS total
//       FROM shipments
//       WHERE customer_id=?
//     `, [customerId]);

//     res.json({
//       success: true,
//       data: {
//         offers: offers.total,
//         sales_orders: orders.total,
//         work_orders: workOrders.total,
//         shipments: shipments.total
//       }
//     });
//   } catch (err) {
//     res.status(500).json({ success: false, message: err.message });
//   }
// });

// app.get("/api/customer-portal/:customerId/offers", async (req, res) => {
//   try {
//     const rows = await all(`
//       SELECT *
//       FROM offers
//       WHERE customer_id=?
//       ORDER BY id DESC
//     `, [req.params.customerId]);

//     res.json({ success: true, data: rows });
//   } catch (err) {
//     res.status(500).json({ success: false, message: err.message });
//   }
// });

// app.get("/api/customer-portal/:customerId/orders", async (req, res) => {
//   try {
//     const rows = await all(`
//       SELECT *
//       FROM sales_orders
//       WHERE customer_id=?
//       ORDER BY id DESC
//     `, [req.params.customerId]);

//     res.json({ success: true, data: rows });
//   } catch (err) {
//     res.status(500).json({ success: false, message: err.message });
//   }
// });

// app.get("/api/customer-portal/:customerId/work-orders", async (req, res) => {
//   try {
//     const rows = await all(`
//       SELECT *
//       FROM work_orders
//       WHERE customer_id=?
//       ORDER BY id DESC
//     `, [req.params.customerId]);

//     res.json({ success: true, data: rows });
//   } catch (err) {
//     res.status(500).json({ success: false, message: err.message });
//   }
// });

// app.get("/api/customer-portal/:customerId/shipments", async (req, res) => {
//   try {
//     const rows = await all(`
//       SELECT *
//       FROM shipments
//       WHERE customer_id=?
//       ORDER BY id DESC
//     `, [req.params.customerId]);

//     res.json({ success: true, data: rows });
//   } catch (err) {
//     res.status(500).json({ success: false, message: err.message });
//   }
// });

// app.post("/api/customer-portal/users", async (req, res) => {
//   try {
//     const { customer_id, username, password, full_name, email } = req.body;

//     await run(`
//       INSERT INTO customer_portal_users
//       (customer_id, username, password, full_name, email)
//       VALUES (?, ?, ?, ?, ?)
//     `, [customer_id, username, password, full_name, email]);

//     res.json({ success: true, message: "Portal kullanıcısı oluşturuldu." });
//   } catch (err) {
//     res.status(500).json({ success: false, message: err.message });
//   }
// });



// // ===============================
// // DOKÜMAN YÜKLE
// // ===============================
// app.post("/api/documents", documentUpload.single("file"), (req, res) => {
//   const {
//     document_name,
//     document_type,
//     related_type,
//     related_id,
//     description
//   } = req.body;

//   if (!document_name) {
//     return res.status(400).json({
//       success: false,
//       message: "Doküman adı zorunludur."
//     });
//   }

//   if (!req.file) {
//     return res.status(400).json({
//       success: false,
//       message: "Dosya seçilmelidir."
//     });
//   }

//   generateDocumentNo((noErr, documentNo) => {
//     if (noErr) {
//       return res.status(500).json({
//         success: false,
//         message: noErr.message
//       });
//     }

//     db.run(`
//       INSERT INTO documents (
//         document_no,
//         document_name,
//         document_type,
//         file_name,
//         original_file_name,
//         file_path,
//         file_ext,
//         file_size,
//         related_type,
//         related_id,
//         description,
//         uploaded_by
//       )
//       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
//     `, [
//       documentNo,
//       document_name,
//       document_type || "Genel",
//       req.file.filename,
//       req.file.originalname,
//       "/uploads/documents/" + req.file.filename,
//       path.extname(req.file.originalname).toLowerCase(),
//       req.file.size,
//       related_type || null,
//       related_id || null,
//       description || null,
//       req.headers["x-user-name"] || "Sistem"
//     ], function(err) {
//       if (err) {
//         console.error("Doküman kayıt hatası:", err);
//         return res.status(500).json({
//           success: false,
//           message: err.message
//         });
//       }

//       res.json({
//         success: true,
//         message: "Doküman başarıyla yüklendi.",
//         id: this.lastID,
//         document_no: documentNo
//       });
//     });
//   });
// });

// // ===============================
// // DOKÜMAN GÜNCELLE
// // ===============================
// app.put("/api/documents/:id", (req, res) => {
//   const {
//     document_name,
//     document_type,
//     related_type,
//     related_id,
//     description
//   } = req.body;

//   db.run(`
//     UPDATE documents
//     SET
//       document_name = ?,
//       document_type = ?,
//       related_type = ?,
//       related_id = ?,
//       description = ?
//     WHERE id = ?
//   `, [
//     document_name,
//     document_type,
//     related_type || null,
//     related_id || null,
//     description || null,
//     req.params.id
//   ], function(err) {
//     if (err) {
//       console.error("Doküman güncelleme hatası:", err);
//       return res.status(500).json({
//         success: false,
//         message: err.message
//       });
//     }

//     res.json({
//       success: true,
//       message: "Doküman güncellendi."
//     });
//   });
// });

// // ===============================
// // DOKÜMAN GÜNCELLE
// // ===============================
// app.put("/api/documents/:id", (req, res) => {
//   const {
//     document_name,
//     document_type,
//     related_type,
//     related_id,
//     description
//   } = req.body;

//   db.run(`
//     UPDATE documents
//     SET
//       document_name = ?,
//       document_type = ?,
//       related_type = ?,
//       related_id = ?,
//       description = ?
//     WHERE id = ?
//   `, [
//     document_name,
//     document_type,
//     related_type || null,
//     related_id || null,
//     description || null,
//     req.params.id
//   ], function(err) {
//     if (err) {
//       console.error("Doküman güncelleme hatası:", err);
//       return res.status(500).json({
//         success: false,
//         message: err.message
//       });
//     }

//     res.json({
//       success: true,
//       message: "Doküman güncellendi."
//     });
//   });
// });

// // ===============================
// // DOKÜMAN SİL
// // ===============================
// app.delete("/api/documents/:id", (req, res) => {
//   db.get(`
//     SELECT *
//     FROM documents
//     WHERE id = ?
//   `, [req.params.id], (err, doc) => {
//     if (err) {
//       return res.status(500).json({
//         success: false,
//         message: err.message
//       });
//     }

//     if (!doc) {
//       return res.status(404).json({
//         success: false,
//         message: "Doküman bulunamadı."
//       });
//     }

//     db.run(`
//       DELETE FROM documents
//       WHERE id = ?
//     `, [req.params.id], function(deleteErr) {
//       if (deleteErr) {
//         return res.status(500).json({
//           success: false,
//           message: deleteErr.message
//         });
//       }

//       const fullPath = path.join(__dirname, doc.file_path || "");

//       if (doc.file_path && fs.existsSync(fullPath)) {
//         fs.unlinkSync(fullPath);
//       }

//       res.json({
//         success: true,
//         message: "Doküman silindi."
//       });
//     });
//   });
// });

// /* Operatör listesi select için - users tablosundan çeker */
// app.get("/api/mes/operators", async (req, res) => {
//   try {
//     const rows = await dbAll(`
//       SELECT 
//         id,
//         full_name,
//         username,
//         role,
//         active
//       FROM users
//       WHERE IFNULL(active, 1) = 1
//       ORDER BY full_name ASC
//     `);

//     res.json({
//       success: true,
//       operators: rows.map(u => ({
//         id: u.id,
//         operator_name: u.full_name || u.username || ("Kullanıcı " + u.id),
//         role: u.role || ""
//       }))
//     });
//   } catch (err) {
//     console.error("MES operatörler alınamadı:", err);
//     res.status(500).json({ success: false, message: err.message });
//   }
// });

// /* Operasyonları listele */
// app.get("/api/mes/operations", async (req, res) => {
//   try {
//     const { workOrderId, status, q } = req.query;

//     const where = [];
//     const params = [];

//     if (workOrderId) {
//       where.push("work_order_id = ?");
//       params.push(workOrderId);
//     }

//     if (status) {
//       where.push("status = ?");
//       params.push(status);
//     }

//     if (q) {
//       where.push(`(
//         operation_no LIKE ? OR
//         work_order_no LIKE ? OR
//         operation_name LIKE ? OR
//         machine_name LIKE ? OR
//         operator_name LIKE ?
//       )`);
//       params.push(`%${q}%`, `%${q}%`, `%${q}%`, `%${q}%`, `%${q}%`);
//     }

//     const whereSql = where.length ? "WHERE " + where.join(" AND ") : "";

//     const rows = await dbAll(`
//       SELECT *
//       FROM production_operations
//       ${whereSql}
//       ORDER BY 
//         CASE status
//           WHEN 'Çalışıyor' THEN 1
//           WHEN 'Beklemede' THEN 2
//           WHEN 'Durdu' THEN 3
//           WHEN 'Tamamlandı' THEN 4
//           ELSE 5
//         END,
//         id DESC
//     `, params);

//     res.json({ success: true, operations: rows });
//   } catch (err) {
//     console.error("MES operasyonları alınamadı:", err);
//     res.status(500).json({ success: false, message: err.message });
//   }
// });

// /* MES KPI */
// app.get("/api/mes/kpi", async (req, res) => {
//   try {
//     const total = await dbGet(`SELECT COUNT(*) AS c FROM production_operations`);
//     const waiting = await dbGet(`SELECT COUNT(*) AS c FROM production_operations WHERE status = 'Beklemede'`);
//     const running = await dbGet(`SELECT COUNT(*) AS c FROM production_operations WHERE status = 'Çalışıyor'`);
//     const completed = await dbGet(`SELECT COUNT(*) AS c FROM production_operations WHERE status = 'Tamamlandı'`);
//     const stopped = await dbGet(`SELECT COUNT(*) AS c FROM production_operations WHERE status = 'Durdu'`);

//     const time = await dbGet(`
//       SELECT 
//         IFNULL(SUM(planned_minutes), 0) AS planned,
//         IFNULL(SUM(actual_minutes), 0) AS actual,
//         IFNULL(SUM(scrap_quantity), 0) AS scrap,
//         IFNULL(SUM(good_quantity), 0) AS good
//       FROM production_operations
//     `);

//     const progress = total.c > 0 ? Math.round((completed.c / total.c) * 100) : 0;

//     res.json({
//       success: true,
//       kpi: {
//         total: total.c,
//         waiting: waiting.c,
//         running: running.c,
//         completed: completed.c,
//         stopped: stopped.c,
//         plannedMinutes: time.planned,
//         actualMinutes: time.actual,
//         scrapQuantity: time.scrap,
//         goodQuantity: time.good,
//         progress
//       }
//     });
//   } catch (err) {
//     console.error("MES KPI alınamadı:", err);
//     res.status(500).json({ success: false, message: err.message });
//   }
// });

// /* Operasyon oluştur */
// app.post("/api/mes/operations", async (req, res) => {
//   try {
//     const {
//       work_order_id,
//       operation_name,
//       machine_id,
//       machine_name,
//       operator_id,
//       operator_name,
//       planned_minutes,
//       note,
//       created_by
//     } = req.body;

//     if (!work_order_id) {
//       return res.status(400).json({ success: false, message: "İş emri zorunludur." });
//     }

//     if (!operation_name) {
//       return res.status(400).json({ success: false, message: "Operasyon adı zorunludur." });
//     }

//     const wo = await dbGet(`
//       SELECT *
//       FROM work_orders
//       WHERE id = ?
//     `, [work_order_id]);

//     if (!wo) {
//       return res.status(404).json({ success: false, message: "İş emri bulunamadı." });
//     }

//     const operationNo = generateOperationNo();

//     const result = await dbRun(`
//       INSERT INTO production_operations
//       (
//         operation_no,
//         work_order_id,
//         work_order_no,
//         operation_name,
//         machine_id,
//         machine_name,
//         operator_id,
//         operator_name,
//         planned_minutes,
//         status,
//         note,
//         created_by
//       )
//       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'Beklemede', ?, ?)
//     `, [
//       operationNo,
//       work_order_id,
//       wo.work_order_no || "",
//       operation_name,
//       machine_id || null,
//       machine_name || "",
//       operator_id || null,
//       operator_name || "",
//       Number(planned_minutes || 0),
//       note || "",
//       created_by || req.headers["x-user-name"] || "Sistem"
//     ]);

//     res.json({
//       success: true,
//       message: "Operasyon oluşturuldu.",
//       id: result.lastID,
//       operation_no: operationNo
//     });

//   } catch (err) {
//     console.error("MES operasyon oluşturma hatası:", err);
//     res.status(500).json({ success: false, message: err.message });
//   }
// });

// /* Toplu standart operasyon oluştur */
// app.post("/api/mes/operations/create-standard", async (req, res) => {
//   try {
//     const { work_order_id, created_by } = req.body;

//     if (!work_order_id) {
//       return res.status(400).json({ success: false, message: "İş emri zorunludur." });
//     }

//     const wo = await dbGet(`
//       SELECT *
//       FROM work_orders
//       WHERE id = ?
//     `, [work_order_id]);

//     if (!wo) {
//       return res.status(404).json({ success: false, message: "İş emri bulunamadı." });
//     }

//     const exists = await dbGet(`
//       SELECT COUNT(*) AS c
//       FROM production_operations
//       WHERE work_order_id = ?
//     `, [work_order_id]);

//     if (exists.c > 0) {
//       return res.status(400).json({
//         success: false,
//         message: "Bu iş emrine daha önce operasyon tanımlanmış."
//       });
//     }

//     const standardOperations = [
//       { name: "Kesim", minutes: 60 },
//       { name: "Torna", minutes: 120 },
//       { name: "Freze", minutes: 120 },
//       { name: "Kalite Kontrol", minutes: 30 },
//       { name: "Paketleme", minutes: 30 }
//     ];

//     await dbRun("BEGIN TRANSACTION");

//     try {
//       for (const op of standardOperations) {
//         await dbRun(`
//           INSERT INTO production_operations
//           (
//             operation_no,
//             work_order_id,
//             work_order_no,
//             operation_name,
//             planned_minutes,
//             status,
//             created_by
//           )
//           VALUES (?, ?, ?, ?, ?, 'Beklemede', ?)
//         `, [
//           generateOperationNo() + Math.floor(Math.random() * 999),
//           work_order_id,
//           wo.work_order_no || "",
//           op.name,
//           op.minutes,
//           created_by || req.headers["x-user-name"] || "Sistem"
//         ]);
//       }

//       await dbRun("COMMIT");

//       res.json({
//         success: true,
//         message: "Standart operasyonlar oluşturuldu.",
//         count: standardOperations.length
//       });

//     } catch (err) {
//       await dbRun("ROLLBACK");
//       throw err;
//     }

//   } catch (err) {
//     console.error("Standart operasyon oluşturma hatası:", err);
//     res.status(500).json({ success: false, message: err.message });
//   }
// });

// /* Operasyon güncelle */
// app.put("/api/mes/operations/:id", async (req, res) => {
//   try {
//     const {
//       operation_name,
//       machine_id,
//       machine_name,
//       operator_id,
//       operator_name,
//       planned_minutes,
//       good_quantity,
//       scrap_quantity,
//       note
//     } = req.body;

//     const op = await dbGet(`
//       SELECT *
//       FROM production_operations
//       WHERE id = ?
//     `, [req.params.id]);

//     if (!op) {
//       return res.status(404).json({ success: false, message: "Operasyon bulunamadı." });
//     }

//     if (op.status === "Tamamlandı") {
//       return res.status(400).json({ success: false, message: "Tamamlanan operasyon düzenlenemez." });
//     }

//     await dbRun(`
//       UPDATE production_operations
//       SET
//         operation_name = ?,
//         machine_id = ?,
//         machine_name = ?,
//         operator_id = ?,
//         operator_name = ?,
//         planned_minutes = ?,
//         good_quantity = ?,
//         scrap_quantity = ?,
//         note = ?,
//         updated_at = datetime('now')
//       WHERE id = ?
//     `, [
//       operation_name || op.operation_name,
//       machine_id || null,
//       machine_name || "",
//       operator_id || null,
//       operator_name || "",
//       Number(planned_minutes || 0),
//       Number(good_quantity || 0),
//       Number(scrap_quantity || 0),
//       note || "",
//       req.params.id
//     ]);

//     res.json({ success: true, message: "Operasyon güncellendi." });

//   } catch (err) {
//     console.error("MES operasyon güncelleme hatası:", err);
//     res.status(500).json({ success: false, message: err.message });
//   }
// });

// /* Operasyon başlat */
// app.put("/api/mes/operations/:id/start", async (req, res) => {
//   try {
//     const op = await dbGet(`
//       SELECT *
//       FROM production_operations
//       WHERE id = ?
//     `, [req.params.id]);

//     if (!op) {
//       return res.status(404).json({ success: false, message: "Operasyon bulunamadı." });
//     }

//     if (op.status === "Tamamlandı") {
//       return res.status(400).json({ success: false, message: "Tamamlanan operasyon başlatılamaz." });
//     }

//     await dbRun(`
//       UPDATE production_operations
//       SET
//         status = 'Çalışıyor',
//         start_time = COALESCE(start_time, datetime('now')),
//         updated_at = datetime('now')
//       WHERE id = ?
//     `, [req.params.id]);

//     await dbRun(`
//       UPDATE work_orders
//       SET status = 'Üretimde'
//       WHERE id = ?
//     `, [op.work_order_id]).catch(() => {});

//     res.json({ success: true, message: "Operasyon başlatıldı." });

//   } catch (err) {
//     console.error("MES operasyon başlatma hatası:", err);
//     res.status(500).json({ success: false, message: err.message });
//   }
// });

// /* Operasyon durdur */
// app.put("/api/mes/operations/:id/stop", async (req, res) => {
//   try {
//     const op = await dbGet(`
//       SELECT *
//       FROM production_operations
//       WHERE id = ?
//     `, [req.params.id]);

//     if (!op) {
//       return res.status(404).json({ success: false, message: "Operasyon bulunamadı." });
//     }

//     if (op.status !== "Çalışıyor") {
//       return res.status(400).json({ success: false, message: "Sadece çalışan operasyon durdurulabilir." });
//     }

//     const diff = await dbGet(`
//       SELECT CAST((julianday('now') - julianday(?)) * 24 * 60 AS INTEGER) AS minutes
//     `, [op.start_time]);

//     const extraMinutes = Number(diff?.minutes || 0);
//     const totalActual = Number(op.actual_minutes || 0) + Math.max(extraMinutes, 0);

//     await dbRun(`
//       UPDATE production_operations
//       SET
//         status = 'Durdu',
//         actual_minutes = ?,
//         updated_at = datetime('now')
//       WHERE id = ?
//     `, [totalActual, req.params.id]);

//     res.json({ success: true, message: "Operasyon durduruldu.", actual_minutes: totalActual });

//   } catch (err) {
//     console.error("MES operasyon durdurma hatası:", err);
//     res.status(500).json({ success: false, message: err.message });
//   }
// });

// /* Operasyon tamamla */
// app.put("/api/mes/operations/:id/complete", async (req, res) => {
//   try {
//     const {
//       good_quantity,
//       scrap_quantity,
//       note
//     } = req.body;

//     const op = await dbGet(`
//       SELECT *
//       FROM production_operations
//       WHERE id = ?
//     `, [req.params.id]);

//     if (!op) {
//       return res.status(404).json({ success: false, message: "Operasyon bulunamadı." });
//     }

//     if (op.status === "Tamamlandı") {
//       return res.status(400).json({ success: false, message: "Operasyon zaten tamamlanmış." });
//     }

//     let totalActual = Number(op.actual_minutes || 0);

//     if (op.status === "Çalışıyor" && op.start_time) {
//       const diff = await dbGet(`
//         SELECT CAST((julianday('now') - julianday(?)) * 24 * 60 AS INTEGER) AS minutes
//       `, [op.start_time]);

//       totalActual += Math.max(Number(diff?.minutes || 0), 0);
//     }

//     await dbRun(`
//       UPDATE production_operations
//       SET
//         status = 'Tamamlandı',
//         end_time = datetime('now'),
//         actual_minutes = ?,
//         good_quantity = ?,
//         scrap_quantity = ?,
//         note = ?,
//         updated_at = datetime('now')
//       WHERE id = ?
//     `, [
//       totalActual,
//       Number(good_quantity || op.good_quantity || 0),
//       Number(scrap_quantity || op.scrap_quantity || 0),
//       note || op.note || "",
//       req.params.id
//     ]);

//     const remaining = await dbGet(`
//       SELECT COUNT(*) AS c
//       FROM production_operations
//       WHERE work_order_id = ?
//         AND status != 'Tamamlandı'
//     `, [op.work_order_id]);

//     if (remaining.c === 0) {
//       await dbRun(`
//         UPDATE work_orders
//         SET status = 'Tamamlandı'
//         WHERE id = ?
//       `, [op.work_order_id]).catch(() => {});
//     }

//     res.json({ success: true, message: "Operasyon tamamlandı.", actual_minutes: totalActual });

//   } catch (err) {
//     console.error("MES operasyon tamamlama hatası:", err);
//     res.status(500).json({ success: false, message: err.message });
//   }
// });

// /* Operasyon sil */
// app.delete("/api/mes/operations/:id", async (req, res) => {
//   try {
//     const op = await dbGet(`
//       SELECT *
//       FROM production_operations
//       WHERE id = ?
//     `, [req.params.id]);

//     if (!op) {
//       return res.status(404).json({ success: false, message: "Operasyon bulunamadı." });
//     }

//     if (op.status === "Çalışıyor") {
//       return res.status(400).json({ success: false, message: "Çalışan operasyon silinemez." });
//     }

//     await dbRun(`
//       DELETE FROM production_operations
//       WHERE id = ?
//     `, [req.params.id]);

//     res.json({ success: true, message: "Operasyon silindi." });

//   } catch (err) {
//     console.error("MES operasyon silme hatası:", err);
//     res.status(500).json({ success: false, message: err.message });
//   }
// });
// /* ==========================================================
//    KALİBRASYON YÖNETİMİ BACKEND
//    app.js / server.js içine ekle
// ========================================================== */

// db.serialize(() => {
//   db.run(`
//     CREATE TABLE IF NOT EXISTS calibration_devices (
//       id INTEGER PRIMARY KEY AUTOINCREMENT,
//       device_no TEXT UNIQUE,
//       device_name TEXT NOT NULL,
//       device_type TEXT,
//       serial_no TEXT,
//       brand TEXT,
//       model TEXT,
//       location TEXT,
//       responsible_person TEXT,
//       last_calibration_date DATE,
//       next_calibration_date DATE,
//       calibration_period_month INTEGER DEFAULT 12,
//       status TEXT DEFAULT 'Aktif',
//       description TEXT,
//       created_by TEXT,
//       created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
//       updated_at DATETIME
//     )
//   `);

//   db.run(`
//     CREATE TABLE IF NOT EXISTS calibration_records (
//       id INTEGER PRIMARY KEY AUTOINCREMENT,
//       device_id INTEGER NOT NULL,
//       calibration_date DATE NOT NULL,
//       next_calibration_date DATE,
//       certificate_no TEXT,
//       result TEXT DEFAULT 'Uygun',
//       calibration_company TEXT,
//       document_id INTEGER,
//       document_no TEXT,
//       file_name TEXT,
//       file_path TEXT,
//       note TEXT,
//       created_by TEXT,
//       created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
//       FOREIGN KEY(device_id) REFERENCES calibration_devices(id)
//     )
//   `);
// });

// /* Promise helperlar sende varsa tekrar ekleme */
// function dbAll(sql, params = []) {
//   return new Promise((resolve, reject) => {
//     db.all(sql, params, (err, rows) => err ? reject(err) : resolve(rows));
//   });
// }

// function dbGet(sql, params = []) {
//   return new Promise((resolve, reject) => {
//     db.get(sql, params, (err, row) => err ? reject(err) : resolve(row));
//   });
// }

// function dbRun(sql, params = []) {
//   return new Promise((resolve, reject) => {
//     db.run(sql, params, function(err) {
//       if (err) reject(err);
//       else resolve(this);
//     });
//   });
// }

// function generateCalibrationDeviceNo() {
//   return "KLB" + Date.now();
// }

// /* CİHAZLARI LİSTELE */
// app.get("/api/calibration/devices", async (req, res) => {
//   try {
//     const { status, q, alert } = req.query;

//     const where = [];
//     const params = [];

//     if (status) {
//       where.push("status = ?");
//       params.push(status);
//     }

//     if (q) {
//       where.push(`(
//         device_no LIKE ? OR
//         device_name LIKE ? OR
//         device_type LIKE ? OR
//         serial_no LIKE ? OR
//         location LIKE ? OR
//         responsible_person LIKE ?
//       )`);
//       params.push(`%${q}%`, `%${q}%`, `%${q}%`, `%${q}%`, `%${q}%`, `%${q}%`);
//     }

//     if (alert === "expired") {
//       where.push("date(next_calibration_date) < date('now')");
//     }

//     if (alert === "upcoming") {
//       where.push("date(next_calibration_date) BETWEEN date('now') AND date('now', '+30 day')");
//     }

//     const whereSql = where.length ? "WHERE " + where.join(" AND ") : "";

//     const rows = await dbAll(`
//       SELECT 
//         cd.*,
//         CASE
//           WHEN cd.next_calibration_date IS NULL THEN 'Tarih Yok'
//           WHEN date(cd.next_calibration_date) < date('now') THEN 'Geçti'
//           WHEN date(cd.next_calibration_date) BETWEEN date('now') AND date('now', '+30 day') THEN 'Yaklaşıyor'
//           ELSE 'Normal'
//         END AS calibration_status,
//         (
//           SELECT COUNT(*)
//           FROM calibration_records cr
//           WHERE cr.device_id = cd.id
//         ) AS record_count
//       FROM calibration_devices cd
//       ${whereSql}
//       ORDER BY 
//         CASE
//           WHEN cd.next_calibration_date IS NULL THEN 4
//           WHEN date(cd.next_calibration_date) < date('now') THEN 1
//           WHEN date(cd.next_calibration_date) BETWEEN date('now') AND date('now', '+30 day') THEN 2
//           ELSE 3
//         END,
//         cd.next_calibration_date ASC
//     `, params);

//     res.json({ success: true, devices: rows });
//   } catch (err) {
//     console.error("Kalibrasyon cihazları alınamadı:", err);
//     res.status(500).json({ success: false, message: err.message });
//   }
// });

// /* KPI */
// app.get("/api/calibration/kpi", async (req, res) => {
//   try {
//     const total = await dbGet(`
//       SELECT COUNT(*) AS c 
//       FROM calibration_devices
//       WHERE IFNULL(status, 'Aktif') = 'Aktif'
//     `);

//     const expired = await dbGet(`
//       SELECT COUNT(*) AS c
//       FROM calibration_devices
//       WHERE IFNULL(status, 'Aktif') = 'Aktif'
//         AND next_calibration_date IS NOT NULL
//         AND date(next_calibration_date) < date('now')
//     `);

//     const upcoming = await dbGet(`
//       SELECT COUNT(*) AS c
//       FROM calibration_devices
//       WHERE IFNULL(status, 'Aktif') = 'Aktif'
//         AND next_calibration_date IS NOT NULL
//         AND date(next_calibration_date) BETWEEN date('now') AND date('now', '+30 day')
//     `);

//     const records = await dbGet(`
//       SELECT COUNT(*) AS c
//       FROM calibration_records
//     `);

//     res.json({
//       success: true,
//       kpi: {
//         totalDevices: total.c,
//         expiredDevices: expired.c,
//         upcomingDevices: upcoming.c,
//         totalRecords: records.c
//       }
//     });
//   } catch (err) {
//     console.error("Kalibrasyon KPI alınamadı:", err);
//     res.status(500).json({ success: false, message: err.message });
//   }
// });

// /* CİHAZ DETAY */
// app.get("/api/calibration/devices/:id", async (req, res) => {
//   try {
//     const device = await dbGet(`
//       SELECT 
//         *,
//         CASE
//           WHEN next_calibration_date IS NULL THEN 'Tarih Yok'
//           WHEN date(next_calibration_date) < date('now') THEN 'Geçti'
//           WHEN date(next_calibration_date) BETWEEN date('now') AND date('now', '+30 day') THEN 'Yaklaşıyor'
//           ELSE 'Normal'
//         END AS calibration_status
//       FROM calibration_devices
//       WHERE id = ?
//     `, [req.params.id]);

//     if (!device) {
//       return res.status(404).json({
//         success: false,
//         message: "Kalibrasyon cihazı bulunamadı."
//       });
//     }

//     const records = await dbAll(`
//       SELECT *
//       FROM calibration_records
//       WHERE device_id = ?
//       ORDER BY calibration_date DESC, id DESC
//     `, [req.params.id]);

//     res.json({ success: true, device, records });
//   } catch (err) {
//     console.error("Kalibrasyon cihaz detay hatası:", err);
//     res.status(500).json({ success: false, message: err.message });
//   }
// });

// /* CİHAZ OLUŞTUR */
// app.post("/api/calibration/devices", async (req, res) => {
//   try {
//     const {
//       device_name,
//       device_type,
//       serial_no,
//       brand,
//       model,
//       location,
//       responsible_person,
//       last_calibration_date,
//       next_calibration_date,
//       calibration_period_month,
//       description,
//       created_by
//     } = req.body;

//     if (!device_name) {
//       return res.status(400).json({
//         success: false,
//         message: "Cihaz adı zorunludur."
//       });
//     }

//     const deviceNo = generateCalibrationDeviceNo();

//     const result = await dbRun(`
//       INSERT INTO calibration_devices
//       (
//         device_no,
//         device_name,
//         device_type,
//         serial_no,
//         brand,
//         model,
//         location,
//         responsible_person,
//         last_calibration_date,
//         next_calibration_date,
//         calibration_period_month,
//         description,
//         created_by
//       )
//       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
//     `, [
//       deviceNo,
//       device_name,
//       device_type || "",
//       serial_no || "",
//       brand || "",
//       model || "",
//       location || "",
//       responsible_person || "",
//       last_calibration_date || null,
//       next_calibration_date || null,
//       Number(calibration_period_month || 12),
//       description || "",
//       created_by || req.headers["x-user-name"] || "Sistem"
//     ]);

//     res.json({
//       success: true,
//       message: "Kalibrasyon cihazı oluşturuldu.",
//       id: result.lastID,
//       device_no: deviceNo
//     });

//   } catch (err) {
//     console.error("Kalibrasyon cihaz oluşturma hatası:", err);
//     res.status(500).json({ success: false, message: err.message });
//   }
// });

// /* CİHAZ GÜNCELLE */
// app.put("/api/calibration/devices/:id", async (req, res) => {
//   try {
//     const {
//       device_name,
//       device_type,
//       serial_no,
//       brand,
//       model,
//       location,
//       responsible_person,
//       last_calibration_date,
//       next_calibration_date,
//       calibration_period_month,
//       status,
//       description
//     } = req.body;

//     const device = await dbGet(`
//       SELECT *
//       FROM calibration_devices
//       WHERE id = ?
//     `, [req.params.id]);

//     if (!device) {
//       return res.status(404).json({
//         success: false,
//         message: "Kalibrasyon cihazı bulunamadı."
//       });
//     }

//     await dbRun(`
//       UPDATE calibration_devices
//       SET
//         device_name = ?,
//         device_type = ?,
//         serial_no = ?,
//         brand = ?,
//         model = ?,
//         location = ?,
//         responsible_person = ?,
//         last_calibration_date = ?,
//         next_calibration_date = ?,
//         calibration_period_month = ?,
//         status = ?,
//         description = ?,
//         updated_at = datetime('now')
//       WHERE id = ?
//     `, [
//       device_name || device.device_name,
//       device_type || "",
//       serial_no || "",
//       brand || "",
//       model || "",
//       location || "",
//       responsible_person || "",
//       last_calibration_date || null,
//       next_calibration_date || null,
//       Number(calibration_period_month || 12),
//       status || device.status,
//       description || "",
//       req.params.id
//     ]);

//     res.json({
//       success: true,
//       message: "Kalibrasyon cihazı güncellendi."
//     });

//   } catch (err) {
//     console.error("Kalibrasyon cihaz güncelleme hatası:", err);
//     res.status(500).json({ success: false, message: err.message });
//   }
// });

// /* KALİBRASYON KAYDI EKLE */
// app.post("/api/calibration/devices/:id/records", async (req, res) => {
//   try {
//     const {
//       calibration_date,
//       next_calibration_date,
//       certificate_no,
//       result,
//       calibration_company,
//       document_id,
//       document_no,
//       file_name,
//       file_path,
//       note,
//       created_by
//     } = req.body;

//     const device = await dbGet(`
//       SELECT *
//       FROM calibration_devices
//       WHERE id = ?
//     `, [req.params.id]);

//     if (!device) {
//       return res.status(404).json({
//         success: false,
//         message: "Kalibrasyon cihazı bulunamadı."
//       });
//     }

//     if (!calibration_date) {
//       return res.status(400).json({
//         success: false,
//         message: "Kalibrasyon tarihi zorunludur."
//       });
//     }

//     const period = Number(device.calibration_period_month || 12);

//     let calculatedNext = next_calibration_date;

//     if (!calculatedNext) {
//       const date = new Date(calibration_date);
//       date.setMonth(date.getMonth() + period);
//       calculatedNext = date.toISOString().slice(0, 10);
//     }

//     await dbRun("BEGIN TRANSACTION");

//     try {
//       const resultRow = await dbRun(`
//         INSERT INTO calibration_records
//         (
//           device_id,
//           calibration_date,
//           next_calibration_date,
//           certificate_no,
//           result,
//           calibration_company,
//           document_id,
//           document_no,
//           file_name,
//           file_path,
//           note,
//           created_by
//         )
//         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
//       `, [
//         req.params.id,
//         calibration_date,
//         calculatedNext,
//         certificate_no || "",
//         result || "Uygun",
//         calibration_company || "",
//         document_id || null,
//         document_no || "",
//         file_name || "",
//         file_path || "",
//         note || "",
//         created_by || req.headers["x-user-name"] || "Sistem"
//       ]);

//       await dbRun(`
//         UPDATE calibration_devices
//         SET
//           last_calibration_date = ?,
//           next_calibration_date = ?,
//           updated_at = datetime('now')
//         WHERE id = ?
//       `, [
//         calibration_date,
//         calculatedNext,
//         req.params.id
//       ]);

//       await dbRun("COMMIT");

//       res.json({
//         success: true,
//         message: "Kalibrasyon kaydı eklendi.",
//         id: resultRow.lastID
//       });

//     } catch (err) {
//       await dbRun("ROLLBACK");
//       throw err;
//     }

//   } catch (err) {
//     console.error("Kalibrasyon kaydı ekleme hatası:", err);
//     res.status(500).json({ success: false, message: err.message });
//   }
// });

// /* KALİBRASYON KAYITLARI LİSTELE */
// app.get("/api/calibration/records", async (req, res) => {
//   try {
//     const { deviceId } = req.query;

//     const where = [];
//     const params = [];

//     if (deviceId) {
//       where.push("cr.device_id = ?");
//       params.push(deviceId);
//     }

//     const whereSql = where.length ? "WHERE " + where.join(" AND ") : "";

//     const rows = await dbAll(`
//       SELECT 
//         cr.*,
//         cd.device_no,
//         cd.device_name,
//         cd.device_type,
//         cd.serial_no
//       FROM calibration_records cr
//       JOIN calibration_devices cd ON cd.id = cr.device_id
//       ${whereSql}
//       ORDER BY cr.calibration_date DESC, cr.id DESC
//     `, params);

//     res.json({ success: true, records: rows });
//   } catch (err) {
//     console.error("Kalibrasyon kayıtları alınamadı:", err);
//     res.status(500).json({ success: false, message: err.message });
//   }
// });

// /* CİHAZ SİL */
// app.delete("/api/calibration/devices/:id", async (req, res) => {
//   try {
//     const device = await dbGet(`
//       SELECT *
//       FROM calibration_devices
//       WHERE id = ?
//     `, [req.params.id]);

//     if (!device) {
//       return res.status(404).json({
//         success: false,
//         message: "Kalibrasyon cihazı bulunamadı."
//       });
//     }

//     const recordCount = await dbGet(`
//       SELECT COUNT(*) AS c
//       FROM calibration_records
//       WHERE device_id = ?
//     `, [req.params.id]);

//     if (recordCount.c > 0) {
//       await dbRun(`
//         UPDATE calibration_devices
//         SET status = 'Pasif',
//             updated_at = datetime('now')
//         WHERE id = ?
//       `, [req.params.id]);

//       return res.json({
//         success: true,
//         message: "Cihazın kalibrasyon kayıtları olduğu için pasifleştirildi."
//       });
//     }

//     await dbRun(`
//       DELETE FROM calibration_devices
//       WHERE id = ?
//     `, [req.params.id]);

//     res.json({
//       success: true,
//       message: "Kalibrasyon cihazı silindi."
//     });

//   } catch (err) {
//     console.error("Kalibrasyon cihaz silme hatası:", err);
//     res.status(500).json({ success: false, message: err.message });
//   }
// });

// /* KAYIT SİL */
// app.delete("/api/calibration/records/:id", async (req, res) => {
//   try {
//     const record = await dbGet(`
//       SELECT *
//       FROM calibration_records
//       WHERE id = ?
//     `, [req.params.id]);

//     if (!record) {
//       return res.status(404).json({
//         success: false,
//         message: "Kalibrasyon kaydı bulunamadı."
//       });
//     }

//     await dbRun(`
//       DELETE FROM calibration_records
//       WHERE id = ?
//     `, [req.params.id]);

//     const latest = await dbGet(`
//       SELECT *
//       FROM calibration_records
//       WHERE device_id = ?
//       ORDER BY calibration_date DESC, id DESC
//       LIMIT 1
//     `, [record.device_id]);

//     if (latest) {
//       await dbRun(`
//         UPDATE calibration_devices
//         SET last_calibration_date = ?,
//             next_calibration_date = ?,
//             updated_at = datetime('now')
//         WHERE id = ?
//       `, [latest.calibration_date, latest.next_calibration_date, record.device_id]);
//     }

//     res.json({
//       success: true,
//       message: "Kalibrasyon kaydı silindi."
//     });

//   } catch (err) {
//     console.error("Kalibrasyon kayıt silme hatası:", err);
//     res.status(500).json({ success: false, message: err.message });
//   }
// });


// /* DOKÜMANLARI LİSTELE */
// app.get("/api/documents", async (req, res) => {
//   try {
//     const {
//       workOrderId,
//       type,
//       status,
//       q
//     } = req.query;

//     const where = [];
//     const params = [];

//     if (workOrderId) {
//       where.push("d.work_order_id = ?");
//       params.push(workOrderId);
//     }

//     if (type) {
//       where.push("d.document_type = ?");
//       params.push(type);
//     }

//     if (status) {
//       where.push("d.status = ?");
//       params.push(status);
//     }

//     if (q) {
//       where.push(`(
//         d.document_no LIKE ? OR
//         d.title LIKE ? OR
//         d.work_order_no LIKE ? OR
//         d.original_file_name LIKE ?
//       )`);
//       params.push(`%${q}%`, `%${q}%`, `%${q}%`, `%${q}%`);
//     }

//     const whereSql = where.length ? "WHERE " + where.join(" AND ") : "";

//     const rows = await dbAll(`
//       SELECT d.*
//       FROM documents d
//       ${whereSql}
//       ORDER BY d.id DESC
//     `, params);

//     res.json({ success: true, documents: rows });
//   } catch (err) {
//     console.error("Doküman listesi alınamadı:", err);
//     res.status(500).json({ success: false, message: err.message });
//   }
// });

// /* ==========================================================
//    SERİ NO / LOT TAKİBİ BACKEND
//    app.js / server.js içine ekle
// ========================================================== */

// db.serialize(() => {
//   db.run(`
//     CREATE TABLE IF NOT EXISTS lot_serials (
//       id INTEGER PRIMARY KEY AUTOINCREMENT,
//       tracking_no TEXT UNIQUE,
//       stock_id INTEGER,
//       stock_code TEXT,
//       part_name TEXT,
//       lot_no TEXT,
//       serial_no TEXT,
//       supplier_id INTEGER,
//       supplier_name TEXT,
//       work_order_id INTEGER,
//       work_order_no TEXT,
//       entry_date DATE DEFAULT CURRENT_DATE,
//       expiry_date DATE,
//       initial_quantity REAL DEFAULT 0,
//       remaining_quantity REAL DEFAULT 0,
//       unit TEXT DEFAULT 'Adet',
//       location TEXT,
//       status TEXT DEFAULT 'Aktif',
//       note TEXT,
//       created_by TEXT,
//       created_at DATETIME DEFAULT CURRENT_TIMESTAMP
//     )
//   `);

//   db.run(`
//     CREATE TABLE IF NOT EXISTS lot_serial_movements (
//       id INTEGER PRIMARY KEY AUTOINCREMENT,
//       lot_serial_id INTEGER NOT NULL,
//       movement_no TEXT,
//       movement_type TEXT,
//       movement_date DATETIME DEFAULT CURRENT_TIMESTAMP,
//       quantity REAL DEFAULT 0,
//       previous_quantity REAL DEFAULT 0,
//       next_quantity REAL DEFAULT 0,
//       work_order_id INTEGER,
//       work_order_no TEXT,
//       customer_id INTEGER,
//       customer_name TEXT,
//       description TEXT,
//       created_by TEXT,
//       created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
//       FOREIGN KEY(lot_serial_id) REFERENCES lot_serials(id)
//     )
//   `);
// });

// /* Promise helperlar sende varsa tekrar ekleme */
// function dbAll(sql, params = []) {
//   return new Promise((resolve, reject) => {
//     db.all(sql, params, (err, rows) => err ? reject(err) : resolve(rows));
//   });
// }

// function dbGet(sql, params = []) {
//   return new Promise((resolve, reject) => {
//     db.get(sql, params, (err, row) => err ? reject(err) : resolve(row));
//   });
// }

// function dbRun(sql, params = []) {
//   return new Promise((resolve, reject) => {
//     db.run(sql, params, function(err) {
//       if (err) reject(err);
//       else resolve(this);
//     });
//   });
// }

// function generateTrackingNo() {
//   return "LOT" + Date.now();
// }

// function generateLotMovementNo() {
//   return "LTH" + Date.now();
// }

// /* Stok select */
// app.get("/api/lot-serial/stocks", async (req, res) => {
//   try {
//     const rows = await dbAll(`
//       SELECT 
//         id,
//         stock_code,
//         part_name,
//         quantity,
//         unit,
//         location
//       FROM stocks
//       WHERE IFNULL(status, 'active') != 'passive'
//       ORDER BY part_name ASC
//     `);

//     res.json({ success: true, stocks: rows });
//   } catch (err) {
//     console.error("Lot stokları alınamadı:", err);
//     res.status(500).json({ success: false, message: err.message });
//   }
// });

// /* İş emri select */
// app.get("/api/lot-serial/work-orders", async (req, res) => {
//   try {
//     const rows = await dbAll(`
//       SELECT 
//         id,
//         work_order_no,
//         part_name,
//         title,
//         status
//       FROM work_orders
//       ORDER BY id DESC
//     `);

//     res.json({ success: true, workOrders: rows });
//   } catch (err) {
//     console.error("Lot iş emirleri alınamadı:", err);
//     res.status(500).json({ success: false, message: err.message });
//   }
// });

// /* Tedarikçi select */
// app.get("/api/lot-serial/suppliers", async (req, res) => {
//   try {
//     const table = await dbGet(`
//       SELECT name FROM sqlite_master WHERE type='table' AND name='suppliers'
//     `);

//     if (!table) return res.json({ success: true, suppliers: [] });

//     const rows = await dbAll(`
//       SELECT 
//         id,
//         company_name,
//         supplier_name,
//         name,
//         authorized_person
//       FROM suppliers
//       ORDER BY id DESC
//     `);

//     res.json({
//       success: true,
//       suppliers: rows.map(s => ({
//         id: s.id,
//         supplier_name: s.company_name || s.supplier_name || s.name || s.authorized_person || ("Tedarikçi " + s.id)
//       }))
//     });
//   } catch (err) {
//     console.error("Lot tedarikçiler alınamadı:", err);
//     res.json({ success: true, suppliers: [] });
//   }
// });

// /* Lot / Seri listele */
// app.get("/api/lot-serials", async (req, res) => {
//   try {
//     const { q, status, stockId } = req.query;

//     const where = [];
//     const params = [];

//     if (status) {
//       where.push("status = ?");
//       params.push(status);
//     }

//     if (stockId) {
//       where.push("stock_id = ?");
//       params.push(stockId);
//     }

//     if (q) {
//       where.push(`(
//         tracking_no LIKE ? OR
//         stock_code LIKE ? OR
//         part_name LIKE ? OR
//         lot_no LIKE ? OR
//         serial_no LIKE ? OR
//         supplier_name LIKE ? OR
//         work_order_no LIKE ?
//       )`);
//       params.push(`%${q}%`, `%${q}%`, `%${q}%`, `%${q}%`, `%${q}%`, `%${q}%`, `%${q}%`);
//     }

//     const whereSql = where.length ? "WHERE " + where.join(" AND ") : "";

//     const rows = await dbAll(`
//       SELECT 
//         *,
//         CASE
//           WHEN remaining_quantity <= 0 THEN 'Tükendi'
//           WHEN status = 'Blokeli' THEN 'Blokeli'
//           WHEN status = 'Pasif' THEN 'Pasif'
//           ELSE 'Aktif'
//         END AS calculated_status
//       FROM lot_serials
//       ${whereSql}
//       ORDER BY id DESC
//     `, params);

//     res.json({ success: true, lotSerials: rows });
//   } catch (err) {
//     console.error("Lot/seri kayıtları alınamadı:", err);
//     res.status(500).json({ success: false, message: err.message });
//   }
// });

// /* KPI */
// app.get("/api/lot-serials/kpi", async (req, res) => {
//   try {
//     const total = await dbGet(`SELECT COUNT(*) AS c FROM lot_serials`);
//     const active = await dbGet(`SELECT COUNT(*) AS c FROM lot_serials WHERE status = 'Aktif' AND remaining_quantity > 0`);
//     const consumed = await dbGet(`SELECT COUNT(*) AS c FROM lot_serials WHERE remaining_quantity <= 0`);
//     const blocked = await dbGet(`SELECT COUNT(*) AS c FROM lot_serials WHERE status = 'Blokeli'`);
//     const qty = await dbGet(`
//       SELECT 
//         IFNULL(SUM(initial_quantity), 0) AS initialQty,
//         IFNULL(SUM(remaining_quantity), 0) AS remainingQty
//       FROM lot_serials
//     `);

//     res.json({
//       success: true,
//       kpi: {
//         total: total.c,
//         active: active.c,
//         consumed: consumed.c,
//         blocked: blocked.c,
//         initialQty: qty.initialQty,
//         remainingQty: qty.remainingQty
//       }
//     });
//   } catch (err) {
//     console.error("Lot KPI alınamadı:", err);
//     res.status(500).json({ success: false, message: err.message });
//   }
// });

// /* Detay ve izlenebilirlik */
// app.get("/api/lot-serials/:id", async (req, res) => {
//   try {
//     const lot = await dbGet(`
//       SELECT *
//       FROM lot_serials
//       WHERE id = ?
//     `, [req.params.id]);

//     if (!lot) {
//       return res.status(404).json({
//         success: false,
//         message: "Lot / seri kaydı bulunamadı."
//       });
//     }

//     const movements = await dbAll(`
//       SELECT *
//       FROM lot_serial_movements
//       WHERE lot_serial_id = ?
//       ORDER BY id DESC
//     `, [req.params.id]);

//     res.json({ success: true, lot, movements });
//   } catch (err) {
//     console.error("Lot detay alınamadı:", err);
//     res.status(500).json({ success: false, message: err.message });
//   }
// });

// /* Lot / Seri oluştur */
// app.post("/api/lot-serials", async (req, res) => {
//   try {
//     const {
//       stock_id,
//       lot_no,
//       serial_no,
//       supplier_id,
//       supplier_name,
//       work_order_id,
//       entry_date,
//       expiry_date,
//       initial_quantity,
//       location,
//       note,
//       created_by
//     } = req.body;

//     if (!stock_id) {
//       return res.status(400).json({ success: false, message: "Stok seçimi zorunludur." });
//     }

//     if (!lot_no && !serial_no) {
//       return res.status(400).json({ success: false, message: "Lot no veya seri no zorunludur." });
//     }

//     const stock = await dbGet(`
//       SELECT *
//       FROM stocks
//       WHERE id = ?
//     `, [stock_id]);

//     if (!stock) {
//       return res.status(404).json({ success: false, message: "Stok kartı bulunamadı." });
//     }

//     let workOrderNo = "";

//     if (work_order_id) {
//       const wo = await dbGet(`SELECT work_order_no FROM work_orders WHERE id = ?`, [work_order_id]);
//       workOrderNo = wo?.work_order_no || "";
//     }

//     const qty = Number(initial_quantity || 0);

//     if (qty <= 0) {
//       return res.status(400).json({ success: false, message: "Giriş miktarı 0'dan büyük olmalıdır." });
//     }

//     await dbRun("BEGIN TRANSACTION");

//     try {
//       const trackingNo = generateTrackingNo();

//       const result = await dbRun(`
//         INSERT INTO lot_serials
//         (
//           tracking_no,
//           stock_id,
//           stock_code,
//           part_name,
//           lot_no,
//           serial_no,
//           supplier_id,
//           supplier_name,
//           work_order_id,
//           work_order_no,
//           entry_date,
//           expiry_date,
//           initial_quantity,
//           remaining_quantity,
//           unit,
//           location,
//           status,
//           note,
//           created_by
//         )
//         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Aktif', ?, ?)
//       `, [
//         trackingNo,
//         stock.id,
//         stock.stock_code || "",
//         stock.part_name || "",
//         lot_no || "",
//         serial_no || "",
//         supplier_id || null,
//         supplier_name || "",
//         work_order_id || null,
//         workOrderNo,
//         entry_date || new Date().toISOString().slice(0, 10),
//         expiry_date || null,
//         qty,
//         qty,
//         stock.unit || "Adet",
//         location || stock.location || "",
//         note || "",
//         created_by || req.headers["x-user-name"] || "Sistem"
//       ]);

//       const lotId = result.lastID;

//       await dbRun(`
//         INSERT INTO lot_serial_movements
//         (
//           lot_serial_id,
//           movement_no,
//           movement_type,
//           quantity,
//           previous_quantity,
//           next_quantity,
//           work_order_id,
//           work_order_no,
//           description,
//           created_by
//         )
//         VALUES (?, ?, 'Giriş', ?, 0, ?, ?, ?, ?, ?)
//       `, [
//         lotId,
//         generateLotMovementNo(),
//         qty,
//         qty,
//         work_order_id || null,
//         workOrderNo,
//         "Lot / seri ilk giriş kaydı",
//         created_by || req.headers["x-user-name"] || "Sistem"
//       ]);

//       await dbRun("COMMIT");

//       res.json({
//         success: true,
//         message: "Lot / seri kaydı oluşturuldu.",
//         id: lotId,
//         tracking_no: trackingNo
//       });

//     } catch (err) {
//       await dbRun("ROLLBACK");
//       throw err;
//     }

//   } catch (err) {
//     console.error("Lot / seri oluşturma hatası:", err);
//     res.status(500).json({ success: false, message: err.message });
//   }
// });

// /* Lot / Seri hareket oluştur */
// app.post("/api/lot-serials/:id/movements", async (req, res) => {
//   try {
//     const {
//       movement_type,
//       quantity,
//       work_order_id,
//       customer_id,
//       customer_name,
//       description,
//       created_by
//     } = req.body;

//     const lot = await dbGet(`
//       SELECT *
//       FROM lot_serials
//       WHERE id = ?
//     `, [req.params.id]);

//     if (!lot) {
//       return res.status(404).json({ success: false, message: "Lot / seri kaydı bulunamadı." });
//     }

//     if (lot.status === "Blokeli") {
//       return res.status(400).json({ success: false, message: "Blokeli lot hareket göremez." });
//     }

//     const qty = Number(quantity || 0);

//     if (qty <= 0) {
//       return res.status(400).json({ success: false, message: "Hareket miktarı 0'dan büyük olmalıdır." });
//     }

//     const type = movement_type || "Çıkış";
//     const previousQty = Number(lot.remaining_quantity || 0);
//     let nextQty = previousQty;

//     if (type === "Giriş" || type === "İade") {
//       nextQty = previousQty + qty;
//     } else {
//       if (qty > previousQty) {
//         return res.status(400).json({
//           success: false,
//           message: `Yetersiz lot miktarı. Kalan: ${previousQty}, istenen: ${qty}`
//         });
//       }

//       nextQty = previousQty - qty;
//     }

//     let workOrderNo = "";

//     if (work_order_id) {
//       const wo = await dbGet(`SELECT work_order_no FROM work_orders WHERE id = ?`, [work_order_id]);
//       workOrderNo = wo?.work_order_no || "";
//     }

//     await dbRun("BEGIN TRANSACTION");

//     try {
//       await dbRun(`
//         INSERT INTO lot_serial_movements
//         (
//           lot_serial_id,
//           movement_no,
//           movement_type,
//           quantity,
//           previous_quantity,
//           next_quantity,
//           work_order_id,
//           work_order_no,
//           customer_id,
//           customer_name,
//           description,
//           created_by
//         )
//         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
//       `, [
//         lot.id,
//         generateLotMovementNo(),
//         type,
//         qty,
//         previousQty,
//         nextQty,
//         work_order_id || null,
//         workOrderNo,
//         customer_id || null,
//         customer_name || "",
//         description || "",
//         created_by || req.headers["x-user-name"] || "Sistem"
//       ]);

//       await dbRun(`
//         UPDATE lot_serials
//         SET remaining_quantity = ?,
//             status = CASE WHEN ? <= 0 THEN 'Tükendi' ELSE status END
//         WHERE id = ?
//       `, [nextQty, nextQty, lot.id]);

//       await dbRun("COMMIT");

//       res.json({
//         success: true,
//         message: "Lot / seri hareketi oluşturuldu.",
//         next_quantity: nextQty
//       });

//     } catch (err) {
//       await dbRun("ROLLBACK");
//       throw err;
//     }

//   } catch (err) {
//     console.error("Lot hareket oluşturma hatası:", err);
//     res.status(500).json({ success: false, message: err.message });
//   }
// });

// /* Lot / Seri güncelle */
// app.put("/api/lot-serials/:id", async (req, res) => {
//   try {
//     const {
//       lot_no,
//       serial_no,
//       supplier_name,
//       entry_date,
//       expiry_date,
//       location,
//       status,
//       note
//     } = req.body;

//     const lot = await dbGet(`
//       SELECT *
//       FROM lot_serials
//       WHERE id = ?
//     `, [req.params.id]);

//     if (!lot) {
//       return res.status(404).json({ success: false, message: "Lot / seri kaydı bulunamadı." });
//     }

//     await dbRun(`
//       UPDATE lot_serials
//       SET
//         lot_no = ?,
//         serial_no = ?,
//         supplier_name = ?,
//         entry_date = ?,
//         expiry_date = ?,
//         location = ?,
//         status = ?,
//         note = ?
//       WHERE id = ?
//     `, [
//       lot_no || "",
//       serial_no || "",
//       supplier_name || "",
//       entry_date || lot.entry_date,
//       expiry_date || null,
//       location || "",
//       status || lot.status,
//       note || "",
//       req.params.id
//     ]);

//     res.json({ success: true, message: "Lot / seri kaydı güncellendi." });

//   } catch (err) {
//     console.error("Lot güncelleme hatası:", err);
//     res.status(500).json({ success: false, message: err.message });
//   }
// });

// /* Lot / Seri sil */
// app.delete("/api/lot-serials/:id", async (req, res) => {
//   try {
//     const lot = await dbGet(`
//       SELECT *
//       FROM lot_serials
//       WHERE id = ?
//     `, [req.params.id]);

//     if (!lot) {
//       return res.status(404).json({ success: false, message: "Lot / seri kaydı bulunamadı." });
//     }

//     const movementCount = await dbGet(`
//       SELECT COUNT(*) AS c
//       FROM lot_serial_movements
//       WHERE lot_serial_id = ?
//     `, [req.params.id]);

//     if (movementCount.c > 1) {
//       await dbRun(`UPDATE lot_serials SET status = 'Pasif' WHERE id = ?`, [req.params.id]);
//       return res.json({
//         success: true,
//         message: "Hareket geçmişi olduğu için kayıt pasifleştirildi."
//       });
//     }

//     await dbRun(`DELETE FROM lot_serial_movements WHERE lot_serial_id = ?`, [req.params.id]);
//     await dbRun(`DELETE FROM lot_serials WHERE id = ?`, [req.params.id]);

//     res.json({ success: true, message: "Lot / seri kaydı silindi." });
//   } catch (err) {
//     console.error("Lot silme hatası:", err);
//     res.status(500).json({ success: false, message: err.message });
//   }
// });


// /* İŞ EMİRLERİ SELECT İÇİN */
// app.get("/api/documents/work-orders", async (req, res) => {
//   try {
//     const rows = await dbAll(`
//       SELECT 
//         id,
//         work_order_no,
//         part_name,
//         title,
//         status
//       FROM work_orders
//       ORDER BY id DESC
//     `);

//     res.json({ success: true, workOrders: rows });
//   } catch (err) {
//     console.error("Doküman iş emirleri alınamadı:", err);
//     res.status(500).json({ success: false, message: err.message });
//   }
// });

// /* ==========================================================
//    BAKIM PLANLAMA 2.0 BACKEND
//    app.js / server.js içine ekle
// ========================================================== */

// db.serialize(() => {
//   db.run(`
//     CREATE TABLE IF NOT EXISTS maintenance_plans (
//       id INTEGER PRIMARY KEY AUTOINCREMENT,
//       plan_no TEXT UNIQUE,
//       machine_id INTEGER,
//       machine_name TEXT NOT NULL,
//       maintenance_type TEXT DEFAULT 'Periyodik Bakım',
//       period_type TEXT DEFAULT 'Aylık',
//       period_value INTEGER DEFAULT 1,
//       last_maintenance_date DATE,
//       next_maintenance_date DATE,
//       estimated_duration_min INTEGER DEFAULT 60,
//       responsible_person TEXT,
//       priority TEXT DEFAULT 'Normal',
//       status TEXT DEFAULT 'Aktif',
//       description TEXT,
//       created_by TEXT,
//       created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
//       updated_at DATETIME
//     )
//   `);

//   db.run(`
//     CREATE TABLE IF NOT EXISTS maintenance_plan_tasks (
//       id INTEGER PRIMARY KEY AUTOINCREMENT,
//       plan_id INTEGER NOT NULL,
//       task_name TEXT NOT NULL,
//       task_order INTEGER DEFAULT 1,
//       is_required INTEGER DEFAULT 1,
//       note TEXT,
//       created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
//       FOREIGN KEY(plan_id) REFERENCES maintenance_plans(id)
//     )
//   `);

//   db.run(`
//     CREATE TABLE IF NOT EXISTS maintenance_executions (
//       id INTEGER PRIMARY KEY AUTOINCREMENT,
//       execution_no TEXT UNIQUE,
//       plan_id INTEGER,
//       plan_no TEXT,
//       machine_id INTEGER,
//       machine_name TEXT,
//       maintenance_date DATE DEFAULT CURRENT_DATE,
//       completed_date DATETIME,
//       status TEXT DEFAULT 'Açık',
//       result TEXT DEFAULT 'Bekliyor',
//       downtime_min INTEGER DEFAULT 0,
//       cost REAL DEFAULT 0,
//       responsible_person TEXT,
//       note TEXT,
//       created_by TEXT,
//       created_at DATETIME DEFAULT CURRENT_TIMESTAMP
//     )
//   `);
// });

// /* Promise helperlar sende varsa tekrar ekleme */
// function dbAll(sql, params = []) {
//   return new Promise((resolve, reject) => {
//     db.all(sql, params, (err, rows) => err ? reject(err) : resolve(rows));
//   });
// }
// function dbGet(sql, params = []) {
//   return new Promise((resolve, reject) => {
//     db.get(sql, params, (err, row) => err ? reject(err) : resolve(row));
//   });
// }
// function dbRun(sql, params = []) {
//   return new Promise((resolve, reject) => {
//     db.run(sql, params, function(err) {
//       if (err) reject(err);
//       else resolve(this);
//     });
//   });
// }

// function generateMaintenancePlanNo() {
//   return "BKP" + Date.now();
// }
// function generateMaintenanceExecutionNo() {
//   return "BKM" + Date.now();
// }

// function calculateNextMaintenanceDate(lastDate, periodType, periodValue) {
//   if (!lastDate) return null;
//   const d = new Date(lastDate);
//   const value = Number(periodValue || 1);

//   if (periodType === "Günlük") d.setDate(d.getDate() + value);
//   else if (periodType === "Haftalık") d.setDate(d.getDate() + (value * 7));
//   else if (periodType === "Aylık") d.setMonth(d.getMonth() + value);
//   else if (periodType === "Yıllık") d.setFullYear(d.getFullYear() + value);
//   else d.setMonth(d.getMonth() + value);

//   return d.toISOString().slice(0, 10);
// }

// /* Makine select */
// app.get("/api/maintenance-planning/machines", async (req, res) => {
//   try {
//     const table = await dbGet(`SELECT name FROM sqlite_master WHERE type='table' AND name='machines'`);

//     if (!table) {
//       return res.json({ success: true, machines: [] });
//     }

//     const rows = await dbAll(`
//       SELECT id, machine_name, name, code, status
//       FROM machines
//       ORDER BY id DESC
//     `);

//     res.json({
//       success: true,
//       machines: rows.map(m => ({
//         id: m.id,
//         machine_name: m.machine_name || m.name || m.code || ("Makine " + m.id),
//         status: m.status || ""
//       }))
//     });
//   } catch (err) {
//     console.error("Bakım makineleri alınamadı:", err);
//     res.json({ success: true, machines: [] });
//   }
// });

// /* KPI */
// app.get("/api/maintenance-planning/kpi", async (req, res) => {
//   try {
//     const activePlans = await dbGet(`
//       SELECT COUNT(*) AS c
//       FROM maintenance_plans
//       WHERE status = 'Aktif'
//     `);

//     const overdue = await dbGet(`
//       SELECT COUNT(*) AS c
//       FROM maintenance_plans
//       WHERE status = 'Aktif'
//         AND next_maintenance_date IS NOT NULL
//         AND date(next_maintenance_date) < date('now')
//     `);

//     const upcoming = await dbGet(`
//       SELECT COUNT(*) AS c
//       FROM maintenance_plans
//       WHERE status = 'Aktif'
//         AND next_maintenance_date IS NOT NULL
//         AND date(next_maintenance_date) BETWEEN date('now') AND date('now', '+7 day')
//     `);

//     const openExec = await dbGet(`
//       SELECT COUNT(*) AS c
//       FROM maintenance_executions
//       WHERE status IN ('Açık', 'Devam Ediyor')
//     `);

//     const cost = await dbGet(`
//       SELECT IFNULL(SUM(cost), 0) AS total
//       FROM maintenance_executions
//       WHERE strftime('%Y-%m', maintenance_date) = strftime('%Y-%m', 'now')
//     `);

//     res.json({
//       success: true,
//       kpi: {
//         activePlans: activePlans.c,
//         overduePlans: overdue.c,
//         upcomingPlans: upcoming.c,
//         openExecutions: openExec.c,
//         monthlyCost: cost.total
//       }
//     });
//   } catch (err) {
//     console.error("Bakım KPI alınamadı:", err);
//     res.status(500).json({ success: false, message: err.message });
//   }
// });

// /* Planları listele */
// app.get("/api/maintenance-plans", async (req, res) => {
//   try {
//     const { q, status, alert } = req.query;
//     const where = [];
//     const params = [];

//     if (status) {
//       where.push("status = ?");
//       params.push(status);
//     }

//     if (alert === "overdue") {
//       where.push("date(next_maintenance_date) < date('now')");
//     }

//     if (alert === "upcoming") {
//       where.push("date(next_maintenance_date) BETWEEN date('now') AND date('now', '+7 day')");
//     }

//     if (q) {
//       where.push(`(
//         plan_no LIKE ? OR
//         machine_name LIKE ? OR
//         maintenance_type LIKE ? OR
//         responsible_person LIKE ?
//       )`);
//       params.push(`%${q}%`, `%${q}%`, `%${q}%`, `%${q}%`);
//     }

//     const whereSql = where.length ? "WHERE " + where.join(" AND ") : "";

//     const rows = await dbAll(`
//       SELECT 
//         mp.*,
//         CASE
//           WHEN mp.next_maintenance_date IS NULL THEN 'Tarih Yok'
//           WHEN date(mp.next_maintenance_date) < date('now') THEN 'Gecikti'
//           WHEN date(mp.next_maintenance_date) BETWEEN date('now') AND date('now', '+7 day') THEN 'Yaklaşıyor'
//           ELSE 'Normal'
//         END AS plan_alert,
//         (
//           SELECT COUNT(*)
//           FROM maintenance_plan_tasks mpt
//           WHERE mpt.plan_id = mp.id
//         ) AS task_count
//       FROM maintenance_plans mp
//       ${whereSql}
//       ORDER BY
//         CASE
//           WHEN mp.next_maintenance_date IS NULL THEN 4
//           WHEN date(mp.next_maintenance_date) < date('now') THEN 1
//           WHEN date(mp.next_maintenance_date) BETWEEN date('now') AND date('now', '+7 day') THEN 2
//           ELSE 3
//         END,
//         mp.next_maintenance_date ASC
//     `, params);

//     res.json({ success: true, plans: rows });
//   } catch (err) {
//     console.error("Bakım planları alınamadı:", err);
//     res.status(500).json({ success: false, message: err.message });
//   }
// });

// /* Plan detay */
// app.get("/api/maintenance-plans/:id", async (req, res) => {
//   try {
//     const plan = await dbGet(`SELECT * FROM maintenance_plans WHERE id = ?`, [req.params.id]);

//     if (!plan) {
//       return res.status(404).json({ success: false, message: "Bakım planı bulunamadı." });
//     }

//     const tasks = await dbAll(`
//       SELECT *
//       FROM maintenance_plan_tasks
//       WHERE plan_id = ?
//       ORDER BY task_order ASC, id ASC
//     `, [req.params.id]);

//     const executions = await dbAll(`
//       SELECT *
//       FROM maintenance_executions
//       WHERE plan_id = ?
//       ORDER BY id DESC
//     `, [req.params.id]);

//     res.json({ success: true, plan, tasks, executions });
//   } catch (err) {
//     console.error("Bakım plan detay hatası:", err);
//     res.status(500).json({ success: false, message: err.message });
//   }
// });

// /* Plan oluştur */
// app.post("/api/maintenance-plans", async (req, res) => {
//   try {
//     const {
//       machine_id,
//       machine_name,
//       maintenance_type,
//       period_type,
//       period_value,
//       last_maintenance_date,
//       next_maintenance_date,
//       estimated_duration_min,
//       responsible_person,
//       priority,
//       description,
//       tasks,
//       created_by
//     } = req.body;

//     if (!machine_name) {
//       return res.status(400).json({ success: false, message: "Makine adı zorunludur." });
//     }

//     const planNo = generateMaintenancePlanNo();
//     const nextDate = next_maintenance_date || calculateNextMaintenanceDate(
//       last_maintenance_date,
//       period_type || "Aylık",
//       period_value || 1
//     );

//     await dbRun("BEGIN TRANSACTION");

//     try {
//       const result = await dbRun(`
//         INSERT INTO maintenance_plans
//         (
//           plan_no,
//           machine_id,
//           machine_name,
//           maintenance_type,
//           period_type,
//           period_value,
//           last_maintenance_date,
//           next_maintenance_date,
//           estimated_duration_min,
//           responsible_person,
//           priority,
//           description,
//           created_by
//         )
//         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
//       `, [
//         planNo,
//         machine_id || null,
//         machine_name,
//         maintenance_type || "Periyodik Bakım",
//         period_type || "Aylık",
//         Number(period_value || 1),
//         last_maintenance_date || null,
//         nextDate || null,
//         Number(estimated_duration_min || 60),
//         responsible_person || "",
//         priority || "Normal",
//         description || "",
//         created_by || req.headers["x-user-name"] || "Sistem"
//       ]);

//       const planId = result.lastID;
//       const taskList = Array.isArray(tasks) && tasks.length ? tasks : [
//         { task_name: "Genel temizlik kontrolü" },
//         { task_name: "Yağlama kontrolü" },
//         { task_name: "Emniyet ekipmanları kontrolü" }
//       ];

//       let order = 1;
//       for (const t of taskList) {
//         if (!t.task_name) continue;

//         await dbRun(`
//           INSERT INTO maintenance_plan_tasks
//           (plan_id, task_name, task_order, is_required, note)
//           VALUES (?, ?, ?, ?, ?)
//         `, [
//           planId,
//           t.task_name,
//           order++,
//           t.is_required === 0 ? 0 : 1,
//           t.note || ""
//         ]);
//       }

//       await dbRun("COMMIT");

//       res.json({
//         success: true,
//         message: "Bakım planı oluşturuldu.",
//         id: planId,
//         plan_no: planNo
//       });
//     } catch (err) {
//       await dbRun("ROLLBACK");
//       throw err;
//     }

//   } catch (err) {
//     console.error("Bakım planı oluşturma hatası:", err);
//     res.status(500).json({ success: false, message: err.message });
//   }
// });

// /* Plan güncelle */
// app.put("/api/maintenance-plans/:id", async (req, res) => {
//   try {
//     const {
//       machine_name,
//       maintenance_type,
//       period_type,
//       period_value,
//       last_maintenance_date,
//       next_maintenance_date,
//       estimated_duration_min,
//       responsible_person,
//       priority,
//       status,
//       description
//     } = req.body;

//     const plan = await dbGet(`SELECT * FROM maintenance_plans WHERE id = ?`, [req.params.id]);

//     if (!plan) {
//       return res.status(404).json({ success: false, message: "Bakım planı bulunamadı." });
//     }

//     await dbRun(`
//       UPDATE maintenance_plans
//       SET
//         machine_name = ?,
//         maintenance_type = ?,
//         period_type = ?,
//         period_value = ?,
//         last_maintenance_date = ?,
//         next_maintenance_date = ?,
//         estimated_duration_min = ?,
//         responsible_person = ?,
//         priority = ?,
//         status = ?,
//         description = ?,
//         updated_at = datetime('now')
//       WHERE id = ?
//     `, [
//       machine_name || plan.machine_name,
//       maintenance_type || plan.maintenance_type,
//       period_type || plan.period_type,
//       Number(period_value || plan.period_value || 1),
//       last_maintenance_date || null,
//       next_maintenance_date || null,
//       Number(estimated_duration_min || plan.estimated_duration_min || 60),
//       responsible_person || "",
//       priority || plan.priority,
//       status || plan.status,
//       description || "",
//       req.params.id
//     ]);

//     res.json({ success: true, message: "Bakım planı güncellendi." });
//   } catch (err) {
//     console.error("Bakım planı güncelleme hatası:", err);
//     res.status(500).json({ success: false, message: err.message });
//   }
// });

// /* Plandan bakım emri oluştur */
// app.post("/api/maintenance-plans/:id/create-execution", async (req, res) => {
//   try {
//     const { maintenance_date, created_by } = req.body;

//     const plan = await dbGet(`SELECT * FROM maintenance_plans WHERE id = ?`, [req.params.id]);

//     if (!plan) {
//       return res.status(404).json({ success: false, message: "Bakım planı bulunamadı." });
//     }

//     const executionNo = generateMaintenanceExecutionNo();

//     const result = await dbRun(`
//       INSERT INTO maintenance_executions
//       (
//         execution_no,
//         plan_id,
//         plan_no,
//         machine_id,
//         machine_name,
//         maintenance_date,
//         status,
//         result,
//         responsible_person,
//         note,
//         created_by
//       )
//       VALUES (?, ?, ?, ?, ?, ?, 'Açık', 'Bekliyor', ?, ?, ?)
//     `, [
//       executionNo,
//       plan.id,
//       plan.plan_no,
//       plan.machine_id || null,
//       plan.machine_name,
//       maintenance_date || plan.next_maintenance_date || new Date().toISOString().slice(0, 10),
//       plan.responsible_person || "",
//       plan.description || "",
//       created_by || req.headers["x-user-name"] || "Sistem"
//     ]);

//     res.json({
//       success: true,
//       message: "Bakım emri oluşturuldu.",
//       id: result.lastID,
//       execution_no: executionNo
//     });
//   } catch (err) {
//     console.error("Bakım emri oluşturma hatası:", err);
//     res.status(500).json({ success: false, message: err.message });
//   }
// });

// /* Bakım emirleri listele */
// app.get("/api/maintenance-executions", async (req, res) => {
//   try {
//     const rows = await dbAll(`
//       SELECT *
//       FROM maintenance_executions
//       ORDER BY id DESC
//     `);

//     res.json({ success: true, executions: rows });
//   } catch (err) {
//     console.error("Bakım emirleri alınamadı:", err);
//     res.status(500).json({ success: false, message: err.message });
//   }
// });

// /* Bakım emri tamamla */
// app.put("/api/maintenance-executions/:id/complete", async (req, res) => {
//   try {
//     const { result, downtime_min, cost, note, completed_by } = req.body;

//     const execution = await dbGet(`SELECT * FROM maintenance_executions WHERE id = ?`, [req.params.id]);

//     if (!execution) {
//       return res.status(404).json({ success: false, message: "Bakım emri bulunamadı." });
//     }

//     if (execution.status === "Tamamlandı") {
//       return res.status(400).json({ success: false, message: "Bakım emri zaten tamamlanmış." });
//     }

//     await dbRun("BEGIN TRANSACTION");

//     try {
//       await dbRun(`
//         UPDATE maintenance_executions
//         SET
//           status = 'Tamamlandı',
//           result = ?,
//           downtime_min = ?,
//           cost = ?,
//           note = ?,
//           completed_date = datetime('now')
//         WHERE id = ?
//       `, [
//         result || "Tamamlandı",
//         Number(downtime_min || 0),
//         Number(cost || 0),
//         note || "",
//         req.params.id
//       ]);

//       if (execution.plan_id) {
//         const plan = await dbGet(`SELECT * FROM maintenance_plans WHERE id = ?`, [execution.plan_id]);

//         if (plan) {
//           const today = new Date().toISOString().slice(0, 10);
//           const nextDate = calculateNextMaintenanceDate(today, plan.period_type, plan.period_value);

//           await dbRun(`
//             UPDATE maintenance_plans
//             SET
//               last_maintenance_date = ?,
//               next_maintenance_date = ?,
//               updated_at = datetime('now')
//             WHERE id = ?
//           `, [today, nextDate, plan.id]);
//         }
//       }

//       await dbRun("COMMIT");

//       res.json({ success: true, message: "Bakım emri tamamlandı." });
//     } catch (err) {
//       await dbRun("ROLLBACK");
//       throw err;
//     }

//   } catch (err) {
//     console.error("Bakım emri tamamlama hatası:", err);
//     res.status(500).json({ success: false, message: err.message });
//   }
// });

// /* Plan sil */
// app.delete("/api/maintenance-plans/:id", async (req, res) => {
//   try {
//     const plan = await dbGet(`SELECT * FROM maintenance_plans WHERE id = ?`, [req.params.id]);

//     if (!plan) {
//       return res.status(404).json({ success: false, message: "Bakım planı bulunamadı." });
//     }

//     const execCount = await dbGet(`SELECT COUNT(*) AS c FROM maintenance_executions WHERE plan_id = ?`, [req.params.id]);

//     if (execCount.c > 0) {
//       await dbRun(`UPDATE maintenance_plans SET status = 'Pasif' WHERE id = ?`, [req.params.id]);
//       return res.json({ success: true, message: "Geçmiş bakım emri olduğu için plan pasifleştirildi." });
//     }

//     await dbRun(`DELETE FROM maintenance_plan_tasks WHERE plan_id = ?`, [req.params.id]);
//     await dbRun(`DELETE FROM maintenance_plans WHERE id = ?`, [req.params.id]);

//     res.json({ success: true, message: "Bakım planı silindi." });
//   } catch (err) {
//     console.error("Bakım planı silme hatası:", err);
//     res.status(500).json({ success: false, message: err.message });
//   }
// });

// db.serialize(() => {
//   db.run(`
//     CREATE TABLE IF NOT EXISTS shipment_barcode_plans (
//       id INTEGER PRIMARY KEY AUTOINCREMENT,
//       shipment_no TEXT UNIQUE,
//       customer_id INTEGER,
//       customer_name TEXT,
//       work_order_id INTEGER,
//       work_order_no TEXT,
//       shipment_date DATE DEFAULT CURRENT_DATE,
//       status TEXT DEFAULT 'Planlandı',
//       description TEXT,
//       created_by TEXT,
//       created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
//       approved_by TEXT,
//       approved_at DATETIME,
//       cancelled_by TEXT,
//       cancelled_at DATETIME,
//       cancel_reason TEXT
//     )
//   `);

//   db.run(`
//     CREATE TABLE IF NOT EXISTS shipment_barcode_lines (
//       id INTEGER PRIMARY KEY AUTOINCREMENT,
//       shipment_id INTEGER NOT NULL,
//       stock_id INTEGER,
//       stock_code TEXT,
//       part_name TEXT,
//       lot_serial_id INTEGER,
//       tracking_no TEXT,
//       lot_no TEXT,
//       serial_no TEXT,
//       pallet_no TEXT,
//       box_no TEXT,
//       barcode_no TEXT,
//       planned_qty REAL DEFAULT 0,
//       scanned_qty REAL DEFAULT 0,
//       shipped_qty REAL DEFAULT 0,
//       unit TEXT DEFAULT 'Adet',
//       status TEXT DEFAULT 'Bekliyor',
//       note TEXT,
//       created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
//       FOREIGN KEY(shipment_id) REFERENCES shipment_barcode_plans(id)
//     )
//   `);
// });

// /* Promise helperlar sende varsa tekrar ekleme */
// function dbAll(sql, params = []) {
//   return new Promise((resolve, reject) => db.all(sql, params, (err, rows) => err ? reject(err) : resolve(rows)));
// }
// function dbGet(sql, params = []) {
//   return new Promise((resolve, reject) => db.get(sql, params, (err, row) => err ? reject(err) : resolve(row)));
// }
// function dbRun(sql, params = []) {
//   return new Promise((resolve, reject) => db.run(sql, params, function(err) { err ? reject(err) : resolve(this); }));
// }

// function generateShipmentBarcodeNo() {
//   return "SVK" + Date.now();
// }
// function generateShipmentBarcodeLineNo(prefix = "BRK") {
//   return prefix + Date.now() + Math.floor(Math.random() * 999);
// }

// /* Select verileri */
// app.get("/api/shipment-barcode/customers", async (req, res) => {
//   try {
//     const rows = await dbAll(`
//       SELECT id, company_name, customer_code, authorized_person
//       FROM customers
//       ORDER BY company_name ASC
//     `);
//     res.json({ success: true, customers: rows });
//   } catch (err) {
//     console.error("Sevkiyat müşterileri alınamadı:", err);
//     res.status(500).json({ success: false, message: err.message });
//   }
// });

// app.get("/api/shipment-barcode/work-orders", async (req, res) => {
//   try {
//     const rows = await dbAll(`
//       SELECT id, work_order_no, part_name, title, status
//       FROM work_orders
//       ORDER BY id DESC
//     `);
//     res.json({ success: true, workOrders: rows });
//   } catch (err) {
//     console.error("Sevkiyat iş emirleri alınamadı:", err);
//     res.status(500).json({ success: false, message: err.message });
//   }
// });

// app.get("/api/shipment-barcode/stocks", async (req, res) => {
//   try {
//     const rows = await dbAll(`
//       SELECT id, stock_code, part_name, quantity, unit, location
//       FROM stocks
//       WHERE IFNULL(status, 'active') != 'passive'
//       ORDER BY part_name ASC
//     `);
//     res.json({ success: true, stocks: rows });
//   } catch (err) {
//     console.error("Sevkiyat stokları alınamadı:", err);
//     res.status(500).json({ success: false, message: err.message });
//   }
// });

// app.get("/api/shipment-barcode/lots", async (req, res) => {
//   try {
//     const { stockId } = req.query;

//     const table = await dbGet(`SELECT name FROM sqlite_master WHERE type='table' AND name='lot_serials'`);
//     if (!table) return res.json({ success: true, lots: [] });

//     const where = ["remaining_quantity > 0", "status IN ('Aktif', 'Tükendi')"];
//     const params = [];

//     if (stockId) {
//       where.push("stock_id = ?");
//       params.push(stockId);
//     }

//     const rows = await dbAll(`
//       SELECT *
//       FROM lot_serials
//       WHERE ${where.join(" AND ")}
//       ORDER BY id DESC
//     `, params);

//     res.json({ success: true, lots: rows });
//   } catch (err) {
//     console.error("Sevkiyat lotları alınamadı:", err);
//     res.status(500).json({ success: false, message: err.message });
//   }
// });

// /* KPI */
// app.get("/api/shipment-barcode/kpi", async (req, res) => {
//   try {
//     const planned = await dbGet(`SELECT COUNT(*) AS c FROM shipment_barcode_plans WHERE status = 'Planlandı'`);
//     const ready = await dbGet(`SELECT COUNT(*) AS c FROM shipment_barcode_plans WHERE status = 'Hazır'`);
//     const shipped = await dbGet(`SELECT COUNT(*) AS c FROM shipment_barcode_plans WHERE status = 'Sevk Edildi'`);
//     const today = await dbGet(`
//       SELECT COUNT(*) AS c
//       FROM shipment_barcode_plans
//       WHERE date(shipment_date) = date('now')
//     `);
//     const qty = await dbGet(`
//       SELECT IFNULL(SUM(shipped_qty), 0) AS total
//       FROM shipment_barcode_lines
//     `);

//     res.json({
//       success: true,
//       kpi: {
//         planned: planned.c,
//         ready: ready.c,
//         shipped: shipped.c,
//         today: today.c,
//         shippedQty: qty.total
//       }
//     });
//   } catch (err) {
//     console.error("Sevkiyat KPI alınamadı:", err);
//     res.status(500).json({ success: false, message: err.message });
//   }
// });

// /* Sevkiyatları listele */
// app.get("/api/shipment-barcode/plans", async (req, res) => {
//   try {
//     const { q, status } = req.query;
//     const where = [];
//     const params = [];

//     if (status) {
//       where.push("sbp.status = ?");
//       params.push(status);
//     }

//     if (q) {
//       where.push(`(
//         sbp.shipment_no LIKE ? OR
//         sbp.customer_name LIKE ? OR
//         sbp.work_order_no LIKE ?
//       )`);
//       params.push(`%${q}%`, `%${q}%`, `%${q}%`);
//     }

//     const whereSql = where.length ? "WHERE " + where.join(" AND ") : "";

//     const rows = await dbAll(`
//       SELECT
//         sbp.*,
//         COUNT(sbl.id) AS line_count,
//         IFNULL(SUM(sbl.planned_qty), 0) AS planned_qty,
//         IFNULL(SUM(sbl.scanned_qty), 0) AS scanned_qty,
//         IFNULL(SUM(sbl.shipped_qty), 0) AS shipped_qty
//       FROM shipment_barcode_plans sbp
//       LEFT JOIN shipment_barcode_lines sbl ON sbl.shipment_id = sbp.id
//       ${whereSql}
//       GROUP BY sbp.id
//       ORDER BY sbp.id DESC
//     `, params);

//     res.json({ success: true, plans: rows });
//   } catch (err) {
//     console.error("Sevkiyat planları alınamadı:", err);
//     res.status(500).json({ success: false, message: err.message });
//   }
// });

// /* Detay */
// app.get("/api/shipment-barcode/plans/:id", async (req, res) => {
//   try {
//     const plan = await dbGet(`SELECT * FROM shipment_barcode_plans WHERE id = ?`, [req.params.id]);
//     if (!plan) return res.status(404).json({ success: false, message: "Sevkiyat bulunamadı." });

//     const lines = await dbAll(`
//       SELECT *
//       FROM shipment_barcode_lines
//       WHERE shipment_id = ?
//       ORDER BY id ASC
//     `, [req.params.id]);

//     res.json({ success: true, plan, lines });
//   } catch (err) {
//     console.error("Sevkiyat detay alınamadı:", err);
//     res.status(500).json({ success: false, message: err.message });
//   }
// });

// /* Sevkiyat planı oluştur */
// app.post("/api/shipment-barcode/plans", async (req, res) => {
//   try {
//     const {
//       customer_id,
//       customer_name,
//       work_order_id,
//       shipment_date,
//       description,
//       lines,
//       created_by
//     } = req.body;

//     if (!customer_name) {
//       return res.status(400).json({ success: false, message: "Müşteri zorunludur." });
//     }

//     if (!Array.isArray(lines) || !lines.length) {
//       return res.status(400).json({ success: false, message: "En az bir sevkiyat satırı girilmelidir." });
//     }

//     let workOrderNo = "";
//     if (work_order_id) {
//       const wo = await dbGet(`SELECT work_order_no FROM work_orders WHERE id = ?`, [work_order_id]);
//       workOrderNo = wo?.work_order_no || "";
//     }

//     await dbRun("BEGIN TRANSACTION");

//     try {
//       const shipmentNo = generateShipmentBarcodeNo();

//       const result = await dbRun(`
//         INSERT INTO shipment_barcode_plans
//         (
//           shipment_no,
//           customer_id,
//           customer_name,
//           work_order_id,
//           work_order_no,
//           shipment_date,
//           status,
//           description,
//           created_by
//         )
//         VALUES (?, ?, ?, ?, ?, ?, 'Planlandı', ?, ?)
//       `, [
//         shipmentNo,
//         customer_id || null,
//         customer_name,
//         work_order_id || null,
//         workOrderNo,
//         shipment_date || new Date().toISOString().slice(0, 10),
//         description || "",
//         created_by || req.headers["x-user-name"] || "Sistem"
//       ]);

//       const shipmentId = result.lastID;

//       for (const line of lines) {
//         if (!line.stock_id || Number(line.planned_qty || 0) <= 0) {
//           throw new Error("Satırlarda stok ve planlanan miktar zorunludur.");
//         }

//         const stock = await dbGet(`SELECT * FROM stocks WHERE id = ?`, [line.stock_id]);
//         if (!stock) throw new Error("Stok kartı bulunamadı.");

//         let lot = null;
//         if (line.lot_serial_id) {
//           lot = await dbGet(`SELECT * FROM lot_serials WHERE id = ?`, [line.lot_serial_id]);
//         }

//         await dbRun(`
//           INSERT INTO shipment_barcode_lines
//           (
//             shipment_id,
//             stock_id,
//             stock_code,
//             part_name,
//             lot_serial_id,
//             tracking_no,
//             lot_no,
//             serial_no,
//             pallet_no,
//             box_no,
//             barcode_no,
//             planned_qty,
//             scanned_qty,
//             shipped_qty,
//             unit,
//             status,
//             note
//           )
//           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0, ?, 'Bekliyor', ?)
//         `, [
//           shipmentId,
//           stock.id,
//           stock.stock_code || "",
//           stock.part_name || "",
//           lot?.id || null,
//           lot?.tracking_no || "",
//           lot?.lot_no || "",
//           lot?.serial_no || "",
//           line.pallet_no || "",
//           line.box_no || "",
//           line.barcode_no || generateShipmentBarcodeLineNo(),
//           Number(line.planned_qty || 0),
//           stock.unit || line.unit || "Adet",
//           line.note || ""
//         ]);
//       }

//       await dbRun("COMMIT");

//       res.json({
//         success: true,
//         message: "Sevkiyat planı oluşturuldu.",
//         id: shipmentId,
//         shipment_no: shipmentNo
//       });

//     } catch (err) {
//       await dbRun("ROLLBACK");
//       throw err;
//     }

//   } catch (err) {
//     console.error("Sevkiyat oluşturma hatası:", err);
//     res.status(500).json({ success: false, message: err.message });
//   }
// });

// /* Barkod okut / satır onayla */
// app.post("/api/shipment-barcode/plans/:id/scan", async (req, res) => {
//   try {
//     const { barcode_no, quantity, scanned_by } = req.body;

//     if (!barcode_no) {
//       return res.status(400).json({ success: false, message: "Barkod zorunludur." });
//     }

//     const plan = await dbGet(`SELECT * FROM shipment_barcode_plans WHERE id = ?`, [req.params.id]);
//     if (!plan) return res.status(404).json({ success: false, message: "Sevkiyat bulunamadı." });

//     if (plan.status === "Sevk Edildi") {
//       return res.status(400).json({ success: false, message: "Sevk edilmiş plan okutulamaz." });
//     }

//     const line = await dbGet(`
//       SELECT *
//       FROM shipment_barcode_lines
//       WHERE shipment_id = ?
//         AND (
//           barcode_no = ? OR
//           pallet_no = ? OR
//           box_no = ? OR
//           tracking_no = ? OR
//           lot_no = ? OR
//           serial_no = ?
//         )
//     `, [req.params.id, barcode_no, barcode_no, barcode_no, barcode_no, barcode_no, barcode_no]);

//     if (!line) {
//       return res.status(404).json({ success: false, message: "Barkod bu sevkiyat planında bulunamadı." });
//     }

//     const qty = Number(quantity || line.planned_qty || 0);
//     const planned = Number(line.planned_qty || 0);
//     const newScanned = Number(line.scanned_qty || 0) + qty;

//     if (newScanned > planned) {
//       return res.status(400).json({
//         success: false,
//         message: `Okutulan miktar planlananı geçemez. Plan: ${planned}, okutulmuş: ${line.scanned_qty}`
//       });
//     }

//     await dbRun(`
//       UPDATE shipment_barcode_lines
//       SET scanned_qty = ?,
//           status = CASE WHEN ? >= planned_qty THEN 'Okutuldu' ELSE 'Kısmi Okutuldu' END
//       WHERE id = ?
//     `, [newScanned, newScanned, line.id]);

//     const remaining = await dbGet(`
//       SELECT COUNT(*) AS c
//       FROM shipment_barcode_lines
//       WHERE shipment_id = ?
//         AND scanned_qty < planned_qty
//     `, [req.params.id]);

//     if (remaining.c === 0) {
//       await dbRun(`UPDATE shipment_barcode_plans SET status = 'Hazır' WHERE id = ?`, [req.params.id]);
//     }

//     res.json({
//       success: true,
//       message: "Barkod okutuldu.",
//       line_id: line.id,
//       scanned_qty: newScanned
//     });

//   } catch (err) {
//     console.error("Barkod okutma hatası:", err);
//     res.status(500).json({ success: false, message: err.message });
//   }
// });

// /* Sevkiyatı onayla */
// app.put("/api/shipment-barcode/plans/:id/approve", async (req, res) => {
//   try {
//     const approvedBy = req.body.approved_by || req.headers["x-user-name"] || "Sistem";

//     const plan = await dbGet(`SELECT * FROM shipment_barcode_plans WHERE id = ?`, [req.params.id]);
//     if (!plan) return res.status(404).json({ success: false, message: "Sevkiyat bulunamadı." });

//     if (plan.status === "Sevk Edildi") {
//       return res.status(400).json({ success: false, message: "Bu sevkiyat zaten onaylanmış." });
//     }

//     const lines = await dbAll(`SELECT * FROM shipment_barcode_lines WHERE shipment_id = ?`, [req.params.id]);
//     if (!lines.length) return res.status(400).json({ success: false, message: "Sevkiyat satırı yok." });

//     const notReady = lines.filter(l => Number(l.scanned_qty || 0) < Number(l.planned_qty || 0));
//     if (notReady.length) {
//       return res.status(400).json({
//         success: false,
//         message: "Tüm satırlar okutulmadan sevkiyat onaylanamaz."
//       });
//     }

//     await dbRun("BEGIN TRANSACTION");

//     try {
//       for (const line of lines) {
//         const qty = Number(line.scanned_qty || line.planned_qty || 0);

//         const stock = await dbGet(`SELECT * FROM stocks WHERE id = ?`, [line.stock_id]);
//         if (!stock) throw new Error(`${line.part_name || line.stock_code} stok kartı bulunamadı.`);

//         const previousStock = Number(stock.quantity || 0);
//         if (previousStock < qty) {
//           throw new Error(`${stock.part_name || stock.stock_code} için stok yetersiz. Mevcut: ${previousStock}, sevk: ${qty}`);
//         }

//         const nextStock = previousStock - qty;

//         await dbRun(`UPDATE stocks SET quantity = ? WHERE id = ?`, [nextStock, stock.id]);

//         await dbRun(`
//           INSERT INTO stock_movements
//           (
//             movement_no,
//             movement_date,
//             stock_id,
//             stock_code,
//             part_name,
//             movement_type,
//             quantity,
//             previous_stock,
//             next_stock,
//             description,
//             created_by,
//             created_at
//           )
//           VALUES (?, datetime('now'), ?, ?, ?, 'Sevkiyat Çıkış', ?, ?, ?, ?, ?, datetime('now'))
//         `, [
//           "HRK" + Date.now() + line.id,
//           stock.id,
//           stock.stock_code || "",
//           stock.part_name || "",
//           qty,
//           previousStock,
//           nextStock,
//           `${plan.shipment_no} numaralı barkodlu sevkiyat`,
//           approvedBy
//         ]);

//         if (line.lot_serial_id) {
//           const lot = await dbGet(`SELECT * FROM lot_serials WHERE id = ?`, [line.lot_serial_id]);
//           if (lot) {
//             const prevLot = Number(lot.remaining_quantity || 0);
//             if (prevLot < qty) {
//               throw new Error(`${line.tracking_no || line.lot_no} lot miktarı yetersiz. Kalan: ${prevLot}, sevk: ${qty}`);
//             }

//             const nextLot = prevLot - qty;

//             await dbRun(`
//               INSERT INTO lot_serial_movements
//               (
//                 lot_serial_id,
//                 movement_no,
//                 movement_type,
//                 quantity,
//                 previous_quantity,
//                 next_quantity,
//                 work_order_id,
//                 work_order_no,
//                 customer_id,
//                 customer_name,
//                 description,
//                 created_by
//               )
//               VALUES (?, ?, 'Sevkiyat', ?, ?, ?, ?, ?, ?, ?, ?, ?)
//             `, [
//               lot.id,
//               "LTH" + Date.now() + line.id,
//               qty,
//               prevLot,
//               nextLot,
//               plan.work_order_id || null,
//               plan.work_order_no || "",
//               plan.customer_id || null,
//               plan.customer_name || "",
//               `${plan.shipment_no} numaralı sevkiyat`,
//               approvedBy
//             ]);

//             await dbRun(`
//               UPDATE lot_serials
//               SET remaining_quantity = ?,
//                   status = CASE WHEN ? <= 0 THEN 'Tükendi' ELSE status END
//               WHERE id = ?
//             `, [nextLot, nextLot, lot.id]);
//           }
//         }

//         await dbRun(`
//           UPDATE shipment_barcode_lines
//           SET shipped_qty = ?,
//               status = 'Sevk Edildi'
//           WHERE id = ?
//         `, [qty, line.id]);
//       }

//       await dbRun(`
//         UPDATE shipment_barcode_plans
//         SET status = 'Sevk Edildi',
//             approved_by = ?,
//             approved_at = datetime('now')
//         WHERE id = ?
//       `, [approvedBy, req.params.id]);

//       await dbRun("COMMIT");

//       res.json({
//         success: true,
//         message: "Sevkiyat onaylandı, stok ve lot hareketleri oluşturuldu."
//       });

//     } catch (err) {
//       await dbRun("ROLLBACK");
//       throw err;
//     }

//   } catch (err) {
//     console.error("Sevkiyat onaylama hatası:", err);
//     res.status(500).json({ success: false, message: err.message });
//   }
// });

// /* İptal */
// app.put("/api/shipment-barcode/plans/:id/cancel", async (req, res) => {
//   try {
//     const { cancel_reason, cancelled_by } = req.body;

//     const plan = await dbGet(`SELECT * FROM shipment_barcode_plans WHERE id = ?`, [req.params.id]);
//     if (!plan) return res.status(404).json({ success: false, message: "Sevkiyat bulunamadı." });

//     if (plan.status === "Sevk Edildi") {
//       return res.status(400).json({ success: false, message: "Sevk edilmiş plan iptal edilemez." });
//     }

//     await dbRun(`
//       UPDATE shipment_barcode_plans
//       SET status = 'İptal',
//           cancelled_by = ?,
//           cancelled_at = datetime('now'),
//           cancel_reason = ?
//       WHERE id = ?
//     `, [
//       cancelled_by || req.headers["x-user-name"] || "Sistem",
//       cancel_reason || "Sebep belirtilmedi",
//       req.params.id
//     ]);

//     res.json({ success: true, message: "Sevkiyat iptal edildi." });
//   } catch (err) {
//     console.error("Sevkiyat iptal hatası:", err);
//     res.status(500).json({ success: false, message: err.message });
//   }
// });

// /* Sil */
// app.delete("/api/shipment-barcode/plans/:id", async (req, res) => {
//   try {
//     const plan = await dbGet(`SELECT * FROM shipment_barcode_plans WHERE id = ?`, [req.params.id]);
//     if (!plan) return res.status(404).json({ success: false, message: "Sevkiyat bulunamadı." });

//     if (plan.status === "Sevk Edildi") {
//       return res.status(400).json({ success: false, message: "Sevk edilmiş plan silinemez." });
//     }

//     await dbRun(`DELETE FROM shipment_barcode_lines WHERE shipment_id = ?`, [req.params.id]);
//     await dbRun(`DELETE FROM shipment_barcode_plans WHERE id = ?`, [req.params.id]);

//     res.json({ success: true, message: "Sevkiyat planı silindi." });
//   } catch (err) {
//     console.error("Sevkiyat silme hatası:", err);
//     res.status(500).json({ success: false, message: err.message });
//   }
// });


// app.get("/api/operator-performance", (req, res) => {
//   const { startDate, endDate, operator } = req.query;

//   let sql = `
//     SELECT *
//     FROM operator_performance
//     WHERE 1=1
//   `;

//   const params = [];

//   if (startDate) {
//     sql += ` AND date(performance_date) >= date(?)`;
//     params.push(startDate);
//   }

//   if (endDate) {
//     sql += ` AND date(performance_date) <= date(?)`;
//     params.push(endDate);
//   }

//   if (operator) {
//     sql += ` AND operator_name LIKE ?`;
//     params.push(`%${operator}%`);
//   }

//   sql += ` ORDER BY performance_date DESC, id DESC`;

//   db.all(sql, params, (err, rows) => {
//     if (err) {
//       console.error("Operatör performans listeleme hatası:", err);
//       return res.status(500).json({ success: false, message: err.message });
//     }

//     res.json({ success: true, data: rows });
//   });
// });


// app.post("/api/operator-performance", (req, res) => {
//   const {
//     operator_name,
//     work_order_no,
//     machine_name,
//     operation_name,
//     target_qty,
//     production_qty,
//     scrap_qty,
//     worked_minutes,
//     is_completed,
//     performance_date,
//     note
//   } = req.body;

//   if (!operator_name) {
//     return res.status(400).json({
//       success: false,
//       message: "Operatör adı zorunludur."
//     });
//   }

//   db.run(`
//     INSERT INTO operator_performance (
//       operator_name,
//       work_order_no,
//       machine_name,
//       operation_name,
//       target_qty,
//       production_qty,
//       scrap_qty,
//       worked_minutes,
//       is_completed,
//       performance_date,
//       note
//     )
//     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
//   `, [
//     operator_name,
//     work_order_no || "",
//     machine_name || "",
//     operation_name || "",
//     Number(target_qty || 0),
//     Number(production_qty || 0),
//     Number(scrap_qty || 0),
//     Number(worked_minutes || 0),
//     is_completed ? 1 : 0,
//     performance_date || new Date().toISOString().slice(0, 10),
//     note || ""
//   ], function(err) {
//     if (err) {
//       console.error("Operatör performans ekleme hatası:", err);
//       return res.status(500).json({ success: false, message: err.message });
//     }

//     res.json({
//       success: true,
//       message: "Operatör performans kaydı oluşturuldu.",
//       id: this.lastID
//     });
//   });
// });


// app.put("/api/operator-performance/:id", (req, res) => {
//   const { id } = req.params;

//   const {
//     operator_name,
//     work_order_no,
//     machine_name,
//     operation_name,
//     target_qty,
//     production_qty,
//     scrap_qty,
//     worked_minutes,
//     is_completed,
//     performance_date,
//     note
//   } = req.body;

//   db.run(`
//     UPDATE operator_performance
//     SET
//       operator_name = ?,
//       work_order_no = ?,
//       machine_name = ?,
//       operation_name = ?,
//       target_qty = ?,
//       production_qty = ?,
//       scrap_qty = ?,
//       worked_minutes = ?,
//       is_completed = ?,
//       performance_date = ?,
//       note = ?
//     WHERE id = ?
//   `, [
//     operator_name,
//     work_order_no || "",
//     machine_name || "",
//     operation_name || "",
//     Number(target_qty || 0),
//     Number(production_qty || 0),
//     Number(scrap_qty || 0),
//     Number(worked_minutes || 0),
//     is_completed ? 1 : 0,
//     performance_date || new Date().toISOString().slice(0, 10),
//     note || "",
//     id
//   ], function(err) {
//     if (err) {
//       console.error("Operatör performans güncelleme hatası:", err);
//       return res.status(500).json({ success: false, message: err.message });
//     }

//     res.json({
//       success: true,
//       message: "Operatör performans kaydı güncellendi."
//     });
//   });
// });


// app.delete("/api/operator-performance/:id", (req, res) => {
//   const { id } = req.params;

//   db.run(`
//     DELETE FROM operator_performance
//     WHERE id = ?
//   `, [id], function(err) {
//     if (err) {
//       console.error("Operatör performans silme hatası:", err);
//       return res.status(500).json({ success: false, message: err.message });
//     }

//     res.json({
//       success: true,
//       message: "Operatör performans kaydı silindi."
//     });
//   });
// });


// app.get("/api/operator-performance/summary", (req, res) => {
//   const { startDate, endDate } = req.query;

//   let sql = `
//     SELECT
//       operator_name,
//       SUM(production_qty) AS total_production,
//       SUM(scrap_qty) AS total_scrap,
//       SUM(worked_minutes) AS total_worked_minutes,
//       SUM(is_completed) AS completed_work_orders,
//       AVG(
//         CASE 
//           WHEN target_qty > 0 THEN (production_qty * 100.0 / target_qty)
//           ELSE 0
//         END
//       ) AS efficiency_rate,
//       CASE
//         WHEN SUM(production_qty + scrap_qty) > 0
//         THEN SUM(scrap_qty) * 100.0 / SUM(production_qty + scrap_qty)
//         ELSE 0
//       END AS scrap_rate
//     FROM operator_performance
//     WHERE 1=1
//   `;

//   const params = [];

//   if (startDate) {
//     sql += ` AND date(performance_date) >= date(?)`;
//     params.push(startDate);
//   }

//   if (endDate) {
//     sql += ` AND date(performance_date) <= date(?)`;
//     params.push(endDate);
//   }

//   sql += `
//     GROUP BY operator_name
//     ORDER BY efficiency_rate DESC, total_production DESC
//   `;

//   db.all(sql, params, (err, rows) => {
//     if (err) {
//       console.error("Operatör performans özet hatası:", err);
//       return res.status(500).json({ success: false, message: err.message });
//     }

//     res.json({ success: true, data: rows });
//   });
// });

// app.get("/api/machine-downtimes", (req, res) => {
//   const { startDate, endDate, machine } = req.query;

//   let sql = `
//     SELECT *
//     FROM machine_downtimes
//     WHERE 1=1
//   `;

//   const params = [];

//   if (startDate) {
//     sql += ` AND date(start_time) >= date(?)`;
//     params.push(startDate);
//   }

//   if (endDate) {
//     sql += ` AND date(start_time) <= date(?)`;
//     params.push(endDate);
//   }

//   if (machine) {
//     sql += ` AND machine_name LIKE ?`;
//     params.push(`%${machine}%`);
//   }

//   sql += ` ORDER BY start_time DESC, id DESC`;

//   db.all(sql, params, (err, rows) => {
//     if (err) {
//       console.error("Makine duruş listeleme hatası:", err);
//       return res.status(500).json({ success:false, message:err.message });
//     }

//     res.json({ success:true, data:rows });
//   });
// });


// app.post("/api/machine-downtimes", (req, res) => {
//   const {
//     machine_name,
//     operator_name,
//     work_order_no,
//     downtime_reason,
//     downtime_type,
//     start_time,
//     end_time,
//     description
//   } = req.body;

//   if (!machine_name || !downtime_reason || !start_time) {
//     return res.status(400).json({
//       success:false,
//       message:"Makine, duruş nedeni ve başlangıç zamanı zorunludur."
//     });
//   }

//   const total_minutes = calculateMinutes(start_time, end_time);

//   db.run(`
//     INSERT INTO machine_downtimes (
//       machine_name,
//       operator_name,
//       work_order_no,
//       downtime_reason,
//       downtime_type,
//       start_time,
//       end_time,
//       total_minutes,
//       description
//     )
//     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
//   `, [
//     machine_name,
//     operator_name || "",
//     work_order_no || "",
//     downtime_reason,
//     downtime_type || "plansiz",
//     start_time,
//     end_time || null,
//     total_minutes,
//     description || ""
//   ], function(err) {
//     if (err) {
//       console.error("Makine duruş ekleme hatası:", err);
//       return res.status(500).json({ success:false, message:err.message });
//     }

//     res.json({
//       success:true,
//       message:"Makine duruş kaydı oluşturuldu.",
//       id:this.lastID
//     });
//   });
// });


// app.put("/api/machine-downtimes/:id", (req, res) => {
//   const { id } = req.params;

//   const {
//     machine_name,
//     operator_name,
//     work_order_no,
//     downtime_reason,
//     downtime_type,
//     start_time,
//     end_time,
//     description
//   } = req.body;

//   const total_minutes = calculateMinutes(start_time, end_time);

//   db.run(`
//     UPDATE machine_downtimes
//     SET
//       machine_name = ?,
//       operator_name = ?,
//       work_order_no = ?,
//       downtime_reason = ?,
//       downtime_type = ?,
//       start_time = ?,
//       end_time = ?,
//       total_minutes = ?,
//       description = ?
//     WHERE id = ?
//   `, [
//     machine_name,
//     operator_name || "",
//     work_order_no || "",
//     downtime_reason,
//     downtime_type || "plansiz",
//     start_time,
//     end_time || null,
//     total_minutes,
//     description || "",
//     id
//   ], function(err) {
//     if (err) {
//       console.error("Makine duruş güncelleme hatası:", err);
//       return res.status(500).json({ success:false, message:err.message });
//     }

//     res.json({
//       success:true,
//       message:"Makine duruş kaydı güncellendi."
//     });
//   });
// });


// app.delete("/api/machine-downtimes/:id", (req, res) => {
//   const { id } = req.params;

//   db.run(`
//     DELETE FROM machine_downtimes
//     WHERE id = ?
//   `, [id], function(err) {
//     if (err) {
//       console.error("Makine duruş silme hatası:", err);
//       return res.status(500).json({ success:false, message:err.message });
//     }

//     res.json({
//       success:true,
//       message:"Makine duruş kaydı silindi."
//     });
//   });
// });


// app.get("/api/machine-downtimes/summary", (req, res) => {
//   const { startDate, endDate } = req.query;

//   let sql = `
//     SELECT
//       machine_name,
//       COUNT(*) AS downtime_count,
//       SUM(total_minutes) AS total_minutes,
//       SUM(CASE WHEN downtime_type = 'planli' THEN total_minutes ELSE 0 END) AS planned_minutes,
//       SUM(CASE WHEN downtime_type = 'plansiz' THEN total_minutes ELSE 0 END) AS unplanned_minutes
//     FROM machine_downtimes
//     WHERE 1=1
//   `;

//   const params = [];

//   if (startDate) {
//     sql += ` AND date(start_time) >= date(?)`;
//     params.push(startDate);
//   }

//   if (endDate) {
//     sql += ` AND date(start_time) <= date(?)`;
//     params.push(endDate);
//   }

//   sql += `
//     GROUP BY machine_name
//     ORDER BY total_minutes DESC
//   `;

//   db.all(sql, params, (err, rows) => {
//     if (err) {
//       console.error("Makine duruş özet hatası:", err);
//       return res.status(500).json({ success:false, message:err.message });
//     }

//     res.json({ success:true, data:rows });
//   });
// });

// app.get("/api/notifications", (req, res) => {
//   db.all(`
//     SELECT *
//     FROM notifications
//     ORDER BY datetime(created_at) DESC
//     LIMIT 100
//   `, [], (err, rows) => {
//     if (err) {
//       console.error("Bildirim listeleme hatası:", err);
//       return res.status(500).json({
//         success: false,
//         message: err.message
//       });
//     }

//     db.get(`
//       SELECT COUNT(*) AS unreadCount
//       FROM notifications
//       WHERE is_read = 0
//     `, [], (countErr, countRow) => {
//       if (countErr) {
//         console.error("Bildirim sayısı hatası:", countErr);
//         return res.status(500).json({
//           success: false,
//           message: countErr.message
//         });
//       }

//       res.json({
//         success: true,
//         unreadCount: countRow?.unreadCount || 0,
//         notifications: rows || []
//       });
//     });
//   });
// });
// // ===============================
// // BİLDİRİM EKLE
// // ===============================
// app.post("/api/notifications", (req, res) => {
//   const {
//     title,
//     message,
//     type,
//     related_type,
//     related_id
//   } = req.body;

//   if (!title || !message) {
//     return res.status(400).json({
//       success: false,
//       message: "Başlık ve mesaj zorunludur."
//     });
//   }

//   db.run(`
//     INSERT INTO notifications (
//       title,
//       message,
//       type,
//       related_type,
//       related_id,
//       is_read,
//       created_by
//     )
//     VALUES (?, ?, ?, ?, ?, 0, ?)
//   `, [
//     title,
//     message,
//     type || "info",
//     related_type || null,
//     related_id || null,
//     req.headers["x-user-name"] || "Sistem"
//   ], function(err) {
//     if (err) {
//       console.error("Bildirim ekleme hatası:", err);
//       return res.status(500).json({
//         success: false,
//         message: err.message
//       });
//     }

//     res.json({
//       success: true,
//       message: "Bildirim oluşturuldu.",
//       id: this.lastID
//     });
//   });
// });
// // ===============================
// // TEK BİLDİRİMİ OKUNDU YAP
// // ===============================
// app.put("/api/notifications/:id/read", (req, res) => {
//   const id = req.params.id;

//   db.run(`
//     UPDATE notifications
//     SET is_read = 1
//     WHERE id = ?
//   `, [id], function(err) {
//     if (err) {
//       console.error("Bildirim okundu hatası:", err);
//       return res.status(500).json({
//         success: false,
//         message: err.message
//       });
//     }

//     res.json({
//       success: true,
//       message: "Bildirim okundu olarak işaretlendi."
//     });
//   });
// });
// // ===============================
// // TÜM BİLDİRİMLERİ OKUNDU YAP
// // ===============================
// app.put("/api/notifications/read-all", (req, res) => {
//   db.run(`
//     UPDATE notifications
//     SET is_read = 1
//     WHERE is_read = 0
//   `, [], function(err) {
//     if (err) {
//       console.error("Tüm bildirimleri okundu yapma hatası:", err);
//       return res.status(500).json({
//         success: false,
//         message: err.message
//       });
//     }

//     res.json({
//       success: true,
//       message: "Tüm bildirimler okundu olarak işaretlendi."
//     });
//   });
// });

// app.delete("/api/notifications/:id", (req, res) => {
//   const id = req.params.id;

//   db.run(`
//     DELETE FROM notifications
//     WHERE id = ?
//   `, [id], function(err) {
//     if (err) {
//       console.error("Bildirim silme hatası:", err);
//       return res.status(500).json({
//         success: false,
//         message: err.message
//       });
//     }

//     res.json({
//       success: true,
//       message: "Bildirim silindi."
//     });
//   });
// });


// app.post("/api/notifications/demo/create", (req, res) => {
//   const demoNotifications = [
//     ["Stok Seviyesi Kritik", "ALM-001 minimum stok seviyesinin altına düştü.", "stock"],
//     ["İş Emri Gecikti", "IE-2026-0045 teslim tarihi geçti.", "work_order"],
//     ["Satın Alma Onayı Bekliyor", "SAT-0021 numaralı talep onay bekliyor.", "purchase"],
//     ["Makine Bakımı Yaklaşıyor", "CNC-05 bakım tarihi yaklaşıyor.", "maintenance"]
//   ];

//   const stmt = db.prepare(`
//     INSERT INTO notifications (title, message, type, is_read, created_by)
//     VALUES (?, ?, ?, 0, 'Sistem')
//   `);

//   demoNotifications.forEach(n => {
//     stmt.run(n[0], n[1], n[2]);
//   });

//   stmt.finalize();

//   res.json({
//     success: true,
//     message: "Demo bildirimler oluşturuldu."
//   });
// });

// function calculateMinutes(start, end) {
//   if (!start || !end) return 0;

//   const startDate = new Date(start);
//   const endDate = new Date(end);

//   if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) return 0;

//   const diff = Math.floor((endDate - startDate) / 60000);

//   return diff > 0 ? diff : 0;
// }

// /* DOKÜMAN DETAY */
// app.get("/api/documents/:id", async (req, res) => {
//   try {
//     const document = await dbGet(`
//       SELECT *
//       FROM documents
//       WHERE id = ?
//     `, [req.params.id]);

//     if (!document) {
//       return res.status(404).json({
//         success: false,
//         message: "Doküman bulunamadı."
//       });
//     }

//     res.json({ success: true, document });
//   } catch (err) {
//     console.error("Doküman detay hatası:", err);
//     res.status(500).json({ success: false, message: err.message });
//   }
// });

// /* DOKÜMAN YÜKLE */
// app.post("/api/documents", documentUpload.single("file"), async (req, res) => {
//   try {
//     const {
//       work_order_id,
//       document_type,
//       title,
//       revision_no,
//       description,
//       uploaded_by
//     } = req.body;

//     if (!req.file) {
//       return res.status(400).json({
//         success: false,
//         message: "Dosya seçilmelidir."
//       });
//     }

//     if (!title) {
//       return res.status(400).json({
//         success: false,
//         message: "Doküman başlığı zorunludur."
//       });
//     }

//     let workOrderNo = "";

//     if (work_order_id) {
//       const wo = await dbGet(`
//         SELECT work_order_no
//         FROM work_orders
//         WHERE id = ?
//       `, [work_order_id]);

//       workOrderNo = wo?.work_order_no || "";
//     }

//     const documentNo = generateDocumentNo();
//     const ext = path.extname(req.file.originalname).toLowerCase();

//     const result = await dbRun(`
//       INSERT INTO documents
//       (
//         document_no,
//         work_order_id,
//         work_order_no,
//         document_type,
//         title,
//         revision_no,
//         file_name,
//         original_file_name,
//         file_path,
//         file_ext,
//         file_size,
//         description,
//         uploaded_by
//       )
//       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
//     `, [
//       documentNo,
//       work_order_id || null,
//       workOrderNo,
//       document_type || "Genel",
//       title,
//       revision_no || "R0",
//       req.file.filename,
//       req.file.originalname,
//       req.file.path,
//       ext,
//       req.file.size,
//       description || "",
//       uploaded_by || req.headers["x-user-name"] || "Sistem"
//     ]);

//     res.json({
//       success: true,
//       message: "Doküman yüklendi.",
//       id: result.lastID,
//       document_no: documentNo
//     });

//   } catch (err) {
//     console.error("Doküman yükleme hatası:", err);

//     if (req.file && req.file.path && fs.existsSync(req.file.path)) {
//       fs.unlinkSync(req.file.path);
//     }

//     res.status(500).json({ success: false, message: err.message });
//   }
// });

// /* DOKÜMAN GÜNCELLE */
// app.put("/api/documents/:id", async (req, res) => {
//   try {
//     const {
//       work_order_id,
//       document_type,
//       title,
//       revision_no,
//       description,
//       status
//     } = req.body;

//     const document = await dbGet(`
//       SELECT *
//       FROM documents
//       WHERE id = ?
//     `, [req.params.id]);

//     if (!document) {
//       return res.status(404).json({
//         success: false,
//         message: "Doküman bulunamadı."
//       });
//     }

//     let workOrderNo = document.work_order_no || "";

//     if (work_order_id) {
//       const wo = await dbGet(`
//         SELECT work_order_no
//         FROM work_orders
//         WHERE id = ?
//       `, [work_order_id]);

//       workOrderNo = wo?.work_order_no || "";
//     }

//     await dbRun(`
//       UPDATE documents
//       SET
//         work_order_id = ?,
//         work_order_no = ?,
//         document_type = ?,
//         title = ?,
//         revision_no = ?,
//         description = ?,
//         status = ?
//       WHERE id = ?
//     `, [
//       work_order_id || null,
//       workOrderNo,
//       document_type || document.document_type,
//       title || document.title,
//       revision_no || document.revision_no,
//       description || "",
//       status || document.status,
//       req.params.id
//     ]);

//     res.json({
//       success: true,
//       message: "Doküman güncellendi."
//     });

//   } catch (err) {
//     console.error("Doküman güncelleme hatası:", err);
//     res.status(500).json({ success: false, message: err.message });
//   }
// });

// /* DOKÜMAN İNDİR */
// app.get("/api/documents/:id/download", async (req, res) => {
//   try {
//     const document = await dbGet(`
//       SELECT *
//       FROM documents
//       WHERE id = ?
//     `, [req.params.id]);

//     if (!document) {
//       return res.status(404).send("Doküman bulunamadı.");
//     }

//     if (!document.file_path || !fs.existsSync(document.file_path)) {
//       return res.status(404).send("Dosya sunucuda bulunamadı.");
//     }

//     res.download(document.file_path, document.original_file_name || document.file_name);
//   } catch (err) {
//     console.error("Doküman indirme hatası:", err);
//     res.status(500).send(err.message);
//   }
// });

// /* DOKÜMAN PASİFLEŞTİR */
// app.put("/api/documents/:id/archive", async (req, res) => {
//   try {
//     const document = await dbGet(`
//       SELECT *
//       FROM documents
//       WHERE id = ?
//     `, [req.params.id]);

//     if (!document) {
//       return res.status(404).json({
//         success: false,
//         message: "Doküman bulunamadı."
//       });
//     }

//     await dbRun(`
//       UPDATE documents
//       SET status = 'Pasif'
//       WHERE id = ?
//     `, [req.params.id]);

//     res.json({
//       success: true,
//       message: "Doküman pasifleştirildi."
//     });

//   } catch (err) {
//     console.error("Doküman pasifleştirme hatası:", err);
//     res.status(500).json({ success: false, message: err.message });
//   }
// });

// /* DOKÜMAN SİL */
// app.delete("/api/documents/:id", async (req, res) => {
//   try {
//     const document = await dbGet(`
//       SELECT *
//       FROM documents
//       WHERE id = ?
//     `, [req.params.id]);

//     if (!document) {
//       return res.status(404).json({
//         success: false,
//         message: "Doküman bulunamadı."
//       });
//     }

//     if (document.file_path && fs.existsSync(document.file_path)) {
//       fs.unlinkSync(document.file_path);
//     }

//     await dbRun(`
//       DELETE FROM documents
//       WHERE id = ?
//     `, [req.params.id]);

//     res.json({
//       success: true,
//       message: "Doküman silindi."
//     });

//   } catch (err) {
//     console.error("Doküman silme hatası:", err);
//     res.status(500).json({ success: false, message: err.message });
//   }
// });


// // SAYIM FİŞİ SİL
// app.delete("/api/stock-counts/:id", async (req, res) => {
//   try {
//     const count = await dbGet(`SELECT * FROM stock_counts WHERE id = ?`, [req.params.id]);
//     if (!count) return res.status(404).json({ success: false, message: "Sayım fişi bulunamadı." });
//     if (count.status === "Onaylandı") return res.status(400).json({ success: false, message: "Onaylı sayım fişi silinemez." });

//     await dbRun(`DELETE FROM stock_count_lines WHERE count_id = ?`, [req.params.id]);
//     await dbRun(`DELETE FROM stock_counts WHERE id = ?`, [req.params.id]);
//     res.json({ success: true, message: "Sayım fişi silindi." });
//   } catch (err) {
//     console.error("Sayım fişi silme hatası:", err);
//     res.status(500).json({ success: false, message: err.message });
//   }
// });



// app.get("/api/dashboard/kpi-2", async (req, res) => {
//   try {
//     const kpi = {};

//     db.get(`SELECT COUNT(*) AS count FROM work_orders WHERE status IN ('Beklemede','Üretimde','waiting','production','progress')`, [], (err, openWo) => {
//       if (err) return res.status(500).json({ success:false, message:err.message });

//       db.get(`SELECT COUNT(*) AS count FROM work_orders WHERE date(due_date) < date('now') AND status NOT IN ('Tamamlandı','completed','cancelled')`, [], (err, lateWo) => {
//         if (err) return res.status(500).json({ success:false, message:err.message });

//         db.get(`SELECT COUNT(*) AS count FROM stocks WHERE quantity <= min_quantity`, [], (err, criticalStock) => {
//           if (err) return res.status(500).json({ success:false, message:err.message });

//           db.get(`SELECT COUNT(*) AS count FROM purchase_requests WHERE status IN ('Beklemede','Planlandı','waiting','planned')`, [], (err, purchaseReq) => {
//             if (err) return res.status(500).json({ success:false, message:err.message });

//             db.get(`SELECT COUNT(*) AS count FROM purchase_orders WHERE status IN ('Onay Bekliyor','Beklemede','waiting','pending')`, [], (err, purchaseOrders) => {
//               if (err) return res.status(500).json({ success:false, message:err.message });

//               db.get(`SELECT IFNULL(SUM(total_amount),0) AS total FROM offers WHERE strftime('%Y-%m', offer_date) = strftime('%Y-%m', 'now')`, [], (err, monthlyOffers) => {
//                 if (err) return res.status(500).json({ success:false, message:err.message });

//                 db.get(`SELECT IFNULL(SUM(debit - credit),0) AS total FROM current_transactions`, [], (err, receivable) => {
//                   if (err) return res.status(500).json({ success:false, message:err.message });

//                   db.all(`
//                     SELECT 
//                       date(created_at) AS day,
//                       COUNT(*) AS movementCount
//                     FROM stock_movements
//                     WHERE date(created_at) >= date('now','-6 day')
//                     GROUP BY date(created_at)
//                     ORDER BY date(created_at)
//                   `, [], (err, stockChart) => {
//                     if (err) return res.status(500).json({ success:false, message:err.message });

//                     res.json({
//                       success: true,
//                       kpi: {
//                         openWorkOrders: openWo.count,
//                         lateWorkOrders: lateWo.count,
//                         criticalStock: criticalStock.count,
//                         pendingPurchaseRequests: purchaseReq.count,
//                         pendingPurchaseOrders: purchaseOrders.count,
//                         monthlyOfferTotal: monthlyOffers.total,
//                         receivableTotal: receivable.total,
//                         stockMovementChart: stockChart
//                       }
//                     });
//                   });
//                 });
//               });
//             });
//           });
//         });
//       });
//     });
//   } catch (error) {
//     res.status(500).json({ success:false, message:error.message });
//   }
// });
// // ===============================
// // FIRE / HURDA İPTAL
// // ===============================
// app.put("/api/scrap-records/:id/cancel", (req, res) => {
//   db.run(`
//     UPDATE scrap_records
//     SET status = 'İptal'
//     WHERE id = ? AND status = 'Beklemede'
//   `, [req.params.id], function(err) {
//     if (err) {
//       console.error("Fire/hurda iptal hatası:", err);
//       return res.status(500).json({ success:false, message:err.message });
//     }

//     res.json({ success:true, message:"Fire/hurda kaydı iptal edildi." });
//   });
// });

// app.post("/api/login", (req, res) => {

//     const { username, password } = req.body;

//     if (!username || !password) {
//         return res.status(400).json({
//             success: false,
//             message: "Kullanıcı adı ve şifre gerekli."
//         });
//     }

//     db.get(
//         `
//         SELECT *
//         FROM users
//         WHERE username = ?
//         AND password = ?
//         AND active = 1
//         `,
//         [username, password],
//         (err, user) => {

//             if (err) {
//                 return res.status(500).json({
//                     success: false,
//                     message: err.message
//                 });
//             }

//             if (!user) {
//                 return res.status(401).json({
//                     success: false,
//                     message: "Kullanıcı adı veya şifre hatalı."
//                 });
//             }

//             res.json({
//                 success: true,
//                 user: {
//                     id: user.id,
//                     fullName: user.full_name,
//                     role: user.role,
//                     username: user.username
//                 }
//             });

//         }
//     );

// });

// app.listen(PORT, () => {
//   console.log(`CNC Mini ERP ${PORT} portunda çalışıyor`);
// });