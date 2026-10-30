"use client";

import { useEffect, useReducer, useState } from "react";
import { claim, COLORS, GameState, initialGame, rankings, DURATION, tick } from "@/lib/game";
import { PixelBoard } from "./pixel-board";
import { Scoreboard } from "./scoreboard";
import { LiveGame } from "./live-game";

type Action = { type: "tick" } | { type: "claim"; index: number } | { type: "start" };

function reducer(state: GameState, action: Action): GameState {
  if (action.type === "start") return { ...initialGame(), started: true, message: "" };
  return action.type === "tick" ? tick(state) : claim(state, action.index);
}

export function Game() {
  const [practice, setPractice] = useState(false);
  if (!practice) return <LiveGame onPractice={() => setPractice(true)} />;
  return <><div className="shell"><button className="session-button" onClick={() => setPractice(false)}>Live sessions</button></div><PracticeGame /></>;
}

function PracticeGame() {
  const [state, dispatch] = useReducer(reducer, undefined, initialGame);
  const [color, setColor] = useState(0);
  const colors = [COLORS[color], ...COLORS.filter((_, index) => index !== color)];
  const finished = state.elapsed >= DURATION;

  useEffect(() => {
    if (!state.started || finished) return;
    const timer = setInterval(() => dispatch({ type: "tick" }), 1000);
    return () => clearInterval(timer);
  }, [state.started, finished]);

  const remaining = DURATION - state.elapsed;
  const scores = rankings(state.board);
  const winners = scores.filter(player => player.score === scores[0].score);
  const owned = state.board.filter(owner => owner === 0).length;

  return (
    <main className="shell game-page quiet-game">
      <div className="game-layout">
        <section className="arena card" aria-label="Game board">
          <div className="arena-toolbar">
            <div><i className="live-dot" /><strong>{finished ? "Finished" : state.started ? "Playing" : "Practice"}</strong><span className="tiny-label">50 × 50</span></div>
            <div className={`timer ${remaining <= 30 ? "urgent" : ""}`} aria-label="Time remaining"><span>{Math.floor(remaining / 60)}:{String(remaining % 60).padStart(2, "0")}</span></div>
          </div>
          <div className="board-frame">
            <PixelBoard board={state.board} colors={colors} disabled={!state.started || finished} last={state.last} onClaim={index => dispatch({ type: "claim", index })} />
            {(!state.started || finished) && (
              <div className="board-overlay">
                {finished && <><h2>{winners.length > 1 ? "Draw" : winners[0].id === 0 ? "You win" : `${winners[0].name} wins`}</h2><p>{winners.map(player => player.name).join(" & ")} · {scores[0].score} pixels</p></>}
                <button className="primary" onClick={() => dispatch({ type: "start" })}>{finished ? "Play again" : "Play"}</button>
                {!finished && <p className="start-note">5 min · 3 bots</p>}
              </div>
            )}
          </div>
          <div className="board-footer"><span><i style={{ background: colors[0] }} /> You</span><span>Claim <b>1 ⚡</b><span className="divider">/</span>Steal <b>2 ⚡</b></span></div>
        </section>
        <aside className="game-sidebar">
          <section className="card player-card" aria-label="Your player">
            <div className="player-summary"><h2>You</h2><strong>{owned}<span> pixels</span></strong></div>
            <div className="colors" role="group" aria-label="Player color">
              {COLORS.map((value, index) => <button key={value} aria-label={`Choose ${["violet", "cyan", "pink", "green"][index]}`} aria-pressed={color === index} onClick={() => setColor(index)} className={color === index ? "selected" : ""} style={{ background: value }}>{color === index ? "✓" : ""}</button>)}
            </div>
            <div className="energy-heading"><span>Energy</span><strong>{state.energy[0]}<span> / 10</span></strong></div>
            <div className="energy-bars" aria-label={`${state.energy[0]} of 10 energy`}>{Array.from({ length: 10 }, (_, index) => <i className={index < state.energy[0] ? "charged" : ""} key={index} />)}</div>
            <div className="energy-note">+1 / 2s</div>
          </section>
          <Scoreboard board={state.board} colors={colors} />
          <p className="local-note">Local game · resets on refresh</p>
        </aside>
      </div>
      <div className="game-status" role="status" aria-live="polite">{state.message}</div>
    </main>
  );
}
