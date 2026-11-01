function unsafeQuery(req, db) {
  const sql = "SELECT * FROM users WHERE name = '" + req.query.name + "'";
  return db.query(sql);
}

module.exports = { unsafeQuery };
