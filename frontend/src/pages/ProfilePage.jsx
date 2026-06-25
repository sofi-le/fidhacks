import { useState, useEffect } from 'react';

const TYPE_META = {
  Academic:  { color: '#3b82f6', icon: '📚' },
  Technical: { color: '#8b5cf6', icon: '⚡' },
  Financial: { color: '#10b981', icon: '💰' },
  Social:    { color: '#f59e0b', icon: '🤝' },
  Hobbies:   { color: '#ef4444', icon: '🎨' },
};

const RARITY_STYLE = {
  Common:    '#6b7280',
  Rare:      '#3b82f6',
  Epic:      '#a855f7',
  Legendary: '#f59e0b',
};

export default function ProfilePage() {
  const [cards, setCards] = useState([]);
  const [skills, setSkills] = useState([]);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    Promise.all([
      fetch('/api/cards').then((r) => r.json()).catch(() => []),
      fetch('/api/skills').then((r) => r.json()).catch(() => []),
    ]).then(([c, s]) => {
      setCards(Array.isArray(c) ? c : []);
      setSkills(Array.isArray(s) ? s : []);
    });
  }, []);

  const topCards = cards
    .sort((a, b) => {
      const order = ['Legendary', 'Epic', 'Rare', 'Common'];
      return order.indexOf(a.rarity) - order.indexOf(b.rarity);
    })
    .slice(0, 3);

  const totalCards = cards.length;
  const legendary = cards.filter((c) => c.rarity === 'Legendary').length;
  const epic = cards.filter((c) => c.rarity === 'Epic').length;

  function handleShare() {
    navigator.clipboard.writeText(window.location.href).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <div
      className="w-full h-full flex flex-col overflow-hidden"
      style={{ background: 'linear-gradient(160deg, #0d0d1f 0%, #1a1040 100%)' }}
    >
      {/* Header */}
      <div className="px-5 py-4 border-b border-white/10 flex items-center justify-between flex-shrink-0">
        <div>
          <h2 className="text-white font-bold text-base">My Profile</h2>
          <p className="text-white/40 text-xs">Your skill receipts</p>
        </div>
        <button
          onClick={handleShare}
          className="text-xs px-3 py-1.5 rounded-lg cursor-pointer border-none transition-colors font-medium"
          style={{ background: 'rgba(168,85,247,0.3)', color: '#d8b4fe' }}
        >
          {copied ? '✓ Copied!' : '⬆ Share'}
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-4 flex flex-col gap-5">
        {/* Stats row */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: 'Cards', value: totalCards },
            { label: 'Legendary', value: legendary, color: '#f59e0b' },
            { label: 'Epic', value: epic, color: '#a855f7' },
          ].map(({ label, value, color }) => (
            <div
              key={label}
              className="rounded-xl p-3 text-center"
              style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}
            >
              <p className="text-2xl font-bold" style={{ color: color || 'white' }}>{value}</p>
              <p className="text-white/40 text-xs mt-0.5">{label}</p>
            </div>
          ))}
        </div>

        {/* Top cards */}
        {topCards.length > 0 && (
          <div>
            <p className="text-white/60 text-xs uppercase tracking-widest mb-2">Top Cards</p>
            <div className="flex flex-col gap-2">
              {topCards.map((card) => {
                const meta = TYPE_META[card.type] || TYPE_META.Technical;
                const rarityColor = RARITY_STYLE[card.rarity] || '#6b7280';
                return (
                  <div
                    key={card.id}
                    className="rounded-xl p-3 flex items-start gap-3"
                    style={{
                      background: rarityColor + '11',
                      border: `1px solid ${rarityColor}44`,
                    }}
                  >
                    <span className="text-2xl">{meta.icon}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-white text-xs font-medium leading-tight line-clamp-2">{card.win}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-[10px]" style={{ color: meta.color }}>{card.skill}</span>
                        <span className="text-[10px]" style={{ color: rarityColor }}>{card.rarity}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Skill cloud */}
        {skills.length > 0 && (
          <div>
            <p className="text-white/60 text-xs uppercase tracking-widest mb-2">Skill Tags</p>
            <div className="flex flex-wrap gap-2">
              {skills.slice(0, 15).map((s) => (
                <span
                  key={s.skill}
                  className="text-xs px-2 py-0.5 rounded-full"
                  style={{
                    background: 'rgba(168,85,247,0.15)',
                    border: '1px solid rgba(168,85,247,0.3)',
                    color: '#d8b4fe',
                  }}
                >
                  {s.skill}
                  {s.count > 1 && <span className="text-purple-400/50 ml-1">×{s.count}</span>}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Empty state */}
        {totalCards === 0 && (
          <div className="flex-1 flex flex-col items-center justify-center text-center gap-3 py-8">
            <span className="text-4xl">🃏</span>
            <p className="text-white/40 text-sm">No cards yet.</p>
            <p className="text-white/30 text-xs">Go to Mint and speak your first win.</p>
          </div>
        )}
      </div>
    </div>
  );
}
