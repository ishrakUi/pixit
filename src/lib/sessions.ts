// Shared types and pure transitions. Only the server calls these to mutate live rooms.
export const SESSION_COLORS = ["#ac8cfa", "#35d7cf", "#f17eb8", "#a5e36e"];
export const ROUND_MS = 300_000;
export const REGEN_MS = 2_000;
export const SESSION_SIZE = 50;
export const SESSION_CELLS = SESSION_SIZE * SESSION_SIZE;
export type Player = {
  uid: string; name: string; slot: number; energy: number; energyAt: number;
  score: number; wins: number; lastClaimAt: number;
};
export type RoundResult = {
  round: number; endedAt: number; winners: string[];
  scores: Record<string, number>;
};
export type Session = {
  host: string; createdAt: number; status: "waiting" | "playing" | "finished";
  round: number; startsAt: number; endsAt: number; board: number[];
  players: Record<string, Player>; results: Record<string, RoundResult>;
};
export class SessionError extends Error {
  constructor(message: string, public status = 400) { super(message); }
}
export type SessionAction = "join" | "start" | "claim" | "finish" | "rename";

export function playerName(value: string) {
  return value.replace(/[\u0000-\u001f]/g, "").trim().replace(/\s+/g, " ").slice(0, 18);
}

export function energyAt(player: Player, now: number) {
  return Math.min(10, player.energy + Math.floor(Math.max(0, now - player.energyAt) / REGEN_MS));
}

export function newSession(uid: string, name: string, now: number): Session {
  return {
    host: uid, createdAt: now, status: "waiting", round: 0, startsAt: 0, endsAt: 0,
    board: Array<number>(SESSION_CELLS).fill(-1), players: {
      [uid]: { uid, name: playerName(name) || "Host", slot: 0, energy: 10, energyAt: now, score: 0, wins: 0, lastClaimAt: 0 },
    }, results: {},
  };
}

function settle(room: Session, now: number) {
  if (room.status !== "playing" || now < room.endsAt) return;
  room.status = "finished";
  const players = Object.values(room.players);
  for (const player of players) {
    player.score = room.board.filter(owner => owner === player.slot).length;
  }
  const best = Math.max(...players.map(player => player.score));
  const winners = players.filter(player => player.score === best).map(player => player.uid);
  room.results ??= {};
  room.results[String(room.round)] = {
    round: room.round, endedAt: room.endsAt, winners,
    scores: Object.fromEntries(players.map(player => [player.uid, player.score])),
  };
  for (const uid of winners) room.players[uid].wins += 1;
  // Keep room subscriptions bounded across replays.
  for (const key of Object.keys(room.results)) {
    if (Number(key) <= room.round - 10) delete room.results[key];
  }
}

export function updateSession(
  original: Session, uid: string, action: SessionAction, now: number,
  input: { name?: string; index?: number } = {},
): Session {
  const room = structuredClone(original);
  room.players ??= {};
  room.results ??= {};
  if (action === "join") {
    settle(room, now);
    if (room.players[uid]) return room;
    if (Object.keys(room.players).length >= 4) throw new SessionError("Session is full", 409);
    const used = new Set(Object.values(room.players).map(player => player.slot));
    const slot = [0, 1, 2, 3].find(value => !used.has(value))!;
    room.players[uid] = {
      uid, name: playerName(input.name || "") || `Player ${slot + 1}`, slot, energy: 10,
      energyAt: now, score: 0, wins: 0, lastClaimAt: 0,
    };
    settle(room, now);
    return room;
  }
  if (!room.players[uid]) throw new SessionError("Join this session first", 403);
  if (action === "rename") {
    if (uid !== room.host) throw new SessionError("Only the host can edit the host name", 403);
    const name = playerName(input.name || "");
    if (!name) throw new SessionError("Enter a name");
    room.players[uid].name = name;
    settle(room, now);
    return room;
  }
  const wasPlaying = room.status === "playing";
  settle(room, now);
  // Always commit settlement, including a claim arriving at/after the deadline.
  if (wasPlaying && room.status === "finished") return room;
  if (action === "finish") return room;
  if (action === "start") {
    if (uid !== room.host) throw new SessionError("Only the host can start a round", 403);
    if (room.status === "playing") throw new SessionError("Round already started", 409);
    room.status = "playing";
    room.round += 1;
    room.startsAt = now;
    room.endsAt = now + ROUND_MS;
    room.board = Array<number>(SESSION_CELLS).fill(-1);
    for (const player of Object.values(room.players)) {
      player.energy = 10; player.energyAt = now; player.score = 0; player.lastClaimAt = 0;
    }
    return room;
  }
  if (room.status !== "playing") throw new SessionError("Round is not running", 409);
  const index = input.index;
  if (!Number.isInteger(index) || index! < 0 || index! >= room.board.length) throw new SessionError("Invalid pixel");
  const player = room.players[uid];
  const owner = room.board[index!];
  if (owner === player.slot) return room;
  if (now - player.lastClaimAt < 100) throw new SessionError("Too fast", 429);
  const available = energyAt(player, now);
  const cost = owner === -1 ? 1 : 2;
  if (available < cost) throw new SessionError(`Needs ${cost} energy`, 409);
  // Preserve partial recharge time; discard banked time when already full.
  player.energyAt = available === 10 ? now : player.energyAt + Math.floor(Math.max(0, now - player.energyAt) / REGEN_MS) * REGEN_MS;
  player.energy = available - cost;
  player.lastClaimAt = now;
  room.board[index!] = player.slot;
  player.score += 1;
  const previous = Object.values(room.players).find(other => other.slot === owner);
  if (previous) previous.score -= 1;
  return room;
}
