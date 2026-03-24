import os
from pathlib import Path
from dotenv import load_dotenv

load_dotenv(Path(__file__).parent.parent / ".env")

ROOT_DIR = Path(__file__).parent.parent   # backend/
DATA_DIR = ROOT_DIR / "data"
METADATA_DIR = DATA_DIR / "metadata"
TRANSCRIPTS_DIR = DATA_DIR / "transcripts"

# Allow Docker/k8s to override storage paths via environment variables
CHROMA_PATH = os.getenv("CHROMA_PATH", str(DATA_DIR / "chroma_db"))
UPLOAD_DIR = Path(os.getenv("UPLOAD_DIR", str(ROOT_DIR / "uploads")))

# Node storage (records) is also in DATA_DIR
RECORDS_DIR = DATA_DIR / "records"

for d in [METADATA_DIR, TRANSCRIPTS_DIR, Path(CHROMA_PATH), RECORDS_DIR, UPLOAD_DIR]:
    d.mkdir(parents=True, exist_ok=True)

COLLECTION_NAME = "meeting_transcripts"
EMBED_MODEL_NAME = "sentence-transformers/all-MiniLM-L6-v2"
GROQ_API_KEY = os.getenv("GROQ_API_KEY", "")
OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY", "")
