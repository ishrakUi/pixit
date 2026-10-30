import Link from "next/link";
import { SiteHeader } from "@/components/site-header";

export default function LeaderboardPage() {
  return (
    <><SiteHeader /><main className="shell info-page">
      <h1>Scores</h1>
      <section className="card empty-state"><h2>Session scores</h2><p className="muted">Live rankings and session wins appear beside your board. Global rankings are not enabled yet.</p><Link href="/play" className="primary">Play</Link></section>
    </main></>
  );
}
