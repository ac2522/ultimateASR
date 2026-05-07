import { describe, it, expect, vi, beforeEach } from "vitest";

// Stub electron before importing the module under test.
const handlers: Record<string, (...args: any[]) => any> = {};
vi.mock("electron", () => ({
  ipcMain: {
    handle: vi.fn((ch: string, h: (...args: any[]) => any) => { handlers[ch] = h; }),
  },
  BrowserWindow: { getAllWindows: () => [] },
}));

import { setupIPC } from "@main/ipc";

class FakeSidecar {
  public lastCall: any = null;
  on() {}
  async call(method: string, params: any) {
    this.lastCall = { method, params };
    if (method === "get_settings") {
      return {
        engine_kind: "auto", model_size: "ggml-base.bin", compute_backend: "auto",
        audio_device_index: null, audio_device_name: null, vad_aggressiveness: 1,
        padding_duration_ms: 1000, recording_mode: "silence", break_length: 5,
        hotkey: "Ctrl+Alt+Shift+L", auto_paste: false, custom_vocabulary: [],
        cloud_api_key: "", cloud_model: "whisper-1",
        llm_enabled: false, llm_provider: "openai", llm_model: "gpt-4o-mini",
        llm_api_key: "", llm_endpoint: "", llm_system_prompt: "x",
        transcripts: [], first_run_done: false,
      };
    }
    if (method === "list_input_devices") return [];
    if (method === "transcribe") return { text: "ok" };
    return null;
  }
}

beforeEach(() => {
  for (const k of Object.keys(handlers)) delete handlers[k];
});

describe("setupIPC", () => {
  it("registers handlers for every contract channel", () => {
    const sc = new FakeSidecar() as any;
    setupIPC(sc);
    for (const ch of [
      "ping", "settings.get", "settings.set", "hardware.detect",
      "hardware.recommendBackend", "hardware.recommendModel", "devices.list",
      "models.listAvailable", "models.listDownloaded", "models.download",
      "models.delete", "recording.start", "recording.stop",
      "transcribe", "llm.cleanup",
    ]) {
      expect(handlers[ch]).toBeDefined();
    }
  });
  it("forwards settings.get and validates the response", async () => {
    const sc = new FakeSidecar() as any;
    setupIPC(sc);
    const r = await handlers["settings.get"]({}, {});
    expect(r.engine_kind).toBe("auto");
    expect(sc.lastCall.method).toBe("get_settings");
  });
  it("rejects malformed transcribe input", async () => {
    const sc = new FakeSidecar() as any;
    setupIPC(sc);
    await expect(handlers["transcribe"]({}, { engine_kind: "fake" })).rejects.toBeDefined();
  });
  it("logs handler errors to stderr with the channel name", async () => {
    const sc = {
      on() {},
      async call() { throw new Error("sidecar dead"); },
    } as any;
    setupIPC(sc);
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    await expect(handlers["settings.get"]({}, {})).rejects.toThrow("sidecar dead");
    expect(spy).toHaveBeenCalledWith(expect.stringContaining("[ipc] settings.get"));
    spy.mockRestore();
  });
});
