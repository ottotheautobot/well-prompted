import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig, Easing } from 'remotion';

export interface TipCardProps {
  title: string;         // e.g. "5 Prompts That Save Hours Every Week"
  tips: string[];        // array of tip strings (max 7)
  tipNumber: number;     // which slide this is (1-based, 0 = title card)
  totalTips: number;
  category: string;
  accentStyle: 'blue' | 'pink' | 'gradient';
}

const ACCENT_PINK = '#FF2D78';
const ACCENT_BLUE = '#4D9EFF';
const BG = '#080B14';
const CARD_BG = '#0F1520';

export const TipCard: React.FC<TipCardProps> = ({
  title,
  tips,
  tipNumber,
  totalTips,
  category,
  accentStyle,
}) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  const accentColor = accentStyle === 'pink' ? ACCENT_PINK : ACCENT_BLUE;
  const isTitleCard = tipNumber === 0;

  const fadeIn = spring({ frame, fps, from: 0, to: 1, config: { damping: 18 } });
  const slideUp = interpolate(spring({ frame, fps, from: 0, to: 1, config: { damping: 14 } }), [0, 1], [40, 0]);
  const fadeOut = interpolate(frame, [durationInFrames - fps * 0.5, durationInFrames], [1, 0], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
  });

  return (
    <AbsoluteFill style={{ backgroundColor: BG, opacity: fadeOut }}>
      {/* Top bar */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, height: 6,
        background: `linear-gradient(90deg, ${ACCENT_PINK}, ${ACCENT_BLUE})`,
        opacity: fadeIn,
      }} />

      {/* Logo */}
      <div style={{
        position: 'absolute', top: 32, left: 52, right: 52,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        opacity: fadeIn,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ color: '#FFF', fontWeight: 800, fontSize: 30, fontFamily: 'sans-serif' }}>well</span>
          <span style={{ color: ACCENT_BLUE, fontWeight: 800, fontSize: 30, fontFamily: 'sans-serif' }}>.prompted</span>
        </div>
        <div style={{
          background: `${accentColor}18`, border: `1.5px solid ${accentColor}50`,
          borderRadius: 8, padding: '4px 14px',
          color: accentColor, fontSize: 18, fontFamily: 'sans-serif', fontWeight: 700,
        }}>
          {category.replace(/_/g, ' ')}
        </div>
      </div>

      {isTitleCard ? (
        /* Title card layout */
        <div style={{
          position: 'absolute', top: 0, bottom: 0, left: 0, right: 0,
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          padding: '0 80px',
          opacity: fadeIn,
          transform: `translateY(${slideUp}px)`,
        }}>
          <div style={{
            color: accentColor, fontSize: 22, fontWeight: 800,
            letterSpacing: 6, fontFamily: 'sans-serif', marginBottom: 32,
          }}>
            {totalTips} TIPS
          </div>
          <div style={{
            color: '#FFFFFF', fontSize: 52, fontWeight: 800,
            fontFamily: 'sans-serif', textAlign: 'center',
            lineHeight: 1.2, letterSpacing: -1,
          }}>
            {title}
          </div>
          <div style={{
            marginTop: 48, color: ACCENT_BLUE,
            fontSize: 22, fontFamily: 'sans-serif', fontWeight: 600, letterSpacing: 2,
          }}>
            swipe to start →
          </div>
        </div>
      ) : (
        /* Tip card layout */
        <>
          {/* Progress dots */}
          <div style={{
            position: 'absolute', top: 108, left: 52,
            display: 'flex', gap: 8, opacity: fadeIn,
          }}>
            {Array.from({ length: totalTips }).map((_, i) => (
              <div key={i} style={{
                width: i + 1 === tipNumber ? 24 : 8, height: 8,
                borderRadius: 4,
                background: i + 1 === tipNumber ? accentColor : '#1A2540',
                transition: 'all 0.3s',
              }} />
            ))}
          </div>

          {/* Tip number */}
          <div style={{
            position: 'absolute', top: 148, left: 52,
            color: accentColor, fontSize: 20, fontWeight: 800,
            letterSpacing: 5, fontFamily: 'sans-serif',
            opacity: fadeIn,
          }}>
            TIP {tipNumber} OF {totalTips}
          </div>

          {/* Tip content */}
          <div style={{
            position: 'absolute', top: 210, left: 52, right: 52, bottom: 160,
            background: CARD_BG,
            border: `1px solid ${accentColor}30`,
            borderLeft: `5px solid ${accentColor}`,
            borderRadius: 14,
            padding: '52px 52px',
            display: 'flex', alignItems: 'center',
            opacity: fadeIn,
            transform: `translateY(${slideUp}px)`,
          }}>
            <span style={{
              color: '#E0E8FF', fontSize: 38, lineHeight: 1.55,
              fontFamily: 'sans-serif', fontWeight: 600,
              wordBreak: 'break-word',
            }}>
              {tips[tipNumber - 1] || ''}
            </span>
          </div>

          {/* Swipe hint on last tip */}
          {tipNumber === totalTips && (
            <div style={{
              position: 'absolute', bottom: 48, left: 52, right: 52,
              display: 'flex', justifyContent: 'center',
              opacity: fadeIn,
            }}>
              <span style={{ color: '#2E3D5A', fontSize: 20, fontFamily: 'sans-serif', fontWeight: 600, letterSpacing: 2 }}>
                save this for later
              </span>
            </div>
          )}
        </>
      )}

      {/* Bottom bar */}
      <div style={{
        position: 'absolute', bottom: 0, left: 0, right: 0, height: 4,
        background: `linear-gradient(90deg, ${ACCENT_BLUE}, ${ACCENT_PINK})`,
        opacity: fadeIn,
      }} />
    </AbsoluteFill>
  );
};
