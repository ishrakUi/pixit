import Link from "next/link";

export function SiteHeader() {
  return (
    <header className="site-header shell">
      <Link className="logo" href="/" aria-label="PIXIT home">pixit<span>.</span></Link>
      <nav aria-label="Main navigation"><Link href="/play">Play</Link><Link href="/leaderboard">Scores</Link><Link href="/how-to-play">Rules</Link></nav>
    </header>
  );
}
