// TAHSİLAT SİL
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
// TAHSİLAT SİL
// ======================================

app.delete('/api/payments/:id', (req, res) => {

    db.run(`
        DELETE FROM payments
        WHERE id = ?
    `,
    [req.params.id],
    function(err){

        if(err){
            console.error('Tahsilat silme hatası:', err);

            return res.status(500).json({
                success:false,
                message:err.message
            });
        }

        res.json({
            success:true
        });

    });

});

};
