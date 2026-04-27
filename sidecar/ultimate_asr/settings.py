"""Thread-safe JSON settings store; ports whisperLocal/config/settings.py and adds ultimateASR keys."""
from __future__ import annotations
import json, logging, threading
from pathlib import Path

logger = logging.getLogger(__name__)

DEFAULT_SETTINGS: dict = {
    # Engine selection
    "engine_kind": "auto",            # auto | whisper-local | parakeet-local | cloud-openai
    "model_size": "ggml-base.bin",
    "compute_backend": "auto",        # auto | cuda | metal | vulkan | coreml | cpu

    # Audio
    "audio_device_index": None,
    "audio_device_name": None,
    "vad_aggressiveness": 1,
    "padding_duration_ms": 1000,
    "recording_mode": "silence",
    "break_length": 5,

    # Hotkey + paste
    "hotkey": "Ctrl+Alt+Shift+L",
    "auto_paste": False,

    # Vocabulary
    "custom_vocabulary": [],

    # Cloud
    "cloud_api_key": "",              # OpenAI Whisper API key
    "cloud_model": "whisper-1",

    # LLM cleanup
    "llm_enabled": False,
    "llm_provider": "openai",         # openai | anthropic | ollama | llamacpp
    "llm_model": "gpt-4o-mini",
    "llm_api_key": "",
    "llm_endpoint": "",
    "llm_system_prompt": (
        "Clean up this dictation transcript. Fix obvious recognition errors, "
        "remove filler words ('um', 'uh'), preserve meaning, do not add new content."
    ),

    # History
    "transcripts": [],

    # First-run wizard
    "first_run_done": False,
}


def _migrate_model_size(model_size):
    if model_size is None or not isinstance(model_size, str):
        return model_size
    return model_size if model_size.endswith(".bin") else f"ggml-{model_size}.bin"


class SettingsManager:
    def __init__(self, settings_dir: str | Path):
        self._dir = Path(settings_dir)
        self._dir.mkdir(parents=True, exist_ok=True)
        self._file = self._dir / "settings.json"
        self._lock = threading.Lock()
        self._settings = dict(DEFAULT_SETTINGS)
        self._load()

    def _load(self):
        if self._file.exists():
            try:
                self._settings.update(json.loads(self._file.read_text()))
            except Exception:
                logger.exception("Failed to load %s", self._file)
        self._migrate()

    def _migrate(self):
        m = self._settings.get("model_size")
        if m:
            new_m = _migrate_model_size(m)
            if new_m != m:
                self._settings["model_size"] = new_m

    def get(self, key, default=None):
        with self._lock:
            return self._settings.get(key, default)

    def set(self, key, value):
        with self._lock:
            self._settings[key] = value

    def get_all(self):
        with self._lock:
            return dict(self._settings)

    def save(self):
        with self._lock:
            tmp = self._file.with_suffix(".json.tmp")
            tmp.write_text(json.dumps(self._settings, indent=2))
            tmp.replace(self._file)
