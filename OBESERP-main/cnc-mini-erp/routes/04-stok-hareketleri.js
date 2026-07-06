// STOK HAREKETLERİ
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
// STOK HAREKETLERİ
// ===============================

app.get("/api/stock-movements", (req, res) => {
  db.all(`
    SELECT 
      sm.*,
      s.stock_code,
      s.part_name,
      s.unit
    FROM stock_movements sm
    LEFT JOIN stocks s ON s.id = sm.stock_id
    ORDER BY sm.id DESC
  `, [], (err, rows) => {
    if (err) {
      return res.status(500).json({
        success: false,
        message: err.message,
        movements: []
      });
    }

    res.json({
      success: true,
      movements: rows || []
    });
  });
});

app.post("/api/stock-movements", (req, res) => {
  const {
    stockId,
    movementType,
    quantity,
    documentNo,
    description
  } = req.body;

  if (!stockId || !movementType || !quantity) {
    return res.status(400).json({
      success: false,
      message: "Stok, hareket tipi ve miktar zorunludur."
    });
  }

  db.get(
    `SELECT id, quantity, part_name FROM stocks WHERE id = ?`,
    [stockId],
    (err, stock) => {
      if (err) {
        return res.status(500).json({
          success: false,
          message: err.message
        });
      }

      if (!stock) {
        return res.status(404).json({
          success: false,
          message: "Stok bulunamadı."
        });
      }

      const beforeQty = Number(stock.quantity || 0);
      const qty = Number(quantity || 0);

      let afterQty = beforeQty;

      if (movementType === "in") {
        afterQty = beforeQty + qty;
      } else if (movementType === "out") {
        afterQty = beforeQty - qty;
      } else if (movementType === "count") {
        afterQty = qty;
      } else {
        return res.status(400).json({
          success: false,
          message: "Geçersiz hareket tipi."
        });
      }

      if (afterQty < 0) {
        return res.status(400).json({
          success: false,
          message: "Stok miktarı eksiye düşemez."
        });
      }

      db.run(
        `
        INSERT INTO stock_movements
        (
          stock_id,
          movement_type,
          quantity,
          before_qty,
          after_qty,
          document_no,
          description,
          created_by
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `,
        [
          stockId,
          movementType,
          qty,
          beforeQty,
          afterQty,
          documentNo || "",
          description || "",
          req.headers["x-user-name"] || "Bilinmeyen Kullanıcı"
        ],
        function (err) {
          if (err) {
            return res.status(500).json({
              success: false,
              message: err.message
            });
          }

          db.run(
            `UPDATE stocks SET quantity = ? WHERE id = ?`,
            [afterQty, stockId],
            updateErr => {
              if (updateErr) {
                return res.status(500).json({
                  success: false,
                  message: updateErr.message
                });
              }

              if (typeof addActivityLog === "function") {
                addActivityLog(req, {
                  moduleName: "Stok Hareketleri",
                  actionType: "CREATE",
                  description: `${stock.part_name} için stok hareketi oluşturuldu.`,
                  recordId: this.lastID
                });
              }

              res.json({
                success: true,
                message: "Stok hareketi kaydedildi.",
                id: this.lastID,
                beforeQty,
                afterQty
              });
            }
          );
        }
      );
    }
  );
});

app.get("/api/notifications", (req, res) => {
  const userId = req.headers["x-user-id"];
  const roleKey = req.headers["x-user-role"];

  db.all(`
    SELECT *
    FROM notifications
    WHERE 
      (user_id = ? OR user_id IS NULL)
      AND (role_key = ? OR role_key IS NULL OR role_key = '')
    ORDER BY id DESC
    LIMIT 50
  `, [userId, roleKey], (err, rows) => {
    if (err) {
      return res.status(500).json({
        success: false,
        message: err.message,
        notifications: []
      });
    }

    const unreadCount = rows.filter(x => Number(x.is_read) === 0).length;

    res.json({
      success: true,
      unreadCount,
      notifications: rows || []
    });
  });
});

app.put("/api/notifications/:id/read", (req, res) => {
  db.run(`
    UPDATE notifications
    SET is_read = 1
    WHERE id = ?
  `, [req.params.id], function(err) {
    if (err) {
      return res.status(500).json({
        success: false,
        message: err.message
      });
    }

    res.json({ success: true });
  });
});

