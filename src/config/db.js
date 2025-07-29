const mongoose = require('mongoose');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://crosseye315:2Fp2ORwhwuGftlbq@cluster0.xsddsh6.mongodb.net/';

const connectDB = async () => {
  try {
    await mongoose.connect(MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('MongoDB connected');
  } catch (err) {
    console.error('MongoDB connection error:', err);
    // process.exit(1); // Remove this so server doesn't crash
    throw err; // Let the caller handle the error
  }
};

module.exports = connectDB;
