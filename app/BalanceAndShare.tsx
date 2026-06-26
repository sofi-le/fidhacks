"use client";
import React, { useState, useRef } from "react";
import Card from "./Card";
import type { UiCard } from "./lib/api";

/**
 * Balance + Share screens for JourneyDex.
 *
 *   - TYPES + chart math (buildRadar / buildPie)
 *   - <RadarChart> / <PieChart> (SVG, no deps) + <ChartToggle>
 *   - <BalanceScreen> — radar↔pie toggle, week/month period, legend, recap
 *   - <ShareScreen>   — profile panel (chart toggle + color index + drag-drop
 *                       "featured" dropzone) beside a filterable gallery
 *
 * Both screens are pure views over the cards the host loads from the backend —
 * counts/charts are derived client-side from that array, so they always reflect
 * whatever GET /api/cards returned.
 */

// ---------- palette ----------
interface Theme {
  label: string;
  mono: string;
  fill: string;
  soft: string;
  deep: string;
  ink: string;
}
export const TYPES: Record<string, Theme> = {
  academic:            { label: "Academic",          mono: "Ac", fill: "#cfe4f6", soft: "#eaf3fb", deep: "#3f86bd", ink: "#235b86" },
  career:              { label: "Career",            mono: "Ca", fill: "#e2d6f4", soft: "#f1ebfb", deep: "#7d5fc0", ink: "#553a91" },
  hobbies:             { label: "Hobbies",           mono: "Ho", fill: "#cdecdc", soft: "#e6f6ee", deep: "#46a583", ink: "#2c7a5e" },
  "social & family":   { label: "Social & Family",   mono: "SF", fill: "#fad7c2", soft: "#fdeee4", deep: "#d6814f", ink: "#a4592b" },
  financial:           { label: "Financial",         mono: "Fi", fill: "#f4e7b4", soft: "#fbf4d7", deep: "#bb9a35", ink: "#856c14" },
  "health & wellness": { label: "Health & Wellness", mono: "HW", fill: "#d4f0e0", soft: "#e8f8f0", deep: "#3aaa6a", ink: "#1f7a48" },
};
export const TYPE_ORDER = ["academic", "career", "hobbies", "social & family", "financial", "health & wellness"];
const AXIS_STEP = 360 / TYPE_ORDER.length; // degrees between radar axes (60° for 6 types)

type Counts = Record<string, number>;
type ShareCard = UiCard & { favorite?: boolean };

const countByType = (cards: { type: string }[]): Counts => {
  const c: Counts = {};
  TYPE_ORDER.forEach((k) => (c[k] = 0));
  cards.forEach((x) => { if (c[x.type] != null) c[x.type]++; });
  return c;
};

// ---------- chart math ----------
export function buildRadar(counts: Counts) {
  const max = Math.max(1, ...TYPE_ORDER.map((k) => counts[k]));
  const cx = 100, cy = 100, R = 74;
  const ptsAt = (f: number) => TYPE_ORDER.map((k, i) => {
    const a = (-90 + i * AXIS_STEP) * Math.PI / 180;
    return (cx + Math.cos(a) * R * f).toFixed(1) + "," + (cy + Math.sin(a) * R * f).toFixed(1);
  }).join(" ");
  const rings = [0.34, 0.67, 1].map((f) => ({ points: ptsAt(f) }));
  const axes = TYPE_ORDER.map((k, i) => {
    const a = (-90 + i * AXIS_STEP) * Math.PI / 180;
    const lr = R + 15, lx = cx + Math.cos(a) * lr, ly = cy + Math.sin(a) * lr;
    let anchor: "start" | "middle" | "end" = "middle";
    if (lx > cx + 4) anchor = "start"; else if (lx < cx - 4) anchor = "end";
    return { x: (cx + Math.cos(a) * R).toFixed(1), y: (cy + Math.sin(a) * R).toFixed(1),
      lx: lx.toFixed(1), ly: (ly + (ly < cy ? -1 : 7)).toFixed(1), anchor, label: TYPES[k].label };
  });
  const verts = TYPE_ORDER.map((k, i) => {
    const a = (-90 + i * AXIS_STEP) * Math.PI / 180, v = counts[k] / max;
    return { x: (cx + Math.cos(a) * R * v).toFixed(1), y: (cy + Math.sin(a) * R * v).toFixed(1), color: TYPES[k].deep };
  });
  return { rings, axes, verts, dataPoly: verts.map((p) => p.x + "," + p.y).join(" "), counts };
}

