const cookie = require('cookie');

const SESSION_NAME = 'snapeek_session';

function getSession(req) {
  const cookies = req.headers.cookie ? cookie.parse(req.headers.cookie) : {};
  if (!cookies[SESSION_NAME]) return null;
  try {
    return JSON.parse(cookies[SESSION_NAME]);
  } catch {
    return null;
  }
}

function setSession(res, session) {
  res.setHeader('Set-Cookie', cookie.serialize(
    SESSION_NAME,
    JSON.stringify(session),
    {
      httpOnly: true,
      path: '/',
      maxAge: 60 * 60 * 24 * 3, // 3 days
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
    }
  ));
}

function clearSession(res) {
  res.setHeader('Set-Cookie', cookie.serialize(
    SESSION_NAME,
    '',
    {
      httpOnly: true,
      path: '/',
      maxAge: -1,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
    }
  ));
}

module.exports = { getSession, setSession, clearSession };
