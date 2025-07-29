const cloudinary = require('cloudinary').v2;

cloudinary.config({
  cloud_name: 'dtdfmnfr1',
  api_key: '417269152263274',
  api_secret: 's3SpVKlxV-rvK9XmGLhJKNWD0iE',
});

module.exports = cloudinary;
