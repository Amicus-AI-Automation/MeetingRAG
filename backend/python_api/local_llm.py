import requests
import json
import os
from pathlib import Path
from dotenv import load_dotenv

# Try to load env if not loaded
env_path = Path(__file__).parent.parent / ".env"
load_dotenv(env_path)

GROQ_API_KEY = os.getenv("GROQ_API_KEY", "")
# In Docker/k8s the Ollama service is reached by its service name, not localhost
OLLAMA_URL = os.getenv("OLLAMA_URL", "http://ollama:11434/api/generate")

def ask_llm(prompt, model="llama-3.3-70b-versatile"):
    """
    Primary LLM using Groq with fallback to local Ollama (phi3:mini).
    Note: Requested model 'openai/gpt-oss-120b' may not be available on Groq,
    defaulting to llama-3.3-70b-versatile for stability.
    """
    # 1. Try Groq First
    if GROQ_API_KEY:
        try:
            from groq import Groq
            client = Groq(api_key=GROQ_API_KEY)
            completion = client.chat.completions.create(
                model=model,
                messages=[{"role": "user", "content": prompt}],
                temperature=0.1,
                max_tokens=8192,
            )
            return completion.choices[0].message.content
        except Exception as e:
            print(f"Groq cloud error: {e}. Falling back to local...")

    # 2. Try Local Ollama as secondary fallback
    # Specifically try phi3:mini as requested by user
    try:
        return _request_ollama(prompt, "phi3:mini")
    except Exception as e:
        print(f"Ollama local error (phi3:mini): {e}")
        try:
            return _request_ollama(prompt, "phi3")
        except:
            raise e

def _request_ollama(prompt, model_name):
    response = requests.post(
        OLLAMA_URL,
        json={
            "model": model_name,
            "prompt": prompt,
            "stream": False
        },
        timeout=300
    )
    response.raise_for_status()
    return response.json().get("response", "")
