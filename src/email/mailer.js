const nodemailer = require('nodemailer');

const {
  SMTP_HOST,
  SMTP_PORT,
  SMTP_USER,
  SMTP_PASS,
  SMTP_SECURE,
  SMTP_FROM
} = process.env;

let transporter = null;

function capitalizeFirst(value) {
  if (!value || typeof value !== 'string') return '';
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function formatDateTime(value) {
  if (!value) return '';
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) {
    return String(value);
  }
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(
    d.getDate()
  )} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function getTransporter() {
  if (transporter) {
    return transporter;
  }

  if (!SMTP_HOST || !SMTP_PORT) {
    console.warn(
      'SMTP configuration is incomplete. Please set SMTP_HOST and SMTP_PORT in your environment variables.'
    );
  }

  transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: Number(SMTP_PORT || 587),
    secure: SMTP_SECURE === 'true',
    auth: SMTP_USER
      ? {
          user: SMTP_USER,
          pass: SMTP_PASS
        }
      : undefined
  });

  return transporter;
}

async function sendReminderEmail(task) {
  const to = task.email_recipients;
  if (!to) {
    return;
  }

  const from = SMTP_FROM || SMTP_USER;

  const priorityLabel = capitalizeFirst(task.priority || '');
  const createdAt = formatDateTime(task.created_at);
  const updatedAt = formatDateTime(task.updated_at);
  const triggerAt = formatDateTime(task.trigger_at);
  const description = task.description || 'No description provided.';
  const createdBy = task.created_by || '-';
  const updatedBy = task.updated_by || '-';
  const taskTypeLabel = capitalizeFirst(task.task_type || 'public');

  const mailOptions = {
    from,
    to,
    subject: `Reminder: ${task.name}`,
    text:
      `This is a reminder for the task "${task.name}".\n\n` +
      `Task Name: ${task.name}\n` +
      `Task Description: ${description}\n` +
      `Created At: ${createdAt}\n` +
      `Created By: ${createdBy}\n` +
      `Trigger At: ${triggerAt}\n` +
      `Priority: ${priorityLabel}\n` +
      `Type: ${taskTypeLabel}\n` +
      `Updated At: ${updatedAt}\n` +
      `Updated By: ${updatedBy}\n`,
    html: `
      <div style="margin:0;padding:0;background:#ffffff;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
        <div style="max-width:560px;margin:24px auto;padding:0 16px;">
          <div style="
            background:radial-gradient(circle at top,#020617,#020617 45%,#000000 100%);
            border-radius:16px;
            border:1px solid #1e293b;
            box-shadow:0 18px 45px rgba(15,23,42,0.9);
            padding:20px 22px 18px;
            color:#e5e7eb;
          ">
            <h2 style="margin:0 0 8px;font-size:18px;color:#e5e7eb;">Task Reminder</h2>
            <p style="margin:0 0 16px;color:#9ca3af;font-size:13px;">
              This is a reminder for the scheduled task below.
            </p>

            <div style="margin-bottom:14px;">
              <div style="font-size:13px;color:#9ca3af;margin-bottom:4px;">Task Name</div>
              <div style="font-size:15px;font-weight:600;color:#e5e7eb;">${task.name}</div>
            </div>

            <div style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:16px;">
              <span style="
                display:inline-flex;
                align-items:center;
                padding:2px 10px;
                border-radius:999px;
                font-size:11px;
                text-transform:uppercase;
                letter-spacing:0.08em;
                background:${task.priority === 'high'
                  ? 'rgba(239,68,68,0.12)'
                  : task.priority === 'medium'
                  ? 'rgba(249,115,22,0.12)'
                  : 'rgba(34,197,94,0.12)'};
                border:1px solid ${
                  task.priority === 'high'
                    ? 'rgba(248,113,113,0.5)'
                    : task.priority === 'medium'
                    ? 'rgba(251,146,60,0.6)'
                    : 'rgba(34,197,94,0.6)'
                };
                color:${task.priority === 'high'
                  ? '#fecaca'
                  : task.priority === 'medium'
                  ? '#fed7aa'
                  : '#bbf7d0'};
              ">
                Priority: ${priorityLabel || 'N/A'}
              </span>
            </div>

            <div style="margin-bottom:12px;font-size:13px;">
              <div style="color:#9ca3af;margin-bottom:3px;">Created At</div>
              <div>${createdAt || '-'}</div>
            </div>
            <div style="margin-bottom:16px;font-size:13px;">
              <div style="color:#9ca3af;margin-bottom:3px;">Trigger At</div>
              <div>${triggerAt || '-'}</div>
            </div>

            <div style="margin-bottom:12px;font-size:13px;">
              <div style="color:#9ca3af;margin-bottom:3px;">Task Type</div>
              <div>${taskTypeLabel}</div>
            </div>

            <div style="margin-bottom:14px;font-size:13px;">
              <div style="color:#9ca3af;margin-bottom:4px;">Task Description</div>
              <div style="color:#e5e7eb;">
                ${description.replace(/\n/g, '<br/>')}
              </div>
            </div>

            <div style="margin-bottom:14px;font-size:13px;">
              <div style="color:#9ca3af;margin-bottom:4px;">Audit</div>
              <div style="color:#e5e7eb;font-size:12px;line-height:1.5;">
                <div>Created At: ${createdAt || '-'}</div>
                <div>Created By: ${createdBy}</div>
                <div>Updated At: ${updatedAt || '-'}</div>
                <div>Updated By: ${updatedBy}</div>
              </div>
            </div>

            <div style="margin-top:18px;border-top:1px solid rgba(148,163,184,0.35);padding-top:10px;">
              <p style="margin:0;font-size:12px;color:#6b7280;">
                You received this email because a reminder was scheduled in the Future Task Reminders app.
              </p>
            </div>
          </div>
        </div>
      </div>
    `
  };

  const tx = getTransporter();
  await tx.sendMail(mailOptions);
}

module.exports = {
  sendReminderEmail
};


