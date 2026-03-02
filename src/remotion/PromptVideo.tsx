import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig, Easing } from 'remotion';

// 1080 × 1920 (9:16 Reel format)

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
const CARD   = '#0C1220';
const CARD2  = '#0A1525';
const BORDER = '#1A2540';

// Fill-based font sizing: largest font that fits the box
function fillFontSize(text: string, boxH: number, boxW: number, min = 18, max = 60): number {
  const usableH = boxH - 72;
  const usableW = boxW - 88;
  const ratio   = 0.58;
  const lh      = 1.65;
  let lo = min, hi = max;
  while (lo < hi - 1) {
    const mid = Math.floor((lo + hi) / 2);
    const cpl = usableW / (mid * ratio);
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

export const PromptVideo: React.FC<PromptVideoProps> = ({
  okayPrompt, wellPrompt, whyBreakdown, category, postNumber,
}) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  // Layout (px) — 1080 × 1920
  const CARD_W       = 1080 - 88;          // 992px (44px margin each side)
  const OKAY_H       = 480;
  const WELL_H       = 480;
  const OKAY_TOP     = 152;
  const WELL_TOP     = OKAY_TOP + OKAY_H + 62;  // 694
  const WHY_TOP      = WELL_TOP + WELL_H + 58;  // 1232
  const WHY_H        = 1920 - WHY_TOP - 50;     // ~638px for breakdown

  const okaySize = fillFontSize(okayPrompt, OKAY_H, CARD_W, 18, 52);
  const wellSize = fillFontSize(wellPrompt, WELL_H, CARD_W, 18, 52);

  // Timing
  const WELL_START  = Math.round(fps * 1.5);
  const typeDur     = Math.round(fps * Math.max(4, wellPrompt.length / 28));
  const WELL_END    = WELL_START + typeDur;
  const WHY_START   = WELL_END + Math.round(fps * 0.6);
  const HOLD_START  = durationInFrames - fps * 12;
  const FADE_START  = durationInFrames - fps * 0.4;

  // Animations
  const headerIn    = spring({ frame, fps, from: 0, to: 1, config: { damping: 22 } });
  const globalAlpha = interpolate(frame, [FADE_START, durationInFrames], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const cursorBlink = Math.sin(frame * 0.3) > 0;

  // Well prompt typing
  const typeProgress = interpolate(
    Math.min(frame, HOLD_START),
    [WELL_START, WELL_END],
    [0, 1],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.out(Easing.ease) }
  );
  const visibleWell = Math.floor(typeProgress * wellPrompt.length);
  const wellOpacity = interpolate(frame, [WELL_START, WELL_START + 6], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });

  // Why breakdown — items stagger in
  const whyOpacity = interpolate(frame, [WHY_START, WHY_START + 10], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });

  const itemDelay = Math.round(fps * 0.45);
  const itemFade  = Math.round(fps * 0.3);

  return (
    <AbsoluteFill style={{ backgroundColor: BG, opacity: globalAlpha }}>

      {/* Top accent bar */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, height: 8,
        background: `linear-gradient(90deg, ${PINK}, ${BLUE})`,
        opacity: headerIn,
      }} />

      {/* Logo row */}
      <div style={{
        position: 'absolute', top: 22, left: 44, right: 44, height: 64,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        opacity: headerIn,
      }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 0 }}>
          <span style={{ color: '#FFF', fontWeight: 800, fontSize: 30, fontFamily: 'sans-serif' }}>well</span>
          <span style={{ color: BLUE,  fontWeight: 800, fontSize: 30, fontFamily: 'sans-serif' }}>.prompted</span>
        </div>
        <span style={{
          color: '#2C3D5C', fontSize: 16, fontFamily: 'sans-serif',
          fontWeight: 700, letterSpacing: 2,
        }}>
          {category.replace(/_/g,' ').toUpperCase()}
        </span>
      </div>

      {/* ── OKAY PROMPT ── */}
      {/* Label */}
      <div style={{
        position: 'absolute', top: 100, left: 44,
        color: PINK, fontSize: 17, fontWeight: 800,
        letterSpacing: 5, fontFamily: 'sans-serif',
        opacity: headerIn,
      }}>
        ↓  OKAY PROMPT
      </div>

      {/* Card */}
      <div style={{
        position: 'absolute', top: OKAY_TOP, left: 44, right: 44, height: OKAY_H,
        background: CARD,
        border: `1px solid ${PINK}30`,
        borderLeft: `5px solid ${PINK}`,
        borderRadius: 14,
        padding: '32px 40px',
        display: 'flex', alignItems: 'center',
        overflow: 'hidden',
        opacity: headerIn,
      }}>
        <span style={{ color: '#B0BCCF', fontSize: okaySize, lineHeight: 1.65, fontFamily: 'monospace', wordBreak: 'break-word' }}>
          {okayPrompt}
        </span>
      </div>

      {/* ── WELL PROMPTED ── */}
      {/* Label */}
      <div style={{
        position: 'absolute', top: OKAY_TOP + OKAY_H + 18, left: 44,
        color: BLUE, fontSize: 17, fontWeight: 800,
        letterSpacing: 5, fontFamily: 'sans-serif',
        opacity: wellOpacity,
      }}>
        ✓  WELL PROMPTED
      </div>

      {/* Card */}
      <div style={{
        position: 'absolute', top: WELL_TOP, left: 44, right: 44, height: WELL_H,
        background: CARD2,
        border: `1px solid ${BLUE}45`,
        borderLeft: `5px solid ${BLUE}`,
        borderRadius: 14,
        padding: '32px 40px',
        display: 'flex', alignItems: 'center',
        overflow: 'hidden',
        opacity: wellOpacity,
      }}>
        <span style={{ color: '#CAD6F0', fontSize: wellSize, lineHeight: 1.65, fontFamily: 'monospace', wordBreak: 'break-word' }}>
          {wellPrompt.slice(0, visibleWell)}
          {visibleWell < wellPrompt.length && (
            <span style={{ color: BLUE, opacity: cursorBlink ? 1 : 0 }}>▋</span>
          )}
        </span>
      </div>

      {/* ── WHY THIS WORKS ── */}
      {frame >= WHY_START && (
        <div style={{
          position: 'absolute', top: WHY_TOP, left: 44, right: 44,
          opacity: whyOpacity,
        }}>
          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 20 }}>
            <span style={{ color: '#2C3D5C', fontSize: 14, fontWeight: 800, letterSpacing: 4, fontFamily: 'sans-serif' }}>
              WHY THIS WORKS
            </span>
            <div style={{ flex: 1, height: 1, background: BORDER }} />
          </div>

          {/* Breakdown items */}
          {whyBreakdown.map((item, i) => {
            const itemStart = WHY_START + Math.round(fps * 0.3) + i * itemDelay;
            const itemOpacity = interpolate(frame, [itemStart, itemStart + itemFade], [0, 1], {
              extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
            });
            const itemY = interpolate(frame, [itemStart, itemStart + itemFade], [12, 0], {
              extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
            });

            return (
              <div key={i} style={{
                display: 'flex', gap: 16, marginBottom: 22,
                opacity: itemOpacity,
                transform: `translateY(${itemY}px)`,
              }}>
                <span style={{
                  color: BLUE, fontWeight: 800, fontSize: 18,
                  fontFamily: 'sans-serif', flexShrink: 0, marginTop: 2,
                  width: 24, textAlign: 'right',
                }}>
                  {i + 1}.
                </span>
                <div>
                  <div style={{ color: '#E2E8F0', fontSize: 18, fontWeight: 700, fontFamily: 'sans-serif', lineHeight: 1.3 }}>
                    {item.title}
                  </div>
                  <div style={{ color: '#6B7A90', fontSize: 16, fontFamily: 'sans-serif', lineHeight: 1.5, marginTop: 4 }}>
                    {item.description}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Bottom accent bar */}
      <div style={{
        position: 'absolute', bottom: 0, left: 0, right: 0, height: 4,
        background: `linear-gradient(90deg, ${BLUE}, ${PINK})`,
        opacity: headerIn,
      }} />

    </AbsoluteFill>
  );
};
