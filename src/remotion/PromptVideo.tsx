import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig, Easing } from 'remotion';

interface PromptVideoProps {
  prompt: string;
  output: string;
  variant: 'bad' | 'good';
  postNumber: 1 | 2;
  category: string;
}

const ACCENT_PINK = '#FF2D78';
const ACCENT_BLUE = '#4D9EFF';
const BG = '#080B14';
const CARD_BG = '#0F1520';

export const PromptVideo: React.FC<PromptVideoProps> = ({ prompt, output, variant, postNumber, category }) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  const accentColor = variant === 'bad' ? ACCENT_PINK : ACCENT_BLUE;
  const label = variant === 'bad' ? '✗ BAD PROMPT' : '✓ WELL PROMPTED';

  // Timing
  const HEADER_IN = 0;
  const PROMPT_START = fps * 0.8;       // 0.8s — prompt starts appearing
  const OUTPUT_START = fps * 2.5;       // 2.5s — output starts after prompt is done
  const FADE_OUT_START = durationInFrames - fps * 0.5;

  // Header fade in
  const headerOpacity = spring({ frame, fps, from: 0, to: 1, config: { damping: 20 }, delay: HEADER_IN });

  // Prompt typewriter
  const promptProgress = interpolate(
    frame,
    [PROMPT_START, PROMPT_START + fps * 1.5],
    [0, 1],
    { extrapolateRight: 'clamp', easing: Easing.out(Easing.ease) }
  );
  const promptChars = Math.floor(promptProgress * prompt.length);
  const promptText = prompt.slice(0, promptChars);
  const showPromptCursor = frame < OUTPUT_START + fps * 0.5;

  // Output typewriter
  const outputProgress = interpolate(
    frame,
    [OUTPUT_START, OUTPUT_START + fps * 3],
    [0, 1],
    { extrapolateRight: 'clamp', easing: Easing.out(Easing.ease) }
  );
  const outputChars = Math.floor(outputProgress * output.length);
  const outputText = output.slice(0, outputChars);
  const showOutputCursor = frame >= OUTPUT_START;

  // Logo fade in
  const logoOpacity = spring({ frame, fps, from: 0, to: 1, config: { damping: 20 }, delay: fps * 0.2 });

  // Global fade out
  const globalOpacity = interpolate(frame, [FADE_OUT_START, durationInFrames], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });

  return (
    <AbsoluteFill style={{ backgroundColor: BG, opacity: globalOpacity, fontFamily: 'monospace' }}>
      {/* Top bar */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, height: 8,
        background: `linear-gradient(90deg, ${ACCENT_PINK}, ${ACCENT_BLUE})`,
        opacity: headerOpacity,
      }} />

      {/* Logo + handle */}
      <div style={{ position: 'absolute', top: 40, left: 48, opacity: logoOpacity, display: 'flex', alignItems: 'center', gap: 12 }}>
        <span style={{ color: '#FFFFFF', fontWeight: 700, fontSize: 28, fontFamily: 'sans-serif' }}>well</span>
        <span style={{ color: ACCENT_BLUE, fontWeight: 700, fontSize: 28, fontFamily: 'sans-serif' }}>.prompted</span>
        <span style={{ color: '#333A50', fontSize: 20, fontFamily: 'sans-serif', marginLeft: 8 }}>#{postNumber}</span>
      </div>

      {/* Category badge */}
      <div style={{
        position: 'absolute', top: 44, right: 48,
        background: `${accentColor}22`,
        border: `1px solid ${accentColor}44`,
        borderRadius: 6, padding: '4px 12px',
        color: accentColor, fontSize: 18, fontFamily: 'sans-serif', fontWeight: 600,
        opacity: logoOpacity,
      }}>
        {category}
      </div>

      {/* Prompt label */}
      <div style={{
        position: 'absolute', top: 140, left: 48,
        color: accentColor, fontSize: 20, fontWeight: 700,
        letterSpacing: 4, fontFamily: 'sans-serif',
        opacity: headerOpacity,
      }}>
        {label}
      </div>

      {/* Prompt box */}
      <div style={{
        position: 'absolute', top: 180, left: 48, right: 48,
        background: CARD_BG,
        border: `1px solid ${accentColor}44`,
        borderLeft: `3px solid ${accentColor}`,
        borderRadius: 8,
        padding: '28px 32px',
        minHeight: 140,
      }}>
        <span style={{ color: '#E0E0E0', fontSize: 26, lineHeight: 1.6, fontFamily: 'monospace' }}>
          {promptText}
          {showPromptCursor && promptChars < prompt.length && (
            <span style={{ color: accentColor, opacity: Math.sin(frame * 0.2) > 0 ? 1 : 0 }}>▋</span>
          )}
        </span>
      </div>

      {/* Output section */}
      {frame >= OUTPUT_START - fps * 0.2 && (
        <>
          <div style={{
            position: 'absolute', top: 380, left: 48,
            color: '#555E77', fontSize: 18, fontWeight: 600,
            letterSpacing: 3, fontFamily: 'sans-serif',
            opacity: interpolate(frame, [OUTPUT_START - fps * 0.2, OUTPUT_START], [0, 1], { extrapolateRight: 'clamp' }),
          }}>
            AI OUTPUT
          </div>

          <div style={{
            position: 'absolute', top: 416, left: 48, right: 48, bottom: 140,
            background: '#060911',
            border: '1px solid #1A2540',
            borderRadius: 8,
            padding: '24px 32px',
            overflow: 'hidden',
            opacity: interpolate(frame, [OUTPUT_START - fps * 0.2, OUTPUT_START], [0, 1], { extrapolateRight: 'clamp' }),
          }}>
            <span style={{ color: '#8899BB', fontSize: 24, lineHeight: 1.7, fontFamily: 'monospace' }}>
              {outputText}
              {showOutputCursor && outputChars < output.length && (
                <span style={{ color: ACCENT_BLUE, opacity: Math.sin(frame * 0.15) > 0 ? 1 : 0 }}>▋</span>
              )}
            </span>
          </div>
        </>
      )}

      {/* Bottom bar */}
      <div style={{
        position: 'absolute', bottom: 0, left: 0, right: 0, height: 3,
        background: `linear-gradient(90deg, ${ACCENT_BLUE}, ${ACCENT_PINK})`,
        opacity: logoOpacity,
      }} />
    </AbsoluteFill>
  );
};
