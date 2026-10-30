"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";

const COLORS = ["#b49aff", "#35d7cf", "#f17eb8", "#a5e36e"];

function PixelField() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) return;
    let width = 0, height = 0, frame = 0;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    const step = 40;

    function resize() {
      const bounds = canvas!.getBoundingClientRect();
      width = bounds.width;
      height = bounds.height;
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      canvas!.width = width * ratio;
      canvas!.height = height * ratio;
      context!.setTransform(ratio, 0, 0, ratio, 0, 0);
    }

    function draw(time: number) {
      context!.clearRect(0, 0, width, height);
      const seconds = reduced.matches ? 0 : time / 1000;
      const centers = [
        [width * .12 + Math.sin(seconds * .13) * 40, height * .24],
        [width * .88, height * .2 + Math.cos(seconds * .17) * 40],
        [width * .14, height * .84],
        [width * .9 + Math.sin(seconds * .11) * 40, height * .85],
      ];
      for (let row = 0; row < Math.ceil(height / step); row++) {
        for (let col = 0; col < Math.ceil(width / step); col++) {
          const x = col * step, y = row * step;
          const seed = ((col * 137 + row * 71) % 101) / 101;
          context!.fillStyle = "#202333";
          context!.globalAlpha = .35;
          context!.fillRect(x + 3, y + 3, step - 6, step - 6);
          centers.forEach(([cx, cy], owner) => {
            const distance = Math.hypot((x - cx) / 1.2, y - cy);
            const reach = Math.min(width * .3, 320) + Math.sin(seconds * .4 + owner) * 25;
            if (distance < reach && seed > distance / reach * .65) {
              context!.fillStyle = COLORS[owner];
              context!.globalAlpha = (.2 + seed * .3) * (1 - distance / (reach * 1.5));
              context!.fillRect(x + 3, y + 3, step - 6, step - 6);
            }
          });
        }
      }
      context!.globalAlpha = 1;
    }
    function animate(time: number) {
      draw(time);
      if (!reduced.matches) frame = requestAnimationFrame(animate);
    }
    function restart() {
      cancelAnimationFrame(frame);
      resize();
      draw(performance.now());
      if (!reduced.matches) frame = requestAnimationFrame(animate);
    }
    const observer = new ResizeObserver(restart);
    observer.observe(canvas);
    reduced.addEventListener("change", restart);
    restart();
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      reduced.removeEventListener("change", restart);
    };
  }, []);

  return <canvas ref={canvasRef} className="home-pixels" aria-hidden="true" />;
}

export function LandingMenu() {
  return (
    <div className="home-screen">
      <PixelField />
      <div className="home-vignette" aria-hidden="true" />
      <header className="home-header">
        <Link href="/" className="home-logo" aria-label="PIXIT home">pixit<span>.</span></Link>
        <nav aria-label="Main navigation"><Link href="/leaderboard">Scores</Link><Link href="/how-to-play">Rules</Link></nav>
      </header>
      <main className="home-main">
        <div className="home-content">
          <div className="home-icon" aria-hidden="true"><i /><i /><i /><i /></div>
          <h1>pixit<span>.</span></h1>
          <p className="home-tagline">Claim it. Own it.</p>
          <Link href="/play" className="home-play"><span aria-hidden="true">▶</span> Play <span aria-hidden="true">↗</span></Link>
          <p className="home-mode"><i /> Live sessions · up to 4 players</p>
        </div>
      </main>
      <footer className="home-footer"><span>50 × 50</span><div aria-hidden="true"><i /><i /><i /><i /></div><span>5 minute rounds</span></footer>
    </div>
  );
}
