const express = require('express');
const path = require('path');
const dotenv = require('dotenv');
const exphbs = require('express-handlebars');
const session = require('express-session');

dotenv.config();

const { initializeSchema } = require('./tasks/model');
const { initializeUserSchema } = require('./users/model');
const { startReminderScheduler } = require('./tasks/reminderScheduler');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'public')));

// Session
const SESSION_SECRET = process.env.SESSION_SECRET || 'change_this_dev_secret';
if (!process.env.SESSION_SECRET) {
  console.warn(
    'SESSION_SECRET is not set. Using a default value for development only.'
  );
}
app.use(
  session({
    secret: SESSION_SECRET,
    resave: false,
    saveUninitialized: false
  })
);

// Expose current user to views
app.use((req, res, next) => {
  res.locals.currentUserId = req.session.userId || null;
  res.locals.currentUserName = req.session.username || null;
  res.locals.currentUserEmail = req.session.email || null;
  next();
});

// View engine
app.engine(
  'hbs',
  exphbs.engine({
    extname: '.hbs',
    defaultLayout: 'main',
    layoutsDir: path.join(__dirname, 'views', 'layouts'),
    helpers: {
      eq: (a, b) => a === b
    }
  })
);
app.set('view engine', 'hbs');
app.set('views', path.join(__dirname, 'views'));

// Routes
const authRoutes = require('./users/routes');
const taskRoutes = require('./tasks/routes');

app.use('/auth', authRoutes);
app.use('/', taskRoutes);

// 404 handler
app.use((req, res) => {
  res.status(404).render('404', { title: 'Not Found' });
});

// Initialize DB schema and start server + reminder scheduler
Promise.all([initializeUserSchema(), initializeSchema()])
  .then(() => {
    console.log('Database schema is ready.');
    startReminderScheduler();

    app.listen(PORT, () => {
      console.log(`Task reminder app listening on port ${PORT}`);
    });
  })
  .catch((err) => {
    console.error('Failed to initialize database schema:', err);
    process.exit(1);
  });

