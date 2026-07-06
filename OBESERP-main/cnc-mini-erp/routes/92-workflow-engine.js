// routes/92-workflow-engine.js
module.exports = function (app, ctx) {
  const db = ctx.db;

  function run(sql, params = []) {
    return new Promise((resolve, reject) => {
      db.run(sql, params, function (err) {
        if (err) reject(err);
        else resolve(this);
      });
    });
  }

  function all(sql, params = []) {
    return new Promise((resolve, reject) => {
      db.all(sql, params, (err, rows) => {
        if (err) reject(err);
        else resolve(rows || []);
      });
    });
  }

  function get(sql, params = []) {
    return new Promise((resolve, reject) => {
      db.get(sql, params, (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
  }

  function getUser(req) {
    const user = req.session?.user || req.user || {};
    return {
      id: user.id || req.headers["x-user-id"] || null,
      username: user.username || user.full_name || user.fullName || req.headers["x-user-name"] || "Bilinmeyen Kullanıcı",
      role: String(user.role || req.headers["x-user-role"] || "").toLowerCase()
    };
  }

  db.serialize(() => {
    db.run(`
      CREATE TABLE IF NOT EXISTS workflow_definitions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        workflow_code TEXT UNIQUE NOT NULL,
        workflow_name TEXT NOT NULL,
        module_key TEXT NOT NULL,
        min_amount REAL DEFAULT 0,
        active INTEGER DEFAULT 1,
        description TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `);

    db.run(`
      CREATE TABLE IF NOT EXISTS workflow_steps (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        workflow_id INTEGER NOT NULL,
        step_no INTEGER NOT NULL,
        step_name TEXT NOT NULL,
        approver_role TEXT NOT NULL,
        required INTEGER DEFAULT 1,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `);

    db.run(`
      CREATE TABLE IF NOT EXISTS workflow_requests (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        workflow_id INTEGER NOT NULL,
        module_key TEXT NOT NULL,
        record_id TEXT NOT NULL,
        record_no TEXT,
        title TEXT,
        amount REAL DEFAULT 0,
        status TEXT DEFAULT 'PENDING',
        current_step_no INTEGER DEFAULT 1,
        requested_by INTEGER,
        requested_by_name TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        completed_at TEXT
      )
    `);

    db.run(`
      CREATE TABLE IF NOT EXISTS workflow_request_steps (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        request_id INTEGER NOT NULL,
        step_id INTEGER NOT NULL,
        step_no INTEGER NOT NULL,
        step_name TEXT NOT NULL,
        approver_role TEXT NOT NULL,
        status TEXT DEFAULT 'WAITING',
        approved_by INTEGER,
        approved_by_name TEXT,
        note TEXT,
        approved_at TEXT
      )
    `);
  });

  async function createWorkflowRequest(req, options = {}) {
    const user = getUser(req);

    const moduleKey = options.moduleKey || options.module_key;
    const recordId = options.recordId || options.record_id;
    const amount = Number(options.amount || 0);

    const workflow = await get(
      `
      SELECT *
      FROM workflow_definitions
      WHERE module_key = ?
        AND active = 1
        AND min_amount <= ?
      ORDER BY min_amount DESC
      LIMIT 1
      `,
      [moduleKey, amount]
    );

    if (!workflow) {
      return {
        success: false,
        message: "Uygun workflow bulunamadı."
      };
    }

    const steps = await all(
      `
      SELECT *
      FROM workflow_steps
      WHERE workflow_id = ?
      ORDER BY step_no
      `,
      [workflow.id]
    );

    if (!steps.length) {
      return {
        success: false,
        message: "Workflow adımı bulunamadı."
      };
    }

    const inserted = await run(
      `
      INSERT INTO workflow_requests (
        workflow_id,
        module_key,
        record_id,
        record_no,
        title,
        amount,
        status,
        current_step_no,
        requested_by,
        requested_by_name
      )
      VALUES (?, ?, ?, ?, ?, ?, 'PENDING', 1, ?, ?)
      `,
      [
        workflow.id,
        moduleKey,
        recordId,
        options.recordNo || options.record_no || null,
        options.title || null,
        amount,
        user.id,
        user.username
      ]
    );

    const requestId = inserted.lastID;

    for (const step of steps) {
      await run(
        `
        INSERT INTO workflow_request_steps (
          request_id,
          step_id,
          step_no,
          step_name,
          approver_role,
          status
        )
        VALUES (?, ?, ?, ?, ?, ?)
        `,
        [
          requestId,
          step.id,
          step.step_no,
          step.step_name,
          step.approver_role,
          step.step_no === 1 ? "PENDING" : "WAITING"
        ]
      );
    }

    if (ctx.auditLog) {
      await ctx.auditLog(req, {
        module: "workflow",
        action: "create",
        recordId: requestId,
        newData: options,
        description: "Workflow onay isteği oluşturuldu."
      });
    }

    return {
      success: true,
      requestId,
      workflow
    };
  }

  ctx.createWorkflowRequest = createWorkflowRequest;

  app.post("/api/workflows", async (req, res) => {
    try {
      const body = req.body;

      const inserted = await run(
        `
        INSERT INTO workflow_definitions (
          workflow_code,
          workflow_name,
          module_key,
          min_amount,
          active,
          description
        )
        VALUES (?, ?, ?, ?, ?, ?)
        `,
        [
          body.workflowCode,
          body.workflowName,
          body.moduleKey,
          Number(body.minAmount || 0),
          body.active === false ? 0 : 1,
          body.description || null
        ]
      );

      res.json({
        success: true,
        id: inserted.lastID,
        message: "Workflow oluşturuldu."
      });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  });

  app.get("/api/workflows", async (req, res) => {
    try {
      const rows = await all(`
        SELECT *
        FROM workflow_definitions
        ORDER BY id DESC
      `);

      res.json({ success: true, data: rows });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  });

  app.post("/api/workflows/:id/steps", async (req, res) => {
    try {
      const workflowId = req.params.id;
      const steps = req.body.steps || [];

      await run(`DELETE FROM workflow_steps WHERE workflow_id = ?`, [workflowId]);

      for (const step of steps) {
        await run(
          `
          INSERT INTO workflow_steps (
            workflow_id,
            step_no,
            step_name,
            approver_role,
            required
          )
          VALUES (?, ?, ?, ?, ?)
          `,
          [
            workflowId,
            Number(step.stepNo),
            step.stepName,
            String(step.approverRole || "").toLowerCase(),
            step.required === false ? 0 : 1
          ]
        );
      }

      res.json({
        success: true,
        message: "Workflow adımları güncellendi."
      });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  });

  app.get("/api/workflows/:id/steps", async (req, res) => {
    try {
      const rows = await all(
        `
        SELECT *
        FROM workflow_steps
        WHERE workflow_id = ?
        ORDER BY step_no
        `,
        [req.params.id]
      );

      res.json({ success: true, data: rows });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  });

  app.post("/api/workflow-requests", async (req, res) => {
    try {
      const result = await createWorkflowRequest(req, req.body);

      if (!result.success) {
        return res.status(400).json(result);
      }

      res.json(result);
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  });

  app.get("/api/workflow-requests", async (req, res) => {
    try {
      const rows = await all(`
        SELECT 
          wr.*,
          wd.workflow_name
        FROM workflow_requests wr
        JOIN workflow_definitions wd ON wd.id = wr.workflow_id
        ORDER BY wr.id DESC
        LIMIT 300
      `);

      res.json({ success: true, data: rows });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  });

  app.get("/api/workflow-requests/pending", async (req, res) => {
    try {
      const user = getUser(req);

      const rows = await all(
        `
        SELECT
          wrs.id AS step_request_id,
          wr.id AS request_id,
          wr.module_key,
          wr.record_id,
          wr.record_no,
          wr.title,
          wr.amount,
          wr.status AS request_status,
          wrs.step_no,
          wrs.step_name,
          wrs.approver_role,
          wr.created_at
        FROM workflow_request_steps wrs
        JOIN workflow_requests wr ON wr.id = wrs.request_id
        WHERE wrs.status = 'PENDING'
          AND LOWER(wrs.approver_role) = ?
        ORDER BY wr.created_at ASC
        `,
        [user.role]
      );

      res.json({ success: true, data: rows });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  });

  app.post("/api/workflow-requests/:id/approve", async (req, res) => {
    try {
      const user = getUser(req);
      const requestId = req.params.id;
      const note = req.body.note || null;

      const request = await get(`SELECT * FROM workflow_requests WHERE id = ?`, [requestId]);

      if (!request) {
        return res.status(404).json({ success: false, message: "Workflow isteği bulunamadı." });
      }

      if (request.status !== "PENDING") {
        return res.status(400).json({ success: false, message: "Bu istek zaten tamamlanmış." });
      }

      const currentStep = await get(
        `
        SELECT *
        FROM workflow_request_steps
        WHERE request_id = ?
          AND step_no = ?
          AND status = 'PENDING'
        `,
        [requestId, request.current_step_no]
      );

      if (!currentStep) {
        return res.status(404).json({ success: false, message: "Bekleyen adım bulunamadı." });
      }

      if (String(currentStep.approver_role).toLowerCase() !== user.role && user.role !== "superadmin") {
        return res.status(403).json({ success: false, message: "Bu adımı onaylama yetkin yok." });
      }

      await run(
        `
        UPDATE workflow_request_steps
        SET status = 'APPROVED',
            approved_by = ?,
            approved_by_name = ?,
            note = ?,
            approved_at = CURRENT_TIMESTAMP
        WHERE id = ?
        `,
        [user.id, user.username, note, currentStep.id]
      );

      const nextStep = await get(
        `
        SELECT *
        FROM workflow_request_steps
        WHERE request_id = ?
          AND step_no > ?
        ORDER BY step_no
        LIMIT 1
        `,
        [requestId, currentStep.step_no]
      );

      if (nextStep) {
        await run(
          `
          UPDATE workflow_request_steps
          SET status = 'PENDING'
          WHERE id = ?
          `,
          [nextStep.id]
        );

        await run(
          `
          UPDATE workflow_requests
          SET current_step_no = ?
          WHERE id = ?
          `,
          [nextStep.step_no, requestId]
        );
      } else {
        await run(
          `
          UPDATE workflow_requests
          SET status = 'APPROVED',
              completed_at = CURRENT_TIMESTAMP
          WHERE id = ?
          `,
          [requestId]
        );
      }

      if (ctx.auditLog) {
        await ctx.auditLog(req, {
          module: "workflow",
          action: "approve",
          recordId: requestId,
          newData: { step: currentStep.step_no, note },
          description: "Workflow adımı onaylandı."
        });
      }

      res.json({
        success: true,
        message: nextStep ? "Adım onaylandı, sonraki adıma geçti." : "Workflow tamamen onaylandı."
      });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  });

  app.post("/api/workflow-requests/:id/reject", async (req, res) => {
    try {
      const user = getUser(req);
      const requestId = req.params.id;
      const note = req.body.note || null;

      const request = await get(`SELECT * FROM workflow_requests WHERE id = ?`, [requestId]);

      if (!request) {
        return res.status(404).json({ success: false, message: "Workflow isteği bulunamadı." });
      }

      const currentStep = await get(
        `
        SELECT *
        FROM workflow_request_steps
        WHERE request_id = ?
          AND step_no = ?
          AND status = 'PENDING'
        `,
        [requestId, request.current_step_no]
      );

      if (!currentStep) {
        return res.status(404).json({ success: false, message: "Bekleyen adım bulunamadı." });
      }

      if (String(currentStep.approver_role).toLowerCase() !== user.role && user.role !== "superadmin") {
        return res.status(403).json({ success: false, message: "Bu adımı reddetme yetkin yok." });
      }

      await run(
        `
        UPDATE workflow_request_steps
        SET status = 'REJECTED',
            approved_by = ?,
            approved_by_name = ?,
            note = ?,
            approved_at = CURRENT_TIMESTAMP
        WHERE id = ?
        `,
        [user.id, user.username, note, currentStep.id]
      );

      await run(
        `
        UPDATE workflow_requests
        SET status = 'REJECTED',
            completed_at = CURRENT_TIMESTAMP
        WHERE id = ?
        `,
        [requestId]
      );

      if (ctx.auditLog) {
        await ctx.auditLog(req, {
          module: "workflow",
          action: "reject",
          recordId: requestId,
          newData: { step: currentStep.step_no, note },
          description: "Workflow reddedildi."
        });
      }

      res.json({
        success: true,
        message: "Workflow reddedildi."
      });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  });

  app.get("/api/workflow-requests/:id/steps", async (req, res) => {
    try {
      const rows = await all(
        `
        SELECT *
        FROM workflow_request_steps
        WHERE request_id = ?
        ORDER BY step_no
        `,
        [req.params.id]
      );

      res.json({ success: true, data: rows });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  });

  console.log("Workflow Engine aktif.");
};