/* eslint-disable @typescript-eslint/no-require-imports -- Node's CommonJS test harness. */
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const ts = require("typescript");
const engine = { exports: {} };
new Function("module", "exports", ts.transpileModule(fs.readFileSync("src/lib/sessions.ts", "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS },
}).outputText)(engine, engine.exports);
const { newSession, updateSession, energyAt, ROUND_MS } = engine.exports;
const T = 100_000;
function playing() {
  let room = newSession("a", "Alice", T);
  room = updateSession(room, "b", "join", T, { name: "Bob" });
  return updateSession(room, "a", "start", T);
}

test("membership, capacity, unique colors, host-only starts", () => {
  let room = newSession("a", "Alice", T);
  for (const uid of ["b", "c", "d"]) room = updateSession(room, uid, "join", T);
  assert.equal(new Set(Object.values(room.players).map(p => p.slot)).size, 4);
  assert.throws(() => updateSession(room, "e", "join", T), /full/);
  assert.throws(() => updateSession(room, "outsider", "claim", T, { index: 0 }), /Join/);
  assert.throws(() => updateSession(room, "b", "start", T), /host/);
  assert.deepEqual(updateSession(room, "b", "join", T).players, room.players);
});

test("competing claims are charged against the latest committed owner", () => {
  const original = playing();
  const first = updateSession(original, "a", "claim", T + 100, { index: 0 });
  const second = updateSession(first, "b", "claim", T + 100, { index: 0 });
  assert.equal(first.players.a.energy, 9);
  assert.equal(second.players.b.energy, 8);
  assert.equal(second.players.a.score, 0);
  assert.equal(second.players.b.score, 1);
  assert.equal(second.board[0], 1);
  assert.equal(original.board[0], -1);
  assert.equal(updateSession(second, "b", "claim", T + 101, { index: 0 }).players.b.energy, 8);
});

test("recharge preserves partial time and never banks energy above cap", () => {
  let room = playing();
  room = updateSession(room, "a", "claim", T + 100, { index: 0 });
  room = updateSession(room, "a", "claim", T + 1200, { index: 1 });
  assert.equal(energyAt(room.players.a, T + 2099), 8);
  assert.equal(energyAt(room.players.a, T + 2100), 9);
  room = updateSession(room, "a", "claim", T + 100_000, { index: 2 });
  assert.equal(room.players.a.energy, 9);
  assert.equal(energyAt(room.players.a, T + 100_001), 9);
});

test("invalid indexes, insufficient energy, and excessive claim rate are rejected", () => {
  let room = playing();
  for (const index of [-1, 2500, 1.5, NaN]) assert.throws(() => updateSession(room, "a", "claim", T + 100, { index }), /Invalid/);
  for (let index = 0; index < 10; index++) room = updateSession(room, "a", "claim", T + 100 + index * 100, { index });
  assert.equal(room.players.a.energy, 0);
  assert.throws(() => updateSession(room, "a", "claim", T + 1200, { index: 10 }), /energy/);
  assert.throws(() => updateSession(room, "a", "claim", T + 1001, { index: 10 }), /fast/);
});

test("deadline rejects late claims, settles ties, and awards wins exactly once", () => {
  const room = playing();
  const finished = updateSession(room, "a", "claim", T + ROUND_MS, { index: 0 });
  assert.equal(finished.board[0], -1);
  assert.equal(finished.status, "finished");
  assert.deepEqual(finished.results[1].winners, ["a", "b"]);
  assert.equal(finished.players.a.wins, 1);
  const again = updateSession(finished, "b", "finish", T + ROUND_MS + 1000);
  assert.equal(again.players.a.wins, 1);
  const lateJoin = updateSession(room, "c", "join", T + ROUND_MS);
  assert.equal(lateJoin.players.c.wins, 0);
  assert.deepEqual(lateJoin.results[1].winners, ["a", "b"]);
});

test("winner, replay reset, retained history, and membership survive serialization", () => {
  let room = playing();
  room = updateSession(room, "a", "claim", T + 100, { index: 0 });
  room = updateSession(room, "b", "finish", T + ROUND_MS);
  assert.deepEqual(room.results[1].winners, ["a"]);
  room = updateSession(JSON.parse(JSON.stringify(room)), "a", "start", T + ROUND_MS + 100);
  assert.equal(room.round, 2);
  assert.equal(room.players.a.energy, 10);
  assert.equal(room.players.a.score, 0);
  assert.equal(room.players.a.wins, 1);
  assert.equal(room.board.filter(owner => owner !== -1).length, 0);
  assert.equal(room.results[1].scores.a, 1);
});

test("host can rename without changing gameplay, and others cannot rename the host", () => {
  const room = playing();
  const renamed = updateSession(room, "a", "rename", T + 100, { name: "  Zarin   Pixit  " });
  assert.equal(renamed.players.a.name, "Zarin Pixit");
  assert.equal(room.players.a.name, "Alice");
  assert.deepEqual(renamed.board, room.board);
  assert.equal(renamed.players.a.energy, room.players.a.energy);
  assert.throws(() => updateSession(room, "b", "rename", T + 100, { name: "Fake host" }), /host/);
  assert.throws(() => updateSession(room, "a", "rename", T + 100, { name: " \n " }), /Enter a name/);
  assert.equal(updateSession(room, "a", "rename", T + 100, { name: "x".repeat(40) }).players.a.name.length, 18);
});

test("50x50 boards validate the last cell and legacy rounds keep their bounds until replay", () => {
  let room = playing();
  assert.equal(room.board.length, 2500);
  room = updateSession(room, "a", "claim", T + 100, { index: 2499 });
  assert.equal(room.board[2499], 0);
  assert.equal(room.players.a.score, 1);
  assert.throws(() => updateSession(room, "a", "claim", T + 300, { index: 2500 }), /Invalid pixel/);
  let legacy = { ...playing(), board: Array(400).fill(-1) };
  assert.throws(() => updateSession(legacy, "a", "claim", T + 100, { index: 400 }), /Invalid pixel/);
  legacy = updateSession(legacy, "a", "finish", T + ROUND_MS);
  legacy = updateSession(legacy, "a", "start", T + ROUND_MS + 100);
  assert.equal(legacy.board.length, 2500);
});
