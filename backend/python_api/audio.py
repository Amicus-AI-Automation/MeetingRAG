import numpy as np
import soundfile as sf
from typing import Optional

def extract_audio_from_video(video_path: str, out_wav: str) -> str:
    """Extract audio from video using ffmpeg (if installed), or try direct load."""
    try:
        import subprocess
        result = subprocess.run(
            [
                "ffmpeg", "-y",
                "-i", video_path,
                "-vn",
                "-acodec", "pcm_s16le",
                "-ar", "16000",
                "-ac", "1",
                out_wav
            ],
            capture_output=True, text=True, timeout=300
        )
        if result.returncode == 0:
            return out_wav
    except FileNotFoundError:
        print("ffmpeg not found - trying direct audio load")
    except Exception as e:
        print(f"ffmpeg error: {e}")

    # fallback: try soundfile directly
    return video_path

def load_audio(file_path: str, target_sr: int = 16000) -> np.ndarray:
    audio, sr = sf.read(file_path)
    if len(audio.shape) > 1:
        audio = np.mean(audio, axis=1)
    if sr != target_sr:
        from scipy.signal import resample_poly
        from math import gcd
        g = gcd(int(sr), int(target_sr))
        audio = resample_poly(audio, int(target_sr) // g, int(sr) // g)
    return audio
