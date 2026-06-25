import { useState, useEffect } from 'react';

const TYPE_META = {
  Academic:  { color: '#3b82f6', icon: '📚' },
  Technical: { color: '#8b5cf6', icon: '⚡' },
  Financial: { color: '#10b981', icon: '💰' },
  Social:    { color: '#f59e0b', icon: '🤝' },
  Hobbies:   { color: '#ef4444', icon: '🎨' },
};

const RARITY_STYLE = {
  Common:    { border: '#6b7280', bg: '#1f2937' },
  Rare:      { border: '#3b82f6', bg: '#1e3a5f' },
  Epic:      { border: '#a855f7', bg: '#2d1b4e' },
  Legendary: { border: '#f59e0b', bg: '#3d2a0a' },
};

const EMOTION_AURA = {
  stuck:        'rgba(99,102,241,0.2)',
  breakthrough: 'rgba(251,191,36,0.25)',
  steady:       'rgba(34,197,94,0.2)',
  proud:        'rgba(168,85,247,0.2)',
  anxious:      'rgba(239,68,68,0.15)',
};

// Placeholder cards shown when API is unreachable
const PLACEHOLDER_CARDS = [
  { id: '1', type: 'Technical', skill: 'Async Debugging', rarity: 'Epic', emotion: 'breakthrough', win: 'Fixed a gnarly WebSocket race condition.', timestamp: new Date().toISOString() },
  { id: '2', type: 'Academic', skill: 'Proof Writing', rarity: 'Rare', emotion: 'proud', win: 'Finished a 10-page linear algebra proof set.', timestamp: new Date().toISOString() },
  { id: '3', type: 'Social', skill: 'Cold Outreach', rarity: 'Common', emotion: 'anxious', win: 'Sent my first cold email to a recruiter.', timestamp: new Date().toISOString() },
  { id: '4', type: 'Financial', skill: 'Budgeting', rarity: 'Common', emotion: 'steady', win: 'Tracked all expenses for a full month.', timestamp: new Date().toISOString() },
  { id: '5', type: 'Hobbies', skill: 'Watercolor', rarity: 'Rare', emotion: 'proud', win: 'Completed first landscape painting.', timestamp: new Date().toISOString() },
  { id: '6', type: 'Technical', skill: 'System Design', rarity: 'Legendary', emotion: 'breakthrough', win: 'Architected a scalable event-sourcing pipeline from scratch.', timestamp: new Date().toISOString() },
];

function SkillCard({ card }) {
  const meta = TYPE_META[card.type] || TYPE_META.Technical;
  const style = RARITY_STYLE[card.rarity] || RARITY_STYLE.Common;
  const aura = EMOTION_AURA[card.emotion] || 'transparent';
  const isHolo = card.rarity === 'Epic' || card.rarity === 'Legendary';

  return (
    <div
      className="rounded-xl p-3 flex flex-col gap-2 cursor-pointer transition-transform hover:-translate-y-0.5"
      style={{
        border: `1.5px solid ${style.border}`,
        background: style.bg,
        boxShadow: `0 0 12px ${style.border}44, inset 0 0 30px ${aura}`,
        backgroundImage: isHolo
          ? `linear-gradient(135deg, ${style.bg}, ${aura}, ${style.bg})`
          : undefined,
      }}
    >
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-bold" style={{ color: meta.color }}>
          {meta.icon} {card.type}
        </span>
        <span className="text-[10px] font-bold" style={{ color: style.border }}>
          {card.rarity}
        </span>
      </div>
      <p className="text-white text-xs font-medium leading-tight line-clamp-2">{card.win}</p>
      <div className="flex items-center justify-between mt-auto">
        <span
          className="text-[9px] px-1.5 py-0.5 rounded"
          style={{ background: meta.color + '22', color: meta.color }}
        >
          {card.skill}
        </span>
        <span className="text-[9px] text-white/30">
          {new Date(card.timestamp).toLocaleDateString()}
        </span>
      </div>
    </div>
  );
}

export default function BinderPage() {
  const [cards, setCards] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/cards')
      .then((r) => r.json())
      .then((data) => setCards(Array.isArray(data) && data.length ? data : PLACEHOLDER_CARDS))
      .catch(() => setCards(PLACEHOLDER_CARDS))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div
      className="w-full h-full flex flex-col overflow-hidden"
      style={{ background: 'linear-gradient(160deg, #0d0d1f 0%, #1a1040 100%)' }}
    >
      {/* Header */}
      <div className="px-5 py-4 border-b border-white/10 flex items-center justify-between flex-shrink-0">
        <div>
          <h2 className="text-white font-bold text-base">My Binder</h2>
          <p className="text-white/40 text-xs">{cards.length} cards collected</p>
        </div>
        <div className="flex gap-1">
          {Object.entries(TYPE_META).map(([type, meta]) => {
            const count = cards.filter((c) => c.type === type).length;
            if (!count) return null;
            return (
              <span key={type} className="text-[10px] px-1.5 py-0.5 rounded-full font-bold"
                style={{ background: meta.color + '22', color: meta.color }}>
                {meta.icon}{count}
              </span>
            );
          })}
        </div>
      </div>

      {/* Grid */}
      <div className="flex-1 overflow-y-auto p-4">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <p className="text-white/40 text-sm">Loading cards…</p>
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-3">
            {cards.map((card) => (
              <SkillCard key={card.id} card={card} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
