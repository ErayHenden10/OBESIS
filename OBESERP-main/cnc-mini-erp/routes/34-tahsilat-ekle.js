// TAHSİLAT EKLE
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
// TAHSİLAT EKLE
// ======================================

app.post('/api/payments', (req, res) => {

    const {
        paymentNo,
        customerId,
        customerName,
        amount,
        paymentMethod,
        dueDate,
        paymentDate,
        status,
        referenceNo,
        description
    } = req.body;

    db.run(`
        INSERT INTO payments
        (
            payment_no,
            customer_id,
            customer_name,
            amount,
            payment_method,
            due_date,
            payment_date,
            status,
            reference_no,
            description
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    [
        paymentNo,
        customerId,
        customerName,
        amount || 0,
        paymentMethod || 'cash',
        dueDate || '',
        paymentDate || '',
        status || 'pending',
        referenceNo || '',
        description || ''
    ],
    function(err){

        if(err){
            console.error('Tahsilat ekleme hatası:', err);

            return res.status(500).json({
                success:false,
                message:err.message
            });
        }

        res.json({
            success:true,
            id:this.lastID
        });

    });

});

};
