import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig, Easing } from 'remotion';

interface PromptVideoProps {
  prompt: string;
  output: string;
  outputSnippet: string;
  variant: 'bad' | 'good';
  postNumber: 1 | 2;
  category: string;
}

const PINK  = '#FF2D78';
const BLUE  = '#4D9EFF';
const BG    = '#080B14';
const CARD  = '#0C1220';

// Dynamic font size: larger text when content is short, scales down for long content
function dynamicSize(text: string, min: number, max: number): number {
  const len = text.length;
  if (len < 50)  return max;
  if (len < 100) return max - (max - min) * 0.35;
  if (len < 160) return max - (max - min) * 0.65;
  return min;
}

// Canvas: 1080 × 1350
// Layout (px):
//   0-6    top accent bar
//   20-90  logo row (h=70)
//   100-148 variant label row (h=48)
//   160-690 PROMPT card (h=530)  ← ~39%
//   710-756 AI OUTPUT divider (h=46)
//   770-1240 OUTPUT card (h=470)  ← ~35%
//   1260-1320 swipe hint
//   1344-1350 bottom accent bar

export const PromptVideo: React.FC<PromptVideoProps> = ({
  prompt, outputSnippet, variant, postNumber, category,
}) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  // Good variant gets equal visual weight — same border thickness, brighter card bg
  const accent     = variant === 'bad' ? PINK : BLUE;
  const cardBg     = variant === 'bad' ? '#0C1220' : '#0A1525';
  const cardBorder = variant === 'bad' ? `${PINK}30` : `${BLUE}45`; // good slightly stronger
  const label      = variant === 'bad' ? '✗  BAD PROMPT' : '✓  WELL PROMPTED';
  const promptSize = dynamicSize(prompt, 24, 40);
  const outputSize = dynamicSize(outputSnippet, 26, 42);

  // Timing
  const PROMPT_START = Math.round(fps * 0.6);
  const PROMPT_END   = Math.round(fps * 2.0);
  const OUT_START    = Math.round(fps * 2.4);
  const FADE_START   = durationInFrames - fps * 0.4;

  // Animations
  const headerIn = spring({ frame, fps, from: 0, to: 1, config: { damping: 22 } });

  const promptPct = interpolate(frame, [PROMPT_START, PROMPT_END], [0, 1], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
    easing: Easing.out(Easing.ease),
  });
  const promptText = prompt.slice(0, Math.floor(promptPct * prompt.length));
  const cursorVisible = (f: number) => Math.sin(f * 0.28) > 0;

  const outOpacity = interpolate(frame, [OUT_START, OUT_START + 6], [0, 1], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
  });
  const outPct = interpolate(frame, [OUT_START, OUT_START + fps * 2.6], [0, 1], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
    easing: Easing.out(Easing.ease),
  });
  const outputText = outputSnippet.slice(0, Math.floor(outPct * outputSnippet.length));
  const showOutCursor = frame >= OUT_START && outputText.length < outputSnippet.length;

  const globalOpacity = interpolate(frame, [FADE_START, durationInFrames], [1, 0], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
  });

  return (
    <AbsoluteFill style={{ backgroundColor: BG, opacity: globalOpacity }}>

      {/* ── Top accent bar ── */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, height: 6,
        background: `linear-gradient(90deg, ${PINK}, ${BLUE})`,
        opacity: headerIn,
      }} />

      {/* ── Logo row  (top 20, height 70) ── */}
      <div style={{
        position: 'absolute', top: 20, left: 52, right: 52, height: 70,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        opacity: headerIn,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ color: '#FFF', fontWeight: 800, fontSize: 34, fontFamily: 'sans-serif', letterSpacing: -0.5 }}>well</span>
          <span style={{ color: BLUE,  fontWeight: 800, fontSize: 34, fontFamily: 'sans-serif', letterSpacing: -0.5 }}>.prompted</span>
          <span style={{ color: '#222B42', fontSize: 24, fontFamily: 'sans-serif', marginLeft: 8 }}>#{postNumber}</span>
        </div>
        <div style={{
          background: `${accent}15`, border: `1.5px solid ${accent}45`,
          borderRadius: 8, padding: '6px 18px',
          color: accent, fontSize: 20, fontFamily: 'sans-serif', fontWeight: 700, letterSpacing: 1,
        }}>
          {category.replace(/_/g, ' ')}
        </div>
      </div>

      {/* ── Variant label  (top 100, height 48) ── */}
      <div style={{
        position: 'absolute', top: 100, left: 52, height: 48,
        display: 'flex', alignItems: 'center',
        color: accent, fontSize: 22, fontWeight: 800,
        letterSpacing: 5, fontFamily: 'sans-serif',
        opacity: headerIn,
      }}>
        {label}
      </div>

      {/* ── Prompt card  (top 160 → 690, h=530) ── */}
      <div style={{
        position: 'absolute', top: 160, left: 52, right: 52, height: 530,
        background: cardBg,
        border: `1px solid ${cardBorder}`,
        borderLeft: `5px solid ${accent}`,
        borderRadius: 14,
        padding: '40px 44px',
        display: 'flex', alignItems: 'center',
        overflow: 'hidden',
      }}>
        <span style={{
          color: '#CAD6F0', fontSize: promptSize, lineHeight: 1.6,
          fontFamily: 'monospace', wordBreak: 'break-word',
        }}>
          {promptText}
          {frame < OUT_START && (
            <span style={{ color: accent, opacity: cursorVisible(frame) ? 1 : 0 }}>▋</span>
          )}
        </span>
      </div>

      {/* ── "AI OUTPUT" divider  (top 710 → 756) ── */}
      <div style={{
        position: 'absolute', top: 710, left: 52, right: 52, height: 46,
        display: 'flex', alignItems: 'center', gap: 18,
        opacity: outOpacity,
      }}>
        <div style={{ flex: 1, height: 1, background: '#182035' }} />
        <span style={{ color: '#2C3D5C', fontSize: 18, fontWeight: 700, letterSpacing: 4, fontFamily: 'sans-serif' }}>
          AI OUTPUT
        </span>
        <div style={{ flex: 1, height: 1, background: '#182035' }} />
      </div>

      {/* ── Output card  (top 770 → 1240, h=470) ── */}
      {frame >= OUT_START && (
        <div style={{
          position: 'absolute', top: 770, left: 52, right: 52, height: 470,
          background: variant === 'bad' ? '#050810' : '#060E1C',
          border: `1px solid ${variant === 'bad' ? '#111A2E' : '#152240'}`,
          borderRadius: 14,
          padding: '40px 44px',
          display: 'flex', alignItems: 'center',
          overflow: 'hidden',
          opacity: outOpacity,
        }}>
          <span style={{
            color: variant === 'bad' ? '#607090' : '#7A9EC8',
            fontSize: outputSize, lineHeight: 1.6,
            fontFamily: 'monospace', wordBreak: 'break-word',
          }}>
            {outputText}
            {showOutCursor && (
              <span style={{ color: BLUE, opacity: cursorVisible(frame) ? 1 : 0 }}>▋</span>
            )}
          </span>
        </div>
      )}

      {/* ── Swipe hint (bad variant, fades in near end) ── */}
      {variant === 'bad' && (
        <div style={{
          position: 'absolute', top: 1265, left: 0, right: 0,
          display: 'flex', justifyContent: 'center',
          opacity: interpolate(frame,
            [durationInFrames - fps * 1.8, durationInFrames - fps * 1.1],
            [0, 1],
            { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
          ),
        }}>
          <span style={{ color: BLUE, fontSize: 22, fontFamily: 'sans-serif', fontWeight: 600, letterSpacing: 3 }}>
            swipe for the fix →
          </span>
        </div>
      )}

      {/* ── Bottom accent bar ── */}
      <div style={{
        position: 'absolute', bottom: 0, left: 0, right: 0, height: 4,
        background: `linear-gradient(90deg, ${BLUE}, ${PINK})`,
        opacity: headerIn,
      }} />

    </AbsoluteFill>
  );
};
