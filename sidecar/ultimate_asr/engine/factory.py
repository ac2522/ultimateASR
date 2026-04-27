"""Factory that picks a transcription engine based on model path.

Whisper: a single .bin file (whisper.cpp GGML format).
Parakeet: a directory containing encoder-model*.onnx (onnx-asr format).
"""

import glob
import os

from ultimate_asr.engine.parakeet_engine import ParakeetEngine
from ultimate_asr.engine.whisper_engine import WhisperEngine


def make_engine(model_path: str, **kwargs):
    """Return a transcription engine appropriate for the given model path."""
    if not os.path.exists(model_path):
        raise ValueError(f"Model path does not exist: {model_path}")

    if os.path.isfile(model_path) and model_path.lower().endswith(".bin"):
        return WhisperEngine(model_path, **kwargs)

    if os.path.isdir(model_path):
        encoders = glob.glob(os.path.join(model_path, "encoder-model*.onnx"))
        if encoders:
            return ParakeetEngine(model_path, **kwargs)

    raise ValueError(
        f"Unrecognized model at {model_path!r}: expected a .bin file (Whisper) "
        f"or a directory containing encoder-model*.onnx (Parakeet)."
    )


def make_engine_kind(kind: str, **kwargs):
    """Return a transcription engine selected by string kind.

    Supported kinds:
      * ``"auto"``, ``"whisper-local"``, ``"parakeet-local"`` — dispatches
        through :func:`make_engine`. Caller must supply ``model_path`` in
        ``kwargs``.
      * ``"cloud-openai"`` — constructs an OpenAI cloud engine; remaining
        kwargs (e.g. ``api_key``, ``model``) are forwarded to its constructor.
    """
    if kind in ("auto", "whisper-local", "parakeet-local"):
        return make_engine(kwargs.pop("model_path"), **kwargs)
    if kind == "cloud-openai":
        from ultimate_asr.engine.cloud_engine import OpenAICloudEngine
        return OpenAICloudEngine(**kwargs)
    raise ValueError(f"Unknown engine kind: {kind}")
