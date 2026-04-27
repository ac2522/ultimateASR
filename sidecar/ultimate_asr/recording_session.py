"""Tracks active recording sessions started via RPC.

start_recording() returns a session_id and spawns a background thread that
records audio. stop_recording(session_id) signals the recorder to stop, joins,
and returns the captured PCM (base64-encoded float32 little-endian) plus sample rate.
"""
from __future__ import annotations
import base64
import threading
import uuid
from dataclasses import dataclass
from typing import Optional

import numpy as np

from ultimate_asr.audio.recorder import Recorder, WHISPER_RATE


@dataclass
class _Session:
    id: str
    recorder: Recorder
    mode: str
    thread: threading.Thread
    samples: Optional[np.ndarray] = None
    error: Optional[BaseException] = None


class SessionManager:
    def __init__(self):
        self._sessions: dict[str, _Session] = {}
        self._lock = threading.Lock()

    def start(self, mode: str = "silence", *, vad_aggressiveness: int = 1,
              break_length: int = 5, device_index: Optional[int] = None) -> str:
        rec = Recorder(device_index=device_index)
        sid = uuid.uuid4().hex
        sess = _Session(id=sid, recorder=rec, mode=mode, thread=None)  # type: ignore[arg-type]

        def _run():
            try:
                if mode == "silence":
                    sess.samples = rec.record_silence_mode(
                        vad_aggressiveness=vad_aggressiveness,
                        break_length=break_length,
                    )
                else:
                    sess.samples = rec.record_button_mode()
            except BaseException as e:  # noqa: BLE001 — preserve any failure
                sess.error = e

        sess.thread = threading.Thread(target=_run, daemon=True, name=f"recsession-{sid}")
        with self._lock:
            self._sessions[sid] = sess
        sess.thread.start()
        return sid

    def stop(self, session_id: str) -> tuple[str, int]:
        with self._lock:
            sess = self._sessions.pop(session_id, None)
        if sess is None:
            raise KeyError(f"Unknown session: {session_id}")
        sess.recorder.stop()
        sess.thread.join(timeout=10)
        sess.recorder.cleanup()
        if sess.error is not None:
            raise sess.error
        samples = sess.samples
        if samples is None:
            samples = np.zeros(0, dtype=np.float32)
        # Encode as raw float32 little-endian, base64.
        b = samples.astype(np.float32).tobytes()
        return base64.b64encode(b).decode("ascii"), WHISPER_RATE
