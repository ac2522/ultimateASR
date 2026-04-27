"""Sidecar entry: spawn JSON-RPC dispatcher on stdin/stdout."""
from __future__ import annotations
import logging
import os
import sys
from pathlib import Path

from ultimate_asr.rpc import Dispatcher
from ultimate_asr.settings import SettingsManager
from ultimate_asr import paths


def _resolve_data_dir() -> Path:
    override = os.environ.get("ULTIMATEASR_DATA_DIR")
    return Path(override) if override else paths.data_dir()


def main() -> int:
    logging.basicConfig(
        level=logging.INFO,
        stream=sys.stderr,
        format="[sidecar %(asctime)s %(levelname)s] %(message)s",
    )
    settings = SettingsManager(_resolve_data_dir())

    d = Dispatcher()
    d.register("ping", lambda **_: "pong")
    d.register("get_settings", lambda **_: settings.get_all())

    def set_settings(patch: dict, **_):
        for k, v in patch.items():
            settings.set(k, v)
        settings.save()
        return settings.get_all()

    d.register("set_settings", set_settings)
    d.register("shutdown", lambda **_: sys.exit(0))
    d.run()
    return 0


if __name__ == "__main__":
    sys.exit(main())
