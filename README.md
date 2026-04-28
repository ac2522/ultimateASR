# ultimateASR

Cross-platform local-first dictation for desktop. Talk to a tray icon, get
clean transcripts in your clipboard. Runs whisper.cpp or NVIDIA Parakeet on
your own hardware, falls back to the OpenAI Whisper API when you ask, and
optionally rewrites the result through any LLM (OpenAI / Anthropic /
Ollama / llama.cpp). Built on Electron + React + shadcn/ui with a Python
sidecar that owns audio capture, models, and inference.

## Status

[![CI](https://github.com/ac2522/ultimateASR/actions/workflows/ci.yml/badge.svg)](https://github.com/ac2522/ultimateASR/actions/workflows/ci.yml)
[![Release](https://github.com/ac2522/ultimateASR/actions/workflows/release.yml/badge.svg)](https://github.com/ac2522/ultimateASR/actions/workflows/release.yml)

## Quick start

Grab the latest installer for your OS from the
[Releases page](https://github.com/ac2522/ultimateASR/releases). Releases are
built automatically when a `v*` tag is pushed to `main` (`.github/workflows/release.yml`)
and ship a self-contained app — no Python or Node required at runtime.

| OS      | Artifact                       |
| ------- | ------------------------------ |
| Linux   | `ultimateASR-<ver>.AppImage`   |
| macOS   | `ultimateASR-<ver>.dmg`        |
| Windows | `ultimateASR Setup <ver>.exe`  |

On first launch the wizard detects your hardware, recommends a backend (CUDA
/ Metal / Vulkan / CoreML / CPU) and a Whisper model, and starts the download
in the background.

## What's in the box

- **Tray-first UX.** The system tray is the operating UI. Toggle recording,
  jump to settings, and copy any of the **last 10 transcripts** straight back
  to the clipboard. The desktop window is mostly for configuration.
- **Global hotkey.** Default `Ctrl+Alt+Shift+L`. Uses Electron's
  `globalShortcut` with an **evdev fallback on Wayland** when the X11 grab
  isn't available.
- **Engines.** `whisper-local` (whisper.cpp), `parakeet-local` (sherpa-onnx
  Parakeet), and `cloud-openai` (OpenAI Whisper API). `auto` resolves to
  whisper-local today.
- **Custom dictionary.** Per-user vocabulary biasing. Whisper uses
  `initial_prompt` injection; Parakeet uses fuzzy post-substitution.
- **LLM cleanup.** Optional pass through OpenAI, Anthropic, Ollama, or any
  llama.cpp HTTP server to fix punctuation, capitalisation, and disfluencies.
- **First-run wizard.** Detects hardware, picks a model, kicks off the
  download, marks `first_run_done`, and gets out of the way.
- **Auto-paste.** After transcription, optionally pastes into the focused
  app. Uses `xdotool` / `wtype` on Linux, AppleScript on macOS, and
  `SendInput` on Windows.

## Hardware backends

| Backend     | Platforms              | Notes                                  |
| ----------- | ---------------------- | -------------------------------------- |
| **CUDA**    | Linux + Windows        | NVIDIA GPUs, fastest local path        |
| **Metal**   | macOS                  | Apple Silicon and Intel Macs           |
| **Vulkan**  | Linux + Windows        | Cross-vendor GPU (AMD, Intel, NVIDIA)  |
| **CoreML**  | Apple Silicon          | Used by Parakeet on M-series chips     |
| **CPU**     | Everywhere             | Always available, slower               |

The first-run wizard auto-detects what's available and picks the fastest
match. You can override the choice in **Settings → Engine**.

## Project layout

```
src/main/        Electron main process (tray, hotkey, IPC, recording controller)
src/preload/     contextBridge surface (typed `window.api`)
src/renderer/    React app (pages, components, hooks, store)
src/shared/      Zod schemas shared between main and renderer
sidecar/         Python sidecar (audio, engines, LLM, JSON-RPC dispatcher)
tests/           Vitest (unit) + Playwright (E2E)
docs/            ARCHITECTURE.md, INSTALL.md
scripts/         build-sidecar.mjs (PyInstaller wrapper)
```

See [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) for how the pieces talk to
each other.

## Develop locally

Requires Node 20+, Python 3.11+, and pnpm via Corepack.

```bash
# 1. Toolchain
corepack enable && corepack prepare pnpm@9 --activate

# 2. JS deps
pnpm install

# 3. Sidecar venv (whisper, parakeet, dev extras)
cd sidecar
python3 -m venv .venv && source .venv/bin/activate
pip install -e .[whisper,parakeet,dev]
cd ..

# 4. Run the dev shell — Vite for the renderer, tsc-watch for main, hot reload throughout
pnpm dev

# 5. Tests
pnpm test                # vitest (unit + component)
cd sidecar && pytest     # sidecar tests
pnpm test:e2e            # Playwright Electron E2E specs

# 6. Build + package installers (per-OS, electron-builder)
pnpm build && pnpm package
```

The `pnpm dev` script runs Vite in dev-server mode and Electron points at
`VITE_DEV_SERVER_URL`. See `vite.config.ts` and `vite.main.config.ts` for the
two build pipelines.

### Test escape hatches

- `ULTIMATEASR_PYTHON` — override the Python interpreter the sidecar spawns
  with (default: `python3`).
- `ULTIMATEASR_E2E_SIDECAR` — point at a Node script and the main process
  spawns *that* instead of the sidecar. Used by Playwright specs to mock
  long-running RPC calls.
- `ULTIMATEASR_TRANSCRIBE_STUB` — when set, the sidecar's `transcribe`
  handler short-circuits and returns the env var's value as the transcript.
- `ULTIMATEASR_DATA_DIR` — override the sidecar's userData root.

## Screenshots

> TODO: screenshots once the UI settles. Placeholder:
>
> ![ultimateASR home](docs/img/home.png)
> ![Tray menu](docs/img/tray.png)
> ![First-run wizard](docs/img/wizard.png)

## Acknowledgements

ultimateASR stands on the shoulders of:

- [whisper.cpp](https://github.com/ggerganov/whisper.cpp) — local Whisper
  inference.
- [OpenAI Whisper](https://openai.com/research/whisper) — the original model
  family and the cloud Whisper API.
- [NVIDIA NeMo Parakeet](https://github.com/NVIDIA/NeMo) — Parakeet ASR.
- [sherpa-onnx](https://github.com/k2-fsa/sherpa-onnx) — ONNX runtime for
  Parakeet on every platform.
- [llama.cpp](https://github.com/ggerganov/llama.cpp) — local LLM cleanup.
- [Electron](https://www.electronjs.org/) — desktop shell.
- [shadcn/ui](https://ui.shadcn.com/) — component primitives on top of Radix.
- [Tanstack Query](https://tanstack.com/query) and
  [Zustand](https://zustand-demo.pmnd.rs/) — renderer data layer.

## License

MIT — see [`LICENSE`](LICENSE).
