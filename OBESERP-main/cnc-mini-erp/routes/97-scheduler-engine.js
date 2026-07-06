// routes/97-scheduler-engine.js
module.exports = function (app, ctx) {
  const fs = require("fs");
  const path = require("path");
  const db = ctx.db;

  const runningTimers = new Map();

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
      id: user.id || req.headers["x-user-id"] || 0,
      username:
        user.username ||
        user.full_name ||
        user.fullName ||
        req.headers["x-user-name"] ||
        "Sistem",
      role: String(user.role || req.headers["x-user-role"] || "").toLowerCase()
    };
  }

  function safeJson(value, fallback = {}) {
    try {
      if (!value) return fallback;
      if (typeof value === "object") return value;
      return JSON.parse(value);
    } catch {
      return fallback;
    }
  }

  db.serialize(() => {
    db.run(`
      CREATE TABLE IF NOT EXISTS scheduler_jobs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        job_key TEXT UNIQUE NOT NULL,
        job_name TEXT NOT NULL,
        job_type TEXT NOT NULL,
        interval_minutes INTEGER DEFAULT 60,
        active INTEGER DEFAULT 1,
        config_json TEXT,
        last_run_at TEXT,
        next_run_at TEXT,
        last_status TEXT,
        last_message TEXT,
        created_by INTEGER,
        created_by_name TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT
      )
    `);

    db.run(`
      CREATE TABLE IF NOT EXISTS scheduler_job_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        job_id INTEGER,
        job_key TEXT,
        job_name TEXT,
        job_type TEXT,
        status TEXT,
        message TEXT,
        started_at TEXT,
        finished_at TEXT,
        duration_ms INTEGER,
        result_json TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `);
  });

  function normalizeKey(value) {
    return String(value || "")
      .trim()
      .toLowerCase()
      .replaceAll("ı", "i")
      .replaceAll("ğ", "g")
      .replaceAll("ü", "u")
      .replaceAll("ş", "s")
      .replaceAll("ö", "o")
      .replaceAll("ç", "c")
      .replace(/[^a-z0-9_]+/g, "_")
      .replace(/^_+|_+$/g, "");
  }

  async function createDefaultJobs() {
    const defaults = [
      {
        job_key: "kritik_stok_kontrol",
        job_name: "Kritik Stok Kontrolü",
        job_type: "critical_stock_check",
        interval_minutes: 30,
        active: 0,
        config_json: JSON.stringify({ notifyRole: "admin" })
      },
      {
        job_key: "workflow_hatirlatici",
        job_name: "Workflow Hatırlatıcı",
        job_type: "workflow_reminder",
        interval_minutes: 60,
        active: 0,
        config_json: JSON.stringify({ notifyRole: "admin" })
      },
      {
        job_key: "sqlite_backup",
        job_name: "SQLite Backup",
        job_type: "sqlite_backup",
        interval_minutes: 1440,
        active: 0,
        config_json: JSON.stringify({
          dbPath: "C:/sqlitedbs/erpcnc.db",
          backupDir: "C:/sqlitedbs/backups"
        })
      }
    ];

    for (const j of defaults) {
      await run(
        `
        INSERT OR IGNORE INTO scheduler_jobs (
          job_key,
          job_name,
          job_type,
          interval_minutes,
          active,
          config_json
        )
        VALUES (?, ?, ?, ?, ?, ?)
        `,
        [
          j.job_key,
          j.job_name,
          j.job_type,
          j.interval_minutes,
          j.active,
          j.config_json
        ]
      );
    }
  }

  async function logJob(job, status, message, startedAt, result = {}) {
    const finishedAt = new Date();
    const durationMs = finishedAt.getTime() - startedAt.getTime();

    await run(
      `
      INSERT INTO scheduler_job_logs (
        job_id,
        job_key,
        job_name,
        job_type,
        status,
        message,
        started_at,
        finished_at,
        duration_ms,
        result_json
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        job.id,
        job.job_key,
        job.job_name,
        job.job_type,
        status,
        message,
        startedAt.toISOString(),
        finishedAt.toISOString(),
        durationMs,
        JSON.stringify(result || {})
      ]
    );

    await run(
      `
      UPDATE scheduler_jobs
      SET last_run_at = CURRENT_TIMESTAMP,
          next_run_at = DATETIME(CURRENT_TIMESTAMP, '+' || interval_minutes || ' minutes'),
          last_status = ?,
          last_message = ?,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
      `,
      [status, message, job.id]
    );
  }

  async function jobCriticalStockCheck(job) {
    const config = safeJson(job.config_json);
    const notifyRole = config.notifyRole || "admin";

    const rows = await all(`
      SELECT *
      FROM stocks
      WHERE COALESCE(quantity, 0) <= COALESCE(min_quantity, 0)
      LIMIT 50
    `);

    if (rows.length && ctx.createNotification) {
      await ctx.createNotification({
        role: notifyRole,
        title: "Kritik Stok Uyarısı",
        message: `${rows.length} stok minimum seviyenin altında.`,
        module: "stokyonetimi",
        type: "critical",
        url: "stokyonetimi.html"
      });
    }

    return {
      message: `${rows.length} kritik stok bulundu.`,
      result: { count: rows.length, rows }
    };
  }

  async function jobWorkflowReminder(job) {
    const config = safeJson(job.config_json);
    const notifyRole = config.notifyRole || "admin";

    const rows = await all(`
      SELECT *
      FROM workflow_requests
      WHERE status = 'PENDING'
      ORDER BY id DESC
      LIMIT 50
    `);

    if (rows.length && ctx.createNotification) {
      await ctx.createNotification({
        role: notifyRole,
        title: "Bekleyen Workflow Onayları",
        message: `${rows.length} workflow onay bekliyor.`,
        module: "workflow",
        type: "approval",
        url: "workflow.html"
      });
    }

    return {
      message: `${rows.length} bekleyen workflow bulundu.`,
      result: { count: rows.length }
    };
  }

  async function jobSqliteBackup(job) {
    const config = safeJson(job.config_json);

    const dbPath = config.dbPath || "C:/sqlitedbs/erpcnc.db";
    const backupDir = config.backupDir || "C:/sqlitedbs/backups";

    if (!fs.existsSync(dbPath)) {
      throw new Error(`DB dosyası bulunamadı: ${dbPath}`);
    }

    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }

    const stamp = new Date()
      .toISOString()
      .replace(/[:.]/g, "-")
      .replace("T", "_")
      .slice(0, 19);

    const backupPath = path.join(backupDir, `erpcnc_${stamp}.db`);

    fs.copyFileSync(dbPath, backupPath);

    return {
      message: `Backup oluşturuldu: ${backupPath}`,
      result: { backupPath }
    };
  }

  async function jobKpiSnapshot(job) {
    const kpis = await all(`
      SELECT *
      FROM kpi_definitions
      WHERE active = 1
    `);

    const results = [];

    if (ctx.executeKpi) {
      for (const kpi of kpis) {
        try {
          const r = await ctx.executeKpi(kpi);
          results.push({
            kpi_key: kpi.kpi_key,
            value: r.value,
            status: r.status
          });
        } catch (err) {
          results.push({
            kpi_key: kpi.kpi_key,
            error: err.message
          });
        }
      }
    }

    return {
      message: `${results.length} KPI hesaplandı.`,
      result: { results }
    };
  }

  async function executeJob(job) {
    const startedAt = new Date();

    try {
      let output;

      if (job.job_type === "critical_stock_check") {
        output = await jobCriticalStockCheck(job);
      } else if (job.job_type === "workflow_reminder") {
        output = await jobWorkflowReminder(job);
      } else if (job.job_type === "sqlite_backup") {
        output = await jobSqliteBackup(job);
      } else if (job.job_type === "kpi_snapshot") {
        output = await jobKpiSnapshot(job);
      } else {
        throw new Error(`Bilinmeyen job_type: ${job.job_type}`);
      }

      await logJob(job, "SUCCESS", output.message, startedAt, output.result);

      return {
        success: true,
        message: output.message,
        result: output.result
      };
    } catch (err) {
      await logJob(job, "ERROR", err.message, startedAt, { error: err.message });

      return {
        success: false,
        message: err.message
      };
    }
  }

  async function refreshScheduler() {
    for (const timer of runningTimers.values()) {
      clearInterval(timer);
    }

    runningTimers.clear();

    const jobs = await all(`
      SELECT *
      FROM scheduler_jobs
      WHERE active = 1
    `);

    for (const job of jobs) {
      const intervalMs = Math.max(Number(job.interval_minutes || 60), 1) * 60 * 1000;

      const timer = setInterval(async () => {
        const freshJob = await get(`SELECT * FROM scheduler_jobs WHERE id = ?`, [job.id]);

        if (freshJob && Number(freshJob.active) === 1) {
          await executeJob(freshJob);
        }
      }, intervalMs);

      runningTimers.set(job.id, timer);
    }

    console.log(`Scheduler aktif job sayısı: ${runningTimers.size}`);
  }

  ctx.executeSchedulerJob = async function (jobId) {
    const job = await get(`SELECT * FROM scheduler_jobs WHERE id = ?`, [jobId]);

    if (!job) {
      return {
        success: false,
        message: "Job bulunamadı."
      };
    }

    return executeJob(job);
  };

  app.get("/api/scheduler/jobs", async (req, res) => {
    try {
      const rows = await all(`
        SELECT *
        FROM scheduler_jobs
        ORDER BY id DESC
      `);

      res.json({
        success: true,
        data: rows.map(r => ({
          ...r,
          config: safeJson(r.config_json)
        }))
      });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  });

  app.post("/api/scheduler/jobs", async (req, res) => {
    try {
      const user = getUser(req);
      const body = req.body || {};
      const jobKey = normalizeKey(body.jobKey || body.jobName);

      if (!jobKey) {
        return res.status(400).json({
          success: false,
          message: "Job key üretilemedi."
        });
      }

      const inserted = await run(
        `
        INSERT INTO scheduler_jobs (
          job_key,
          job_name,
          job_type,
          interval_minutes,
          active,
          config_json,
          created_by,
          created_by_name,
          updated_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
        `,
        [
          jobKey,
          body.jobName,
          body.jobType,
          Number(body.intervalMinutes || 60),
          body.active === false ? 0 : 1,
          JSON.stringify(body.config || {}),
          user.id,
          user.username
        ]
      );

      await refreshScheduler();

      res.json({
        success: true,
        id: inserted.lastID,
        message: "Scheduler job oluşturuldu."
      });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  });

  app.put("/api/scheduler/jobs/:id", async (req, res) => {
    try {
      const body = req.body || {};

      await run(
        `
        UPDATE scheduler_jobs
        SET job_name = ?,
            job_type = ?,
            interval_minutes = ?,
            active = ?,
            config_json = ?,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
        `,
        [
          body.jobName,
          body.jobType,
          Number(body.intervalMinutes || 60),
          body.active === false ? 0 : 1,
          JSON.stringify(body.config || {}),
          req.params.id
        ]
      );

      await refreshScheduler();

      res.json({
        success: true,
        message: "Scheduler job güncellendi."
      });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  });

  app.delete("/api/scheduler/jobs/:id", async (req, res) => {
    try {
      await run(`DELETE FROM scheduler_jobs WHERE id = ?`, [req.params.id]);
      await refreshScheduler();

      res.json({
        success: true,
        message: "Scheduler job silindi."
      });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  });

  app.post("/api/scheduler/jobs/:id/run", async (req, res) => {
    try {
      const result = await ctx.executeSchedulerJob(req.params.id);
      res.json(result);
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  });

  app.get("/api/scheduler/logs", async (req, res) => {
    try {
      const rows = await all(`
        SELECT *
        FROM scheduler_job_logs
        ORDER BY id DESC
        LIMIT 300
      `);

      res.json({
        success: true,
        data: rows.map(r => ({
          ...r,
          result: safeJson(r.result_json)
        }))
      });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  });

  (async () => {
    try {
      await createDefaultJobs();
      await refreshScheduler();
      console.log("Scheduler Engine aktif.");
    } catch (err) {
      console.error("Scheduler Engine başlatılamadı:", err.message);
    }
  })();
};