import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { StatusPill } from "@/components/status-pill";

describe("StatusPill", () => {
  it("renders idle", () => {
    render(<StatusPill state="idle" />);
    expect(screen.getByText("Idle")).toBeInTheDocument();
    expect(screen.getByLabelText(/Status: Idle/)).toHaveAttribute("data-state", "idle");
  });
  it("renders recording with red color and pulse", () => {
    render(<StatusPill state="recording" />);
    const el = screen.getByText("Recording");
    expect(el).toBeInTheDocument();
    expect(el.parentElement?.className).toMatch(/bg-red-500/);
    expect(el.parentElement?.className).toMatch(/animate-pulse/);
  });
  it("renders transcribing distinct from recording", () => {
    render(<StatusPill state="transcribing" />);
    expect(screen.getByText("Transcribing…")).toBeInTheDocument();
  });
});
