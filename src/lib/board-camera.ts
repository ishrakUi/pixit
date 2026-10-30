export const VISIBLE_CELLS = 10;
export type BoardCamera = { x: number; y: number };
export function clampCamera(camera: BoardCamera, size: number): BoardCamera {
  const limit = Math.max(0, size - VISIBLE_CELLS);
  return { x: Math.max(0, Math.min(limit, camera.x)), y: Math.max(0, Math.min(limit, camera.y)) };
}
export function cellAt(x: number, y: number, extent: number, camera: BoardCamera, size: number): number | null {
  if (extent <= 0 || x < 0 || y < 0 || x >= extent || y >= extent) return null;
  const step = extent / Math.min(VISIBLE_CELLS, size);
  const col = Math.floor(camera.x + x / step), row = Math.floor(camera.y + y / step);
  return col >= 0 && col < size && row >= 0 && row < size ? row * size + col : null;
}
