import type { Metadata } from "next";
import "./globals.css";
import "./menu.css";
import "./sessions.css";
import "./board.css";

export const metadata: Metadata = {
  title: "PIXIT — Claim it. Own it. Pixit.",
  description: "Small pixels. Big rivalries. Claim your color in a fast, playful territory game.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className="h-full antialiased"
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
