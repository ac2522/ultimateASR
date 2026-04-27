import json
import os
import subprocess
import sys

ENTRY = [sys.executable, "-m", "ultimate_asr"]


def _talk(proc, msg):
    proc.stdin.write(json.dumps(msg) + "\n")
    proc.stdin.flush()
    return json.loads(proc.stdout.readline())


def test_ping_and_settings_round_trip(tmp_path):
    proc = subprocess.Popen(
        ENTRY,
        stdin=subprocess.PIPE,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
        bufsize=1,
        env={**os.environ, "ULTIMATEASR_DATA_DIR": str(tmp_path)},
    )
    try:
        assert _talk(proc, {"id": 1, "method": "ping"})["result"] == "pong"
        s = _talk(proc, {"id": 2, "method": "get_settings"})["result"]
        assert s["model_size"] == "ggml-base.bin"
        _talk(proc, {"id": 3, "method": "set_settings", "params": {"patch": {"auto_paste": True}}})
        s2 = _talk(proc, {"id": 4, "method": "get_settings"})["result"]
        assert s2["auto_paste"] is True
    finally:
        proc.stdin.close()
        proc.wait(timeout=5)
