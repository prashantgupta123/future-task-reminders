const express = require('express');
const router = express.Router();

const {
  getAllTasks,
  getTaskById,
  createTask,
  updateTask,
  deleteTask
} = require('./model');

function ensureAuthenticated(req, res, next) {
  if (req.session && req.session.userId) {
    return next();
  }
  return res.redirect('/auth/login');
}

router.get('/', (req, res) => {
  if (req.session && req.session.userId) {
    return res.redirect('/tasks');
  }
  return res.redirect('/auth/login');
});

router.use(ensureAuthenticated);

function toDatetimeLocal(value) {
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) {
    return '';
  }
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(
    d.getDate()
  )}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function capitalizeFirst(value) {
  if (!value || typeof value !== 'string') return '';
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function validateEmailList(raw) {
  if (!raw || typeof raw !== 'string') return false;
  const parts = raw
    .split(',')
    .map((e) => e.trim())
    .filter((e) => e.length > 0);

  if (!parts.length) return false;

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return parts.every((p) => emailRegex.test(p));
}

function normalizeTriggerToUtc(input) {
  if (!input) {
    return input;
  }

  let val = input.trim();

  if (val.length === 16 && val.includes('T')) {
    val = `${val}:00`;
  }

  if (val.length === 19 && val.indexOf(' ') === 10) {
    val = val.replace(' ', 'T');
  }

  const d = new Date(val);
  if (Number.isNaN(d.getTime())) {
    // Fallback to a simple normalization without TZ conversion
    return input.includes('T') ? input.replace('T', ' ') : input;
  }

  return d.toISOString().slice(0, 19).replace('T', ' ');
}

router.get('/tasks', async (req, res, next) => {
  try {
    const allTasks = await getAllTasks();

    const currentEmail = res.locals.currentUserEmail;
    const visible = allTasks.filter(
      (t) =>
        !t.task_type ||
        t.task_type === 'public' ||
        (currentEmail && t.created_by === currentEmail)
    );

    const tasks = visible.map((t) => ({
      ...t,
      trigger_at_display: toDatetimeLocal(t.trigger_at).replace('T', ' '),
      created_at_display: t.created_at
        ? toDatetimeLocal(t.created_at).replace('T', ' ')
        : '',
      updated_at_display: t.updated_at
        ? toDatetimeLocal(t.updated_at).replace('T', ' ')
        : '',
      priority_label: capitalizeFirst(t.priority),
      task_type_label: capitalizeFirst(t.task_type || 'public'),
      task_type_code: (t.task_type || 'public').toLowerCase()
    }));

    const summary = {
      high: tasks.filter((t) => t.priority === 'high').length,
      medium: tasks.filter((t) => t.priority === 'medium').length,
      low: tasks.filter((t) => t.priority === 'low').length,
      total: tasks.length
    };

    res.render('tasks/dashboard', {
      title: 'Task Reminders Dashboard',
      tasks,
      summary
    });
  } catch (err) {
    next(err);
  }
});

router.get('/tasks/list', async (req, res, next) => {
  try {
    const allTasks = await getAllTasks();

    const currentEmail = res.locals.currentUserEmail;
    const visible = allTasks.filter(
      (t) =>
        !t.task_type ||
        t.task_type === 'public' ||
        (currentEmail && t.created_by === currentEmail)
    );

    const tasks = visible.map((t) => ({
      ...t,
      trigger_at_display: toDatetimeLocal(t.trigger_at).replace('T', ' '),
      created_at_display: t.created_at
        ? toDatetimeLocal(t.created_at).replace('T', ' ')
        : '',
      updated_at_display: t.updated_at
        ? toDatetimeLocal(t.updated_at).replace('T', ' ')
        : '',
      priority_label: capitalizeFirst(t.priority),
      task_type_label: capitalizeFirst(t.task_type || 'public'),
      task_type_code: (t.task_type || 'public').toLowerCase()
    }));

    const summary = {
      high: tasks.filter((t) => t.priority === 'high').length,
      medium: tasks.filter((t) => t.priority === 'medium').length,
      low: tasks.filter((t) => t.priority === 'low').length,
      total: tasks.length
    };

    res.render('tasks/list', {
      title: 'All Task Reminders',
      tasks,
      summary
    });
  } catch (err) {
    next(err);
  }
});

router.post('/tasks', async (req, res, next) => {
  try {
    const {
      name,
      description,
      priority,
      trigger_at,
      email_recipients,
      task_type
    } = req.body;

    if (!name || !priority || !trigger_at || !email_recipients) {
      return res.status(400).render('tasks/dashboard', {
        title: 'Task Reminders Dashboard',
        error: 'Please fill in all required fields.',
        tasks: [],
        summary: { high: 0, medium: 0, low: 0, total: 0 }
      });
    }

    if (!validateEmailList(email_recipients)) {
      return res.status(400).render('tasks/dashboard', {
        title: 'Task Reminders Dashboard',
        error:
          'One or more email addresses are invalid. Please use comma-separated emails like user1@example.com, user2@example.com.',
        tasks: [],
        summary: { high: 0, medium: 0, low: 0, total: 0 }
      });
    }

    // Normalize datetime-local into a UTC-based MySQL DATETIME string
    const triggerAt = normalizeTriggerToUtc(trigger_at);

    const recipients = email_recipients
      .split(',')
      .map((e) => e.trim())
      .filter((e) => e.length > 0)
      .join(',');

    await createTask({
      name,
      description,
      priority,
      task_type,
      trigger_at: triggerAt,
      email_recipients: recipients,
      created_by: res.locals.currentUserEmail || null
    });

    res.redirect('/tasks');
  } catch (err) {
    next(err);
  }
});

router.get('/tasks/:id/edit', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const task = await getTaskById(id);
    const from = req.query.from === 'list' ? 'list' : 'dashboard';

    if (!task) {
      return res.status(404).render('404', { title: 'Task Not Found' });
    }

    const triggerAtInput = toDatetimeLocal(task.trigger_at);

    res.render('tasks/edit', {
      title: `Edit Task #${task.id}`,
      task,
      triggerAtInput,
      from
    });
  } catch (err) {
    next(err);
  }
});

