import type { WorkspaceDTO, FileResponse } from "@shared/types";

export async function fetchWorkspace(): Promise<WorkspaceDTO> {
  const r = await fetch("/api/workspace");
  if (!r.ok) throw new Error(`workspace request failed: ${r.status}`);
  return r.json();
}

export async function fetchFile(path: string): Promise<FileResponse> {
  const r = await fetch(`/api/file?path=${encodeURIComponent(path)}`);
  if (!r.ok) throw new Error(`file request failed: ${r.status}`);
  return r.json();
}

export async function fetchFileList(): Promise<string[]> {
  const r = await fetch("/api/files");
  if (!r.ok) throw new Error(`files request failed: ${r.status}`);
  return (await r.json()).files as string[];
}

export function rawUrl(path: string): string {
  return `/api/raw?path=${encodeURIComponent(path)}`;
}

export async function fetchRaw(path: string): Promise<string> {
  const r = await fetch(rawUrl(path));
  if (!r.ok) throw new Error(`raw request failed: ${r.status}`);
  return r.text();
}

export async function adoptDoc(path: string): Promise<{ ok: boolean; uid?: string; error?: string }> {
  const r = await fetch("/api/doc/adopt", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ path }),
  });
  return r.json();
}

export async function setDocStatus(
  path: string,
  status: string,
  deprecatedBy?: string,
): Promise<{ ok: boolean; error?: string }> {
  const r = await fetch("/api/doc/status", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ path, status, deprecatedBy }),
  });
  return r.json();
}

export async function setDocReview(
  path: string,
  fields: { owner?: string; lastReviewed?: string; reviewBy?: number },
): Promise<{ ok: boolean; error?: string }> {
  const r = await fetch("/api/doc/review", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ path, ...fields }),
  });
  return r.json();
}