export function buildPie(counts: Counts) {
  const cx = 100, cy = 100, R = 74, r = 40;
  const entries = TYPE_ORDER.map((k) => ({ k, n: counts[k] })).filter((e) => e.n > 0);
  const total = entries.reduce((s, e) => s + e.n, 0);
  if (total === 0) return { slices: [] as PieSlice[], total: 0, single: null as PieSingle };
  if (entries.length === 1) {
    const k = entries[0].k;
    return { slices: [] as PieSlice[], total, single: { color: TYPES[k].deep, label: TYPES[k].label } as PieSingle };
  }
  let ang = -Math.PI / 2;
  const slices: PieSlice[] = entries.map((e) => {
    const frac = e.n / total, a0 = ang, a1 = ang + frac * 2 * Math.PI; ang = a1;
    const large = a1 - a0 > Math.PI ? 1 : 0;
    const P = (rad: number, a: number) => (cx + Math.cos(a) * rad).toFixed(1) + " " + (cy + Math.sin(a) * rad).toFixed(1);
    const d = "M" + P(R, a0) + " A" + R + " " + R + " 0 " + large + " 1 " + P(R, a1) +
              " L" + P(r, a1) + " A" + r + " " + r + " 0 " + large + " 0 " + P(r, a0) + " Z";
    const am = (a0 + a1) / 2, lr = (R + r) / 2;
    return { d, color: TYPES[e.k].deep, pct: Math.round(frac * 100),
      lx: (cx + Math.cos(am) * lr).toFixed(1), ly: (cy + Math.sin(am) * lr + 3.5).toFixed(1), showPct: frac > 0.09 };
  });
  return { slices, total, single: null as PieSingle };
}
interface PieSlice { d: string; color: string; pct: number; lx: string; ly: string; showPct: boolean }
type PieSingle = { color: string; label: string } | null;

// ---------- charts ----------
export function RadarChart({ counts, stroke = "#bb8b4e", ringStroke = "#e7ddc8", labelFill = "#6f6555", width = 380 }: {
  counts: Counts; stroke?: string; ringStroke?: string; labelFill?: string; width?: number;
}) {
  const r = buildRadar(counts);
  return (
    <svg viewBox="0 0 200 200" style={{ width: "100%", maxWidth: width, height: "auto", overflow: "visible" }}>
      {r.rings.map((ring, i) => <polygon key={i} points={ring.points} fill="none" stroke={ringStroke} strokeWidth={1} />)}
      {r.axes.map((ax, i) => <line key={i} x1={100} y1={100} x2={ax.x} y2={ax.y} stroke={ringStroke} strokeWidth={1} />)}
      <polygon points={r.dataPoly} fill="rgba(187,139,78,.16)" stroke={stroke} strokeWidth={2} strokeLinejoin="round" />
      {r.verts.map((v, i) => <circle key={i} cx={v.x} cy={v.y} r={4.2} fill={v.color} stroke="#fbf7ec" strokeWidth={1.5} />)}
      {r.axes.map((ax, i) => <text key={i} x={ax.lx} y={ax.ly} textAnchor={ax.anchor} style={{ fontFamily: '"Hanken Grotesk",sans-serif', fontSize: 9, fontWeight: 600, fill: labelFill }}>{ax.label}</text>)}
    </svg>
  );
}

export function PieChart({ counts, sliceStroke = "#fbf7ec", width = 380 }: { counts: Counts; sliceStroke?: string; width?: number }) {
  const p = buildPie(counts);
  return (
    <svg viewBox="0 0 200 200" style={{ width: "100%", maxWidth: width, height: "auto", overflow: "visible" }}>
      {p.single && <circle cx={100} cy={100} r={57} fill="none" stroke={p.single.color} strokeWidth={34} />}
      {p.slices.map((s, i) => <path key={i} d={s.d} fill={s.color} stroke={sliceStroke} strokeWidth={1.5} />)}
      {p.slices.map((s, i) => s.showPct && (
        <text key={"t" + i} x={s.lx} y={s.ly} textAnchor="middle" style={{ fontFamily: '"Hanken Grotesk",sans-serif', fontSize: 9.5, fontWeight: 700, fill: "#fffdf7" }}>{s.pct + "%"}</text>
      ))}
      <text x={100} y={97} textAnchor="middle" style={{ fontFamily: '"Bricolage Grotesque",sans-serif', fontWeight: 800, fontSize: 23, fill: "#352f27" }}>{String(p.total)}</text>
      <text x={100} y={111} textAnchor="middle" style={{ fontFamily: '"Space Mono",monospace', fontSize: 8, letterSpacing: 1.5, fill: "#a59c8c" }}>WINS</text>
    </svg>
  );
}

