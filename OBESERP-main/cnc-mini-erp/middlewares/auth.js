function onlySuperAdmin(req, res, next) {
  const role = req.headers["x-user-role"];
  if (role !== "superadmin") {
    return res.status(403).json({ success: false, message: "Bu ekrana sadece Süper Admin erişebilir." });
  }
  next();
}
module.exports = { onlySuperAdmin };
