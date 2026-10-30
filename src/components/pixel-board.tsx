"use client";

import { memo, useRef, useState } from "react";

type Props = {
  board: number[]; colors: string[]; disabled: boolean; last: number | null;
  ownSlot?: number; onClaim: (index: number) => void;
};

export const PixelBoard = memo(function PixelBoard({ board, colors, disabled, last, ownSlot = 0, onClaim }: Props) {
  const [zoom, setZoom] = useState(1);
  const [focused, setFocused] = useState(0);
  const viewport = useRef<HTMLDivElement>(null);
  const grid = useRef<HTMLDivElement>(null);
  // Infer legacy room dimensions so an active 20x20 round is never reinterpreted.
  const size = Math.sqrt(board.length);

  function changeZoom(value: number) {
    setZoom(value);
    viewport.current?.scrollTo({ top: 0, left: 0 });
  }

  return (
    <div className="board-surface">
      <div className="board-view-controls"><span>{size} × {size}</span><div role="group" aria-label="Board zoom">{[1, 2, 4].map(value => <button key={value} type="button" aria-pressed={zoom === value} onClick={() => changeZoom(value)}>{value === 1 ? "Fit" : `${value}×`}</button>)}</div></div>
      <div className="board-viewport" ref={viewport} tabIndex={zoom > 1 ? 0 : -1} aria-label={zoom > 1 ? "Scroll to explore the zoomed board" : "Full board"}>
        <div className={`pixel-grid ${zoom > 1 ? "is-zoomed" : ""}`} ref={grid} role="group" aria-label={`${size} by ${size} pixel arena`}
          style={{ gridTemplateColumns: `repeat(${size}, minmax(0, 1fr))`, gridTemplateRows: `repeat(${size}, minmax(0, 1fr))`, width: `${zoom * 100}%` }}
          onKeyDown={event => {
            if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Home", "End"].includes(event.key)) return;
            event.preventDefault();
            const next = event.key === "Home" ? 0 : event.key === "End" ? board.length - 1 : Math.max(0, Math.min(board.length - 1, focused + ({ ArrowLeft: -1, ArrowRight: 1, ArrowUp: -size, ArrowDown: size }[event.key] || 0)));
            setFocused(next);
            (grid.current?.children[next] as HTMLButtonElement | undefined)?.focus();
          }}>
          {board.map((owner, index) => <button key={index} type="button" tabIndex={index === focused ? 0 : -1}
            className={`pixel ${last === index ? "latest" : ""}`}
            style={owner >= 0 ? { backgroundColor: colors[owner] } : undefined}
            disabled={disabled} onFocus={() => setFocused(index)} onClick={() => onClaim(index)}
            aria-label={`Row ${Math.floor(index / size) + 1}, column ${index % size + 1}. ${owner === -1 ? "Unclaimed, costs 1 energy" : owner === ownSlot ? "Yours" : `Opponent ${owner + 1}, costs 2 energy`}`} />)}
        </div>
      </div>
    </div>
  );
});
