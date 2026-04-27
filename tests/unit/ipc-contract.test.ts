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
