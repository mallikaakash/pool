import http from "node:http";

export function serve(demo, port = 8787) {
  let pending = false;
  const server = http.createServer(async (req, res) => {
    res.setHeader("Content-Type", "application/json");
    res.setHeader("Cache-Control", "no-store");
    res.setHeader("X-Content-Type-Options", "nosniff");
    const reply = (status, data) => {
      res.statusCode = status;
      res.end(JSON.stringify(data));
    };
    // Local operator API, not a wallet service. Reject browser cross-origin writes.
    const host = req.headers.host ?? "";
    if (!/^(127\.0\.0\.1|localhost):(8787|5173)$/.test(host))
      return reply(403, { error: "Loopback host required." });
    if (req.method === "GET" && req.url === "/api/state") {
      try {
        return reply(200, await demo.state());
      } catch (e) {
        return reply(503, { error: e.shortMessage ?? e.message });
      }
    }
    if (req.method !== "POST" || req.url !== "/api/action")
      return reply(404, { error: "Not found." });
    if (
      req.headers.origin &&
      !["http://127.0.0.1:5173", "http://localhost:5173"].includes(
        req.headers.origin,
      )
    )
      return reply(403, { error: "Local demo origin required." });
    if (!req.headers["content-type"]?.startsWith("application/json"))
      return reply(415, { error: "JSON required." });
    if (pending)
      return reply(409, { error: "A transaction is already pending." });
    pending = true;
    try {
      let body = "";
      for await (const chunk of req) {
        body += chunk;
        if (body.length > 4096) throw Error("Request too large.");
      }
      const { action, ...args } = JSON.parse(body);
      const hash = await demo.action(action, args);
      reply(200, { hash, state: await demo.state() });
    } catch (e) {
      reply(400, { error: (e.shortMessage ?? e.message).slice(0, 600) });
    } finally {
      pending = false;
    }
  });
  server.listen(port, "127.0.0.1", () =>
    console.log(`Pool API listening on http://127.0.0.1:${port}`),
  );
  return server;
}
