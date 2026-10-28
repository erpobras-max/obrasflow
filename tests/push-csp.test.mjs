import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("CSP permite o SDK OneSignal e sua API sem liberar scripts de qualquer origem", async () => {
  const headers = await readFile(new URL("../public/_headers", import.meta.url), "utf8");
  const csp = headers.match(/Content-Security-Policy:\s*([^\r\n]+)/)?.[1];
  assert.ok(csp);
  const directives = new Map(csp.split(";").map(part => {
    const [name, ...values] = part.trim().split(/\s+/);
    return [name, values];
  }));
  assert.ok(directives.get("script-src").includes("https://cdn.onesignal.com"));
  assert.ok(directives.get("connect-src").includes("https://api.onesignal.com"));
  assert.deepEqual(directives.get("worker-src"), ["'self'", "blob:"]);
  assert.deepEqual(directives.get("object-src"), ["'none'"]);
  assert.deepEqual(directives.get("frame-ancestors"), ["'none'"]);
  for (const source of directives.get("script-src")) {
    assert.ok(!["*", "https:", "'unsafe-eval'"].includes(source));
  }
});
