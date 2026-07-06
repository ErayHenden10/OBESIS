// FIRE / HURDA İPTAL
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
// FIRE / HURDA İPTAL
// ===============================
app.put("/api/scrap-records/:id/cancel", (req, res) => {
  db.run(`
    UPDATE scrap_records
    SET status = 'İptal'
    WHERE id = ? AND status = 'Beklemede'
  `, [req.params.id], function(err) {
    if (err) {
      console.error("Fire/hurda iptal hatası:", err);
      return res.status(500).json({ success:false, message:err.message });
    }

    res.json({ success:true, message:"Fire/hurda kaydı iptal edildi." });
  });
});

app.post("/api/login", (req, res) => {

    const { username, password } = req.body;

    if (!username || !password) {
        return res.status(400).json({
            success: false,
            message: "Kullanıcı adı ve şifre gerekli."
        });
    }

    db.get(
        `
        SELECT *
        FROM users
        WHERE username = ?
        AND password = ?
        AND active = 1
        `,
        [username, password],
        (err, user) => {

            if (err) {
                return res.status(500).json({
                    success: false,
                    message: err.message
                });
            }

            if (!user) {
                return res.status(401).json({
                    success: false,
                    message: "Kullanıcı adı veya şifre hatalı."
                });
            }

            res.json({
                success: true,
                user: {
                    id: user.id,
                    fullName: user.full_name,
                    role: user.role,
                    username: user.username
                }
            });

        }
    );

});

};
