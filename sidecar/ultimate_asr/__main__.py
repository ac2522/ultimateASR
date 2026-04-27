"""Sidecar entry: spawn JSON-RPC dispatcher on stdin/stdout."""
from __future__ import annotations
import base64
import json
import logging
import os
import sys
from pathlib import Path

import numpy as np

from ultimate_asr import hardware
from ultimate_asr import paths
from ultimate_asr.audio.device_manager import DeviceManager
from ultimate_asr.engine.factory import make_engine_kind
from ultimate_asr.engine.model_manager import ModelManager
from ultimate_asr.llm.base import LLMConfig, get_provider
from ultimate_asr.recording_session import SessionManager
from ultimate_asr.rpc import Dispatcher
from ultimate_asr.settings import SettingsManager


def _resolve_data_dir() -> Path:
    override = os.environ.get("ULTIMATEASR_DATA_DIR")
    return Path(override) if override else paths.data_dir()


def main() -> int:
    logging.basicConfig(
        level=logging.INFO,
        stream=sys.stderr,
        format="[sidecar %(asctime)s %(levelname)s] %(message)s",
    )
    data_dir = _resolve_data_dir()
    settings = SettingsManager(data_dir)
    device_manager = DeviceManager()
    model_manager = ModelManager(str(data_dir / "models"))
    sessions = SessionManager()

    d = Dispatcher()
    d.register("ping", lambda **_: "pong")
    d.register("get_settings", lambda **_: settings.get_all())

    def set_settings(patch: dict, **_):
        for k, v in patch.items():
            settings.set(k, v)
        settings.save()
        return settings.get_all()

    d.register("set_settings", set_settings)
    d.register("shutdown", lambda **_: sys.exit(0))

    # ── Hardware ───────────────────────────────────────────────────────
    d.register("detect_hardware", lambda **_: hardware.detect())
    d.register("recommend_backend", lambda **_: hardware.recommend_backend())
    d.register("recommend_model", lambda **_: hardware.recommend_model())

    # ── Audio devices ──────────────────────────────────────────────────
    d.register("list_input_devices", lambda **_: device_manager.list_input_devices())

    # ── Models ─────────────────────────────────────────────────────────
    d.register("list_available_models", lambda **_: model_manager.list_available())
    d.register("list_downloaded_models", lambda **_: model_manager.list_downloaded())
    d.register(
        "delete_model",
        lambda name, **_: (model_manager.delete_model(name), None)[1],
    )

    def download_model(name: str, **_):
        def progress(percent: float, downloaded: int, total: int):
            sys.stdout.write(json.dumps({
                "method": "progress",
                "params": {
                    "name": name,
                    "percent": percent,
                    "downloaded": downloaded,
                    "total": total,
                },
            }) + "\n")
            sys.stdout.flush()
        path = model_manager.download_model(name, progress_callback=progress)
        return {"path": path}
    d.register("download_model", download_model)

    # ── Recording sessions ─────────────────────────────────────────────
    def start_recording(mode: str = "silence", vad_aggressiveness: int = 1,
                        break_length: int = 5, device_index: int | None = None,
                        **_):
        sid = sessions.start(
            mode=mode,
            vad_aggressiveness=vad_aggressiveness,
            break_length=break_length,
            device_index=device_index,
        )
        return {"session_id": sid}
    d.register("start_recording", start_recording)

    def stop_recording(session_id: str, **_):
        pcm_b64, sr = sessions.stop(session_id)
        return {"samples_pcm_b64": pcm_b64, "sample_rate": sr}
    d.register("stop_recording", stop_recording)

    # ── Transcription ──────────────────────────────────────────────────
    # ULTIMATEASR_TRANSCRIBE_STUB is a test-only escape hatch: when set, the
    # transcribe handler short-circuits and returns the env value as the text.
    def transcribe(engine_kind: str, pcm_b64: str, sample_rate: int,
                   vocabulary: list[str] | None = None,
                   model_path: str | None = None,
                   cloud_api_key: str | None = None,
                   cloud_model: str | None = None,
                   **_):
        stub = os.environ.get("ULTIMATEASR_TRANSCRIBE_STUB")
        if stub is not None:
            return {"text": stub}

        samples = np.frombuffer(base64.b64decode(pcm_b64), dtype=np.float32)

        kwargs: dict = {}
        if engine_kind == "cloud-openai":
            kwargs["api_key"] = cloud_api_key or settings.get("cloud_api_key", "")
            kwargs["model"] = cloud_model or settings.get("cloud_model", "whisper-1")
        else:
            kwargs["model_path"] = model_path or model_manager.get_model_path(
                settings.get("model_size")
            )

        engine = make_engine_kind(engine_kind, **kwargs)
        try:
            text = engine.transcribe(
                samples,
                vocabulary=vocabulary or settings.get("custom_vocabulary"),
            )
        finally:
            try:
                engine.unload()
            except Exception:
                pass
        return {"text": text}
    d.register("transcribe", transcribe)

    # ── LLM cleanup ────────────────────────────────────────────────────
    def llm_cleanup(text: str, provider: str, model: str,
                    api_key: str = "", endpoint: str = "",
                    system_prompt: str = "", **_):
        cfg = LLMConfig(
            provider=provider, model=model, api_key=api_key,
            endpoint=endpoint, system_prompt=system_prompt,
        )
        p = get_provider(cfg)
        return {"text": p.cleanup(text, system_prompt=system_prompt)}
    d.register("llm_cleanup", llm_cleanup)

    d.run()
    return 0


if __name__ == "__main__":
    sys.exit(main())
