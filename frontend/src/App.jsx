import { useEffect, useRef, useState } from 'react';
import { PageFlip } from 'page-flip';

import CoverPage from './pages/CoverPage';
import RecordPage from './pages/RecordPage';
import BinderPage from './pages/BinderPage';
import BalancePage from './pages/BalancePage';
import ProfilePage from './pages/ProfilePage';

const BOOK_W = 340;
const BOOK_H = 520;
const PAGE_LABELS = ['Cover', 'Mint', 'Binder', 'Balance', 'Profile'];

export default function App() {
  const bookRef = useRef(null);
  const flipRef = useRef(null);
  const [currentPage, setCurrentPage] = useState(0);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!bookRef.current) return;

    const pf = new PageFlip(bookRef.current, {
      width: BOOK_W,
      height: BOOK_H,
      size: 'fixed',
      minWidth: BOOK_W,
      maxWidth: BOOK_W,
      minHeight: BOOK_H,
      maxHeight: BOOK_H,
      drawShadow: true,
      flippingTime: 700,
      usePortrait: true,
      startZIndex: 10,
      autoSize: false,
      maxShadowOpacity: 0.5,
      showCover: true,
      mobileScrollSupport: false,
      clickEventForward: true,
      useMouseEvents: true,
      swipeDistance: 30,
      showPageCorners: true,
      disableFlipByClick: false,
    });

    pf.loadFromHTML(bookRef.current.querySelectorAll('.page'));
    pf.on('flip', (e) => setCurrentPage(e.data));
    flipRef.current = pf;
    setReady(true);

    return () => { try { pf.destroy(); } catch {} };
  }, []);

  const goPrev = () => flipRef.current?.flipPrev('top');
  const goNext = () => flipRef.current?.flipNext('top');
  const goTo   = (i) => flipRef.current?.flip(i);

  return (
    <div
      style={{
        width: '100vw',
        height: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
        background: 'radial-gradient(ellipse at 50% 60%, #2d1b69 0%, #1a0a2e 60%, #0d0d1f 100%)',
      }}
    >
      {/* Ambient glow */}
      <div
        style={{
          position: 'absolute',
          width: BOOK_W * 2,
          height: BOOK_H,
          borderRadius: '50%',
          background: 'radial-gradient(ellipse, rgba(168,85,247,0.15) 0%, transparent 70%)',
          pointerEvents: 'none',
        }}
      />

      <button
        className="flip-arrow left"
        onClick={goPrev}
        style={{ opacity: currentPage === 0 ? 0.2 : 1 }}
        aria-label="Previous page"
      >
        ‹
      </button>

      {/* page-flip reads .page children */}
      <div ref={bookRef}>
        <div className="page"><CoverPage /></div>
        <div className="page"><RecordPage /></div>
        <div className="page"><BinderPage /></div>
        <div className="page"><BalancePage /></div>
        <div className="page"><ProfilePage /></div>
      </div>

      <button
        className="flip-arrow right"
        onClick={goNext}
        style={{ opacity: currentPage >= PAGE_LABELS.length - 1 ? 0.2 : 1 }}
        aria-label="Next page"
      >
        ›
      </button>

      {/* Dot indicators */}
      {ready && (
        <div
          style={{
            position: 'absolute',
            bottom: 24,
            left: '50%',
            transform: 'translateX(-50%)',
            display: 'flex',
            gap: 8,
            alignItems: 'center',
          }}
        >
          {PAGE_LABELS.map((label, i) => (
            <button
              key={label}
              onClick={() => goTo(i)}
              title={label}
              style={{
                width: currentPage === i ? 24 : 8,
                height: 8,
                borderRadius: 4,
                background: currentPage === i ? '#a855f7' : 'rgba(255,255,255,0.25)',
                border: 'none',
                cursor: 'pointer',
                transition: 'all 0.3s',
                padding: 0,
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}
