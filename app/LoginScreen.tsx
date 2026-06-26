"use client";
import React, { useState } from "react";

// The auth gate: email + password, with a Sign in / Sign up toggle.
// Sign-in is pre-filled for the demo user (Sofi); switching to Sign up clears it
// so you can make a fresh account.
export default function LoginScreen({
  configured,
  error,
  notice,
  onSignIn,
  onSignUp,
}: {
  configured: boolean;
  error?: string | null;
  notice?: string | null;
  onSignIn: (email: string, password: string) => void;
  onSignUp: (email: string, password: string) => void;
}) {
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("sofi@journeydex.app");
  const [password, setPassword] = useState("password");

  const switchMode = (m: "signin" | "signup") => {
    setMode(m);
    if (m === "signup") {
      setEmail("");
      setPassword("");
    } else {
      setEmail("sofi@journeydex.app");
      setPassword("password");
    }
  };

  const field: React.CSSProperties = {
    width: "100%",
    boxSizing: "border-box",
    background: "#fbf7ec",
    border: "1.5px solid #e6dcc6",
    borderRadius: "12px",
    padding: "12px 14px",
    fontFamily: "'Hanken Grotesk',sans-serif",
    fontSize: "15px",
    color: "#3a342b",
    outline: "none",
    marginBottom: "12px",
  };

  const signup = mode === "signup";

  return (
    <div
      style={{
        minHeight: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "24px",
        background: "#f3eddf",
        backgroundImage: "radial-gradient(#e7dec9 0.8px, transparent 0.8px)",
        backgroundSize: "22px 22px",
        fontFamily: "'Hanken Grotesk',system-ui,sans-serif",
        color: "#3a342b",
        boxSizing: "border-box",
      }}
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!configured) return;
          if (signup) onSignUp(email.trim(), password);
          else onSignIn(email.trim(), password);
        }}
        style={{
          width: "100%",
          maxWidth: "420px",
          background: "#fffdf7",
          border: "1.5px solid #e9dfca",
          borderRadius: "22px",
          padding: "38px 32px",
          boxShadow: "0 18px 50px rgba(58,52,43,.14)",
          textAlign: "center",
        }}
      >
        <div style={{ fontFamily: "'Caveat',cursive", fontSize: "22px", color: "#bb8b4e", lineHeight: 1, marginBottom: "4px" }}>
          a binder of small wins
        </div>
        <h1 style={{ fontFamily: "'Bricolage Grotesque',sans-serif", fontWeight: 800, fontSize: "34px", letterSpacing: "-.5px", margin: "0 0 8px", color: "#352f27" }}>
          JourneyDex
        </h1>
        <p style={{ fontSize: "14.5px", color: "#857c6c", margin: "0 0 26px", lineHeight: 1.5 }}>
          {signup ? "Create your binder — it takes a second." : "Sign in to open your binder."}
        </p>

        {configured ? (
          <>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="email"
              autoComplete="username"
              style={field}
            />
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={signup ? "choose a password" : "password"}
              autoComplete={signup ? "new-password" : "current-password"}
              style={field}
            />
            {error && (
              <div style={{ color: "#b0564a", fontSize: "13px", fontWeight: 600, margin: "2px 0 12px", textAlign: "left" }}>
                {error}
              </div>
            )}
            {notice && !error && (
              <div style={{ color: "#5f7320", background: "#eef3dc", border: "1.5px solid #d4e0b0", borderRadius: "10px", fontSize: "13px", fontWeight: 600, padding: "10px 12px", margin: "2px 0 12px", textAlign: "left" }}>
                {notice}
              </div>
            )}
            <button
              type="submit"
              style={{
                width: "100%",
                background: "#3a342b",
                color: "#fdf7e8",
                border: "none",
                borderRadius: "12px",
                padding: "13px",
                fontFamily: "'Hanken Grotesk',sans-serif",
                fontWeight: 700,
                fontSize: "15px",
                cursor: "pointer",
                boxShadow: "0 8px 22px rgba(58,52,43,.18)",
              }}
            >
              {signup ? "Create account" : "Sign in"}
            </button>

            <div style={{ marginTop: "18px", fontSize: "13.5px", color: "#857c6c" }}>
              {signup ? "Already have an account?" : "New here?"}{" "}
              <button
                type="button"
                onClick={() => switchMode(signup ? "signin" : "signup")}
                style={{ background: "none", border: "none", padding: 0, color: "#9a7b1f", fontWeight: 700, fontSize: "13.5px", cursor: "pointer", fontFamily: "'Hanken Grotesk',sans-serif", textDecoration: "underline" }}
              >
                {signup ? "Sign in" : "Create an account"}
              </button>
            </div>
          </>
        ) : (
          <div
            style={{
              background: "#fdeee4",
              border: "1.5px solid #f0c9ad",
              borderRadius: "12px",
              padding: "16px 18px",
              fontSize: "13.5px",
              lineHeight: 1.55,
              color: "#9a5a32",
              textAlign: "left",
            }}
          >
            <strong>Supabase isn&apos;t configured.</strong> Paste your project URL + anon key into{" "}
            <code>.env.local</code> and restart the dev server. See <code>SUPABASE_SETUP.md</code>.
          </div>
        )}
      </form>
    </div>
  );
}
