export default function CoverPage() {
  return (
    <div
      className="w-full h-full flex flex-col items-center justify-center relative overflow-hidden"
      style={{
        background: 'linear-gradient(135deg, #0f0c29 0%, #302b63 50%, #24243e 100%)',
      }}
    >
      {/* Starfield dots */}
      {[...Array(40)].map((_, i) => (
        <div
          key={i}
          className="absolute rounded-full bg-white"
          style={{
            width: Math.random() * 3 + 1,
            height: Math.random() * 3 + 1,
            top: `${Math.random() * 100}%`,
            left: `${Math.random() * 100}%`,
            opacity: Math.random() * 0.6 + 0.1,
          }}
        />
      ))}

      {/* Logo glow */}
      <div
        className="absolute rounded-full blur-3xl opacity-30"
        style={{
          width: 320,
          height: 320,
          background: 'radial-gradient(circle, #a855f7 0%, transparent 70%)',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
        }}
      />

      {/* Card icon */}
      <div
        className="mb-6 rounded-2xl flex items-center justify-center text-5xl shadow-2xl"
        style={{
          width: 90,
          height: 90,
          background: 'linear-gradient(135deg, #a855f7, #ec4899)',
        }}
      >
        ✦
      </div>

      <h1
        className="text-5xl font-bold text-white text-center mb-3"
        style={{ letterSpacing: '-1px', textShadow: '0 0 40px rgba(168,85,247,0.5)' }}
      >
        FidHacks
      </h1>

      <p className="text-purple-300 text-lg text-center mb-1 font-light">
        Proof-of-Skill Ledger
      </p>
      <p className="text-purple-400/60 text-sm text-center max-w-xs">
        Speak a win. Mint a card. Own your story.
      </p>

      <div className="mt-12 flex flex-col items-center gap-2">
        <div className="text-white/40 text-xs uppercase tracking-widest">Open your binder</div>
        <div className="text-white/40 text-xl animate-bounce">›</div>
      </div>
    </div>
  );
}
