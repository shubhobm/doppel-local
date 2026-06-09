import type { Metadata } from "next";
import { Space_Grotesk, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";
import type { ReactNode } from "react";

const spaceGrotesk = Space_Grotesk({ subsets: ["latin"], variable: "--font-sans" });
const ibmPlexMono = IBM_Plex_Mono({ subsets: ["latin"], weight: ["400", "500", "600"], variable: "--font-mono" });

export const metadata: Metadata = {
  title: "Doppel Chatbot Studio",
  description: "Doppel chatbot workspace"
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className={`${spaceGrotesk.variable} ${ibmPlexMono.variable}`}>
        <header className="site-header">
          <div className="site-header-inner">
            <div className="site-brand">
              <div className="site-brand-mark">D</div>
              <div>
                <div className="site-brand-name">Doppel</div>
                <div className="site-brand-sub">Chatbot Studio</div>
              </div>
            </div>
          </div>
        </header>
        {children}
      </body>
    </html>
  );
}
