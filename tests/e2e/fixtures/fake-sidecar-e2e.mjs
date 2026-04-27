// Deterministic Node sidecar used for Playwright E2E tests. Speaks the same
// newline-delimited JSON-RPC protocol as the real Python sidecar but returns
// stub responses, so tests don't require Python, models, or audio hardware.
import readline from "node:readline";
import fs from "node:fs";
import path from "node:path";

const dataDir = process.env.ULTIMATEASR_DATA_DIR ?? process.cwd();

const DEFAULT_SETTINGS = {
  engine_kind: "auto",
  model_size: "ggml-base.bin",
  compute_backend: "auto",
  audio_device_index: null,
  audio_device_name: null,
  vad_aggressiveness: 1,
  padding_duration_ms: 1000,
  recording_mode: "silence",
  break_length: 5,
  hotkey: "Ctrl+Alt+Shift+L",
  auto_paste: false,
  custom_vocabulary: [],
  cloud_api_key: "",
  cloud_model: "whisper-1",
  llm_enabled: false,
  llm_provider: "openai",
  llm_model: "gpt-4o-mini",
  llm_api_key: "",
  llm_endpoint: "",
  llm_system_prompt: "Clean up dictation",
  transcripts: [],
  first_run_done: true, // bypass first-run wizard for most tests
};

const settingsPath = path.join(dataDir, "settings.json");
let settings = { ...DEFAULT_SETTINGS };
if (fs.existsSync(settingsPath)) {
  try {
    Object.assign(settings, JSON.parse(fs.readFileSync(settingsPath, "utf8")));
  } catch { /* fall back to defaults */ }
}

function persist() {
  fs.mkdirSync(dataDir, { recursive: true });
  fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2));
}

const handlers = {
  ping: () => "pong",
  get_settings: () => settings,
  set_settings: ({ patch }) => {
    settings = { ...settings, ...(patch || {}) };
    persist();
    return settings;
  },
  detect_hardware: () => ({
    os: "linux", arch: "x86_64", cpu_count: 8, ram_gb: 16,
    cuda: false, metal: false, vulkan: false, coreml: false,
  }),
  recommend_backend: () => "cpu",
  recommend_model: () => "ggml-base.bin",
  list_input_devices: () => [
    { index: 0, name: "Default mic", channels: 1, sample_rate: 16000 },
  ],
  list_available_models: () => [
    { name: "ggml-base.bin", size_mb: 142, description: "Base", type: "whisper" },
    { name: "ggml-small.bin", size_mb: 466, description: "Small", type: "whisper" },
  ],
  list_downloaded_models: () => [],
  download_model: ({ name }) => ({ path: path.join(dataDir, "models", name) }),
  delete_model: () => null,
  start_recording: () => ({ session_id: "fake-session" }),
  stop_recording: () => ({
    samples_pcm_b64: Buffer.alloc(16000 * 4).toString("base64"),
    sample_rate: 16000,
  }),
  transcribe: () => ({ text: "hello world" }),
  llm_cleanup: ({ text }) => ({ text }),
  shutdown: () => { process.exit(0); },
};

const rl = readline.createInterface({ input: process.stdin });
rl.on("line", (line) => {
  let msg;
  try { msg = JSON.parse(line); } catch { return; }
  const handler = handlers[msg.method];
  if (!handler) {
    if (msg.id != null) {
      process.stdout.write(JSON.stringify({
        id: msg.id, error: { code: -32601, message: `Method not found: ${msg.method}` },
      }) + "\n");
    }
    return;
  }
  try {
    const result = handler(msg.params || {});
    if (msg.id != null) {
      process.stdout.write(JSON.stringify({ id: msg.id, result }) + "\n");
    }
  } catch (e) {
    if (msg.id != null) {
      process.stdout.write(JSON.stringify({
        id: msg.id, error: { code: -32603, message: String(e?.message ?? e) },
      }) + "\n");
    }
  }
});
