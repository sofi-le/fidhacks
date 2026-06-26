"use client";
import React, { useState, useEffect, useRef } from "react";
import type { UiCard } from "./lib/api";

/**
 * PackReveal — a "card pack" opening animation.
 *
 * A gold foil pack drops in and shakes. Tap/click it: the top tears off with a
 * flash, then the new card rises out with a glow + sparkle burst and a
 * "Card unlocked!" banner. The confirm button (or backdrop click) dismisses.
 *
 * Self-contained: only React. Renders a full-screen fixed overlay and injects
 * its own keyframes. Fonts expected from the host.
 */

const KEYFRAMES = `
@keyframes pkShake {0%,100%{transform:rotate(-2.6deg)}20%{transform:rotate(2.6deg)}40%{transform:rotate(-2deg) translateY(-2px)}60%{transform:rotate(2.2deg)}80%{transform:rotate(-1.4deg)}}
@keyframes pkTear {0%{transform:translateY(0) rotate(0);opacity:1}100%{transform:translateY(-240px) rotate(-24deg);opacity:0}}
@keyframes pkDrop {0%{opacity:1;transform:translateY(0) scale(1)}55%{opacity:1}100%{opacity:0;transform:translateY(54px) scale(.9)}}
@keyframes pkFlash {0%{opacity:0;transform:scale(.4)}35%{opacity:.9}100%{opacity:0;transform:scale(1.7)}}
@keyframes pkCardRise {0%{opacity:0;transform:translateY(86px) scale(.55) rotate(-6deg)}60%{opacity:1}100%{opacity:1;transform:translateY(0) scale(1) rotate(0)}}
@keyframes pkUnlock {0%{opacity:0;transform:scale(.3)}65%{transform:scale(1.14)}100%{opacity:1;transform:scale(1)}}
@keyframes pkGlow {0%,100%{opacity:.42;transform:translate(-50%,-50%) scale(.95)}50%{opacity:.82;transform:translate(-50%,-50%) scale(1.06)}}
@keyframes pkSpark {0%{opacity:0;transform:translate(-50%,-50%) scale(.2) rotate(45deg)}22%{opacity:1}100%{opacity:0;transform:translate(calc(-50% + var(--dx)),calc(-50% + var(--dy))) scale(1) rotate(170deg)}}
@keyframes pkHint {0%,100%{opacity:.6}50%{opacity:1}}
@keyframes pkFade {0%{opacity:0;transform:translateY(8px)}100%{opacity:1;transform:translateY(0)}}
`;

function PackStyles() {
  return <style>{KEYFRAMES}</style>;
}

// default big-card fallback if no renderCard is supplied
function DefaultCard({ card = {} }: { card?: Partial<UiCard> }) {
  return (
    <div style={{ width: 248, boxSizing: "border-box", background: "#f1ebfb", border: "2px solid #7d5fc0", borderRadius: 18, padding: 14, fontFamily: '"Hanken Grotesk",sans-serif', boxShadow: "0 6px 16px rgba(58,52,43,.12)" }}>
      <div style={{ fontFamily: '"Bricolage Grotesque",sans-serif', fontWeight: 700, fontSize: 20, color: "#352f27" }}>{card.skill || "New card"}</div>
      <div style={{ fontSize: 13.5, lineHeight: 1.35, color: "#6b6356", marginTop: 8 }}>{card.win || ""}</div>
    </div>
  );
}

type Phase = "sealed" | "opening" | "revealed";

interface Spark {
  id: number;
  dx: number;
  dy: number;
  sz: number;
  color: string;
  round: boolean;
  delay: number;
}

