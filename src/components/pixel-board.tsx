import { SIZE } from "@/lib/game";
type Props = { board: number[]; colors: string[]; disabled: boolean; last: number | null; ownSlot?: number; onClaim: (index: number) => void };
export function PixelBoard({ board, colors, disabled, last, ownSlot = 0, onClaim }: Props) {
  return <div className="pixel-grid" role="group" aria-label="20 by 20 pixel arena">{board.map((owner, index) => <button key={index} className={`pixel ${last === index ? "latest" : ""}`} style={owner >= 0 ? { backgroundColor: colors[owner] } : undefined} disabled={disabled} onClick={() => onClaim(index)} aria-label={`Row ${Math.floor(index / SIZE) + 1}, column ${index % SIZE + 1}. ${owner === -1 ? "Unclaimed, costs 1 energy" : owner === ownSlot ? "Yours" : `Opponent ${owner + 1}, costs 2 energy`}`} />)}</div>;
}
