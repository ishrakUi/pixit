"use client";

import { useEffect, useRef, useState } from "react";
import { onValue, ref } from "firebase/database";
import { firebaseClient, sessionUser } from "@/lib/firebase/client";
import { energyAt, Session, SESSION_COLORS } from "@/lib/sessions";
import { PixelBoard } from "./pixel-board";
import { RoomLobby, RoomShare, SessionEntry } from "./session-lobby";

async function operation(action: string, data: Record<string, unknown> = {}) {
  const user = await sessionUser();
  const response = await fetch("/api/sessions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${await user.getIdToken()}` },
    body: JSON.stringify({ action, ...data }),
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || "Request failed");
  return result as { code: string };
}

export function LiveGame({ onPractice }: { onPractice: () => void }) {
  const [uid, setUid] = useState("");
  const [code, setCode] = useState("");
  const [entry, setEntry] = useState("");
  const [name, setName] = useState("");
  const [mode, setMode] = useState<"choose" | "join">("choose");
  const [savedCode, setSavedCode] = useState("");
  const [copied, setCopied] = useState("");
  const [room, setRoom] = useState<Session | null>(null);
  const [connected, setConnected] = useState(false);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [last, setLast] = useState<number | null>(null);
  const [now, setNow] = useState(0);
  const [retry, setRetry] = useState(0);
  const offset = useRef(0);
  const pending = useRef(false);

  useEffect(() => {
    let cancelled = false;
    let stopConnection = () => {};
    let stopOffset = () => {};
    async function connect() {
      try {
        const user = await sessionUser();
        if (cancelled) return;
        setUid(user.uid);
        setReady(true);
        const { db } = firebaseClient();
        stopConnection = onValue(ref(db, ".info/connected"), snapshot => setConnected(snapshot.val() === true));
        stopOffset = onValue(ref(db, ".info/serverTimeOffset"), snapshot => { offset.current = Number(snapshot.val()) || 0; });
        let saved = "";
        try { saved = localStorage.getItem("pixit-session") || ""; } catch { /* Storage may be disabled. */ }
        if (/^[a-f0-9]{8}$/i.test(saved)) setSavedCode(saved.toUpperCase());
        const target = new URLSearchParams(window.location.search).get("session");
        if (target && /^[a-f0-9]{8}$/i.test(target)) {
          setEntry(target.toUpperCase());
          if (saved.toUpperCase() === target.toUpperCase()) {
            await operation("join", { code: target.toUpperCase() });
            if (!cancelled) setCode(target.toUpperCase());
          } else {
            setMode("join");
          }
        }
      } catch (cause) {
        if (!cancelled) setError(cause instanceof Error ? cause.message : "Could not connect");
      }
    }
    void connect();
    return () => { cancelled = true; stopConnection(); stopOffset(); };
  }, [retry]);

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now() + offset.current), 250);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!code || !uid) return;
    const { db } = firebaseClient();
    return onValue(ref(db, `sessions/${code}`), snapshot => {
      const value = snapshot.val() as Session | null;
      setRoom(value);
      if (!value) setError("Session no longer exists");
    }, cause => setError(`Live updates stopped: ${cause.message}`));
  }, [code, uid, retry]);

  const roundStatus = room?.status;
  const deadline = room?.endsAt;
  // Any member can request settlement. The server checks its own clock and records it once.
  useEffect(() => {
    if (roundStatus !== "playing" || !deadline || !connected) return;
    let inFlight = false;
    let cancelled = false;
    const endsAt = deadline;
    const timer = setInterval(async () => {
      if (Date.now() + offset.current < endsAt || inFlight) return;
      inFlight = true;
      try { await operation("finish", { code }); }
      catch (cause) { if (!cancelled) setError(cause instanceof Error ? cause.message : "Could not save result"); }
      finally { inFlight = false; }
    }, 3000);
    return () => { cancelled = true; clearInterval(timer); };
  }, [code, roundStatus, deadline, connected]);

  async function run(action: string, data: Record<string, unknown> = {}) {
    if (pending.current) return;
    pending.current = true;
    setBusy(true);
    setError("");
    try {
      const result = await operation(action, { code, ...data });
      if (action === "create" || action === "join") {
        setRoom(null);
        setCode(result.code);
        setSavedCode(result.code);
        setCopied("");
        try { localStorage.setItem("pixit-session", result.code); } catch { /* Optional persistence. */ }
        window.history.replaceState(null, "", `/play?session=${result.code}`);
      }
      if (action === "claim") setLast(data.index as number);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Request failed");
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }

  function leave() {
    setCode(""); setRoom(null); setLast(null); setError(""); setMode("choose"); setSavedCode(""); setCopied("");
    try { localStorage.removeItem("pixit-session"); } catch { /* Optional persistence. */ }
    window.history.replaceState(null, "", "/play");
  }

  async function copyShare(kind: "code" | "link") {
    try {
      await navigator.clipboard.writeText(kind === "code" ? code : `${window.location.origin}/play?session=${code}`);
      setCopied(kind === "code" ? "Code copied" : "Invite link copied");
    } catch { setCopied(`Copy this code manually: ${code}`); }
  }

  const me = room?.players?.[uid];
  const players = Object.values(room?.players || {}).sort((a, b) => b.score - a.score || a.slot - b.slot);
  const seconds = room?.status === "playing" ? Math.max(0, Math.ceil((room.endsAt - now) / 1000)) : room?.status === "waiting" ? 300 : 0;
  const finished = room?.status === "finished";
  const result = room?.results?.[String(room.round)];
  const energy = me ? energyAt(me, Math.min(now, room?.endsAt || now)) : 10;
  const isHost = room?.host === uid;

  return (
    <main className="shell game-page quiet-game">
      {!code ? (
        <SessionEntry mode={mode} ready={ready} busy={busy} name={name} code={entry} savedCode={savedCode}
          onName={setName} onCode={setEntry} onMode={value => { setMode(value); setError(""); }}
          onCreate={() => void run("create", { name: "Host" })}
          onJoin={() => void run("join", { code: entry, name: name.trim() })}
          onResume={() => void run("join", { code: savedCode })}
          onPractice={onPractice} onRetry={() => { setError(""); setRetry(value => value + 1); }} />
      ) : (
        <>
          <div className="session-toolbar"><div><strong>{code}</strong><span>{connected ? "Live" : "Reconnecting…"}</span></div><div><button className="session-button" onClick={() => void copyShare("code")}>Copy code</button><button className="session-button" onClick={leave}>Back</button></div></div>
          {!room || !me ? <div className="card session-lobby"><p>Loading session…</p><button className="session-button" onClick={() => setRetry(value => value + 1)}>Reconnect</button></div> : room.status === "waiting" ? (
            <RoomLobby code={code} feedback={copied} onCopy={kind => void copyShare(kind)} players={players} uid={uid} host={room.host} busy={busy} connected={connected} onStart={() => void run("start")} />
          ) : (
            <div className="game-layout">
              <section className="arena card" aria-label="Live game board">
                <div className="arena-toolbar"><div><i className="live-dot" /><strong>{finished ? "Finished" : "Playing"}</strong><span className="tiny-label">{players.length}/4</span></div><div className={`timer ${seconds <= 30 ? "urgent" : ""}`} aria-label="Time remaining"><span>{Math.floor(seconds / 60)}:{String(seconds % 60).padStart(2, "0")}</span></div></div>
                <div className="board-frame">
                  <PixelBoard board={room.board} colors={SESSION_COLORS} ownSlot={me.slot} disabled={room.status !== "playing" || seconds === 0 || busy || !connected} last={last} onClaim={index => void run("claim", { index })} />
                  {(room.status !== "playing" || seconds === 0) && <div className="board-overlay">
                    <h2>{finished ? result?.winners.length === 1 ? result.winners[0] === uid ? "You win" : `${room.players[result.winners[0]].name} wins` : "Draw" : seconds === 0 ? "Saving result…" : "Ready?"}</h2>
                    <p>{finished ? `${players[0]?.score || 0} pixels` : ""}</p>
                    {isHost && room.status !== "playing" ? <button className="primary" disabled={busy || !connected} onClick={() => { setLast(null); void run("start"); }}>{finished ? "Play again" : "Start round"}</button> : room.status !== "playing" && <p>Waiting for host</p>}
                  </div>}
                </div>
                <div className="board-footer"><span><i style={{ background: SESSION_COLORS[me.slot] }} /> You</span><span>Claim <b>1 ⚡</b><span className="divider">/</span>Steal <b>2 ⚡</b></span></div>
              </section>
              <aside className="game-sidebar">
                <RoomShare code={code} feedback={copied} onCopy={kind => void copyShare(kind)} />
                <section className="card player-card"><div className="player-summary"><h2>{me.name}</h2><strong>{me.score}<span> pixels</span></strong></div><div className="energy-heading"><span>Energy</span><strong>{energy}<span> / 10</span></strong></div><div className="energy-bars" aria-label={`${energy} of 10 energy`}>{Array.from({ length: 10 }, (_, index) => <i key={index} className={index < energy ? "charged" : ""} />)}</div><div className="energy-note">+1 / 2s</div></section>
                <section className="card scoreboard"><div className="card-heading"><h2>Scores</h2></div>{players.map((player, index) => <div className={`score-row ${player.uid === uid ? "you-row" : ""}`} key={player.uid}><span className="rank">{index + 1}</span><i className="avatar" style={{ background: SESSION_COLORS[player.slot] }} /><span className="player-name">{player.name}{player.uid === uid ? " (you)" : ""}</span><strong>{player.score}</strong></div>)}</section>
                <p className="local-note">Round {room.round || 1} · {me.wins} win{me.wins === 1 ? "" : "s"} this session</p>
              </aside>
            </div>
          )}
        </>
      )}
      <div className="game-status" role="status" aria-live="polite">{error || (!ready ? "Connecting to Firebase…" : "")}</div>
    </main>
  );
}
