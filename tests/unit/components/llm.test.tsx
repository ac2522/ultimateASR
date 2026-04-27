import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";
import { LlmPage, DEFAULT_LLM_SYSTEM_PROMPT } from "@/pages/llm";

function makeSettings(over: Record<string, any> = {}) {
  return {
    engine_kind: "auto", model_size: "ggml-base.bin", compute_backend: "auto",
    audio_device_index: null, audio_device_name: null, vad_aggressiveness: 1,
    padding_duration_ms: 1000, recording_mode: "silence", break_length: 5,
    hotkey: "Ctrl+Alt+Shift+L", auto_paste: false, custom_vocabulary: [],
    cloud_api_key: "", cloud_model: "whisper-1",
    llm_enabled: false, llm_provider: "openai", llm_model: "gpt-4o-mini",
    llm_api_key: "", llm_endpoint: "",
    llm_system_prompt: "stale",
    transcripts: [], first_run_done: false,
    ...over,
  };
}

function setup(initial = makeSettings()) {
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
      <LlmPage />
    </QueryClientProvider>,
  );
  return { set };
}

describe("LlmPage", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  it("disables LLM provider field when llm_enabled is false", async () => {
    setup();
    const provider = (await screen.findByLabelText(/llm provider/i)) as HTMLSelectElement;
    expect(provider.disabled).toBe(true);
  });

  it("switching to ollama hides api_key and shows endpoint", async () => {
    setup(makeSettings({ llm_enabled: true, llm_provider: "openai" }));
    const provider = (await screen.findByLabelText(/llm provider/i)) as HTMLSelectElement;
    expect(screen.queryByLabelText(/llm api key/i)).toBeInTheDocument();
    expect(screen.queryByLabelText(/llm endpoint/i)).not.toBeInTheDocument();
    fireEvent.change(provider, { target: { value: "ollama" } });
    await waitFor(() =>
      expect(screen.queryByLabelText(/llm api key/i)).not.toBeInTheDocument(),
    );
    expect(screen.getByLabelText(/llm endpoint/i)).toBeInTheDocument();
  });

  it("Reset to default sets llm_system_prompt back to canonical default", async () => {
    const { set } = setup(makeSettings({ llm_enabled: true }));
    const reset = await screen.findByRole("button", { name: /reset to default/i });
    fireEvent.click(reset);
    await waitFor(() =>
      expect(set).toHaveBeenCalledWith({ llm_system_prompt: DEFAULT_LLM_SYSTEM_PROMPT }),
    );
  });
});
