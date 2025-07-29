
const mongoose = require('mongoose');

const ImageSchema = new mongoose.Schema({
  url: String,
  public_id: String,
  userId: String,
  folder: String,
  description: String,
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Image', ImageSchema);