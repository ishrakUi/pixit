/* eslint-disable @typescript-eslint/no-require-imports -- Node's dependency-free CommonJS test harness. */
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const ts = require("typescript");

// Load the pure TypeScript engine without introducing a test framework.
const source = ts.transpileModule(fs.readFileSync("src/lib/game.ts", "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS },
}).outputText;
const engine = { exports: {} };
new Function("module", "exports", source)(engine, engine.exports);
const { initialGame, claim, tick, rankings, DURATION } = engine.exports;
const start = () => ({ ...initialGame(), started: true });

test("starts with 400 cells, unique equal territories, and full energy", () => {
  const state = initialGame();
  assert.equal(state.board.length, 400);
  assert.deepEqual(rankings(state.board).map(player => player.score), [6, 6, 6, 6]);
  assert.deepEqual(state.energy, [10, 10, 10, 10]);
  assert.equal(claim(state, 0), state);
});

test("claims and captures apply exact costs and transfer territory", () => {
  const original = start();
  const claimed = claim(original, 0);
  assert.equal(claimed.energy[0], 9);
  assert.equal(claimed.board[0], 0);
  assert.equal(original.board[0], -1);
  const captured = claim(claimed, 132);
  assert.equal(captured.energy[0], 7);
  assert.equal(rankings(captured.board).find(player => player.id === 0).score, 8);
  assert.equal(rankings(captured.board).find(player => player.id === 1).score, 5);
  assert.equal(claim(captured, 132).energy[0], 7);
});

test("rejects unaffordable moves and regenerates every two ticks up to cap", () => {
  let state = { ...start(), energy: [1, 10, 10, 10] };
  assert.deepEqual(claim(state, 132).board, state.board);
  state = claim(state, 0);
  assert.equal(state.energy[0], 0);
  assert.equal(claim(state, 1).board[1], -1);
  state = tick(state);
  assert.equal(state.energy[0], 0);
  state = tick(state);
  assert.equal(state.energy[0], 1);
  assert.equal(tick(tick(start())).energy[0], 10);
});

test("bots are deterministic and a full round ends with frozen state", () => {
  let a = start(), b = start();
  for (let i = 0; i < DURATION; i++) { a = tick(a); b = tick(b); }
  assert.deepEqual(a, b);
  assert.equal(a.elapsed, DURATION);
  assert.ok(a.board.filter(owner => owner >= 0).length > 24);
  assert.equal(tick(a), a);
  assert.equal(claim(a, 0), a);
  assert.ok(a.energy.every(value => value >= 0 && value <= 10));
  assert.equal(rankings(a.board).reduce((sum, player) => sum + player.score, 0), a.board.filter(owner => owner >= 0).length);
});
