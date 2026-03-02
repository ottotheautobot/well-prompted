import {
  AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig, Easing,
} from 'remotion';

// 1080 × 1920  |  9:16 Reel  |  3 pages

export interface WhyItem {
  title: string;
  description: string;
}

interface PromptVideoProps {
  okayPrompt: string;
  wellPrompt: string;
  whyBreakdown: WhyItem[];
  category: string;
  postNumber: number;
}

const BLUE   = '#0085FF';
const PINK   = '#FF2D78';
const BG     = '#080B14';
const BORDER = '#1A2540';

const W = 1080;
const H = 1920;
const MX = 52; // horizontal margin

// Largest font that fits the given box at ~82% height usage
function fillFontSize(
  text: string,
  boxH: number,
  boxW: number,
  min = 22,
  max = 80,
): number {
  const usableH = boxH - 80;
  const usableW = boxW - 96;
  const ratio = 0.56;
  const lh    = 1.65;
  let lo = min, hi = max;
  while (lo < hi - 1) {
    const mid = Math.floor((lo + hi) / 2);
    const cpl   = usableW / (mid * ratio);
    const words = text.split(' ');
    let lines = 1, lc = 0;
    for (const w of words) {
      if (lc + w.length + 1 > cpl && lc > 0) { lines++; lc = w.length + 1; }
      else lc += w.length + 1;
    }
    lines += (text.match(/\n/g) || []).length;
    if (lines * mid * lh <= usableH * 0.82) lo = mid;
    else hi = mid;
  }
  return lo;
}

