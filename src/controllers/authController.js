const User = require('../models/User');
const { setSession } = require('../lib/session');
const connectDB = require('../config/db');

exports.login = async (req, res) => {
  const { email, password, rememberMe } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'All fields required' });
  }
  try {
    await connectDB();
  } catch (err) {
    return res.status(503).json({ error: 'Cannot connect to database. Please check your internet connection.' });
  }
  try {
    const user = await User.findOne({ email });
    if (!user || user.password !== password) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    // Set session cookie
    const maxAge = rememberMe ? 60 * 60 * 24 * 30 : undefined; // 30 days or session
    setSession(res, { email: user.email, username: user.username }, maxAge);
    return res.status(200).json({ message: 'Login successful', user: { email: user.email, username: user.username } });
  } catch (err) {
    return res.status(500).json({ error: 'Server error' });
  }
};
