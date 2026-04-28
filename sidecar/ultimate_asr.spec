# PyInstaller spec for ultimate_asr sidecar
from PyInstaller.utils.hooks import collect_all, collect_data_files
import sys

hidden = []
datas = []
binaries = []

for mod in ("onnxruntime", "onnx_asr", "pywhispercpp", "huggingface_hub",
            "openai", "anthropic", "pyaudio", "numpy"):
    try:
        h, d, b = collect_all(mod)
        hidden += h; datas += d; binaries += b
    except Exception:
        pass

a = Analysis(
    ["ultimate_asr/__main__.py"],
    pathex=["."],
    binaries=binaries,
    datas=datas,
    hiddenimports=hidden + [
        "ultimate_asr.audio.recorder",
        "ultimate_asr.audio.vad",
        "ultimate_asr.audio.device_manager",
        "ultimate_asr.engine.factory",
        "ultimate_asr.engine.whisper_engine",
        "ultimate_asr.engine.parakeet_engine",
        "ultimate_asr.engine.cloud_engine",
        "ultimate_asr.engine.model_manager",
        "ultimate_asr.engine.vocabulary",
        "ultimate_asr.llm.base",
        "ultimate_asr.llm.openai_provider",
        "ultimate_asr.llm.anthropic_provider",
        "ultimate_asr.llm.ollama_provider",
        "ultimate_asr.llm.llamacpp_provider",
        "ultimate_asr.hardware",
        "ultimate_asr.recording_session",
        "ultimate_asr.settings",
        "ultimate_asr.paths",
        "ultimate_asr.rpc",
    ],
    hookspath=[],
    runtime_hooks=[],
    excludes=["tkinter"],
    noarchive=False,
)
pyz = PYZ(a.pure)
exe = EXE(
    pyz, a.scripts,
    name="ultimate_asr",
    console=True,
    debug=False,
    bootloader_ignore_signals=False,
    strip=False, upx=False,
)
coll = COLLECT(
    exe, a.binaries, a.zipfiles, a.datas,
    name="ultimate_asr",
    strip=False, upx=False,
)
