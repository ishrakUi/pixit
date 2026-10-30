"use client";

import { FormEvent, useState } from "react";
import { Player, SESSION_COLORS } from "@/lib/sessions";

type EntryProps = {
  mode: "choose" | "join"; ready: boolean; busy: boolean;
  name: string; code: string; savedCode: string;
  onName: (value: string) => void; onCode: (value: string) => void;
  onMode: (mode: "choose" | "join") => void;
  onCreate: () => void; onJoin: () => void; onResume: () => void;
  onPractice: () => void; onRetry: () => void;
};

export function SessionEntry(props: EntryProps) {
  const { mode, busy, ready } = props;
  return (
    <section className={`card session-entry ${mode === "join" ? "join-entry" : ""}`}>
      {mode === "choose" ? <>
        <span className="session-kicker">MULTIPLAYER</span>
        <h1>Let’s play.</h1>
        <div className="session-options">
          <button className="session-option new-option" disabled={!ready || busy} onClick={props.onCreate}>
            <span className="option-icon" aria-hidden="true">＋</span>
            <strong>{busy ? "Creating room…" : "New game"}</strong>
            <span>Create a room. Invite your friends.</span>
            <i aria-hidden="true">↗</i>
          </button>
          <button className="session-option" disabled={busy} onClick={() => props.onMode("join")}>
            <span className="option-icon" aria-hidden="true">↳</span>
            <strong>Join a room</strong>
            <span>Got a code? You’re in.</span>
            <i aria-hidden="true">↗</i>
          </button>
        </div>
        {props.savedCode && <button className="session-resume" disabled={!ready || busy} onClick={props.onResume}>Resume room <b>{props.savedCode}</b> ↗</button>}
      </> : <>
        <button className="session-back" disabled={busy} onClick={() => props.onMode("choose")}>← Back</button>
        <h1>Join a room</h1>
        <form onSubmit={(event: FormEvent) => { event.preventDefault(); if (props.name.trim()) props.onJoin(); }}>
          <label htmlFor="session-code">Room code</label>
          <input id="session-code" className="room-code-input" required pattern="[A-Fa-f0-9]{8}" maxLength={8} value={props.code} onChange={event => props.onCode(event.target.value.toUpperCase().replace(/[^A-F0-9]/g, ""))} placeholder="A1B2C3D4" autoComplete="off" spellCheck={false} autoCapitalize="characters" />
          <label htmlFor="player-name">Your name</label>
          <input id="player-name" required maxLength={18} value={props.name} onChange={event => props.onName(event.target.value)} placeholder="What should we call you?" autoComplete="nickname" />
          <button className="primary session-submit" disabled={!ready || busy || props.code.length !== 8 || !props.name.trim()}>{busy ? "Joining…" : "Join room"}<span aria-hidden="true">↗</span></button>
        </form>
      </>}
      {!ready && <button className="session-button" disabled={busy} onClick={props.onRetry}>Reconnect</button>}
      <button className="practice-link" onClick={props.onPractice}>Offline practice</button>
    </section>
  );
}

type ShareProps = { code: string; feedback: string; onCopy: (kind: "code" | "link") => void };
export function RoomShare({ code, feedback, onCopy }: ShareProps) {
  return <section className="room-share" aria-label="Share this room">
    <span className="session-kicker">ROOM CODE</span>
    <div className="room-code-row"><strong>{code}</strong><button className="session-button" onClick={() => onCopy("code")} aria-label={`Copy room code ${code}`}>Copy code</button></div>
    <button className="room-invite" onClick={() => onCopy("link")}>Copy invite link <span aria-hidden="true">↗</span></button>
    <span className="share-feedback" role="status" aria-live="polite">{feedback}</span>
  </section>;
}

export function HostName({ initialName, busy, onSave }: { initialName: string; busy: boolean; onSave: (name: string) => void }) {
  const [name, setName] = useState(initialName);
  return <form className="host-name" onSubmit={event => { event.preventDefault(); if (name.trim()) onSave(name.trim()); }}>
    <label htmlFor="host-name">Your name</label>
    <div><input id="host-name" value={name} onChange={event => setName(event.target.value)} maxLength={18} required autoComplete="nickname" /><button className="session-button" disabled={busy || !name.trim() || name.trim() === initialName}>Save</button></div>
  </form>;
}

export function RoomLobby({ code, feedback, onCopy, players, uid, host, busy, connected, onStart, onRename }: ShareProps & {
  players: Player[]; uid: string; host: string; busy: boolean; connected: boolean; onStart: () => void; onRename: (name: string) => void;
}) {
  return <section className="card room-lobby">
    <div className="room-lobby-heading"><div><span className="session-kicker">YOUR ROOM</span><h1>Waiting for players</h1></div><span className="room-capacity">{players.length} / 4</span></div>
    <RoomShare code={code} feedback={feedback} onCopy={onCopy} />
    {uid === host && <HostName key={players.find(player => player.uid === uid)?.name} initialName={players.find(player => player.uid === uid)?.name || "Host"} busy={busy || !connected} onSave={onRename} />}
    <div className="room-players" aria-label="Players in room">{Array.from({ length: 4 }, (_, slot) => {
      const player = players.find(player => player.slot === slot);
      return <div className={`room-player ${!player ? "empty-slot" : ""}`} key={slot}><i style={{ background: player ? SESSION_COLORS[slot] : undefined }} aria-hidden="true" /><span>{player ? player.name : "Open slot"}{player?.uid === uid && <small>YOU</small>}</span>{player?.uid === host && <small>HOST</small>}</div>;
    })}</div>
    {uid === host ? <button className="primary session-submit" disabled={busy || !connected} onClick={onStart}>{busy ? "Starting…" : "Start game"}<span aria-hidden="true">↗</span></button> : <p className="waiting-host">Waiting for the host to start…</p>}
  </section>;
}
