import type { FetchLike } from "./jamendo.js";
import { UpstreamError, type StreamResult } from "./types.js";

/**
 * Proxy an upstream audio file with HTTP Range support. Redirects are followed
 * manually so every hop is checked against the source's host allowlist (SSRF guard).
 */
export async function proxyAudio(
  url: string,
  range: string | undefined,
  isAllowed: (url: string) => boolean,
  fetchImpl: FetchLike,
  defaultType = "audio/mpeg",
): Promise<StreamResult> {
  let current = url;
  for (let hop = 0; hop < 5; hop++) {
    if (!isAllowed(current)) throw new UpstreamError("Audio host not allowed", 502);
    let res: Response;
    try {
      res = await fetchImpl(current, {
        redirect: "manual",
        headers: range ? { range } : {},
        signal: AbortSignal.timeout(15_000),
      });
    } catch (e) {
      throw new UpstreamError(`Audio fetch failed: ${(e as Error).message}`);
    }
    if (res.status >= 300 && res.status < 400 && res.headers.get("location")) {
      current = new URL(res.headers.get("location")!, current).toString();
      continue;
    }
    if (!res.ok || !res.body) throw new UpstreamError(`Audio HTTP ${res.status}`);
    const headers: Record<string, string> = {};
    for (const h of ["content-type", "content-length", "content-range", "accept-ranges"]) {
      const v = res.headers.get(h);
      if (v) headers[h] = v;
    }
    headers["content-type"] ??= defaultType;
    headers["accept-ranges"] ??= "bytes";
    return { status: res.status, headers, body: res.body };
  }
  throw new UpstreamError("Too many audio redirects");
}

export function hostAllowlist(...domains: string[]) {
  return (url: string): boolean => {
    try {
      const u = new URL(url);
      return u.protocol === "https:" && domains.some((d) => u.hostname === d || u.hostname.endsWith(`.${d}`));
    } catch {
      return false;
    }
  };
}
