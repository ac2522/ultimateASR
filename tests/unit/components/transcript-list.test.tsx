import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";
import { TranscriptList } from "@/components/transcript-list";

function makeTranscripts(n: number) {
  // newest last in source — component should sort by `at` desc
  return Array.from({ length: n }, (_, i) => ({
    id: `id-${i}`,
    at: 1_000_000 + i, // increasing => higher index is newer
    text: `text-${i}`,
    engine: "whisper-local",
  }));
}

function setup(transcripts: any[]) {
  const writeText = vi.fn();
  Object.defineProperty(navigator, "clipboard", {
    value: { writeText },
    writable: true,
    configurable: true,
  });
  vi.stubGlobal("api", {
    transcripts: {
      list: vi.fn().mockResolvedValue(transcripts),
      clear: vi.fn().mockResolvedValue(null),
    },
  });
  (window as any).api = (globalThis as any).api;
  const qc = new QueryClient({ defaultOptions: { queries: { retry: 0 } } });
  render(
    <QueryClientProvider client={qc}>
      <TranscriptList />
    </QueryClientProvider>,
  );
  return { writeText };
}

describe("TranscriptList", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  it("renders only the 10 newest transcripts when there are 12", async () => {
    setup(makeTranscripts(12));
    // Newest is index 11 ("text-11"). Oldest two ("text-0", "text-1") should be hidden.
    await waitFor(() => expect(screen.getByText("text-11")).toBeInTheDocument());
    expect(screen.queryByText("text-0")).not.toBeInTheDocument();
    expect(screen.queryByText("text-1")).not.toBeInTheDocument();
    // Spot check that 10 unique texts ending in 2..11 are visible
    for (let i = 2; i <= 11; i++) {
      expect(screen.getByText(`text-${i}`)).toBeInTheDocument();
    }
  });

  it("clicking a row copies its text via navigator.clipboard.writeText", async () => {
    const { writeText } = setup(makeTranscripts(3));
    // Newest first → text-2
    const row = await screen.findByText("text-2");
    fireEvent.click(row);
    expect(writeText).toHaveBeenCalledWith("text-2");
  });

  it("shows empty state when no transcripts", async () => {
    setup([]);
    await waitFor(() => expect(screen.getByText(/no transcripts yet/i)).toBeInTheDocument());
  });
});
