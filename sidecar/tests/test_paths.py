import importlib, os, sys
from pathlib import Path

def test_data_dir_uses_appname(monkeypatch, tmp_path):
    if sys.platform == "darwin":
        monkeypatch.setenv("HOME", str(tmp_path))
    elif sys.platform.startswith("win"):
        monkeypatch.setenv("APPDATA", str(tmp_path))
    else:
        monkeypatch.setenv("XDG_DATA_HOME", str(tmp_path))
    import ultimate_asr.paths as paths
    importlib.reload(paths)
    d = paths.data_dir()
    assert d.exists()
    assert "ultimateASR" in str(d)
