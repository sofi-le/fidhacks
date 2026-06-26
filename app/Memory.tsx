"use client";
import React, { useEffect } from "react";
import { TYPES } from "./BalanceAndShare";
import type { Reflection, UiCard } from "./lib/api";

/**
 * Memory — "your binder remembers you", shown as little postage-stamp keepsakes.
 *
 * Each reflection is a perforated stamp: the card(s) it's about become the stamp
 * picture (tinted by their domain), with a postmark and the reflection as the
 * caption. Two per row. Fetch state lives in the parent, so revisiting the tab
 * doesn't refetch — only "Reflect again" (or the very first open) does.
 */
const FALLBACK = { mono: "✦", soft: "#fbf3df", fill: "#f4e7b4", deep: "#bb8b4e", ink: "#856c14" };
const TILT = [-1.6, 1.2, -0.7, 1.5, -1.1, 0.8];

const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const stampDate = (d?: string) => {
  if (!d) return "";
  const p = d.split("-");
  return (MON[+p[1] - 1] || "") + " " + (+p[2] || "");
};

export default function MemoryScreen({
  cards,
  items,
  loading,
  error,
  loaded,
  onRefresh,
}: {
  cards: UiCard[];
  items: Reflection[];
  loading: boolean;
  error: boolean;
  loaded: boolean;
  onRefresh: () => void;
}) {
  // Load once on first open; never on plain revisits (parent keeps `loaded`).
  useEffect(() => {
    if (!loaded && !loading) onRefresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const byId = new Map(cards.map((c) => [c.id, c]));

  const placeholder = (text: string, color?: string): React.ReactNode => (
    <div style={{ background: "#fffdf7", border: "1.5px dashed #e2d8c2", borderRadius: 16, padding: "40px 22px", textAlign: "center", color: color || "#a59c8c", fontSize: 14 }}>
      {text}
    </div>
  );

  // one stamp "picture" pane for a referenced card (its art, or a tinted hatch)
  const picture = (c: UiCard, theme: typeof FALLBACK) => (
    <div key={c.id} style={{ position: "relative", flex: 1, minWidth: 0, height: 92, borderRadius: 3, overflow: "hidden", background: c.imageUrl ? "#fff" : `repeating-linear-gradient(45deg, ${theme.fill}, ${theme.fill} 7px, ${theme.soft} 7px, ${theme.soft} 14px)`, border: `1px solid ${theme.deep}40` }}>
      {c.imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={c.imageUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
      ) : (
        <span style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: '"Space Mono",monospace', fontSize: 12, fontWeight: 700, color: theme.ink, opacity: 0.6 }}>{theme.mono}</span>
      )}
      {/* overprint: which win this is */}
      <span style={{ position: "absolute", left: 0, right: 0, bottom: 0, padding: "3px 6px", background: "rgba(255,253,247,.86)", borderTop: `1px solid ${theme.deep}30`, fontFamily: '"Hanken Grotesk",sans-serif', fontWeight: 700, fontSize: 9.5, color: theme.ink, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{c.skill}</span>
    </div>
  );

  return (
    <section style={{ fontFamily: '"Hanken Grotesk",system-ui,sans-serif', color: "#3a342b" }}>
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 16, flexWrap: "wrap", marginBottom: 20 }}>
        <div>
          <div style={{ fontFamily: '"Caveat",cursive', fontSize: 23, color: "#bb8b4e", lineHeight: 1, marginBottom: 2 }}></div>
          <h2 style={{ fontFamily: '"Bricolage Grotesque",sans-serif', fontWeight: 800, fontSize: 25, margin: 0, color: "#352f27" }}>Memory</h2>
          <p style={{ margin: "6px 0 0", fontSize: 14, lineHeight: 1.5, color: "#857c6c", maxWidth: 440 }}>
            Keepsakes and patterns the binder stamped about how far you&apos;ve come.
          </p>
        </div>
        <button
          onClick={onRefresh}
          disabled={loading}
          style={{ background: loading ? "#fbf7ec" : "#3a342b", color: loading ? "#a59c8c" : "#fdf7e8", border: loading ? "1.5px solid #e2d8c2" : "none", borderRadius: 12, padding: "11px 20px", fontFamily: '"Hanken Grotesk",sans-serif', fontWeight: 700, fontSize: 14, cursor: loading ? "default" : "pointer", boxShadow: loading ? "none" : "0 8px 22px rgba(58,52,43,.18)" }}
        >
          {loading ? "Reflecting…" : "↻ Reflect again"}
        </button>
      </div>

      {loading && items.length === 0 && placeholder("Looking back through your binder…")}
      {!loading && error && placeholder("Couldn't reach the reflection engine — is the AI server running?", "#b0564a")}
      {!loading && !error && loaded && items.length === 0 && placeholder("Log a few wins and the binder will start to notice things about you.")}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "24px 18px", alignItems: "start" }}>
        {items.map((it, i) => {
          const refCards = (it.refs || []).map((id) => byId.get(id)).filter(Boolean) as UiCard[];
          const theme = (refCards[0] && TYPES[refCards[0].type]) || FALLBACK;
          const dateText = stampDate(refCards[0]?.date);
          return (
            <div key={i} style={{ transform: `rotate(${TILT[i % TILT.length]}deg)`, transition: "transform .15s" }}>
              {/* perforated stamp */}
              <div style={{ background: "#fffdf7", border: `3px dotted ${theme.deep}66`, borderRadius: 6, padding: 7, boxShadow: "0 8px 20px rgba(58,52,43,.14)" }}>
                {/* inner frame */}
                <div style={{ border: `1.5px solid ${theme.deep}55`, borderRadius: 3, padding: 9, background: theme.soft, position: "relative" }}>
                  {/* picture(s) */}
                  <div style={{ display: "flex", gap: 6, position: "relative" }}>
                    {(refCards.length ? refCards.slice(0, 2) : []).map((c) => picture(c, theme))}
                    {refCards.length === 0 && (
                      <div style={{ flex: 1, height: 92, borderRadius: 3, background: `repeating-linear-gradient(45deg, ${theme.fill}, ${theme.fill} 7px, ${theme.soft} 7px, ${theme.soft} 14px)`, border: `1px solid ${theme.deep}40`, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: '"Caveat",cursive', fontSize: 18, color: theme.ink, opacity: 0.6 }}>a little note</div>
                    )}
                    {/* postmark */}
                    <div style={{ position: "absolute", top: -6, right: -6, width: 46, height: 46, borderRadius: "50%", border: `1.5px solid ${theme.deep}80`, transform: "rotate(-14deg)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", color: theme.deep, opacity: 0.62, pointerEvents: "none", background: "rgba(255,253,247,.35)" }}>
                      <span style={{ fontFamily: '"Space Mono",monospace', fontSize: 6.5, letterSpacing: 0.5, lineHeight: 1 }}>JOURNEYDEX</span>
                      <span style={{ fontFamily: '"Space Mono",monospace', fontSize: 7.5, fontWeight: 700, lineHeight: 1.3 }}>{dateText || "★"}</span>
                      <span style={{ width: 30, borderTop: `1px solid ${theme.deep}80`, marginTop: 1 }} />
                    </div>
                  </div>

                  {/* caption: tag + reflection */}
                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 10, marginBottom: 5 }}>
                    <span style={{ color: theme.deep, fontSize: 11 }}>✦</span>
                    <span style={{ fontFamily: '"Space Mono",monospace', fontSize: 9.5, letterSpacing: 1, textTransform: "uppercase", color: theme.ink, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{it.tag}</span>
                  </div>
                  <div style={{ fontSize: 13, lineHeight: 1.42, color: "#3a342b" }}>{it.line}</div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
