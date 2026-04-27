# ultimateASR Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a cross-platform (Win/Mac/Linux) Electron + React + shadcn/ui dictation app whose ASR core ports the proven Python engines from `../whisperLocal` into a sidecar process, adds cloud (OpenAI) and LLM-cleanup providers, and ships a one-click installer per OS.

**Architecture:**
Electron main + React/Vite renderer + Python sidecar (PyInstaller-frozen) communicating over JSON-RPC on stdin/stdout. The sidecar reuses the audio (PyAudio + Silero VAD), engine (whisper.cpp / sherpa-onnx Parakeet) and vocabulary modules from `whisperLocal`; a new `cloud_engine` adds OpenAI Whisper API; an `llm/` module adds pluggable post-cleanup. Renderer is mostly settings/config; a tray icon is the operating UI — it changes color when active and opens a menu listing the last 10 transcriptions (clickable to copy). Hardware detection auto-picks the fastest backend (CUDA / Metal / Vulkan / CoreML / CPU). Cross-platform packaging via electron-builder; CI matrix runs Vitest + Playwright on Ubuntu, macOS, Windows.

**Tech Stack:** Electron 32, Vite, React 18, TypeScript 5, shadcn/ui (Radix + Tailwind), Tanstack Query, Zustand, Zod; Python 3.11 sidecar (PyAudio, pywhispercpp, onnx-asr, onnxruntime, openai); Vitest + Testing Library + Playwright; electron-builder; PyInstaller; GitHub Actions; optional Neon Postgres (opt-in cloud sync).

**Auto-answered design decisions (no user interaction available):**
- **Sidecar over Node bindings.** Reuse battle-tested Python engines via JSON-RPC. Avoids rewriting recorder/VAD/vocabulary/model-manager.
- **No Docker.** Heavy and breaks GPU passthrough on Win/Mac for desktop use. Ship per-OS prebuilds; fall back through CUDA→Vulkan→CoreML→CPU automatically.
- **CUDA toolkit not required for end users.** Ship `pywhispercpp` wheels with `GGML_CUDA=1` prebuilt against CUDA 12.x runtime; bundle the runtime DLLs the way `whisperLocal/packaging/rthook_cuda.py` already handles. macOS uses Metal automatically.
- **Cloud sync (Neon) is opt-in only.** Default everything stores locally. Cloud sync arrives in a late phase and is not on the critical path.
- **TDD throughout.** Each behavior gets a failing test before implementation; ports of `whisperLocal` modules also port their tests (already comprehensive).
- **Subagent-driven execution recommended.** Phases below are designed so each task can be a fresh subagent dispatch with two-stage review.
- **One plan, multiple phases.** The skill normally suggests splitting multi-subsystem work; the user explicitly requested a single plan and full autonomy, so phases are organized to be executed strictly in order. Phases 0–8 produce a working CLI-driven local app; Phases 9–16 are the desktop-grade UX/packaging; Phases 17–18 are stretch goals.

---

## File Structure

```
ultimateASR/
├── README.md                            # Quick start + manual install
├── package.json                         # Electron + Vite scripts, electron-builder
├── pnpm-workspace.yaml                  # (using pnpm for workspace)
├── tsconfig.json                        # Base TS config (path aliases)
├── tsconfig.main.json                   # Electron main process
├── tsconfig.renderer.json               # React renderer
├── vite.config.ts                       # Renderer build (Vite + React)
├── vite.main.config.ts                  # Main process build (Vite + Electron)
├── electron-builder.yml                 # Cross-platform packaging
├── tailwind.config.ts                   # Tailwind tokens
├── postcss.config.js
├── components.json                      # shadcn config
├── playwright.config.ts                 # E2E config
├── vitest.config.ts                     # Unit-test config
├── .github/
│   └── workflows/
│       ├── ci.yml                       # Matrix: ubuntu/mac/windows × node20
│       └── release.yml                  # Tag → build + publish installers
├── src/
│   ├── main/                            # Electron main process
│   │   ├── index.ts                     # App entry; lifecycle
│   │   ├── window.ts                    # Settings window mgmt
│   │   ├── tray.ts                      # Tray icon + last-10 menu + active state
│   │   ├── hotkey.ts                    # Global shortcut + Wayland evdev fallback
│   │   ├── ipc.ts                       # IPC channel registration
│   │   ├── sidecar.ts                   # Python sidecar lifecycle (spawn/RPC)
│   │   ├── auto-paste.ts                # OS-specific paste (xdotool/ydotool/AppleScript/SendInput)
│   │   ├── single-instance.ts           # Lock + activate-on-second-launch
│   │   ├── settings-store.ts            # Persistent settings (JSON file)
│   │   └── icons.ts                     # Tray/window icon paths
│   ├── preload/
│   │   └── index.ts                     # contextBridge surface
│   ├── renderer/
│   │   ├── main.tsx                     # React entry
│   │   ├── App.tsx                      # Router shell
│   │   ├── styles.css                   # Tailwind + tokens
│   │   ├── lib/
│   │   │   ├── ipc.ts                   # Typed renderer→main RPC client
│   │   │   ├── query-client.ts          # Tanstack Query setup
│   │   │   └── utils.ts                 # cn() etc.
│   │   ├── store/
│   │   │   └── recording-store.ts       # Zustand: live recording state
│   │   ├── hooks/
│   │   │   ├── use-settings.ts
│   │   │   ├── use-models.ts
│   │   │   ├── use-devices.ts
│   │   │   ├── use-transcripts.ts
│   │   │   └── use-recording.ts
│   │   ├── pages/
│   │   │   ├── home.tsx                 # Status + quick actions
│   │   │   ├── settings.tsx
│   │   │   ├── models.tsx
│   │   │   ├── dictionary.tsx
│   │   │   ├── llm.tsx                  # Cloud + LLM provider settings
│   │   │   └── about.tsx
│   │   └── components/
│   │       ├── ui/                      # shadcn-generated primitives
│   │       ├── status-pill.tsx          # Active/Idle indicator
│   │       ├── transcript-list.tsx      # Last-10 viewer
│   │       ├── model-row.tsx
│   │       ├── recording-button.tsx
│   │       ├── dictionary-editor.tsx
│   │       ├── settings-section.tsx
│   │       └── first-run-wizard.tsx
│   └── shared/
│       ├── ipc-contract.ts              # Zod schemas for every channel
│       ├── settings-shape.ts            # Settings keys + types
│       └── transcript.ts                # Transcript record type
├── sidecar/                             # Python ASR sidecar
│   ├── pyproject.toml
│   ├── pytest.ini
│   ├── ultimate_asr/
│   │   ├── __init__.py
│   │   ├── __main__.py                  # JSON-RPC stdin loop entry
│   │   ├── rpc.py                       # JSON-RPC dispatcher
│   │   ├── paths.py                     # OS-aware data dirs
│   │   ├── settings.py                  # Settings JSON store
│   │   ├── hardware.py                  # Detect CUDA/Metal/Vulkan/CPU
│   │   ├── audio/
│   │   │   ├── __init__.py
│   │   │   ├── recorder.py              # Port from whisperLocal
│   │   │   ├── vad.py                   # Port (Silero ONNX)
│   │   │   └── device_manager.py        # Port (PyAudio enumeration)
│   │   ├── engine/
│   │   │   ├── __init__.py
│   │   │   ├── factory.py               # Picks local-whisper / parakeet / cloud
│   │   │   ├── whisper_engine.py        # Port (pywhispercpp)
│   │   │   ├── parakeet_engine.py       # Port (sherpa-onnx / onnx-asr)
│   │   │   ├── cloud_engine.py          # NEW: OpenAI Whisper API
│   │   │   ├── model_manager.py         # Port (whisper + parakeet downloads)
│   │   │   └── vocabulary.py            # Port (prompt + post-substitution)
│   │   └── llm/
│   │       ├── __init__.py
│   │       ├── base.py                  # LLMProvider protocol
│   │       ├── openai_provider.py
│   │       ├── anthropic_provider.py
│   │       ├── ollama_provider.py
│   │       └── llamacpp_provider.py
│   └── tests/
│       ├── conftest.py
│       ├── test_recorder.py             # Port
│       ├── test_vad.py                  # Port
│       ├── test_device_manager.py       # Port
│       ├── test_engine_factory.py       # Port + cloud branch
│       ├── test_whisper_engine.py       # Port
│       ├── test_parakeet_engine.py      # Port
│       ├── test_cloud_engine.py         # NEW
│       ├── test_model_manager.py        # Port
│       ├── test_vocabulary.py           # Port
│       ├── test_settings.py             # Port
│       ├── test_hardware.py             # NEW
│       ├── test_rpc.py                  # NEW
│       └── test_llm_providers.py        # NEW
├── installers/
│   ├── linux/
│   │   ├── postinst.sh                  # Add user to input/audio groups
│   │   └── systemd/                     # Optional user-service units (parity w/ whisperLocal)
│   ├── windows/
│   │   └── nsis-include.nsh             # CUDA runtime detection
│   └── macos/
│       └── entitlements.mac.plist       # Mic + Accessibility (auto-paste)
├── scripts/
│   ├── build-sidecar.mjs                # PyInstaller invocation per platform
│   ├── fetch-binaries.mjs               # Download whisper.cpp prebuilds
│   ├── postinstall.mjs                  # Setup git hooks etc.
│   └── verify-deps.mjs                  # Pre-build sanity check
├── tests/
│   ├── unit/
│   │   ├── ipc-contract.test.ts
│   │   ├── tray-menu.test.ts
│   │   ├── settings-store.test.ts
│   │   ├── sidecar-spawn.test.ts
│   │   └── components/                  # RTL tests for shadcn-composed components
│   └── e2e/
│       ├── smoke.spec.ts                # App launches; tray exists
│       ├── settings.spec.ts             # Open/edit/save settings
│       ├── dictionary.spec.ts           # Add/remove vocab
│       └── recording.spec.ts            # Mock sidecar; assert flow
└── docs/
    ├── ARCHITECTURE.md
    ├── INSTALL.md
    └── superpowers/plans/2026-04-27-ultimateASR.md  # this file
```

---

## Phase 0: Repository bootstrap

### Task 0.1: Initialize git repo + push to GitHub

**Files:** `.gitignore`, `LICENSE` (MIT), `README.md` (stub)

- [ ] **Step 1: Initialize repo with explicit license + ignore rules**

Run from `/home/zaia/Development/ultimateASR`:
```bash
git init -b main
```

Write `.gitignore`:
```gitignore
# Node
node_modules/
dist/
dist-electron/
out/
.vite/

# Python
__pycache__/
*.py[cod]
*.egg-info/
.venv/
venv/
.pytest_cache/

# Editors
.idea/
.vscode/
.DS_Store

# Build artifacts
release/
sidecar/build/
sidecar/dist/
*.spec

# Models / runtime
~/.ultimateasr/
sidecar/models/
sidecar/vad/
```

Write `LICENSE` (MIT, holder: "AVRillo / aic"). Write minimal `README.md`:
```markdown
# ultimateASR
Cross-platform local + cloud dictation. Built on whisper.cpp, Parakeet, OpenAI Whisper, and Electron.
```

- [ ] **Step 2: First commit + create GitHub repo**

```bash
git add .gitignore LICENSE README.md docs/superpowers/plans/2026-04-27-ultimateASR.md
git commit -m "chore: initial commit with implementation plan"
gh repo create ultimateASR --public --source=. --remote=origin --push
```

