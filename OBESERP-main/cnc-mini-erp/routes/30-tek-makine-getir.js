// TEK MAKİNE GETİR
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
// TEK MAKİNE GETİR
// ===============================

app.get('/api/machines/:id', (req, res) => {
    db.get(`
        SELECT *
        FROM machine_maintenance
        WHERE id = ?
    `, [req.params.id], (err, row) => {
        if (err) {
            return res.status(500).json({
                success: false,
                message: err.message
            });
        }

        res.json({
            success: true,
            machine: row
        });
    });
});

};
