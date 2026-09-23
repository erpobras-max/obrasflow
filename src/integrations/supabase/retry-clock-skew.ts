/** Retry only reads rejected because Auth/PostgREST clocks briefly disagree. */
export function createClockSkewFetch(
  request: typeof fetch,
  pause: (ms: number) => Promise<void> = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
): typeof fetch {
  return async (input, init) => {
    const method = (init?.method ?? (input instanceof Request ? input.method : "GET")).toUpperCase();
    const delays = [400, 1000, 2000];
    for (let attempt = 0; ; attempt++) {
      const response = await request(input, init);
      if (method !== "GET" || response.status !== 401 || attempt >= delays.length) return response;
      const body = await response.clone().json().catch(() => null);
      if (body?.code !== "PGRST303" || !/JWT issued at future/i.test(body?.message ?? "")) return response;
      await pause(delays[attempt]);
      const signal = init?.signal ?? (input instanceof Request ? input.signal : undefined);
      signal?.throwIfAborted();
    }
  };
}
