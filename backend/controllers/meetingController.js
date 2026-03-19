const fs = require("fs");
const path = require("path");
const axios = require("axios");
const jsonStorage = require("../services/jsonStorage");
const MeetingModel = require("../models/Meeting");

// Python FastAPI microservice URL
const PYTHON_API_URL = process.env.PYTHON_API_URL || "http://localhost:8001";

// ─────────────────────────────────────────
// UPLOAD MEETING
// ─────────────────────────────────────────
const uploadMeeting = async (req, res) => {
  try {
    const { title, date, durationSeconds, language = "en", participants, allowedUsers } = req.body;
    const email = req.user?.email;
    const file = req.file;

    console.log(`📥 Meeting upload request from: ${email}`);

    // Validate inputs
    if (!title || !title.trim()) {
      if (file) fs.unlinkSync(file.path);
      return res.status(400).json({ message: "Meeting title is required" });
    }

    if (!file) {
      return res.status(400).json({ message: "File is required" });
    }

    if (!date) {
      if (file) fs.unlinkSync(file.path);
      return res.status(400).json({ message: "Meeting date is required" });
    }

    if (!durationSeconds || durationSeconds <= 0) {
      if (file) fs.unlinkSync(file.path);
      return res.status(400).json({ message: "Duration in seconds is required and must be positive" });
    }

    // Validate file type
    const allowedMimeTypes = ["video/mp4", "audio/wav", "audio/mpeg", "video/quicktime", "video/x-msvideo"];
    if (!allowedMimeTypes.includes(file.mimetype)) {
      fs.unlinkSync(file.path);
      return res.status(400).json({ message: "Invalid file type. Only MP4, WAV, and MP3 are allowed" });
    }

    // Parse participants array
    let participantsArray = [];
    try {
      participantsArray = typeof participants === "string" ? JSON.parse(participants) : participants || [];
      if (Array.isArray(participantsArray)) {
        participantsArray = participantsArray.filter(p => p.user_id && p.name);
      } else {
        participantsArray = [];
      }
    } catch (err) {
      fs.unlinkSync(file.path);
      return res.status(400).json({ message: "Invalid participants format. Expected array of {user_id, name}" });
    }

    // Parse allowed users array
    let allowedUsersList = [];
    try {
      allowedUsersList = typeof allowedUsers === "string" ? JSON.parse(allowedUsers) : allowedUsers || [];
      if (!Array.isArray(allowedUsersList)) allowedUsersList = [];
    } catch (err) {
      allowedUsersList = [];
    }

    // Build full absolute path to uploaded file
    const absoluteFilePath = path.resolve(file.path);

    // Create meeting document
    const meeting = jsonStorage.saveMeeting({
      source_file: file.originalname,
      file_path: absoluteFilePath,
      meeting_info: {
        title: title.trim(),
        date: new Date(date).toISOString(),
        duration_seconds: parseInt(durationSeconds),
        language: language || "en",
      },
      participants: participantsArray,
      access_control: {
        allowed_users: allowedUsersList.length > 0 ? allowedUsersList : [email],
      },
      ingestion_info: {
        uploaded_by: email,
        uploaded_at: new Date().toISOString(),
        pipeline_version: "v2_whisper_chroma",
        pipeline_status: "queued",
      },
    });

    console.log(`✅ Meeting record saved: ${meeting.meeting_id}`);

    // ── Mirror meeting to MongoDB (fire-and-forget) ──
    MeetingModel.findOneAndUpdate(
      { meeting_id: meeting.meeting_id },
      {
        meeting_id: meeting.meeting_id,
        source_file: meeting.source_file,
        access_link: `${process.env.FRONTEND_URL || "http://localhost:3000"}/meeting/${meeting.meeting_id}`,
        meeting_info: meeting.meeting_info,
        participants: meeting.participants,
        access_control: meeting.access_control,
        ingestion_info: meeting.ingestion_info,
      },
      { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true }
    ).catch((err) => console.warn("⚠️ MongoDB meeting upsert failed:", err.message));

    // Respond immediately so the user isn't waiting
    res.status(201).json({
      message: "Meeting uploaded successfully. Transcription is processing in the background.",
      success: true,
      meeting: {
        meeting_id: meeting.meeting_id,
        source_file: meeting.source_file,
        file_path: meeting.file_path,
        meeting_info: meeting.meeting_info,
        participants: meeting.participants,
        access_control: meeting.access_control,
        ingestion_info: meeting.ingestion_info,
        created_at: meeting.createdAt,
      },
    });

    // ── Trigger Python pipeline (fire-and-forget) ──
    triggerPipeline(meeting).catch(err => {
      console.error(`❌ Failed to trigger pipeline for ${meeting.meeting_id}:`, err.message);
    });

  } catch (error) {
    if (req.file) {
      try { fs.unlinkSync(req.file.path); } catch (e) {}
    }
    console.error("Upload meeting error:", error);
    res.status(500).json({ message: "Failed to upload meeting", error: error.message });
  }
};


// ─────────────────────────────────────────
// Fire pipeline on Python API
// ─────────────────────────────────────────
async function triggerPipeline(meeting) {
  const payload = {
    meeting_id: meeting.meeting_id,
    file_path: meeting.file_path,
    metadata: {
      meeting_id: meeting.meeting_id,
      source_file: meeting.source_file,
      access_link: `${process.env.FRONTEND_URL || "http://localhost:3000"}/meeting/${meeting.meeting_id}`,
      meeting_info: meeting.meeting_info,
      participants: meeting.participants,
      access_control: meeting.access_control,
      ingestion_info: meeting.ingestion_info,
    },
  };

  console.log(`🐍 Triggering Python pipeline for ${meeting.meeting_id} …`);
  const response = await axios.post(`${PYTHON_API_URL}/process`, payload, { timeout: 10000 });
  console.log(`🐍 Python API response:`, response.data);
}


