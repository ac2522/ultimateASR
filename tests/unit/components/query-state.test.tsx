import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";
import { SettingsPage } from "@/pages/settings";
import { DictionaryPage } from "@/pages/dictionary";
import { LlmPage } from "@/pages/llm";

const FAIL_MESSAGE = "boom: sidecar exited with code 1";

function renderWithFailingSettings(Page: React.ComponentType) {
  vi.stubGlobal("api", {
    settings: {
      get: vi.fn().mockRejectedValue(new Error(FAIL_MESSAGE)),
      set: vi.fn(),
    },
    devices: { list: vi.fn().mockResolvedValue([]) },
  });
  (window as any).api = (globalThis as any).api;
  const qc = new QueryClient({ defaultOptions: { queries: { retry: 0 } } });
  render(
    <QueryClientProvider client={qc}>
      <Page />
    </QueryClientProvider>,
  );
}

describe("settings-bound pages on settings.get failure", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  it.each([
    ["SettingsPage", SettingsPage],
    ["DictionaryPage", DictionaryPage],
    ["LlmPage", LlmPage],
  ])("%s shows the error not 'Loading settings'", async (_name, Page) => {
    renderWithFailingSettings(Page);
    await waitFor(() => expect(screen.getByTestId("query-error")).toBeInTheDocument());
    expect(screen.getByText(FAIL_MESSAGE)).toBeInTheDocument();
    expect(screen.queryByText(/loading settings/i)).not.toBeInTheDocument();
  });
});
