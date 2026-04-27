import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/ipc";

const AVAIL_KEY = ["models", "available"] as const;
const DL_KEY = ["models", "downloaded"] as const;

export function useAvailableModels() {
  return useQuery({ queryKey: AVAIL_KEY, queryFn: () => api.models.listAvailable() });
}
export function useDownloadedModels() {
  return useQuery({ queryKey: DL_KEY, queryFn: () => api.models.listDownloaded() });
}

export function useDownloadModel() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (name: string) => api.models.download(name),
    onSuccess: () => qc.invalidateQueries({ queryKey: DL_KEY }),
  });
}

export function useDeleteModel() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (name: string) => api.models.delete(name),
    onSuccess: () => qc.invalidateQueries({ queryKey: DL_KEY }),
  });
}