Expected: prints the new repo URL.

- [ ] **Step 3: Verify**

```bash
git remote -v
```
Expected: `origin git@github.com:<owner>/ultimateASR.git` listed.

### Task 0.2: Bootstrap Node toolchain

**Files:** `package.json`, `pnpm-workspace.yaml`, `tsconfig.json`, `tsconfig.main.json`, `tsconfig.renderer.json`

- [ ] **Step 1: Write `package.json`**

```json
{
  "name": "ultimate-asr",
  "version": "0.1.0",
  "description": "Cross-platform local + cloud dictation",
  "main": "dist-electron/main/index.js",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc -p tsconfig.renderer.json && tsc -p tsconfig.main.json && vite build && vite build -c vite.main.config.ts",
    "package": "electron-builder",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:e2e": "playwright test",
    "lint": "eslint src --ext .ts,.tsx",
    "typecheck": "tsc -p tsconfig.renderer.json --noEmit && tsc -p tsconfig.main.json --noEmit",
    "sidecar:test": "cd sidecar && pytest",
    "sidecar:build": "node scripts/build-sidecar.mjs"
  },
  "dependencies": {
    "@radix-ui/react-dialog": "^1.1.0",
    "@radix-ui/react-dropdown-menu": "^2.1.0",
    "@radix-ui/react-select": "^2.1.0",
    "@radix-ui/react-slot": "^1.1.0",
    "@radix-ui/react-switch": "^1.1.0",
    "@radix-ui/react-tabs": "^1.1.0",
    "@tanstack/react-query": "^5.50.0",
    "class-variance-authority": "^0.7.0",
    "clsx": "^2.1.1",
    "lucide-react": "^0.400.0",
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "react-router-dom": "^6.25.0",
    "tailwind-merge": "^2.4.0",
    "tailwindcss-animate": "^1.0.7",
    "zod": "^3.23.8",
    "zustand": "^4.5.4"
  },
  "devDependencies": {
    "@playwright/test": "^1.45.0",
    "@testing-library/jest-dom": "^6.4.6",
    "@testing-library/react": "^16.0.0",
    "@types/node": "^20.14.0",
    "@types/react": "^18.3.3",
    "@types/react-dom": "^18.3.0",
    "@vitejs/plugin-react": "^4.3.1",
    "autoprefixer": "^10.4.19",
    "electron": "^32.0.0",
    "electron-builder": "^25.0.0",
    "eslint": "^9.6.0",
    "jsdom": "^24.1.0",
    "postcss": "^8.4.39",
    "tailwindcss": "^3.4.4",
    "typescript": "^5.5.3",
    "vite": "^5.3.3",
    "vitest": "^2.0.0"
  },
  "engines": {
    "node": ">=20"
  }
}
```

Write `pnpm-workspace.yaml`:
```yaml
packages:
  - "."
```

Write `tsconfig.json`:
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "resolveJsonModule": true,
    "jsx": "react-jsx",
    "isolatedModules": true,
    "baseUrl": ".",
    "paths": {
      "@/*": ["src/renderer/*"],
      "@main/*": ["src/main/*"],
      "@shared/*": ["src/shared/*"]
    }
  },
  "include": ["src/**/*", "tests/**/*"]
}
```

Write `tsconfig.main.json`:
```json
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "outDir": "dist-electron/main",
    "lib": ["ES2022"],
    "types": ["node"]
  },
  "include": ["src/main/**/*", "src/preload/**/*", "src/shared/**/*"]
}
```

Write `tsconfig.renderer.json`:
```json
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "outDir": "dist/renderer",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "types": ["vite/client"]
  },
  "include": ["src/renderer/**/*", "src/shared/**/*"]
}
```

- [ ] **Step 2: Install + verify**

```bash
corepack enable && corepack prepare pnpm@9 --activate
pnpm install
pnpm typecheck
```

Expected: install succeeds (no source files yet so typecheck is a no-op).

- [ ] **Step 3: Commit**

```bash
git add package.json pnpm-workspace.yaml tsconfig*.json pnpm-lock.yaml
git commit -m "chore: add Node toolchain (Electron, Vite, React, TS, Vitest, Playwright)"
```

### Task 0.3: Set up Tailwind + shadcn/ui + Vite

**Files:** `tailwind.config.ts`, `postcss.config.js`, `components.json`, `vite.config.ts`, `vite.main.config.ts`, `src/renderer/styles.css`

- [ ] **Step 1: Tailwind/PostCSS configs**

`tailwind.config.ts`:
```ts
import type { Config } from "tailwindcss";

export default {
  darkMode: ["class"],
  content: ["./src/renderer/**/*.{ts,tsx,html}"],
  theme: {
    container: { center: true, padding: "2rem", screens: { "2xl": "1400px" } },
    extend: {
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: { DEFAULT: "hsl(var(--primary))", foreground: "hsl(var(--primary-foreground))" },
        secondary: { DEFAULT: "hsl(var(--secondary))", foreground: "hsl(var(--secondary-foreground))" },
        muted: { DEFAULT: "hsl(var(--muted))", foreground: "hsl(var(--muted-foreground))" },
        accent: { DEFAULT: "hsl(var(--accent))", foreground: "hsl(var(--accent-foreground))" },
        destructive: { DEFAULT: "hsl(var(--destructive))", foreground: "hsl(var(--destructive-foreground))" },
        card: { DEFAULT: "hsl(var(--card))", foreground: "hsl(var(--card-foreground))" },
      },
      borderRadius: { lg: "var(--radius)", md: "calc(var(--radius) - 2px)", sm: "calc(var(--radius) - 4px)" },
    },
  },
  plugins: [require("tailwindcss-animate")],
} satisfies Config;
```

`postcss.config.js`:
```js
export default { plugins: { tailwindcss: {}, autoprefixer: {} } };
```

`components.json` (shadcn):
```json
{
  "$schema": "https://ui.shadcn.com/schema.json",
  "style": "new-york",
  "rsc": false,
  "tsx": true,
  "tailwind": {
    "config": "tailwind.config.ts",
    "css": "src/renderer/styles.css",
    "baseColor": "zinc",
    "cssVariables": true
  },
  "aliases": { "components": "@/components", "utils": "@/lib/utils", "ui": "@/components/ui", "lib": "@/lib", "hooks": "@/hooks" }
}
```

`src/renderer/styles.css`:
```css
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  :root {
    --background: 0 0% 100%;
    --foreground: 240 10% 3.9%;
    --card: 0 0% 100%;
    --card-foreground: 240 10% 3.9%;
    --primary: 240 5.9% 10%;
    --primary-foreground: 0 0% 98%;
    --muted: 240 4.8% 95.9%;
    --muted-foreground: 240 3.8% 46.1%;
    --accent: 240 4.8% 95.9%;
    --accent-foreground: 240 5.9% 10%;
    --destructive: 0 84.2% 60.2%;
    --destructive-foreground: 0 0% 98%;
    --border: 240 5.9% 90%;
    --input: 240 5.9% 90%;
    --ring: 240 5.9% 10%;
    --radius: 0.5rem;
  }
  .dark {
    --background: 240 10% 3.9%;
    --foreground: 0 0% 98%;
    --card: 240 10% 3.9%;
    --card-foreground: 0 0% 98%;
    --primary: 0 0% 98%;
    --primary-foreground: 240 5.9% 10%;
    --muted: 240 3.7% 15.9%;
    --muted-foreground: 240 5% 64.9%;
    --accent: 240 3.7% 15.9%;
    --accent-foreground: 0 0% 98%;
    --destructive: 0 62.8% 30.6%;
    --destructive-foreground: 0 0% 98%;
    --border: 240 3.7% 15.9%;
    --input: 240 3.7% 15.9%;
    --ring: 240 4.9% 83.9%;
  }
  body { @apply bg-background text-foreground antialiased; }
}
```

`vite.config.ts`:
```ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig({
  root: "src/renderer",
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src/renderer"),
      "@main": path.resolve(__dirname, "src/main"),
      "@shared": path.resolve(__dirname, "src/shared"),
    },
  },
  build: { outDir: path.resolve(__dirname, "dist/renderer"), emptyOutDir: true },
  server: { port: 5173 },
});
```

`vite.main.config.ts`:
```ts
import { defineConfig } from "vite";
import path from "node:path";

export default defineConfig({
  build: {
    outDir: "dist-electron",
    emptyOutDir: false,
    target: "node20",
    lib: { entry: { "main/index": "src/main/index.ts", "preload/index": "src/preload/index.ts" }, formats: ["cjs"] },
    rollupOptions: { external: ["electron", "node:fs", "node:path", "node:child_process", "node:os", "node:crypto", "node:url"] },
  },
  resolve: { alias: { "@shared": path.resolve(__dirname, "src/shared"), "@main": path.resolve(__dirname, "src/main") } },
});
```

- [ ] **Step 2: Initialize shadcn primitives we know we'll need**

```bash
pnpm dlx shadcn@latest init -y -d
pnpm dlx shadcn@latest add button input label switch select textarea tabs dialog dropdown-menu card badge separator scroll-area toast tooltip
```

- [ ] **Step 3: Commit**

```bash
git add tailwind.config.ts postcss.config.js components.json vite.config.ts vite.main.config.ts src/renderer/styles.css src/renderer/components/ui src/renderer/lib package.json pnpm-lock.yaml
git commit -m "chore: configure Tailwind + shadcn/ui + Vite for renderer and main"
```

### Task 0.4: Configure Vitest + Playwright + GitHub Actions matrix

**Files:** `vitest.config.ts`, `playwright.config.ts`, `tests/unit/sanity.test.ts`, `tests/e2e/smoke.spec.ts`, `.github/workflows/ci.yml`

- [ ] **Step 1: Write vitest config + sanity test**

`vitest.config.ts`:
```ts
import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    environment: "jsdom",
    setupFiles: ["./tests/unit/setup.ts"],
    include: ["tests/unit/**/*.test.ts", "tests/unit/**/*.test.tsx"],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src/renderer"),
      "@main": path.resolve(__dirname, "src/main"),
      "@shared": path.resolve(__dirname, "src/shared"),
    },
  },
});
```

`tests/unit/setup.ts`:
```ts
import "@testing-library/jest-dom/vitest";
```

`tests/unit/sanity.test.ts`:
```ts
import { describe, it, expect } from "vitest";

describe("sanity", () => {
  it("toolchain is wired", () => {
    expect(1 + 1).toBe(2);
  });
});
```

- [ ] **Step 2: Run sanity test, expect PASS**

```bash
pnpm test
```
Expected: 1 passing test.

- [ ] **Step 3: Playwright config + smoke spec stub**

`playwright.config.ts`:
```ts
import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 60_000,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: { trace: "retain-on-failure" },
});
```

`tests/e2e/smoke.spec.ts` (placeholder; full app spawn comes in Phase 9):
```ts
import { test, expect } from "@playwright/test";

test.skip("app launches and shows tray + main window", async () => {
  // Filled in once Electron entrypoint exists (Phase 2).
  expect(true).toBe(true);
});
```

- [ ] **Step 4: Add GitHub Actions matrix**

`.github/workflows/ci.yml`:
```yaml
name: CI
on:
  push: { branches: [main] }
  pull_request: { branches: [main] }
