export type Sse = {
  /** Writes a JSON data event. Returns Node stream's backpressure boolean. */
  write: (data: unknown) => boolean;
  /** Writes a named event; optional id. Returns backpressure boolean. */
  event: (name: string, data?: unknown, id?: string) => boolean;
  /** Writes a comment line (e.g., keepalive). Returns backpressure boolean. */
  comment: (text: string) => boolean;
  /** Writes a ping comment. Returns backpressure boolean. */
  ping: () => boolean;
  /** Ends the stream after an optional delay (ms). */
  close: (delayMs?: number) => void;
  /** Register a callback for client disconnect. */
  onClose: (cb: () => void) => void;
};

export function createSse(res: any, req?: any, opts?: { pingMs?: number }): Sse {
  const pingMs = opts?.pingMs ?? 15000;
  // Standard SSE headers; CORS is handled globally
  // Because we stream directly to res.raw without reply.send(), Fastify CORS hooks
  // may not attach headers. Add permissive CORS headers up-front for SSE.
  const setHeader = (name: string, value: string) => {
    try {
      if (typeof res.header === "function") res.header(name, value);
    } catch {}
    try {
      if (res?.raw && typeof res.raw.setHeader === "function") res.raw.setHeader(name, value);
    } catch {}
  };
  const allowed = [process.env.APP_PUBLIC_URL ?? "http://localhost:3000", "http://127.0.0.1:3000"];
  const reqOrigin: string | undefined = (() => {
    try {
      return (req?.headers?.origin as string | undefined) ?? undefined;
    } catch {
      return undefined;
    }
  })();
  const allowOrigin = !reqOrigin || allowed.includes(reqOrigin) ? (reqOrigin ?? "*") : undefined;
  if (allowOrigin) setHeader("Access-Control-Allow-Origin", allowOrigin);
  setHeader("Access-Control-Allow-Credentials", "true");
  setHeader("Access-Control-Expose-Headers", "Content-Type, Cache-Control, Last-Event-ID");
  setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, Accept, Last-Event-ID");
  setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  setHeader("Vary", "Origin");
  setHeader("Content-Type", "text/event-stream");
  setHeader("Cache-Control", "no-cache, no-transform");
  setHeader("Connection", "keep-alive");
  setHeader("X-Accel-Buffering", "no");
  if (typeof res.raw?.flushHeaders === "function") {
    try {
      res.raw.flushHeaders();
    } catch {}
  }

  const writeRaw = (chunk: string): boolean => {
    try {
      // Node's write returns boolean indicating if it should be backpressured
      return res.raw.write(chunk);
    } catch {
      return false;
    }
  };

  const write = (data: unknown): boolean => {
    return writeRaw(`data: ${JSON.stringify(data)}\n\n`);
  };

  const event = (name: string, data?: unknown, id?: string): boolean => {
    let ok = writeRaw(`event: ${name}\n`);
    if (id) ok = writeRaw(`id: ${id}\n`) && ok;
    if (data !== undefined) ok = writeRaw(`data: ${JSON.stringify(data)}\n\n`) && ok;
    else ok = writeRaw(`\n`) && ok;
    return ok;
  };

  const comment = (text: string): boolean => {
    return writeRaw(`: ${text}\n\n`);
  };

  const ping = (): boolean => comment("ping");

  let timer: any | undefined = undefined;
  if (pingMs > 0) {
    timer = setInterval(() => {
      try {
        ping();
      } catch {}
    }, pingMs);
  }

  const close = (delayMs?: number) => {
    if (timer) clearInterval(timer);
    const end = () => {
      try {
        res.raw.end();
      } catch {}
    };
    if (delayMs && delayMs > 0) setTimeout(end, delayMs);
    else end();
  };

  const onClose = (cb: () => void) => {
    try {
      const rawReq = req?.raw ?? req;
      if (rawReq && typeof rawReq.on === "function") {
        rawReq.on("close", cb);
      }
    } catch {}
  };

  // Initial connect comment to prime the stream
  comment("connected");

  return { write, event, comment, ping, close, onClose };
}
