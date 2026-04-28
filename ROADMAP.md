# ultimateASR Roadmap

Status as of 2026-04-28 — HEAD `63a1b5b`.

This is the **post-Phase-11 punch list**: what's been verified, what hasn't, gaps vs. the original `whisperLocal`, and how to benchmark the two against each other. Strict honesty — items aren't checked off until they've been driven by hand or by CI.

---

## 1. What's verified

- Sidecar pytest: **161 passed + 11 skipped** (skipped = real-model gated)
- Vitest unit tests: **67 passed across 20 files**
- Playwright specs: **6 collected**, parse cleanly
- Typecheck (renderer + main): clean
- Vite renderer + main bundles: build successfully
- CI workflow YAML, electron-builder config, PyInstaller spec: parse cleanly

## 2. What is NOT verified (must-do before "ready")

These have to happen before anyone can dictate. None has been driven yet.

- [ ] **`pnpm dev` opens an Electron window.** No live launch on this dev box (no display server). Highest priority — confirms the renderer mounts, the preload bridge works, and the sidecar spawns.
- [ ] **Sidecar JSON-RPC handshake from a real renderer.** `window.api.ping()` returns `"pong"`. Trivial in principle but not yet observed.
- [ ] **First-run wizard** drives hardware detection → recommended model → `models.download` → completes.
- [ ] **End-to-end recording → transcript.** Speak into a real mic, see a transcript appear in the tray submenu. This is the only test that proves the app works.
- [ ] **Global hotkey** registers and triggers `RecordingController.toggle()` on each platform.
- [ ] **Auto-paste** types into a focused window (xdotool / wtype / osascript / SendKeys).
- [ ] **`pnpm sidecar:build`** produces a working PyInstaller bundle. First run will surface heavy-dep packaging issues (CUDA libs, ONNX runtime, PyAudio).
- [ ] **`pnpm package`** produces a real installer per OS. macOS DMG / Linux AppImage+deb / Windows NSIS exe.
- [ ] **GitHub release workflow** runs on a `v0.1.0-rc1` tag and publishes draft installers.
- [ ] **Playwright E2E in CI** on `xvfb-run`. We expect the Linux job to pass; macOS and Windows are best-effort first time.

## 3. Gaps vs. whisperLocal

Items the older PyQt app did that the new app does not (yet). Each is labeled with effort (S/M/L) and priority (P0/P1/P2).

### Must-port (parity blockers)

- [ ] **In-app error / log panel** — `whisperLocal/ui/error_panel.py` (177 lines). A collapsible panel showing recent log lines, auto-expanding on ERROR, level-coloured. Without this, troubleshooting requires reading systemd / files.  **(M, P1)**
- [ ] **Tray menu shows "Start Recording" ↔ "Stop Recording"** depending on state (currently a static "Toggle recording"). `whisperLocal/ui/main_window.py:672`.  **(S, P1)**
- [ ] **Linux installer / setup helper** — verify the user is in the `input` group (otherwise the Wayland evdev hotkey fails silently), prompt for `usermod -aG input $USER`, suggest installing `xdotool`/`wtype`. The original `whisperLocal/install.sh` did this. electron-builder's Linux postinst hook is the right place.  **(M, P1)**
- [ ] **Model migration** — if `~/.whisper2text/models/` exists from a prior whisperLocal install, offer to symlink or copy into ultimateASR's models dir on first run.  **(S, P2)**
- [ ] **Wayland hotkey via evdev (sidecar)** — `src/main/hotkey.ts` has a `evdevFallback` injection point, but the actual evdev path isn't implemented. whisperLocal's `main_window.py:866-991` is the proven implementation; lift it into a sidecar RPC method (`register_hotkey`/`unregister_hotkey`) and have the main process route through it on Linux + Wayland.  **(M, P1)**
- [ ] **Keyboard hotplug rescanning** — whisperLocal rescans `/dev/input/event*` every 2 seconds so new keyboards (USB plug-in, Bluetooth reconnect) get the hotkey too. ultimateASR registers once and never rescans.  **(S, P2)**

### Nice-to-have (parity polish)

- [ ] **Recording-mode toggle in tray menu** — switch between silence and button mode without opening Settings. `whisperLocal/ui/main_window.py` shows it; ours doesn't.  **(S, P2)**
- [ ] **Systemd user service** — auto-start on login + `Restart=on-failure`. The original `whisperLocal/packaging/whisper2text.service` is the template. Ship it as part of the Linux deb postinst.  **(M, P2)**
- [ ] **Startup diagnostics log** — `whisperLocal/config/startup_diagnostics.py` logs ONNX/CUDA capability + driver versions on every start. Useful for bug reports. Port into the sidecar.  **(S, P2)**
- [ ] **Tests dropped during the port** — port these from `whisperLocal/tests/`:
  - `test_hotkey.py` — Wayland evdev path. Important once we re-implement the fallback.
  - `test_paste_realistic.py` and `test_autopaste_e2e.py` — paste behaviour edge cases.
  - `test_process_lock.py` — only relevant if we ever move single-instance off Electron's `requestSingleInstanceLock`.  **(M, P2)**

