"""OS-aware data directory resolution for ultimateASR sidecar."""
from __future__ import annotations
import os
import sys
from pathlib import Path

APP_NAME = "ultimateASR"

def data_dir() -> Path:
    if sys.platform == "darwin":
        base = Path.home() / "Library" / "Application Support" / APP_NAME
    elif sys.platform.startswith("win"):
        base = Path(os.environ.get("APPDATA", Path.home())) / APP_NAME
    else:
        base = Path(os.environ.get("XDG_DATA_HOME", Path.home() / ".local" / "share")) / APP_NAME
    base.mkdir(parents=True, exist_ok=True)
    return base

def models_dir() -> Path:
    p = data_dir() / "models"; p.mkdir(parents=True, exist_ok=True); return p

def vad_dir() -> Path:
    p = data_dir() / "vad"; p.mkdir(parents=True, exist_ok=True); return p

def settings_path() -> Path:
    return data_dir() / "settings.json"
