const downloadNotes = require('../utils/downloadNotes');
const { getSession } = require('../lib/session');

exports.downloadAllNotes = async (req, res) => {
  const session = getSession(req);
  if (!session) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const result = await downloadNotes(session.email);
    res.status(200).json(result);
  } catch (error) {
    console.error('Failed to download notes:', error);
    res.status(500).json({ error: 'Failed to download notes' });
  }
};
