const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
const os = require('os');
const connectDB = require('../config/db');
const Note = require('../models/Note');
const downloadImage = require('./downloadImage');

const NOTES_DIR = path.join(os.homedir(), 'Desktop', 'SnapeekNotes');

// Helper function to ensure a directory exists
function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

/**
 * Downloads all notes and their associated images for a given user.
 * @param {string} userEmail - The email of the user.
 * @returns {object} - A summary of the download operation.
 */
async function downloadNotes(userEmail) {
  if (!userEmail) {
    throw new Error('User email is required to download notes.');
  }

  // Ensure there is a database connection
  if (mongoose.connection.readyState === 0) {
    await connectDB();
  }

  const notes = await Note.find({ userId: userEmail }).lean();
  if (!notes || notes.length === 0) {
    return { message: 'No notes found for the user.' };
  }

  const safeUser = userEmail.replace(/[@.]/g, '_');
  const userNotesDir = path.join(NOTES_DIR, safeUser);
  ensureDir(userNotesDir);

  let downloadedCount = 0;
  let errorCount = 0;

  for (const note of notes) {
    try {
      const subjectDir = path.join(userNotesDir, (note.subject || 'General').replace(/[^a-zA-Z0-9]/g, '_'));
      ensureDir(subjectDir);

      // Download the associated image
      const imageName = `${note.imageId}.png`;
      const imagePath = path.join(subjectDir, imageName);
      await downloadImage(note.imageUrl, imagePath);

      // Create the text file for the note content
      const notePath = path.join(subjectDir, `${note.imageId}.txt`);
      fs.writeFileSync(notePath, note.noteContent, 'utf-8');

      downloadedCount++;
    } catch (error) {
      console.error(`Failed to download note ${note._id}:`, error);
      errorCount++;
    }
  }

  return {
    totalNotes: notes.length,
    downloaded: downloadedCount,
    errors: errorCount,
    downloadPath: userNotesDir,
  };
}

module.exports = downloadNotes;
