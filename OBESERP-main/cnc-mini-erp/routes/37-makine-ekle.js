// MAKİNE EKLE
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
// MAKİNE EKLE
// ===============================

app.post('/api/machines', (req, res) => {
    const {
        machine_code,
        machineCode,
        machine_name,
        machineName,
        machine_type,
        machineType,
        location,
        serial_no,
        serialNo,
        brand_model,
        brandModel,
        last_maintenance,
        lastMaintenance,
        next_maintenance,
        nextMaintenance,
        status,
        responsible_person,
        responsiblePerson,
        description,
        note
    } = req.body;

    const finalMachineCode = machine_code || machineCode;
    const finalMachineName = machine_name || machineName;

    if (!finalMachineCode || !finalMachineName) {
        return res.status(400).json({
            success: false,
            message: "Makine kodu ve makine adı zorunludur."
        });
    }

    db.run(`
        INSERT INTO machine_maintenance
        (
            machine_code,
            machine_name,
            machine_type,
            location,
            serial_no,
            brand_model,
            last_maintenance,
            next_maintenance,
            status,
            responsible_person,
            description
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    [
        finalMachineCode,
        finalMachineName,
        machine_type || machineType || "",
        location || "",
        serial_no || serialNo || "",
        brand_model || brandModel || "",
        last_maintenance || lastMaintenance || "",
        next_maintenance || nextMaintenance || "",
        status || "active",
        responsible_person || responsiblePerson || "",
        description || note || ""
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
    });
});

};
