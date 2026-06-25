import { useState } from 'react';

const PLACEHOLDER_CARD = {
  type: 'Technical',
  win: 'Fixed a gnarly race condition in the WebSocket handler.',
  overcame: 'Spent 3 hours convinced it was a backend bug.',
  skill: 'Async Debugging',
  emotion: 'breakthrough',
  rarity: 'Epic',
  callback: '3 weeks ago this same "Async Debugging" left you stuck. Today it\'s a win.',
};

const TYPE_META = {
  Academic:  { color: '#3b82f6', icon: '📚' },
  Technical: { color: '#8b5cf6', icon: '⚡' },
  Financial: { color: '#10b981', icon: '💰' },
  Social:    { color: '#f59e0b', icon: '🤝' },
  Hobbies:   { color: '#ef4444', icon: '🎨' },
};

const EMOTION_AURA = {
  stuck:        'rgba(99,102,241,0.3)',
  breakthrough: 'rgba(251,191,36,0.4)',
  steady:       'rgba(34,197,94,0.3)',
  proud:        'rgba(168,85,247,0.35)',
  anxious:      'rgba(239,68,68,0.25)',
};

const RARITY_STYLE = {
  Common:    { border: '#9ca3af', glow: 'transparent' },
  Rare:      { border: '#3b82f6', glow: 'rgba(59,130,246,0.4)' },
  Epic:      { border: '#a855f7', glow: 'rgba(168,85,247,0.5)' },
  Legendary: { border: '#f59e0b', glow: 'rgba(251,191,36,0.6)' },
};

function MintedCard({ card }) {
  const typeMeta = TYPE_META[card.type] || TYPE_META.Technical;
  const aura = EMOTION_AURA[card.emotion] || 'transparent';
  const rarity = RARITY_STYLE[card.rarity] || RARITY_STYLE.Common;
  const isHolo = card.rarity === 'Epic' || card.rarity === 'Legendary';

  return (
    <div
      className="rounded-2xl p-5 max-w-xs w-full mx-auto flex flex-col gap-3"
      style={{
        border: `2px solid ${rarity.border}`,
        boxShadow: `0 0 24px ${rarity.glow}, inset 0 0 60px ${aura}`,
        background: isHolo
          ? `linear-gradient(135deg, #1e1a2e, #2a1f3d, #1e1a2e)`
          : '#1e1a2e',
        backgroundSize: isHolo ? '200% 200%' : undefined,
        animation: isHolo ? 'holoShift 4s ease infinite' : undefined,
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <span
          className="text-xs font-bold uppercase px-2 py-0.5 rounded-full"
          style={{ background: typeMeta.color + '33', color: typeMeta.color }}
        >
          {typeMeta.icon} {card.type}
        </span>
        <span
          className="text-xs font-bold uppercase px-2 py-0.5 rounded-full"
          style={{
            background: rarity.border + '22',
            color: rarity.border,
            border: `1px solid ${rarity.border}44`,
          }}
        >
          {card.rarity}
        </span>
      </div>

      {/* Win */}
      <p className="text-white font-semibold text-sm leading-snug">{card.win}</p>

      {/* Overcame */}
      <p className="text-white/50 text-xs leading-snug italic">{card.overcame}</p>

      {/* Footer */}
      <div className="flex items-center justify-between pt-1 border-t border-white/10">
        <span
          className="text-xs font-medium px-2 py-0.5 rounded-md"
          style={{ background: typeMeta.color + '22', color: typeMeta.color }}
        >
          {card.skill}
        </span>
        <span className="text-xs text-white/30 capitalize">{card.emotion}</span>
      </div>

      {/* Callback */}
      {card.callback && (
        <div className="bg-white/5 rounded-lg px-3 py-2 border-l-2 border-yellow-400/60">
          <p className="text-yellow-300/80 text-xs italic">{card.callback}</p>
        </div>
      )}
    </div>
  );
}

export default function RecordPage() {
  const [state, setState] = useState('idle'); // idle | recording | loading | done
  const [transcript, setTranscript] = useState('');
  const [card, setCard] = useState(null);
  const [error, setError] = useState(null);

  async function handleRecord() {
    if (state === 'recording') return;
    setState('recording');
    setError(null);

    // Web Speech API
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setState('idle');
      setError('Speech recognition not supported in this browser.');
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = 'en-US';
    recognition.interimResults = false;

    recognition.onresult = async (e) => {
      const text = e.results[0][0].transcript;
      setTranscript(text);
      setState('loading');
      try {
        const res = await fetch('/api/extract', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ transcript: text }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed');
        setCard(data);
        setState('done');
      } catch (err) {
        setError(err.message);
        setState('idle');
      }
    };

    recognition.onerror = (e) => {
      setError(`Mic error: ${e.error}`);
      setState('idle');
    };

    recognition.start();
  }

  async function handleDemoMint() {
    setState('loading');
    setError(null);
    try {
      const res = await fetch('/api/extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transcript: 'I finally fixed the async race condition that was breaking my WebSocket handler. Spent 3 hours debugging it.' }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed');
      setCard(data);
    } catch {
      // offline fallback
      setCard(PLACEHOLDER_CARD);
    }
    setState('done');
  }

  return (
    <div
      className="w-full h-full flex flex-col overflow-y-auto"
      style={{ background: 'linear-gradient(160deg, #0f0c29 0%, #1a1040 100%)' }}
    >
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-8 gap-6">
        <div className="text-center">
          <h2 className="text-white text-2xl font-bold mb-1">Mint a Card</h2>
          <p className="text-purple-300/60 text-sm">Speak a win — AI turns it into a skill card</p>
        </div>

        {/* Record button */}
        {state !== 'done' && (
          <button
            onClick={handleRecord}
            disabled={state === 'recording' || state === 'loading'}
            className="rounded-full flex flex-col items-center justify-center gap-1 transition-all cursor-pointer disabled:opacity-60"
            style={{
              width: 120,
              height: 120,
              background: state === 'recording'
                ? 'radial-gradient(circle, #ef4444, #b91c1c)'
                : 'radial-gradient(circle, #a855f7, #7c3aed)',
              boxShadow: state === 'recording'
                ? '0 0 40px rgba(239,68,68,0.6)'
                : '0 0 30px rgba(168,85,247,0.5)',
              border: 'none',
            }}
          >
            <span className="text-4xl">{state === 'recording' ? '⏹' : '🎙'}</span>
            <span className="text-white text-xs font-medium">
              {state === 'loading' ? 'Minting…' : state === 'recording' ? 'Stop' : 'Speak'}
            </span>
          </button>
        )}

        {transcript && (
          <p className="text-white/50 text-xs text-center max-w-xs italic">"{transcript}"</p>
        )}

        {error && (
          <p className="text-red-400 text-xs text-center">{error}</p>
        )}

        {/* Demo shortcut */}
        {state === 'idle' && !card && (
          <button
            onClick={handleDemoMint}
            className="text-purple-400/60 text-xs underline cursor-pointer bg-transparent border-none"
          >
            or mint a demo card
          </button>
        )}

        {/* Minted card */}
        {card && <MintedCard card={card} />}

        {state === 'done' && (
          <button
            onClick={() => { setState('idle'); setCard(null); setTranscript(''); }}
            className="text-purple-300/60 text-xs underline cursor-pointer bg-transparent border-none"
          >
            Mint another
          </button>
        )}
      </div>
    </div>
  );
}
