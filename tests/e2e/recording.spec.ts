import { test, expect } from "@playwright/test";
import { launchApp } from "./helpers";

// We exercise the lower-level RPC plumbing (preload bridge → main IPC → fake
// sidecar) rather than driving the full RecordingController, because the
// controller is already covered end-to-end by tests/unit/recording-controller.test.ts
// and adding a test-only IPC channel just to drive it would pollute production.

interface ApiWindow {
  api: {
    recording: {
      start: (input: { mode: "silence" | "button" }) => Promise<{ session_id: string }>;
      stop: (id: string) => Promise<{ samples_pcm_b64: string; sample_rate: number }>;
    };
    transcribe: (input: { engine_kind: string; pcm_b64: string; sample_rate: number }) => Promise<{ text: string }>;
    transcripts: {
      list: () => Promise<unknown[]>;
      clear: () => Promise<null>;
    };
  };
}

test("recording IPC: start → stop → transcribe round-trip via preload bridge", async () => {
  const { window, cleanup } = await launchApp();
  try {
    const session = await window.evaluate(() =>
      (window as unknown as ApiWindow).api.recording.start({ mode: "silence" }),
    );
    expect(session.session_id).toBe("fake-session");

    const stopped = await window.evaluate((id: string) =>
      (window as unknown as ApiWindow).api.recording.stop(id), session.session_id);
    expect(typeof stopped.samples_pcm_b64).toBe("string");
    expect(stopped.sample_rate).toBe(16000);

    const transcribed = await window.evaluate(({ b64, sr }) =>
      (window as unknown as ApiWindow).api.transcribe({
        engine_kind: "whisper-local", pcm_b64: b64, sample_rate: sr,
      }),
      { b64: stopped.samples_pcm_b64, sr: stopped.sample_rate },
    );
    expect(transcribed.text).toBe("hello world");
  } finally {
    await cleanup();
  }
});

test("transcripts.list / transcripts.clear round-trip via main-process store", async () => {
  const { window, cleanup } = await launchApp();
  try {
    const empty = await window.evaluate(() =>
      (window as unknown as ApiWindow).api.transcripts.list(),
    );
    expect(empty).toEqual([]);

    const cleared = await window.evaluate(() =>
      (window as unknown as ApiWindow).api.transcripts.clear(),
    );
    expect(cleared).toBeNull();
  } finally {
    await cleanup();
  }
});
