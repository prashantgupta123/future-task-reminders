const db = require('../config/db');

async function initializeSchema() {
  const createTableSql = `
    CREATE TABLE IF NOT EXISTS tasks (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      description TEXT,
      priority ENUM('high', 'medium', 'low') NOT NULL DEFAULT 'medium',
      task_type ENUM('public', 'private') NOT NULL DEFAULT 'public',
      trigger_at DATETIME NOT NULL,
      email_recipients TEXT NOT NULL,
      is_reminded TINYINT(1) NOT NULL DEFAULT 0,
      created_by VARCHAR(255) NULL,
      updated_by VARCHAR(255) NULL,
      updated_at DATETIME NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `;

  await db.query(createTableSql);

  // Ensure new columns exist when upgrading an existing database (MySQL without IF NOT EXISTS)
  const alterStatements = [
    "ALTER TABLE tasks ADD COLUMN task_type ENUM('public','private') NOT NULL DEFAULT 'public'",
    'ALTER TABLE tasks ADD COLUMN created_by VARCHAR(255) NULL',
    'ALTER TABLE tasks ADD COLUMN updated_by VARCHAR(255) NULL',
    'ALTER TABLE tasks ADD COLUMN updated_at DATETIME NULL'
  ];

  for (const sql of alterStatements) {
    try {
      // eslint-disable-next-line no-await-in-loop
      await db.query(sql);
    } catch (err) {
      // ER_DUP_FIELDNAME (1060) -> column already exists, safe to ignore
      if (!err || (err.code !== 'ER_DUP_FIELDNAME' && err.errno !== 1060)) {
        throw err;
      }
    }
  }
}

async function getAllTasks() {
  const [rows] = await db.query(
    'SELECT * FROM tasks ORDER BY trigger_at ASC, created_at DESC'
  );
  return rows;
}

async function getTaskById(id) {
  const [rows] = await db.query('SELECT * FROM tasks WHERE id = ?', [id]);
  return rows[0] || null;
}

async function createTask(task) {
  const {
    name,
    description,
    priority,
    trigger_at,
    email_recipients,
    task_type,
    created_by
  } = task;
  const typeToSave =
    (task_type && task_type.toLowerCase() === 'private') ? 'private' : 'public';
  const [result] = await db.query(
    'INSERT INTO tasks (name, description, priority, task_type, trigger_at, email_recipients, created_by) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [
      name,
      description,
      priority,
      typeToSave,
      trigger_at,
      email_recipients,
      created_by
    ]
  );
  return result.insertId;
}

async function updateTask(id, task) {
  const {
    name,
    description,
    priority,
    task_type,
    trigger_at,
    email_recipients,
    is_reminded,
    updated_by
  } = task;

  const typeToSave =
    task_type && task_type.toLowerCase() === 'private' ? 'private' : 'public';

  await db.query(
    `UPDATE tasks
     SET name = ?, description = ?, priority = ?, task_type = ?, trigger_at = ?, email_recipients = ?, is_reminded = ?, updated_by = ?, updated_at = NOW()
     WHERE id = ?`,
    [
      name,
      description,
      priority,
      typeToSave,
      trigger_at,
      email_recipients,
      is_reminded ? 1 : 0,
      updated_by || null,
      id
    ]
  );
}

async function getPendingReminders() {
  const [rows] = await db.query(
    'SELECT * FROM tasks WHERE is_reminded = 0 AND trigger_at <= NOW()'
  );
  return rows;
}

async function markAsReminded(taskId) {
  await db.query('UPDATE tasks SET is_reminded = 1 WHERE id = ?', [taskId]);
}

async function deleteTask(id) {
  await db.query('DELETE FROM tasks WHERE id = ?', [id]);
}

module.exports = {
  initializeSchema,
  getAllTasks,
  getTaskById,
  createTask,
  updateTask,
  getPendingReminders,
  markAsReminded,
  deleteTask
};