### Won't-port (intentional changes)

- ~~PyQt5 main window~~ — replaced by Electron + React + shadcn/ui. The new UI exists; rich features like the error panel still need porting per above.
- ~~Process lock in Python~~ — Electron's `app.requestSingleInstanceLock()` does the job.
- ~~`whisper2text.spec` PyInstaller spec~~ — replaced by `sidecar/ultimate_asr.spec`, narrower in scope (just the sidecar, not the whole app).

## 4. Non-blocking polish

- [ ] **Real app icon.** `assets/icon.png` is a teal placeholder. Replace with proper artwork at 256×256 (electron-builder generates the rest).
- [ ] **Code signing.** Windows NSIS is unsigned (users will see "unverified publisher"); macOS DMG is unsigned and not notarized. Costs an Apple Developer ID + an Authenticode cert.
- [ ] **README screenshots.** README has a `<!-- TODO: capture screenshots -->` placeholder.
- [ ] **shadcn primitives over native HTML.** Settings page uses `<select>`, `<input type="range">`, `<progress>` instead of shadcn `Select` / `Slider` / `Progress`. Functional but less polished. Audit flagged this as styling debt.
- [ ] **Phase 12: Neon cloud sync.** Optional opt-in transcript + vocabulary sync. Deliberately scoped out of v0.1.0.
- [ ] **Light mode.** Tokens exist in `styles.css` but there's no theme toggle yet — app currently always renders in light mode (the body uses `bg-background` which is light by default; no `class="dark"` is set anywhere).
- [ ] **Window position persistence.** Currently launches at default 980×720 each time.

## 5. Testing checklist

The contract for "tested":

| Layer | How | Frequency |
|---|---|---|
| Sidecar units | `cd sidecar && source .venv/bin/activate && pytest -q` | every commit (CI) |
| Renderer + main units | `corepack pnpm test` | every commit (CI) |
| TypeScript | `corepack pnpm typecheck` | every commit (CI) |
| Renderer bundle | `corepack pnpm exec vite build` | CI |
| Main bundle | `corepack pnpm exec vite build -c vite.main.config.ts` | CI |
| Playwright E2E | `xvfb-run -a corepack pnpm exec playwright test` | CI on Linux; manual on macOS/Win |
| PyInstaller sidecar | `corepack pnpm sidecar:build` then run the binary with stdin RPC | manual + release workflow |
| Installer build | `corepack pnpm package` | release workflow |
| Smoke install on real OS | install + dictate one sentence | release manual |

**CI status today:** the `.github/workflows/ci.yml` matrix runs unit tests on Ubuntu + macOS + Windows but has not actually been pushed against. First test will happen on the next PR.

## 6. Benchmark plan: ultimateASR vs whisperLocal

Both apps share the same engine code (whisper.cpp, Parakeet via sherpa-onnx). The audio capture, VAD, and vocabulary biasing are byte-identical ports. **In theory the transcripts must match word-for-word given the same input audio + model.** The benchmark exists to (a) catch regressions if the port wasn't quite verbatim, and (b) measure overhead added by the sidecar + IPC layer.

### What we're measuring

| Metric | What it tells us |
|---|---|
| Text equality (whisperLocal output == ultimateASR output) | Port-fidelity check |
| WER vs ground truth | Both should be equal; baseline for future engine experiments |
| `engine.transcribe()` wall time (engine-only) | Pure model latency (should be identical) |
| End-to-end wall time (start_recording → text in clipboard) | Cost of Python sidecar + JSON-RPC + Electron IPC |
| Memory footprint (RSS) | Cost of Electron-vs-PyQt shell |

### Test corpus

- **Short (≤10s):** A single sentence. Use one of:
  - LibriSpeech `test-clean/1089/134686/1089-134686-0000.flac` ("He hoped there would be stew for dinner...")
  - Or record yourself reading a pangram ("The quick brown fox..."). Ground truth is whatever you read.
- **Medium (30–60s):** Multi-sentence passage. LibriSpeech has 30-second clips; or read the first paragraph of a Wikipedia article.
- **Long (5–15 min):** Read a full chapter or use a podcast snippet with a published transcript. LibriVox + matching ebook works.

Store under `bench/audio/{short,medium,long}.wav` (16 kHz mono PCM) plus matching `.txt` ground-truth files. **Don't commit large WAVs** — keep them in `.gitignore` and document the source URLs in `bench/README.md` so anyone can fetch them.

### Harness (sketch)

`bench/run.py` — single Python script, no Electron involved on either side. It:

