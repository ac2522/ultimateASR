import { cn } from "@/lib/utils";

export type StatusPillState =
  | "idle" | "starting" | "recording" | "stopping" | "transcribing" | "cleaning";

const LABELS: Record<StatusPillState, string> = {
  idle: "Idle",
  starting: "Starting…",
  recording: "Recording",
  stopping: "Stopping…",
  transcribing: "Transcribing…",
  cleaning: "Cleaning up…",
};

const COLORS: Record<StatusPillState, string> = {
  idle: "bg-zinc-300 text-zinc-700 dark:bg-zinc-700 dark:text-zinc-200",
  starting: "bg-amber-400 text-amber-950",
  recording: "bg-red-500 text-white animate-pulse",
  stopping: "bg-amber-400 text-amber-950",
  transcribing: "bg-blue-500 text-white",
  cleaning: "bg-purple-500 text-white",
};

export function StatusPill({ state, className }: { state: StatusPillState; className?: string }) {
  return (
    <span className={cn(
      "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium",
      COLORS[state], className,
    )} aria-label={`Status: ${LABELS[state]}`} data-state={state}>
      <span className="size-2 rounded-full bg-current/70" aria-hidden />
      <span>{LABELS[state]}</span>
    </span>
  );
}
