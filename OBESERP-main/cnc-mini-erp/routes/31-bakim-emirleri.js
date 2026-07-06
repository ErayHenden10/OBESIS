// BAKIM EMİRLERİ
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
// BAKIM EMİRLERİ
// ===============================

db.run(`
CREATE TABLE IF NOT EXISTS maintenance_orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_no TEXT NOT NULL,
    machine_id INTEGER,
    machine_name TEXT,
    title TEXT NOT NULL,
    description TEXT,
    priority TEXT DEFAULT 'normal',
    status TEXT DEFAULT 'open',
    planned_date TEXT,
    responsible_person TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
)
`);

app.get('/api/maintenance-orders', (req, res) => {
    db.all(`
        SELECT *
        FROM maintenance_orders
        ORDER BY id DESC
    `, [], (err, rows) => {
        if (err) {
            console.error("Bakım emirleri listeleme hatası:", err.message);

            return res.status(500).json({
                success: false,
                message: err.message,
                orders: []
            });
        }

        res.json({
            success: true,
            orders: rows || []
        });
    });
});

app.post('/api/maintenance-orders', (req, res) => {
    const {
        orderNo,
        machineId,
        machineName,
        title,
        description,
        priority,
        status,
        plannedDate,
        responsiblePerson
    } = req.body;

    const finalOrderNo = orderNo || `BE-${Date.now()}`;

    db.run(`
        INSERT INTO maintenance_orders
        (
            order_no,
            machine_id,
            machine_name,
            title,
            description,
            priority,
            status,
            planned_date,
            responsible_person
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    [
        finalOrderNo,
        machineId || null,
        machineName || "",
        title || "Bakım Emri",
        description || "",
        priority || "normal",
        status || "open",
        plannedDate || "",
        responsiblePerson || ""
    ],
    function (err) {
        if (err) {
            console.error("Bakım emri ekleme hatası:", err.message);

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
