import Link from "next/link";
import { SiteHeader } from "@/components/site-header";

export default function HowToPlay() {
  return (
    <><SiteHeader /><main className="shell info-page">
      <h1>Rules</h1>
      <div className="rules">{[
        ["01", "Claim", "Tap an empty pixel. Costs 1 energy."],
        ["02", "Steal", "Tap another color. Costs 2 energy."],
        ["03", "Recharge", "Start with 10 energy. Recover 1 every 2 seconds, up to 10."],
        ["04", "Win", "Own the most pixels after 5 minutes. Ties share the win."],
      ].map(([number, title, description]) => <section className="card rule" key={number}><span>{number}</span><div><h2>{title}</h2><p className="muted">{description}</p></div></section>)}</div>
      <Link href="/play" className="primary">Play</Link>
      <p className="muted small">Share a session invite with up to 4 players. The host starts each round. Live boards start empty; claim anywhere. Offline practice is also available.</p>
    </main></>
  );
}
