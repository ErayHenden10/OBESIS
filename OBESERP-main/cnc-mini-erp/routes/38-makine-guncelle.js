// MAKİNE GÜNCELLE
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
// MAKİNE GÜNCELLE
// ===============================

app.put('/api/machines/:id', (req, res) => {
    const {
        machine_code,
        machine_name,
        department,
        last_maintenance,
        next_maintenance,
        maintenance_period,
        status,
        note
    } = req.body;

    db.run(`
        UPDATE machine_maintenance
        SET
            machine_code = ?,
            machine_name = ?,
            department = ?,
            last_maintenance = ?,
            next_maintenance = ?,
            maintenance_period = ?,
            status = ?,
            note = ?
        WHERE id = ?
    `,
    [
        machine_code,
        machine_name,
        department,
        last_maintenance,
        next_maintenance,
        maintenance_period,
        status || 'active',
        note,
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
    });
});

};
