function addActivityLog(req, data = {}) {
  const db = req.app.locals.db;
  const userId = req.headers["x-user-id"] || null;
  const userName = req.headers["x-user-name"] || "Bilinmeyen Kullanıcı";
  const roleKey = req.headers["x-user-role"] || "";
  db.run(`INSERT INTO activity_logs (user_id,user_name,role_key,module_name,action_type,description,record_id,ip_address) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`, [
    userId, userName, roleKey, data.moduleName || "", data.actionType || "", data.description || "", data.recordId || null, req.ip || ""
  ]);
}
module.exports = { addActivityLog };
