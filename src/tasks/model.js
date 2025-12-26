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
      execution_protection ENUM('none', 'daily', 'weekly', 'monthly') NOT NULL DEFAULT 'none',
      last_reminded_at DATETIME NULL,
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
    'ALTER TABLE tasks ADD COLUMN updated_at DATETIME NULL',
    "ALTER TABLE tasks ADD COLUMN execution_protection ENUM('none', 'daily', 'weekly', 'monthly') NOT NULL DEFAULT 'none'",
    "ALTER TABLE tasks MODIFY COLUMN execution_protection ENUM('none', 'daily', 'weekly', 'monthly') NOT NULL DEFAULT 'none'",
    'ALTER TABLE tasks ADD COLUMN last_reminded_at DATETIME NULL'
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
    execution_protection,
    created_by
  } = task;
  const typeToSave =
    (task_type && task_type.toLowerCase() === 'private') ? 'private' : 'public';
  const protectionToSave =
    (execution_protection && ['daily', 'weekly', 'monthly'].includes(execution_protection.toLowerCase()))
      ? execution_protection.toLowerCase()
      : 'none';
  const [result] = await db.query(
    'INSERT INTO tasks (name, description, priority, task_type, trigger_at, email_recipients, execution_protection, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    [
      name,
      description,
      priority,
      typeToSave,
      trigger_at,
      email_recipients,
      protectionToSave,
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
    execution_protection,
    updated_by
  } = task;

  const typeToSave =
    task_type && task_type.toLowerCase() === 'private' ? 'private' : 'public';
  const protectionToSave =
    (execution_protection && ['daily', 'weekly', 'monthly'].includes(execution_protection.toLowerCase()))
      ? execution_protection.toLowerCase()
      : 'none';

  // Get existing task to check if execution_protection is being changed
  const existing = await getTaskById(id);
  const wasRecurring = existing && ['daily', 'weekly', 'monthly'].includes(existing.execution_protection);
  const isNowNone = protectionToSave === 'none';

  // If changing from recurring (daily/weekly) to 'none', and task has been sent before,
  // mark it as reminded to prevent it from sending again
  let finalIsReminded = is_reminded ? 1 : 0;
  if (wasRecurring && isNowNone && existing.last_reminded_at) {
    finalIsReminded = 1; // Task has been sent before, so mark as reminded
  }

  await db.query(
    `UPDATE tasks
     SET name = ?, description = ?, priority = ?, task_type = ?, trigger_at = ?, email_recipients = ?, is_reminded = ?, execution_protection = ?, updated_by = ?, updated_at = NOW()
     WHERE id = ?`,
    [
      name,
      description,
      priority,
      typeToSave,
      trigger_at,
      email_recipients,
      finalIsReminded,
      protectionToSave,
      updated_by || null,
      id
    ]
  );
}

async function getPendingReminders() {
  // Get tasks that need reminders:
  // 1. Tasks with execution_protection='none' that haven't been reminded yet (is_reminded = 0) AND trigger_at has passed
  // 2. Tasks with execution_protection='daily' where trigger_at has passed AND (last_reminded_at is NULL OR last_reminded_at < DATE_SUB(NOW(), INTERVAL 1 DAY))
  // 3. Tasks with execution_protection='weekly' where trigger_at has passed AND (last_reminded_at is NULL OR last_reminded_at < DATE_SUB(NOW(), INTERVAL 1 WEEK))
  // 4. Tasks with execution_protection='monthly' where trigger_at has passed AND (last_reminded_at is NULL OR last_reminded_at < DATE_SUB(NOW(), INTERVAL 1 MONTH))
  // 
  // IMPORTANT: Exclude tasks that were just reminded (within last 2 minutes) to prevent duplicate sends
  // when multiple cron jobs run simultaneously
  const [rows] = await db.query(
    `SELECT * FROM tasks 
     WHERE trigger_at <= NOW() 
     AND (last_reminded_at IS NULL OR last_reminded_at < DATE_SUB(NOW(), INTERVAL 2 MINUTE))
     AND (
       (execution_protection = 'none' AND is_reminded = 0)
       OR 
       (execution_protection = 'daily' AND (last_reminded_at IS NULL OR last_reminded_at < DATE_SUB(NOW(), INTERVAL 1 DAY)))
       OR 
       (execution_protection = 'weekly' AND (last_reminded_at IS NULL OR last_reminded_at < DATE_SUB(NOW(), INTERVAL 1 WEEK)))
       OR 
       (execution_protection = 'monthly' AND (last_reminded_at IS NULL OR last_reminded_at < DATE_SUB(NOW(), INTERVAL 1 MONTH)))
     )
     ORDER BY 
       CASE execution_protection 
         WHEN 'daily' THEN 1 
         WHEN 'weekly' THEN 2 
         WHEN 'monthly' THEN 3 
         ELSE 4 
       END,
       priority DESC,
       trigger_at ASC`
  );
  return rows;
}

async function markAsReminded(taskId) {
  // Update last_reminded_at for all tasks
  // For 'none' protection, also mark is_reminded = 1
  // For 'daily' and 'weekly', keep is_reminded as is (they continue to be sent)
  await db.query(
    `UPDATE tasks 
     SET last_reminded_at = NOW(),
         is_reminded = CASE 
           WHEN execution_protection = 'none' THEN 1 
           ELSE is_reminded 
         END 
     WHERE id = ?`,
    [taskId]
  );
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