1. Loads the same `.bin` model file from `~/.whisper2text/models/` (whisperLocal location) or `~/.ultimateasr/models/` (ultimateASR location). Make the path a CLI arg so we can point it at one shared model dir.
2. For each audio file:
   - Imports `whisperLocal.engine.whisper_engine.WhisperEngine` directly, instantiates, transcribes, times.
   - Subprocess-spawns `python -m ultimate_asr` (the sidecar), sends `{"method":"transcribe", ...}`, reads result, times.
   - Records wall time, output text, and (if ground truth exists) WER via `jiwer`.
3. Outputs a CSV: `audio,duration_s,whisperLocal_text,ultimateASR_text,equal?,whisperLocal_t,ultimateASR_t,whisperLocal_WER,ultimateASR_WER`.

Pseudocode:

```python
import jiwer, time, json, subprocess, sys, base64, wave, pathlib

def load_pcm(path):
    with wave.open(str(path)) as w:
        assert w.getframerate() == 16000 and w.getsampwidth() == 2 and w.getnchannels() == 1
        return w.readframes(w.getnframes())

def time_whisperlocal(model_path, pcm):
    sys.path.insert(0, "/home/zaia/Development/whisperLocal")
    from engine.whisper_engine import WhisperEngine
    eng = WhisperEngine(model_path); t0 = time.perf_counter()
    text = eng.transcribe(pcm); dt = time.perf_counter() - t0
    eng.unload(); return text, dt

def time_ultimateasr(model_path, pcm):
    proc = subprocess.Popen(
        [sys.executable, "-m", "ultimate_asr"],
        stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.PIPE,
        text=False, cwd="/home/zaia/Development/ultimateASR/sidecar")
    pcm_b64 = base64.b64encode(pcm).decode()
    msg = {"id": 1, "method": "transcribe", "params": {
        "engine_kind": "whisper-local", "pcm_b64": pcm_b64, "sample_rate": 16000,
        "model_path": model_path}}
    proc.stdin.write((json.dumps(msg) + "\n").encode()); proc.stdin.flush()
    t0 = time.perf_counter()
    line = proc.stdout.readline()
    dt = time.perf_counter() - t0
    proc.stdin.close(); proc.wait(timeout=5)
    return json.loads(line)["result"]["text"], dt

# main loop: glob bench/audio/*.wav, run both, print CSV
```

Caveats:

- The ultimateASR side launches a fresh sidecar per call, so model-load time dominates short-clip results. For a fair latency comparison, modify the harness to keep one sidecar alive across multiple calls (it's a long-running process — that's its design).
- whisperLocal's engine load is also one-shot, so for the side-by-side either both should be fresh or both warm. Run both modes.
- For the "end-to-end" metric (record→clipboard) you have to drive the actual Electron app, which means a Playwright test that can issue keyboard events to a system-level mic recording. Skip this for v0.1.0 — engine-only benchmarks are enough to prove fidelity.

### Acceptance bar

- **Text:** ultimateASR and whisperLocal produce the same string for the same `.wav` + same model. Bit-for-bit. If they don't, the port has drifted.
- **WER:** identical (both numbers from the same engine on the same audio).
- **Engine-only latency:** within 5% of each other (sidecar JSON-encoding overhead is the only extra work).
- **Cold-start sidecar latency:** + 1–3 s vs whisperLocal (Python interpreter + module imports). Acceptable for a process kept warm by Electron.

## 7. Suggested order of work

1. `pnpm dev` smoke (item 2.1) — fix whatever breaks. **Until this works, nothing else matters.**
2. Real recording → tray transcript (item 2.4) — proves the wiring.
3. PyInstaller sidecar build (item 2.7) — proves the package can ship.
4. Tag `v0.1.0-rc1`, let CI build installers, install one on a clean VM (item 2.8 + 2.9).
5. Bench harness (section 6) — confirms port fidelity. If text differs, audit the port before going further.
6. Parity-blocker gaps (section 3, "Must-port"): error panel, dynamic tray text, input-group helper, evdev hotkey.
7. Tag `v0.1.0`. Polish + screenshots + signing + Phase 12 are all post-1.0.

## 8. Open questions

- **Model storage location.** whisperLocal uses `~/.whisper2text/models/`; ultimateASR uses per-OS userData. For Linux developers running both, we should support a single shared dir via `ULTIMATEASR_DATA_DIR` (already supported by the sidecar). Document this in `INSTALL.md`.
- **Cloud STT catalogue.** ultimateASR currently lets the user paste an OpenAI key but does not surface "select cloud-openai" as an engine in `Models` page (it lives in `Settings → Engine` instead). Decide whether to merge those two surfaces.
- **OpenRouter for cleanup.** The OpenAI provider already accepts a custom `endpoint`, so OpenRouter works without code changes. Document this in `INSTALL.md` so users discover it.