router.get('/tasks/:id/duplicate', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const task = await getTaskById(id);
    const from = req.query.from === 'list' ? 'list' : 'dashboard';

    if (!task) {
      return res.status(404).render('404', { title: 'Task Not Found' });
    }

    const triggerAtInput = toDatetimeLocal(task.trigger_at);

    res.render('tasks/duplicate', {
      title: `Duplicate Task #${task.id}`,
      task,
      triggerAtInput,
      from
    });
  } catch (err) {
    next(err);
  }
});

router.post('/tasks/:id/edit', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const existing = await getTaskById(id);

    if (!existing) {
      return res.status(404).render('404', { title: 'Task Not Found' });
    }

    const {
      name,
      description,
      priority,
      task_type,
      trigger_at,
      email_recipients,
      status,
      from
    } = req.body;

    const fromContext = from === 'list' ? 'list' : 'dashboard';

    if (!name || !priority || !trigger_at || !email_recipients) {
      const triggerAtInput = trigger_at;
      return res.status(400).render('tasks/edit', {
        title: `Edit Task #${existing.id}`,
        task: { ...existing, name, description, priority, email_recipients },
        triggerAtInput,
        from: fromContext,
        error: 'Please fill in all required fields.'
      });
    }

    if (!validateEmailList(email_recipients)) {
      const triggerAtInput = trigger_at;
      return res.status(400).render('tasks/edit', {
        title: `Edit Task #${existing.id}`,
        task: { ...existing, name, description, priority, email_recipients },
        triggerAtInput,
        from: fromContext,
        error:
          'One or more email addresses are invalid. Please use comma-separated emails like user1@example.com, user2@example.com.'
      });
    }

    const triggerAt = normalizeTriggerToUtc(trigger_at);

    const recipients = email_recipients
      .split(',')
      .map((e) => e.trim())
      .filter((e) => e.length > 0)
      .join(',');

    const isReminded = status === 'sent' ? 1 : 0;

    await updateTask(id, {
      name,
      description,
      priority,
      task_type,
      trigger_at: triggerAt,
      email_recipients: recipients,
      is_reminded: isReminded,
      updated_by: res.locals.currentUserEmail || null
    });

    res.redirect(fromContext === 'list' ? '/tasks/list' : '/tasks');
  } catch (err) {
    next(err);
  }
});

router.post('/tasks/:id/duplicate', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const existing = await getTaskById(id);

    if (!existing) {
      return res.status(404).render('404', { title: 'Task Not Found' });
    }

    const {
      name,
      description,
      priority,
      trigger_at,
      email_recipients,
      from
    } = req.body;

    const fromContext = from === 'list' ? 'list' : 'dashboard';

    if (!name || !priority || !trigger_at || !email_recipients) {
      const triggerAtInput = trigger_at;
      return res.status(400).render('tasks/duplicate', {
        title: `Duplicate Task #${existing.id}`,
        task: { ...existing, name, description, priority, email_recipients },
        triggerAtInput,
        from: fromContext,
        error: 'Please fill in all required fields.'
      });
    }

    if (!validateEmailList(email_recipients)) {
      const triggerAtInput = trigger_at;
      return res.status(400).render('tasks/duplicate', {
        title: `Duplicate Task #${existing.id}`,
        task: { ...existing, name, description, priority, email_recipients },
        triggerAtInput,
        from: fromContext,
        error:
          'One or more email addresses are invalid. Please use comma-separated emails like user1@example.com, user2@example.com.'
      });
    }

    const triggerAt = normalizeTriggerToUtc(trigger_at);

    const recipients = email_recipients
      .split(',')
      .map((e) => e.trim())
      .filter((e) => e.length > 0)
      .join(',');

    await createTask({
      name,
      description,
      priority,
      task_type: existing.task_type || 'public',
      trigger_at: triggerAt,
      email_recipients: recipients,
      created_by: res.locals.currentUserEmail || null
    });

    res.redirect(fromContext === 'list' ? '/tasks/list' : '/tasks');
  } catch (err) {
    next(err);
  }
});

router.post('/tasks/:id/delete', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const from =
      req.query.from === 'list' || req.body.from === 'list'
        ? 'list'
        : 'dashboard';
    await deleteTask(id);
    res.redirect(from === 'list' ? '/tasks/list' : '/tasks');
  } catch (err) {
    next(err);
  }
});

module.exports = router;