// ─────────────────────────────────────────
// QUERY MEETING (RAG)
// ─────────────────────────────────────────
const queryMeeting = async (req, res) => {
  try {
    const email = req.user?.email;
    const { query, meeting_id } = req.body;

    console.log(`🔍 Query from: ${email} | meeting: ${meeting_id} | query: "${query}"`);

    if (!query || !query.trim()) {
      return res.status(400).json({ message: "Query is required" });
    }

    if (!meeting_id) {
      return res.status(400).json({ message: "meeting_id is required" });
    }

    // Forward to Python RAG service
    let pythonRes;
    try {
      pythonRes = await axios.post(
        `${PYTHON_API_URL}/chat`,
        { meeting_id, query: query.trim(), user_email: email },
        { timeout: 300000 } // Allow 5 minutes for local Ollama execution
      );
    } catch (err) {
      if (err.response?.status === 403) {
        return res.status(403).json({
          message: err.response.data.detail || "you are not allowed to know about this meeting",
          success: false,
        });
      }
      if (err.response?.status === 202) {
        return res.status(202).json({
          message: err.response.data.detail || "Meeting is still being processed, please wait",
          success: false,
        });
      }
      // Python service down
      console.error("Python API error:", err.message);
      return res.status(503).json({
        message: "AI processing service is unavailable. Please ensure the Python API is running.",
        success: false,
      });
    }

    const data = pythonRes.data;
    res.status(200).json({
      success: true,
      answer: data.answer,
      sources: data.sources || [],
      meeting_id: data.meeting_id,
      meeting_title: data.meeting_title,
    });

  } catch (error) {
    console.error("Query meeting error:", error);
    res.status(500).json({ message: "Failed to process query", error: error.message });
  }
};


// ─────────────────────────────────────────
// GET MEETINGS (list for user)
// ─────────────────────────────────────────
const getMeetings = async (req, res) => {
  try {
    const email = req.user?.email;
    console.log(`📊 Get meetings request from: ${email}`);

    const meetings = jsonStorage.getMeetingsByUser(email);

    res.status(200).json({
      success: true,
      count: meetings.length,
      meetings: meetings.map(m => ({
        meeting_id: m.meeting_id,
        source_file: m.source_file,
        title: m.meeting_info.title,
        date: m.meeting_info.date,
        duration_seconds: m.meeting_info.duration_seconds,
        participants_count: m.participants.length,
        uploaded_by: m.ingestion_info.uploaded_by,
        uploaded_at: m.ingestion_info.uploaded_at,
        pipeline_status: m.ingestion_info.pipeline_status || "unknown",
        created_at: m.createdAt,
        is_allowed: m.is_allowed,
        can_delete: m.can_delete,
      })),
    });
  } catch (error) {
    console.error("Get meetings error:", error);
    res.status(500).json({ message: "Failed to fetch meetings", error: error.message });
  }
};


// ─────────────────────────────────────────
// GET PIPELINE STATUS
// ─────────────────────────────────────────
const getPipelineStatus = async (req, res) => {
  try {
    const { meeting_id } = req.params;
    const email = req.user?.email;

    // Check user has access to this meeting
    const meeting = jsonStorage.getMeetingById(meeting_id);
    if (!meeting) {
      return res.status(404).json({ message: "Meeting not found" });
    }

    const isAllowed =
      meeting.access_control?.allowed_users?.includes(email) ||
      meeting.ingestion_info?.uploaded_by === email ||
      meeting.participants?.some(p => p.name === email || p.user_id === email);

    if (!isAllowed) {
      return res.status(403).json({ message: "you are not allowed to know about this meeting" });
    }

    // Ask Python API for status
    try {
      const statusRes = await axios.get(`${PYTHON_API_URL}/status/${meeting_id}`, { timeout: 5000 });
      return res.status(200).json(statusRes.data);
    } catch (err) {
      // Fallback to JSON file status
      return res.status(200).json({
        meeting_id,
        status: meeting.ingestion_info?.pipeline_status || "unknown",
        message: "Python service unavailable",
      });
    }
  } catch (error) {
    console.error("Pipeline status error:", error);
    res.status(500).json({ message: "Failed to get status", error: error.message });
  }
};


// ─────────────────────────────────────────
// DELETE MEETING
// ─────────────────────────────────────────
const deleteMeeting = async (req, res) => {
  try {
    const { meeting_id } = req.params;
    const email = req.user?.email;

    const meeting = jsonStorage.getMeetingById(meeting_id);
    if (!meeting) {
      return res.status(404).json({ message: "Meeting not found" });
    }

    const isUploader = meeting.ingestion_info?.uploaded_by === email;

    if (!isUploader) {
      return res.status(403).json({ message: "you are not the admin of this meeting so you are not allowed to delete this meeting" });
    }

    // Call Python API to cancel job (best-effort)
    try {
      await axios.post(`${PYTHON_API_URL}/cancel/${meeting_id}`, {}, { timeout: 2000 });
    } catch (e) {
      // Python API might not have this endpoint yet, ignore
    }

    jsonStorage.deleteMeeting(meeting_id);
    res.status(200).json({ success: true, message: "Meeting deleted successfully" });
  } catch (error) {
    console.error("Delete meeting error:", error);
    res.status(500).json({ message: "Failed to delete meeting", error: error.message });
  }
};


module.exports = {
  uploadMeeting,
  queryMeeting,
  getMeetings,
  getPipelineStatus,
  deleteMeeting,
};
