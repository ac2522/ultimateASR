"""Tests for ultimate_asr.engine.model_manager.ModelManager."""

import os
from unittest.mock import patch

import pytest

from ultimate_asr.engine.model_manager import AVAILABLE_MODELS, ModelManager

# ---------------------------------------------------------------------------
# The real models/ directory shipped with the project.
# ---------------------------------------------------------------------------
SIDECAR_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MODELS_DIR = os.path.join(SIDECAR_ROOT, "models")

requires_real_models = pytest.mark.skipif(
    not (
        os.path.isdir(MODELS_DIR)
        and os.path.isfile(os.path.join(MODELS_DIR, "ggml-base.bin"))
        and os.path.isfile(os.path.join(MODELS_DIR, "ggml-small.bin"))
    ),
    reason=f"Real models directory not populated: {MODELS_DIR}",
)


@pytest.fixture
def manager():
    """ModelManager pointed at the real models/ directory."""
    return ModelManager(MODELS_DIR)


# ---------------------------------------------------------------------------
# Tests that use the real models/ directory
# ---------------------------------------------------------------------------


class TestListDownloaded:
    """list_downloaded() should report models present on disk."""

    @requires_real_models
    def test_list_downloaded_models(self, manager):
        downloaded = manager.list_downloaded()
        names = [m["name"] for m in downloaded]
        assert "ggml-base.bin" in names
        assert "ggml-small.bin" in names

    @requires_real_models
    def test_list_downloaded_includes_size(self, manager):
        downloaded = manager.list_downloaded()
        for model in downloaded:
            assert "size_mb" in model
            assert isinstance(model["size_mb"], float)
            assert model["size_mb"] > 0

    @requires_real_models
    def test_list_downloaded_has_required_keys(self, manager):
        downloaded = manager.list_downloaded()
        for model in downloaded:
            assert "name" in model
            assert "path" in model
            assert "size_mb" in model
            assert "description" in model


class TestListAvailable:
    """list_available() should return the static catalogue."""

    def test_list_available_models(self):
        mm = ModelManager(MODELS_DIR) if os.path.isdir(MODELS_DIR) else None
        # list_available is a staticmethod; constructor only needs models_dir to exist.
        # Use a tmp directory if real one isn't there.
        available = ModelManager.list_available()
        assert len(available) == len(AVAILABLE_MODELS)
        names = [m["name"] for m in available]
        assert "ggml-base.bin" in names
        assert "ggml-large-v3-turbo-q8_0.bin" in names

    def test_list_available_has_required_keys(self):
        available = ModelManager.list_available()
        for model in available:
            assert "name" in model
            assert "type" in model
            assert model["type"] in ("whisper", "parakeet")
            assert "size_mb" in model
            assert "description" in model

    def test_list_available_includes_parakeet_entries(self):
        available = ModelManager.list_available()
        names = [m["name"] for m in available]
        assert "parakeet-tdt-0.6b-v2-int8" in names
        assert "parakeet-tdt-0.6b-v3-int8" in names


class TestIsDownloaded:
    """is_downloaded() should check file existence."""

    @requires_real_models
    def test_is_downloaded(self, manager):
        assert manager.is_downloaded("ggml-base.bin") is True
        assert manager.is_downloaded("ggml-small.bin") is True
        assert manager.is_downloaded("ggml-nonexistent.bin") is False


class TestGetModelPath:
    """get_model_path() should return the path or raise."""

    @requires_real_models
    def test_get_model_path(self, manager):
        path = manager.get_model_path("ggml-base.bin")
        assert os.path.isfile(path)
        assert path.endswith("ggml-base.bin")

    def test_get_model_path_not_downloaded(self, tmp_path):
        mm = ModelManager(str(tmp_path))
        with pytest.raises(FileNotFoundError):
            mm.get_model_path("ggml-nonexistent.bin")


class TestDeleteModel:
    """delete_model() should remove the file from disk."""

    def test_delete_model(self, tmp_path):
        """Use a temporary directory so we don't delete real models."""
        mm = ModelManager(str(tmp_path))
        fake_model = tmp_path / "ggml-fake.bin"
        fake_model.write_bytes(b"\x00" * 1024)
        assert fake_model.exists()

        mm.delete_model("ggml-fake.bin")
        assert not fake_model.exists()

    def test_delete_model_nonexistent(self, tmp_path):
        """Deleting a model that doesn't exist should not raise."""
        mm = ModelManager(str(tmp_path))
        mm.delete_model("ggml-nonexistent.bin")  # should not raise


class TestConstructor:
    """Constructor should create the models_dir if it doesn't exist."""

    def test_creates_models_dir(self, tmp_path):
        new_dir = str(tmp_path / "new_models")
        assert not os.path.exists(new_dir)
        ModelManager(new_dir)
        assert os.path.isdir(new_dir)


# ---------------------------------------------------------------------------
# Parakeet (directory-based) tests merged from test_model_manager_parakeet.py
# ---------------------------------------------------------------------------


