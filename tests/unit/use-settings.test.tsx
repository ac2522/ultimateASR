import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";
import { useSettings, useUpdateSettings } from "@/hooks/use-settings";

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

beforeEach(() => {
  vi.stubGlobal("api", {
    settings: {
      get: vi.fn().mockResolvedValue(fakeSettings),
      set: vi.fn().mockImplementation(async (patch: any) => ({ ...fakeSettings, ...patch })),
    },
  });
  (window as any).api = (globalThis as any).api;
});

function wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: 0 } } });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

describe("useSettings", () => {
  it("loads settings via the API", async () => {
    const { result } = renderHook(() => useSettings(), { wrapper });
    await waitFor(() => expect(result.current.data?.engine_kind).toBe("auto"));
  });
  it("update mutates and writes to cache", async () => {
    const { result } = renderHook(() => ({ q: useSettings(), m: useUpdateSettings() }), { wrapper });
    await waitFor(() => expect(result.current.q.data).toBeDefined());
    await result.current.m.mutateAsync({ auto_paste: true });
    expect((window as any).api.settings.set).toHaveBeenCalledWith({ auto_paste: true });
  });
});
