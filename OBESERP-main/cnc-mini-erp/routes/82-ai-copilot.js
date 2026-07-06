module.exports = function register(app, ctx){

const db = ctx.db;

app.post("/api/copilot/ask",(req,res)=>{

const question =
String(req.body.question || "")
.toLowerCase();

if(question.includes("kritik stok")){

db.all(`
SELECT
stock_code,
part_name,
quantity,
min_quantity
FROM stocks
WHERE quantity <= min_quantity
ORDER BY quantity ASC
LIMIT 20
`,[],(err,rows)=>{

res.json({
success:true,
title:"Kritik Stoklar",
data:rows || []
});

});

return;
}

if(question.includes("gecikecek")){

db.all(`
SELECT
work_order_no,
part_name,
delivery_date
FROM work_orders
WHERE date(delivery_date) <= date('now','+7 day')
AND status NOT IN ('completed','cancelled')
ORDER BY delivery_date
`,[],(err,rows)=>{

res.json({
success:true,
title:"Teslim Riski Olan İş Emirleri",
data:rows || []
});

});

return;
}

if(question.includes("fire")){

db.all(`
SELECT
machine_name,
SUM(scrap_quantity) total_scrap
FROM production_tracking
GROUP BY machine_name
ORDER BY total_scrap DESC
LIMIT 10
`,[],(err,rows)=>{

res.json({
success:true,
title:"En Çok Fire Veren Makineler",
data:rows || []
});

});

return;
}

if(question.includes("yoğun makine")){

db.all(`
SELECT
machine_name,
COUNT(*) total_job
FROM work_order_operations
GROUP BY machine_name
ORDER BY total_job DESC
LIMIT 10
`,[],(err,rows)=>{

res.json({
success:true,
title:"En Yoğun Makineler",
data:rows || []
});

});

return;
}

res.json({
success:true,
title:"ERP Copilot",
message:"Bu soru için hazır analiz bulunamadı."
});

});

};