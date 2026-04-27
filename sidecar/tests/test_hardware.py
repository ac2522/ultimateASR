from ultimate_asr.hardware import detect, recommend_backend, recommend_model


def test_detect_returns_canonical_keys():
    info = detect()
    for k in ("os", "arch", "cpu_count", "ram_gb", "cuda", "metal", "vulkan", "coreml"):
        assert k in info, f"missing key: {k}"


def test_recommend_backend_prefers_cuda(monkeypatch):
    monkeypatch.setattr("ultimate_asr.hardware.detect",
        lambda: {"os": "linux", "cuda": True, "metal": False, "vulkan": True, "coreml": False, "ram_gb": 16, "cpu_count": 8, "arch": "x86_64"})
    assert recommend_backend() == "cuda"


def test_recommend_backend_falls_back_through_chain(monkeypatch):
    monkeypatch.setattr("ultimate_asr.hardware.detect",
        lambda: {"os": "linux", "cuda": False, "metal": False, "vulkan": True, "coreml": False, "ram_gb": 16, "cpu_count": 8, "arch": "x86_64"})
    assert recommend_backend() == "vulkan"

    monkeypatch.setattr("ultimate_asr.hardware.detect",
        lambda: {"os": "darwin", "cuda": False, "metal": True, "vulkan": False, "coreml": True, "ram_gb": 16, "cpu_count": 8, "arch": "arm64"})
    assert recommend_backend() == "metal"

    monkeypatch.setattr("ultimate_asr.hardware.detect",
        lambda: {"os": "linux", "cuda": False, "metal": False, "vulkan": False, "coreml": False, "ram_gb": 8, "cpu_count": 4, "arch": "x86_64"})
    assert recommend_backend() == "cpu"


def test_recommend_model_uses_ram(monkeypatch):
    base = {"os": "linux", "cuda": True, "metal": False, "vulkan": False, "coreml": False, "cpu_count": 8, "arch": "x86_64"}
    monkeypatch.setattr("ultimate_asr.hardware.detect", lambda: {**base, "ram_gb": 32})
    assert recommend_model() == "ggml-large-v3-turbo-q5_0.bin"
    monkeypatch.setattr("ultimate_asr.hardware.detect", lambda: {**base, "ram_gb": 8})
    assert recommend_model() == "ggml-base.bin"