app.put("/api/notifications/read-all", (req, res) => {
  const userId = req.headers["x-user-id"];
  const roleKey = req.headers["x-user-role"];

  db.run(`
    UPDATE notifications
    SET is_read = 1
    WHERE 
      (user_id = ? OR user_id IS NULL)
      AND (role_key = ? OR role_key IS NULL OR role_key = '')
  `, [userId, roleKey], function(err) {
    if (err) {
      return res.status(500).json({
        success: false,
        message: err.message
      });
    }

    res.json({ success: true });
  });
});



// Kullanıcı profil güncelleme
app.put("/api/users/:id/profile", (req, res) => {
  const { fullName, username, email } = req.body;
  const { id } = req.params;

  if (!fullName || !username) {
    return res.status(400).json({
      success: false,
      message: "Ad soyad ve kullanıcı adı zorunludur."
    });
  }

  db.run(`
    UPDATE users
    SET
      full_name = ?,
      username = ?,
      email = ?
    WHERE id = ?
  `,
  [
    fullName,
    username,
    email || "",
    id
  ],
  function(err) {
    if (err) {
      if (err.message.includes("UNIQUE constraint failed")) {
        return res.status(400).json({
          success: false,
          message: "Bu kullanıcı adı zaten kullanılıyor."
        });
      }

      return res.status(500).json({
        success: false,
        message: err.message
      });
    }

    res.json({
      success: true,
      message: "Profil bilgileri güncellendi."
    });
  });
});

// Şifre değiştirme
app.put("/api/users/:id/password", (req, res) => {
  const { currentPassword, newPassword } = req.body;
  const { id } = req.params;

  if (!currentPassword || !newPassword) {
    return res.status(400).json({
      success: false,
      message: "Mevcut şifre ve yeni şifre zorunludur."
    });
  }

  if (newPassword.length < 6) {
    return res.status(400).json({
      success: false,
      message: "Yeni şifre en az 6 karakter olmalıdır."
    });
  }

  db.get(`
    SELECT id, password
    FROM users
    WHERE id = ?
  `, [id], (err, user) => {
    if (err) {
      return res.status(500).json({
        success: false,
        message: err.message
      });
    }

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "Kullanıcı bulunamadı."
      });
    }

    if (user.password !== currentPassword) {
      return res.status(400).json({
        success: false,
        message: "Mevcut şifre hatalı."
      });
    }

    db.run(`
      UPDATE users
      SET password = ?
      WHERE id = ?
    `, [newPassword, id], function(err) {
      if (err) {
        return res.status(500).json({
          success: false,
          message: err.message
        });
      }

      res.json({
        success: true,
        message: "Şifre başarıyla güncellendi."
      });
    });
  });
});

app.get("/api/employees", (req, res) => {
  db.all("SELECT * FROM employees ORDER BY id DESC", [], (err, rows) => {
    if (err) {
      return res.json({ success: false, message: err.message, employees: [] });
    }

    res.json({
      success: true,
      employees: rows.map(e => ({
        id: e.id,
        fullName: e.full_name,
        identityNo: e.identity_no,
        phone: e.phone,
        department: e.department,
        position: e.position,
        hireDate: e.hire_date,
        salary: e.salary,
        status: e.status
      }))
    });
  });
});
db.run(`
  CREATE TABLE IF NOT EXISTS employees (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    full_name TEXT NOT NULL,
    identity_no TEXT,
    phone TEXT,
    department TEXT,
    position TEXT,
    hire_date TEXT,
    salary REAL DEFAULT 0,
    status TEXT DEFAULT 'active',
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  )
`);
app.post("/api/employees", (req, res) => {
  const {
    fullName,
    identityNo,
    phone,
    department,
    position,
    hireDate,
    salary
  } = req.body;

  if (!fullName) {
    return res.json({ success: false, message: "Ad soyad zorunludur." });
  }

  const sql = `
    INSERT INTO employees
    (full_name, identity_no, phone, department, position, hire_date, salary, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, 'active')
  `;

  db.run(sql, [
    fullName,
    identityNo,
    phone,
    department,
    position,
    hireDate,
    salary || 0
  ], function (err) {
    if (err) {
      return res.json({ success: false, message: err.message });
    }

    res.json({ success: true, id: this.lastID });
  });
});

