"""Hardware detection + backend/model recommendation."""
from __future__ import annotations
import os
import platform
import shutil
import subprocess
import sys


def _has_nvidia_smi() -> bool:
    if shutil.which("nvidia-smi") is None:
        return False
    try:
        return subprocess.run(
            ["nvidia-smi", "-L"], capture_output=True, text=True, timeout=5
        ).returncode == 0
    except Exception:
        return False


def _has_vulkan() -> bool:
    return shutil.which("vulkaninfo") is not None


def _ram_gb() -> int:
    try:
        if sys.platform == "linux":
            with open("/proc/meminfo") as f:
                for line in f:
                    if line.startswith("MemTotal:"):
                        return round(int(line.split()[1]) / 1024 / 1024)
        if sys.platform == "darwin":
            out = subprocess.check_output(["sysctl", "-n", "hw.memsize"], text=True, timeout=5)
            return round(int(out.strip()) / (1024 ** 3))
        if sys.platform.startswith("win"):
            import ctypes

            class MS(ctypes.Structure):
                _fields_ = [
                    ("dwLength", ctypes.c_ulong),
                    ("dwMemoryLoad", ctypes.c_ulong),
                    ("ullTotalPhys", ctypes.c_ulonglong),
                    ("ullAvailPhys", ctypes.c_ulonglong),
                    ("ullTotalPageFile", ctypes.c_ulonglong),
                    ("ullAvailPageFile", ctypes.c_ulonglong),
                    ("ullTotalVirtual", ctypes.c_ulonglong),
                    ("ullAvailVirtual", ctypes.c_ulonglong),
                    ("ullAvailExtendedVirtual", ctypes.c_ulonglong),
                ]
            ms = MS(); ms.dwLength = ctypes.sizeof(MS)
            ctypes.windll.kernel32.GlobalMemoryStatusEx(ctypes.byref(ms))
            return round(ms.ullTotalPhys / (1024 ** 3))
    except Exception:
        pass
    return 8


def detect() -> dict:
    if sys.platform == "darwin":
        osname = "darwin"
    elif sys.platform.startswith("win"):
        osname = "windows"
    else:
        osname = "linux"
    arch = platform.machine().lower()
    metal = osname == "darwin"
    coreml = osname == "darwin" and arch in ("arm64", "aarch64")
    return {
        "os": osname,
        "arch": arch,
        "cpu_count": os.cpu_count() or 4,
        "ram_gb": _ram_gb(),
        "cuda": _has_nvidia_smi(),
        "metal": metal,
        "vulkan": _has_vulkan() and not metal,
        "coreml": coreml,
    }


def recommend_backend() -> str:
    info = detect()
    if info["cuda"]:
        return "cuda"
    if info["metal"]:
        return "metal"
    if info["vulkan"]:
        return "vulkan"
    return "cpu"


def recommend_model() -> str:
    info = detect()
    ram = info["ram_gb"]
    if (info["cuda"] or info["metal"]) and ram >= 16:
        return "ggml-large-v3-turbo-q5_0.bin"
    if ram >= 16:
        return "ggml-small.bin"
    if ram >= 12:
        return "ggml-small.bin"
    return "ggml-base.bin"
