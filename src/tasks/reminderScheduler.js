const cron = require('node-cron');
const { getPendingReminders, markAsReminded } = require('./model');
const { sendReminderEmail } = require('../email/mailer');

// Track currently processing tasks to prevent duplicate sends
const processingTasks = new Set();

async function processReminders() {
  try {
    const tasks = await getPendingReminders();
    if (!tasks.length) {
      return;
    }

    console.log(`Found ${tasks.length} task(s) needing reminders.`);

    for (const task of tasks) {
      // Skip if already being processed (prevents duplicate sends from concurrent cron jobs)
      if (processingTasks.has(task.id)) {
        console.log(`Task #${task.id} is already being processed, skipping...`);
        continue;
      }

      processingTasks.add(task.id);

      try {
        await sendReminderEmail(task);
        await markAsReminded(task.id);
        console.log(`Reminder sent for task #${task.id} (execution_protection: ${task.execution_protection || 'none'})`);
      } catch (err) {
        console.error(
          `Failed to send reminder for task #${task.id}:`,
          err.message || err
        );
      } finally {
        // Remove from processing set after a short delay to allow markAsReminded to complete
        setTimeout(() => {
          processingTasks.delete(task.id);
        }, 5000); // 5 second buffer
      }
    }
  } catch (err) {
    console.error('Error while processing reminders:', err.message || err);
  }
}

function startReminderScheduler() {
  // Immediate reminder scheduler (runs frequently for tasks that need immediate sending)
  const cronExpr = process.env.REMINDER_CRON || '*/1 * * * *';

  cron.schedule(cronExpr, async () => {
    await processReminders();
  });

  console.log(`Reminder scheduler started with cron expression: ${cronExpr}`);

  // Daily cron scheduler (runs once per day for daily/weekly execution_protection tasks)
  const dailyCronExpr = process.env.DAILY_CRON || '0 9 * * *'; // Default: 9 AM daily

  cron.schedule(dailyCronExpr, async () => {
    console.log('Daily reminder check started...');
    await processReminders();
  });

  console.log(`Daily reminder scheduler started with cron expression: ${dailyCronExpr}`);
}

module.exports = {
  startReminderScheduler
};