// Cross-fade opacity for a page given its start/end frames + transition length
function pageOpacity(
  frame: number,
  start: number,
  end: number,
  fadeDur: number,
): number {
  const fadeIn  = interpolate(frame, [start, start + fadeDur], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const fadeOut = interpolate(frame, [end,   end  + fadeDur], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  return Math.min(fadeIn, fadeOut);
}

// Logo row — shared across pages
const Logo: React.FC<{ category: string; opacity: number }> = ({ category, opacity }) => (
  <div style={{
    position: 'absolute', top: 24, left: MX, right: MX, height: 60,
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    opacity,
  }}>
    <div style={{ display: 'flex', alignItems: 'baseline' }}>
      <span style={{ color: '#FFF',  fontWeight: 800, fontSize: 30, fontFamily: 'sans-serif' }}>well</span>
      <span style={{ color: BLUE,   fontWeight: 800, fontSize: 30, fontFamily: 'sans-serif' }}>.prompted</span>
    </div>
    <span style={{ color: '#2C3D5C', fontSize: 15, fontWeight: 700, letterSpacing: 2.5, fontFamily: 'sans-serif' }}>
      {category.replace(/_/g,' ').toUpperCase()}
    </span>
  </div>
);

// Accent bars
const AccentBars: React.FC<{ opacity: number }> = ({ opacity }) => (
  <>
    <div style={{ position:'absolute', top:0, left:0, right:0, height:8, background:`linear-gradient(90deg,${PINK},${BLUE})`, opacity }} />
    <div style={{ position:'absolute', bottom:0, left:0, right:0, height:4, background:`linear-gradient(90deg,${BLUE},${PINK})`, opacity }} />
  </>
);

export const PromptVideo: React.FC<PromptVideoProps> = ({
  okayPrompt, wellPrompt, whyBreakdown, category,
}) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  const FADE = Math.round(fps * 0.4);

  // Page timing
  const P1_START = 0;
  const P1_END   = Math.round(fps * 5);
  const P2_START = P1_END;
  const P2_END   = Math.round(fps * 13.5);
  const P3_START = P2_END;
  const P3_END   = durationInFrames - FADE;

  // Global spring-in for accent bars / logo
  const globalIn = spring({ frame, fps, from: 0, to: 1, config: { damping: 22 } });

  // Per-page opacities
  const op1 = pageOpacity(frame, P1_START, P1_END, FADE);
  const op2 = pageOpacity(frame, P2_START, P2_END, FADE);
  const op3 = pageOpacity(frame, P3_START, P3_END, FADE);

  // Card dimensions — full height between logo and bottom bar
  const CARD_TOP = 106;
  const CARD_BOT = H - 28;
  const CARD_H   = CARD_BOT - CARD_TOP;
  const CARD_W   = W - MX * 2;

  const okaySize = fillFontSize(okayPrompt, CARD_H, CARD_W, 26, 80);
  const wellSize = fillFontSize(wellPrompt, CARD_H, CARD_W, 26, 80);

  // Why breakdown item animations
  const itemDelay = Math.round(fps * 0.5);
  const itemFade  = Math.round(fps * 0.35);

  return (
    <AbsoluteFill style={{ backgroundColor: BG, overflow: 'hidden' }}>

      <AccentBars opacity={globalIn} />
      <Logo category={category} opacity={globalIn} />

      {/* ══════════════════ PAGE 1 — OKAY PROMPT ══════════════════ */}
      <div style={{ position: 'absolute', inset: 0, opacity: op1 }}>
        {/* Label */}
        <div style={{
          position: 'absolute', top: CARD_TOP, left: MX,
          display: 'flex', alignItems: 'center', gap: 12,
          paddingBottom: 14,
        }}>
          <div style={{ width: 4, height: 22, borderRadius: 2, background: PINK }} />
          <span style={{ color: PINK, fontSize: 15, fontWeight: 800, letterSpacing: 5, fontFamily: 'sans-serif' }}>
            OKAY PROMPT
          </span>
        </div>

        {/* Card */}
        <div style={{
          position: 'absolute',
          top: CARD_TOP + 50,
          left: MX, right: MX,
          bottom: 28,
          background: '#0B1220',
          border: `1px solid ${PINK}28`,
          borderLeft: `5px solid ${PINK}`,
          borderRadius: 18,
          padding: '44px 48px',
          display: 'flex', alignItems: 'center',
          overflow: 'hidden',
        }}>
          <span style={{
            color: '#A8B8CC',
            fontSize: okaySize,
            lineHeight: 1.65,
            fontFamily: 'monospace',
            wordBreak: 'break-word',
          }}>
            {okayPrompt}
          </span>
        </div>
      </div>

      {/* ══════════════════ PAGE 2 — WELL PROMPTED ══════════════════ */}
      <div style={{ position: 'absolute', inset: 0, opacity: op2 }}>
        {/* Label */}
        <div style={{
          position: 'absolute', top: CARD_TOP, left: MX,
          display: 'flex', alignItems: 'center', gap: 12,
          paddingBottom: 14,
        }}>
          <div style={{ width: 4, height: 22, borderRadius: 2, background: BLUE }} />
          <span style={{ color: BLUE, fontSize: 15, fontWeight: 800, letterSpacing: 5, fontFamily: 'sans-serif' }}>
            WELL PROMPTED
          </span>
        </div>

        {/* Card */}
        <div style={{
          position: 'absolute',
          top: CARD_TOP + 50,
          left: MX, right: MX,
          bottom: 28,
          background: '#091525',
          border: `1px solid ${BLUE}40`,
          borderLeft: `5px solid ${BLUE}`,
          borderRadius: 18,
          padding: '44px 48px',
          display: 'flex', alignItems: 'center',
          overflow: 'hidden',
        }}>
          <span style={{
            color: '#C8D8F0',
            fontSize: wellSize,
            lineHeight: 1.65,
            fontFamily: 'monospace',
            wordBreak: 'break-word',
          }}>
            {wellPrompt}
          </span>
        </div>
      </div>

      {/* ══════════════════ PAGE 3 — WHY THIS WORKS ══════════════════ */}
      <div style={{ position: 'absolute', inset: 0, opacity: op3 }}>
        {/* Header */}
        <div style={{
          position: 'absolute', top: CARD_TOP, left: MX, right: MX,
          display: 'flex', alignItems: 'center', gap: 16,
        }}>
          <div style={{ width: 4, height: 22, borderRadius: 2, background: BLUE }} />
          <span style={{ color: '#2C3D5C', fontSize: 15, fontWeight: 800, letterSpacing: 5, fontFamily: 'sans-serif' }}>
            WHY THIS WORKS
          </span>
          <div style={{ flex: 1, height: 1, background: BORDER }} />
        </div>

        {/* Items */}
        <div style={{
          position: 'absolute',
          top: CARD_TOP + 54,
          left: MX, right: MX, bottom: 28,
          display: 'flex', flexDirection: 'column', justifyContent: 'center',
          gap: 28,
        }}>
          {whyBreakdown.map((item, i) => {
            const itemStart = P3_START + Math.round(fps * 0.3) + i * itemDelay;
            const iOp = interpolate(frame, [itemStart, itemStart + itemFade], [0, 1], {
              extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
            });
            const iY = interpolate(frame, [itemStart, itemStart + itemFade], [18, 0], {
              extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
            });

            return (
              <div key={i} style={{
                display: 'flex', gap: 22,
                opacity: iOp, transform: `translateY(${iY}px)`,
              }}>
                {/* Number */}
                <div style={{
                  width: 44, height: 44, borderRadius: 12,
                  background: `${BLUE}18`, border: `1px solid ${BLUE}30`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: BLUE, fontSize: 20, fontWeight: 800, fontFamily: 'sans-serif',
                  flexShrink: 0, marginTop: 2,
                }}>
                  {i + 1}
                </div>
                {/* Text */}
                <div>
                  <div style={{
                    color: '#E2E8F0', fontSize: 26, fontWeight: 700,
                    fontFamily: 'sans-serif', lineHeight: 1.2, marginBottom: 8,
                  }}>
                    {item.title}
                  </div>
                  <div style={{
                    color: '#5A6880', fontSize: 20, fontFamily: 'sans-serif', lineHeight: 1.55,
                  }}>
                    {item.description}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

    </AbsoluteFill>
  );
};
