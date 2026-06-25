import { useCallback, useEffect, useState } from "react";
import type { WorkspaceDTO } from "@shared/types";
import { fetchWorkspace } from "../lib/api";

export interface UseWorkspace {
  data: WorkspaceDTO | null;
  error: string | null;
  loading: boolean;
  refetch: () => Promise<void>;
}

export function useWorkspace(): UseWorkspace {
  const [data, setData] = useState<WorkspaceDTO | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const refetch = useCallback(async () => {
    try {
      const ws = await fetchWorkspace();
      setData(ws);
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  return { data, error, loading, refetch };
}
