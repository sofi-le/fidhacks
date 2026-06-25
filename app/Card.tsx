"use client";
import React from "react";
import type { UiCard } from "./lib/api";

const TYPES: Record<
  string,
  { label: string; mono: string; fill: string; soft: string; deep: string; ink: string }
> = {
  academic: { label: "Academic", mono: "Ac", fill: "#cfe4f6", soft: "#eaf3fb", deep: "#3f86bd", ink: "#235b86" },
  technical: { label: "Technical", mono: "Te", fill: "#e2d6f4", soft: "#f1ebfb", deep: "#7d5fc0", ink: "#553a91" },
  social: { label: "Social", mono: "So", fill: "#fad7c2", soft: "#fdeee4", deep: "#d6814f", ink: "#a4592b" },
  hobbies: { label: "Hobbies", mono: "Ho", fill: "#cdecdc", soft: "#e6f6ee", deep: "#46a583", ink: "#2c7a5e" },
  financial: { label: "Financial", mono: "Fi", fill: "#f4e7b4", soft: "#fbf4d7", deep: "#bb9a35", ink: "#856c14" },
};

const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export default function Card({
  card,
  size = "sm",
}: {
  card: Partial<UiCard>;
  size?: "sm" | "lg";
}) {
  const c = card || {};
  const t = TYPES[c.type as string] || TYPES.academic;
  const s = size === "lg";
  const W = s ? 268 : 170;
  const pad = s ? 13 : 9;
  const rad = s ? 18 : 13;
  const gap = s ? 9 : 6;
  const artH = s ? 156 : 94;

  const frameStyle: React.CSSProperties = {
    width: W + "px",
    boxSizing: "border-box",
    background: t.soft,
    border: "2px solid " + t.deep,
    borderRadius: rad + "px",
    padding: pad + "px",
    display: "flex",
    flexDirection: "column",
    gap: gap + "px",
    position: "relative",
    boxShadow: "0 6px 16px rgba(58,52,43,.12)",
    fontFamily: '"Hanken Grotesk", system-ui, sans-serif',
    color: "#3a342b",
  };
  const bannerStyle: React.CSSProperties = {
    display: "flex",
    alignItems: "center",
    gap: "6px",
    background: t.fill,
    color: t.ink,
    borderRadius: rad - 5 + "px",
    padding: s ? "6px 10px" : "4px 8px",
    fontFamily: '"Bricolage Grotesque", sans-serif',
    fontWeight: 700,
    fontSize: (s ? 13 : 10.5) + "px",
    letterSpacing: ".2px",
  };
  const monoStyle: React.CSSProperties = {
    width: (s ? 22 : 18) + "px",
    height: (s ? 22 : 18) + "px",
    borderRadius: "50%",
    background: t.deep,
    color: "#fff",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: (s ? 10 : 8.5) + "px",
    fontWeight: 700,
    flex: "0 0 auto",
  };
  const artStyle: React.CSSProperties = {
    height: artH + "px",
    borderRadius: rad - 6 + "px",
    background:
      "repeating-linear-gradient(45deg, " + t.fill + ", " + t.fill + " 7px, " + t.soft + " 7px, " + t.soft + " 14px)",
    border: "1px dashed " + t.deep + "7a",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  };
  const artLabelStyle: React.CSSProperties = {
    fontFamily: '"Space Mono", monospace',
    fontSize: (s ? 11 : 9) + "px",
    color: t.ink,
    opacity: 0.55,
    background: "rgba(255,253,247,.8)",
    padding: "2px 7px",
    borderRadius: "4px",
    letterSpacing: ".5px",
  };
  const nameStyle: React.CSSProperties = {
    fontFamily: '"Bricolage Grotesque", sans-serif',
    fontWeight: 700,
    fontSize: (s ? 20 : 14) + "px",
    lineHeight: 1.12,
    color: "#352f27",
  };
  const winStyle: React.CSSProperties = {
    fontSize: (s ? 13.5 : 10.5) + "px",
    lineHeight: 1.35,
    color: "#6b6356",
    display: s ? "block" : "-webkit-box",
    WebkitLineClamp: s ? ("none" as unknown as number) : 2,
    WebkitBoxOrient: "vertical",
    overflow: "hidden",
  };
  const overcameStyle: React.CSSProperties = {
    fontSize: "12.5px",
    lineHeight: 1.4,
    color: "#8a8275",
    fontStyle: "italic",
    borderLeft: "2px solid " + t.deep,
    paddingLeft: "8px",
    marginTop: "2px",
  };
  const footerStyle: React.CSSProperties = {
    marginTop: "auto",
    paddingTop: (s ? 4 : 2) + "px",
    textAlign: "right",
    fontFamily: '"Space Mono", monospace',
    fontSize: (s ? 11 : 9) + "px",
    color: "#a59c8c",
  };

  const parts = (c.date || "2026-06-01").split("-");
  const date = MON[+parts[1] - 1] + " " + +parts[2];
  const showOvercame = !!(s && c.overcame);

  return (
    <div style={frameStyle}>
      <div style={bannerStyle}>
        <span style={monoStyle}>{t.mono}</span>
        <span style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{t.label}</span>
      </div>
      <div style={artStyle}>
        <span style={artLabelStyle}>card art</span>
      </div>
      <div style={nameStyle}>{c.skill || ""}</div>
      <div style={winStyle}>{c.win || ""}</div>
      {showOvercame && <div style={overcameStyle}>{"Overcame — " + (c.overcame || "")}</div>}
      <div style={footerStyle}>{date}</div>
    </div>
  );
}
