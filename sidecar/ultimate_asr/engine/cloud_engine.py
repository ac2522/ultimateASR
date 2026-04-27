"""Cloud engine using OpenAI's Whisper API."""
from __future__ import annotations
import io
import wave
import numpy as np

from openai import OpenAI

from ultimate_asr.engine.vocabulary import build_whisper_prompt


class OpenAICloudEngine:
    kind = "cloud-openai"
    SAMPLE_RATE = 16000

    def __init__(self, api_key: str, model: str = "whisper-1", _stub_for_test: bool = False):
        if not api_key and not _stub_for_test:
            raise ValueError("api_key is required for OpenAICloudEngine")
        self._model = model
        if _stub_for_test:
            from unittest.mock import MagicMock
            self._client = MagicMock()
        else:
            self._client = OpenAI(api_key=api_key)

    def is_loaded(self) -> bool:
        return self._client is not None

    def unload(self) -> None:
        self._client = None

    def reload(self, **_):
        pass  # cloud engines don't have a real load step

    def transcribe(self, audio_data, *, vocabulary: list[str] | None = None) -> str:
        if isinstance(audio_data, (bytes, bytearray)):
            samples = np.frombuffer(audio_data, dtype=np.int16)
        elif np.issubdtype(audio_data.dtype, np.floating):
            samples = (audio_data * 32768.0).clip(-32768, 32767).astype(np.int16)
        else:
            samples = audio_data.astype(np.int16)

        buf = io.BytesIO()
        with wave.open(buf, "wb") as w:
            w.setnchannels(1)
            w.setsampwidth(2)
            w.setframerate(self.SAMPLE_RATE)
            w.writeframes(samples.tobytes())
        buf.seek(0)

        kwargs = {"model": self._model, "file": ("audio.wav", buf.getvalue())}
        prompt = build_whisper_prompt(vocabulary)
        if prompt:
            kwargs["prompt"] = prompt
        result = self._client.audio.transcriptions.create(**kwargs)
        return getattr(result, "text", str(result)).strip()

    def __enter__(self): return self
    def __exit__(self, *_): self.unload(); return False
