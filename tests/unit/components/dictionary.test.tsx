import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";
import { DictionaryPage } from "@/pages/dictionary";

const baseSettings = {
  engine_kind: "auto", model_size: "ggml-base.bin", compute_backend: "auto",
  audio_device_index: null, audio_device_name: null, vad_aggressiveness: 1,
  padding_duration_ms: 1000, recording_mode: "silence", break_length: 5,
  hotkey: "Ctrl+Alt+Shift+L", auto_paste: false,
  custom_vocabulary: ["alpha", "beta"],
  cloud_api_key: "", cloud_model: "whisper-1",
  llm_enabled: false, llm_provider: "openai", llm_model: "gpt-4o-mini",
  llm_api_key: "", llm_endpoint: "", llm_system_prompt: "x",
  transcripts: [], first_run_done: false,
};

function setup(initial = baseSettings) {
  const set = vi.fn().mockImplementation(async (patch: any) => ({ ...initial, ...patch }));
  vi.stubGlobal("api", {
    settings: {
      get: vi.fn().mockResolvedValue(initial),
      set,
    },
  });
  (window as any).api = (globalThis as any).api;
  const qc = new QueryClient({ defaultOptions: { queries: { retry: 0 } } });
  render(
    <QueryClientProvider client={qc}>
      <DictionaryPage />
    </QueryClientProvider>,
  );
  return { set };
}

describe("DictionaryPage", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  it("renders existing vocabulary as badges", async () => {
    setup();
    await waitFor(() => expect(screen.getByText("alpha")).toBeInTheDocument());
    expect(screen.getByText("beta")).toBeInTheDocument();
  });

  it("typing + clicking Add calls api.settings.set with appended array", async () => {
    const { set } = setup();
    await screen.findByText("alpha");
    const input = screen.getByPlaceholderText(/word or phrase/i) as HTMLInputElement;
    fireEvent.change(input, { target: { value: "gamma" } });
    fireEvent.click(screen.getByRole("button", { name: /^add$/i }));
    await waitFor(() =>
      expect(set).toHaveBeenCalledWith({ custom_vocabulary: ["alpha", "beta", "gamma"] }),
    );
  });

  it("clicking the X on a badge removes that entry", async () => {
    const { set } = setup();
    await screen.findByText("alpha");
    const removeAlpha = screen.getByRole("button", { name: /remove alpha/i });
    fireEvent.click(removeAlpha);
    await waitFor(() =>
      expect(set).toHaveBeenCalledWith({ custom_vocabulary: ["beta"] }),
    );
  });
});