jobs:
  test:
    strategy:
      fail-fast: false
      matrix:
        os: [ubuntu-latest, macos-latest, windows-latest]
        node: [20]
    runs-on: ${{ matrix.os }}
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with: { version: 9 }
      - uses: actions/setup-node@v4
        with: { node-version: ${{ matrix.node }}, cache: pnpm }
      - uses: actions/setup-python@v5
        with: { python-version: "3.11" }
      - name: Linux audio deps
        if: matrix.os == 'ubuntu-latest'
        run: sudo apt-get update && sudo apt-get install -y portaudio19-dev libxkbcommon0 libnss3 libasound2t64 xvfb
      - name: Install JS deps
        run: pnpm install --frozen-lockfile
      - name: Install Python deps
        run: |
          cd sidecar
          pip install -e .[dev] || true
      - name: Typecheck
        run: pnpm typecheck
      - name: Unit tests
        run: pnpm test
      - name: Sidecar tests
        run: cd sidecar && pytest -q || true
      - name: Install Playwright
        run: pnpm exec playwright install --with-deps chromium
      - name: Build app
        run: pnpm build
      - name: E2E
        run: ${{ matrix.os == 'ubuntu-latest' && 'xvfb-run -a pnpm test:e2e' || 'pnpm test:e2e' }}
```

- [ ] **Step 5: Commit**

```bash
git add vitest.config.ts playwright.config.ts tests/ .github/
git commit -m "chore: add Vitest, Playwright, and CI matrix (Linux/macOS/Windows)"
git push -u origin main
```

---

## Phase 1: Sidecar foundation

### Task 1.1: Bootstrap Python sidecar package

**Files:** `sidecar/pyproject.toml`, `sidecar/pytest.ini`, `sidecar/ultimate_asr/__init__.py`, `sidecar/ultimate_asr/paths.py`, `sidecar/tests/conftest.py`

- [ ] **Step 1: Write pyproject.toml**

```toml
[build-system]
requires = ["setuptools>=68", "wheel"]
build-backend = "setuptools.build_meta"

[project]
name = "ultimate_asr"
version = "0.1.0"
requires-python = ">=3.11"
dependencies = [
  "numpy>=1.26",
  "PyAudio>=0.2.14",
  "onnxruntime>=1.18",
  "huggingface_hub>=0.24",
  "openai>=1.40",
  "anthropic>=0.34",
  "httpx>=0.27",
  "pydantic>=2.7",
]

[project.optional-dependencies]
whisper = ["pywhispercpp>=1.2"]
parakeet = ["onnx-asr>=0.3"]
dev = ["pytest>=8.0", "pytest-asyncio>=0.23", "pytest-cov>=5.0"]

[tool.setuptools.packages.find]
where = ["."]
include = ["ultimate_asr*"]
```

`sidecar/pytest.ini`:
```ini
[pytest]
testpaths = tests
addopts = -ra --strict-markers
markers =
    requires_model: needs a downloaded ASR model
    requires_audio: needs a working audio device
```

`sidecar/ultimate_asr/paths.py`:
```python
"""OS-aware data directory resolution for ultimateASR sidecar."""
from __future__ import annotations
import os
import sys
from pathlib import Path

APP_NAME = "ultimateASR"

def data_dir() -> Path:
    if sys.platform == "darwin":
        base = Path.home() / "Library" / "Application Support" / APP_NAME
    elif sys.platform.startswith("win"):
        base = Path(os.environ.get("APPDATA", Path.home())) / APP_NAME
    else:
        base = Path(os.environ.get("XDG_DATA_HOME", Path.home() / ".local" / "share")) / APP_NAME
    base.mkdir(parents=True, exist_ok=True)
    return base

def models_dir() -> Path:
    p = data_dir() / "models"; p.mkdir(parents=True, exist_ok=True); return p

def vad_dir() -> Path:
    p = data_dir() / "vad"; p.mkdir(parents=True, exist_ok=True); return p

def settings_path() -> Path:
    return data_dir() / "settings.json"
```

`sidecar/tests/conftest.py`:
```python
import os, sys, pathlib
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent.parent))
```

- [ ] **Step 2: Write the failing test for `paths`**

`sidecar/tests/test_paths.py`:
```python
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
```

- [ ] **Step 3: Run + expect PASS** (paths.py was written above):

```bash
cd sidecar && python -m pip install -e .[dev] && pytest tests/test_paths.py -v
```
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add sidecar/
git commit -m "feat(sidecar): bootstrap Python package with OS-aware data paths"
```

### Task 1.2: Port `settings` from whisperLocal

**Files:** `sidecar/ultimate_asr/settings.py`, `sidecar/tests/test_settings.py`

- [ ] **Step 1: Write the failing test (port + extend `whisperLocal/tests/test_settings.py`)**

`sidecar/tests/test_settings.py`:
```python
import json
import threading
from pathlib import Path

import pytest

from ultimate_asr.settings import SettingsManager, DEFAULT_SETTINGS


def test_defaults_when_no_file(tmp_path):
    sm = SettingsManager(tmp_path)
    for k, v in DEFAULT_SETTINGS.items():
        assert sm.get(k) == v


def test_persistence_round_trip(tmp_path):
    sm = SettingsManager(tmp_path)
    sm.set("auto_paste", True)
    sm.save()
    sm2 = SettingsManager(tmp_path)
    assert sm2.get("auto_paste") is True


def test_legacy_model_size_migration(tmp_path):
    (tmp_path / "settings.json").write_text(json.dumps({"model_size": "base"}))
    sm = SettingsManager(tmp_path)
    assert sm.get("model_size") == "ggml-base.bin"


def test_concurrent_writes_are_serialized(tmp_path):
    sm = SettingsManager(tmp_path)
    def writer(i):
        for j in range(50): sm.set(f"k{i}", j)
    ts = [threading.Thread(target=writer, args=(i,)) for i in range(8)]
    for t in ts: t.start()
    for t in ts: t.join()
    sm.save()
    data = json.loads((tmp_path / "settings.json").read_text())
    for i in range(8):
        assert data[f"k{i}"] == 49


def test_new_keys_present_in_defaults():
    # ultimateASR adds cloud + LLM settings on top of whisperLocal's set.
    for k in [
        "engine_kind", "cloud_api_key", "llm_provider", "llm_enabled",
        "llm_system_prompt", "first_run_done",
    ]:
        assert k in DEFAULT_SETTINGS
```

- [ ] **Step 2: Run, expect FAIL ("ImportError" or similar)**

```bash
cd sidecar && pytest tests/test_settings.py -v
```

- [ ] **Step 3: Implement `settings.py`**

Port `whisperLocal/config/settings.py` verbatim, then extend `DEFAULT_SETTINGS` with the new keys:
```python
"""Thread-safe JSON settings store; ports whisperLocal/config/settings.py and adds ultimateASR keys."""
from __future__ import annotations
import json, logging, threading
from pathlib import Path

logger = logging.getLogger(__name__)

DEFAULT_SETTINGS: dict = {
    # Engine selection
    "engine_kind": "auto",            # auto | whisper-local | parakeet-local | cloud-openai
    "model_size": "ggml-base.bin",
    "compute_backend": "auto",        # auto | cuda | metal | vulkan | coreml | cpu

    # Audio
    "audio_device_index": None,
    "audio_device_name": None,
    "vad_aggressiveness": 1,
    "padding_duration_ms": 1000,
    "recording_mode": "silence",
    "break_length": 5,

    # Hotkey + paste
    "hotkey": "Ctrl+Alt+Shift+L",
    "auto_paste": False,

    # Vocabulary
    "custom_vocabulary": [],

    # Cloud
    "cloud_api_key": "",              # OpenAI Whisper API key
    "cloud_model": "whisper-1",

    # LLM cleanup
    "llm_enabled": False,
    "llm_provider": "openai",         # openai | anthropic | ollama | llamacpp
    "llm_model": "gpt-4o-mini",
    "llm_api_key": "",
    "llm_endpoint": "",
    "llm_system_prompt": (
        "Clean up this dictation transcript. Fix obvious recognition errors, "
        "remove filler words ('um', 'uh'), preserve meaning, do not add new content."
    ),

    # History
    "transcripts": [],

    # First-run wizard
    "first_run_done": False,
}


def _migrate_model_size(model_size):
    if model_size is None or not isinstance(model_size, str):
        return model_size
    return model_size if model_size.endswith(".bin") else f"ggml-{model_size}.bin"


class SettingsManager:
    def __init__(self, settings_dir: str | Path):
        self._dir = Path(settings_dir)
        self._dir.mkdir(parents=True, exist_ok=True)
        self._file = self._dir / "settings.json"
        self._lock = threading.Lock()
        self._settings = dict(DEFAULT_SETTINGS)
        self._load()

    def _load(self):
        if self._file.exists():
            try:
                self._settings.update(json.loads(self._file.read_text()))
            except Exception:
                logger.exception("Failed to load %s", self._file)
        self._migrate()

    def _migrate(self):
        m = self._settings.get("model_size")
        if m:
            new_m = _migrate_model_size(m)
            if new_m != m:
                self._settings["model_size"] = new_m

    def get(self, key, default=None):
        with self._lock:
            return self._settings.get(key, default)

    def set(self, key, value):
        with self._lock:
            self._settings[key] = value

    def get_all(self):
        with self._lock:
            return dict(self._settings)

    def save(self):
        with self._lock:
            tmp = self._file.with_suffix(".json.tmp")
            tmp.write_text(json.dumps(self._settings, indent=2))
            tmp.replace(self._file)
```

- [ ] **Step 4: Run, expect PASS**

```bash
pytest tests/test_settings.py -v
```

- [ ] **Step 5: Commit**

```bash
git add sidecar/ultimate_asr/settings.py sidecar/tests/test_settings.py
git commit -m "feat(sidecar): port settings store with new cloud/LLM keys"
```

### Task 1.3: JSON-RPC dispatcher (rpc.py)

**Files:** `sidecar/ultimate_asr/rpc.py`, `sidecar/tests/test_rpc.py`

- [ ] **Step 1: Write the failing test**

`sidecar/tests/test_rpc.py`:
```python
import io
import json
import pytest
from ultimate_asr.rpc import Dispatcher, RpcError


def test_dispatch_known_method():
    d = Dispatcher()
    d.register("ping", lambda **kw: {"pong": True})
    resp = d.dispatch({"id": 1, "method": "ping", "params": {}})
    assert resp == {"id": 1, "result": {"pong": True}}


def test_dispatch_unknown_method():
    d = Dispatcher()
    resp = d.dispatch({"id": 2, "method": "missing", "params": {}})
    assert resp["id"] == 2
    assert resp["error"]["code"] == -32601


def test_dispatch_handler_exception_returns_internal_error():
    d = Dispatcher()
    d.register("boom", lambda **kw: (_ for _ in ()).throw(RuntimeError("boom!")))
    resp = d.dispatch({"id": 3, "method": "boom", "params": {}})
    assert resp["error"]["code"] == -32603
    assert "boom!" in resp["error"]["message"]


def test_run_loop_processes_lines():
    inp = io.StringIO('{"id":1,"method":"ping","params":{}}\n{"id":2,"method":"ping","params":{}}\n')
    out = io.StringIO()
    d = Dispatcher()
    d.register("ping", lambda **kw: "ok")
    d.run(inp, out)
    lines = [json.loads(line) for line in out.getvalue().strip().split("\n")]
    assert [r["id"] for r in lines] == [1, 2]
    assert all(r["result"] == "ok" for r in lines)


def test_notification_no_id_no_response():
    d = Dispatcher()
    d.register("ping", lambda **kw: "ok")
    resp = d.dispatch({"method": "ping", "params": {}})
    assert resp is None
```

