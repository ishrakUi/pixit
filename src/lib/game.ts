export const SIZE = 50;
export const DURATION = 300;
export const COLORS = ["#ac8cfa", "#35d7cf", "#f17eb8", "#a5e36e"];
export const NAMES = ["You", "Pixel ghost", "Pink panther", "Lime light"];
export type GameState = { board: number[]; energy: number[]; elapsed: number; started: boolean; message: string; last: number | null };
export function initialGame(): GameState {
  const board = Array<number>(SIZE * SIZE).fill(-1);
  [12 * SIZE + 12, 12 * SIZE + 36, 36 * SIZE + 12, 36 * SIZE + 36].forEach((origin, player) => [0, 1, SIZE, SIZE + 1, SIZE * 2, SIZE * 2 + 1].forEach(offset => { board[origin + offset] = player; }));
  return { board, energy: [10, 10, 10, 10], elapsed: 0, started: false, message: "", last: null };
}
export function claim(state: GameState, index: number, player = 0): GameState {
  if (!state.started || state.elapsed >= DURATION || !Number.isInteger(index) || index < 0 || index >= SIZE * SIZE) return state;
  const owner = state.board[index];
  if (owner === player) return player === 0 ? { ...state, message: "Already yours" } : state;
  const cost = owner === -1 ? 1 : 2;
  if (state.energy[player] < cost) return player === 0 ? { ...state, message: `Needs ${cost} energy` } : state;
  const board = [...state.board], energy = [...state.energy];
  board[index] = player;
  energy[player] -= cost;
  return { ...state, board, energy, last: player === 0 ? index : state.last, message: player === 0 ? "" : state.message };
}
export function tick(state: GameState): GameState {
  if (!state.started || state.elapsed >= DURATION) return state;
  const elapsed = state.elapsed + 1;
  let next = { ...state, elapsed, energy: state.energy.map(value => elapsed % 2 === 0 ? Math.min(10, value + 1) : value) };
  if (elapsed < DURATION && elapsed % 3 === 0) for (let player = 1; player < 4; player++) {
    const targets = next.board.map((owner, index) => ({ owner, index })).filter(({ owner, index }) => owner !== player && [index % SIZE > 0 ? index - 1 : -1, index % SIZE < SIZE - 1 ? index + 1 : -1, index - SIZE, index + SIZE].some(neighbor => neighbor >= 0 && neighbor < SIZE * SIZE && next.board[neighbor] === player));
    const target = targets[(elapsed * 7 + player * 13) % targets.length];
    if (target) next = claim(next, target.index, player);
  }
  return next;
}
export function rankings(board: number[]) {
  return NAMES.map((name, id) => ({ id, name, score: board.filter(owner => owner === id).length })).sort((a, b) => b.score - a.score || a.id - b.id);
}
