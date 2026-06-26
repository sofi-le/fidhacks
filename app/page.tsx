"use client";
import React from "react";
import Card from "./Card";
import QuestJourney from "./QuestJourney";
import PackReveal from "./PackReveal";
import { BalanceScreen, ShareScreen } from "./BalanceAndShare";
import MemoryScreen from "./Memory";
import {
  getCards,
  extractCard,
  deleteCardApi,
  updateCardApi,
  createCard,
  uploadCardImage,
  seedSampleCardsIfEmpty,
  suggestTitle,
  getProfile,
  getReflections,
  NewCardInput,
  UiCard,
  Profile,
  Reflection,
  TYPE_LABEL,
} from "./lib/api";
import { supabase, hasSupabaseConfig } from "./lib/supabase";
import LoginScreen from "./LoginScreen";

const TYPES: Record<string, { label: string; fill: string; deep: string; ink: string }> = {
  academic:            { label: "Academic",          fill: "#cfe4f6", deep: "#3f86bd", ink: "#235b86" },
  career:              { label: "Career",            fill: "#e2d6f4", deep: "#7d5fc0", ink: "#553a91" },
  hobbies:             { label: "Hobbies",           fill: "#cdecdc", deep: "#46a583", ink: "#2c7a5e" },
  "social & family":   { label: "Social & Family",   fill: "#fad7c2", deep: "#d6814f", ink: "#a4592b" },
  financial:           { label: "Financial",         fill: "#f4e7b4", deep: "#bb9a35", ink: "#856c14" },
  "health & wellness": { label: "Health & Wellness", fill: "#d4f0e0", deep: "#3aaa6a", ink: "#1f7a48" },
};
const TYPE_ORDER = ["academic", "career", "hobbies", "social & family", "financial", "health & wellness"];

const FAV_KEY = "pos_favorites";
function loadFavs(): string[] {
  try {
    return JSON.parse(localStorage.getItem(FAV_KEY) || "[]") || [];
  } catch {
    return [];
  }
}
function saveFavs(f: string[]) {
  try {
    localStorage.setItem(FAV_KEY, JSON.stringify(f));
  } catch {}
}

type S = {
  view: string;
  filter: string;
  sortDir: string;
  spread: number;
  turning: string | null;
  selectedId: string | null;
  showToast: boolean;
  toastText: string;
  favorites: string[];
  fitScale: number;
  fitH: number;
  pageInput: string | null;
  cards: UiCard[];
  addTitle: string;
  addType: string;
  addText: string;
  addImage: string | undefined; // optional art for the card being added (data URL)
  recording: boolean;
  summarizing: boolean;
  suggestingTitle: boolean;
  revealCard: UiCard | null; // the freshly-minted card shown in the pack-open animation
  editing: boolean;
  editSkill: string;
  editWin: string;
  editType: string;
  savingEdit: boolean;
  // Auth + profile (Supabase). authReady gates the first render; user is null
  // until signed in; profile holds the display name + avatar for the header/share.
  authReady: boolean;
  user: { id: string; email?: string } | null;
  profile: Profile | null;
  authError: string | null;
  authNotice: string | null;
  // Memory tab — state lifted here so it survives tab switches (only the
  // "Reflect again" button refetches; revisiting the tab does not).
  memory: Reflection[];
  memoryLoading: boolean;
  memoryError: boolean;
  memoryLoaded: boolean;
};

// Minimal shape of the Web Speech API we use (it isn't in the TS DOM lib reliably).
type SpeechRecog = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  start: () => void;
  stop: () => void;
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onend: (() => void) | null;
  onerror: ((ev: { error?: string }) => void) | null;
};
type SpeechWindow = Window & {
  SpeechRecognition?: { new (): SpeechRecog };
  webkitSpeechRecognition?: { new (): SpeechRecog };
};

export default class JourneyDex extends React.Component<unknown, S> {
  bookRef = React.createRef<HTMLDivElement>();
  fitOuterRef = React.createRef<HTMLDivElement>();
  rootRef = React.createRef<HTMLDivElement>();
  fileInputRef = React.createRef<HTMLInputElement>();
  _recog: SpeechRecog | null = null;
  _baseText = "";
  _ft: ReturnType<typeof setTimeout> | null = null;
  _tt: ReturnType<typeof setTimeout> | null = null;
  _onResize: () => void = () => {};
  _fitTimers: ReturnType<typeof setTimeout>[] = [];

  state: S = {
    view: "binder",
    filter: "all",
    sortDir: "desc",
    spread: 0,
    turning: null,
    selectedId: null,
    showToast: false,
    toastText: "",
    favorites: [],
    fitScale: 1,
    fitH: 520,
    pageInput: null,
    cards: [],
    addTitle: "",
    addType: "career",
    addText: "",
    addImage: undefined,
    recording: false,
    summarizing: false,
    suggestingTitle: false,
    revealCard: null,
    editing: false,
    editSkill: "",
    editWin: "",
    editType: "career",
    savingEdit: false,
    authReady: false,
    user: null,
    profile: null,
    authError: null,
    authNotice: null,
    memory: [],
    memoryLoading: false,
    memoryError: false,
    memoryLoaded: false,
  };

  _authSub: { unsubscribe: () => void } | null = null;
  _initedFor: string | null = null;

  async loadCards() {
    try {
      // Cards (with their image_url) come straight from Supabase, scoped to the
      // signed-in user by Row-Level Security.
      const cards = await getCards();
      this.setState({ cards });
    } catch (err) {
      console.error(err);
      this.fireToast("Couldn't load your cards — check your Supabase config.");
    }
  }

  // --- auth ----------------------------------------------------------------

  handleSession(session: { user: { id: string; email?: string } } | null, evt?: string) {
    const user = session?.user ?? null;
    this.setState({ authReady: true, user });
    if (user) {
      if (this._initedFor !== user.id) {
        this._initedFor = user.id;
        this.initSession(evt === "SIGNED_UP");
      }
    } else {
      this._initedFor = null;
      this.setState({ cards: [], profile: null });
    }
  }

  // First-run setup once signed in. Only seeds sample cards on SIGNED_UP so
  // returning users don't get re-seeded on every login.
  async initSession(isNewUser = false) {
    if (isNewUser) {
      try {
        await seedSampleCardsIfEmpty();
      } catch (err) {
        console.error("[seed]", err);
      }
    }
    await this.loadCards();
    try {
      this.setState({ profile: await getProfile() });
    } catch (err) {
      console.error("[profile]", err);
    }
  }

