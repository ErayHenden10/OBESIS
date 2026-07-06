module.exports = function register(app, ctx) {
  const db = ctx.db;

  app.get("/api/production-simulation/work-orders", (req, res) => {
    db.all(`
      SELECT
        wo.id,
        wo.work_order_no AS workOrderNo,
        wo.title,
        wo.part_name AS partName,
        wo.delivery_date AS deliveryDate,
        wo.status,
        c.company_name AS customerName
      FROM work_orders wo
      LEFT JOIN customers c ON c.id = wo.customer_id
      WHERE IFNULL(wo.status, '') NOT IN ('completed', 'cancelled')
      ORDER BY wo.id DESC
    `, [], (err, rows) => {
      if (err) return res.status(500).json({ success:false, message:err.message });
      res.json({ success:true, workOrders: rows || [] });
    });
  });

  app.get("/api/production-simulation/machines", (req, res) => {
    db.all(`
      SELECT
        id,
        machine_code AS machineCode,
        machine_name AS machineName,
        machine_type AS machineType,
        status
      FROM machines
      ORDER BY machine_name
    `, [], (err, rows) => {
      if (err) return res.json({ success:true, machines: [] });
      res.json({ success:true, machines: rows || [] });
    });
  });

  app.get("/api/production-simulation/work-orders/:id/operations", (req, res) => {
    db.all(`
      SELECT
        id,
        operation_code AS operationCode,
        operation_name AS operationName,
        machine_type AS machineType,
        planned_time AS plannedTime,
        sequence_no AS sequenceNo,
        status
      FROM work_order_operations
      WHERE work_order_id = ?
      ORDER BY sequence_no ASC, id ASC
    `, [req.params.id], (err, rows) => {
      if (err) return res.json({ success:true, operations: [] });
      res.json({ success:true, operations: rows || [] });
    });
  });

  app.post("/api/production-simulation/calculate", (req, res) => {
    const {
      workOrderId,
      machineId,
      operationMinutes,
      setupMinutes,
      quantity,
      startDateTime
    } = req.body;

    if (!workOrderId || !machineId) {
      return res.status(400).json({
        success:false,
        message:"İş emri ve makine zorunludur."
      });
    }

    const qty = Number(quantity || 1);
    const opMin = Number(operationMinutes || 0);
    const setupMin = Number(setupMinutes || 0);

    const totalMinutes = setupMin + (opMin * qty);

    const start = startDateTime
      ? new Date(startDateTime)
      : new Date();

    const finish = new Date(start.getTime() + totalMinutes * 60000);

    db.get(`
      SELECT
        wo.*,
        c.company_name AS customerName
      FROM work_orders wo
      LEFT JOIN customers c ON c.id = wo.customer_id
      WHERE wo.id = ?
    `, [workOrderId], (err, workOrder) => {
      if (err) return res.status(500).json({ success:false, message:err.message });
      if (!workOrder) return res.status(404).json({ success:false, message:"İş emri bulunamadı." });

      db.get(`
        SELECT *
        FROM machines
        WHERE id = ?
      `, [machineId], (err, machine) => {
        if (err) return res.status(500).json({ success:false, message:err.message });
        if (!machine) return res.status(404).json({ success:false, message:"Makine bulunamadı." });

        const deliveryDate = workOrder.delivery_date ? new Date(workOrder.delivery_date) : null;

        let riskLevel = "low";
        let riskText = "Zamanında yetişir";

        if (deliveryDate && finish > deliveryDate) {
          riskLevel = "high";
          riskText = "Teslim tarihi riski var";
        } else if (deliveryDate) {
          const diffHours = (deliveryDate.getTime() - finish.getTime()) / 36e5;
          if (diffHours <= 24) {
            riskLevel = "medium";
            riskText = "Teslim tarihi çok yakın";
          }
        }

        res.json({
          success: true,
          simulation: {
            workOrderNo: workOrder.work_order_no,
            title: workOrder.title,
            partName: workOrder.part_name,
            customerName: workOrder.customerName,
            deliveryDate: workOrder.delivery_date,
            machineName: machine.machine_name,
            machineCode: machine.machine_code,
            machineType: machine.machine_type,
            quantity: qty,
            setupMinutes: setupMin,
            operationMinutes: opMin,
            totalMinutes,
            totalHours: (totalMinutes / 60).toFixed(2),
            startDateTime: start.toISOString(),
            finishDateTime: finish.toISOString(),
            riskLevel,
            riskText
          }
        });
      });
    });
  });
};