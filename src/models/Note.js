const mongoose = require('mongoose');

const NoteSchema = new mongoose.Schema({
  userId: { type: String, required: true }, // e.g., "dev@gmail.com"
  imageId: { type: mongoose.Schema.Types.ObjectId, required: true },
  imageUrl: { type: String, required: true }, // Cloudinary URL
  noteContent: { type: String, required: true },
  noteType: { type: String, required: true }, // e.g., "study_summary"
  subject: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
  lastModified: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Note', NoteSchema);