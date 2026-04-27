from ultimate_asr.engine import factory


def test_local_whisper_path_uses_whisper_engine(tmp_path):
    p = tmp_path / "ggml-base.bin"
    p.write_bytes(b"\x00" * 16)
    e = factory.make_engine(str(p), _stub_for_test=True)
    assert e.kind == "whisper-local"


def test_local_parakeet_path_uses_parakeet_engine(tmp_path):
    d = tmp_path / "parakeet-tdt"; d.mkdir()
    (d / "encoder-model.onnx").write_bytes(b"\x00" * 16)
    e = factory.make_engine(str(d), _stub_for_test=True)
    assert e.kind == "parakeet-local"


def test_cloud_kind_returns_cloud_engine():
    e = factory.make_engine_kind("cloud-openai", api_key="sk-test", model="whisper-1", _stub_for_test=True)
    assert e.kind == "cloud-openai"


def test_unknown_path_raises(tmp_path):
    p = tmp_path / "garbage.txt"; p.write_text("nope")
    import pytest
    with pytest.raises(ValueError):
        factory.make_engine(str(p))


def test_unknown_engine_kind_raises():
    import pytest
    with pytest.raises(ValueError, match="Unknown engine kind"):
        factory.make_engine_kind("not-a-real-engine")
