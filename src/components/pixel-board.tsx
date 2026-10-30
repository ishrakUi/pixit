"use client";

import { memo, useEffect, useId, useRef, useState } from "react";
import { BoardCamera, cellAt, clampCamera, VISIBLE_CELLS } from "@/lib/board-camera";

type Props = { board: number[]; colors: string[]; disabled: boolean; last: number | null; ownSlot?: number; onClaim: (index: number) => void };

export const PixelBoard = memo(function PixelBoard({ board, colors, disabled, last, ownSlot = 0, onClaim }: Props) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const overview = useRef<HTMLCanvasElement>(null);
  const drag = useRef<{ id: number; x: number; y: number; camera: BoardCamera; moved: boolean } | null>(null);
  const [camera, setCamera] = useState<BoardCamera>({ x: 0, y: 0 });
  const [extent, setExtent] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [keyboard, setKeyboard] = useState(false);
  const [panning, setPanning] = useState(false);
  const instructions = useId();
  const size = Math.sqrt(board.length);
  const visible = Math.min(size, VISIBLE_CELLS);
  const view = clampCamera(camera, size);

  useEffect(() => {
    const target = canvas.current;
    if (!target) return;
    const observer = new ResizeObserver(() => setExtent(target.getBoundingClientRect().width));
    observer.observe(target);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const target = canvas.current;
    const context = target?.getContext("2d");
    if (!target || !context || !extent) return;
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    target.width = Math.round(extent * ratio);
    target.height = Math.round(extent * ratio);
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    context.fillStyle = "#101119";
    context.fillRect(0, 0, extent, extent);
    const step = extent / visible;
    const gap = Math.max(2, Math.min(6, step * .075));
    for (let row = Math.floor(view.y); row < Math.min(size, Math.ceil(view.y + visible)); row++) {
      for (let col = Math.floor(view.x); col < Math.min(size, Math.ceil(view.x + visible)); col++) {
        const index = row * size + col, owner = board[index];
        const x = (col - view.x) * step + gap / 2, y = (row - view.y) * step + gap / 2;
        context.fillStyle = owner >= 0 ? colors[owner] : "#252733";
        context.fillRect(x, y, step - gap, step - gap);
        if (index === last || (keyboard && index === selected)) {
          context.strokeStyle = index === selected && keyboard ? "#fff" : "#ffffffa0";
          context.lineWidth = 2;
          context.strokeRect(x + 1, y + 1, step - gap - 2, step - gap - 2);
        }
      }
    }
  }, [board, colors, last, selected, keyboard, extent, view.x, view.y, visible, size]);

  useEffect(() => {
    const target = overview.current;
    const context = target?.getContext("2d");
    if (!target || !context) return;
    const scale = 100 / size;
    target.width = 200; target.height = 200;
    context.setTransform(2, 0, 0, 2, 0, 0);
    context.fillStyle = "#20212e";
    context.fillRect(0, 0, 100, 100);
    board.forEach((owner, index) => {
      if (owner < 0) return;
      context.fillStyle = colors[owner];
      context.fillRect(index % size * scale, Math.floor(index / size) * scale, scale, scale);
    });
    context.fillStyle = "#ffffff12";
    context.fillRect(view.x * scale, view.y * scale, visible * scale, visible * scale);
    context.strokeStyle = "#cbb4ff"; context.lineWidth = 1.5;
    context.strokeRect(view.x * scale + .75, view.y * scale + .75, visible * scale - 1.5, visible * scale - 1.5);
  }, [board, colors, view.x, view.y, size, visible]);

  function pan(dx: number, dy: number) {
    setCamera(current => clampCamera({ x: Math.round(current.x) + dx, y: Math.round(current.y) + dy }, size));
  }
  const selectionText = selected === null ? "" : `Row ${Math.floor(selected / size) + 1}, column ${selected % size + 1}. ${board[selected] === ownSlot ? "Yours" : board[selected] < 0 ? "Unclaimed. Costs 1 energy." : "Opponent. Costs 2 energy."}`;

  return <div className="board-surface canvas-surface">
    <div className="canvas-heading"><span>{size} × {size}</span><span>{Math.floor(view.x) + 1}–{Math.floor(view.x) + visible} / {Math.floor(view.y) + 1}–{Math.floor(view.y) + visible}</span></div>
    <canvas ref={canvas} className={`claim-canvas ${panning ? "is-panning" : ""}`} tabIndex={0} role="application"
      aria-label={`${size} by ${size} arena. ${visible} cells across the square viewport.`} aria-describedby={instructions} aria-disabled={disabled}
      onPointerDown={event => {
        if (!event.isPrimary || (event.pointerType === "mouse" && event.button !== 0)) return;
        event.currentTarget.focus({ preventScroll: true });
        setKeyboard(false);
        event.currentTarget.setPointerCapture(event.pointerId);
        drag.current = { id: event.pointerId, x: event.clientX, y: event.clientY, camera: view, moved: false };
      }}
      onPointerMove={event => {
        const start = drag.current;
        if (!start || start.id !== event.pointerId) return;
        const dx = event.clientX - start.x, dy = event.clientY - start.y;
        if (Math.hypot(dx, dy) > 7) start.moved = true;
        if (!start.moved) return;
        setPanning(true);
        const step = event.currentTarget.getBoundingClientRect().width / visible;
        setCamera(clampCamera({ x: start.camera.x - dx / step, y: start.camera.y - dy / step }, size));
      }}
      onPointerUp={event => {
        const start = drag.current;
        if (!start || start.id !== event.pointerId) return;
        drag.current = null; setPanning(false);
        event.currentTarget.releasePointerCapture(event.pointerId);
        if (start.moved || Math.hypot(event.clientX - start.x, event.clientY - start.y) > 7) {
          setCamera(current => clampCamera({ x: Math.round(current.x), y: Math.round(current.y) }, size));
          return;
        }
        const bounds = event.currentTarget.getBoundingClientRect();
        const index = cellAt(event.clientX - bounds.left, event.clientY - bounds.top, bounds.width, start.camera, size);
        if (index !== null) { setSelected(index); if (!disabled) onClaim(index); }
      }}
      onPointerCancel={() => { drag.current = null; setPanning(false); setCamera(current => clampCamera({ x: Math.round(current.x), y: Math.round(current.y) }, size)); }}
      onLostPointerCapture={() => { drag.current = null; setPanning(false); }}
      onKeyDown={event => {
        if (["Enter", " "].includes(event.key)) {
          event.preventDefault();
          const index = selected ?? Math.floor(view.y) * size + Math.floor(view.x);
          setSelected(index); setKeyboard(true); if (!disabled) onClaim(index);
          return;
        }
        const delta = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -size, ArrowDown: size }[event.key];
        if (delta === undefined && event.key !== "Home" && event.key !== "End") return;
        event.preventDefault(); setKeyboard(true);
        const current = selected ?? Math.floor(view.y) * size + Math.floor(view.x);
        const next = event.key === "Home" ? 0 : event.key === "End" ? board.length - 1 : Math.max(0, Math.min(board.length - 1, current + (delta || 0)));
        const col = next % size, row = Math.floor(next / size);
        setSelected(next);
        setCamera(clampCamera({ x: col < view.x ? col : col >= view.x + visible ? col - visible + 1 : view.x, y: row < view.y ? row : row >= view.y + visible ? row - visible + 1 : view.y }, size));
      }}
    >Use arrow keys to select a cell, then Enter to claim.</canvas>
    <div className="canvas-navigation">
      <button className="board-overview" aria-label="Board overview. Click a location to jump there; press Enter to center the view." onClick={event => {
        const bounds = event.currentTarget.getBoundingClientRect();
        const x = event.detail === 0 ? size / 2 : (event.clientX - bounds.left) / bounds.width * size;
        const y = event.detail === 0 ? size / 2 : (event.clientY - bounds.top) / bounds.height * size;
        setCamera(clampCamera({ x: Math.floor(x - visible / 2), y: Math.floor(y - visible / 2) }, size));
      }}><canvas ref={overview} aria-hidden="true" /></button>
      <div className="canvas-pan-controls"><div role="group" aria-label="Move around the board">
        <button aria-label="Pan left" onClick={() => pan(-5, 0)}>←</button><button aria-label="Pan up" onClick={() => pan(0, -5)}>↑</button><button aria-label="Pan down" onClick={() => pan(0, 5)}>↓</button><button aria-label="Pan right" onClick={() => pan(5, 0)}>→</button>
      </div><span>Drag to move · Tap to claim</span></div>
    </div>
    <span id={instructions} className="board-screenreader">Drag to pan. Tap to claim. Arrow keys select; Enter or Space claims. Home and End jump to opposite corners. {selectionText}</span>
  </div>;
});
