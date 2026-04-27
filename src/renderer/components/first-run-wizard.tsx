import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useSettings, useUpdateSettings } from "@/hooks/use-settings";
import { api } from "@/lib/ipc";

type Step = "welcome" | "hardware" | "model";

interface HardwareInfo {
  os: "linux" | "darwin" | "windows";
  arch: string;
  cpu_count: number;
  ram_gb: number;
  cuda: boolean;
  metal: boolean;
  vulkan: boolean;
  coreml: boolean;
}

type Backend = "cuda" | "metal" | "vulkan" | "cpu";

/**
 * First-run onboarding wizard. Reads settings; renders nothing if the user
 * has already completed first-run. Otherwise runs through Welcome -> Hardware
 * detect -> Model selection, persists the user's choices, marks
 * `first_run_done: true`, and kicks off a background download of the chosen
 * model. The download is fire-and-forget so closing the wizard never blocks
 * on a multi-minute network operation.
 */
export function FirstRunWizard() {
  const { data: settings, isLoading } = useSettings();
  const update = useUpdateSettings();
  const [step, setStep] = useState<Step>("welcome");
  const [closed, setClosed] = useState(false);

  const open = !closed && !isLoading && !!settings && settings.first_run_done === false;

  const hardware = useQuery<HardwareInfo>({
    queryKey: ["first-run", "hardware"],
    queryFn: () => api.hardware.detect(),
    enabled: open && step !== "welcome",
  });

  const recommendedBackend = useQuery<Backend>({
    queryKey: ["first-run", "recommend-backend"],
    queryFn: () => api.hardware.recommendBackend(),
    enabled: open && step !== "welcome",
  });

  const recommendedModel = useQuery<string>({
    queryKey: ["first-run", "recommend-model"],
    queryFn: () => api.hardware.recommendModel(),
    enabled: open && step === "model",
  });

  const availableModels = useQuery<{ name: string; size_mb: number; description: string }[]>({
    queryKey: ["first-run", "available-models"],
    queryFn: () => api.models.listAvailable(),
    enabled: open && step === "model",
  });

  const [selectedModel, setSelectedModel] = useState<string | null>(null);
  useEffect(() => {
    if (!selectedModel && recommendedModel.data) {
      setSelectedModel(recommendedModel.data);
    }
  }, [recommendedModel.data, selectedModel]);

  const backendCandidates = useMemo(() => {
    const hw = hardware.data;
    if (!hw) return [] as Backend[];
    const out: Backend[] = [];
    if (hw.cuda) out.push("cuda");
    if (hw.metal) out.push("metal");
    if (hw.vulkan) out.push("vulkan");
    out.push("cpu");
    return out;
  }, [hardware.data]);

  if (!open) return null;

  async function handleGetStarted() {
    const backend = recommendedBackend.data ?? "cpu";
    const model = selectedModel ?? recommendedModel.data;
    if (!model) return;
    try {
      await update.mutateAsync({ compute_backend: backend, model_size: model });
      await update.mutateAsync({ first_run_done: true });
      // Fire-and-forget: download can take minutes; the user lands on Home
      // and watches progress on the existing models page.
      void api.models.download(model).catch(() => { /* surfaced via models page */ });
    } finally {
      setClosed(true);
    }
  }

  return (
    <Dialog open={open} onOpenChange={() => { /* user must complete the flow */ }}>
      <DialogContent>
        {step === "welcome" && (
          <>
            <DialogHeader>
              <DialogTitle>Welcome to ultimateASR</DialogTitle>
              <DialogDescription>
                Local-first dictation that runs entirely on your machine. We will
                detect your hardware and pick a model that fits.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button onClick={() => setStep("hardware")}>Continue</Button>
            </DialogFooter>
          </>
        )}

        {step === "hardware" && (
          <>
            <DialogHeader>
              <DialogTitle>Hardware</DialogTitle>
              <DialogDescription>
                We picked the fastest backend available on your system.
              </DialogDescription>
            </DialogHeader>
            {hardware.data ? (
              <div className="space-y-2 text-sm">
                <div>
                  <span className="text-muted-foreground">OS / arch: </span>
                  <span>{hardware.data.os} / {hardware.data.arch}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">CPU cores: </span>
                  <span>{hardware.data.cpu_count}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">RAM: </span>
                  <span>{hardware.data.ram_gb} GB</span>
                </div>
                <div className="pt-2">
                  <div className="text-muted-foreground mb-1">Compute backends</div>
                  <ul className="space-y-1">
                    {backendCandidates.map((b) => {
                      const isRecommended = b === recommendedBackend.data;
                      return (
                        <li
                          key={b}
                          className={
                            isRecommended
                              ? "rounded border border-primary px-2 py-1 font-medium"
                              : "px-2 py-1 text-muted-foreground"
                          }
                        >
                          {b.toUpperCase()}{isRecommended ? " (recommended)" : ""}
                        </li>
                      );
                    })}
                  </ul>
                </div>
              </div>
            ) : (
              <div className="text-sm text-muted-foreground">Detecting hardware...</div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setStep("welcome")}>Back</Button>
              <Button onClick={() => setStep("model")}>Continue</Button>
            </DialogFooter>
          </>
        )}

        {step === "model" && (
          <>
            <DialogHeader>
              <DialogTitle>Choose your engine</DialogTitle>
              <DialogDescription>
                We pre-selected the option that fits your hardware. You can override it.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-2">
              <Label htmlFor="first-run-model">Model</Label>
              <select
                id="first-run-model"
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
                value={selectedModel ?? ""}
                onChange={(e) => setSelectedModel(e.target.value)}
              >
                {(availableModels.data ?? []).map((m) => (
                  <option key={m.name} value={m.name}>
                    {m.name}{m.name === recommendedModel.data ? " — recommended" : ""}
                  </option>
                ))}
              </select>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setStep("hardware")}>Back</Button>
              <Button
                onClick={handleGetStarted}
                disabled={!selectedModel || update.isPending}
              >
                Get Started
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
