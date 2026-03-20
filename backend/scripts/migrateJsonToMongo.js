/**
 * migrateJsonToMongo.js
 * ─────────────────────────────────────────────────────────
 * Reads every JSON record in backend/data/records/ and upserts
 * it into the MongoDB `meetings` collection.
 * Also reads the corresponding metadata file to get the
 * final pipeline_status and chunks_count (which may differ).
 *
 * Safe to run multiple times — uses upsert, never duplicates.
 * Called automatically on server startup (after Mongo connects).
 */

const fs   = require("fs");
const path = require("path");
const MeetingModel = require("../models/Meeting");

const RECORDS_DIR  = path.join(__dirname, "../data/records");
const METADATA_DIR = path.join(__dirname, "../data/metadata");

async function run() {
  if (!fs.existsSync(RECORDS_DIR)) return;

  const files = fs.readdirSync(RECORDS_DIR).filter(f => f.endsWith(".json"));
  if (files.length === 0) return;

  console.log(`\n🔄 MongoDB migration: syncing ${files.length} existing JSON record(s)…`);
  let synced = 0;
  let skipped = 0;

  for (const file of files) {
    try {
      const record = JSON.parse(
        fs.readFileSync(path.join(RECORDS_DIR, file), "utf8")
      );
      const meetingId = record.meeting_id;

      // Read the richer metadata file (has pipeline_status / chunks_count)
      let ingestion_info = record.ingestion_info || {};
      const metaPath = path.join(METADATA_DIR, `${meetingId}.json`);
      if (fs.existsSync(metaPath)) {
        const meta = JSON.parse(fs.readFileSync(metaPath, "utf8"));
        ingestion_info = meta.ingestion_info || ingestion_info;
      }

      await MeetingModel.findOneAndUpdate(
        { meeting_id: meetingId },
        {
          meeting_id:    meetingId,
          source_file:   record.source_file || "",
          access_link:   `http://localhost:3000/meeting/${meetingId}`,
          meeting_info:  record.meeting_info || {},
          participants:  record.participants  || [],
          access_control: record.access_control || { allowed_users: [] },
          ingestion_info,
        },
        { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true }
      );

      console.log(`   ✅ Synced: ${meetingId}`);
      synced++;
    } catch (err) {
      console.warn(`   ⚠️ Skipped ${file}: ${err.message}`);
      skipped++;
    }
  }

  console.log(`🔄 Migration done — ${synced} synced, ${skipped} skipped.\n`);
}

module.exports = { run };
