const fs = require("fs");
const path = require("path");
const { v4: uuidv4 } = require("uuid");

// ─────────────────────────────────────────
// Directories
// ─────────────────────────────────────────
// ─────────────────────────────────────────
// Directories
// ─────────────────────────────────────────
// Node.js backend/data/records — meeting JSON records
const DATA_DIR = path.join(__dirname, "../data/records");
// backend/data/metadata — shared with Python pipeline
const METADATA_DIR = path.join(__dirname, "../data/metadata");

// Ensure directories exist
[DATA_DIR, METADATA_DIR].forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

// ─────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────
const generateMeetingId = () => {
  const timestamp = Date.now().toString().slice(-6);
  const random = Math.random().toString(36).substring(2, 7).toUpperCase();
  return `ES${timestamp}${random}`;
};

// ─────────────────────────────────────────
// Save meeting
// ─────────────────────────────────────────
const saveMeeting = (meetingData) => {
  try {
    const meetingId = generateMeetingId();
    const meetingPath = path.join(DATA_DIR, `${meetingId}.json`);

    const meeting = {
      meeting_id: meetingId,
      source_file: meetingData.source_file,
      file_path: meetingData.file_path,
      meeting_info: meetingData.meeting_info,
      participants: meetingData.participants,
      access_control: meetingData.access_control,
      ingestion_info: meetingData.ingestion_info,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    // 1. Save to backend/data/{meetingId}.json (Node storage)
    fs.writeFileSync(meetingPath, JSON.stringify(meeting, null, 2));
    console.log(`💾 Meeting record saved: ${meetingPath}`);

    // 2. Save to data/metadata/{meetingId}.json (Python pipeline reads this)
    const metaPath = path.join(METADATA_DIR, `${meetingId}.json`);
    const pythonMeta = {
      meeting_id: meetingId,
      source_file: meetingData.source_file,
      access_link: `http://localhost:3000/meeting/${meetingId}`,
      meeting_info: meetingData.meeting_info,
      participants: meetingData.participants,
      access_control: meetingData.access_control,
      ingestion_info: meetingData.ingestion_info,
    };
    fs.writeFileSync(metaPath, JSON.stringify(pythonMeta, null, 2));
    console.log(`📋 Metadata saved for Python: ${metaPath}`);

    return meeting;
  } catch (err) {
    console.error("Error saving meeting:", err);
    throw err;
  }
};

// ─────────────────────────────────────────
// Get meeting by ID
// ─────────────────────────────────────────
const getMeetingById = (meetingId) => {
  try {
    const filePath = path.join(DATA_DIR, `${meetingId}.json`);
    if (!fs.existsSync(filePath)) return null;
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch (err) {
    console.error("Error getting meeting by ID:", err);
    return null;
  }
};

// ─────────────────────────────────────────
// Get meetings by user
// ─────────────────────────────────────────
const getMeetingsByUser = (userEmail) => {
  try {
    const files = fs.readdirSync(DATA_DIR).filter(f => f.endsWith(".json"));
    const meetings = [];

    files.forEach(file => {
      try {
        const content = fs.readFileSync(path.join(DATA_DIR, file), "utf8");
        const meeting = JSON.parse(content);

        const isInAllowedUsers = meeting.access_control?.allowed_users?.includes(userEmail);
        const isUploader = meeting.ingestion_info?.uploaded_by === userEmail;
        const isParticipant = meeting.participants?.some(p => p.name === userEmail || p.user_id === userEmail);

        // Add the new is_allowed and can_delete flags
        meeting.is_allowed = (isInAllowedUsers || isUploader || isParticipant);
        meeting.can_delete = isUploader; // Only the uploader can delete for now (can expand to admins)
        
        meetings.push(meeting);
      } catch (e) {
        console.warn(`Skipping corrupt file: ${file}`);
      }
    });

    return meetings.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  } catch (err) {
    console.error("Error retrieving meetings:", err);
    throw err;
  }
};

// ─────────────────────────────────────────
// Get all meetings (admin / query use)
// ─────────────────────────────────────────
const getAllMeetings = () => {
  try {
    const files = fs.readdirSync(DATA_DIR).filter(f => f.endsWith(".json"));
    return files.map(file => {
      const content = fs.readFileSync(path.join(DATA_DIR, file), "utf8");
      return JSON.parse(content);
    });
  } catch (err) {
    console.error("Error retrieving all meetings:", err);
    throw err;
  }
};

// ─────────────────────────────────────────
// Delete meeting
// ─────────────────────────────────────────
const deleteMeeting = (meetingId) => {
  try {
    const filePath = path.join(DATA_DIR, `${meetingId}.json`);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      console.log(`🗑️ Meeting deleted: ${meetingId}`);
      return true;
    }
    return false;
  } catch (err) {
    console.error("Error deleting meeting:", err);
    throw err;
  }
};

module.exports = {
  saveMeeting,
  getMeetingById,
  getMeetingsByUser,
  getAllMeetings,
  deleteMeeting,
};
