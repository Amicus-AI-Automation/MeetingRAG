const mongoose = require("mongoose");

const MONGO_URI = process.env.MONGO_URI || "mongodb://localhost:27017/meetingrag";

const connectDB = async () => {
  try {
    await mongoose.connect(MONGO_URI);
    console.log(`✅ MongoDB connected → ${MONGO_URI}`);
  } catch (err) {
    console.error("❌ MongoDB connection failed:", err.message);
    // Do NOT exit process — let the rest of the app still run on file-based storage
  }
  // Always resolve so .then() chain in server.js continues
};

module.exports = connectDB;