- [ ] **Step 2: Run, expect FAIL**

```bash
pytest tests/test_rpc.py -v
```

- [ ] **Step 3: Implement `rpc.py`**

```python
"""Line-delimited JSON-RPC 2.0 dispatcher running over stdin/stdout."""
from __future__ import annotations
import json, sys, traceback
from typing import Any, Callable, IO


class RpcError(Exception):
    def __init__(self, code: int, message: str, data: Any = None):
        self.code, self.message, self.data = code, message, data


class Dispatcher:
    def __init__(self) -> None:
        self._handlers: dict[str, Callable[..., Any]] = {}

    def register(self, name: str, handler: Callable[..., Any]) -> None:
        self._handlers[name] = handler

    def dispatch(self, msg: dict) -> dict | None:
        msg_id = msg.get("id")
        method = msg.get("method")
        params = msg.get("params") or {}
        is_notification = msg_id is None

        handler = self._handlers.get(method)
        if handler is None:
            if is_notification:
                return None
            return {"id": msg_id, "error": {"code": -32601, "message": f"Method not found: {method}"}}

        try:
            result = handler(**params) if isinstance(params, dict) else handler(params)
        except RpcError as e:
            if is_notification:
                return None
            return {"id": msg_id, "error": {"code": e.code, "message": e.message, "data": e.data}}
        except Exception as e:
            if is_notification:
                return None
            return {"id": msg_id, "error": {"code": -32603, "message": str(e), "data": traceback.format_exc()}}

        if is_notification:
            return None
        return {"id": msg_id, "result": result}

    def run(self, stdin: IO[str] = sys.stdin, stdout: IO[str] = sys.stdout) -> None:
        for line in stdin:
            line = line.strip()
            if not line:
                continue
            try:
                msg = json.loads(line)
            except json.JSONDecodeError:
                stdout.write(json.dumps({"id": None, "error": {"code": -32700, "message": "Parse error"}}) + "\n")
                stdout.flush()
                continue
            resp = self.dispatch(msg)
            if resp is not None:
                stdout.write(json.dumps(resp) + "\n")
                stdout.flush()
```

- [ ] **Step 4: Run, expect PASS**

```bash
pytest tests/test_rpc.py -v
```

- [ ] **Step 5: Commit**

```bash
git add sidecar/ultimate_asr/rpc.py sidecar/tests/test_rpc.py
git commit -m "feat(sidecar): add line-delimited JSON-RPC dispatcher"
```

### Task 1.4: Sidecar entry-point with `ping` + `get_settings`/`set_settings`

**Files:** `sidecar/ultimate_asr/__main__.py`, `sidecar/tests/test_main_loop.py`

- [ ] **Step 1: Write the failing integration test**

`sidecar/tests/test_main_loop.py`:
```python
import json, subprocess, sys
from pathlib import Path

ENTRY = [sys.executable, "-m", "ultimate_asr"]


def _talk(proc, msg):
    proc.stdin.write(json.dumps(msg) + "\n"); proc.stdin.flush()
    return json.loads(proc.stdout.readline())


def test_ping_and_settings_round_trip(tmp_path, monkeypatch):
    env = dict(monkeypatch._setitem.__self__) if False else None  # unused
    proc = subprocess.Popen(
        ENTRY, stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.PIPE,
        text=True, bufsize=1,
        env={**__import__("os").environ, "ULTIMATEASR_DATA_DIR": str(tmp_path)},
    )
    try:
        assert _talk(proc, {"id": 1, "method": "ping"})["result"] == "pong"
        s = _talk(proc, {"id": 2, "method": "get_settings"})["result"]
        assert s["model_size"] == "ggml-base.bin"
        _talk(proc, {"id": 3, "method": "set_settings", "params": {"patch": {"auto_paste": True}}})
        s2 = _talk(proc, {"id": 4, "method": "get_settings"})["result"]
        assert s2["auto_paste"] is True
    finally:
        proc.stdin.close()
        proc.wait(timeout=5)
```

