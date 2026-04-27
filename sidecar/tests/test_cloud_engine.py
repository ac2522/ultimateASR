"""Tests for ultimate_asr.engine.cloud_engine.OpenAICloudEngine."""

import io
import numpy as np
import pytest
from unittest.mock import MagicMock, patch

from ultimate_asr.engine.cloud_engine import OpenAICloudEngine


@pytest.fixture
def mock_openai():
    with patch("ultimate_asr.engine.cloud_engine.OpenAI") as cls:
        client = MagicMock()
        cls.return_value = client
        client.audio.transcriptions.create.return_value = MagicMock(text="hello world")
        yield client


def test_kind_is_cloud_openai(mock_openai):
    e = OpenAICloudEngine(api_key="sk", model="whisper-1")
    assert e.kind == "cloud-openai"


def test_transcribe_int16_bytes_uploads_wav(mock_openai):
    e = OpenAICloudEngine(api_key="sk", model="whisper-1")
    audio = np.zeros(16000, dtype=np.float32)
    text = e.transcribe(audio)
    assert text == "hello world"
    args, kwargs = mock_openai.audio.transcriptions.create.call_args
    assert kwargs["model"] == "whisper-1"
    sent_file = kwargs["file"]
    assert sent_file[0].endswith(".wav")
    assert isinstance(sent_file[1], (bytes, bytearray, io.BytesIO))


def test_vocabulary_passed_as_prompt(mock_openai):
    e = OpenAICloudEngine(api_key="sk", model="whisper-1")
    e.transcribe(np.zeros(16000, dtype=np.float32), vocabulary=["Avrillo", "SDLT"])
    kwargs = mock_openai.audio.transcriptions.create.call_args.kwargs
    assert "Avrillo" in kwargs["prompt"]
    assert "SDLT" in kwargs["prompt"]


def test_missing_api_key_raises():
    with pytest.raises(ValueError, match="api_key"):
        OpenAICloudEngine(api_key="", model="whisper-1")
