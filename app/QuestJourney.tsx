"use client";
import React, { useState, useEffect, useRef } from "react";
import type { NewCardInput } from "./lib/api";

/**
 * QuestJourney — the "Challenges" screen.
 *
 * A winding timeline of goal-setting quests. Quests move through
 * not_started → in_progress → completed. Completed quests can be
 * minted into the user's binder (via the onAddToBinder callback),
 * which removes them from the journey.
 *
 * Persists quests to localStorage under "pos_challenges" (independent of the
 * binder backend); only the "add to binder" action talks to the server.
 */

type Status = "not_started" | "in_progress" | "completed";

interface Quest {
  id: string;
  type: string;
  skill: string;
  aim: string;
  date: string;
  deadline?: string;
  status: Status;
  done?: boolean;
  completedDate?: string;
  win?: string;
  fromQuest?: boolean;
}

interface Pt {
  x: number;
  y: number;
}
interface Theme {
  label?: string;
  fill: string;
  soft: string;
  deep: string;
  ink: string;
}
interface PillMeta {
  label: string;
  pillBg: string;
  pillTx: string;
  pillBd: string;
}

// the card object handed to onAddToBinder (and console-logged as a fallback)
type BinderCard = NewCardInput & { id: string; fromQuest: boolean };

interface QuestJourneyProps {
  onAddToBinder?: (card: BinderCard) => void;
  initialQuests?: Quest[];
  today?: string;
}

// ---- type themes (mirror the binder card palette) ----
const TYPES: Record<string, Theme> = {
  academic:            { label: "Academic",          fill: "#cfe4f6", soft: "#eaf3fb", deep: "#3f86bd", ink: "#235b86" },
  career:              { label: "Career",            fill: "#e2d6f4", soft: "#f1ebfb", deep: "#7d5fc0", ink: "#553a91" },
  hobbies:             { label: "Hobbies",           fill: "#cdecdc", soft: "#e6f6ee", deep: "#46a583", ink: "#2c7a5e" },
  "social & family":   { label: "Social & Family",   fill: "#fad7c2", soft: "#fdeee4", deep: "#d6814f", ink: "#a4592b" },
  financial:           { label: "Financial",         fill: "#f4e7b4", soft: "#fbf4d7", deep: "#bb9a35", ink: "#856c14" },
  "health & wellness": { label: "Health & Wellness", fill: "#d4f0e0", soft: "#e8f8f0", deep: "#3aaa6a", ink: "#1f7a48" },
};
const TYPE_ORDER = ["academic", "career", "hobbies", "social & family", "financial", "health & wellness"];
const MONO: Record<string, string> = { academic: "Ac", career: "Ca", hobbies: "Ho", "social & family": "SF", financial: "Fi", "health & wellness": "HW" };
const DIMTHEME: Theme = { soft: "#efeae0", fill: "#e4dfd4", deep: "#b3aa97", ink: "#7c7363" };

const META: Record<Status, PillMeta> = {
  completed:   { label: "Completed",   pillBg: "#dcebc4", pillTx: "#5f7320", pillBd: "#c4d79a" },
  in_progress: { label: "In progress", pillBg: "#fbeec0", pillTx: "#a9842f", pillBd: "#ecd99a" },
  not_started: { label: "Not started", pillBg: "#ece7db", pillTx: "#8a8275", pillBd: "#ddd5c5" },
};
const LOCKED_META: PillMeta = { label: "Locked", pillBg: "#ece7db", pillTx: "#8a8275", pillBd: "#ddd5c5" };

// ---- helpers ----
const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const fmtDate = (d?: string) => {
  if (!d) return "";
  const p = ("" + d).split("-");
  return MON[+p[1] - 1] + " " + +p[2];
};

// smooth Catmull-Rom path through a list of {x,y} points
function smoothPath(pts: Pt[]) {
  if (!pts || pts.length < 2) return "";
  let d = "M" + pts[0].x.toFixed(1) + "," + pts[0].y.toFixed(1);
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] || pts[i], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2] || p2;
    const c1x = p1.x + (p2.x - p0.x) / 6, c1y = p1.y + (p2.y - p0.y) / 6;
    const c2x = p2.x - (p3.x - p1.x) / 6, c2y = p2.y - (p3.y - p1.y) / 6;
    d += " C" + c1x.toFixed(1) + "," + c1y.toFixed(1) + " " +
         c2x.toFixed(1) + "," + c2y.toFixed(1) + " " +
         p2.x.toFixed(1) + "," + p2.y.toFixed(1);
  }
  return d;
}