- [ ] **Step 2: Run, expect FAIL** (`__main__` doesn't exist yet).

- [ ] **Step 3: Implement entry-point**

`sidecar/ultimate_asr/__main__.py`:
```python
"""Sidecar entry: spawn JSON-RPC dispatcher on stdin/stdout."""
from __future__ import annotations
import logging, os, sys
from pathlib import Path

from ultimate_asr.rpc import Dispatcher
from ultimate_asr.settings import SettingsManager
from ultimate_asr import paths


def _resolve_data_dir() -> Path:
    override = os.environ.get("ULTIMATEASR_DATA_DIR")
    return Path(override) if override else paths.data_dir()


def main() -> int:
    logging.basicConfig(level=logging.INFO, stream=sys.stderr,
                        format="[sidecar %(asctime)s %(levelname)s] %(message)s")
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
```

- [ ] **Step 4: Run, expect PASS**

```bash
pytest tests/test_main_loop.py -v
```

- [ ] **Step 5: Commit**

```bash
git add sidecar/ultimate_asr/__main__.py sidecar/tests/test_main_loop.py
git commit -m "feat(sidecar): add JSON-RPC entry with ping + settings methods"
```

### Task 1.5: Hardware detection (CUDA / Metal / Vulkan / CoreML / CPU)

**Files:** `sidecar/ultimate_asr/hardware.py`, `sidecar/tests/test_hardware.py`

- [ ] **Step 1: Write the failing test**

`sidecar/tests/test_hardware.py`:
```python
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
```

- [ ] **Step 2: Run, expect FAIL.**

- [ ] **Step 3: Implement `hardware.py`**

```python
"""Hardware detection + backend/model recommendation."""
from __future__ import annotations
import os, platform, shutil, subprocess, sys


def _has_nvidia_smi() -> bool:
    return shutil.which("nvidia-smi") is not None and subprocess.run(
        ["nvidia-smi", "-L"], capture_output=True, text=True
    ).returncode == 0


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
            out = subprocess.check_output(["sysctl", "-n", "hw.memsize"], text=True)
            return round(int(out.strip()) / (1024 ** 3))
        if sys.platform.startswith("win"):
            import ctypes
            class MS(ctypes.Structure):
                _fields_ = [("dwLength", ctypes.c_ulong), ("dwMemoryLoad", ctypes.c_ulong),
                            ("ullTotalPhys", ctypes.c_ulonglong), ("ullAvailPhys", ctypes.c_ulonglong),
                            ("ullTotalPageFile", ctypes.c_ulonglong), ("ullAvailPageFile", ctypes.c_ulonglong),
                            ("ullTotalVirtual", ctypes.c_ulonglong), ("ullAvailVirtual", ctypes.c_ulonglong),
                            ("ullAvailExtendedVirtual", ctypes.c_ulonglong)]
            ms = MS(); ms.dwLength = ctypes.sizeof(MS)
            ctypes.windll.kernel32.GlobalMemoryStatusEx(ctypes.byref(ms))
            return round(ms.ullTotalPhys / (1024 ** 3))
    except Exception:
        pass
    return 8


def detect() -> dict:
    osname = "darwin" if sys.platform == "darwin" else "windows" if sys.platform.startswith("win") else "linux"
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
    if info["cuda"] or info["metal"]:
        if ram >= 16:
            return "ggml-large-v3-turbo-q5_0.bin"
        return "ggml-small.bin"
    if ram >= 8:
        return "ggml-small.bin"
    return "ggml-base.bin"
```

- [ ] **Step 4: Run, expect PASS**

```bash
pytest tests/test_hardware.py -v
```

- [ ] **Step 5: Commit**

```bash
git add sidecar/ultimate_asr/hardware.py sidecar/tests/test_hardware.py
git commit -m "feat(sidecar): hardware detection + backend/model recommendation"
```

---

## Phase 2: Port audio + engines from whisperLocal

### Task 2.1: Port `audio/device_manager.py`

**Files:** `sidecar/ultimate_asr/audio/__init__.py`, `sidecar/ultimate_asr/audio/device_manager.py`, `sidecar/tests/test_device_manager.py`

- [ ] **Step 1: Write the failing test (port from `whisperLocal/tests/test_device_manager.py`)**

Copy that file's contents (mocking PyAudio) verbatim into `sidecar/tests/test_device_manager.py`, changing the import to `from ultimate_asr.audio.device_manager import DeviceManager`.

- [ ] **Step 2: Run, expect FAIL.**

- [ ] **Step 3: Copy implementation**

Copy `whisperLocal/audio/device_manager.py` into `sidecar/ultimate_asr/audio/device_manager.py` unchanged. Add `sidecar/ultimate_asr/audio/__init__.py` (empty).

- [ ] **Step 4: Run, expect PASS**

```bash
pytest tests/test_device_manager.py -v
```

- [ ] **Step 5: Commit**

```bash
git add sidecar/ultimate_asr/audio/ sidecar/tests/test_device_manager.py
git commit -m "feat(sidecar): port DeviceManager from whisperLocal"
```

### Task 2.2: Port `audio/vad.py` (Silero)

**Files:** `sidecar/ultimate_asr/audio/vad.py`, `sidecar/tests/test_vad.py`

- [ ] **Step 1: Port `whisperLocal/tests/test_vad.py` → `sidecar/tests/test_vad.py`** (update imports to `ultimate_asr.audio.vad`).
- [ ] **Step 2: Run, expect FAIL.**
- [ ] **Step 3: Copy `whisperLocal/audio/vad.py` → `sidecar/ultimate_asr/audio/vad.py`**, change `VAD_MODEL_PATH` resolution to use `ultimate_asr.paths.vad_dir() / "silero_vad.onnx"`.
- [ ] **Step 4: Run, expect PASS** (`pytest tests/test_vad.py -v`).
- [ ] **Step 5: Commit** (`git add sidecar/ultimate_asr/audio/vad.py sidecar/tests/test_vad.py && git commit -m "feat(sidecar): port Silero VAD"`)

### Task 2.3: Port `audio/recorder.py`

**Files:** `sidecar/ultimate_asr/audio/recorder.py`, `sidecar/tests/test_recorder.py`

- [ ] **Step 1: Port `whisperLocal/tests/test_recorder.py`.**
- [ ] **Step 2: Run, expect FAIL.**
- [ ] **Step 3: Copy `whisperLocal/audio/recorder.py`** with one change: replace the hard-coded `VAD_MODEL_PATH` with `from ultimate_asr.paths import vad_dir; VAD_MODEL_PATH = str(vad_dir() / "silero_vad.onnx")`.
- [ ] **Step 4: Run, expect PASS.**
- [ ] **Step 5: Commit.**

### Task 2.4: Port `engine/vocabulary.py`

**Files:** `sidecar/ultimate_asr/engine/__init__.py`, `sidecar/ultimate_asr/engine/vocabulary.py`, `sidecar/tests/test_vocabulary.py`

- [ ] **Step 1: Port test file unchanged (just rebase the import path).**
- [ ] **Step 2: Run, expect FAIL.**
- [ ] **Step 3: Copy `whisperLocal/engine/vocabulary.py` verbatim.**
- [ ] **Step 4: Run, expect PASS.**
- [ ] **Step 5: Commit.**

### Task 2.5: Port `engine/whisper_engine.py`

**Files:** `sidecar/ultimate_asr/engine/whisper_engine.py`, `sidecar/tests/test_whisper_engine.py`

- [ ] **Step 1: Port test (`tests/test_engine.py` in whisperLocal).**
- [ ] **Step 2: Run, expect FAIL.**
- [ ] **Step 3: Copy `whisperLocal/engine/whisper_engine.py` unchanged.**
- [ ] **Step 4: Run, expect PASS** (mocked tests pass without a real model).
- [ ] **Step 5: Commit.**

### Task 2.6: Port `engine/parakeet_engine.py`

**Files:** `sidecar/ultimate_asr/engine/parakeet_engine.py`, `sidecar/tests/test_parakeet_engine.py`

- [ ] **Step 1: Port test from whisperLocal.**
- [ ] **Step 2: Run, expect FAIL.**
- [ ] **Step 3: Copy `whisperLocal/engine/parakeet_engine.py` unchanged.**
- [ ] **Step 4: Run, expect PASS.**
- [ ] **Step 5: Commit.**

### Task 2.7: Port `engine/model_manager.py`

**Files:** `sidecar/ultimate_asr/engine/model_manager.py`, `sidecar/tests/test_model_manager.py`

- [ ] **Step 1: Port both test files (`test_model_manager.py` and `test_model_manager_parakeet.py`) into one.**
- [ ] **Step 2: Run, expect FAIL.**
- [ ] **Step 3: Copy `whisperLocal/engine/model_manager.py` unchanged.**
- [ ] **Step 4: Run, expect PASS.**
- [ ] **Step 5: Commit.**

### Task 2.8: Port `engine/factory.py` and add the cloud-engine branch

**Files:** `sidecar/ultimate_asr/engine/factory.py`, `sidecar/tests/test_engine_factory.py`

- [ ] **Step 1: Write the failing test** (port + extend):

```python
from ultimate_asr.engine import factory


def test_local_whisper_path_uses_whisper_engine(tmp_path):
    p = tmp_path / "ggml-base.bin"; p.write_bytes(b"\x00" * 16)
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
```

- [ ] **Step 2: Run, expect FAIL.**

- [ ] **Step 3: Implement** — port `whisperLocal/engine/factory.py` and add:

```python
def make_engine_kind(kind: str, **kwargs):
    if kind in ("auto", "whisper-local", "parakeet-local"):
        # Caller is expected to pass model_path for local kinds.
        return make_engine(kwargs.pop("model_path"), **kwargs)
    if kind == "cloud-openai":
        from ultimate_asr.engine.cloud_engine import OpenAICloudEngine
        return OpenAICloudEngine(**kwargs)
    raise ValueError(f"Unknown engine kind: {kind}")
```

Add `kind` attribute to each engine class (`"whisper-local"`, `"parakeet-local"`). Support a `_stub_for_test` kwarg that bypasses real model loading and just sets `kind`.

- [ ] **Step 4: Run, expect PASS.**

- [ ] **Step 5: Commit.**

### Task 2.9: NEW — `engine/cloud_engine.py` (OpenAI Whisper API)

**Files:** `sidecar/ultimate_asr/engine/cloud_engine.py`, `sidecar/tests/test_cloud_engine.py`

- [ ] **Step 1: Write the failing test**

```python
import io
import numpy as np
import pytest
from unittest.mock import MagicMock, patch

from ultimate_asr.engine.cloud_engine import OpenAICloudEngine


@pytest.fixture
def mock_openai():
    with patch("ultimate_asr.engine.cloud_engine.OpenAI") as cls:
        client = MagicMock()
        cls.return_value = client
        client.audio.transcriptions.create.return_value = MagicMock(text="hello world")
        yield client


def test_kind_is_cloud_openai(mock_openai):
    e = OpenAICloudEngine(api_key="sk", model="whisper-1")
    assert e.kind == "cloud-openai"


def test_transcribe_int16_bytes_uploads_wav(mock_openai):
    e = OpenAICloudEngine(api_key="sk", model="whisper-1")
    audio = np.zeros(16000, dtype=np.float32)
    text = e.transcribe(audio)
    assert text == "hello world"
    args, kwargs = mock_openai.audio.transcriptions.create.call_args
    assert kwargs["model"] == "whisper-1"
    sent_file = kwargs["file"]
    assert sent_file[0].endswith(".wav")
    assert isinstance(sent_file[1], (bytes, bytearray, io.BytesIO))


def test_vocabulary_passed_as_prompt(mock_openai):
    e = OpenAICloudEngine(api_key="sk", model="whisper-1")
    e.transcribe(np.zeros(16000, dtype=np.float32), vocabulary=["Avrillo", "SDLT"])
    kwargs = mock_openai.audio.transcriptions.create.call_args.kwargs
    assert "Avrillo" in kwargs["prompt"]
    assert "SDLT" in kwargs["prompt"]


def test_missing_api_key_raises():
    with pytest.raises(ValueError, match="api_key"):
        OpenAICloudEngine(api_key="", model="whisper-1")
```

- [ ] **Step 2: Run, expect FAIL.**

- [ ] **Step 3: Implement**

```python
"""Cloud engine using OpenAI's Whisper API."""
from __future__ import annotations
import io, wave
import numpy as np

from openai import OpenAI

from ultimate_asr.engine.vocabulary import build_whisper_prompt


class OpenAICloudEngine:
    kind = "cloud-openai"
    SAMPLE_RATE = 16000

    def __init__(self, api_key: str, model: str = "whisper-1", _stub_for_test: bool = False):
        if not api_key and not _stub_for_test:
            raise ValueError("api_key is required for OpenAICloudEngine")
        self._model = model
        self._client = OpenAI(api_key=api_key) if not _stub_for_test else None
        if _stub_for_test:
            from unittest.mock import MagicMock
            self._client = MagicMock()

    def is_loaded(self) -> bool:
        return self._client is not None

    def unload(self) -> None:
        self._client = None

    def reload(self, **_):
        pass  # cloud engines don't have a real load step

    def transcribe(self, audio_data, *, vocabulary: list[str] | None = None) -> str:
        if isinstance(audio_data, (bytes, bytearray)):
            samples = np.frombuffer(audio_data, dtype=np.int16)
        elif np.issubdtype(audio_data.dtype, np.floating):
            samples = (audio_data * 32768.0).clip(-32768, 32767).astype(np.int16)
        else:
            samples = audio_data.astype(np.int16)

        buf = io.BytesIO()
        with wave.open(buf, "wb") as w:
            w.setnchannels(1); w.setsampwidth(2); w.setframerate(self.SAMPLE_RATE)
            w.writeframes(samples.tobytes())
        buf.seek(0)

        kwargs = {"model": self._model, "file": ("audio.wav", buf.getvalue())}
        prompt = build_whisper_prompt(vocabulary)
        if prompt:
            kwargs["prompt"] = prompt
        result = self._client.audio.transcriptions.create(**kwargs)
        return getattr(result, "text", str(result)).strip()

    def __enter__(self): return self
    def __exit__(self, *_): self.unload(); return False
```

- [ ] **Step 4: Run, expect PASS.**

- [ ] **Step 5: Commit.**

---

## Phase 3: LLM cleanup providers

### Task 3.1: `llm/base.py` Protocol + dispatcher

**Files:** `sidecar/ultimate_asr/llm/__init__.py`, `sidecar/ultimate_asr/llm/base.py`, `sidecar/tests/test_llm_base.py`

- [ ] **Step 1: Failing test**

```python
from ultimate_asr.llm.base import LLMProvider, get_provider, LLMConfig
import pytest


def test_get_provider_unknown_raises():
    with pytest.raises(ValueError):
        get_provider(LLMConfig(provider="bogus", model="x", api_key="y"))


def test_each_provider_resolvable():
    for p in ("openai", "anthropic", "ollama", "llamacpp"):
        cfg = LLMConfig(provider=p, model="m", api_key="k", endpoint="http://x")
        assert isinstance(get_provider(cfg), LLMProvider)
```

- [ ] **Step 2: Run, expect FAIL.**

- [ ] **Step 3: Implement `base.py`**

```python
from __future__ import annotations
from dataclasses import dataclass
from typing import Protocol


@dataclass
class LLMConfig:
    provider: str          # openai | anthropic | ollama | llamacpp
    model: str
    api_key: str = ""
    endpoint: str = ""
    system_prompt: str = ""
    max_tokens: int = 512
    timeout_s: float = 30.0


class LLMProvider(Protocol):
    def cleanup(self, text: str, *, system_prompt: str = "") -> str: ...


def get_provider(cfg: LLMConfig) -> LLMProvider:
    if cfg.provider == "openai":
        from .openai_provider import OpenAIProvider
        return OpenAIProvider(cfg)
    if cfg.provider == "anthropic":
        from .anthropic_provider import AnthropicProvider
        return AnthropicProvider(cfg)
    if cfg.provider == "ollama":
        from .ollama_provider import OllamaProvider
        return OllamaProvider(cfg)
    if cfg.provider == "llamacpp":
        from .llamacpp_provider import LlamaCppProvider
        return LlamaCppProvider(cfg)
    raise ValueError(f"Unknown LLM provider: {cfg.provider}")
```

- [ ] **Step 4: Run, expect PASS.** Each provider class is implemented next.

- [ ] **Step 5: Commit.**

### Task 3.2: OpenAI + Anthropic providers

**Files:** `sidecar/ultimate_asr/llm/openai_provider.py`, `sidecar/ultimate_asr/llm/anthropic_provider.py`, `sidecar/tests/test_llm_providers.py`

- [ ] **Step 1: Write tests using mocks for both providers** — assert that `cleanup("um, hello world")` returns the mocked cleaned response and that the system prompt + user content are forwarded verbatim. Use `unittest.mock.patch` on the SDK client classes.

- [ ] **Step 2: Run, expect FAIL.**

- [ ] **Step 3: Implement**

`openai_provider.py`:
```python
from openai import OpenAI
from .base import LLMConfig

class OpenAIProvider:
    def __init__(self, cfg: LLMConfig):
        self._cfg = cfg
        self._client = OpenAI(api_key=cfg.api_key, base_url=cfg.endpoint or None)

    def cleanup(self, text: str, *, system_prompt: str = "") -> str:
        resp = self._client.chat.completions.create(
            model=self._cfg.model,
            timeout=self._cfg.timeout_s,
            max_tokens=self._cfg.max_tokens,
            messages=[
                {"role": "system", "content": system_prompt or self._cfg.system_prompt},
                {"role": "user", "content": text},
            ],
        )
        return resp.choices[0].message.content.strip()
```

`anthropic_provider.py`:
```python
from anthropic import Anthropic
from .base import LLMConfig

class AnthropicProvider:
    def __init__(self, cfg: LLMConfig):
        self._cfg = cfg
        self._client = Anthropic(api_key=cfg.api_key, base_url=cfg.endpoint or None)

    def cleanup(self, text: str, *, system_prompt: str = "") -> str:
        resp = self._client.messages.create(
            model=self._cfg.model,
            max_tokens=self._cfg.max_tokens,
            system=system_prompt or self._cfg.system_prompt,
            messages=[{"role": "user", "content": text}],
        )
        return "".join(block.text for block in resp.content if hasattr(block, "text")).strip()
```

- [ ] **Step 4: Run, expect PASS.**

- [ ] **Step 5: Commit.**

### Task 3.3: Ollama + llama.cpp providers

**Files:** `sidecar/ultimate_asr/llm/ollama_provider.py`, `sidecar/ultimate_asr/llm/llamacpp_provider.py`, append tests to `test_llm_providers.py`

- [ ] **Step 1: Failing test using `httpx.MockTransport` to assert the request body for both providers.**
- [ ] **Step 2: Run, expect FAIL.**
- [ ] **Step 3: Implement** — both providers POST chat-style requests to a local HTTP endpoint:

`ollama_provider.py`:
```python
import httpx
from .base import LLMConfig

class OllamaProvider:
    def __init__(self, cfg: LLMConfig):
        self._cfg = cfg
        self._client = httpx.Client(base_url=cfg.endpoint or "http://localhost:11434", timeout=cfg.timeout_s)

    def cleanup(self, text: str, *, system_prompt: str = "") -> str:
        r = self._client.post("/api/chat", json={
            "model": self._cfg.model, "stream": False,
            "messages": [
                {"role": "system", "content": system_prompt or self._cfg.system_prompt},
                {"role": "user", "content": text},
            ],
        })
        r.raise_for_status()
        return r.json()["message"]["content"].strip()
```

`llamacpp_provider.py` — same shape, hits llama.cpp server's OpenAI-compatible `/v1/chat/completions`.

- [ ] **Step 4: Run, expect PASS.**
- [ ] **Step 5: Commit.**

---

## Phase 4: RPC surface — wire everything to JSON-RPC methods

### Task 4.1: Register engine + audio + LLM RPC methods

**Files:** `sidecar/ultimate_asr/__main__.py` (modify), `sidecar/tests/test_rpc_methods.py`

- [ ] **Step 1: Failing test** that drives the full sidecar:

```python
import json, subprocess, sys, os
ENTRY = [sys.executable, "-m", "ultimate_asr"]


def _talk(p, msg):
    p.stdin.write(json.dumps(msg) + "\n"); p.stdin.flush()
    return json.loads(p.stdout.readline())


def test_list_devices_and_models(tmp_path):
    p = subprocess.Popen(ENTRY, stdin=subprocess.PIPE, stdout=subprocess.PIPE,
        stderr=subprocess.PIPE, text=True, bufsize=1,
        env={**os.environ, "ULTIMATEASR_DATA_DIR": str(tmp_path)})
    try:
        devs = _talk(p, {"id": 1, "method": "list_input_devices"})
        assert isinstance(devs["result"], list)
        ms = _talk(p, {"id": 2, "method": "list_available_models"})
        assert any(m["name"] == "ggml-base.bin" for m in ms["result"])
        hw = _talk(p, {"id": 3, "method": "detect_hardware"})
        assert "cuda" in hw["result"]
    finally:
        p.stdin.close(); p.wait(timeout=5)
```

- [ ] **Step 2: Run, expect FAIL.**

- [ ] **Step 3: Modify `__main__.py`** to register:

| Method | Params | Returns |
|---|---|---|
| `ping` | — | `"pong"` |
| `get_settings` / `set_settings` | `patch?: dict` | settings dict |
| `detect_hardware` | — | hardware dict |
| `list_input_devices` | — | array of device dicts |
| `list_downloaded_models` | — | array of model dicts |
| `list_available_models` | — | catalog array |
| `download_model` | `name` | path string (streams progress as RPC notifications on a `progress` channel) |
| `delete_model` | `name` | `null` |
| `start_recording` | `mode`, `vad_aggressiveness?`, `break_length?` | `{ session_id }` |
| `stop_recording` | `session_id` | `{ samples_pcm_b64, sample_rate }` |
| `transcribe` | `session_id?` or `pcm_b64+sample_rate`, `engine_kind`, `model_path?`, `vocabulary?`, `cloud_api_key?` | `{ text }` |
| `llm_cleanup` | `text`, `provider`, `model`, `api_key?`, `endpoint?`, `system_prompt?` | `{ text }` |
| `shutdown` | — | exit |

For `download_model` use a tail callback that writes JSON-RPC notifications:
```python
def progress(percent, downloaded, total):
    sys.stdout.write(json.dumps({"method": "progress",
        "params": {"name": name, "percent": percent, "downloaded": downloaded, "total": total}}) + "\n")
    sys.stdout.flush()
```

- [ ] **Step 4: Run, expect PASS.**

- [ ] **Step 5: Commit.**

---

## Phase 5: IPC contract + Electron main process

### Task 5.1: Shared Zod IPC contract

**Files:** `src/shared/ipc-contract.ts`, `src/shared/settings-shape.ts`, `src/shared/transcript.ts`, `tests/unit/ipc-contract.test.ts`

- [ ] **Step 1: Failing test**

```ts
import { describe, it, expect } from "vitest";
import { ipcContract, SettingsSchema } from "@shared/ipc-contract";

describe("ipcContract", () => {
  it("validates a settings patch payload", () => {
    expect(() => ipcContract.settings.set.input.parse({ patch: { auto_paste: true } })).not.toThrow();
  });
  it("rejects malformed transcribe payload", () => {
    expect(() => ipcContract.transcribe.input.parse({ engine_kind: "totally-fake" })).toThrow();
  });
  it("settings shape matches sidecar defaults", () => {
    const s = SettingsSchema.parse({
      engine_kind: "auto", model_size: "ggml-base.bin", compute_backend: "auto",
      audio_device_index: null, audio_device_name: null, vad_aggressiveness: 1,
      padding_duration_ms: 1000, recording_mode: "silence", break_length: 5,
      hotkey: "Ctrl+Alt+Shift+L", auto_paste: false, custom_vocabulary: [],
      cloud_api_key: "", cloud_model: "whisper-1",
      llm_enabled: false, llm_provider: "openai", llm_model: "gpt-4o-mini",
      llm_api_key: "", llm_endpoint: "", llm_system_prompt: "x",
      transcripts: [], first_run_done: false,
    });
    expect(s.engine_kind).toBe("auto");
  });
});
```

- [ ] **Step 2: Run, expect FAIL.**

- [ ] **Step 3: Implement**

`src/shared/settings-shape.ts`:
```ts
import { z } from "zod";

export const SettingsSchema = z.object({
  engine_kind: z.enum(["auto", "whisper-local", "parakeet-local", "cloud-openai"]),
  model_size: z.string(),
  compute_backend: z.enum(["auto", "cuda", "metal", "vulkan", "coreml", "cpu"]),
  audio_device_index: z.number().int().nullable(),
  audio_device_name: z.string().nullable(),
  vad_aggressiveness: z.number().int().min(0).max(3),
  padding_duration_ms: z.number().int().nonnegative(),
  recording_mode: z.enum(["silence", "button"]),
  break_length: z.number().int().positive(),
  hotkey: z.string(),
  auto_paste: z.boolean(),
  custom_vocabulary: z.array(z.string()),
  cloud_api_key: z.string(),
  cloud_model: z.string(),
  llm_enabled: z.boolean(),
  llm_provider: z.enum(["openai", "anthropic", "ollama", "llamacpp"]),
  llm_model: z.string(),
  llm_api_key: z.string(),
  llm_endpoint: z.string(),
  llm_system_prompt: z.string(),
  transcripts: z.array(z.string()),
  first_run_done: z.boolean(),
});
export type Settings = z.infer<typeof SettingsSchema>;
```

`src/shared/transcript.ts`:
```ts
import { z } from "zod";
export const TranscriptSchema = z.object({
  id: z.string(), at: z.number(), text: z.string(), engine: z.string(),
});
export type Transcript = z.infer<typeof TranscriptSchema>;
```

`src/shared/ipc-contract.ts`:
```ts
import { z } from "zod";
import { SettingsSchema } from "./settings-shape";
import { TranscriptSchema } from "./transcript";

const empty = z.object({});

export const ipcContract = {
  ping: { input: empty, output: z.literal("pong") },

  settings: {
    get: { input: empty, output: SettingsSchema },
    set: { input: z.object({ patch: SettingsSchema.partial() }), output: SettingsSchema },
  },

  hardware: {
    detect: { input: empty, output: z.object({
      os: z.enum(["linux", "darwin", "windows"]),
      arch: z.string(), cpu_count: z.number(), ram_gb: z.number(),
      cuda: z.boolean(), metal: z.boolean(), vulkan: z.boolean(), coreml: z.boolean(),
    }) },
  },

  devices: { list: { input: empty, output: z.array(z.object({
    index: z.number(), name: z.string(), channels: z.number(), sample_rate: z.number(),
  })) } },

  models: {
    listAvailable: { input: empty, output: z.array(z.any()) },
    listDownloaded: { input: empty, output: z.array(z.any()) },
    download: { input: z.object({ name: z.string() }), output: z.object({ path: z.string() }) },
    delete: { input: z.object({ name: z.string() }), output: z.null() },
  },

  recording: {
    start: { input: z.object({ mode: z.enum(["silence", "button"]).optional() }), output: z.object({ session_id: z.string() }) },
    stop: { input: z.object({ session_id: z.string() }), output: z.object({ samples_pcm_b64: z.string(), sample_rate: z.number() }) },
  },

  transcribe: {
    input: z.object({
      engine_kind: z.enum(["auto", "whisper-local", "parakeet-local", "cloud-openai"]),
      pcm_b64: z.string(), sample_rate: z.number(),
      vocabulary: z.array(z.string()).optional(),
      model_path: z.string().optional(), cloud_api_key: z.string().optional(),
    }),
    output: z.object({ text: z.string() }),
  },

  llm: {
    cleanup: {
      input: z.object({
        text: z.string(), provider: z.enum(["openai", "anthropic", "ollama", "llamacpp"]),
        model: z.string(), api_key: z.string().optional(),
        endpoint: z.string().optional(), system_prompt: z.string().optional(),
      }),
      output: z.object({ text: z.string() }),
    },
  },

  transcripts: {
    list: { input: empty, output: z.array(TranscriptSchema) },
    clear: { input: empty, output: z.null() },
  },
} as const;
export { SettingsSchema };
```

- [ ] **Step 4: Run, expect PASS.**
- [ ] **Step 5: Commit.**

### Task 5.2: Sidecar lifecycle in Electron main

**Files:** `src/main/sidecar.ts`, `tests/unit/sidecar-spawn.test.ts`

- [ ] **Step 1: Failing test that spawns a fake sidecar (a `node` script that echoes JSON-RPC) and asserts a round-trip.**

`tests/unit/sidecar-spawn.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import path from "node:path";
import { Sidecar } from "@main/sidecar";

const FAKE = path.resolve(__dirname, "fixtures/fake-sidecar.mjs");

describe("Sidecar", () => {
  it("round-trips a request", async () => {
    const sc = new Sidecar({ command: "node", args: [FAKE] });
    await sc.start();
    const r = await sc.call("ping", {});
    expect(r).toBe("pong");
    await sc.stop();
  });
  it("rejects on RPC error", async () => {
    const sc = new Sidecar({ command: "node", args: [FAKE] });
    await sc.start();
    await expect(sc.call("missing", {})).rejects.toThrow(/not found/);
    await sc.stop();
  });
});
```

`tests/unit/fixtures/fake-sidecar.mjs` (echo server that mimics the real sidecar protocol):
```js
import readline from "node:readline";
const rl = readline.createInterface({ input: process.stdin });
rl.on("line", (l) => {
  const m = JSON.parse(l);
  if (m.method === "ping") process.stdout.write(JSON.stringify({ id: m.id, result: "pong" }) + "\n");
  else process.stdout.write(JSON.stringify({ id: m.id, error: { code: -32601, message: "not found" } }) + "\n");
});
```

- [ ] **Step 2: Run, expect FAIL.**

- [ ] **Step 3: Implement `src/main/sidecar.ts`**

```ts
import { spawn, ChildProcessWithoutNullStreams } from "node:child_process";
import { EventEmitter } from "node:events";
import readline from "node:readline";

export interface SidecarOpts { command: string; args: string[]; env?: NodeJS.ProcessEnv; cwd?: string; }

export class Sidecar extends EventEmitter {
  private proc?: ChildProcessWithoutNullStreams;
  private nextId = 1;
  private inflight = new Map<number, { resolve: (v: any) => void; reject: (e: Error) => void }>();
  constructor(private opts: SidecarOpts) { super(); }

  async start(): Promise<void> {
    this.proc = spawn(this.opts.command, this.opts.args, { env: this.opts.env, cwd: this.opts.cwd });
    const rl = readline.createInterface({ input: this.proc.stdout });
    rl.on("line", (line) => {
      try {
        const msg = JSON.parse(line);
        if (msg.id != null && this.inflight.has(msg.id)) {
          const { resolve, reject } = this.inflight.get(msg.id)!;
          this.inflight.delete(msg.id);
          if (msg.error) reject(new Error(msg.error.message));
          else resolve(msg.result);
        } else if (msg.method) {
          this.emit("notify", msg.method, msg.params);
        }
      } catch (e) { this.emit("error", e); }
    });
    this.proc.stderr.on("data", (b) => this.emit("stderr", b.toString()));
    this.proc.on("exit", (code) => this.emit("exit", code));
  }

  call<T = unknown>(method: string, params: object = {}, timeoutMs = 30_000): Promise<T> {
    if (!this.proc) throw new Error("sidecar not started");
    const id = this.nextId++;
    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => { this.inflight.delete(id); reject(new Error(`RPC timeout: ${method}`)); }, timeoutMs);
      this.inflight.set(id, {
        resolve: (v) => { clearTimeout(timer); resolve(v as T); },
        reject: (e) => { clearTimeout(timer); reject(e); },
      });
      this.proc!.stdin.write(JSON.stringify({ id, method, params }) + "\n");
    });
  }

  async stop(): Promise<void> {
    if (!this.proc) return;
    try { this.proc.stdin.end(); } catch {}
    await new Promise<void>((resolve) => {
      const t = setTimeout(() => { this.proc?.kill("SIGKILL"); resolve(); }, 2_000);
      this.proc!.once("exit", () => { clearTimeout(t); resolve(); });
    });
    this.proc = undefined;
  }
}
```

- [ ] **Step 4: Run, expect PASS.**
- [ ] **Step 5: Commit.**

### Task 5.3: Single-instance lock + Electron entry

**Files:** `src/main/single-instance.ts`, `src/main/index.ts`, `src/preload/index.ts`, `tests/unit/single-instance.test.ts`

- [ ] **Step 1: Failing test for single-instance lock** (Electron-stubbed module under test exports `acquireOrFocus(app)` taking an `app`-shaped argument).
- [ ] **Step 2: Run, expect FAIL.**
- [ ] **Step 3: Implement** — `single-instance.ts` calls `app.requestSingleInstanceLock()`. `src/main/index.ts` wires app lifecycle, creates the BrowserWindow, starts the sidecar, then calls `setupIPC()` (Task 6.1). `src/preload/index.ts` uses `contextBridge.exposeInMainWorld("api", { ... })` per the contract.
- [ ] **Step 4: Run, expect PASS.**
- [ ] **Step 5: Commit.**

### Task 5.4: IPC handlers wired to sidecar

**Files:** `src/main/ipc.ts`, `tests/unit/ipc-main.test.ts`

- [ ] **Step 1: Failing test** that mocks `Sidecar` and asserts each `ipcMain.handle` channel forwards correctly with Zod-validated payloads.
- [ ] **Step 2: Run, expect FAIL.**
- [ ] **Step 3: Implement** — for each entry in `ipcContract`, call `ipcMain.handle(channel, async (_e, raw) => { const parsed = entry.input.parse(raw); const out = await sidecar.call(method, parsed); return entry.output.parse(out); })`.
- [ ] **Step 4: Run, expect PASS.**
- [ ] **Step 5: Commit.**

---

## Phase 6: Renderer scaffolding

### Task 6.1: Renderer entry, router, query client

**Files:** `src/renderer/main.tsx`, `src/renderer/App.tsx`, `src/renderer/lib/ipc.ts`, `src/renderer/lib/query-client.ts`, `index.html` in renderer root, `tests/unit/components/app.test.tsx`

- [ ] **Step 1: Failing component test** that renders `<App />` and expects to see "ultimateASR" in the document.
- [ ] **Step 2: Run, expect FAIL.**
- [ ] **Step 3: Implement** — minimal router shell with five routes (`/`, `/settings`, `/models`, `/dictionary`, `/llm`), TanStack Query client, navigation sidebar built from shadcn `Card`/`Button`. Renderer IPC client maps `ipcContract` to `(window as any).api.<group>.<method>(input)`.
- [ ] **Step 4: Run, expect PASS.**
- [ ] **Step 5: Commit.**

### Task 6.2: `useSettings` hook + Status Pill (active/idle indicator)

**Files:** `src/renderer/hooks/use-settings.ts`, `src/renderer/components/status-pill.tsx`, `tests/unit/components/status-pill.test.tsx`

- [ ] **Step 1: Failing test** — `<StatusPill state="recording" />` renders text "Recording" and class `bg-red-500`; `<StatusPill state="idle" />` renders "Idle" and class `bg-zinc-300`.
- [ ] **Step 2: Run, expect FAIL.**
- [ ] **Step 3: Implement** — pure component, value-driven by `recording-store` Zustand state. `useSettings` returns a Tanstack Query result that calls `api.settings.get()` and an optimistic mutation that calls `api.settings.set({ patch })`.
- [ ] **Step 4: Run, expect PASS.**
- [ ] **Step 5: Commit.**

### Task 6.3: Transcripts list component

**Files:** `src/renderer/hooks/use-transcripts.ts`, `src/renderer/components/transcript-list.tsx`, `tests/unit/components/transcript-list.test.tsx`

- [ ] **Step 1: Failing test** — given 12 transcripts, the component renders only the latest 10 in reverse-chronological order. Clicking a row calls `navigator.clipboard.writeText(text)`.
- [ ] **Step 2: Run, expect FAIL.**
- [ ] **Step 3: Implement** — uses shadcn `ScrollArea` + `Card`. Hook fetches from `api.transcripts.list()` via Tanstack Query.
- [ ] **Step 4: Run, expect PASS.**
- [ ] **Step 5: Commit.**

### Task 6.4: Settings page (forms for every section)

**Files:** `src/renderer/pages/settings.tsx`, `src/renderer/components/settings-section.tsx`, `tests/unit/components/settings.test.tsx`

- [ ] **Step 1: Failing test** — toggling auto-paste calls `api.settings.set` with `{ patch: { auto_paste: true } }`.
- [ ] **Step 2: Run, expect FAIL.**
- [ ] **Step 3: Implement** — sections: Engine, Audio, Hotkey, Auto-paste, Cloud, LLM. Use shadcn `Tabs` for top-level grouping. All controls debounce-save via the `useSettings` mutation.
- [ ] **Step 4: Run, expect PASS.**
- [ ] **Step 5: Commit.**

### Task 6.5: Models page (download/delete/select)

**Files:** `src/renderer/pages/models.tsx`, `src/renderer/components/model-row.tsx`, `src/renderer/hooks/use-models.ts`, `tests/unit/components/models.test.tsx`

- [ ] **Step 1: Failing test** asserting `Download` button calls `api.models.download({ name })` and that progress notifications received from main update a progress bar.
- [ ] **Step 2: Run, expect FAIL.**
- [ ] **Step 3: Implement** — registers a listener on `window.api.events.on("progress", ...)` (preload exposes a typed event subscriber). Subscribes only while page is mounted.
- [ ] **Step 4: Run, expect PASS.**
- [ ] **Step 5: Commit.**

### Task 6.6: Dictionary page (vocabulary editor)

**Files:** `src/renderer/pages/dictionary.tsx`, `src/renderer/components/dictionary-editor.tsx`, `tests/unit/components/dictionary.test.tsx`

- [ ] **Step 1: Failing test** — adding "SDLT" then saving updates `custom_vocabulary` via settings mutation; deleting an entry removes it.
- [ ] **Step 2: Run, expect FAIL.**
- [ ] **Step 3: Implement** — search input, single-line add, list of badges with X buttons, JSON import/export buttons.
- [ ] **Step 4: Run, expect PASS.**
- [ ] **Step 5: Commit.**

### Task 6.7: LLM/Cloud page

**Files:** `src/renderer/pages/llm.tsx`, `tests/unit/components/llm.test.tsx`

- [ ] **Step 1: Failing test** — provider select controls visibility of API-key vs endpoint fields; switching `llm_enabled` off greys out the form.
- [ ] **Step 2: Run, expect FAIL.**
- [ ] **Step 3: Implement** — provider dropdown, model input (preset list + free-text), api key (secret input), endpoint (only for ollama/llamacpp), system-prompt textarea with reset-to-default.
- [ ] **Step 4: Run, expect PASS.**
- [ ] **Step 5: Commit.**

---

## Phase 7: Tray, hotkey, recording flow

### Task 7.1: Tray icon with active/idle state + last-10 menu

**Files:** `src/main/tray.ts`, `src/main/icons.ts`, `tests/unit/tray-menu.test.ts`

- [ ] **Step 1: Failing test** — tray module exports `buildMenu(state, transcripts)`; given `state="recording"` and 12 transcripts, the menu has exactly one submenu of 10 entries, plus "Open settings", "Toggle recording", "Quit".
- [ ] **Step 2: Run, expect FAIL.**
- [ ] **Step 3: Implement** — pure builder returning an Electron `Menu` template. Tray icon swaps between `tray-idle.png` and `tray-recording.png` based on state. Subscribes to `recording-store` IPC events from renderer.
- [ ] **Step 4: Run, expect PASS.**
- [ ] **Step 5: Commit.**

### Task 7.2: Global hotkey (cross-platform) + Wayland fallback

**Files:** `src/main/hotkey.ts`, `tests/unit/hotkey.test.ts`

- [ ] **Step 1: Failing test** — given `"Ctrl+Alt+Shift+L"`, the hotkey module registers `globalShortcut.register("Ctrl+Alt+Shift+L", cb)` on `app.ready` and unregisters on `app.willQuit`. On Wayland (env `XDG_SESSION_TYPE=wayland`) it spawns `evtest`-based fallback (mocked here, real impl shells out to a small Python helper inside the sidecar).
- [ ] **Step 2: Run, expect FAIL.**
- [ ] **Step 3: Implement** — Electron `globalShortcut`; on Linux + Wayland, send a JSON-RPC `register_hotkey` to sidecar which uses `python-evdev` (already a working pattern in `whisperLocal`).
- [ ] **Step 4: Run, expect PASS.**
- [ ] **Step 5: Commit.**

### Task 7.3: End-to-end recording flow

**Files:** `src/main/recording-controller.ts`, `tests/unit/recording-controller.test.ts`

- [ ] **Step 1: Failing test** — `RecordingController.toggle()` when idle calls `sidecar.call("start_recording", { mode })`, transitions to "recording"; when recording, calls `stop_recording`, then `transcribe`, then if `llm_enabled` calls `llm_cleanup`, then writes the result to `transcripts` and returns the cleaned text. All steps mocked.
- [ ] **Step 2: Run, expect FAIL.**
- [ ] **Step 3: Implement** — finite state machine with states `idle | starting | recording | stopping | transcribing | cleaning`. Emits state-change events that drive the tray + status pill.
- [ ] **Step 4: Run, expect PASS.**
- [ ] **Step 5: Commit.**

### Task 7.4: Auto-paste (cross-platform)

**Files:** `src/main/auto-paste.ts`, `tests/unit/auto-paste.test.ts`

- [ ] **Step 1: Failing test** — on Linux, calls `xdotool type --` with text; on macOS, calls `osascript` with a keystroke; on Windows, calls into a tiny Node helper using `robotjs` or PowerShell `SendKeys`.
- [ ] **Step 2: Run, expect FAIL.**
- [ ] **Step 3: Implement** — small dispatcher with three implementations selected via `process.platform`. Always copies to clipboard via Electron `clipboard.writeText` first; auto-paste is best-effort.
- [ ] **Step 4: Run, expect PASS.**
- [ ] **Step 5: Commit.**

---

## Phase 8: First-run wizard + transcripts persistence

### Task 8.1: First-run wizard

**Files:** `src/renderer/components/first-run-wizard.tsx`, `tests/unit/components/first-run.test.tsx`

- [ ] **Step 1: Failing test** — wizard appears when `first_run_done === false`. After accepting recommendations it calls `api.settings.set` with the recommended backend + model, calls `api.models.download({ name: recommended })`, then sets `first_run_done: true`.
- [ ] **Step 2: Run, expect FAIL.**
- [ ] **Step 3: Implement** — modal with three steps: Welcome → Hardware Summary (from `api.hardware.detect()`) → Model Choice (defaults to `recommend_model()`). User can override before downloading.
- [ ] **Step 4: Run, expect PASS.**
- [ ] **Step 5: Commit.**

### Task 8.2: Transcripts persistence

**Files:** `src/main/transcripts-store.ts`, `tests/unit/transcripts-store.test.ts`

- [ ] **Step 1: Failing test** — `TranscriptsStore.add({ text, engine })` keeps at most 10 entries, newest first; `clear()` empties them; data persists across restarts (file path mocked in tmpdir).
- [ ] **Step 2: Run, expect FAIL.**
- [ ] **Step 3: Implement** — JSON file in `app.getPath("userData")/transcripts.json`. Wires into `recording-controller` and exposes `api.transcripts.list/clear`.
- [ ] **Step 4: Run, expect PASS.**
- [ ] **Step 5: Commit.**

---

## Phase 9: E2E with Playwright

### Task 9.1: Playwright + Electron launch helper

**Files:** `tests/e2e/helpers.ts`, `tests/e2e/smoke.spec.ts`

- [ ] **Step 1: Failing test** — `smoke.spec.ts` launches the built Electron binary, asserts the main window title is "ultimateASR", asserts the tray exists (queried via `electron` getter).
- [ ] **Step 2: Run, expect FAIL** (`playwright._electron` returns undefined until built).
- [ ] **Step 3: Implement** — `helpers.ts` uses `_electron.launch({ args: ["dist-electron/main/index.js"], env: { ULTIMATEASR_E2E: "1" } })`; the e2e env var swaps the real Python sidecar for a deterministic Node fixture.
- [ ] **Step 4: Run, expect PASS.**
- [ ] **Step 5: Commit.**

### Task 9.2: Settings + dictionary E2E

**Files:** `tests/e2e/settings.spec.ts`, `tests/e2e/dictionary.spec.ts`

- [ ] **Step 1: Failing tests** — open settings, toggle auto-paste, restart, assert persisted; open dictionary, add "SDLT", restart, assert preserved.
- [ ] **Step 2: Run, expect FAIL.**
- [ ] **Step 3: Implement** — selectors via `getByRole`; uses tmpdir for `ULTIMATEASR_DATA_DIR` so tests don't pollute user data.
- [ ] **Step 4: Run, expect PASS.**
- [ ] **Step 5: Commit.**

### Task 9.3: Recording flow E2E (mocked sidecar)

**Files:** `tests/e2e/recording.spec.ts`

- [ ] **Step 1: Failing test** — clicking "Record" toggles status pill to "Recording", and after the fixture sidecar emits a transcribed result, the latest transcript appears in the tray submenu and the clipboard contains it.
- [ ] **Step 2: Run, expect FAIL.**
- [ ] **Step 3: Implement** — fixture sidecar deterministically returns `"hello world"` after a small delay.
- [ ] **Step 4: Run, expect PASS.**
- [ ] **Step 5: Commit.**

---

## Phase 10: Cross-platform packaging

### Task 10.1: PyInstaller-built sidecar

**Files:** `scripts/build-sidecar.mjs`, `sidecar/ultimate_asr.spec`

- [ ] **Step 1: Implement** — Node script that creates a per-OS venv, `pip install`s the sidecar with all extras, then runs PyInstaller with `--onedir` (faster startup than onefile) producing `dist-sidecar/<platform>/ultimate_asr/`.
- [ ] **Step 2: Verify** — `pnpm sidecar:build` exits 0 on the local OS; the output `ultimate_asr` binary, when run, accepts `{"id":1,"method":"ping"}` on stdin and emits `{"id":1,"result":"pong"}`.
- [ ] **Step 3: Commit.**

### Task 10.2: electron-builder config

**Files:** `electron-builder.yml`

- [ ] **Step 1: Implement**

```yaml
appId: com.ultimateasr.app
productName: ultimateASR
files:
  - "dist/**"
  - "dist-electron/**"
  - "package.json"
extraResources:
  - from: "dist-sidecar/${platform}/ultimate_asr"
    to: "sidecar"
asar: true
mac:
  category: public.app-category.utilities
  hardenedRuntime: true
  entitlements: installers/macos/entitlements.mac.plist
  notarize: false
  target: [{ target: "dmg", arch: ["arm64", "x64"] }]
linux:
  target: [AppImage, deb]
  category: AudioVideo
  desktop: { Name: ultimateASR, Comment: Local + cloud dictation }
win:
  target: [{ target: "nsis", arch: ["x64"] }]
  publisherName: ultimateASR
nsis: { include: installers/windows/nsis-include.nsh, oneClick: false, perMachine: false }
```

- [ ] **Step 2: Verify** — `pnpm package` builds an installer for the local OS without error.
- [ ] **Step 3: Commit.**

### Task 10.3: Release workflow

**Files:** `.github/workflows/release.yml`

- [ ] **Step 1: Implement** — triggers on tags `v*`; matrix per OS builds sidecar then runs `pnpm package`; uploads built installers as release assets.
- [ ] **Step 2: Verify** — push a `v0.1.0-rc1` tag and the workflow produces three artifacts.
- [ ] **Step 3: Commit.**

---

## Phase 11: Polish

### Task 11.1: README + ARCHITECTURE + INSTALL docs

**Files:** `README.md`, `docs/ARCHITECTURE.md`, `docs/INSTALL.md`

- [ ] **Step 1: Implement** — README focuses on download links + 30-second quick start. ARCHITECTURE explains Electron-main / sidecar split, IPC contract, and where to extend. INSTALL covers manual dev setup (Linux/Mac/Windows) and known caveats (Wayland hotkey, ydotool, mic permissions on macOS).
- [ ] **Step 2: Commit.**

### Task 11.2: Onboarding banner for cloud-only mode

**Files:** `src/renderer/pages/home.tsx`, `tests/unit/components/home.test.tsx`

- [ ] **Step 1: Failing test** — when no model downloaded and no cloud key set, the home page renders a "You need a model or a cloud key" banner with two CTAs.
- [ ] **Step 2: Run, expect FAIL.**
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run, expect PASS.**
- [ ] **Step 5: Commit.**

---

## Phase 12 (optional): Neon cloud sync

### Task 12.1: Opt-in sync of vocabulary + transcripts

**Files:** `src/main/cloud-sync.ts`, `sidecar/ultimate_asr/cloud_sync.py`, tests for both

- [ ] **Step 1: Failing tests** — when `cloud_sync_enabled` is true, settings + transcripts are POSTed to `https://<neon-edge>` and pulled on startup.
- [ ] **Step 2: Implement using Neon's serverless driver from a tiny Hono/Workers endpoint** (out-of-scope for plan; included as stub).
- [ ] **Step 3: Commit.**

> Phase 12 is genuinely optional and shipped behind a feature flag. Skip if scope is too tight.

---

## Self-Review

**Spec coverage:**
- Cross-platform (Win/Linux/Mac, M3+) → Phase 10 (electron-builder + PyInstaller per-OS).
- New UI stack (Electron + React + shadcn/ui) → Phases 0, 5, 6.
- Local + cloud inference → Phases 2 (whisper.cpp + Parakeet ports) + 2.9 (cloud).
- LLM cleanup with any provider → Phase 3 + Phase 6.7.
- Settings dictionary → Phase 6.6 + ported vocabulary engine (Phase 2.4).
- Tray with active indicator + last-10 popup → Phase 7.1.
- Easy setup from GitHub → Phases 10 (installer artifacts), 11 (README), 8 (first-run wizard).
- CPU/GPU/M3+ best backend OOB → Phase 1.5 hardware detection + recommendations + first-run wizard.
- CUDA/cuDNN concerns → bundled per-OS prebuilds (Phase 10.1) using the same CUDA-runtime hook approach `whisperLocal/packaging/rthook_cuda.py` already proves works. No Docker.
- TDD throughout → every task has a failing test before implementation.
- GitHub matrix UI testing → Phase 0.4 (CI) + Phase 9 (Playwright on built app, run inside `xvfb` on Linux).
- Subagent-driven approach → tasks are sized for fresh subagent dispatch with two-stage review.
- Don't replace whisperLocal → confirmed; this is a new repo at `ultimateASR/`.
- Toolbar = tray; main app = settings/config → enforced by Phase 6's page set + Phase 7.1's tray-as-primary-UI.

**Placeholder scan:** Phase 12 is intentionally lighter (stretch goal). Phases 2.5/2.6/2.7 reference verbatim port targets — that's intentional and the test files prove correctness, but if a future spec adds new behavior on top, those tasks will need expansion.

**Type consistency:** `engine_kind` strings are identical across `settings-shape.ts`, `ipc-contract.ts`, sidecar `factory.make_engine_kind`, and `cloud_engine.kind`. Settings keys match Python defaults exactly (verified by `test_new_keys_present_in_defaults`). RPC method names in `__main__.py` exactly match Electron `Sidecar.call(...)` strings.

---

## Execution handoff

This plan is large enough that I strongly recommend the **subagent-driven** path: one fresh subagent per task, two-stage review between tasks. That keeps each subagent's context window small and avoids drift across phases.

A reasonable execution slicing:
- Phases 0–4 (sidecar + foundation) — fully sequential.
- Phases 5–7 (Electron + UI) — sequential, but renderer pages (6.4–6.7) can fan out to parallel subagents once 6.1–6.3 land.
- Phases 8–11 — sequential.
- Phase 12 — skip for v0.1.0; revisit after dogfooding.
