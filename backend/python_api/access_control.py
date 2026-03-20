import json
from pathlib import Path
from typing import Tuple, Dict

def check_access(meeting_id: str, user_email: str, metadata_dir: Path) -> Tuple[bool, str, Dict]:
    meta_path = metadata_dir / f"{meeting_id}.json"
    if not meta_path.exists():
        return False, "you are not allowed to know about this meeting", {}

    with open(meta_path, "r", encoding="utf-8") as f:
        metadata = json.load(f)

    allowed_users = metadata.get("access_control", {}).get("allowed_users", [])
    uploaded_by = metadata.get("ingestion_info", {}).get("uploaded_by", "")
    participants = [p.get("name", "") for p in metadata.get("participants", [])] + [p.get("user_id", "") for p in metadata.get("participants", [])]

    has_access = (
        user_email in allowed_users
        or user_email == uploaded_by
        or user_email in participants
    )

    if not has_access:
        return False, "you are not allowed to know about this meeting", metadata
        
    return True, "", metadata
