import { isIP } from "node:net";

/**
 * Fetch of a third-party JSON document (Client ID Metadata Documents; filmia never fetches a
 * JWKS because private_key_jwt is not supported). The URL comes from whoever calls
 * /authorize, so the fetch must not become a way to reach private hosts or exhaust memory.
 */

export const DOCUMENT_MAX_BYTES = 64 * 1024;
export const DOCUMENT_TIMEOUT_MS = 10_000;

export type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

export type FetchDocumentResult =
  | { ok: true; json: unknown }
  | { ok: false; reason: "url" | "status" | "too_large" | "redirect" | "json" | "network" };

const PRIVATE_SUFFIXES = [".local", ".internal", ".localhost", ".lan", ".home.arpa"];

/** https, a DNS name (no IP literal) that is not localhost or a private-network name. */
export const isFetchableDocumentUrl = (value: string) => {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return false;
  }
  if (url.protocol !== "https:" || url.username || url.password) return false;
  if (url.port && url.port !== "443") return false;
  const host = url.hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (!host || isIP(host) !== 0) return false;
  // Hex/octal/decimal shorthands (`0x7f.1`, `2130706433`) that resolvers may read as IPs.
  if (/^[0-9.]+$/.test(host) || /^0x[0-9a-f.]+$/i.test(host)) return false;
  if (host === "localhost" || !host.includes(".")) return false;
  return !PRIVATE_SUFFIXES.some((suffix) => host.endsWith(suffix));
};

const readCapped = async (response: Response, maxBytes: number) => {
  const declared = Number(response.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > maxBytes) return null;
  if (!response.body) return "";
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel().catch(() => undefined);
      return null;
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks).toString("utf8");
};

export const fetchJsonDocument = async (
  url: string,
  {
    fetchImpl = fetch as FetchLike,
    maxBytes = DOCUMENT_MAX_BYTES,
    timeoutMs = DOCUMENT_TIMEOUT_MS,
  }: { fetchImpl?: FetchLike; maxBytes?: number; timeoutMs?: number } = {},
): Promise<FetchDocumentResult> => {
  if (!isFetchableDocumentUrl(url)) return { ok: false, reason: "url" };

  let target = url;
  for (let hop = 0; hop < 2; hop += 1) {
    let response: Response;
    try {
      response = await fetchImpl(target, {
        headers: { accept: "application/json" },
        redirect: "manual",
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch {
      return { ok: false, reason: "network" };
    }

    if (response.status >= 300 && response.status < 400) {
      // At most one redirect, and only to the same host.
      const location = response.headers.get("location");
      const next = location ? new URL(location, target).toString() : null;
      if (hop > 0 || !next || new URL(next).host !== new URL(url).host || !isFetchableDocumentUrl(next)) {
        return { ok: false, reason: "redirect" };
      }
      target = next;
      continue;
    }
    if (!response.ok) return { ok: false, reason: "status" };

    const text = await readCapped(response, maxBytes);
    if (text === null) return { ok: false, reason: "too_large" };
    try {
      return { ok: true, json: JSON.parse(text) };
    } catch {
      return { ok: false, reason: "json" };
    }
  }
  return { ok: false, reason: "redirect" };
};
