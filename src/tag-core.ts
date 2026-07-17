/* Pure helpers behind the drop-in tag (tag.ts). Kept DOM-light so they
   are unit-testable without a browser. */

import { createEventId } from "./id.js";

export const DEFAULT_TAG_ENDPOINT = "https://api.okovia.com";
export const ANONYMOUS_ID_KEY = "okovia_aid";
export const SESSION_ID_KEY = "okovia_sid";

export interface TagConfig {
  publicKey: string;
  endpoint: string;
}

export interface ScriptDatasetLike {
  key?: string;
  endpoint?: string;
}

/** Resolves the tag configuration from the <script> tag's data-* attrs.
 *  Returns null (tag stays inert) when no key is provided. */
export function resolveTagConfig(dataset: ScriptDatasetLike | undefined): TagConfig | null {
  const publicKey = dataset?.key?.trim() ?? "";
  if (!publicKey) {
    return null;
  }
  const endpoint = dataset?.endpoint?.trim() || DEFAULT_TAG_ENDPOINT;
  return { publicKey, endpoint: endpoint.replace(/\/+$/, "") };
}

/** GA-style feature inference: the first path segment names the surface
 *  ("/checkout/review" -> "checkout"), the root becomes "home". */
export function featureFromPath(pathname: string): string {
  const segment = pathname.split("/").filter(Boolean)[0] ?? "";
  return segment || "home";
}

interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

/** Stable per-browser id (GA client id equivalent). Falls back to an
 *  ephemeral id when storage is unavailable (Safari private mode). */
export function getOrCreateId(storage: StorageLike | undefined, key: string): string {
  const fresh = `anon_${createEventId().slice(4)}`;
  if (!storage) {
    return fresh;
  }
  try {
    const existing = storage.getItem(key);
    if (existing) {
      return existing;
    }
    storage.setItem(key, fresh);
    return fresh;
  } catch {
    return fresh;
  }
}

export function createOperationId(): string {
  return `op_${createEventId().slice(4)}`;
}

export const OPERATION_ID_HEADER = "X-Okovia-Operation-Id";

/** Parses data-correlate ("/api/ai,/chat") into clean path prefixes.
 *  Empty/absent means correlation stays off — the tag never touches
 *  fetch unless the customer opted in. */
export function parseCorrelatePaths(value: string | undefined): string[] {
  if (!value) {
    return [];
  }
  return value
    .split(",")
    .map((prefix) => prefix.trim())
    .filter((prefix) => prefix.startsWith("/"));
}

/** Same-origin + opted-in path prefix: the only requests that get the
 *  operation-id header. Cross-origin is never touched (both to avoid
 *  CORS preflight breakage and to never leak ids to third parties). */
export function shouldCorrelate(url: string, pageOrigin: string, prefixes: string[]): boolean {
  if (prefixes.length === 0) {
    return false;
  }
  let resolved: URL;
  try {
    resolved = new URL(url, pageOrigin);
  } catch {
    return false;
  }
  if (resolved.origin !== pageOrigin) {
    return false;
  }
  return prefixes.some((prefix) => resolved.pathname.startsWith(prefix));
}