@pytest.fixture
def manager_with_models(tmp_path):
    """ModelManager pointing at a temp dir seeded with one fake Whisper file
    and one fake Parakeet directory."""
    # Whisper-style: single .bin
    (tmp_path / "ggml-base.bin").write_bytes(b"\x00" * 1024)
    # Parakeet-style: directory with encoder-model.int8.onnx
    pdir = tmp_path / "parakeet-tdt-0.6b-v3-int8"
    pdir.mkdir()
    (pdir / "encoder-model.int8.onnx").write_bytes(b"\x00" * 1024)
    (pdir / "decoder_joint-model.int8.onnx").write_bytes(b"\x00" * 1024)
    (pdir / "vocab.txt").write_text("a\nb\n")
    return ModelManager(str(tmp_path))


class TestListDownloadedMixed:
    def test_lists_both_whisper_and_parakeet(self, manager_with_models):
        downloaded = manager_with_models.list_downloaded()
        names = [m["name"] for m in downloaded]
        assert "ggml-base.bin" in names
        assert "parakeet-tdt-0.6b-v3-int8" in names

    def test_each_entry_has_type_field(self, manager_with_models):
        downloaded = manager_with_models.list_downloaded()
        types = {m["name"]: m["type"] for m in downloaded}
        assert types["ggml-base.bin"] == "whisper"
        assert types["parakeet-tdt-0.6b-v3-int8"] == "parakeet"

    def test_parakeet_entry_path_is_directory(self, manager_with_models):
        downloaded = manager_with_models.list_downloaded()
        entry = next(m for m in downloaded if m["type"] == "parakeet")
        assert os.path.isdir(entry["path"])

    def test_directory_without_encoder_is_ignored(self, tmp_path):
        # A random directory should not show up.
        (tmp_path / "ggml-base.bin").write_bytes(b"\x00")
        (tmp_path / "stray-dir").mkdir()
        (tmp_path / "stray-dir" / "vocab.txt").write_text("x")
        mm = ModelManager(str(tmp_path))
        names = [m["name"] for m in mm.list_downloaded()]
        assert "stray-dir" not in names


class TestIsDownloadedDirectory:
    def test_true_for_parakeet_directory(self, manager_with_models):
        assert manager_with_models.is_downloaded("parakeet-tdt-0.6b-v3-int8")

    def test_false_for_missing_directory(self, manager_with_models):
        assert not manager_with_models.is_downloaded("parakeet-tdt-0.6b-v2-int8")


class TestGetModelPathDirectory:
    def test_returns_directory_path(self, manager_with_models):
        path = manager_with_models.get_model_path("parakeet-tdt-0.6b-v3-int8")
        assert os.path.isdir(path)
        assert path.endswith("parakeet-tdt-0.6b-v3-int8")


class TestDeleteModelDirectory:
    def test_removes_directory_recursively(self, manager_with_models):
        manager_with_models.delete_model("parakeet-tdt-0.6b-v3-int8")
        assert not manager_with_models.is_downloaded("parakeet-tdt-0.6b-v3-int8")


class TestDownloadParakeet:
    def test_dispatches_to_snapshot_download(self, tmp_path):
        mm = ModelManager(str(tmp_path))
        with patch("ultimate_asr.engine.model_manager.snapshot_download") as snap, \
             patch("os.rename") as rename:
            # snapshot_download writes to local_dir; emulate with a no-op.
            snap.return_value = str(tmp_path / "parakeet-tdt-0.6b-v3-int8.partial")
            mm.download_model("parakeet-tdt-0.6b-v3-int8")

        snap.assert_called_once()
        kwargs = snap.call_args.kwargs
        assert kwargs["repo_id"] == "istupakov/parakeet-tdt-0.6b-v3-onnx"
        assert kwargs["revision"] == "main"
        assert kwargs["local_dir"].endswith("parakeet-tdt-0.6b-v3-int8.partial")
        rename.assert_called_once()

    def test_progress_callback_invoked_with_completion(self, tmp_path):
        mm = ModelManager(str(tmp_path))
        seen = []

        def cb(percent, downloaded, total):
            seen.append(percent)

        with patch("ultimate_asr.engine.model_manager.snapshot_download"), \
             patch("os.rename"):
            mm.download_model("parakeet-tdt-0.6b-v3-int8", progress_callback=cb)

        # We don't expose per-byte progress; just ensure 0 and 100 are reported.
        assert seen[0] == 0
        assert seen[-1] == 100

    def test_cleans_up_partial_dir_on_failure(self, tmp_path):
        mm = ModelManager(str(tmp_path))
        partial = tmp_path / "parakeet-tdt-0.6b-v3-int8.partial"
        partial.mkdir()  # simulate a partial that snapshot_download started

        def boom(**_):
            raise RuntimeError("network down")

        with patch("ultimate_asr.engine.model_manager.snapshot_download", side_effect=boom):
            with pytest.raises(RuntimeError, match="network down"):
                mm.download_model("parakeet-tdt-0.6b-v3-int8")

        assert not partial.exists()
