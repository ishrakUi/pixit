/* eslint-disable @typescript-eslint/no-require-imports -- Node's CommonJS test harness. */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const loaded = { exports: {} };
new Function('module', 'exports', ts.transpileModule(fs.readFileSync('src/lib/board-camera.ts', 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS },
}).outputText)(loaded, loaded.exports);
const { cellAt, clampCamera, VISIBLE_CELLS } = loaded.exports;

test('viewport shows ten square cells and maps phone and desktop taps identically', () => {
  assert.equal(VISIBLE_CELLS, 10);
  for (const width of [300, 360, 800, 1200]) {
    assert.equal(cellAt(width * .25, width * .35, width, { x: 0, y: 0 }, 50), 152);
    assert.equal(cellAt(width - .01, width - .01, width, { x: 0, y: 0 }, 50), 459);
  }
});
test('panning clamps to board boundaries, including legacy boards', () => {
  assert.deepEqual(clampCamera({ x: -5, y: 60 }, 50), { x: 0, y: 40 });
  assert.deepEqual(clampCamera({ x: 100, y: 100 }, 20), { x: 10, y: 10 });
});
test('panned taps map to the real board, including the last cell', () => {
  assert.equal(cellAt(299, 299, 300, { x: 40, y: 40 }, 50), 2499);
  assert.equal(cellAt(1, 1, 300, { x: 12, y: 17 }, 50), 862);
  assert.equal(cellAt(15, 15, 300, { x: .75, y: .75 }, 50), 51);
});
test('off-canvas taps never claim an edge pixel', () => {
  for (const [x, y] of [[-1, 0], [0, -1], [300, 0], [0, 300]]) {
    assert.equal(cellAt(x, y, 300, { x: 0, y: 0 }, 50), null);
  }
  assert.equal(cellAt(0, 0, 0, { x: 0, y: 0 }, 50), null);
});