  signInWithPassword = async (email: string, password: string) => {
    this.setState({ authError: null, authNotice: null });
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) this.setState({ authError: error.message });
  };

  signUpWithPassword = async (email: string, password: string) => {
    this.setState({ authError: null, authNotice: null });
    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) {
      this.setState({ authError: error.message });
      return;
    }
    // With email confirmation OFF, a session comes back and onAuthStateChange
    // signs them straight in. With it ON, there's no session yet.
    if (!data.session) {
      this.setState({ authNotice: "Account created — check your email to confirm, then sign in." });
    }
  };

  signOut = async () => {
    await supabase.auth.signOut();
  };

  // Generate the Memory reflections. Called once on first open of the tab and
  // again whenever the user taps "Reflect again" — never on plain tab revisits.
  loadMemory = async () => {
    if (this.state.memoryLoading) return;
    this.setState({ memoryLoading: true, memoryError: false });
    try {
      const memory = await getReflections();
      this.setState({ memory, memoryLoaded: true, memoryLoading: false });
    } catch (err) {
      console.error("[memory]", err);
      this.setState({ memoryError: true, memoryLoading: false });
    }
  };

  async deleteCard(id: string) {
    try {
      await deleteCardApi(id);
    } catch {}
    this.setState((st) => ({ cards: st.cards.filter((c) => c.id !== id), selectedId: null, editing: false }));
  }

  // A completed quest is minted into the binder: persist it (verbatim, no AI
  // rewrite), refresh the binder, and jump to it.
  async addQuestToBinder(card: NewCardInput) {
    try {
      const created = await createCard(card);
      await this.loadCards();
      this.setState({ revealCard: created });
    } catch {
      this.fireToast("Couldn't add to binder — backend offline?");
    }
  }

  // Drop into edit mode for the selected card, seeding the draft fields from it.
  startEdit(card: UiCard) {
    this.setState({
      editing: true,
      editSkill: card.skill,
      editWin: card.win,
      editType: card.type,
    });
  }

  cancelEdit() {
    this.setState({ editing: false });
  }

  // Read a picked image file and downscale it on a canvas (keeps the data URL
  // small). Resolves to a JPEG data URL. Card art is client-side only.
  downscaleImage(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      if (!file.type.startsWith("image/")) return reject(new Error("not an image"));
      const reader = new FileReader();
      reader.onload = () => {
        const img = new Image();
        img.onload = () => {
          const MAX = 800;
          const scale = Math.min(1, MAX / Math.max(img.width, img.height));
          const w = Math.round(img.width * scale);
          const h = Math.round(img.height * scale);
          const canvas = document.createElement("canvas");
          canvas.width = w;
          canvas.height = h;
          const ctx = canvas.getContext("2d");
          if (!ctx) return resolve(reader.result as string);
          ctx.drawImage(img, 0, 0, w, h);
          resolve(canvas.toDataURL("image/jpeg", 0.85));
        };
        img.onerror = () => reject(new Error("decode failed"));
        img.src = reader.result as string;
      };
      reader.onerror = () => reject(new Error("read failed"));
      reader.readAsDataURL(file);
    });
  }

  // Upload a card's art to Supabase Storage and reflect it on the card. Shows the
  // local preview immediately, then swaps in the stored (public) URL once saved.
  async storeCardImage(id: string, dataUrl: string) {
    this.setState((st) => ({ cards: st.cards.map((c) => (c.id === id ? { ...c, imageUrl: dataUrl } : c)) }));
    try {
      const url = await uploadCardImage(id, dataUrl);
      this.setState((st) => ({ cards: st.cards.map((c) => (c.id === id ? { ...c, imageUrl: url } : c)) }));
    } catch (err) {
      console.error("[image]", err);
      this.fireToast("Couldn't save the image");
    }
  }

  // Tap a card's art in the detail modal -> set/replace its image.
  handleImagePick(id: string, file: File | undefined) {
    if (!file) return;
    this.downscaleImage(file).then(
      (dataUrl) => {
        this.storeCardImage(id, dataUrl);
        this.fireToast("Image added ✓");
      },
      () => this.fireToast("Couldn't read that image")
    );
  }

  // Pick art while composing a new card (before it has an id).
  pickAddImage(file: File | undefined) {
    if (!file) return;
    this.downscaleImage(file).then(
      (dataUrl) => this.setState({ addImage: dataUrl }),
      () => this.fireToast("Couldn't read that image")
    );
  }

  async saveEdit() {
    const id = this.state.selectedId;
    if (!id || this.state.savingEdit) return;
    const skill = this.state.editSkill.trim();
    const win = this.state.editWin.trim();
    if (!skill) {
      this.fireToast("Give the card a title");
      return;
    }
    if (!win) {
      this.fireToast("Add a description");
      return;
    }
    this.setState({ savingEdit: true });
    try {
      const updated = await updateCardApi(id, {
        skill,
        win,
        type: TYPE_LABEL[this.state.editType] || "Career",
      });
      this.setState((st) => ({
        cards: st.cards.map((c) => (c.id === id ? updated : c)),
        editing: false,
        savingEdit: false,
      }));
      this.fireToast("Card updated ✓");
    } catch {
      this.setState({ savingEdit: false });
      this.fireToast("Couldn't save — backend offline?");
    }
  }

  toggleRecord() {
    if (this.state.recording) {
      try {
        if (this._recog) this._recog.stop();
      } catch {}
      return;
    }
    const w = window as SpeechWindow;
    const SR = w.SpeechRecognition || w.webkitSpeechRecognition;
    if (!SR) {
      this.fireToast("Voice input not supported here — type your win");
      return;
    }
    try {
      const r = new SR();
      r.lang = "en-US";
      r.interimResults = true;
      r.continuous = true;
      this._baseText = this.state.addText ? this.state.addText.trim() + " " : "";
      r.onresult = (e) => {
        let txt = "";
        for (let i = 0; i < e.results.length; i++) txt += e.results[i][0].transcript;
        this.setState({ addText: this._baseText + txt });
      };
      r.onend = () => {
        this._recog = null;
        this.setState({ recording: false });
      };
      r.onerror = (ev) => {
        this._recog = null;
        this.setState({ recording: false });
        if (ev && (ev.error === "not-allowed" || ev.error === "service-not-allowed"))
          this.fireToast("Mic blocked — type your win instead");
      };
      this._recog = r;
      this.setState({ recording: true });
      r.start();
    } catch {
      this.setState({ recording: false });
      this.fireToast("Mic unavailable — type your win");
    }
  }

  // "✨ Title" button: ask the AI for a title based on the description (no card created).
  suggestTitleNow = async () => {
    const text = (this.state.addText || "").trim();
    if (!text) {
      this.fireToast("Add a description first");
      return;
    }
    if (this.state.suggestingTitle) return;
    this.setState({ suggestingTitle: true });
    try {
      const skill = await suggestTitle(text);
      this.setState({ addTitle: skill || this.state.addTitle, suggestingTitle: false });
      this.fireToast("Title suggested ✓");
    } catch {
      this.setState({ suggestingTitle: false });
      this.fireToast("Couldn't suggest a title");
    }
  };

  async submitAdd() {
    const title = (this.state.addTitle || "").trim();
    const text = (this.state.addText || "").trim();
    if (!title) {
      this.fireToast("Give your win a name");
      return;
    }
    if (!text) {
      this.fireToast("Add a few words about your win");
      return;
    }
    if (this.state.recording) {
      try {
        if (this._recog) this._recog.stop();
      } catch {}
    }
    const img = this.state.addImage;
    this.setState({ summarizing: true });
    try {
      // The AI server summarizes the description into the win; the user's typed
      // title + selected type are sent as overrides so they're used verbatim.
      const card = await extractCard(text, { skill: title, type: this.state.addType });
      // Upload the chosen art to Supabase Storage (keyed by the new card's id).
      let finalCard = card;
      if (img) {
        try {
          const url = await uploadCardImage(card.id, img);
          finalCard = { ...card, imageUrl: url };
        } catch (err) {
          console.error("[image]", err);
        }
      }
      await this.loadCards();
      this.setState({
        revealCard: finalCard,
        addTitle: "",
        addText: "",
        addImage: undefined,
        recording: false,
        summarizing: false,
      });
    } catch (err) {
      console.error(err);
      this.setState({ summarizing: false });
      this.fireToast("Couldn't add the card — is the AI server running?");
    }
  }

  componentDidMount() {
    this.setState({ favorites: loadFavs() });
    // Auth: react to sign-in/out (incl. the Google OAuth redirect on load).
    this._authSub = supabase.auth.onAuthStateChange((evt, session) => this.handleSession(session, evt)).data.subscription;
    supabase.auth.getSession().then(({ data }) => this.handleSession(data.session));
    this._onResize = () => this.computeFit();
    window.addEventListener("resize", this._onResize);
    this.scheduleFit();
    this._fitTimers = [120, 450, 1000].map((ms) => setTimeout(() => this.computeFit(), ms));
  }
  componentWillUnmount() {
    window.removeEventListener("resize", this._onResize);
    (this._fitTimers || []).forEach(clearTimeout);
    if (this._ft) clearTimeout(this._ft);
    if (this._authSub) this._authSub.unsubscribe();
    try {
      if (this._recog) this._recog.stop();
    } catch {}
  }
  componentDidUpdate(_prevProps: unknown, prevState: S) {
    if (prevState && prevState.view !== "binder" && this.state.view === "binder") {
      this.scheduleFit();
      setTimeout(() => this.computeFit(), 300);
    }
  }
  scheduleFit() {
    requestAnimationFrame(() => this.computeFit());
  }
  computeFit() {
    const outer = this.fitOuterRef.current;
    if (!outer) return;
    const NAT_W = 841,
      NAT_H = 611;
    const availW = outer.clientWidth - 2;
    const top = outer.getBoundingClientRect().top;
    const availH = window.innerHeight - top - 22;
    let s = Math.min(availW / NAT_W, availH / NAT_H, 1.18);
    if (!isFinite(s) || s <= 0) s = 1;
    s = Math.max(0.4, s);
    const fitH = Math.round(NAT_H * s);
    if (Math.abs(s - this.state.fitScale) > 0.004 || Math.abs(fitH - this.state.fitH) > 1) {
      this.setState({ fitScale: s, fitH });
    }
  }

  flip(dir: string, spread: number, totalSpreads: number) {
    if (this.state.turning) return;
    if (dir === "next" && spread >= totalSpreads - 1) return;
    if (dir === "prev" && spread <= 0) return;
    this.setState({ turning: dir });
    if (this._ft) clearTimeout(this._ft);
    this._ft = setTimeout(() => {
      this.setState({ spread: spread + (dir === "next" ? 1 : -1), turning: null, pageInput: null });
    }, 470);
  }

  toggleFavId(id: string) {
    const set = new Set(this.state.favorites);
    if (set.has(id)) set.delete(id);
    else set.add(id);
    const arr = [...set];
    saveFavs(arr);
    this.setState({ favorites: arr });
  }

  fireToast(text: string) {
    if (this._tt) clearTimeout(this._tt);
    this.setState({ showToast: true, toastText: text });
    this._tt = setTimeout(() => this.setState({ showToast: false }), 1900);
  }

  tabStyle(active: boolean): React.CSSProperties {
    return {
      border: "none",
      cursor: "pointer",
      borderRadius: "10px",
      padding: "8px 16px",
      fontFamily: '"Hanken Grotesk",sans-serif',
      fontWeight: 600,
      fontSize: "14px",
      background: active ? "#3a342b" : "transparent",
      color: active ? "#fdf7e8" : "#8a8275",
    };
  }

  render() {
    const st = this.state;

    // Auth gate: hold the first paint until we know the session, then show
    // either the Google login screen or the app.
    if (!st.authReady) {
      return (
        <div style={{ minHeight: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: "#f3eddf", color: "#8a7a5c", fontFamily: "'Hanken Grotesk',sans-serif", fontWeight: 600 }}>
          Loading…
        </div>
      );
    }
    if (!st.user) {
      return (
        <LoginScreen
          configured={hasSupabaseConfig}
          error={st.authError}
          notice={st.authNotice}
          onSignIn={this.signInWithPassword}
          onSignUp={this.signUpWithPassword}
        />
      );
    }

    const displayName = st.profile?.displayName || st.user.email || "You";
    const initials =
      displayName.trim().split(/\s+/).map((w) => w[0]).slice(0, 2).join("").toUpperCase() || "Y";

    const tabStyle = (a: boolean) => this.tabStyle(a);
    const tabs = [
      ["binder", "Binder"],
      ["quests", "Quests"],
      ["balance", "Stats"],
      ["memory", "Memory"],
      ["share", "Share"],
      ["add", "+ Add win"],
    ].map(([k, label]) => ({ k, label, style: tabStyle(st.view === k) }));

    const ALL = st.cards;
    const favSet = new Set(st.favorites);

    const chipStyle = (active: boolean, type: string | null): React.CSSProperties => ({
      border: "1.5px solid " + (active ? (type ? TYPES[type].deep : "#3a342b") : "#e2d8c2"),
      background: active ? (type ? TYPES[type].fill : "#3a342b") : "#fbf7ec",
      color: active ? (type ? TYPES[type].ink : "#fdf7e8") : "#8a8275",
      cursor: "pointer",
      borderRadius: "999px",
      padding: "6px 13px",
      fontFamily: '"Hanken Grotesk",sans-serif',
      fontWeight: 600,
      fontSize: "13px",
    });
    const favChipStyle = (active: boolean): React.CSSProperties => ({
      border: "1.5px solid " + (active ? "#e6cf73" : "#e2d8c2"),
      background: active ? "#fbf1c9" : "#fbf7ec",
      color: active ? "#9a7b1f" : "#8a8275",
      cursor: "pointer",
      borderRadius: "999px",
      padding: "6px 13px",
      fontFamily: '"Hanken Grotesk",sans-serif',
      fontWeight: 600,
      fontSize: "13px",
    });
    const favCount = st.favorites.length;
    const filterChips = [
      { k: "all", label: "All", style: chipStyle(st.filter === "all", null) },
      { k: "fav", label: "★ Favorites" + (favCount ? " (" + favCount + ")" : ""), style: favChipStyle(st.filter === "fav") },
    ].concat(TYPE_ORDER.map((k) => ({ k, label: TYPES[k].label, style: chipStyle(st.filter === k, k) })));

    let baseCards =
      st.filter === "all"
        ? ALL
        : st.filter === "fav"
        ? ALL.filter((c) => favSet.has(c.id))
        : ALL.filter((c) => c.type === st.filter);
    baseCards = [...baseCards].sort((a, b) =>
      st.sortDir === "desc" ? (a.date < b.date ? 1 : -1) : a.date > b.date ? 1 : -1
    );
    const heartStyle = (fav: boolean): React.CSSProperties => ({
      position: "absolute",
      top: "-9px",
      right: "8px",
      zIndex: 3,
      width: "28px",
      height: "28px",
      borderRadius: "50%",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      cursor: "pointer",
      fontSize: "15px",
      lineHeight: 1,
      padding: 0,
      background: fav ? "#fdf4cf" : "#fffdf7",
      border: "1.5px solid " + (fav ? "#e6cf73" : "#e2d8c2"),
      color: fav ? "#d9a92a" : "#c9c0ae",
      boxShadow: "0 2px 6px rgba(58,52,43,.12)",
    });
    const binderCards = baseCards.map((c) => {
      const fav = favSet.has(c.id);
      return { id: c.id, card: c, heartLabel: fav ? "★" : "☆", heartStyle: heartStyle(fav) };
    });
    const sortBtnStyle: React.CSSProperties = {
      display: "inline-flex",
      alignItems: "center",
      gap: "6px",
      border: "1.5px solid #e2d8c2",
      background: "#fbf7ec",
      color: "#6b6356",
      cursor: "pointer",
      borderRadius: "999px",
      padding: "6px 14px",
      fontFamily: '"Hanken Grotesk",sans-serif',
      fontWeight: 600,
      fontSize: "13px",
      whiteSpace: "nowrap",
    };

    // flipbook pagination
    const PER_PAGE = 4,
      PER_SPREAD = 8;
    const totalPages = Math.max(1, Math.ceil(binderCards.length / PER_PAGE));
    const totalSpreads = Math.max(1, Math.ceil(binderCards.length / PER_SPREAD));
    const spread = Math.min(Math.max(0, st.spread), totalSpreads - 1);
    const base = spread * PER_SPREAD;
    const leftCards = binderCards.slice(base, base + PER_PAGE);
    const rightCards = binderCards.slice(base + PER_PAGE, base + PER_SPREAD);
    const gridStyle: React.CSSProperties = {
      display: "grid",
      gridTemplateColumns: "repeat(2, 172px)",
      gridAutoRows: "236px",
      gap: "18px 16px",
      justifyContent: "center",
      alignContent: "center",
    };
    const leftNo = spread * 2 + 1,
      rightNo = spread * 2 + 2;
    const arrowBtn = (disabled: boolean): React.CSSProperties => ({
      width: "46px",
      height: "46px",
      borderRadius: "50%",
      border: "1.5px solid " + (disabled ? "#ece2cd" : "#d8cbac"),
      background: disabled ? "#f6f1e4" : "#fbf7ec",
      color: disabled ? "#cfc6b3" : "#6b6356",
      fontSize: "20px",
      cursor: disabled ? "default" : "pointer",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      boxShadow: disabled ? "none" : "0 4px 12px rgba(58,52,43,.10)",
    });
    const leaf = st.turning;
    const leafStyle: React.CSSProperties =
      leaf === "next"
        ? {
            position: "absolute",
            top: "11px",
            bottom: "11px",
            right: "11px",
            width: "calc(50% - 12px)",
            transformOrigin: "left center",
            transformStyle: "preserve-3d",
            animation: "leafNext .47s ease forwards",
            background: "linear-gradient(100deg,#fdf9ef,#ece1c9)",
            borderRadius: "3px 9px 9px 3px",
            boxShadow: "0 16px 34px rgba(58,52,43,.24)",
            zIndex: 6,
            backfaceVisibility: "hidden",
          }
        : {
            position: "absolute",
            top: "11px",
            bottom: "11px",
            left: "11px",
            width: "calc(50% - 12px)",
            transformOrigin: "right center",
            transformStyle: "preserve-3d",
            animation: "leafPrev .47s ease forwards",
            background: "linear-gradient(260deg,#fdf9ef,#ece1c9)",
            borderRadius: "9px 3px 3px 9px",
            boxShadow: "0 16px 34px rgba(58,52,43,.24)",
            zIndex: 6,
            backfaceVisibility: "hidden",
          };

    // Balance + Share are self-contained components (./BalanceAndShare) that
    // derive their own counts/charts from the card array.
    const sel = ALL.find((c) => c.id === st.selectedId) || null;

    const pageDisplayValue = st.pageInput != null ? st.pageInput : String(leftNo);
    const pageInputStyle: React.CSSProperties = {
      width: "44px",
      textAlign: "center",
      font: "inherit",
      fontWeight: 700,
      color: "#6b5a3c",
      background: "#fff7e6",
      border: "1.5px solid #e2d3ad",
      borderRadius: "8px",
      padding: "1px 4px",
      outline: "none",
    };

    const micBtnStyle: React.CSSProperties = {
      width: "104px",
      height: "104px",
      borderRadius: "50%",
      cursor: "pointer",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      position: "relative",
      zIndex: 1,
      background: st.recording ? "#dd7d72" : "#fbf3df",
      color: st.recording ? "#fffaf8" : "#bb8b4e",
      border: st.recording ? "2px solid #dd7d72" : "2px solid #ecdcaf",
      boxShadow: st.recording ? "0 12px 28px rgba(221,125,114,.45)" : "0 8px 22px rgba(58,52,43,.12)",
    };
    const addSubmitStyle: React.CSSProperties = {
      width: "100%",
      background: "#3a342b",
      color: "#fdf7e8",
      border: "none",
      borderRadius: "12px",
      padding: "14px",
      fontFamily: '"Hanken Grotesk",sans-serif',
      fontWeight: 700,
      fontSize: "15px",
      cursor: "pointer",
      boxShadow: "0 8px 22px rgba(58,52,43,.18)",
    };
    const ghostBtnStyle: React.CSSProperties = {
      background: "#fbf7ec",
      color: "#6b6356",
      border: "1.5px solid #e2d8c2",
      borderRadius: "12px",
      padding: "13px 20px",
      fontFamily: '"Hanken Grotesk",sans-serif',
      fontWeight: 600,
      fontSize: "15px",
      cursor: "pointer",
    };

    const setView = (e: React.MouseEvent<HTMLButtonElement>) =>
      this.setState({ view: (e.currentTarget as HTMLButtonElement).dataset.k as string });

    return (
      <div
        ref={this.rootRef}
        style={{
          minHeight: "100%",
          background: "#f3eddf",
          backgroundImage: "radial-gradient(#e7dec9 0.8px, transparent 0.8px)",
          backgroundSize: "22px 22px",
          fontFamily: "'Hanken Grotesk',system-ui,sans-serif",
          color: "#3a342b",
          padding: "20px 22px 24px",
          boxSizing: "border-box",
        }}
      >
        <div style={{ maxWidth: "1060px", margin: "0 auto" }}>
          {/* HEADER */}
          <header
            style={{
              display: "flex",
              alignItems: "flex-end",
              justifyContent: "space-between",
              gap: "20px",
              flexWrap: "wrap",
              marginBottom: "14px",
            }}
          >
            <div>
              <h1
                style={{
                  fontFamily: "'Bricolage Grotesque',sans-serif",
                  fontWeight: 800,
                  fontSize: "34px",
                  letterSpacing: "-.5px",
                  margin: 0,
                  color: "#352f27",
                }}
              >
                JourneyDex
              </h1>
            </div>
            <div style={{ display: "flex", gap: "12px", alignItems: "center", flexWrap: "wrap" }}>
              <nav
                style={{
                  display: "flex",
                  gap: "6px",
                  background: "#fbf7ec",
                  border: "1.5px solid #e6dcc6",
                  borderRadius: "14px",
                  padding: "5px",
                  boxShadow: "0 4px 14px rgba(58,52,43,.06)",
                }}
              >
                {tabs.map((tab) => (
                  <button key={tab.k as string} style={tab.style} onClick={setView} data-k={tab.k}>
                    {tab.label}
                  </button>
                ))}
              </nav>
              {/* user chip + sign out */}
              <div style={{ display: "flex", alignItems: "center", gap: "9px", background: "#fbf7ec", border: "1.5px solid #e6dcc6", borderRadius: "14px", padding: "5px 9px 5px 5px", boxShadow: "0 4px 14px rgba(58,52,43,.06)" }}>
                {st.profile?.avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={st.profile.avatarUrl} alt="" referrerPolicy="no-referrer" style={{ width: "30px", height: "30px", borderRadius: "50%", objectFit: "cover" }} />
                ) : (
                  <div style={{ width: "30px", height: "30px", borderRadius: "50%", background: "#3a342b", color: "#fdf7e8", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: "12px", fontFamily: "'Bricolage Grotesque',sans-serif" }}>{initials}</div>
                )}
                <span style={{ fontSize: "13px", fontWeight: 600, color: "#6b6356", maxWidth: "110px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{displayName}</span>
                <button onClick={this.signOut} style={{ border: "none", background: "transparent", cursor: "pointer", color: "#a59c8c", fontSize: "12px", fontWeight: 600, fontFamily: "'Hanken Grotesk',sans-serif" }}>
                  Sign out
                </button>
              </div>
            </div>
          </header>

          {/* BINDER */}
          {st.view === "binder" && (
            <section>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "16px", flexWrap: "wrap", marginBottom: "10px" }}>
                <div style={{ display: "flex", alignItems: "baseline", gap: "10px" }}>
                  <h2 style={{ fontFamily: "'Bricolage Grotesque',sans-serif", fontWeight: 700, fontSize: "21px", margin: 0, color: "#352f27" }}>Your binder</h2>
                  <span style={{ fontFamily: "'Space Mono',monospace", fontSize: "13px", color: "#a59c8c" }}>{binderCards.length} cards</span>
                </div>
                <div style={{ display: "flex", gap: "10px", alignItems: "center", flexWrap: "wrap" }}>
                  <div style={{ display: "flex", gap: "7px", flexWrap: "wrap" }}>
                    {filterChips.map((chip) => (
                      <button key={chip.k} style={chip.style} onClick={(e) => this.setState({ filter: e.currentTarget.dataset.k as string, spread: 0, turning: null, pageInput: null })} data-k={chip.k}>
                        {chip.label}
                      </button>
                    ))}
                  </div>
                  <button style={sortBtnStyle} onClick={() => this.setState({ sortDir: st.sortDir === "desc" ? "asc" : "desc", spread: 0, turning: null, pageInput: null })}>
                    {st.sortDir === "desc" ? "Newest first ↓" : "Oldest first ↑"}
                  </button>
                </div>
              </div>

              {binderCards.length === 0 && (
                <div style={{ background: "#fbf7ec", border: "1.5px dashed #e2d8c2", borderRadius: "18px", padding: "64px 24px", textAlign: "center" }}>
                  <div style={{ fontSize: "30px", color: "#e0708a", marginBottom: "8px" }}>&#9825;</div>
                  <div style={{ fontFamily: "'Bricolage Grotesque',sans-serif", fontWeight: 700, fontSize: "18px", color: "#6b6356", marginBottom: "4px" }}>
                    {st.filter === "fav" ? "No favorites yet" : "No cards yet"}
                  </div>
                  <div style={{ fontSize: "14px", color: "#a59c8c" }}>
                    {st.filter === "fav" ? "Tap the ♡ on any card to keep it here." : "Add your first win to start the binder."}
                  </div>
                </div>
              )}

              {binderCards.length > 0 && (
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "16px" }}>
                  <div ref={this.fitOuterRef} style={{ width: "100%", height: st.fitH + "px", overflow: "hidden", display: "flex", justifyContent: "center" }}>
                    <div ref={this.bookRef} style={{ transform: "scale(" + st.fitScale + ")", transformOrigin: "top center", display: "flex", flexDirection: "column", alignItems: "center" }}>
                      <div style={{ position: "relative", perspective: "2600px" }}>
                        <div style={{ display: "flex", justifyContent: "center", background: "#ece2cb", border: "1.5px solid #dccfb1", borderRadius: "18px", padding: "13px", boxShadow: "0 26px 56px -14px rgba(58,52,43,.28), inset 0 1px 0 #f7efdc" }}>
                          {/* LEFT PAGE */}
                          <div style={{ width: "404px", height: "520px", position: "relative", background: "#fbf7ec", borderRadius: "10px 4px 4px 10px", boxShadow: "inset -18px 0 30px -20px rgba(58,52,43,.32)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                            <div style={{ position: "absolute", left: "-6px", top: "12px", bottom: "12px", width: "6px", borderRadius: "4px 0 0 4px", background: "repeating-linear-gradient(#e6dbc2,#e6dbc2 1px,#f4edda 1px,#f4edda 3px)" }} />
                            <div style={gridStyle}>
                              {leftCards.map((c) => (
                                <div key={c.id} className="pos-card" style={{ position: "relative", width: "172px", cursor: "pointer" }} onClick={() => this.setState({ selectedId: c.id })}>
                                  <button style={c.heartStyle} onClick={(e) => { e.stopPropagation(); this.toggleFavId(c.id); }}>{c.heartLabel}</button>
                                  <Card card={c.card} size="sm" />
                                </div>
                              ))}
                            </div>
                            <div style={{ position: "absolute", bottom: "10px", left: 0, right: 0, textAlign: "center", fontFamily: "'Space Mono',monospace", fontSize: "12px", color: "#bcb3a1" }}>{String(leftNo)}</div>
                          </div>
                          {/* SPINE */}
                          <div style={{ width: "4px", background: "linear-gradient(90deg,rgba(58,52,43,.18),rgba(58,52,43,.04),rgba(58,52,43,.18))" }} />
                          {/* RIGHT PAGE */}
                          <div style={{ width: "404px", height: "520px", position: "relative", background: "#fbf7ec", borderRadius: "4px 10px 10px 4px", boxShadow: "inset 18px 0 30px -20px rgba(58,52,43,.32)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                            <div style={{ position: "absolute", right: "-6px", top: "12px", bottom: "12px", width: "6px", borderRadius: "0 4px 4px 0", background: "repeating-linear-gradient(#e6dbc2,#e6dbc2 1px,#f4edda 1px,#f4edda 3px)" }} />
                            {rightCards.length > 0 && (
                              <div style={gridStyle}>
                                {rightCards.map((c) => (
                                  <div key={c.id} className="pos-card" style={{ position: "relative", width: "172px", cursor: "pointer" }} onClick={() => this.setState({ selectedId: c.id })}>
                                    <button style={c.heartStyle} onClick={(e) => { e.stopPropagation(); this.toggleFavId(c.id); }}>{c.heartLabel}</button>
                                    <Card card={c.card} size="sm" />
                                  </div>
                                ))}
                              </div>
                            )}
                            {rightCards.length === 0 && <div style={{ fontFamily: "'Caveat',cursive", fontSize: "27px", color: "#cfc6b3" }}>the end &middot; for now</div>}
                            <div style={{ position: "absolute", bottom: "10px", left: 0, right: 0, textAlign: "center", fontFamily: "'Space Mono',monospace", fontSize: "12px", color: "#bcb3a1" }}>{rightCards.length ? String(rightNo) : ""}</div>
                          </div>
                        </div>
                        {st.turning && <div style={leafStyle} />}
                      </div>

                      {/* NAV */}
                      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: "18px", marginTop: "16px" }}>
                        <button style={arrowBtn(spread <= 0)} onClick={() => this.flip("prev", spread, totalSpreads)}>&#8592;</button>
                        <div style={{ display: "flex", alignItems: "baseline", gap: "7px", fontFamily: "'Caveat',cursive", fontWeight: 600, fontSize: "23px", color: "#8a7a5c" }}>
                          <span>Page</span>
                          <input
                            style={pageInputStyle}
                            value={pageDisplayValue}
                            onChange={(e) => this.setState({ pageInput: e.target.value })}
                            onKeyDown={(e) => {
                              if (e.key !== "Enter") return;
                              e.preventDefault();
                              const raw = st.pageInput;
                              const v = parseInt(raw as string, 10);
                              if (raw != null && String(raw).trim() !== "" && !isNaN(v) && v >= 1 && v <= totalPages) {
                                this.setState({ spread: Math.floor((v - 1) / 2), pageInput: null, turning: null });
                              } else {
                                this.setState({ pageInput: null });
                              }
                              (e.target as HTMLInputElement).blur();
                            }}
                            onBlur={() => { if (this.state.pageInput != null) this.setState({ pageInput: null }); }}
                            inputMode="numeric"
                            aria-label="Go to page"
                          />
                          <span>of {totalPages}</span>
                        </div>
                        <button style={arrowBtn(spread >= totalSpreads - 1)} onClick={() => this.flip("next", spread, totalSpreads)}>&#8594;</button>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </section>
          )}

          {/* QUESTS */}
          {st.view === "quests" && (
            <QuestJourney today="2026-06-25" onAddToBinder={(card) => this.addQuestToBinder(card)} />
          )}

          {/* BALANCE */}
          {st.view === "balance" && <BalanceScreen cards={st.cards} today="2026-06-25" />}

          {/* MEMORY */}
          {st.view === "memory" && (
            <MemoryScreen
              cards={st.cards}
              items={st.memory}
              loading={st.memoryLoading}
              error={st.memoryError}
              loaded={st.memoryLoaded}
              onRefresh={this.loadMemory}
            />
          )}

          {/* SHARE */}
          {st.view === "share" && (
            <ShareScreen
              cards={st.cards.map((c) => ({ ...c, favorite: favSet.has(c.id) }))}
              user={{
                name: displayName,
                initials,
                tagline: `${st.cards.filter((c) => c.date >= "2026-06-01").length} wins this month`,
              }}
              onSaveProfile={() => this.fireToast("Profile image downloaded ✓")}
            />
          )}

          {/* ADD WIN */}
          {st.view === "add" && (
            <section>
              <div style={{ maxWidth: "560px", margin: "0 auto" }}>
                  <div style={{ textAlign: "center", marginBottom: "22px" }}>
                    <div style={{ fontFamily: "'Caveat',cursive", fontSize: "22px", color: "#bb8b4e", lineHeight: 1, marginBottom: "2px" }}></div>
                    <h2 style={{ fontFamily: "'Bricolage Grotesque',sans-serif", fontWeight: 800, fontSize: "30px", margin: 0, color: "#352f27" }}>Capture a win</h2>
                  </div>

                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "12px", marginBottom: "22px" }}>
                    <div style={{ position: "relative", width: "128px", height: "128px", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      {st.recording && <div style={{ position: "absolute", width: "104px", height: "104px", borderRadius: "50%", background: "#dd7d72", animation: "micPulse 1.4s ease-out infinite" }} />}
                      <button style={micBtnStyle} onClick={() => this.toggleRecord()} aria-label="Record voice note">
                        <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="2.5" width="6" height="12" rx="3" /><line x1="12" y1="14.5" x2="12" y2="20" /><line x1="8" y1="20" x2="16" y2="20" /></svg>
                      </button>
                    </div>
                    <div style={{ fontFamily: "'Hanken Grotesk',sans-serif", fontWeight: 600, fontSize: "14px", color: "#8a7a5c" }}>{st.recording ? "Listening… tap to stop" : "Tap to speak your win"}</div>
                  </div>

                  <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "14px", color: "#bcb3a1" }}>
                    <div style={{ flex: 1, height: "1px", background: "#e7ddc8" }} />
                    <div style={{ fontFamily: "'Space Mono',monospace", fontSize: "12px" }}>or type it</div>
                    <div style={{ flex: 1, height: "1px", background: "#e7ddc8" }} />
                  </div>

                  <textarea
                    style={{ width: "100%", boxSizing: "border-box", minHeight: "112px", resize: "vertical", background: "#fbf7ec", border: "1.5px solid #e6dcc6", borderRadius: "14px", padding: "14px", fontFamily: "'Hanken Grotesk',sans-serif", fontSize: "15px", lineHeight: 1.5, color: "#3a342b", outline: "none" }}
                    placeholder="What did you accomplish? A sentence — or a whole messy paragraph."
                    value={st.addText}
                    onChange={(e) => this.setState({ addText: e.target.value })}
                  />
                  <div style={{ fontSize: "12px", color: "#a59c8c", margin: "8px 2px 18px" }}>
                    The AI shortens this into your card&apos;s one-line win.
                  </div>

                  <div style={{ display: "flex", gap: "8px", marginBottom: "16px" }}>
                    <input
                      style={{ flex: 1, minWidth: 0, boxSizing: "border-box", background: "#fbf7ec", border: "1.5px solid #e6dcc6", borderRadius: "12px", padding: "12px 14px", fontFamily: "'Hanken Grotesk',sans-serif", fontSize: "15px", color: "#3a342b", outline: "none" }}
                      placeholder="Name this win (e.g. First WebSocket server)"
                      value={st.addTitle}
                      onChange={(e) => this.setState({ addTitle: e.target.value })}
                    />
                    <button
                      onClick={() => this.suggestTitleNow()}
                      title="Generate a title from your description"
                      style={{ flex: "0 0 auto", whiteSpace: "nowrap", background: "#fbf7ec", color: "#9a7b1f", border: "1.5px solid #ecdca0", borderRadius: "12px", padding: "0 14px", fontFamily: "'Hanken Grotesk',sans-serif", fontWeight: 700, fontSize: "13.5px", cursor: st.suggestingTitle ? "default" : "pointer", opacity: st.suggestingTitle ? 0.6 : 1 }}
                    >
                      {st.suggestingTitle ? "…" : "✨ Title"}
                    </button>
                  </div>

                  <div style={{ fontFamily: "'Space Mono',monospace", fontSize: "11px", letterSpacing: "1px", textTransform: "uppercase", color: "#a59c8c", marginBottom: "8px" }}>Type</div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", marginBottom: "24px" }}>
                    {TYPE_ORDER.map((k) => (
                      <button
                        key={k}
                        style={{
                          border: "1.5px solid " + (st.addType === k ? TYPES[k].deep : "#e2d8c2"),
                          background: st.addType === k ? TYPES[k].fill : "#fbf7ec",
                          color: st.addType === k ? TYPES[k].ink : "#8a8275",
                          cursor: "pointer",
                          borderRadius: "999px",
                          padding: "7px 14px",
                          fontFamily: "'Hanken Grotesk',sans-serif",
                          fontWeight: 600,
                          fontSize: "13px",
                        }}
                        onClick={(e) => this.setState({ addType: e.currentTarget.dataset.k as string })}
                        data-k={k}
                      >
                        {TYPES[k].label}
                      </button>
                    ))}
                  </div>

                  <div style={{ fontFamily: "'Space Mono',monospace", fontSize: "11px", letterSpacing: "1px", textTransform: "uppercase", color: "#a59c8c", marginBottom: "8px" }}>
                    Picture <span style={{ textTransform: "none", letterSpacing: 0 }}>(optional)</span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "24px", flexWrap: "wrap" }}>
                    <label style={{ ...ghostBtnStyle, padding: "10px 16px", fontSize: "14px", display: "inline-block" }}>
                      {st.addImage ? "Change picture" : "Add a picture"}
                      <input
                        type="file"
                        accept="image/*"
                        style={{ display: "none" }}
                        onChange={(e) => { this.pickAddImage(e.target.files?.[0]); e.currentTarget.value = ""; }}
                      />
                    </label>
                    {st.addImage && (
                      <>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={st.addImage} alt="card art preview" style={{ width: "48px", height: "48px", objectFit: "cover", borderRadius: "8px", border: "1.5px solid #e6dcc6" }} />
                        <button
                          style={{ background: "transparent", border: "none", color: "#b0564a", cursor: "pointer", fontFamily: "'Hanken Grotesk',sans-serif", fontWeight: 600, fontSize: "13px" }}
                          onClick={() => this.setState({ addImage: undefined })}
                        >
                          Remove
                        </button>
                      </>
                    )}
                  </div>

                  <button style={addSubmitStyle} onClick={() => this.submitAdd()}>Add to binder</button>
                </div>
            </section>
          )}
        </div>

        {/* TOAST */}
        {st.showToast && (
          <div style={{ position: "fixed", bottom: "26px", left: "50%", transform: "translateX(-50%)", background: "#3a342b", color: "#fdf7e8", padding: "11px 20px", borderRadius: "999px", fontSize: "14px", fontWeight: 600, boxShadow: "0 10px 30px rgba(58,52,43,.3)", zIndex: 60 }}>
            {st.toastText}
          </div>
        )}

        {/* PACK REVEAL — plays when a new card is minted (add a win, or earn a quest) */}
        {st.revealCard && (
          <PackReveal
            card={st.revealCard}
            onClose={() => this.setState({ revealCard: null, view: "binder" })}
            renderCard={(c) => <Card card={c} size="lg" />}
          />
        )}

        {/* DETAIL MODAL */}
        {sel && (() => {
          const previewCard: UiCard = st.editing
            ? { ...sel, skill: st.editSkill, win: st.editWin, type: st.editType }
            : sel;
          const closeModal = () => this.setState({ selectedId: null, editing: false });
          const fieldLabelStyle: React.CSSProperties = {
            fontFamily: "'Space Mono',monospace",
            fontSize: "11px",
            letterSpacing: "1px",
            textTransform: "uppercase",
            color: "#a59c8c",
            marginBottom: "6px",
          };
          const fieldBoxStyle: React.CSSProperties = {
            width: "100%",
            boxSizing: "border-box",
            background: "#fbf7ec",
            border: "1.5px solid #e6dcc6",
            borderRadius: "12px",
            padding: "11px 13px",
            fontFamily: "'Hanken Grotesk',sans-serif",
            fontSize: "14px",
            color: "#3a342b",
            outline: "none",
          };
          return (
          <div style={{ position: "fixed", inset: 0, background: "rgba(46,41,33,.5)", backdropFilter: "blur(3px)", display: "flex", alignItems: "center", justifyContent: "center", padding: "24px", zIndex: 50 }} onClick={closeModal}>
            <div style={{ display: "flex", flexDirection: st.editing ? "row" : "column", flexWrap: "wrap", alignItems: st.editing ? "flex-start" : "center", justifyContent: "center", gap: st.editing ? "26px" : "18px", maxHeight: "100%", overflowY: "auto" }} onClick={(e) => e.stopPropagation()}>
              {/* hidden picker for card art (uploaded to Supabase Storage) */}
              <input
                ref={this.fileInputRef}
                type="file"
                accept="image/*"
                style={{ display: "none" }}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file && st.selectedId) this.handleImagePick(st.selectedId, file);
                  e.target.value = "";
                }}
              />
              <Card card={previewCard} size="lg" onArtClick={() => this.fileInputRef.current?.click()} />

              {!st.editing && (
                <div style={{ display: "flex", gap: "10px" }}>
                  <button
                    style={{ background: "#3a342b", color: "#fdf7e8", border: "none", borderRadius: "11px", padding: "11px 24px", fontFamily: "'Hanken Grotesk',sans-serif", fontWeight: 600, fontSize: "14px", cursor: "pointer", boxShadow: "0 8px 20px rgba(58,52,43,.18)" }}
                    onClick={() => this.startEdit(sel)}
                  >
                    Edit card
                  </button>
                  <button
                    style={{ background: "#fffaf8", color: "#b0564a", border: "1.5px solid #e0b3aa", borderRadius: "11px", padding: "11px 24px", fontFamily: "'Hanken Grotesk',sans-serif", fontWeight: 600, fontSize: "14px", cursor: "pointer", boxShadow: "0 8px 20px rgba(58,52,43,.18)" }}
                    onClick={() => { if (st.selectedId) this.deleteCard(st.selectedId); }}
                  >
                    Delete card
                  </button>
                </div>
              )}

              {st.editing && (
                <div style={{ width: "340px", maxWidth: "100%", background: "#fffdf7", border: "1.5px solid #e9dfca", borderRadius: "18px", padding: "20px", boxShadow: "0 14px 40px rgba(58,52,43,.18)" }}>
                  <div style={{ fontFamily: "'Bricolage Grotesque',sans-serif", fontWeight: 800, fontSize: "20px", color: "#352f27", marginBottom: "16px" }}>Edit card</div>

                  <div style={fieldLabelStyle}>Title</div>
                  <input
                    style={{ ...fieldBoxStyle, marginBottom: "14px" }}
                    placeholder="Card title (e.g. WebSocket server)"
                    value={st.editSkill}
                    onChange={(e) => this.setState({ editSkill: e.target.value })}
                  />

                  <div style={fieldLabelStyle}>Description</div>
                  <textarea
                    style={{ ...fieldBoxStyle, minHeight: "70px", resize: "vertical", lineHeight: 1.45, marginBottom: "14px" }}
                    placeholder="What you accomplished"
                    value={st.editWin}
                    onChange={(e) => this.setState({ editWin: e.target.value })}
                  />

                  <div style={fieldLabelStyle}>Type</div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "7px", marginBottom: "16px" }}>
                    {TYPE_ORDER.map((k) => (
                      <button
                        key={k}
                        style={{
                          border: "1.5px solid " + (st.editType === k ? TYPES[k].deep : "#e2d8c2"),
                          background: st.editType === k ? TYPES[k].fill : "#fbf7ec",
                          color: st.editType === k ? TYPES[k].ink : "#8a8275",
                          cursor: "pointer",
                          borderRadius: "999px",
                          padding: "6px 12px",
                          fontFamily: "'Hanken Grotesk',sans-serif",
                          fontWeight: 600,
                          fontSize: "12.5px",
                        }}
                        onClick={() => this.setState({ editType: k })}
                      >
                        {TYPES[k].label}
                      </button>
                    ))}
                  </div>

                  <div style={{ fontSize: "12px", color: "#a59c8c", marginBottom: "20px", lineHeight: 1.4 }}>
                    Tap the card art to set an image — it&apos;s saved to your account.
                  </div>

                  <div style={{ display: "flex", gap: "10px" }}>
                    <button
                      style={{ ...addSubmitStyle, flex: 1, padding: "12px", opacity: st.savingEdit ? 0.7 : 1, cursor: st.savingEdit ? "default" : "pointer" }}
                      onClick={() => this.saveEdit()}
                    >
                      {st.savingEdit ? "Saving…" : "Save changes"}
                    </button>
                    <button style={{ ...ghostBtnStyle, padding: "12px 18px" }} onClick={() => this.cancelEdit()}>
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
          );
        })()}
      </div>
    );
  }
}
