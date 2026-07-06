// TEDARİKÇİLER
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
// TEDARİKÇİLER
// ===============================

app.get("/api/suppliers", (req, res) => {
  db.all("SELECT * FROM suppliers ORDER BY id DESC", [], (err, rows) => {
    if (err) {
      return res.status(500).json({ success: false, message: err.message, suppliers: [] });
    }

    res.json({
      success: true,
      suppliers: rows.map(s => ({
        id: s.id,
        companyName: s.company_name,
        authorizedPerson: s.authorized_person,
        phone: s.phone,
        email: s.email,
        taxNo: s.tax_no,
        status: s.status
      }))
    });
  });
});

app.post("/api/suppliers", (req, res) => {
  const { companyName, authorizedPerson, phone, email, taxNo, status } = req.body;

  if (!companyName) {
    return res.status(400).json({ success: false, message: "Firma adı zorunludur." });
  }

  db.run(
    `
    INSERT INTO suppliers
    (company_name, authorized_person, phone, email, tax_no, status)
    VALUES (?, ?, ?, ?, ?, ?)
    `,
    [companyName, authorizedPerson, phone, email, taxNo, status || "active"],
    function (err) {
      if (err) {
        return res.status(500).json({ success: false, message: err.message });
      }

      res.json({ success: true, id: this.lastID });
    }
  );
});

app.put("/api/suppliers/:id", (req, res) => {
  const { companyName, authorizedPerson, phone, email, taxNo, status } = req.body;

  db.run(
    `
    UPDATE suppliers SET
      company_name = ?,
      authorized_person = ?,
      phone = ?,
      email = ?,
      tax_no = ?,
      status = ?
    WHERE id = ?
    `,
    [companyName, authorizedPerson, phone, email, taxNo, status || "active", req.params.id],
    function (err) {
      if (err) {
        return res.status(500).json({ success: false, message: err.message });
      }

      res.json({ success: true });
    }
  );
});

app.delete("/api/suppliers/:id", (req, res) => {
  db.run("DELETE FROM suppliers WHERE id = ?", [req.params.id], function (err) {
    if (err) {
      return res.status(500).json({ success: false, message: err.message });
    }

    res.json({ success: true });
  });
});

app.delete("/api/product-routes/:id",(req,res)=>{

  db.run(`
    DELETE FROM product_routes
    WHERE id = ?
  `,
  [req.params.id],
  function(err){

    if(err){
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
