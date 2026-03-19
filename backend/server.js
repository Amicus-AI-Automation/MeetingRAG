require("dotenv").config();
const express = require("express");
const cors = require("cors");
const path = require("path");
const connectDB = require("./config/database");

// Connect to MongoDB, then run one-time migration of existing JSON records
connectDB().then(() => {
  require("./scripts/migrateJsonToMongo").run().catch(() => {});
});

// Import routes
const meetingRoutes = require("./routes/meeting");

// Initialize Express app
const app = express();
const PORT = process.env.PORT || 5000;

// Middleware — raise body limits so large file metadata doesn't cause connection resets
app.use(express.json({ limit: "100mb" }));
app.use(express.urlencoded({ extended: true, limit: "100mb" }));
app.use(
  cors({
    origin: process.env.CORS_ORIGIN || "http://localhost:3000",
    credentials: true,
  })
);

// Health check endpoint
app.get("/health", (req, res) => {
  res.status(200).json({
    message: "Server is running",
    status: "✅ MeetingRAG Backend Ready",
    storage: "JSON files in backend/data + MongoDB",
    python_api: process.env.PYTHON_API_URL || "http://localhost:8001",
    timestamp: new Date(),
  });
});

// Routes
app.use("/", meetingRoutes);

// Serve uploaded files
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// Error handling middleware
app.use((err, req, res, next) => {
  console.error("Error:", err);

  if (err.code === "LIMIT_FILE_SIZE") {
    return res.status(400).json({ message: "File size exceeds maximum limit of 500MB" });
  }

  const multer = require("multer");
  if (err instanceof multer.MulterError) {
    return res.status(400).json({ message: "File upload error: " + err.message });
  }

  res.status(500).json({
    message: err.message || "Internal server error",
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ message: "Endpoint not found" });
});

// Start server
app.listen(PORT, () => {
  console.log(`\n${"=".repeat(60)}`);
  console.log(`🚀 Node.js Server  → http://localhost:${PORT}`);
  console.log(`🐍 Python API      → ${process.env.PYTHON_API_URL || "http://localhost:8001"}`);
  console.log(`📁 Uploads         : ./uploads`);
  console.log(`📊 Storage         : JSON + MongoDB`);
  console.log(`${"=".repeat(60)}\n`);
});

module.exports = app;
