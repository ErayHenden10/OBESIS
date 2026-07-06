// SATIN ALMA TALEPLERİ - ÇOK SEVİYELİ ONAY AKIŞI
module.exports = function register(app, ctx) {
  var db = ctx.db;

  function addColumnIfNotExists(table, column, definition) {
    db.all(`PRAGMA table_info(${table})`, [], (err, columns) => {
      if (err) return console.error(`${table} kontrol hatası:`, err.message);

      const exists = (columns || []).some(c => c.name === column);
      if (!exists) {
        db.run(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`, [], err => {
          if (err) console.error(`${column} eklenemedi:`, err.message);
        });
      }
    });
  }

  addColumnIfNotExists("purchase_approvals", "approver_name", "TEXT");
  addColumnIfNotExists("purchase_approvals", "approver_role", "TEXT");
  addColumnIfNotExists("purchase_approvals", "step_no", "INTEGER DEFAULT 1");
  addColumnIfNotExists("purchase_approvals", "action_date", "DATETIME");

  function getUserName(req) {
    return (
      req.body.approved_by ||
      req.body.rejected_by ||
      req.body.fullName ||
      req.body.userName ||
      "Sistem"
    );
  }

  const APPROVAL_STEPS = [
    { step_no: 1, approver_role: "manager" },
    { step_no: 2, approver_role: "muhasebe" },
    { step_no: 3, approver_role: "superadmin" }
  ];

  function getUserByRole(role) {
    return new Promise((resolve) => {
      db.get(
        `
        SELECT id, username, full_name, role
        FROM users
        WHERE LOWER(role) = LOWER(?)
        ORDER BY id ASC
        LIMIT 1
        `,
        [role],
        (err, user) => {
          if (err) {
            console.error("Onaycı kullanıcı bulunamadı:", err.message);
            return resolve(null);
          }

          resolve(user || null);
        }
      );
    });
  }

  async function buildApprovalSteps() {
    const steps = [];

    for (const step of APPROVAL_STEPS) {
      const user = await getUserByRole(step.approver_role);

      steps.push({
        step_no: step.step_no,
        approver_role: step.approver_role,
        approver_name: user
          ? (user.full_name || user.username || step.approver_role)
          : step.approver_role
      });
    }

    return steps;
  }

  app.get("/api/purchase-requests", (req, res) => {
    const sql = `
      SELECT 
        pr.*,
        s.company_name AS supplier_name,
        pa.approver_name,
        pa.approver_role,
        pa.step_no
      FROM purchase_requests pr
      LEFT JOIN suppliers s ON s.id = pr.supplier_id
      LEFT JOIN purchase_approvals pa 
        ON pa.request_id = pr.id
       AND pa.status = 'Beklemede'
      ORDER BY pr.id DESC
    `;

    db.all(sql, [], (err, rows) => {
      if (err) {
        return res.status(500).json({
          success: false,
          message: err.message,
          requests: []
        });
      }

      res.json({
        success: true,
        requests: rows.map(r => ({
          id: r.id,
          requestNo: r.request_no,
          requestedBy: r.requested_by,
          supplierId: r.supplier_id,
          supplierName: r.supplier_name,
          materialName: r.material_name,
          quantity: r.quantity,
          urgency: r.urgency,
          status: r.status,
          approverName: r.approver_name || "",
          approverRole: r.approver_role || "",
          stepNo: r.step_no || null
        }))
      });
    });
  });

  app.post("/api/purchase-requests/:id/send-approval", async (req, res) => {
    const requestId = req.params.id;
    const sentBy = getUserName(req);

    const approvalSteps = await buildApprovalSteps();

    db.get(
      `SELECT id, status FROM purchase_requests WHERE id = ?`,
      [requestId],
      (err, request) => {
        if (err) {
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

        if (request.status === "Onaylandı" || request.status === "Siparişe Döndü") {
          return res.status(400).json({
            success: false,
            message: "Bu talep tekrar onaya gönderilemez."
          });
        }

        db.get(
          `
          SELECT id 
          FROM purchase_approvals 
          WHERE request_id = ? 
            AND status = 'Beklemede'
          `,
          [requestId],
          (err, existing) => {
            if (err) {
              return res.status(500).json({
                success: false,
                message: err.message
              });
            }

            if (existing) {
              return res.status(400).json({
                success: false,
                message: "Bu talep zaten onay bekliyor."
              });
            }

            db.serialize(() => {
              db.run(`DELETE FROM purchase_approvals WHERE request_id = ?`, [requestId]);

              db.run(
                `UPDATE purchase_requests SET status = 'Onay Bekliyor' WHERE id = ?`,
                [requestId]
              );

              const insertSql = `
                INSERT INTO purchase_approvals
                (
                  request_id,
                  approval_type,
                  status,
                  note,
                  approved_by,
                  approver_name,
                  approver_role,
                  step_no
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
              `;

              let completed = 0;

              approvalSteps.forEach(step => {
                db.run(
                  insertSql,
                  [
                    requestId,
                    "Satın Alma Talebi",
                    step.step_no === 1 ? "Beklemede" : "Sırada",
                    step.step_no === 1
                      ? "Talep onaya gönderildi."
                      : "Önceki onay bekleniyor.",
                    step.step_no === 1 ? sentBy : "",
                    step.approver_name,
                    step.approver_role,
                    step.step_no
                  ],
                  function (err) {
                    if (err) {
                      console.error("Onay adımı ekleme hatası:", err.message);
                    }

                    completed++;

                    if (completed === approvalSteps.length) {
                      return res.json({
                        success: true,
                        message: "Talep çok seviyeli onay akışına gönderildi.",
                        currentApprover: approvalSteps[0].approver_name
                      });
                    }
                  }
                );
              });
            });
          }
        );
      }
    );
  });

  app.post("/api/purchase-requests/:id/approve", (req, res) => {
    const requestId = req.params.id;
    const approvedBy = getUserName(req);
    const note = req.body.note || "";

    db.get(
      `
      SELECT *
      FROM purchase_approvals
      WHERE request_id = ?
        AND status = 'Beklemede'
      ORDER BY step_no ASC
      LIMIT 1
      `,
      [requestId],
      (err, currentStep) => {
        if (err) {
          return res.status(500).json({
            success: false,
            message: err.message
          });
        }

        if (!currentStep) {
          return res.status(400).json({
            success: false,
            message: "Bu talep için bekleyen onay adımı bulunamadı."
          });
        }

        db.run(
          `
          UPDATE purchase_approvals
          SET status = 'Onaylandı',
              note = ?,
              approved_by = ?,
              action_date = CURRENT_TIMESTAMP
          WHERE id = ?
          `,
          [note, approvedBy, currentStep.id],
          function (err) {
            if (err) {
              return res.status(500).json({
                success: false,
                message: err.message
              });
            }

            const nextStepNo = Number(currentStep.step_no) + 1;

            db.get(
              `
              SELECT *
              FROM purchase_approvals
              WHERE request_id = ?
                AND step_no = ?
              `,
              [requestId, nextStepNo],
              (err, nextStep) => {
                if (err) {
                  return res.status(500).json({
                    success: false,
                    message: err.message
                  });
                }

                if (nextStep) {
                  db.run(
                    `
                    UPDATE purchase_approvals
                    SET status = 'Beklemede',
                        note = 'Sıradaki onay adımı açıldı.'
                    WHERE id = ?
                    `,
                    [nextStep.id],
                    function (err) {
                      if (err) {
                        return res.status(500).json({
                          success: false,
                          message: err.message
                        });
                      }

                      return res.json({
                        success: true,
                        message: `Onaylandı. Talep şimdi ${nextStep.approver_name} onayında.`,
                        nextApprover: nextStep.approver_name,
                        nextRole: nextStep.approver_role
                      });
                    }
                  );
                } else {
                  db.run(
                    `UPDATE purchase_requests SET status = 'Onaylandı' WHERE id = ?`,
                    [requestId],
                    function (err) {
                      if (err) {
                        return res.status(500).json({
                          success: false,
                          message: err.message
                        });
                      }

                      res.json({
                        success: true,
                        message: "Tüm onaylar tamamlandı. Satın alma talebi onaylandı."
                      });
                    }
                  );
                }
              }
            );
          }
        );
      }
    );
  });

  app.post("/api/purchase-requests/:id/reject", (req, res) => {
    const requestId = req.params.id;
    const rejectedBy = getUserName(req);
    const note = req.body.note || "";

    if (!note.trim()) {
      return res.status(400).json({
        success: false,
        message: "Red nedeni zorunludur."
      });
    }

    db.get(
      `
      SELECT *
      FROM purchase_approvals
      WHERE request_id = ?
        AND status = 'Beklemede'
      ORDER BY step_no ASC
      LIMIT 1
      `,
      [requestId],
      (err, currentStep) => {
        if (err) {
          return res.status(500).json({
            success: false,
            message: err.message
          });
        }

        if (!currentStep) {
          return res.status(400).json({
            success: false,
            message: "Bu talep için bekleyen onay adımı bulunamadı."
          });
        }

        db.serialize(() => {
          db.run(
            `
            UPDATE purchase_approvals
            SET status = 'Reddedildi',
                note = ?,
                approved_by = ?,
                action_date = CURRENT_TIMESTAMP
            WHERE id = ?
            `,
            [note, rejectedBy, currentStep.id]
          );

          db.run(
            `
            UPDATE purchase_approvals
            SET status = 'İptal'
            WHERE request_id = ?
              AND status = 'Sırada'
            `,
            [requestId]
          );

          db.run(
            `UPDATE purchase_requests SET status = 'Reddedildi' WHERE id = ?`,
            [requestId],
            function (err) {
              if (err) {
                return res.status(500).json({
                  success: false,
                  message: err.message
                });
              }

              res.json({
                success: true,
                message: "Satın alma talebi reddedildi."
              });
            }
          );
        });
      }
    );
  });

  app.get("/api/purchase-approvals/pending", (req, res) => {
    const sql = `
      SELECT 
        pa.id AS approval_id,
        pa.request_id,
        pa.approval_type,
        pa.status AS approval_status,
        pa.note,
        pa.approved_by,
        pa.approver_name,
        pa.approver_role,
        pa.step_no,
        pa.action_date,
        pr.request_no,
        pr.requested_by,
        pr.material_name,
        pr.quantity,
        pr.urgency,
        pr.status AS request_status,
        s.company_name AS supplier_name
      FROM purchase_approvals pa
      LEFT JOIN purchase_requests pr ON pr.id = pa.request_id
      LEFT JOIN suppliers s ON s.id = pr.supplier_id
      WHERE pa.status = 'Beklemede'
      ORDER BY pa.step_no ASC, pa.id DESC
    `;

    db.all(sql, [], (err, rows) => {
      if (err) {
        return res.status(500).json({
          success: false,
          message: err.message,
          approvals: []
        });
      }

      res.json({
        success: true,
        approvals: rows
      });
    });
  });

  app.get("/api/purchase-approvals/:requestId/history", (req, res) => {
    const requestId = req.params.requestId;

    const sql = `
      SELECT 
        id,
        request_id,
        approval_type,
        status,
        note,
        approved_by,
        approver_name,
        approver_role,
        step_no,
        action_date
      FROM purchase_approvals
      WHERE request_id = ?
      ORDER BY step_no ASC
    `;

    db.all(sql, [requestId], (err, rows) => {
      if (err) {
        return res.status(500).json({
          success: false,
          message: err.message,
          history: []
        });
      }

      res.json({
        success: true,
        history: rows
      });
    });
  });

  app.get("/api/purchase-approvals", (req, res) => {
    const sql = `
      SELECT 
        pa.id AS approval_id,
        pa.request_id,
        pa.approval_type,
        pa.status AS approval_status,
        pa.note,
        pa.approved_by,
        pa.approver_name,
        pa.approver_role,
        pa.step_no,
        pa.action_date,
        pr.request_no,
        pr.requested_by,
        pr.material_name,
        pr.quantity,
        pr.urgency,
        pr.status AS request_status,
        s.company_name AS supplier_name
      FROM purchase_approvals pa
      LEFT JOIN purchase_requests pr ON pr.id = pa.request_id
      LEFT JOIN suppliers s ON s.id = pr.supplier_id
      ORDER BY pa.request_id DESC, pa.step_no ASC
    `;

    db.all(sql, [], (err, rows) => {
      if (err) {
        return res.status(500).json({
          success: false,
          message: err.message,
          approvals: []
        });
      }

      res.json({
        success: true,
        approvals: rows
      });
    });
  });
};