export function ChartToggle({ value, onChange }: { value: string; onChange: (k: string) => void }) {
  return (
    <div style={{ display: "flex", background: "#fbf7ec", border: "1.5px solid #e6dcc6", borderRadius: 11, padding: 4 }}>
      {[["radar", "Radar"], ["pie", "Pie"]].map(([k, label]) => (
        <button key={k} onClick={() => onChange(k)} style={{
          border: "none", cursor: "pointer", borderRadius: 8, padding: "6px 13px",
          fontFamily: '"Hanken Grotesk",sans-serif', fontWeight: 600, fontSize: 12.5,
          background: value === k ? "#3a342b" : "transparent", color: value === k ? "#fdf7e8" : "#8a8275",
        }}>{label}</button>
      ))}
    </div>
  );
}

// color index / legend
export function ColorIndex({ counts, compact }: { counts: Counts; compact?: boolean }) {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: compact ? "8px 16px" : 0, justifyContent: compact ? "center" : "stretch", flexDirection: compact ? "row" : "column" }}>
      {TYPE_ORDER.map((k) => (
        <span key={k} style={compact
          ? { display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, color: "#6a6151" }
          : { display: "flex", alignItems: "center", gap: 11, padding: "8px 0", borderBottom: "1px solid #f0e8d6" }}>
          <span style={{ width: compact ? 11 : 12, height: compact ? 11 : 12, borderRadius: compact ? 3 : "50%", background: TYPES[k].deep, flex: "0 0 auto" }} />
          <span style={{ flex: 1, fontWeight: 600, fontSize: compact ? 12 : 14, color: compact ? "#6a6151" : "#4a443a" }}>{TYPES[k].label}</span>
          <span style={{ fontFamily: '"Space Mono",monospace', fontSize: 12, color: "#a59c8c" }}>{counts[k]}</span>
        </span>
      ))}
    </div>
  );
}

