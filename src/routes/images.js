const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const { getSession } = require('../lib/session');
const connectDB = require('../config/db');
const os = require('os');

// Import the automation logic as a function
const downloadAllCloudinaryImages = require('../utils/downloadAllCloudinaryImages');
const Image = require('../models/Image');

const desktopPath = path.join(os.homedir(), 'Desktop', 'SnapeekImages');

// GET /images/download-all
router.get('/download-all', async (req, res) => {
  try {
    const result = await downloadAllCloudinaryImages();
    res.json({ message: 'Download complete', ...result });
  } catch (err) {
    res.status(500).json({ error: err.message || 'Download failed' });
  }
});

// GET /images/list
router.get('/list', (req, res) => {
  const imagesDir = desktopPath;
  if (!fs.existsSync(imagesDir)) return res.json({ images: [] });
  const files = fs.readdirSync(imagesDir);
  const images = files
    .filter(f => /\.(jpg|jpeg|png|gif|webp)$/i.test(f))
    .map(imgFile => {
      const base = imgFile.replace(/\.[^/.]+$/, '');
      const txtFile = base + '.txt';
      let description = '';
      if (files.includes(txtFile)) {
        description = fs.readFileSync(path.join(imagesDir, txtFile), 'utf8');
      }
      return {
        filename: imgFile,
        description,
      };
    });
  res.json({ images });
});

// GET /images/db-list (user-specific)
router.get('/db-list', async (req, res) => {
  const session = getSession(req);
  if (!session || !session.email) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  try {
    const images = await Image.find({ userId: session.email });
    res.json({ images });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// List all categories (folders) in /public/images (user-specific)
router.get('/local-categories', (req, res) => {
  const session = getSession(req);
  if (!session || !session.email) {
    return res.json({ categories: [] });
  }
  const safeUser = session.email.replace(/[@.]/g, '_');
  const userDir = path.join(desktopPath, safeUser);
  if (!fs.existsSync(userDir)) return res.json({ categories: [] });
  const categories = fs.readdirSync(userDir).filter(f => {
    const categoryDir = path.join(userDir, f);
    return fs.statSync(categoryDir).isDirectory();
  });
  res.json({ categories });
});

// List images in a category (user-specific)
router.get('/local-list/:category', (req, res) => {
  const session = getSession(req);
  if (!session || !session.email) {
    return res.json({ images: [] });
  }
  const safeUser = session.email.replace(/[@.]/g, '_');
  const category = req.params.category;
  const categoryDir = path.join(desktopPath, safeUser, category);
  if (!fs.existsSync(categoryDir)) return res.json({ images: [] });
  const files = fs.readdirSync(categoryDir);
  const userKey = safeUser;
  const images = files
    .filter(f => f.includes(userKey) && /\.(jpg|jpeg|png|gif|webp)$/i.test(f))
    .map(imgFile => {
      const base = imgFile.replace(/\.[^/.]+$/, '');
      const txtFile = base + '.txt';
      let description = '';
      if (files.includes(txtFile)) {
        description = fs.readFileSync(path.join(categoryDir, txtFile), 'utf8');
      }
      return {
        filename: imgFile,
        description,
        url: `/images/${safeUser}/${category}/${imgFile}`
      };
    });
  res.json({ images });
});

// POST /images/download-mine
router.post('/download-mine', async (req, res) => {
  const session = getSession(req);
  if (!session || !session.email) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  try {
    const result = await downloadAllCloudinaryImages(session.email);
    res.json({ success: true, result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/folders - List all folders and images for the current user (for offline gallery)
router.get('/api/folders', (req, res) => {
  const session = getSession(req);
  if (!session || !session.email) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  const safeUser = session.email.replace(/[@.]/g, '_');
  const IMAGES_ROOT = path.join(desktopPath, safeUser);
  if (!fs.existsSync(IMAGES_ROOT)) return res.json({});
  const folders = fs.readdirSync(IMAGES_ROOT, { withFileTypes: true });
  const result = {};
  folders.forEach(folder => {
    if (folder.isDirectory()) {
      const folderPath = path.join(IMAGES_ROOT, folder.name);
      const files = fs.readdirSync(folderPath);
      result[folder.name] = files.filter(f => /\.(png|jpg|jpeg|gif)$/i.test(f))
        .map(f => `/images/${safeUser}/${folder.name}/${f}`);
    }
  });
  res.json(result);
});

// POST /images/api/download - Download images from Cloudinary after login
router.post('/api/download', async (req, res) => {
  const session = getSession(req);
  if (!session || !session.email) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  try {
    await connectDB();
  } catch (err) {
    return res.status(503).json({ error: 'Cannot connect to database. Please check your internet connection.' });
  }
  try {
    await downloadAllCloudinaryImages(session.email); // Pass email if needed by util
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
