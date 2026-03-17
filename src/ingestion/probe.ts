/** Synthetic health probe — independent verification of vendor availability. */
export interface ProbeResult {
  httpStatus?: number;
  latencyMs?: number;
  ok: boolean;
  error?: string;
}

/**
 * Perform a lightweight HTTP probe against a URL.
 * Uses HEAD with a short timeout to minimize impact.
 */
export async function probeEndpoint(url: string): Promise<ProbeResult> {
  const start = Date.now();

  try {
    const resp = await fetch(url, {
      method: "HEAD",
      headers: { "User-Agent": "StatusPulse/1.0 (probe)" },
      signal: AbortSignal.timeout(10000),
      redirect: "follow",
    });

    return {
      httpStatus: resp.status,
      latencyMs: Date.now() - start,
      ok: resp.ok,
    };
  } catch (err: unknown) {
    return {
      latencyMs: Date.now() - start,
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
