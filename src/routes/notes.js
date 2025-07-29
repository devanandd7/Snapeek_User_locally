const express = require('express');
const router = express.Router();
const { getSession } = require('../lib/session');
const noteController = require('../controllers/noteController');
const fs = require('fs');
const path = require('path');
const os = require('os');

const NOTES_DIR = path.join(os.homedir(), 'Desktop', 'SnapeekNotes');

// Middleware to check for session
const requireAuth = (req, res, next) => {
  const session = getSession(req);
  if (!session) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  req.user = session;
  next();
};

router.get('/', requireAuth, async (req, res) => {
  try {
    const safeUser = req.user.email.replace(/[@.]/g, '_');
    const userNotesDir = path.join(NOTES_DIR, safeUser);

    if (!fs.existsSync(userNotesDir)) {
      return res.json([]);
    }

    const subjectFolders = fs.readdirSync(userNotesDir).filter(file => {
      return fs.statSync(path.join(userNotesDir, file)).isDirectory();
    });

    const allNotes = [];

    for (const subject of subjectFolders) {
      const subjectDir = path.join(userNotesDir, subject);
      const files = fs.readdirSync(subjectDir);
      const noteFiles = files.filter(file => file.endsWith('.txt'));

      for (const noteFile of noteFiles) {
        const imageId = path.basename(noteFile, '.txt');
        const imageFile = files.find(file => file.startsWith(imageId) && (file.endsWith('.png') || file.endsWith('.jpg') || file.endsWith('.jpeg')));
        
        if (imageFile) {
          const noteContent = fs.readFileSync(path.join(subjectDir, noteFile), 'utf-8');
          allNotes.push({
            subject: subject,
            noteContent: noteContent,
            imageUrl: `/notes/${safeUser}/${subject}/${imageFile}`,
            createdAt: fs.statSync(path.join(subjectDir, noteFile)).ctime,
          });
        }
      }
    }
    res.json(allNotes);
  } catch (error) {
    console.error('Error reading notes from local directory:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/download', requireAuth, noteController.downloadAllNotes);

module.exports = router;
