// TAHSİLAT LİSTELE
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
// TAHSİLAT LİSTELE
// ======================================

app.get('/api/payments', (req, res) => {

    db.all(`
        SELECT *
        FROM payments
        ORDER BY id DESC
    `, [], (err, rows) => {

        if (err) {
            console.error('Tahsilat listeleme hatası:', err);

            return res.status(500).json({
                success: false,
                message: err.message,
                payments: []
            });
        }

        res.json({
            success: true,
            payments: rows || []
        });

    });

});

};
