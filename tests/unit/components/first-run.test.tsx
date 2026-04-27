import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent, cleanup } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { FirstRunWizard } from "@/components/first-run-wizard";

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

function stubApi(overrides: any = {}) {
  const base = {
    settings: {
      get: vi.fn().mockResolvedValue({ ...fakeSettings, first_run_done: false }),
      set: vi.fn().mockImplementation(async (patch: any) => ({ ...fakeSettings, ...patch })),
    },
    hardware: {
      detect: vi.fn().mockResolvedValue({
        os: "linux", arch: "x86_64", cpu_count: 8, ram_gb: 16,
        cuda: true, metal: false, vulkan: true, coreml: false,
      }),
      recommendBackend: vi.fn().mockResolvedValue("cuda"),
      recommendModel: vi.fn().mockResolvedValue("ggml-large-v3-turbo-q5_0.bin"),
    },
    models: {
      listAvailable: vi.fn().mockResolvedValue([
        { name: "ggml-base.bin", size_mb: 142, description: "Base" },
        { name: "ggml-small.bin", size_mb: 466, description: "Small" },
        { name: "ggml-large-v3-turbo-q5_0.bin", size_mb: 574, description: "Turbo Q5" },
      ]),
      download: vi.fn().mockResolvedValue({ path: "/x" }),
    },
    ...overrides,
  };
  vi.stubGlobal("api", base);
  (window as any).api = (globalThis as any).api;
  return base;
}

function renderWizard() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: 0 } } });
  return render(
    <QueryClientProvider client={qc}>
      <FirstRunWizard />
    </QueryClientProvider>,
  );
}

describe("FirstRunWizard", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
    cleanup();
  });

  it("does not render when first_run_done is true", async () => {
    const api = stubApi({
      settings: {
        get: vi.fn().mockResolvedValue({ ...fakeSettings, first_run_done: true }),
        set: vi.fn(),
      },
    });
    renderWizard();
    // Give react-query a chance to resolve.
    await waitFor(() => expect(api.settings.get).toHaveBeenCalled());
    expect(screen.queryByText(/welcome to ultimateasr/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/get started/i)).not.toBeInTheDocument();
  });

  it("progresses Welcome -> Hardware -> Model", async () => {
    stubApi();
    renderWizard();
    // Step 1: welcome.
    await screen.findByText(/welcome to ultimateasr/i);
    fireEvent.click(screen.getByRole("button", { name: /continue/i }));
    // Step 2: hardware shows OS and recommended backend.
    await waitFor(() => expect(screen.getByText(/linux/i)).toBeInTheDocument());
    expect(screen.getAllByText(/cuda/i).length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole("button", { name: /continue/i }));
    // Step 3: model picker appears.
    await screen.findByLabelText(/model/i);
    expect(screen.getByRole("button", { name: /get started/i })).toBeInTheDocument();
  });

  it("Get Started commits backend + model and triggers download + first_run_done", async () => {
    const api = stubApi();
    renderWizard();
    await screen.findByText(/welcome to ultimateasr/i);
    fireEvent.click(screen.getByRole("button", { name: /continue/i }));
    await waitFor(() => expect(api.hardware.detect).toHaveBeenCalled());
    fireEvent.click(screen.getByRole("button", { name: /continue/i }));
    await waitFor(() => expect(api.hardware.recommendModel).toHaveBeenCalled());
    await waitFor(() => expect(api.models.listAvailable).toHaveBeenCalled());
    // Wait for the Get Started button to become enabled (model selection populated).
    const button = await screen.findByRole("button", { name: /get started/i });
    await waitFor(() => expect(button).not.toBeDisabled());
    fireEvent.click(button);
    await waitFor(() => {
      expect(api.settings.set).toHaveBeenCalledWith(
        expect.objectContaining({
          compute_backend: "cuda",
          model_size: "ggml-large-v3-turbo-q5_0.bin",
        }),
      );
    });
    await waitFor(() => {
      expect(api.settings.set).toHaveBeenCalledWith(
        expect.objectContaining({ first_run_done: true }),
      );
    });
    expect(api.models.download).toHaveBeenCalledWith("ggml-large-v3-turbo-q5_0.bin");
  });

  it("Back returns to previous step without committing settings", async () => {
    const api = stubApi();
    renderWizard();
    await screen.findByText(/welcome to ultimateasr/i);
    fireEvent.click(screen.getByRole("button", { name: /continue/i }));
    await waitFor(() => expect(api.hardware.detect).toHaveBeenCalled());
    fireEvent.click(screen.getByRole("button", { name: /back/i }));
    await screen.findByText(/welcome to ultimateasr/i);
    expect(api.settings.set).not.toHaveBeenCalled();
  });
});
