import { useEffect, useState } from "react";
import type { FileResponse } from "@shared/types";
import { fetchFile } from "../lib/api";

export interface UseFile {
  file: FileResponse | null;
  loading: boolean;
  error: string | null;
}

/** Fetch a single file's full content; re-fetches when path or tick changes. */
export function useFile(path: string | undefined, tick: number): UseFile {
  const [file, setFile] = useState<FileResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!path) {
      setFile(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    fetchFile(path)
      .then((f) => {
        if (cancelled) return;
        setFile(f);
        setError(null);
      })
      .catch((e) => {
        if (!cancelled) setError((e as Error).message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [path, tick]);

  return { file, loading, error };
}