// ---- persistence (quests live in localStorage; the binder lives on the server) ----
const CHAL_KEY = "pos_challenges";
const normalizeQ = (q: Quest): Quest => {
  const status: Status = q.status || (q.done ? "completed" : "not_started");
  return { ...q, status, done: status === "completed" };
};
function loadChallenges(seed: Quest[]): Quest[] {
  try {
    const s = JSON.parse(localStorage.getItem(CHAL_KEY) || "null");
    if (Array.isArray(s)) return s.map(normalizeQ);
  } catch {
    /* no storage (SSR) or bad JSON — fall back to seed */
  }
  return seed.map(normalizeQ);
}
function saveChallenges(c: Quest[]) {
  try {
    localStorage.setItem(CHAL_KEY, JSON.stringify(c));
  } catch {
    /* storage unavailable — ignore */
  }
}

const SEED: Quest[] = [
  { id:"q1", type:"career",            skill:"Ship a CLI tool",         aim:"Publish a small command-line tool people can install.", date:"2026-05-20", deadline:"2026-06-15", status:"completed", completedDate:"2026-06-15", win:"Shipped a CLI ~40 people installed." },
  { id:"q2", type:"health & wellness", skill:"Run a clean 10k",         aim:"Finish a 10k start to finish without walking.",         date:"2026-05-25", deadline:"2026-08-01", status:"completed", completedDate:"2026-06-20", win:"Ran the full 10k without stopping." },
  { id:"q3", type:"social & family",   skill:"Give a lightning talk",   aim:"Speak 5 minutes in front of a real audience.",          date:"2026-06-01", deadline:"",           status:"completed", completedDate:"2026-06-15", win:"Gave a 5-min talk to a room of 30." },
  { id:"q4", type:"academic",          skill:"Finish the Rust book",    aim:"Read and do the exercises through every chapter.",      date:"2026-06-10", deadline:"2026-07-19", status:"in_progress" },
  { id:"q5", type:"career",            skill:"Build and launch a site", aim:"Design, build, and launch a personal project.",         date:"2026-06-12", deadline:"2026-08-15", status:"not_started" },
  { id:"q6", type:"hobbies",           skill:"30 days of journaling",   aim:"Write a short journal entry every day for 30 days.",     date:"2026-06-14", deadline:"",           status:"not_started" },
];

