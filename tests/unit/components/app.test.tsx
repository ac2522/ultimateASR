import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { HashRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import App from "@/App";

function setup() {
  vi.stubGlobal("api", {
    ping: vi.fn().mockResolvedValue("pong"),
    settings: { get: vi.fn(), set: vi.fn() },
  });
  (window as any).api = (globalThis as any).api;
  const qc = new QueryClient();
  render(
    <QueryClientProvider client={qc}>
      <HashRouter>
        <App />
      </HashRouter>
    </QueryClientProvider>
  );
}

describe("App shell", () => {
  it("renders sidebar with all five links", () => {
    setup();
    expect(screen.getByText("Home")).toBeInTheDocument();
    expect(screen.getByText("Settings")).toBeInTheDocument();
    expect(screen.getByText("Models")).toBeInTheDocument();
    expect(screen.getByText("Dictionary")).toBeInTheDocument();
    expect(screen.getByText("Cloud & LLM")).toBeInTheDocument();
  });
  it("home page mounts and shows brand", () => {
    setup();
    expect(screen.getByText("ultimateASR")).toBeInTheDocument();
  });
});