// ---------- BALANCE ----------
export function BalanceScreen({ cards = [], today }: { cards?: UiCard[]; today?: string }) {
  // The host passes its demo "today"; default keeps SSR pure (no live clock).
  const TODAY = today || "2026-06-25";
  const [chart, setChart] = useState("radar");
  const [period, setPeriod] = useState("week");

  const d = new Date(TODAY);
  const weekStart = new Date(d); weekStart.setDate(d.getDate() - 6);
  const weekStartStr = weekStart.toISOString().slice(0, 10);
  const monthStartStr = TODAY.slice(0, 8) + "01";
  const periodCards = cards.filter((c) => c.date >= (period === "week" ? weekStartStr : monthStartStr));
  const counts = countByType(periodCards);
  const sorted = [...TYPE_ORDER].sort((a, b) => counts[b] - counts[a]);
  const topType = sorted[0], lowType = sorted[sorted.length - 1];
  const periodWord = period === "week" ? "this week" : "this month";
  const mirror = `Most of your energy ${periodWord} went to ${TYPES[topType].label}. The shape below is the honest mirror.`;
  const recap = `You logged ${periodCards.length} ${periodCards.length === 1 ? "win" : "wins"} ${periodWord}. ${TYPES[topType].label} took the lead. Lightest on ${TYPES[lowType].label} — maybe give it some love this week?`;

  return (
    <section style={{ fontFamily: '"Hanken Grotesk",system-ui,sans-serif' }}>
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 16, flexWrap: "wrap", marginBottom: 18 }}>
        <div>
          <h2 style={{ fontFamily: '"Bricolage Grotesque",sans-serif', fontWeight: 700, fontSize: 21, margin: "0 0 3px", color: "#352f27" }}>Where your energy went</h2>
          <p style={{ margin: 0, fontSize: 14, color: "#857c6c", maxWidth: 380 }}>{mirror}</p>
        </div>
        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <ChartToggle value={chart} onChange={setChart} />
          <div style={{ display: "flex", background: "#fbf7ec", border: "1.5px solid #e6dcc6", borderRadius: 11, padding: 4 }}>
            {[["week", "Week"], ["month", "Month"]].map(([k, label]) => (
              <button key={k} onClick={() => setPeriod(k)} style={{ border: "none", cursor: "pointer", borderRadius: 10, padding: "8px 16px", fontFamily: '"Hanken Grotesk",sans-serif', fontWeight: 600, fontSize: 14, background: period === k ? "#3a342b" : "transparent", color: period === k ? "#fdf7e8" : "#8a8275" }}>{label}</button>
            ))}
          </div>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1.05fr .95fr", gap: 20, alignItems: "stretch" }}>
        <div style={{ background: "#fbf7ec", border: "1.5px solid #ece2cd", borderRadius: 18, padding: "22px 18px 12px", boxShadow: "0 6px 20px rgba(58,52,43,.05)", display: "flex", flexDirection: "column", alignItems: "center" }}>
          {chart === "radar" ? <RadarChart counts={counts} /> : <PieChart counts={counts} />}
          <div style={{ fontFamily: '"Space Mono",monospace', fontSize: 11, color: "#a59c8c", marginTop: 4 }}>
            {period === "week" ? "this week" : "this month"}
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={{ background: "#fbf7ec", border: "1.5px solid #ece2cd", borderRadius: 18, padding: "16px 18px", boxShadow: "0 6px 20px rgba(58,52,43,.05)" }}>
            <ColorIndex counts={counts} />
          </div>
          <div style={{ background: "#fbf2d3", border: "1.5px solid #ecdda6", borderRadius: 14, padding: "15px 18px", boxShadow: "0 8px 20px rgba(58,52,43,.08)", transform: "rotate(-.7deg)" }}>
            <div style={{ fontFamily: '"Caveat",cursive', fontWeight: 700, fontSize: 21, color: "#a9842f", lineHeight: 1, marginBottom: 5 }}>note to self</div>
            <p style={{ margin: 0, fontSize: 14, lineHeight: 1.5, color: "#6a5f3f" }}>{recap}</p>
          </div>
        </div>
      </div>
    </section>
  );
}

// ---------- SHARE ----------
const SHARE_KEY = "pos_share_profile";
const loadShareSel = (): string[] | null => {
  try {
    const s = JSON.parse(localStorage.getItem(SHARE_KEY) || "null");
    return Array.isArray(s) ? s : null;
  } catch {
    return null;
  }
};
const saveShareSel = (s: string[]) => {
  try { localStorage.setItem(SHARE_KEY, JSON.stringify(s)); } catch { /* no storage */ }
};

interface ShareUser { name: string; initials: string; tagline: string }