export default function QuestJourney({ onAddToBinder, initialQuests, today }: QuestJourneyProps) {
  const TODAY = today || "2026-06-25";
  // Read persisted quests in the initializer (loadChallenges falls back to the
  // seed when localStorage is unavailable, e.g. during SSR).
  const [challenges, setChallenges] = useState<Quest[]>(() => loadChallenges(initialQuests || SEED));
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ title: "", aim: "", type: "career", deadline: "" });
  const [completingId, setCompletingId] = useState<string | null>(null);
  const [log, setLog] = useState({ win: "" });
  const [toast, setToast] = useState("");
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const persist = (next: Quest[]) => {
    saveChallenges(next);
    setChallenges(next);
  };
  const fireToast = (msg: string) => {
    setToast(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(""), 2600);
  };
  useEffect(() => () => { if (toastTimer.current) clearTimeout(toastTimer.current); }, []);

  // ---- actions ----
  const addChallenge = () => {
    const title = form.title.trim(), aim = form.aim.trim();
    if (!title) return fireToast("Name your quest");
    if (!aim) return fireToast('Describe what "done" looks like');
    const q: Quest = { id: "q-" + crypto.randomUUID(), type: form.type, skill: title, aim, date: TODAY, deadline: form.deadline || "", status: "not_started", done: false };
    persist([...challenges, q]);
    setShowForm(false);
    setForm({ title: "", aim: "", type: "career", deadline: "" });
    fireToast("Quest set — go earn it");
  };
  const removeChallenge = (id: string) => persist(challenges.filter((q) => q.id !== id));
  const startQuest = (id: string) => {
    persist(challenges.map((x) => (x.id === id ? { ...x, status: "in_progress" as Status } : x)));
    fireToast("Quest started — you're on the path");
  };
  const completeChallenge = () => {
    const win = log.win.trim();
    if (!win) return fireToast("How did it actually go?");
    persist(challenges.map((x) =>
      x.id === completingId
        ? { ...x, status: "completed" as Status, done: true, win, completedDate: TODAY }
        : x
    ));
    setCompletingId(null);
    setLog({ win: "" });
    fireToast("Quest complete — add it to your binder when ready ✓");
  };
  const addQuestToBinder = (id: string) => {
    const q = challenges.find((x) => x.id === id);
    if (!q || q.status !== "completed") return;
    const card: BinderCard = {
      id: "qc-" + crypto.randomUUID(), type: q.type, skill: q.skill,
      win: q.win || "", date: q.completedDate || TODAY, fromQuest: true,
    };
    if (onAddToBinder) onAddToBinder(card);
    else console.log("add to binder:", card);
    persist(challenges.filter((x) => x.id !== id));
    fireToast("Added to your binder — nice work ✓");
  };
  const cardClick = (q: Quest, locked: boolean) => {
    if (q.status === "completed") return;       // completed cards use their own button
    if (q.status === "in_progress") { setCompletingId(q.id); setLog({ win: "" }); return; }
    if (locked) return fireToast("Finish the quest before this one first");
    startQuest(q.id);
  };

  // ---- derived stats ----
  const N = challenges.length;
  const completedCount = challenges.filter((q) => q.status === "completed").length;
  const inProgCount = challenges.filter((q) => q.status === "in_progress").length;
  const allDone = N > 0 && completedCount === N;

  // No sequential locking — any quest can be started at any time, in any order.
  const lockedIds = new Set<string>();

  // ---- geometry: compact, organic vertical positions ----
  const stepX = 252, leftPad = 156, cardW = 190, cardH = 236;
  const Y_RAW = [64, 252, 150, 292, 92, 232, 176, 284];
  const xs = challenges.map((q, i) => leftPad + i * stepX);
  let ys = challenges.map((q, i) => Y_RAW[i % Y_RAW.length]);
  const nodeMin = ys.length ? Math.min(...ys) : 0;
  const nodeMax = ys.length ? Math.max(...ys) : 0;
  const midNode = (nodeMin + nodeMax) / 2;
  const aboveArr = ys.map((y) => y >= midNode);
  const rawTops = ys.map((y, i) => (aboveArr[i] ? y - 34 - cardH : y + 34));
  const TOP_M = 28, BOT_M = 30;
  const minTop = rawTops.length ? Math.min(...rawTops) : 0;
  const shift = minTop < TOP_M ? TOP_M - minTop : 0;
  ys = ys.map((y) => y + shift);
  const tops = rawTops.map((t) => t + shift);
  const maxBottom = tops.length ? Math.max(...tops.map((t) => t + cardH)) : 320;
  const anchorY = midNode + shift;
  const startPt = { x: 56, y: anchorY };
  const starPt = { x: leftPad + N * stepX + 32, y: anchorY };
  const canvasW = Math.max(880, starPt.x + 150);
  const canvasH = Math.max(340, Math.round(maxBottom + BOT_M));
  const pts: Pt[] = [startPt, ...challenges.map((q, i) => ({ x: xs[i], y: ys[i] })), starPt];
  const dashedPath = smoothPath(pts);
  let progIdx = -1;
  challenges.forEach((q, i) => { if (q.status === "completed" || q.status === "in_progress") progIdx = i; });
  const solidPath = progIdx >= 0 ? smoothPath(pts.slice(0, progIdx + 2)) : "";

  const completingQ = challenges.find((q) => q.id === completingId) || null;

  // ---- shared style fragments ----
  const mono11: React.CSSProperties = { fontFamily: '"Space Mono",monospace' };
  const statCard: React.CSSProperties = { background: "#fffdf7", border: "1.5px solid #e9dfca", borderRadius: 14, padding: "14px 16px" };
  const statLabel: React.CSSProperties = { ...mono11, fontSize: 11, letterSpacing: ".5px", color: "#a59c8c", marginTop: 5, textTransform: "uppercase" };

  return (
    <section style={{ fontFamily: '"Hanken Grotesk",system-ui,sans-serif', color: "#3a342b" }}>
      {/* HEADER */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, flexWrap: "wrap", marginBottom: 16 }}>
        <div>
          <div style={{ fontFamily: '"Caveat",cursive', fontSize: 23, color: "#bb8b4e", lineHeight: 1, marginBottom: 2 }}>dare yourself</div>
          <h2 style={{ fontFamily: '"Bricolage Grotesque",sans-serif', fontWeight: 800, fontSize: 25, margin: 0, color: "#352f27" }}>Quest Journey</h2>
          <p style={{ margin: "6px 0 0", fontSize: 14, lineHeight: 1.5, color: "#857c6c", maxWidth: 380 }}>
            A path of small quests that build into real growth. Start small. Keep going. Become undeniable.
          </p>
        </div>
        <button onClick={() => setShowForm((v) => !v)} style={{
          background: showForm ? "#fbf7ec" : "#3a342b", color: showForm ? "#6b6356" : "#fdf7e8",
          border: showForm ? "1.5px solid #e2d8c2" : "none", borderRadius: 12, padding: "11px 20px",
          fontFamily: '"Hanken Grotesk",sans-serif', fontWeight: 700, fontSize: 14, cursor: "pointer",
          boxShadow: showForm ? "none" : "0 8px 22px rgba(58,52,43,.18)",
        }}>{showForm ? "Close" : "+ New quest"}</button>
      </div>

      {/* STATS */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(130px,1fr))", gap: 12, marginBottom: 18 }}>
        <div style={statCard}><div style={{ fontFamily: '"Bricolage Grotesque",sans-serif', fontWeight: 800, fontSize: 26, color: "#352f27", lineHeight: 1 }}>{N}</div><div style={statLabel}>On the path</div></div>
        <div style={statCard}><div style={{ fontFamily: '"Bricolage Grotesque",sans-serif', fontWeight: 800, fontSize: 26, color: "#c9842f", lineHeight: 1 }}>{inProgCount}</div><div style={statLabel}>In progress</div></div>
        <div style={statCard}><div style={{ fontFamily: '"Bricolage Grotesque",sans-serif', fontWeight: 800, fontSize: 26, color: "#6f7d2b", lineHeight: 1 }}>{completedCount}</div><div style={statLabel}>Completed</div></div>
      </div>

      {/* NEW QUEST FORM */}
      {showForm && (
        <div style={{ background: "#fbf7ec", border: "1.5px solid #e6dcc6", borderRadius: 18, padding: "20px 20px 22px", marginBottom: 20, boxShadow: "0 6px 20px rgba(58,52,43,.05)" }}>
          <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })}
            placeholder="Name the quest (e.g. Run a clean 10k)"
            style={{ width: "100%", boxSizing: "border-box", background: "#fffdf7", border: "1.5px solid #e6dcc6", borderRadius: 12, padding: "12px 14px", fontFamily: '"Hanken Grotesk",sans-serif', fontSize: 15, color: "#3a342b", outline: "none", marginBottom: 12 }} />
          <textarea value={form.aim} onChange={(e) => setForm({ ...form, aim: e.target.value })}
            placeholder='What does "done" look like? Be specific.'
            style={{ width: "100%", boxSizing: "border-box", minHeight: 74, resize: "vertical", background: "#fffdf7", border: "1.5px solid #e6dcc6", borderRadius: 12, padding: "12px 14px", fontFamily: '"Hanken Grotesk",sans-serif', fontSize: 14, lineHeight: 1.5, color: "#3a342b", outline: "none", marginBottom: 14 }} />
          <div style={{ display: "flex", flexWrap: "wrap", gap: 18, alignItems: "flex-end", justifyContent: "space-between" }}>
            <div>
              <div style={{ ...mono11, fontSize: 11, letterSpacing: 1, textTransform: "uppercase", color: "#a59c8c", marginBottom: 8 }}>Type</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {TYPE_ORDER.map((k) => (
                  <button key={k} onClick={() => setForm({ ...form, type: k })} style={{
                    border: "1.5px solid " + (form.type === k ? TYPES[k].deep : "#e2d8c2"),
                    background: form.type === k ? TYPES[k].fill : "#fbf7ec",
                    color: form.type === k ? TYPES[k].ink : "#8a8275",
                    cursor: "pointer", borderRadius: 999, padding: "7px 14px",
                    fontFamily: '"Hanken Grotesk",sans-serif', fontWeight: 600, fontSize: 13,
                  }}>{TYPES[k].label}</button>
                ))}
              </div>
            </div>
            <div>
              <div style={{ ...mono11, fontSize: 11, letterSpacing: 1, textTransform: "uppercase", color: "#a59c8c", marginBottom: 8 }}>
                Finish by <span style={{ textTransform: "none", letterSpacing: 0 }}>(target date)</span>
              </div>
              <input type="date" value={form.deadline} onChange={(e) => setForm({ ...form, deadline: e.target.value })}
                style={{ background: "#fffdf7", border: "1.5px solid #e6dcc6", borderRadius: 12, padding: "10px 12px", fontFamily: '"Hanken Grotesk",sans-serif', fontSize: 14, color: "#3a342b", outline: "none" }} />
            </div>
          </div>
          <button onClick={addChallenge} style={{ marginTop: 16, background: "#3a342b", color: "#fdf7e8", border: "none", borderRadius: 12, padding: "12px 22px", fontFamily: '"Hanken Grotesk",sans-serif', fontWeight: 700, fontSize: 15, cursor: "pointer" }}>Add to my journey</button>
        </div>
      )}

      {/* JOURNEY MAP */}
      {N > 0 ? (
        <>
          <div style={{ overflowX: "auto", overflowY: "hidden", border: "1.5px solid #ece3d0", borderRadius: 20, background: "#f6efe0", backgroundImage: "radial-gradient(#e3d9c4 1px,transparent 1px)", backgroundSize: "22px 22px", padding: 4, WebkitOverflowScrolling: "touch" }}>
            <div style={{ position: "relative", width: canvasW, height: canvasH, margin: "0 auto" }}>
              <svg width={canvasW} height={canvasH} viewBox={`0 0 ${canvasW} ${canvasH}`} style={{ position: "absolute", left: 0, top: 0, pointerEvents: "none", zIndex: 1 }}>
                <path d={dashedPath} fill="none" stroke="#c8bca2" strokeWidth={3} strokeDasharray="2 9" strokeLinecap="round" />
                {solidPath && <path d={solidPath} fill="none" stroke="#9aa84a" strokeWidth={4} strokeLinecap="round" />}
              </svg>

              {challenges.map((q, i) => {
                const locked = lockedIds.has(q.id);
                const m = locked ? LOCKED_META : META[q.status];
                const t = TYPES[q.type] || TYPES.academic;
                const dim = q.status === "not_started";
                const tc = dim ? DIMTHEME : { soft: t.soft, fill: t.fill, deep: t.deep, ink: t.ink };
                const nx = xs[i], ny = ys[i], above = aboveArr[i], cardTop = tops[i];
                const stemTop = above ? cardTop + cardH : ny;
                const stemH = Math.max(0, (above ? ny : cardTop) - stemTop);
                const isDone = q.status === "completed";
                const dateText = isDone
                  ? "Done " + fmtDate(q.completedDate || q.date)
                  : q.deadline ? "Finish by " + fmtDate(q.deadline) : "No date set";

                return (
                  <React.Fragment key={q.id}>
                    {/* connector stem */}
                    <div style={{ position: "absolute", left: nx - 1, top: stemTop, width: 0, height: stemH, borderLeft: "2px dashed #d8cfba", zIndex: 2 }} />
                    {/* status node */}
                    <div style={{
                      position: "absolute", left: nx - 17, top: ny - 17, width: 34, height: 34, borderRadius: "50%",
                      display: "flex", alignItems: "center", justifyContent: "center", zIndex: 4,
                      background: isDone ? "#8f9b3e" : "#fffdf7",
                      border: isDone ? "none" : q.status === "in_progress" ? "3px solid #e6b422" : "2px dashed #cbc2af",
                      boxShadow: "0 3px 8px rgba(58,52,43,.16)",
                    }}>
                      {isDone && <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fffdf7" strokeWidth={3.4} strokeLinecap="round" strokeLinejoin="round"><path d="M5 12.5l4.5 4.5L19 7" /></svg>}
                      {q.status === "in_progress" && <span style={{ width: 9, height: 9, borderRadius: "50%", background: "#e6b422" }} />}
                      {q.status === "not_started" && <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#cbc2af" }} />}
                    </div>
                    {/* quest card */}
                    <div onClick={() => cardClick(q, locked)} style={{
                      position: "absolute", left: nx - cardW / 2, top: cardTop, width: cardW, height: cardH,
                      boxSizing: "border-box", display: "flex", flexDirection: "column", overflow: "hidden",
                      background: tc.soft, border: "2px solid " + tc.deep, borderRadius: 15, padding: 11,
                      boxShadow: dim ? "0 5px 16px rgba(58,52,43,.07)" : "0 9px 22px rgba(58,52,43,.13)",
                      cursor: locked ? "default" : "pointer", zIndex: 3,
                    }}>
                      <button onClick={(e) => { e.stopPropagation(); removeChallenge(q.id); }} aria-label="Remove quest" style={{
                        position: "absolute", top: -8, right: -8, zIndex: 6, width: 22, height: 22, borderRadius: "50%",
                        display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", fontSize: 13, lineHeight: 1, padding: 0,
                        background: "#fffdf7", border: "1.5px solid #e2d8c2", color: "#b3aa97", boxShadow: "0 2px 6px rgba(58,52,43,.14)",
                      }}>×</button>

                      {/* banner */}
                      <div style={{ display: "flex", alignItems: "center", gap: 7, background: tc.fill, color: tc.ink, borderRadius: 9, padding: "5px 9px", marginBottom: 7, fontFamily: '"Bricolage Grotesque",sans-serif', fontWeight: 700, fontSize: 11.5, letterSpacing: ".2px" }}>
                        <span style={{ width: 20, height: 20, borderRadius: "50%", flex: "0 0 auto", display: "flex", alignItems: "center", justifyContent: "center", background: tc.deep, color: "#fff", ...mono11, fontSize: 9.5, fontWeight: 700 }}>{MONO[q.type] || "··"}</span>
                        <span style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", flex: 1 }}>{t.label}</span>
                        <span style={{ ...mono11, fontSize: 9.5, opacity: 0.7 }}>#{i + 1}</span>
                      </div>

                      {/* hatched "card art" strip */}
                      <div style={{
                        height: 38, borderRadius: 9, marginBottom: 8, flex: "0 0 auto",
                        background: `repeating-linear-gradient(45deg, ${tc.fill}, ${tc.fill} 7px, ${tc.soft} 7px, ${tc.soft} 14px)`,
                        border: "1px dashed " + tc.deep + "7a", display: "flex", alignItems: "center", justifyContent: "center",
                      }}>
                        {isDone && (
                          <span style={{ display: "flex", alignItems: "center", gap: 5, background: "rgba(255,253,247,.82)", border: "1px solid #c4d79a", borderRadius: 7, padding: "2px 8px", ...mono11, fontSize: 9.5, fontWeight: 700, color: "#5f7320" }}>
                            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#6f7d2b" strokeWidth={3.4} strokeLinecap="round" strokeLinejoin="round"><path d="M5 12.5l4.5 4.5L19 7" /></svg>EARNED
                          </span>
                        )}
                        {locked && (
                          <span style={{ width: 30, height: 30, borderRadius: "50%", background: "rgba(255,253,247,.82)", border: "1.5px solid #cfc6b3", display: "flex", alignItems: "center", justifyContent: "center" }}>
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#8f8676" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><rect x="4.5" y="10.5" width="15" height="10" rx="2.2" /><path d="M8 10.5V7a4 4 0 0 1 8 0v3.5" /></svg>
                          </span>
                        )}
                        {!locked && !isDone && (
                          <span style={{ display: "flex", alignItems: "center", gap: 5, background: "rgba(255,253,247,.78)", borderRadius: 7, padding: "2px 8px", ...mono11, fontSize: 9.5, letterSpacing: ".4px", color: "#a98f5e" }}>
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#bfa46f" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><rect x="4.5" y="10.5" width="15" height="10" rx="2.2" /><path d="M8 10.5V7a4 4 0 0 1 7.7-1.8" /></svg>unlocked
                          </span>
                        )}
                      </div>

                      <div style={{ fontFamily: '"Bricolage Grotesque",sans-serif', fontWeight: 700, fontSize: 15, lineHeight: 1.12, color: dim ? "#7c7468" : "#352f27", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{q.skill}</div>
                      <div style={{ margin: "4px 0 0", fontSize: 11.5, lineHeight: 1.35, color: dim ? "#9a9183" : "#6b6356", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{q.aim}</div>
                      <div style={{ flex: 1 }} />
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginTop: 9 }}>
                        <span style={{ display: "inline-flex", alignItems: "center", gap: 5, whiteSpace: "nowrap", background: m.pillBg, color: m.pillTx, border: "1px solid " + m.pillBd, borderRadius: 999, padding: "3px 9px", fontSize: 10.5, fontWeight: 700 }}>{m.label}</span>
                        <span style={{ ...mono11, fontSize: 10, color: dim ? "#b3aa97" : "#a59c8c", whiteSpace: "nowrap" }}>{dateText}</span>
                      </div>
                      {isDone && (
                        <button onClick={(e) => { e.stopPropagation(); addQuestToBinder(q.id); }} style={{
                          marginTop: 10, width: "100%", boxSizing: "border-box", background: "#8f9b3e", color: "#fffdf7", border: "none",
                          borderRadius: 10, padding: "8px 10px", fontFamily: '"Hanken Grotesk",sans-serif', fontWeight: 700, fontSize: 12.5,
                          cursor: "pointer", boxShadow: "0 4px 12px rgba(94,107,40,.22)",
                        }}>+ Add as card to binder</button>
                      )}
                    </div>
                  </React.Fragment>
                );
              })}

              {/* start flag */}
              <div style={{ position: "absolute", left: startPt.x - 22, top: startPt.y - 22, width: 44, height: 44, borderRadius: "50%", background: "#fffdf7", border: "2px solid #e3b04a", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 4, boxShadow: "0 4px 10px rgba(58,52,43,.16)" }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#c9842f" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M5 21V4" /><path d="M5 4h11l-2 4 2 4H5" /></svg>
              </div>
              {/* mastery star */}
              <div style={{ position: "absolute", left: starPt.x - 24, top: starPt.y - 24, width: 48, height: 48, borderRadius: "50%", background: allDone ? "#e3b04a" : "#fffdf7", border: "2px solid #e3b04a", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 4, boxShadow: "0 4px 12px rgba(58,52,43,.18)" }}>
                <svg width="22" height="22" viewBox="0 0 24 24" stroke="#e3b04a" strokeWidth={1.6} strokeLinejoin="round" style={{ fill: allDone ? "#fffdf7" : "none" }}><path d="M12 3l2.6 5.6 6.1.7-4.5 4.2 1.2 6L12 16.9 6.6 19.5l1.2-6L3.3 9.3l6.1-.7z" /></svg>
              </div>
              {/* annotations */}
              <div style={{ position: "absolute", left: startPt.x - 8, top: anchorY + 26, fontFamily: '"Caveat",cursive', fontSize: 20, color: "#bb8b4e", whiteSpace: "nowrap", zIndex: 2 }}>start here</div>
              <div style={{ position: "absolute", left: starPt.x - 36, top: anchorY + 26, fontFamily: '"Caveat",cursive', fontSize: 20, color: "#bb8b4e", whiteSpace: "nowrap", zIndex: 2 }}>Complete</div>
            </div>
          </div>

          {/* LEGEND */}
          <div style={{ display: "flex", flexWrap: "wrap", gap: 18, alignItems: "center", marginTop: 14, padding: "0 4px", fontSize: 12.5, color: "#857c6c" }}>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 7 }}>
              <span style={{ width: 18, height: 18, borderRadius: "50%", background: "#8f9b3e", display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={3.6} strokeLinecap="round" strokeLinejoin="round"><path d="M5 12.5l4.5 4.5L19 7" /></svg>
              </span>Completed</span>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 7 }}><span style={{ width: 18, height: 18, borderRadius: "50%", background: "#fffdf7", border: "2.5px solid #e6b422" }} />In progress</span>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 7 }}><span style={{ width: 18, height: 18, borderRadius: "50%", background: "#fffdf7", border: "2px dashed #cbc2af" }} />Not started</span>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 7 }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="#e3b04a" stroke="#e3b04a" strokeWidth={1.4} strokeLinejoin="round"><path d="M12 3l2.6 5.6 6.1.7-4.5 4.2 1.2 6L12 16.9 6.6 19.5l1.2-6L3.3 9.3l6.1-.7z" /></svg>Milestone</span>
          </div>
        </>
      ) : (
        <div style={{ background: "#fbf7ec", border: "1.5px dashed #e2d8c2", borderRadius: 18, padding: "56px 24px", textAlign: "center" }}>
          <div style={{ fontFamily: '"Bricolage Grotesque",sans-serif', fontWeight: 700, fontSize: 18, color: "#6b6356", marginBottom: 4 }}>Your journey starts here</div>
          <div style={{ fontSize: 14, color: "#a59c8c" }}>Set a goal with a finish-by date and it lands on the path as a locked card. Earn it to light it up.</div>
        </div>
      )}

      {/* COMPLETE QUEST MODAL */}
      {completingQ && (
        <div onClick={() => { setCompletingId(null); setLog({ win: "" }); }}
          style={{ position: "fixed", inset: 0, background: "rgba(46,41,33,.5)", backdropFilter: "blur(3px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 24, zIndex: 55 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ width: "100%", maxWidth: 560, background: "#fbf7ec", border: "1.5px solid #e6dcc6", borderRadius: 22, padding: "26px 26px 24px", boxShadow: "0 20px 60px rgba(58,52,43,.3)", maxHeight: "88vh", overflow: "auto" }}>
            <div style={{ fontFamily: '"Caveat",cursive', fontSize: 23, color: "#bb8b4e", lineHeight: 1, marginBottom: 2 }}>you did it</div>
            <h3 style={{ fontFamily: '"Bricolage Grotesque",sans-serif', fontWeight: 800, fontSize: 24, margin: "0 0 4px", color: "#352f27" }}>Log: {completingQ.skill}</h3>
            <p style={{ margin: "0 0 18px", fontSize: 14, color: "#857c6c" }}>Write down how it actually went. This becomes the front of your new card.</p>
            <div style={{ ...mono11, fontSize: 11, letterSpacing: 1, textTransform: "uppercase", color: "#a59c8c", marginBottom: 8 }}>The win</div>
            <textarea value={log.win} onChange={(e) => setLog({ ...log, win: e.target.value })} placeholder="What did you pull off?"
              style={{ width: "100%", boxSizing: "border-box", minHeight: 84, resize: "vertical", background: "#fffdf7", border: "1.5px solid #e6dcc6", borderRadius: 12, padding: "12px 14px", fontFamily: '"Hanken Grotesk",sans-serif', fontSize: 15, lineHeight: 1.5, color: "#3a342b", outline: "none", marginBottom: 20 }} />
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", flexWrap: "wrap" }}>
              <button onClick={() => { setCompletingId(null); setLog({ win: "" }); }} style={{ background: "#fbf7ec", color: "#6b6356", border: "1.5px solid #e2d8c2", borderRadius: 12, padding: "13px 20px", fontFamily: '"Hanken Grotesk",sans-serif', fontWeight: 600, fontSize: 15, cursor: "pointer" }}>Not yet</button>
              <button onClick={completeChallenge} style={{ background: "#3a342b", color: "#fdf7e8", border: "none", borderRadius: 12, padding: "13px 22px", fontFamily: '"Hanken Grotesk",sans-serif', fontWeight: 700, fontSize: 15, cursor: "pointer" }}>Complete quest ✓</button>
            </div>
          </div>
        </div>
      )}

      {/* TOAST */}
      {toast && (
        <div style={{ position: "fixed", bottom: 26, left: "50%", transform: "translateX(-50%)", background: "#3a342b", color: "#fdf7e8", padding: "11px 20px", borderRadius: 999, fontSize: 14, fontWeight: 600, boxShadow: "0 10px 30px rgba(58,52,43,.3)", zIndex: 60 }}>{toast}</div>
      )}
    </section>
  );
}
