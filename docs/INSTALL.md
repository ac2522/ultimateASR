# Install

ultimateASR ships pre-built installers for Linux, macOS, and Windows on
the [GitHub Releases page](https://github.com/ac2522/ultimateASR/releases).
This document covers per-OS prerequisites, the manual development path,
and a troubleshooting checklist.

## Linux

Tested on **Ubuntu 22.04+** and Fedora 40. Other modern distros should
work as long as you have GLIBC 2.35+.

### System packages

The AppImage bundles its own Node, Chromium, and Python runtime, but it
does need a few host libraries:

```bash
sudo apt install \
  portaudio19-dev \
  libxkbcommon0 \
  libnss3 \
  libasound2t64
```

`portaudio19-dev` provides the audio capture backend that PyAudio links
against. `libxkbcommon0`, `libnss3`, and `libasound2t64` are runtime
dependencies of Electron and Chromium that some minimal installs lack.

### Wayland: the input group

Electron's `globalShortcut` relies on an X11 keyboard grab, which is not
available on Wayland. ultimateASR registers a fallback evdev listener
that reads `/dev/input/event*` directly. To make that work without
running the app as root, add your user to the `input` group:

```bash
sudo usermod -aG input "$USER"
```

You must **log out and back in** (or reboot) for the new group to take
effect. If the hotkey still doesn't fire, double-check `groups` shows
`input`, then restart the app.

### Auto-paste helpers

The auto-paste feature uses one of two utilities depending on your
session type:

- **X11** — install `xdotool`:

  ```bash
  sudo apt install xdotool
  ```

- **Wayland** — install `wtype`:

  ```bash
  sudo apt install wtype
  ```

If neither is on `PATH`, auto-paste silently no-ops; transcripts still
land on the clipboard.

## macOS

Tested on **macOS 13 (Ventura)** and later, both Apple Silicon and Intel.

On first launch, macOS prompts for two permissions:

1. **Microphone.** Required for any local recording. Without it the
   sidecar's audio capture fails with a clear error.
2. **Accessibility.** Required for auto-paste — the AppleScript that
   sends ⌘V into the focused app. If you skip this, transcripts still
   land on the clipboard, just nothing is pasted.

You can later toggle either in **System Settings → Privacy & Security →
Microphone / Accessibility**.

The app is **notarised on signed builds**. Unsigned local builds will
trigger Gatekeeper; right-click → Open the first time to authorise.

## Windows

Tested on **Windows 11**. Audio capture, auto-paste (`SendInput`), and
the global hotkey work out of the box.

The current installer is **unsigned**. SmartScreen will warn the first
time you run it; click "More info" → "Run anyway" to proceed. Code
signing is on the roadmap once the project has a stable release cadence.

### Defender exclusions

PyInstaller-bundled Python interpreters are sometimes flagged as
suspicious by Defender heuristics. If launches are unusually slow,
adding the install directory (default `%LOCALAPPDATA%\Programs\ultimateASR`)
as a Defender exclusion shaves several seconds off cold start.

## Manual dev install

For contributors and people who want to run from source.

### Requirements

- **Node 20+** (Electron 30 baseline).
- **pnpm 9** via Corepack (`corepack enable`).
- **Python 3.11+** with `venv`.
- A C/C++ toolchain for compiling whisper.cpp:
  - Linux: `build-essential`
  - macOS: Xcode Command Line Tools (`xcode-select --install`)
  - Windows: Visual Studio Build Tools 2022 (Desktop C++ workload)

### Bootstrap

```bash
git clone https://github.com/ac2522/ultimateASR
cd ultimateASR

# 1. JS toolchain
corepack enable && corepack prepare pnpm@9 --activate
pnpm install

# 2. Sidecar venv with the optional extras you want
cd sidecar
python3 -m venv .venv && source .venv/bin/activate
pip install -e .[whisper,parakeet,dev]
cd ..

# 3. Run dev shell (Vite for renderer, ts-watch for main, hot reload)
pnpm dev
```

Tests:

```bash
pnpm test                # vitest (renderer + main unit tests)
pnpm test:e2e            # Playwright Electron E2E
cd sidecar && pytest -q  # sidecar unit + integration
```

### CUDA (optional)

End users do **not** need CUDA installed. The packaged sidecar bundles
the runtime libraries it needs, and falls back to CPU inference when no
GPU is detected.

Power users running heavy workloads benefit from a current NVIDIA driver
on the host (the bundle uses the host's driver, not its own). Anything
that runs CUDA 12 cleanly is fine.

For dev installs you can install the optional CUDA extras into the venv:

```bash
pip install -e .[whisper,parakeet,cuda]
```

This pulls the CUDA wheels for `pywhispercpp` and `onnxruntime-gpu`.

## Troubleshooting

### "No microphone detected"

Open **Settings → Audio Device** and pick a device from the dropdown.
The list is populated by `devices.list` on the sidecar; if it's empty,
the OS isn't exposing any input devices to PortAudio. On Linux check
that PulseAudio or PipeWire is running and that your user is in the
`audio` group.

### "Global hotkey not firing on Wayland"

Wayland blocks Electron's `globalShortcut` API. ultimateASR falls back
to reading `/dev/input/event*` directly. That requires membership of the
`input` group:

```bash
sudo usermod -aG input "$USER"
# log out and back in, then:
groups | tr ' ' '\n' | grep ^input$
```

If `groups` does not list `input`, the fallback can't open the device
nodes and the hotkey will be silent.

### "Auto-paste does nothing on Linux"

Auto-paste needs an external helper:

- X11 sessions need `xdotool` on `PATH`.
- Wayland sessions need `wtype` on `PATH`.

```bash
which xdotool || sudo apt install xdotool
which wtype   || sudo apt install wtype
```

Transcripts always land on the clipboard regardless — auto-paste is
strictly a convenience.

### "OpenAI Whisper API errors"

When the engine is set to `cloud-openai`, every error from the API is
surfaced verbatim. Common causes:

- **401 Unauthorized** — the key in **Settings → Cloud → API key** is
  missing or wrong.
- **429 Too Many Requests** — your account is rate-limited; wait or
  raise your limit.
- **Network error** — corporate proxy or firewall. The sidecar honours
  `HTTPS_PROXY` and `HTTP_PROXY` env vars.

Verify the key in the OpenAI dashboard before re-entering it.

### "LLM cleanup is very slow"

The default Ollama endpoint is `http://localhost:11434`. If you have not
installed Ollama, every cleanup request waits for the connection to
time out before falling through. Either:

- Start Ollama and pull a small model (`ollama pull llama3.2:3b`), or
- Disable cleanup in **Settings → LLM → Enable LLM cleanup**, or
- Switch to a hosted provider (OpenAI / Anthropic) in the same screen.

For self-hosted llama.cpp HTTP servers, paste the full base URL into
**Settings → LLM → Endpoint**.
