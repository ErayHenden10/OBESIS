// TEK TAHSİLAT GETİR
module.exports = function register(app, ctx) {
  var db = ctx.db;
  var dbGet = ctx.dbGet;
  var dbAll = ctx.dbAll;
  var dbRun = ctx.dbRun;
  var path = ctx.path;
  var rootDir = ctx.rootDir;
  var onlySuperAdmin = ctx.onlySuperAdmin;
  var addActivityLog = ctx.addActivityLog;

// ======================================
// TEK TAHSİLAT GETİR
// ======================================

app.get('/api/payments/:id', (req, res) => {

    db.get(`
        SELECT *
        FROM payments
        WHERE id = ?
    `, [req.params.id], (err, row) => {

        if (err) {
            console.error('Tahsilat detay hatası:', err);

            return res.status(500).json({
                success: false,
                message: err.message
            });
        }

        res.json({
            success: true,
            payment: row
        });

    });

});

};
