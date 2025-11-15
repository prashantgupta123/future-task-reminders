const mysql = require('mysql2/promise');

const {
  DB_HOST,
  DB_PORT,
  DB_USER,
  DB_PASSWORD,
  DB_NAME
} = process.env;

if (!DB_HOST || !DB_USER || !DB_NAME) {
  console.warn(
    'Database configuration is incomplete. Please set DB_HOST, DB_USER, and DB_NAME in your environment variables.'
  );
}

const pool = mysql.createPool({
  host: DB_HOST || 'localhost',
  port: DB_PORT ? Number(DB_PORT) : 3306,
  user: DB_USER || 'root',
  password: DB_PASSWORD || '',
  database: DB_NAME || 'task_reminders',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

module.exports = pool;


