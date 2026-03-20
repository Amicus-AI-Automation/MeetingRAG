import json
import os
import sys
from fastapi import FastAPI, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from pathlib import Path

# Add parent scripts dir to path
SCRIPTS_DIR = Path(__file__).parent.parent / "scripts"
sys.path.insert(0, str(SCRIPTS_DIR))

# Import local modules
from config import METADATA_DIR
from schemas import ProcessRequest, ChatRequest
from pipeline import run_pipeline, job_status
from access_control import check_access
from retrieval import retrieve_and_answer

# App
app = FastAPI(title="MeetingRAG Python API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health():
    return {"status": "ok", "service": "MeetingRAG Python API"}


@app.post("/process")
def process_meeting(req: ProcessRequest, background_tasks: BackgroundTasks):
    """
    Triggered by Node.js after a meeting file is uploaded.
    Runs transcription + embedding in the background.
    """
    meeting_id = req.meeting_id

    # Save metadata for Python chat.py
    meta_path = METADATA_DIR / f"{meeting_id}.json"
    with open(meta_path, "w", encoding="utf-8") as f:
        json.dump(req.metadata, f, indent=2)
    print(f"📋 Metadata saved → {meta_path}")

    job_status[meeting_id] = {"status": "queued", "message": "Job queued, starting soon…"}
    background_tasks.add_task(run_pipeline, meeting_id, req.file_path, req.metadata)

    return {"meeting_id": meeting_id, "status": "queued", "message": "Processing started in background"}


@app.post("/cancel/{meeting_id}")
def cancel_processing(meeting_id: str):
    """Cancel a running pipeline job (best-effort)."""
    if meeting_id in job_status:
        job_status[meeting_id] = {"status": "error", "message": "Cancelled by user"}
        return {"meeting_id": meeting_id, "status": "cancelled"}
    return {"meeting_id": meeting_id, "status": "not_running"}


@app.get("/status/{meeting_id}")
def get_status(meeting_id: str):
    """Poll the processing status of a meeting."""
    status = job_status.get(meeting_id, {"status": "unknown", "message": "No job found"})
    return {"meeting_id": meeting_id, **status}


@app.post("/chat")
def chat_meeting(req: ChatRequest):
    """
    RAG query endpoint with access control.
    Returns answer + sources with timestamps.
    """
    meeting_id = req.meeting_id
    user_email = req.user_email
    query = req.query.strip()

    if not query:
        raise HTTPException(status_code=400, detail="Query cannot be empty")

    # 1. Access Control
    has_access, error_msg, metadata = check_access(meeting_id, user_email, METADATA_DIR)
    
    if not has_access:
        raise HTTPException(status_code=403, detail=error_msg)

    # 2. Check pipeline status
    pipeline_status = metadata.get("ingestion_info", {}).get("pipeline_status", "")
    current_job = job_status.get(meeting_id, {})
    if pipeline_status != "done" and current_job.get("status") not in ["done", ""]:
        raise HTTPException(
            status_code=202,
            detail=f"Meeting is still being processed: {current_job.get('message', 'please wait')}"
        )

    # 3. Retrieval and generation
    try:
        response = retrieve_and_answer(query, meeting_id, metadata)
        return response
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("python_api.main:app", host="0.0.0.0", port=8001, reload=False)
