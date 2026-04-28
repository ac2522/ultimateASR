import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent, cleanup } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import React from "react";
import { HomePage } from "@/pages/home";

const navigateMock = vi.fn();
vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>(
    "react-router-dom",
  );
  return { ...actual, useNavigate: () => navigateMock };
});

function makeSettings(over: Record<string, any> = {}) {
  return {
    engine_kind: "auto", model_size: "ggml-base.bin", compute_backend: "auto",
    audio_device_index: null, audio_device_name: null, vad_aggressiveness: 1,
    padding_duration_ms: 1000, recording_mode: "silence", break_length: 5,
    hotkey: "Ctrl+Alt+Shift+L", auto_paste: false, custom_vocabulary: [],
    cloud_api_key: "", cloud_model: "whisper-1",
    llm_enabled: false, llm_provider: "openai", llm_model: "gpt-4o-mini",
    llm_api_key: "", llm_endpoint: "", llm_system_prompt: "x",
    transcripts: [], first_run_done: true,
    ...over,
  };
}

function setup(opts: {
  settings?: Record<string, any>;
  downloaded?: any[];
} = {}) {
  const settings = makeSettings(opts.settings ?? {});
  const downloaded = opts.downloaded ?? [];
  vi.stubGlobal("api", {
    ping: vi.fn().mockResolvedValue("pong"),
    settings: {
      get: vi.fn().mockResolvedValue(settings),
      set: vi.fn(),
    },
    models: {
      listAvailable: vi.fn().mockResolvedValue([]),
      listDownloaded: vi.fn().mockResolvedValue(downloaded),
    },
    transcripts: {
      list: vi.fn().mockResolvedValue([]),
      clear: vi.fn().mockResolvedValue(null),
    },
  });
  (window as any).api = (globalThis as any).api;
  const qc = new QueryClient({ defaultOptions: { queries: { retry: 0 } } });
  render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>
        <HomePage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("HomePage onboarding banner", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
    cleanup();
    navigateMock.mockReset();
  });

  it("shows the banner when no model is downloaded AND cloud key is empty AND first_run_done", async () => {
    setup({
      settings: { first_run_done: true, cloud_api_key: "" },
      downloaded: [],
    });
    await waitFor(() =>
      expect(
        screen.getByText(/you need a model or a cloud key/i),
      ).toBeInTheDocument(),
    );
    // Both call-to-action buttons render and route via useNavigate.
    fireEvent.click(screen.getByRole("button", { name: /download a model/i }));
    expect(navigateMock).toHaveBeenCalledWith("/models");
    fireEvent.click(screen.getByRole("button", { name: /add a cloud key/i }));
    expect(navigateMock).toHaveBeenCalledWith("/llm");
  });

  it("hides the banner when at least one model is downloaded", async () => {
    setup({
      settings: { first_run_done: true, cloud_api_key: "" },
      downloaded: [{ name: "ggml-base.bin", size_mb: 142 }],
    });
    // Resolve queries and ensure the banner heading never appears.
    await waitFor(() =>
      expect((window as any).api.models.listDownloaded).toHaveBeenCalled(),
    );
    expect(
      screen.queryByText(/you need a model or a cloud key/i),
    ).not.toBeInTheDocument();
  });

  it("hides the banner when cloud_api_key is set", async () => {
    setup({
      settings: { first_run_done: true, cloud_api_key: "sk-real-key" },
      downloaded: [],
    });
    await waitFor(() =>
      expect((window as any).api.settings.get).toHaveBeenCalled(),
    );
    expect(
      screen.queryByText(/you need a model or a cloud key/i),
    ).not.toBeInTheDocument();
  });

  it("hides the banner when first_run_done is false", async () => {
    setup({
      settings: { first_run_done: false, cloud_api_key: "" },
      downloaded: [],
    });
    await waitFor(() =>
      expect((window as any).api.settings.get).toHaveBeenCalled(),
    );
    expect(
      screen.queryByText(/you need a model or a cloud key/i),
    ).not.toBeInTheDocument();
  });
});
