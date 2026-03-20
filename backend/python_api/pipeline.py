import json
from pathlib import Path
from config import TRANSCRIPTS_DIR, METADATA_DIR
from audio import extract_audio_from_video, load_audio
from transcription import transcribe_audio, chunk_segments
from vector_db import embed_and_store

job_status: dict = {}

def run_pipeline(meeting_id: str, file_path: str, metadata: dict):
    try:
        job_status[meeting_id] = {"status": "processing", "message": "Extracting audio…"}
        print(f"\n{'='*50}")
        print(f"🚀 Starting pipeline for {meeting_id}")

        file_ext = Path(file_path).suffix.lower()
        wav_path = str(TRANSCRIPTS_DIR / f"{meeting_id}.wav")

        if file_ext in [".mp4", ".mov", ".avi", ".mkv"]:
            job_status[meeting_id]["message"] = "Extracting audio from video…"
            audio_path = extract_audio_from_video(file_path, wav_path)
        else:
            audio_path = file_path

        job_status[meeting_id]["message"] = "Loading audio…"
        try:
            audio = load_audio(audio_path)
        except Exception as e:
            raise RuntimeError(f"Could not load audio: {e}")

        job_status[meeting_id]["message"] = "Transcribing with Whisper (this may take a while)…"
        segments = transcribe_audio(audio)
        print(f"📝 Transcribed {len(segments)} segments")

        job_status[meeting_id]["message"] = "Chunking transcript…"
        chunks = chunk_segments(segments, metadata)
        print(f"📦 Created {len(chunks)} chunks")

        transcript_path = TRANSCRIPTS_DIR / f"{meeting_id}.json"
        with open(transcript_path, "w", encoding="utf-8") as f:
            json.dump(chunks, f, indent=2)
        print(f"💾 Transcript saved → {transcript_path}")

        job_status[meeting_id]["message"] = "Generating embeddings & storing in ChromaDB…"
        if chunks:
            embed_and_store(chunks, meeting_id)

        meta_path = METADATA_DIR / f"{meeting_id}.json"
        if meta_path.exists():
            with open(meta_path, "r", encoding="utf-8") as f:
                saved_meta = json.load(f)
            saved_meta["ingestion_info"]["pipeline_status"] = "done"
            saved_meta["ingestion_info"]["chunks_count"] = len(chunks)
            with open(meta_path, "w", encoding="utf-8") as f:
                json.dump(saved_meta, f, indent=2)

            # ── Sync pipeline result to MongoDB (best-effort) ──
            try:
                import pymongo, os
                mongo_uri = os.environ.get("MONGO_URI", "mongodb://localhost:27017/meetingrag")
                client = pymongo.MongoClient(mongo_uri, serverSelectionTimeoutMS=2000)
                db = client.get_default_database()
                db["meetings"].update_one(
                    {"meeting_id": meeting_id},
                    {"$set": {
                        "ingestion_info.pipeline_status": "done",
                        "ingestion_info.chunks_count": len(chunks),
                    }},
                )
                client.close()
                print(f"📊 MongoDB meeting status updated → done")
            except Exception as mongo_err:
                print(f"⚠️ MongoDB pipeline sync skipped: {mongo_err}")

        job_status[meeting_id] = {"status": "done", "message": f"Pipeline complete. {len(chunks)} chunks indexed."}
        print(f"🎉 Pipeline done for {meeting_id}")

    except Exception as e:
        import traceback
        traceback.print_exc()
        job_status[meeting_id] = {"status": "error", "message": str(e)}
        print(f"❌ Pipeline error for {meeting_id}: {e}")