export function ShareScreen({ cards = [], user = { name: "Maya Chen", initials: "MC", tagline: "Builder who grinds · 14 wins this month" }, onSaveProfile }: {
  cards?: ShareCard[]; user?: ShareUser; onSaveProfile?: () => void;
}) {
  const [chart, setChart] = useState("radar");
  const [filter, setFilter] = useState("all");
  const [selected, setSelected] = useState<string[] | null>(loadShareSel);   // null => use default
  const [dragOver, setDragOver] = useState(false);
  const [saving, setSaving] = useState(false);
  const dragId = useRef<string | null>(null);
  const profileRef = useRef<HTMLDivElement | null>(null);

  // Rasterize the profile panel to a PNG and download it.
  const saveProfileImage = async () => {
    const node = profileRef.current;
    if (!node || saving) return;
    setSaving(true);
    try {
      const html2canvas = (await import("html2canvas")).default;
      const canvas = await html2canvas(node, { backgroundColor: "#fffdf7", scale: 2, useCORS: true });
      const link = document.createElement("a");
      link.download = `journeydex-${user.name.toLowerCase().replace(/\s+/g, "-")}.png`;
      link.href = canvas.toDataURL("image/png");
      link.click();
      if (onSaveProfile) onSaveProfile();
    } catch (err) {
      console.error("[share] profile capture failed:", err);
    } finally {
      setSaving(false);
    }
  };

  const byId = (id: string) => cards.find((c) => c.id === id);
  const defaultSel = cards.slice(0, 3).map((c) => c.id);
  const effSel = selected === null ? defaultSel : selected;
  const featured = effSel.map(byId).filter(Boolean) as ShareCard[];
  const counts = countByType(cards);

  const filterOptions = [{ k: "all", label: "All cards" }, { k: "fav", label: "★ Favorites" }]
    .concat(TYPE_ORDER.map((k) => ({ k, label: TYPES[k].label })));
  const gallery = (filter === "all" ? cards
    : filter === "fav" ? cards.filter((c) => c.favorite)
    : cards.filter((c) => c.type === filter))
    .slice().sort((a, b) => (a.date < b.date ? 1 : -1));

  const addCard = (id?: string | null) => {
    if (!id || effSel.indexOf(id) !== -1) { setDragOver(false); return; }
    const next = effSel.concat([id]); saveShareSel(next); setSelected(next); setDragOver(false);
  };
  const removeCard = (id: string) => { const next = effSel.filter((x) => x !== id); saveShareSel(next); setSelected(next); };

  return (
    <section style={{ fontFamily: '"Hanken Grotesk",system-ui,sans-serif' }}>
      <div style={{ marginBottom: 18 }}>
        <h2 style={{ fontFamily: '"Bricolage Grotesque",sans-serif', fontWeight: 700, fontSize: 21, margin: 0, color: "#352f27" }}>Share your proof</h2>
        <p style={{ margin: "5px 0 0", fontSize: 13.5, color: "#8a8275" }}>Drag cards from your collection into the profile you want to share.</p>
      </div>

      <div style={{ display: "flex", gap: 24, flexWrap: "wrap", alignItems: "flex-start" }}>
        {/* LEFT — profile */}
        <div style={{ flex: "1 1 440px", minWidth: 320, display: "flex", flexDirection: "column", gap: 14 }}>
          <div ref={profileRef} style={{ background: "#fffdf7", border: "1.5px solid #e9dfca", borderRadius: 22, padding: "26px 28px", boxShadow: "0 14px 40px rgba(58,52,43,.12)", position: "relative", overflow: "hidden" }}>
            <div style={{ position: "absolute", top: 16, right: 22, fontFamily: '"Caveat",cursive', fontSize: 18, color: "#cbb98f" }}>journeydex</div>
            <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 20 }}>
              <div style={{ width: 54, height: 54, borderRadius: "50%", background: "#3a342b", color: "#fdf7e8", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: '"Bricolage Grotesque",sans-serif', fontWeight: 700, fontSize: 20 }}>{user.initials}</div>
              <div>
                <div style={{ fontFamily: '"Bricolage Grotesque",sans-serif', fontWeight: 700, fontSize: 22, color: "#352f27", lineHeight: 1.1 }}>{user.name}</div>
                <div style={{ fontSize: 13.5, color: "#8a8275" }}>{user.tagline}</div>
              </div>
            </div>
            <div style={{ display: "flex", justifyContent: "center", marginBottom: 12 }}>
              <ChartToggle value={chart} onChange={setChart} />
            </div>
            <div style={{ display: "flex", justifyContent: "center" }}>
              {chart === "radar"
                ? <RadarChart counts={counts} ringStroke="#ece3ce" labelFill="#7a7060" width={220} />
                : <PieChart counts={counts} sliceStroke="#fffdf7" width={220} />}
            </div>
            {/* color index */}
            <div style={{ marginTop: 14, paddingTop: 14, borderTop: "1px dashed #e3d9c2" }}>
              <ColorIndex counts={counts} compact />
            </div>
            {/* featured cards dropzone */}
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 22 }}>
              <span style={{ fontFamily: '"Space Mono",monospace', fontSize: 11, letterSpacing: 1, textTransform: "uppercase", color: "#a59c8c" }}>Featured cards</span>
              <span style={{ flex: 1, height: 1, background: "repeating-linear-gradient(90deg,#e3d9c2,#e3d9c2 5px,transparent 5px,transparent 10px)" }} />
            </div>
            <div
              onDragOver={(e) => { e.preventDefault(); if (!dragOver) setDragOver(true); }}
              onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setDragOver(false); }}
              onDrop={(e) => { e.preventDefault(); addCard(dragId.current || (e.dataTransfer && e.dataTransfer.getData("text/plain"))); }}
              style={{ display: "flex", flexWrap: "wrap", gap: 14, alignItems: "flex-start", minHeight: 150, marginTop: 22, padding: 16, borderRadius: 16, border: "2px dashed " + (dragOver ? "#bb8b4e" : "#e0d5bd"), background: dragOver ? "#fbf2dd" : "#fbf7ec", transition: "background .15s, border-color .15s" }}>
              {featured.length ? featured.map((c) => (
                <div key={c.id} style={{ position: "relative" }}>
                  <button onClick={() => removeCard(c.id)} aria-label="Remove from profile" style={{ position: "absolute", top: -9, right: -9, zIndex: 4, width: 24, height: 24, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", fontSize: 14, lineHeight: 1, padding: 0, background: "#fffdf7", border: "1.5px solid #e2d8c2", color: "#b3aa97", boxShadow: "0 2px 6px rgba(58,52,43,.14)" }}>×</button>
                  <Card card={c} size="sm" />
                </div>
              )) : (
                <div style={{ width: "100%", textAlign: "center", padding: "24px 8px", color: "#a59c8c", fontSize: 14, alignSelf: "center" }}>
                  <div style={{ fontFamily: '"Caveat",cursive', fontSize: 22, color: "#c9b88f", marginBottom: 2 }}>drop them here</div>
                  Drag cards from your collection to feature them.
                </div>
              )}
            </div>
          </div>
          <button onClick={saveProfileImage} disabled={saving} style={{ background: "#3a342b", color: "#fdf7e8", border: "none", borderRadius: 12, padding: "12px 26px", fontFamily: '"Hanken Grotesk",sans-serif', fontWeight: 600, fontSize: 15, cursor: saving ? "default" : "pointer", opacity: saving ? 0.7 : 1, boxShadow: "0 8px 22px rgba(58,52,43,.18)" }}>{saving ? "Saving…" : "Save profile image"}</button>
        </div>

        {/* RIGHT — gallery */}
        <div style={{ flex: "0 1 380px", minWidth: 300, display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
            <span style={{ fontFamily: '"Bricolage Grotesque",sans-serif', fontWeight: 700, fontSize: 16, color: "#352f27" }}>Your cards</span>
            <select value={filter} onChange={(e) => setFilter(e.target.value)} style={{ background: "#fbf7ec", border: "1.5px solid #e2d8c2", borderRadius: 10, padding: "8px 12px", fontFamily: '"Hanken Grotesk",sans-serif', fontWeight: 600, fontSize: 13, color: "#6b6356", cursor: "pointer", outline: "none" }}>
              {filterOptions.map((o) => <option key={o.k} value={o.k}>{o.label}</option>)}
            </select>
          </div>
          <div style={{ background: "#f6efe0", border: "1.5px solid #ece3d0", borderRadius: 18, padding: 14, maxHeight: 640, overflowY: "auto" }}>
            {gallery.length === 0 && <div style={{ textAlign: "center", padding: "36px 8px", color: "#a59c8c", fontSize: 14 }}>No cards in this category yet.</div>}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: 14, justifyItems: "center" }}>
              {gallery.map((c) => {
                const inProfile = effSel.indexOf(c.id) !== -1;
                return (
                  <div key={c.id} draggable
                    onDragStart={(e) => { dragId.current = c.id; if (e.dataTransfer) { e.dataTransfer.effectAllowed = "copy"; try { e.dataTransfer.setData("text/plain", c.id); } catch { /* ignore */ } } }}
                    onClick={() => addCard(c.id)}
                    style={{ position: "relative", cursor: "grab" }}>
                    <Card card={c} size="sm" />
                    {inProfile && (
                      <div style={{ position: "absolute", inset: 0, borderRadius: 13, background: "rgba(58,52,43,.42)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                        <span style={{ display: "flex", alignItems: "center", gap: 5, background: "#fffdf7", color: "#5f7320", borderRadius: 999, padding: "5px 11px", fontWeight: 700, fontSize: 12, boxShadow: "0 4px 12px rgba(58,52,43,.2)" }}>
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#6f7d2b" strokeWidth={3.4} strokeLinecap="round" strokeLinejoin="round"><path d="M5 12.5l4.5 4.5L19 7" /></svg>In profile
                        </span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
