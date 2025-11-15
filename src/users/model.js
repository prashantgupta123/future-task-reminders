const db = require('../config/db');

async function initializeUserSchema() {
  const createTableSql = `
    CREATE TABLE IF NOT EXISTS users (
      id INT AUTO_INCREMENT PRIMARY KEY,
      username VARCHAR(100) NOT NULL UNIQUE,
      email VARCHAR(255) NOT NULL UNIQUE,
      password_hash VARCHAR(255) NOT NULL,
      last_login_at DATETIME NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `;

  await db.query(createTableSql);
}

async function findUserByEmail(email) {
  const [rows] = await db.query('SELECT * FROM users WHERE email = ?', [email]);
  return rows[0] || null;
}

async function findUserById(id) {
  const [rows] = await db.query('SELECT * FROM users WHERE id = ?', [id]);
  return rows[0] || null;
}

async function createUser({ username, email, password_hash }) {
  const [result] = await db.query(
    'INSERT INTO users (username, email, password_hash) VALUES (?, ?, ?)',
    [username, email, password_hash]
  );
  return result.insertId;
}

async function updateLastLogin(userId) {
  await db.query('UPDATE users SET last_login_at = NOW() WHERE id = ?', [
    userId
  ]);
}

async function updateUserAccount(id, { username, email, password_hash }) {
  await db.query(
    'UPDATE users SET username = ?, email = ?, password_hash = ? WHERE id = ?',
    [username, email, password_hash, id]
  );
}

module.exports = {
  initializeUserSchema,
  findUserByEmail,
  findUserById,
  createUser,
  updateLastLogin,
  updateUserAccount
};