export default function PackReveal({
  card = {},
  onClose,
  renderCard,
}: {
  card?: Partial<UiCard>;
  onClose?: () => void;
  renderCard?: (card: Partial<UiCard>) => React.ReactNode;
}) {
  const [phase, setPhase] = useState<Phase>("sealed"); // sealed -> opening -> revealed
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const open = () => {
    if (phase !== "sealed") return;
    setPhase("opening");
    timer.current = setTimeout(() => setPhase("revealed"), 640);
  };
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);
  const close = () => onClose && onClose();

  const isSealed = phase === "sealed";
  const isOpening = phase === "opening";
  const isRevealed = phase === "revealed";

  // sparkle burst
  const COLORS = ["#e3b04a", "#8f9b3e", "#bb8b4e", "#d6814f", "#fdf7e8"];
  const sparks: Spark[] = [];
  const N = 16;
  for (let i = 0; i < N; i++) {
    const ang = (i / N) * Math.PI * 2 + (i % 2 ? 0.32 : 0);
    const dist = 118 + (i % 3) * 46;
    const dx = Math.cos(ang) * dist, dy = Math.sin(ang) * dist - 24;
    const sz = 6 + (i % 3) * 4;
    sparks.push({ id: i, dx, dy, sz, color: COLORS[i % COLORS.length], round: i % 2 === 0, delay: i * 0.018 });
  }

  return (
    <div onClick={close} style={{ position: "fixed", inset: 0, zIndex: 80, display: "flex", alignItems: "center", justifyContent: "center", padding: 24, background: "rgba(28,24,18,.64)", backdropFilter: "blur(4px)", fontFamily: '"Hanken Grotesk",sans-serif' }}>
      <PackStyles />
      <div onClick={(e) => e.stopPropagation()} style={{ position: "relative", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>

        {/* SEALED / OPENING — the pack */}
        {!isRevealed && (
          <div style={{ position: "relative", display: "flex", flexDirection: "column", alignItems: "center", gap: 22 }}>
            <div style={{ position: "relative" }}>
              {/* flash */}
              <div style={{ position: "absolute", left: "50%", top: "50%", width: 280, height: 280, marginLeft: -140, marginTop: -140, borderRadius: "50%", pointerEvents: "none", zIndex: 5, background: "radial-gradient(circle,rgba(255,251,235,.95),rgba(255,251,235,0) 64%)", opacity: 0, animation: isOpening ? "pkFlash .62s ease-out forwards" : "none" }} />
              {/* pack */}
              <div onClick={open} style={{ position: "relative", width: 208, height: 286, cursor: isSealed ? "pointer" : "default", animation: isSealed ? "pkShake 1.15s ease-in-out infinite" : "none", filter: "drop-shadow(0 18px 30px rgba(40,34,24,.45))" }}>
                {/* body */}
                <div style={{ position: "absolute", inset: 0, borderRadius: 16, overflow: "hidden", background: "linear-gradient(155deg,#f5d98a 0%,#e6b94e 42%,#c79324 100%)", border: "2px solid #a9791d", animation: isOpening ? "pkDrop .62s ease forwards" : "none" }}>
                  {/* shine */}
                  <div style={{ position: "absolute", top: "-40%", left: "-25%", width: "55%", height: "180%", background: "linear-gradient(90deg,transparent,rgba(255,253,247,.32),transparent)", transform: "rotate(18deg)", pointerEvents: "none" }} />
                  <div style={{ position: "relative", height: "100%", boxSizing: "border-box", padding: "30px 18px 22px", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 14, textAlign: "center" }}>
                    <div style={{ fontFamily: '"Space Mono",monospace', fontSize: 10, letterSpacing: 3, color: "#8a6410" }}>JOURNEYDEX</div>
                    <div style={{ width: 58, height: 58, borderRadius: "50%", background: "#6e5113", border: "3px solid #fbe6a3", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 25, color: "#fbe6a3", boxShadow: "0 4px 12px rgba(70,50,10,.4)" }}>★</div>
                    <div style={{ fontFamily: '"Bricolage Grotesque",sans-serif', fontWeight: 800, fontSize: 25, lineHeight: 1, letterSpacing: 1.5, textTransform: "uppercase", color: "#fffdf7", textShadow: "0 2px 5px rgba(110,80,15,.45)" }}>Skill<br />Pack</div>
                    <div style={{ fontFamily: '"Caveat",cursive', fontSize: 19, color: "#7a5a12", lineHeight: 1 }}>a new win awaits</div>
                  </div>
                </div>
                {/* tear-off top flap */}
                <div style={{ position: "absolute", left: -2, right: -2, top: -2, height: 50, borderRadius: "16px 16px 5px 5px", background: "linear-gradient(155deg,#fbe6a3,#eac254)", border: "2px solid #a9791d", borderBottom: "2px dashed rgba(169,121,29,.6)", display: "flex", alignItems: "center", justifyContent: "center", transformOrigin: "center top", zIndex: 3, animation: isOpening ? "pkTear .6s ease-in forwards" : "none" }}>
                  <span style={{ fontFamily: '"Space Mono",monospace', fontSize: 10, letterSpacing: 2, color: "#8a6410" }}>↑ pull to open</span>
                </div>
              </div>
            </div>
            <div style={{ fontFamily: '"Caveat",cursive', fontSize: 23, color: "#f0e2c4", animation: "pkHint 1.4s ease-in-out infinite" }}>tap the pack to tear it open!</div>
          </div>
        )}

        {/* REVEALED — the card */}
        {isRevealed && (
          <div style={{ position: "relative", display: "flex", flexDirection: "column", alignItems: "center", gap: 18 }}>
            <div style={{ position: "absolute", left: "50%", top: "52%", width: 380, height: 380, borderRadius: "50%", pointerEvents: "none", zIndex: 0, background: "radial-gradient(circle,rgba(227,176,74,.5),rgba(143,155,62,.18) 45%,transparent 70%)", filter: "blur(6px)", animation: "pkGlow 1.9s ease-in-out infinite" }} />
            {sparks.map((s) => (
              <div key={s.id} style={{ position: "absolute", left: "50%", top: "44%", width: s.sz, height: s.sz, borderRadius: s.round ? "50%" : 2, background: s.color, opacity: 0, zIndex: 1, pointerEvents: "none", animation: "pkSpark .95s ease-out forwards", animationDelay: s.delay.toFixed(3) + "s", ["--dx" as string]: s.dx.toFixed(0) + "px", ["--dy" as string]: s.dy.toFixed(0) + "px" } as React.CSSProperties} />
            ))}
            <div style={{ position: "relative", zIndex: 2, textAlign: "center" }}>
              <div style={{ fontFamily: '"Caveat",cursive', fontSize: 25, color: "#e3b04a", lineHeight: 1, marginBottom: 2 }}>you earned it</div>
              <div style={{ fontFamily: '"Bricolage Grotesque",sans-serif', fontWeight: 800, fontSize: 33, color: "#fffdf7", lineHeight: 1, textShadow: "0 3px 16px rgba(0,0,0,.4)", animation: "pkUnlock .6s ease both" }}>Card unlocked!</div>
            </div>
            <div style={{ position: "relative", zIndex: 2, animation: "pkCardRise .66s cubic-bezier(.2,.9,.3,1.25) both" }}>
              {renderCard ? renderCard(card) : <DefaultCard card={card} />}
            </div>
            <button onClick={close} style={{ position: "relative", zIndex: 2, marginTop: 4, background: "#fdf7e8", color: "#3a342b", border: "none", borderRadius: 999, padding: "13px 28px", fontFamily: '"Hanken Grotesk",sans-serif', fontWeight: 700, fontSize: 15, cursor: "pointer", boxShadow: "0 10px 26px rgba(0,0,0,.28)", animation: "pkFade .5s ease .25s both" }}>Add to my binder →</button>
          </div>
        )}

      </div>
    </div>
  );
}

PackReveal.Styles = PackStyles;
