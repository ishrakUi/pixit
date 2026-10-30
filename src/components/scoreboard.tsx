import { rankings } from "@/lib/game";

export function Scoreboard({ board, colors }: { board: number[]; colors: string[] }) {
  const players = rankings(board);
  return (
    <section className="card scoreboard" aria-label="Round scores">
      <div className="card-heading"><h2>Scores</h2></div>
      {players.map((player, index) => (
        <div key={player.id} className={`score-row ${player.id === 0 ? "you-row" : ""}`}>
          <span className="rank">{index + 1}</span>
          <i className="avatar" style={{ background: colors[player.id] }} aria-hidden="true" />
          <span className="player-name">{player.name}</span>
          <strong>{player.score}</strong>
        </div>
      ))}
      <div className="territory-bar" aria-hidden="true">{players.map(player => <i key={player.id} style={{ background: colors[player.id], flex: player.score }} />)}</div>
    </section>
  );
}
