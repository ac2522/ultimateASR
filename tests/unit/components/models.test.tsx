import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";
import { ModelsPage } from "@/pages/models";

const available = [
  { name: "ggml-base.bin", size_mb: 142, description: "Base whisper.cpp model" },
  { name: "ggml-large-v3.bin", size_mb: 2950, description: "Large multilingual" },
];

function setup(opts?: { downloaded?: any[]; eventsHandler?: { current: ((p: any) => void) | null } }) {
  const downloaded = opts?.downloaded ?? [];
  const eventsHandler = opts?.eventsHandler;
  const onMock = vi.fn((_channel: string, cb: (p: any) => void) => {
    if (eventsHandler) eventsHandler.current = cb;
    return () => {};
  });
  vi.stubGlobal("api", {
    models: {
      listAvailable: vi.fn().mockResolvedValue(available),
      listDownloaded: vi.fn().mockResolvedValue(downloaded),
      download: vi.fn().mockResolvedValue({ path: "/tmp/x" }),
      delete: vi.fn().mockResolvedValue(null),
    },
    events: { on: onMock },
  });
  (window as any).api = (globalThis as any).api;
  const qc = new QueryClient({ defaultOptions: { queries: { retry: 0 } } });
  render(
    <QueryClientProvider client={qc}>
      <ModelsPage />
    </QueryClientProvider>,
  );
  return { onMock };
}

describe("ModelsPage", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  it("clicking Download calls api.models.download with the model name", async () => {
    setup();
    const btn = await screen.findByRole("button", { name: /^download ggml-base\.bin$/i });
    fireEvent.click(btn);
    await waitFor(() =>
      expect((window as any).api.models.download).toHaveBeenCalledWith("ggml-base.bin"),
    );
  });

  it("a progress event causes the progress indicator to show the percent", async () => {
    const eventsHandler: { current: ((p: any) => void) | null } = { current: null };
    setup({ eventsHandler });
    await screen.findByText("ggml-base.bin");
    expect(eventsHandler.current).not.toBeNull();
    act(() => {
      eventsHandler.current!({ name: "ggml-base.bin", percent: 42 });
    });
    await waitFor(() => {
      expect(screen.getByText(/42%/)).toBeInTheDocument();
    });
  });

  it("clicking Delete on a downloaded row calls api.models.delete", async () => {
    setup({ downloaded: [{ name: "ggml-base.bin", path: "/tmp/x", size_mb: 142 }] });
    const btn = await screen.findByRole("button", { name: /^delete ggml-base\.bin$/i });
    fireEvent.click(btn);
    await waitFor(() =>
      expect((window as any).api.models.delete).toHaveBeenCalledWith("ggml-base.bin"),
    );
  });
});
