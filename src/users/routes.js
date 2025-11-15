const express = require('express');
const bcrypt = require('bcryptjs');

const {
  findUserByEmail,
  findUserById,
  createUser,
  updateLastLogin,
  updateUserAccount
} = require('./model');

const router = express.Router();

function redirectIfAuthenticated(req, res, next) {
  if (req.session && req.session.userId) {
    return res.redirect('/tasks');
  }
  return next();
}

function ensureAuthenticated(req, res, next) {
  if (req.session && req.session.userId) {
    return next();
  }
  return res.redirect('/auth/login');
}

router.get('/register', redirectIfAuthenticated, (req, res) => {
  res.render('users/register', {
    title: 'Register'
  });
});

router.post('/register', redirectIfAuthenticated, async (req, res, next) => {
  try {
    const { username, email, password, confirm_password } = req.body;

    if (!username || !email || !password || !confirm_password) {
      return res.status(400).render('users/register', {
        title: 'Register',
        error: 'Please fill in all required fields.',
        form: { username, email }
      });
    }

    if (password !== confirm_password) {
      return res.status(400).render('users/register', {
        title: 'Register',
        error: 'Password and confirm password do not match.',
        form: { username, email }
      });
    }

    const existing = await findUserByEmail(email);
    if (existing) {
      return res.status(400).render('users/register', {
        title: 'Register',
        error: 'An account with this email already exists.',
        form: { username, email }
      });
    }

    const password_hash = await bcrypt.hash(password, 10);
    const userId = await createUser({ username, email, password_hash });
    await updateLastLogin(userId);

    req.session.userId = userId;
    req.session.username = username;
    req.session.email = email;
    res.redirect('/tasks');
  } catch (err) {
    next(err);
  }
});

router.get('/login', redirectIfAuthenticated, (req, res) => {
  res.render('users/login', {
    title: 'Login'
  });
});

router.post('/login', redirectIfAuthenticated, async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).render('users/login', {
        title: 'Login',
        error: 'Please enter your email and password.',
        form: { email }
      });
    }

    const user = await findUserByEmail(email);
    if (!user) {
      return res.status(400).render('users/login', {
        title: 'Login',
        error: 'Invalid email or password.',
        form: { email }
      });
    }

    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      return res.status(400).render('users/login', {
        title: 'Login',
        error: 'Invalid email or password.',
        form: { email }
      });
    }

    req.session.userId = user.id;
    req.session.username = user.username;
    req.session.email = user.email;
    await updateLastLogin(user.id);

    res.redirect('/tasks');
  } catch (err) {
    next(err);
  }
});

router.get('/profile', ensureAuthenticated, async (req, res, next) => {
  try {
    const user = await findUserById(req.session.userId);
    if (!user) {
      req.session.destroy(() => {});
      return res.redirect('/auth/login');
    }

    res.render('users/profile', {
      title: 'Your Profile',
      form: {
        username: user.username,
        email: user.email
      }
    });
  } catch (err) {
    next(err);
  }
});

router.post('/profile', ensureAuthenticated, async (req, res, next) => {
  try {
    const user = await findUserById(req.session.userId);
    if (!user) {
      req.session.destroy(() => {});
      return res.redirect('/auth/login');
    }

    const {
      username,
      email,
      current_password,
      new_password,
      confirm_new_password
    } = req.body;

    if (!username) {
      return res.status(400).render('users/profile', {
        title: 'Your Profile',
        error: 'Username is required.',
        form: { username, email: user.email }
      });
    }

    let passwordHashToSave = user.password_hash;

    if (new_password || confirm_new_password || current_password) {
      if (!current_password || !new_password || !confirm_new_password) {
        return res.status(400).render('users/profile', {
          title: 'Your Profile',
          error:
            'To change your password, please provide current password, new password, and confirm new password.',
          form: { username, email: user.email }
        });
      }

      const isCurrentMatch = await bcrypt.compare(
        current_password,
        user.password_hash
      );
      if (!isCurrentMatch) {
        return res.status(400).render('users/profile', {
          title: 'Your Profile',
          error: 'Current password is incorrect.',
          form: { username, email: user.email }
        });
      }

      if (new_password !== confirm_new_password) {
        return res.status(400).render('users/profile', {
          title: 'Your Profile',
          error: 'New password and confirm password do not match.',
          form: { username, email: user.email }
        });
      }

      passwordHashToSave = await bcrypt.hash(new_password, 10);
    }

    await updateUserAccount(user.id, {
      username,
      email: user.email,
      password_hash: passwordHashToSave
    });

    req.session.username = username;

    res.render('users/profile', {
      title: 'Your Profile',
      success: 'Profile updated successfully.',
      form: { username, email: user.email }
    });
  } catch (err) {
    next(err);
  }
});

router.post('/logout', async (req, res) => {
  req.session.destroy(() => {
    res.redirect('/auth/login');
  });
});

module.exports = router;


