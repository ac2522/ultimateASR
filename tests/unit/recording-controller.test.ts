import { describe, it, expect, vi } from "vitest";
import { RecordingController, type SidecarLike } from "@main/recording-controller";
import type { Settings } from "@shared/settings-shape";

function baseSettings(overrides: Partial<Settings> = {}): Settings {
  return {
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
    llm_system_prompt: "x",
    transcripts: [],
    first_run_done: false,
    ...overrides,
  };
}

function fakeSidecar(impl: Record<string, (params: any) => any>): SidecarLike & { calls: { method: string; params: any }[] } {
  const calls: { method: string; params: any }[] = [];
  return {
    calls,
    async call(method: string, params: any = {}) {
      calls.push({ method, params });
      const fn = impl[method];
      if (!fn) throw new Error(`unexpected method: ${method}`);
      return fn(params);
    },
  };
}

describe("RecordingController", () => {
  it("start transitions idle → starting → recording and calls start_recording", async () => {
    const sc = fakeSidecar({
      start_recording: () => ({ session_id: "s1" }),
    });
    const states: string[] = [];
    const ctrl = new RecordingController({
      sidecar: sc,
      getSettings: async () => baseSettings(),
      appendTranscript: vi.fn(async () => {}),
    });
    ctrl.on("state", (s) => states.push(s));
    await ctrl.start();
    expect(states).toEqual(["starting", "recording"]);
    expect(ctrl.state).toBe("recording");
    expect(ctrl.sessionId).toBe("s1");
    expect(sc.calls[0].method).toBe("start_recording");
    expect(sc.calls[0].params.mode).toBe("silence");
  });

  it("stop calls stop_recording then transcribe with engine_kind 'auto' translated to 'whisper-local'", async () => {
    const sc = fakeSidecar({
      start_recording: () => ({ session_id: "s2" }),
      stop_recording: () => ({ samples_pcm_b64: "AAAA", sample_rate: 16000 }),
      transcribe: () => ({ text: "hello world" }),
    });
    const append = vi.fn(async () => {});
    const ctrl = new RecordingController({
      sidecar: sc,
      getSettings: async () => baseSettings(),
      appendTranscript: append,
    });
    await ctrl.start();
    const text = await ctrl.stop();
    expect(text).toBe("hello world");
    const transcribeCall = sc.calls.find(c => c.method === "transcribe");
    expect(transcribeCall).toBeDefined();
    expect(transcribeCall!.params.engine_kind).toBe("whisper-local");
    expect(transcribeCall!.params.pcm_b64).toBe("AAAA");
    expect(transcribeCall!.params.sample_rate).toBe(16000);
    expect(append).toHaveBeenCalledTimes(1);
    expect(ctrl.state).toBe("idle");
    expect(ctrl.sessionId).toBeNull();
  });

  it("invokes llm_cleanup when llm_enabled is true and uses cleaned text", async () => {
    const sc = fakeSidecar({
      start_recording: () => ({ session_id: "s3" }),
      stop_recording: () => ({ samples_pcm_b64: "BBBB", sample_rate: 16000 }),
      transcribe: () => ({ text: "raw text" }),
      llm_cleanup: () => ({ text: "cleaned text" }),
    });
    const append = vi.fn(async () => {});
    const ctrl = new RecordingController({
      sidecar: sc,
      getSettings: async () => baseSettings({ llm_enabled: true }),
      appendTranscript: append,
    });
    await ctrl.start();
    const text = await ctrl.stop();
    expect(text).toBe("cleaned text");
    expect(sc.calls.find(c => c.method === "llm_cleanup")).toBeDefined();
    expect(append).toHaveBeenCalledWith(expect.objectContaining({ text: "cleaned text" }));
  });

  it("does not append empty transcribed text", async () => {
    const sc = fakeSidecar({
      start_recording: () => ({ session_id: "s4" }),
      stop_recording: () => ({ samples_pcm_b64: "", sample_rate: 16000 }),
      transcribe: () => ({ text: "   " }),
    });
    const append = vi.fn(async () => {});
    const ctrl = new RecordingController({
      sidecar: sc,
      getSettings: async () => baseSettings(),
      appendTranscript: append,
    });
    await ctrl.start();
    const text = await ctrl.stop();
    expect(text).toBeNull();
    expect(append).not.toHaveBeenCalled();
    expect(ctrl.state).toBe("idle");
  });

  it("invokes pasteText when auto_paste is true", async () => {
    const sc = fakeSidecar({
      start_recording: () => ({ session_id: "s5" }),
      stop_recording: () => ({ samples_pcm_b64: "CCCC", sample_rate: 16000 }),
      transcribe: () => ({ text: "paste me" }),
    });
    const paste = vi.fn(async () => {});
    const ctrl = new RecordingController({
      sidecar: sc,
      getSettings: async () => baseSettings({ auto_paste: true }),
      appendTranscript: vi.fn(async () => {}),
      pasteText: paste,
    });
    await ctrl.start();
    await ctrl.stop();
    expect(paste).toHaveBeenCalledWith("paste me");
  });

  it("toggle starts when idle and stops when recording", async () => {
    const sc = fakeSidecar({
      start_recording: () => ({ session_id: "s6" }),
      stop_recording: () => ({ samples_pcm_b64: "", sample_rate: 16000 }),
      transcribe: () => ({ text: "ok" }),
    });
    const ctrl = new RecordingController({
      sidecar: sc,
      getSettings: async () => baseSettings(),
      appendTranscript: vi.fn(async () => {}),
    });
    await ctrl.toggle();
    expect(ctrl.state).toBe("recording");
    await ctrl.toggle();
    expect(ctrl.state).toBe("idle");
  });

  it("toggle is a no-op in transient states", async () => {
    const sc = fakeSidecar({
      start_recording: () => ({ session_id: "s7" }),
    });
    const ctrl = new RecordingController({
      sidecar: sc,
      getSettings: async () => baseSettings(),
      appendTranscript: vi.fn(async () => {}),
    });
    await ctrl.start();
    // Now in recording. Force a transient state.
    (ctrl as any).state = "transcribing";
    const result = await ctrl.toggle();
    expect(result).toBeNull();
  });
});
