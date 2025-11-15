const cron = require('node-cron');
const { getPendingReminders, markAsReminded } = require('./model');
const { sendReminderEmail } = require('../email/mailer');

function startReminderScheduler() {
  const cronExpr = process.env.REMINDER_CRON || '*/1 * * * *';

  cron.schedule(cronExpr, async () => {
    try {
      const tasks = await getPendingReminders();
      if (!tasks.length) {
        return;
      }

      console.log(`Sending reminders for ${tasks.length} task(s).`);

      for (const task of tasks) {
        try {
          await sendReminderEmail(task);
          await markAsReminded(task.id);
          console.log(`Reminder sent for task #${task.id}`);
        } catch (err) {
          console.error(
            `Failed to send reminder for task #${task.id}:`,
            err.message || err
          );
        }
      }
    } catch (err) {
      console.error('Error while processing reminders:', err.message || err);
    }
  });

  console.log(`Reminder scheduler started with cron expression: ${cronExpr}`);
}

module.exports = {
  startReminderScheduler
};


