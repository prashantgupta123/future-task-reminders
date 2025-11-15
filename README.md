## Future Task Reminders

Node.js/Express dashboard to create and manage task reminders, store them in a MySQL database, and send reminder emails via SMTP when their trigger date/time is reached.

### Features

- **Dashboard summary**: See all tasks with counts of **high**, **medium**, and **low** priority.
- **Task form**: Create a task with **name**, **description**, **priority**, **trigger date/time**, and **email recipients**.
- **MySQL persistence**: Tasks are stored in a MySQL table.
- **SMTP reminders**: A scheduler regularly checks for due tasks and sends emails via SMTP, using environment-based configuration.

### UI Screenshots

- **Create Account**

![Create Account](./images/1CreateAccount.png)

- **Login**

![Login](./images/2LoginAccount.png)

- **Task Dashboard**

![Task Dashboard](./images/3TaskDashboard.png)

- **Task Lists**

![Task Lists](./images/4TaskLists.png)

- **Email Reminder**

![Email Reminder](./images/5EmailReminder.png)

### Prerequisites

- Node.js (LTS recommended)
- MySQL server
- SMTP credentials (can be from any provider that supports SMTP)

### 1. Clone and install

```bash
cd future-task-reminders
npm install
```

### 2. Create the MySQL database

In MySQL:

```sql
CREATE DATABASE task_reminders CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

You do **not** need to manually create the `tasks` table; it will be created automatically on server start via `initializeSchema()`.

### 3. Environment variables

Create a `.env` file in the project root, for example:

```bash
PORT=3000

# MySQL
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=your_db_password
DB_NAME=task_reminders

# SMTP
SMTP_HOST=smtp.your-email-provider.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your_smtp_username
SMTP_PASS=your_smtp_password
SMTP_FROM="Task Reminders <no-reply@example.com>"

# Reminder check schedule (cron expression, default is every minute)
REMINDER_CRON=*/1 * * * *

# Session secret
SESSION_SECRET=change_me_for_production
```

### 4. Run the app

```bash
npm start
```

Then open `http://localhost:3000` in your browser.

### 5. Usage

- **Create tasks** from the form on the dashboard.
- **View all tasks** in the table, including their priority, trigger time, recipients, and whether the reminder email has been sent.
- The **scheduler** runs at the interval specified by `REMINDER_CRON`, finds tasks with `trigger_at <= NOW()` and `is_reminded = 0`, sends emails, and marks them as reminded.

### 6. Production deployment checklist

- **Environment variables**
  - Set strong values for `SESSION_SECRET`, DB password, and SMTP credentials.
  - Use a production MySQL instance (managed service or your own server).
  - Point `DB_HOST` to the production DB host.
- **Security**
  - Serve the app behind HTTPS (e.g. with Nginx/Traefik or a cloud load balancer).
  - Restrict MySQL and SMTP access to trusted networks only.
  - Rotate SMTP and DB credentials regularly.
- **App runtime**
  - Run with `NODE_ENV=production`.
  - Use a process manager (e.g. `pm2`) or a container orchestration platform (Docker/Kubernetes) for restarts and health checks.
- **Email**
  - Ensure your SMTP provider is configured for production (SPF/DKIM/DMARC) so reminder emails don’t land in spam.
- **Backups & monitoring**
  - Enable regular backups for the `task_reminders` database.
  - Add basic monitoring/alerts for app errors and DB health.

### 7. Docker build & run

A simple `Dockerfile` is included to run the app in a container.

#### Build

```bash
docker build -t future-task-reminders .
```

#### Run (with external MySQL)

```bash
docker run -d \
  --name future-task-reminders \
  -p 3000:3000 \
  -e NODE_ENV=production \
  -e PORT=3000 \
  -e DB_HOST=your-mysql-host \
  -e DB_PORT=3306 \
  -e DB_USER=your_db_user \
  -e DB_PASSWORD=your_db_password \
  -e DB_NAME=task_reminders \
  -e SMTP_HOST=smtp.your-email-provider.com \
  -e SMTP_PORT=587 \
  -e SMTP_SECURE=false \
  -e SMTP_USER=your_smtp_username \
  -e SMTP_PASS=your_smtp_password \
  -e SMTP_FROM="Task Reminders <no-reply@example.com>" \
  -e REMINDER_CRON="*/1 * * * *" \
  -e SESSION_SECRET="your_strong_random_secret" \
  future-task-reminders
```

Then access the app at `http://localhost:3000`.
