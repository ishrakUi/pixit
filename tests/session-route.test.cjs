/* eslint-disable @typescript-eslint/no-require-imports -- Node's CommonJS test harness. */
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const ts = require("typescript");

function load(file, dependencies = {}) {
  const loaded = { exports: {} };
  const source = ts.transpileModule(fs.readFileSync(file, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  new Function("require", "module", "exports", source)(
    name => dependencies[name] || require(name), loaded, loaded.exports,
  );
  return loaded.exports;
}
const engine = load("src/lib/sessions.ts");

// Model Firebase's compare-and-retry protocol: local null is not proof that
// a remote room is missing. Undefined aborts without contacting the server.
function server(remote, uid = "guest", beforeRetry) {
  let calls = 0;
  const reference = {
    async transaction(update) {
      calls++;
      let proposed = update(null);
      if (proposed === undefined) return { committed: false, snapshot: { exists: () => !!remote } };
      if (remote !== null) {
        if (beforeRetry) remote = beforeRetry(remote);
        calls++;
        proposed = update(structuredClone(remote));
      }
      if (proposed === undefined) return { committed: false, snapshot: { exists: () => !!remote } };
      remote = proposed;
      return { committed: true, snapshot: { exists: () => remote !== null } };
    },
  };
  const { POST } = load("src/app/api/sessions/route.ts", {
    "@/lib/sessions": engine,
    "@/lib/firebase/admin": {
      firebaseAdmin: () => ({
        auth: { verifyIdToken: async () => ({ uid }) },
        db: { ref: () => reference },
      }),
    },
  });
  return {
    request: body => POST(new Request("http://localhost/api/sessions", {
      method: "POST", headers: { Authorization: "Bearer test-token" },
      body: JSON.stringify({ code: "984C29D6", ...body }),
    })),
    room: () => remote,
    calls: () => calls,
  };
}

test("join retries a cold null cache and saves the supplied name", async () => {
  const api = server(engine.newSession("host", "Host", Date.now()));
  const response = await api.request({ action: "join", name: "Zarin" });
  assert.equal(response.status, 200);
  assert.equal(api.calls(), 2);
  assert.equal(api.room().players.guest.name, "Zarin");
  assert.equal(api.room().players.host.name, "Host");
});

test("a genuinely missing room returns 404 without creating a room", async () => {
  const api = server(null);
  const response = await api.request({ action: "join", name: "Zarin" });
  assert.equal(response.status, 404);
  assert.equal((await response.json()).error, "Session not found");
  assert.equal(api.room(), null);
});

test("a cold join validates capacity against the latest remote state", async () => {
  let room = engine.newSession("host", "Host", Date.now());
  room = engine.updateSession(room, "b", "join", Date.now());
  room = engine.updateSession(room, "c", "join", Date.now());
  const api = server(room, "guest", latest => engine.updateSession(latest, "d", "join", Date.now()));
  const response = await api.request({ action: "join", name: "Zarin" });
  assert.equal(response.status, 409);
  assert.equal((await response.json()).error, "Session is full");
  assert.equal(api.room().players.guest, undefined);
});

test("start and claim also survive a cold server cache", async () => {
  const start = server(engine.newSession("host", "Host", Date.now()), "host");
  assert.equal((await start.request({ action: "start" })).status, 200);
  const claim = server(start.room(), "host");
  assert.equal((await claim.request({ action: "claim", index: 12 })).status, 200);
  assert.equal(claim.room().board[12], 0);
  assert.equal(claim.room().players.host.energy, 9);
});
