const cloudinary = require('../config/cloudinary');
const downloadImage = require('./downloadImage');
const { saveDescription } = require('./fileUtils');
const path = require('path');
const fs = require('fs');
const mongoose = require('mongoose');
const Image = require('../models/Image');
const connectDB = require('../config/db');
const os = require('os');

const IMAGES_DIR = path.join(os.homedir(), 'Desktop', 'SnapeekImages');

async function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
    console.log('Created directory:', dir);
  }
}

async function downloadAllCloudinaryImages(userEmail) {
  let shouldClose = false;
  if (mongoose.connection.readyState === 0) {
    await connectDB();
    shouldClose = true;
    console.log('Connected to MongoDB for image download.');
  } else {
    console.log('Reusing existing MongoDB connection.');
  }
  await ensureDir(IMAGES_DIR);
  let downloaded = 0;
  let skipped = 0;
  let errors = [];
  let images;
  if (userEmail) {
    images = await Image.find({ userId: userEmail });
  } else {
    images = await Image.find({});
  }
  console.log('Found images in DB:', images.length);
  for (const img of images) {
    const safeUser = img.userId.replace(/[@.]/g, '_');
    const category = img.folder || 'Uncategorized';
    const userDir = path.join(IMAGES_DIR, safeUser);
    const categoryDir = path.join(userDir, category);
    await ensureDir(userDir);
    await ensureDir(categoryDir);

    const filename = `snapeek_${safeUser}_${category}_${img._id}.png`;
    const imgPath = path.join(categoryDir, filename);
    const descPath = path.join(categoryDir, filename.replace(/\.png$/, '.txt'));
    const desc = img.description || '';

    console.log('Checking for image:', imgPath, 'Exists:', fs.existsSync(imgPath));

    // Uncomment to skip already downloaded images
    // if (fs.existsSync(imgPath)) {
    //   skipped++;
    //   continue;
    // }
    try {
      await downloadImage(img.url, imgPath);
      fs.writeFileSync(descPath, desc, 'utf8');
      downloaded++;
      console.log('Downloaded:', imgPath);
    } catch (err) {
      errors.push({ url: img.url, error: err.message });
      console.error('Failed to download:', img.url, err.message);
    }
  }
  if (shouldClose) {
    mongoose.connection.close();
    console.log('Closed MongoDB connection after image download.');
  }
  return { downloaded, skipped, errors, total: images.length };
}

if (require.main === module) {
  downloadAllCloudinaryImages().then(result => {
    console.log('Download summary:', result);
  });
}

module.exports = downloadAllCloudinaryImages; 