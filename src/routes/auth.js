const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { getSession, clearSession } = require('../lib/session'); // or your session logic

// POST /auth/login
router.post('/login', authController.login);

// GET /auth/me
router.get('/me', (req, res) => {
  // Example: check for session cookie
  const session = req.cookies['snapeek_session'];
  if (!session) return res.status(401).json({ error: 'Not logged in' });
  try {
    const user = JSON.parse(session);
    res.json({ user });
  } catch {
    res.status(401).json({ error: 'Invalid session' });
  }
});

// POST /auth/logout
router.post('/logout', (req, res) => {
  clearSession(res);
  res.json({ success: true });
});

module.exports = router;
