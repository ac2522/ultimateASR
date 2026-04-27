import json
import threading
from pathlib import Path

import pytest

from ultimate_asr.settings import SettingsManager, DEFAULT_SETTINGS


def test_defaults_when_no_file(tmp_path):
    sm = SettingsManager(tmp_path)
    for k, v in DEFAULT_SETTINGS.items():
        assert sm.get(k) == v


def test_persistence_round_trip(tmp_path):
    sm = SettingsManager(tmp_path)
    sm.set("auto_paste", True)
    sm.save()
    sm2 = SettingsManager(tmp_path)
    assert sm2.get("auto_paste") is True


def test_legacy_model_size_migration(tmp_path):
    (tmp_path / "settings.json").write_text(json.dumps({"model_size": "base"}))
    sm = SettingsManager(tmp_path)
    assert sm.get("model_size") == "ggml-base.bin"


def test_concurrent_writes_are_serialized(tmp_path):
    sm = SettingsManager(tmp_path)
    def writer(i):
        for j in range(50): sm.set(f"k{i}", j)
    ts = [threading.Thread(target=writer, args=(i,)) for i in range(8)]
    for t in ts: t.start()
    for t in ts: t.join()
    sm.save()
    data = json.loads((tmp_path / "settings.json").read_text())
    for i in range(8):
        assert data[f"k{i}"] == 49


def test_new_keys_present_in_defaults():
    # ultimateASR adds cloud + LLM settings on top of whisperLocal's set.
    for k in [
        "engine_kind", "cloud_api_key", "llm_provider", "llm_enabled",
        "llm_system_prompt", "first_run_done",
    ]:
        assert k in DEFAULT_SETTINGS
