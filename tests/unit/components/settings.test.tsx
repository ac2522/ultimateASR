import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";
import { SettingsPage } from "@/pages/settings";

const fakeSettings = {
  engine_kind: "auto", model_size: "ggml-base.bin", compute_backend: "auto",
  audio_device_index: null, audio_device_name: null, vad_aggressiveness: 1,
  padding_duration_ms: 1000, recording_mode: "silence", break_length: 5,
  hotkey: "Ctrl+Alt+Shift+L", auto_paste: false, custom_vocabulary: [],
  cloud_api_key: "", cloud_model: "whisper-1",
  llm_enabled: false, llm_provider: "openai", llm_model: "gpt-4o-mini",
  llm_api_key: "", llm_endpoint: "", llm_system_prompt: "x",
  transcripts: [], first_run_done: false,
};

function setup() {
  const set = vi.fn().mockImplementation(async (patch: any) => ({ ...fakeSettings, ...patch }));
  vi.stubGlobal("api", {
    settings: {
      get: vi.fn().mockResolvedValue(fakeSettings),
      set,
    },
    devices: {
      list: vi.fn().mockResolvedValue([
        { index: 0, name: "Default Mic", channels: 1, sample_rate: 16000 },
        { index: 1, name: "USB Headset", channels: 1, sample_rate: 16000 },
      ]),
    },
  });
  (window as any).api = (globalThis as any).api;
  const qc = new QueryClient({ defaultOptions: { queries: { retry: 0 } } });
  render(
    <QueryClientProvider client={qc}>
      <SettingsPage />
    </QueryClientProvider>,
  );
  return { set };
}

describe("SettingsPage", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  it("renders Engine, Audio, and Hotkey section headings", async () => {
    setup();
    // Wait for settings to load by finding a known interactive control
    await screen.findByLabelText(/recording mode/i);
    expect(screen.getAllByText("Engine").length).toBeGreaterThan(0);
    expect(screen.getByText("Audio")).toBeInTheDocument();
    expect(screen.getAllByText(/hotkey/i).length).toBeGreaterThan(0);
  });

  it("toggling auto-paste calls api.settings.set with auto_paste true", async () => {
    const { set } = setup();
    const toggle = await screen.findByLabelText(/auto[- ]?paste/i);
    fireEvent.click(toggle);
    await waitFor(() => expect(set).toHaveBeenCalledWith({ auto_paste: true }));
  });

  it("changing recording mode select calls api.settings.set with recording_mode", async () => {
    const { set } = setup();
    const select = await screen.findByLabelText(/recording mode/i);
    fireEvent.change(select, { target: { value: "button" } });
    await waitFor(() => expect(set).toHaveBeenCalledWith({ recording_mode: "button" }));
  });
});
