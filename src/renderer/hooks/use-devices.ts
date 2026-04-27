import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/ipc";

export function useDevices() {
  return useQuery({ queryKey: ["devices"], queryFn: () => api.devices.list() });
}
