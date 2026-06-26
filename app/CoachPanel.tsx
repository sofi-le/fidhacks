"use client";
import React, { useState, useEffect } from "react";
import { getQuests, getCoach } from "./lib/api";
import type { ApiQuest } from "./lib/api";

/**
 * CoachPanel — the Stats-page coach, styled as a shiny "quest card": a foil-sheen
 * panel with a little summit/flag illustration up top (echoing the Quest Journey
 * path), then the next card to complete + an AI encouragement.
 *
 * Cached by quest id so switching tabs doesn't refetch — only a changed "next
 * card" triggers a new nudge.
 */
let _coachCache: { questId: string | null; text: string } | null = null;

const ACCENT: Record<string, string> = {
  academic: "#3f86bd",
  career: "#7d5fc0",
  hobbies: "#46a583",
  "social & family": "#d6814f",
  financial: "#bb9a35",
  "health & wellness": "#3aaa6a",
};

const SHINE = `@keyframes coachShine {
  0% { transform: translateX(-130%) skewX(-18deg); }
  60%, 100% { transform: translateX(240%) skewX(-18deg); }
}`;

// Little summit scene (hills + dashed path + flag + sparkles), tinted by domain.
function SummitArt({ c }: { c: string }) {
  return (
    <svg viewBox="0 0 300 150" preserveAspectRatio="none" style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}>
      <defs>
        <linearGradient id="coachSky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={c} stopOpacity="0.18" />
          <stop offset="1" stopColor="#fffdf7" stopOpacity="0" />
        </linearGradient>
      </defs>
      <rect width="300" height="150" fill="url(#coachSky)" />
      <circle cx="232" cy="40" r="21" fill={c} opacity="0.16" />
      <path d="M0 120 Q70 82 150 104 T300 96 V150 H0 Z" fill={c} opacity="0.15" />
      <path d="M0 150 Q90 108 180 130 T300 118 V150 Z" fill={c} opacity="0.27" />
      <path d="M40 150 C90 132 120 120 165 96 S210 70 232 48" fill="none" stroke={c} strokeOpacity="0.55" strokeWidth="2.5" strokeDasharray="2 7" strokeLinecap="round" />
      <line x1="232" y1="48" x2="232" y2="21" stroke={c} strokeWidth="2.5" strokeLinecap="round" />
      <path d="M232 23 L251 29.5 L232 36 Z" fill={c} />
      <g fill={c} opacity="0.65">
        <circle cx="60" cy="34" r="1.6" />
        <circle cx="112" cy="22" r="2" />
        <circle cx="282" cy="64" r="1.5" />
      </g>
    </svg>
  );
}

export default function CoachPanel() {
  const [next, setNext] = useState<ApiQuest | null>(null);
  const [text, setText] = useState(_coachCache?.text ?? "");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const quests = await getQuests();
        const nx =
          quests.find((q) => q.status === "in_progress") ||
          quests.find((q) => q.status === "not_started") ||
          null;
        if (!alive) return;
        setNext(nx);

        if (!nx) {
          _coachCache = { questId: null, text: "" };
          setText("");
          setLoading(false);
          return;
        }
        if (_coachCache && _coachCache.questId === nx.id && _coachCache.text) {
          setText(_coachCache.text);
          setLoading(false);
          return;
        }
        const enc = await getCoach({ skill: nx.skill, aim: nx.aim, type: nx.type, deadline: nx.deadline });
        if (!alive) return;
        _coachCache = { questId: nx.id, text: enc };
        setText(enc);
      } catch (e) {
        console.error("[coach]", e);
        if (alive) setText("Take one small step toward it today — you've got this.");
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, []);

  const accent = ACCENT[(next?.type || "").toLowerCase()] || "#bb8b4e";

  return (
    <div
      style={{
        position: "relative",
        overflow: "hidden",
        minHeight: 340,
        display: "flex",
        flexDirection: "column",
        borderRadius: 18,
        border: `1.5px solid ${accent}55`,
        background: `linear-gradient(158deg, ${accent}24 0%, #fffdf7 46%, ${accent}14 100%)`,
        boxShadow: `0 10px 26px rgba(58,52,43,.12), inset 0 1px 0 rgba(255,255,255,.6)`,
      }}
    >
      <style>{SHINE}</style>
      {/* foil sheen sweep */}
      <div style={{ position: "absolute", top: 0, bottom: 0, left: 0, width: "42%", background: "linear-gradient(90deg, transparent, rgba(255,255,255,.5), transparent)", animation: "coachShine 5s ease-in-out infinite", pointerEvents: "none", zIndex: 4 }} />

      {/* art banner */}
      <div style={{ position: "relative", height: 150, flex: "0 0 auto" }}>
        <SummitArt c={accent} />
        <div style={{ position: "absolute", top: 13, left: 14, display: "inline-flex", alignItems: "center", gap: 6, background: "rgba(255,253,247,.82)", border: `1.5px solid ${accent}55`, borderRadius: 999, padding: "4px 11px", fontFamily: '"Space Mono",monospace', fontSize: 9.5, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase", color: accent }}>
          <span>✦</span> Next in your quest
        </div>
      </div>

      {/* content */}
      <div style={{ position: "relative", zIndex: 3, flex: 1, display: "flex", flexDirection: "column", gap: 11, padding: "4px 18px 18px" }}>
        <div style={{ fontFamily: '"Bricolage Grotesque",sans-serif', fontWeight: 800, fontSize: 17, lineHeight: 1.25, color: "#352f27" }}>
          Complete the next card in your quest!
        </div>

        {next ? (
          <>
            <div style={{ display: "flex", gap: 11, alignItems: "flex-start", background: "rgba(255,253,247,.85)", border: `1.5px solid ${accent}3a`, borderRadius: 12, padding: "11px 13px", boxShadow: "0 3px 10px rgba(58,52,43,.06)" }}>
              <div style={{ width: 24, height: 24, borderRadius: "50%", background: accent, color: "#fffdf7", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, flex: "0 0 auto", boxShadow: `0 2px 6px ${accent}55` }}>✦</div>
              <div>
                <div style={{ fontFamily: '"Hanken Grotesk",sans-serif', fontWeight: 700, fontSize: 14.5, color: "#3a342b" }}>{next.skill}</div>
                {next.aim && <div style={{ fontSize: 12.5, lineHeight: 1.4, color: "#857c6c", marginTop: 2 }}>{next.aim}</div>}
              </div>
            </div>
            <p style={{ margin: 0, fontSize: 13.5, lineHeight: 1.55, color: loading ? "#a59c8c" : "#5f5848", fontStyle: loading ? "italic" : "normal" }}>
              {loading ? "thinking of a nudge…" : text}
            </p>
          </>
        ) : (
          <p style={{ margin: 0, fontSize: 13.5, lineHeight: 1.5, color: "#857c6c" }}>
            {loading ? "looking for your next quest…" : "No active quest yet — set one in Quests and a nudge will appear here."}
          </p>
        )}
      </div>
    </div>
  );
}
