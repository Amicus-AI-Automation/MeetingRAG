const mongoose = require("mongoose");

const MeetingSchema = new mongoose.Schema(
  {
    meeting_id: {
      type: String,
      required: true,
      unique: true,
    },
    source_file: {
      type: String,
      default: "",
    },
    access_link: {
      type: String,
      default: "",
    },
    meeting_info: {
      title: { type: String, default: "" },
      date: { type: Date },
      duration_seconds: { type: Number, default: 0 },
      language: { type: String, default: "en" },
    },
    participants: [
      {
        user_id: { type: String },
        name: { type: String },
      },
    ],
    access_control: {
      allowed_users: [{ type: String }],
    },
    ingestion_info: {
      uploaded_by: { type: String, default: "" },
      uploaded_at: { type: Date },
      pipeline_version: { type: String, default: "" },
      pipeline_status: {
        type: String,
        enum: ["queued", "processing", "done", "error"],
        default: "queued",
      },
      chunks_count: { type: Number, default: 0 },
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Meeting", MeetingSchema);