app.put("/api/employees/:id", (req, res) => {
  const {
    fullName,
    identityNo,
    phone,
    department,
    position,
    hireDate,
    salary
  } = req.body;

  const sql = `
    UPDATE employees SET
      full_name = ?,
      identity_no = ?,
      phone = ?,
      department = ?,
      position = ?,
      hire_date = ?,
      salary = ?
    WHERE id = ?
  `;

  db.run(sql, [
    fullName,
    identityNo,
    phone,
    department,
    position,
    hireDate,
    salary || 0,
    req.params.id
  ], function (err) {
    if (err) {
      return res.json({ success: false, message: err.message });
    }

    res.json({ success: true });
  });
});

app.put("/api/employees/:id/status", (req, res) => {
  const { status } = req.body;

  db.run(
    "UPDATE employees SET status = ? WHERE id = ?",
    [status, req.params.id],
    function (err) {
      if (err) {
        return res.json({ success: false, message: err.message });
      }

      res.json({ success: true });
    }
  );
});

app.get("/api/employee-leaves", (req, res) => {
  const sql = `
    SELECT 
      l.*,
      e.full_name
    FROM employee_leaves l
    LEFT JOIN employees e ON e.id = l.employee_id
    ORDER BY l.id DESC
  `;

  db.all(sql, [], (err, rows) => {
    if (err) {
      return res.status(500).json({ success: false, message: err.message, leaves: [] });
    }

    res.json({
      success: true,
      leaves: rows.map(l => ({
        id: l.id,
        employeeId: l.employee_id,
        employeeName: l.full_name,
        leaveType: l.leave_type,
        startDate: l.start_date,
        endDate: l.end_date,
        totalDays: l.total_days,
        description: l.description,
        status: l.status
      }))
    });
  });
});

app.post("/api/employee-leaves", (req, res) => {
  const { employeeId, leaveType, startDate, endDate, totalDays, description, status } = req.body;

  if (!employeeId || !leaveType || !startDate || !endDate) {
    return res.status(400).json({ success: false, message: "Zorunlu alanlar eksik." });
  }

  db.run(
    `
    INSERT INTO employee_leaves
    (employee_id, leave_type, start_date, end_date, total_days, description, status)
    VALUES (?, ?, ?, ?, ?, ?, ?)
    `,
    [employeeId, leaveType, startDate, endDate, Number(totalDays || 0), description, status || "pending"],
    function (err) {
      if (err) {
        return res.status(500).json({ success: false, message: err.message });
      }

      res.json({ success: true, id: this.lastID });
    }
  );
});

app.put("/api/employee-leaves/:id", (req, res) => {
  const { employeeId, leaveType, startDate, endDate, totalDays, description, status } = req.body;

  db.run(
    `
    UPDATE employee_leaves SET
      employee_id = ?,
      leave_type = ?,
      start_date = ?,
      end_date = ?,
      total_days = ?,
      description = ?,
      status = ?
    WHERE id = ?
    `,
    [employeeId, leaveType, startDate, endDate, Number(totalDays || 0), description, status, req.params.id],
    function (err) {
      if (err) {
        return res.status(500).json({ success: false, message: err.message });
      }

      res.json({ success: true });
    }
  );
});

app.put("/api/employee-leaves/:id/status", (req, res) => {
  const { status } = req.body;

  db.run(
    "UPDATE employee_leaves SET status = ? WHERE id = ?",
    [status, req.params.id],
    function (err) {
      if (err) {
        return res.status(500).json({ success: false, message: err.message });
      }

      res.json({ success: true });
    }
  );
});

app.get("/api/employee-payments", (req, res) => {
  const sql = `
    SELECT 
      p.*,
      e.full_name
    FROM employee_payments p
    LEFT JOIN employees e ON e.id = p.employee_id
    ORDER BY p.id DESC
  `;

  db.all(sql, [], (err, rows) => {
    if (err) {
      return res.status(500).json({
        success: false,
        message: err.message,
        payments: []
      });
    }

    res.json({
      success: true,
      payments: rows.map(p => ({
        id: p.id,
        employeeId: p.employee_id,
        employeeName: p.full_name,
        paymentType: p.payment_type,
        amount: p.amount,
        paymentDate: p.payment_date,
        description: p.description
      }))
    });
  });
});

