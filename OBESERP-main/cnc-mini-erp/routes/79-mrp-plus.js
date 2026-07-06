module.exports = function register(app, ctx) {
  const db = ctx.db;

  app.get("/api/mrp-plus/summary", (req, res) => {
    const result = {};

    db.get(`
      SELECT COUNT(*) AS criticalStockCount
      FROM stocks
      WHERE IFNULL(quantity, 0) <= IFNULL(min_quantity, 0)
    `, [], (err, criticalStock) => {
      if (err) return res.status(500).json({ success:false, message:err.message });

      result.criticalStockCount = criticalStock?.criticalStockCount || 0;

      db.get(`
        SELECT COUNT(*) AS openPurchaseRequestCount
        FROM purchase_requests
        WHERE IFNULL(status, '') NOT IN ('approved', 'cancelled', 'completed')
      `, [], (err, pr) => {
        result.openPurchaseRequestCount = pr?.openPurchaseRequestCount || 0;

        db.get(`
          SELECT COUNT(*) AS waitingWorkOrderCount
          FROM work_orders
          WHERE status IN ('waiting', 'progress', 'production', 'active')
        `, [], (err, wo) => {
          result.waitingWorkOrderCount = wo?.waitingWorkOrderCount || 0;

          db.get(`
            SELECT COALESCE(SUM(
              CASE 
                WHEN IFNULL(quantity, 0) < IFNULL(min_quantity, 0)
                THEN IFNULL(min_quantity, 0) - IFNULL(quantity, 0)
                ELSE 0
              END
            ), 0) AS totalMissingQty
            FROM stocks
          `, [], (err, missing) => {
            result.totalMissingQty = missing?.totalMissingQty || 0;

            res.json({
              success: true,
              summary: result
            });
          });
        });
      });
    });
  });

  app.get("/api/mrp-plus/critical-materials", (req, res) => {
    db.all(`
      SELECT
        s.id,
        s.stock_code AS stockCode,
        s.part_name AS partName,
        s.category,
        s.unit,
        IFNULL(s.quantity, 0) AS quantity,
        IFNULL(s.min_quantity, 0) AS minQuantity,
        CASE
          WHEN IFNULL(s.quantity, 0) < IFNULL(s.min_quantity, 0)
          THEN IFNULL(s.min_quantity, 0) - IFNULL(s.quantity, 0)
          ELSE 0
        END AS missingQuantity,
        CASE
          WHEN IFNULL(s.quantity, 0) <= 0 THEN 'high'
          WHEN IFNULL(s.quantity, 0) < IFNULL(s.min_quantity, 0) THEN 'medium'
          ELSE 'low'
        END AS riskLevel
      FROM stocks s
      WHERE IFNULL(s.quantity, 0) <= IFNULL(s.min_quantity, 0)
      ORDER BY missingQuantity DESC, s.part_name ASC
    `, [], (err, rows) => {
      if (err) return res.status(500).json({ success:false, message:err.message, materials:[] });

      res.json({
        success: true,
        materials: rows || []
      });
    });
  });

  app.get("/api/mrp-plus/supplier-suggestions/:stockId", (req, res) => {
    const stockId = req.params.stockId;

    db.get(`
      SELECT *
      FROM stocks
      WHERE id = ?
    `, [stockId], (err, stock) => {
      if (err) return res.status(500).json({ success:false, message:err.message });
      if (!stock) return res.status(404).json({ success:false, message:"Malzeme bulunamadı." });

      db.all(`
        SELECT
          s.id,
          s.company_name AS companyName,
          s.authorized_person AS authorizedPerson,
          s.phone,
          s.email,
          s.status,
          COUNT(po.id) AS orderCount
        FROM suppliers s
        LEFT JOIN purchase_orders po
          ON po.supplier_id = s.id
        WHERE IFNULL(s.status, 'active') = 'active'
        GROUP BY s.id
        ORDER BY orderCount DESC, s.company_name ASC
        LIMIT 5
      `, [], (err, suppliers) => {
        if (err) return res.status(500).json({ success:false, message:err.message, suppliers:[] });

        res.json({
          success: true,
          stock: {
            id: stock.id,
            stockCode: stock.stock_code,
            partName: stock.part_name
          },
          suppliers: suppliers || []
        });
      });
    });
  });

  app.post("/api/mrp-plus/create-purchase-request", (req, res) => {
    const {
      stockId,
      quantity,
      requester,
      urgency,
      supplierId,
      description
    } = req.body;

    if (!stockId || !quantity) {
      return res.status(400).json({
        success: false,
        message: "Malzeme ve miktar zorunludur."
      });
    }

    db.get(`
      SELECT *
      FROM stocks
      WHERE id = ?
    `, [stockId], (err, stock) => {
      if (err) return res.status(500).json({ success:false, message:err.message });
      if (!stock) return res.status(404).json({ success:false, message:"Malzeme bulunamadı." });

      const requestNo = "MRPPLUS" + Date.now();

      db.run(`
        INSERT INTO purchase_requests
        (
          request_no,
          requester,
          material,
          quantity,
          urgency,
          supplier_id,
          status,
          description
        )
        VALUES (?, ?, ?, ?, ?, ?, 'pending', ?)
      `, [
        requestNo,
        requester || "MRP Plus",
        stock.part_name || stock.stock_code || "",
        Number(quantity || 0),
        urgency || "high",
        supplierId || null,
        description || "MRP Plus otomatik satın alma talebi"
      ], function(insertErr) {
        if (insertErr) {
          return res.status(500).json({
            success: false,
            message: insertErr.message
          });
        }

        res.json({
          success: true,
          id: this.lastID,
          requestNo,
          message: "Satın alma talebi oluşturuldu."
        });
      });
    });
  });

  app.post("/api/mrp-plus/create-auto-requests", (req, res) => {
    db.all(`
      SELECT
        id,
        stock_code,
        part_name,
        unit,
        IFNULL(quantity, 0) AS quantity,
        IFNULL(min_quantity, 0) AS min_quantity,
        CASE
          WHEN IFNULL(quantity, 0) < IFNULL(min_quantity, 0)
          THEN IFNULL(min_quantity, 0) - IFNULL(quantity, 0)
          ELSE 0
        END AS missing_quantity
      FROM stocks
      WHERE IFNULL(quantity, 0) < IFNULL(min_quantity, 0)
    `, [], (err, rows) => {
      if (err) return res.status(500).json({ success:false, message:err.message });

      if (!rows || rows.length === 0) {
        return res.json({
          success: true,
          createdCount: 0,
          message: "Eksik stok bulunamadı."
        });
      }

      const stmt = db.prepare(`
        INSERT INTO purchase_requests
        (
          request_no,
          requester,
          material,
          quantity,
          urgency,
          status,
          description
        )
        VALUES (?, 'MRP Plus', ?, ?, 'high', 'pending', ?)
      `);

      let createdCount = 0;

      rows.forEach(row => {
        stmt.run([
          "MRPPLUS" + Date.now() + "_" + row.id,
          row.part_name || row.stock_code,
          Number(row.missing_quantity || 0),
          `Otomatik talep | Min: ${row.min_quantity} | Mevcut: ${row.quantity}`
        ], err => {
          if (!err) createdCount++;
        });
      });

      stmt.finalize(finalErr => {
        if (finalErr) {
          return res.status(500).json({
            success: false,
            message: finalErr.message
          });
        }

        res.json({
          success: true,
          createdCount,
          message: `${createdCount} satın alma talebi oluşturuldu.`
        });
      });
    });
  });
};