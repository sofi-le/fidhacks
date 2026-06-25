import { useState, useEffect } from 'react';

const TYPE_META = {
  Academic:  { color: '#3b82f6', icon: '📚' },
  Technical: { color: '#8b5cf6', icon: '⚡' },
  Financial: { color: '#10b981', icon: '💰' },
  Social:    { color: '#f59e0b', icon: '🤝' },
  Hobbies:   { color: '#ef4444', icon: '🎨' },
};

const PLACEHOLDER = [
  { type: 'Technical', count: 12, pct: 48 },
  { type: 'Academic',  count: 7,  pct: 28 },
  { type: 'Social',    count: 3,  pct: 12 },
  { type: 'Hobbies',   count: 2,  pct: 8 },
  { type: 'Financial', count: 1,  pct: 4 },
];

// Simple SVG radar chart
function RadarChart({ data }) {
  const size = 180;
  const cx = size / 2;
  const cy = size / 2;
  const r = 70;
  const n = data.length;

  const angle = (i) => (Math.PI * 2 * i) / n - Math.PI / 2;
  const point = (i, pct) => {
    const scale = (pct / 100) * r;
    return [cx + scale * Math.cos(angle(i)), cy + scale * Math.sin(angle(i))];
  };
  const labelPoint = (i) => {
    const scale = r + 18;
    return [cx + scale * Math.cos(angle(i)), cy + scale * Math.sin(angle(i))];
  };

  const gridLevels = [0.25, 0.5, 0.75, 1];
  const polyPoints = data.map((d, i) => point(i, d.pct).join(',')).join(' ');

  return (
    <svg width={size + 60} height={size + 60} viewBox={`-30 -30 ${size + 60} ${size + 60}`}>
      {/* Grid rings */}
      {gridLevels.map((lvl) => (
        <polygon
          key={lvl}
          points={data.map((_, i) => {
            const s = r * lvl;
            return [cx + s * Math.cos(angle(i)), cy + s * Math.sin(angle(i))].join(',');
          }).join(' ')}
          fill="none"
          stroke="rgba(255,255,255,0.08)"
          strokeWidth="1"
        />
      ))}
      {/* Spokes */}
      {data.map((_, i) => {
        const [x, y] = [cx + r * Math.cos(angle(i)), cy + r * Math.sin(angle(i))];
        return <line key={i} x1={cx} y1={cy} x2={x} y2={y} stroke="rgba(255,255,255,0.08)" strokeWidth="1" />;
      })}
      {/* Data area */}
      <polygon
        points={polyPoints}
        fill="rgba(168,85,247,0.2)"
        stroke="#a855f7"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      {/* Data dots */}
      {data.map((d, i) => {
        const [x, y] = point(i, d.pct);
        const meta = TYPE_META[d.type];
        return <circle key={i} cx={x} cy={y} r={4} fill={meta?.color || '#a855f7'} />;
      })}
      {/* Labels */}
      {data.map((d, i) => {
        const [x, y] = labelPoint(i);
        const meta = TYPE_META[d.type];
        return (
          <text
            key={i}
            x={x}
            y={y}
            textAnchor="middle"
            dominantBaseline="middle"
            fontSize="10"
            fill={meta?.color || '#fff'}
            fontWeight="600"
          >
            {meta?.icon} {d.type}
          </text>
        );
      })}
    </svg>
  );
}

export default function BalancePage() {
  const [period, setPeriod] = useState('all');
  const [data, setData] = useState(PLACEHOLDER);

  useEffect(() => {
    fetch(`/api/balance?period=${period}`)
      .then((r) => r.json())
      .then((d) => {
        const nonZero = d.filter((row) => row.count > 0);
        setData(nonZero.length ? nonZero : PLACEHOLDER);
      })
      .catch(() => setData(PLACEHOLDER));
  }, [period]);

  const total = data.reduce((s, d) => s + d.count, 0);

  return (
    <div
      className="w-full h-full flex flex-col overflow-hidden"
      style={{ background: 'linear-gradient(160deg, #0d0d1f 0%, #1a1040 100%)' }}
    >
      {/* Header */}
      <div className="px-5 py-4 border-b border-white/10 flex items-center justify-between flex-shrink-0">
        <div>
          <h2 className="text-white font-bold text-base">Life Balance</h2>
          <p className="text-white/40 text-xs">Where your energy went</p>
        </div>
        <div className="flex gap-1 bg-white/5 rounded-lg p-1">
          {['week', 'month', 'all'].map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className="text-xs px-2 py-1 rounded-md cursor-pointer border-none transition-colors capitalize"
              style={{
                background: period === p ? 'rgba(168,85,247,0.4)' : 'transparent',
                color: period === p ? 'white' : 'rgba(255,255,255,0.4)',
              }}
            >
              {p}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto flex flex-col items-center px-4 py-4 gap-4">
        {/* Radar */}
        <RadarChart data={data} />

        {/* Bar breakdown */}
        <div className="w-full flex flex-col gap-2">
          {data.sort((a, b) => b.pct - a.pct).map((d) => {
            const meta = TYPE_META[d.type];
            return (
              <div key={d.type} className="flex items-center gap-3">
                <span className="text-xs w-20 text-right text-white/60 shrink-0">
                  {meta.icon} {d.type}
                </span>
                <div className="flex-1 bg-white/5 rounded-full h-2 overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-700"
                    style={{ width: `${d.pct}%`, background: meta.color }}
                  />
                </div>
                <span className="text-xs text-white/40 w-8 shrink-0">{d.pct}%</span>
              </div>
            );
          })}
        </div>

        {total > 0 && (
          <p className="text-white/30 text-xs text-center">{total} cards total</p>
        )}

        {/* Insight callout */}
        {data[0]?.pct > 50 && (
          <div className="w-full bg-white/5 rounded-xl p-3 border border-white/10">
            <p className="text-white/60 text-xs text-center">
              You&apos;ve been heavy on{' '}
              <span style={{ color: TYPE_META[data[0].type]?.color }}>
                {data[0].type}
              </span>
              {' '}({data[0].pct}%). When did you last log a{' '}
              <span className="text-yellow-400/80">Social</span> or{' '}
              <span className="text-red-400/80">Hobbies</span> win?
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