app.post("/api/employee-payments", (req, res) => {
  const { employeeId, paymentType, amount, paymentDate, description } = req.body;

  if (!employeeId || !paymentType || !amount || !paymentDate) {
    return res.status(400).json({
      success: false,
      message: "Zorunlu alanlar eksik."
    });
  }

  db.run(
    `
    INSERT INTO employee_payments
    (employee_id, payment_type, amount, payment_date, description)
    VALUES (?, ?, ?, ?, ?)
    `,
    [
      employeeId,
      paymentType,
      Number(amount || 0),
      paymentDate,
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

app.put("/api/employee-payments/:id", (req, res) => {
  const { employeeId, paymentType, amount, paymentDate, description } = req.body;

  db.run(
    `
    UPDATE employee_payments SET
      employee_id = ?,
      payment_type = ?,
      amount = ?,
      payment_date = ?,
      description = ?
    WHERE id = ?
    `,
    [
      employeeId,
      paymentType,
      Number(amount || 0),
      paymentDate,
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

app.get("/api/employee-shifts", (req, res) => {
  const sql = `
    SELECT s.*, e.full_name
    FROM employee_shifts s
    LEFT JOIN employees e ON e.id = s.employee_id
    ORDER BY s.id DESC
  `;

  db.all(sql, [], (err, rows) => {
    if (err) {
      return res.status(500).json({ success: false, message: err.message, shifts: [] });
    }

    res.json({
      success: true,
      shifts: rows.map(s => ({
        id: s.id,
        employeeId: s.employee_id,
        employeeName: s.full_name,
        shiftDate: s.shift_date,
        startTime: s.start_time,
        endTime: s.end_time,
        overtimeHours: s.overtime_hours,
        description: s.description
      }))
    });
  });
});

app.post("/api/employee-shifts", (req, res) => {
  const { employeeId, shiftDate, startTime, endTime, overtimeHours, description } = req.body;

  if (!employeeId || !shiftDate) {
    return res.status(400).json({ success: false, message: "Çalışan ve tarih zorunludur." });
  }

  db.run(
    `
    INSERT INTO employee_shifts
    (employee_id, shift_date, start_time, end_time, overtime_hours, description)
    VALUES (?, ?, ?, ?, ?, ?)
    `,
    [employeeId, shiftDate, startTime, endTime, Number(overtimeHours || 0), description],
    function (err) {
      if (err) {
        return res.status(500).json({ success: false, message: err.message });
      }

      res.json({ success: true, id: this.lastID });
    }
  );
});

app.get("/api/employee-documents", (req, res) => {
  const sql = `
    SELECT d.*, e.full_name
    FROM employee_documents d
    LEFT JOIN employees e ON e.id = d.employee_id
    ORDER BY d.id DESC
  `;

  db.all(sql, [], (err, rows) => {
    if (err) {
      return res.status(500).json({ success: false, message: err.message, documents: [] });
    }

    res.json({
      success: true,
      documents: rows.map(d => ({
        id: d.id,
        employeeId: d.employee_id,
        employeeName: d.full_name,
        documentName: d.document_name,
        expireDate: d.expire_date,
        description: d.description
      }))
    });
  });
});

app.post("/api/employee-documents", (req, res) => {
  const { employeeId, documentName, expireDate, description } = req.body;

  if (!employeeId || !documentName) {
    return res.status(400).json({ success: false, message: "Çalışan ve evrak adı zorunludur." });
  }

  db.run(
    `
    INSERT INTO employee_documents
    (employee_id, document_name, expire_date, description)
    VALUES (?, ?, ?, ?)
    `,
    [employeeId, documentName, expireDate, description],
    function (err) {
      if (err) {
        return res.status(500).json({ success: false, message: err.message });
      }

      res.json({ success: true, id: this.lastID });
    }
  );
});

app.put("/api/employee-documents/:id", (req, res) => {
  const { employeeId, documentName, expireDate, description } = req.body;

  db.run(
    `
    UPDATE employee_documents SET
      employee_id = ?,
      document_name = ?,
      expire_date = ?,
      description = ?
    WHERE id = ?
    `,
    [employeeId, documentName, expireDate, description, req.params.id],
    function (err) {
      if (err) {
        return res.status(500).json({ success: false, message: err.message });
      }

      res.json({ success: true });
    }
  );
});



app.get("/api/quality-controls", (req, res) => {

    db.all(
        `SELECT * FROM quality_controls
         ORDER BY id DESC`,
        [],
        (err, rows) => {

            if (err) {
                return res.status(500).json({
                    success: false,
                    message: err.message,
                    qualityControls: []
                });
            }

            res.json({
                success: true,
                qualityControls: rows.map(q => ({
                    id: q.id,
                    workOrderId: q.work_order_id,
                    partNo: q.part_no,
                    measurementResult: q.measurement_result,
                    resultStatus: q.result_status,
                    scrapReason: q.scrap_reason,
                    checkedBy: q.checked_by,
                    checkDate: q.check_date,

                    createdBy: q.created_by,
                    createdByName: q.created_by_name,

                    updatedBy: q.updated_by,
                    updatedByName: q.updated_by_name,

                    createdAt: q.created_at,
                    updatedAt: q.updated_at
                }))
            });

        }
    );

});

app.post("/api/quality-controls", (req, res) => {

    const {
        workOrderId,
        partNo,
        measurementResult,
        resultStatus,
        scrapReason,
        checkedBy,
        checkDate,

        createdBy,
        createdByName
    } = req.body;

    if (
        !workOrderId ||
        !partNo ||
        !resultStatus ||
        !checkDate
    ) {
        return res.status(400).json({
            success: false,
            message: "Zorunlu alanlar eksik."
        });
    }

    db.run(
        `
        INSERT INTO quality_controls
        (
            work_order_id,
            part_no,
            measurement_result,
            result_status,
            scrap_reason,
            checked_by,
            check_date,

            created_by,
            created_by_name,

            updated_by,
            updated_by_name
        )
        VALUES
        (?,?,?,?,?,?,?,?,?,?,?)
        `,
        [
            workOrderId,
            partNo,
            measurementResult,
            resultStatus,
            scrapReason,
            checkedBy,
            checkDate,

            createdBy,
            createdByName,

            createdBy,
            createdByName
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

app.put("/api/quality-controls/:id", (req, res) => {

    const {
        workOrderId,
        partNo,
        measurementResult,
        resultStatus,
        scrapReason,
        checkedBy,
        checkDate,

        updatedBy,
        updatedByName
    } = req.body;

    db.run(
        `
        UPDATE quality_controls
        SET
            work_order_id = ?,
            part_no = ?,
            measurement_result = ?,
            result_status = ?,
            scrap_reason = ?,
            checked_by = ?,
            check_date = ?,

            updated_by = ?,
            updated_by_name = ?,

            updated_at = CURRENT_TIMESTAMP

        WHERE id = ?
        `,
        [
            workOrderId,
            partNo,
            measurementResult,
            resultStatus,
            scrapReason,
            checkedBy,
            checkDate,

            updatedBy,
            updatedByName,

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

app.delete("/api/quality-controls/:id", (req, res) => {

    db.run(
        `DELETE FROM quality_controls WHERE id = ?`,
        [req.params.id],
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

app.get("/api/warehouses", (req,res)=>{

  db.all(`
    SELECT *
    FROM warehouses
    ORDER BY warehouse_name
  `,(err,rows)=>{

    if(err){
      return res.status(500).json({
        success:false,
        message:err.message
      });
    }

    res.json({
      success:true,
      warehouses:rows
    });

  });

});

app.post("/api/warehouses",(req,res)=>{

  const {
    warehouseCode,
    warehouseName,
    warehouseType,
    description
  } = req.body;

  db.run(`
    INSERT INTO warehouses
    (
      warehouse_code,
      warehouse_name,
      warehouse_type,
      description
    )
    VALUES (?,?,?,?)
  `,
  [
    warehouseCode,
    warehouseName,
    warehouseType,
    description
  ],
  function(err){

    if(err){
      return res.status(500).json({
        success:false,
        message:err.message
      });
    }

    res.json({
      success:true
    });

  });

});

};
