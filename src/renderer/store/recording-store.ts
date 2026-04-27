import { create } from "zustand";

export type RecordingState = "idle" | "starting" | "recording" | "stopping" | "transcribing" | "cleaning";

interface RecordingStore {
  state: RecordingState;
  sessionId: string | null;
  setState: (s: RecordingState) => void;
  setSessionId: (id: string | null) => void;
}

export const useRecordingStore = create<RecordingStore>((set) => ({
  state: "idle",
  sessionId: null,
  setState: (s) => set({ state: s }),
  setSessionId: (id) => set({ sessionId: id }),
}));
