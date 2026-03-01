import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig, Easing } from 'remotion';

interface PromptVideoProps {
  prompt: string;
  output: string;
  outputSnippet: string;
  variant: 'bad' | 'good';
  postNumber: 1 | 2;
  category: string;
}

const ACCENT_PINK = '#FF2D78';
const ACCENT_BLUE = '#4D9EFF';
const BG = '#080B14';
const CARD_BG = '#0F1520';

export const PromptVideo: React.FC<PromptVideoProps> = ({
  prompt,
  outputSnippet,
  variant,
  postNumber,
  category,
}) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  const accentColor = variant === 'bad' ? ACCENT_PINK : ACCENT_BLUE;
  const label = variant === 'bad' ? '✗ BAD PROMPT' : '✓ WELL PROMPTED';

  // Layout constants — 1080x1350
  // Header: 0–130px
  // Prompt card: 130–700px (~570px, ~42%)
  // Divider: 700–740px
  // Output card: 740–1250px (~510px, ~38%)
  // Footer: 1250–1350px

  const HEADER_H = 130;
  const PROMPT_TOP = 140;
  const PROMPT_BOTTOM = 690;   // ~550px
  const DIVIDER_TOP = 700;
  const OUTPUT_TOP = 750;
  const OUTPUT_BOTTOM = 1240;  // ~490px
  const FOOTER_TOP = 1260;

  // Timing
  const PROMPT_START = Math.floor(fps * 0.7);
  const PROMPT_DONE  = Math.floor(fps * 2.2);
  const OUTPUT_START = Math.floor(fps * 2.6);
  const FADE_OUT_START = durationInFrames - fps * 0.5;

  const headerOpacity = spring({ frame, fps, from: 0, to: 1, config: { damping: 20 } });

  const promptProgress = interpolate(frame, [PROMPT_START, PROMPT_DONE], [0, 1], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
    easing: Easing.out(Easing.ease),
  });
  const promptChars = Math.floor(promptProgress * prompt.length);
  const promptText = prompt.slice(0, promptChars);
  const showPromptCursor = frame < OUTPUT_START;

  const outputOpacity = interpolate(frame, [OUTPUT_START, OUTPUT_START + 8], [0, 1], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
  });
  const outputProgress = interpolate(frame, [OUTPUT_START, OUTPUT_START + fps * 2.8], [0, 1], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
    easing: Easing.out(Easing.ease),
  });
  const outputChars = Math.floor(outputProgress * outputSnippet.length);
  const outputText = outputSnippet.slice(0, outputChars);
  const showOutputCursor = frame >= OUTPUT_START && outputChars < outputSnippet.length;

  const globalOpacity = interpolate(frame, [FADE_OUT_START, durationInFrames], [1, 0], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
  });

  return (
    <AbsoluteFill style={{ backgroundColor: BG, opacity: globalOpacity }}>

      {/* Top accent bar */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, height: 6,
        background: `linear-gradient(90deg, ${ACCENT_PINK}, ${ACCENT_BLUE})`,
        opacity: headerOpacity,
      }} />

      {/* Logo row */}
      <div style={{
        position: 'absolute', top: 30, left: 52, right: 52,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        opacity: headerOpacity,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ color: '#FFFFFF', fontWeight: 800, fontSize: 32, fontFamily: 'sans-serif', letterSpacing: -0.5 }}>well</span>
          <span style={{ color: ACCENT_BLUE, fontWeight: 800, fontSize: 32, fontFamily: 'sans-serif', letterSpacing: -0.5 }}>.prompted</span>
          <span style={{ color: '#252D45', fontSize: 22, fontFamily: 'sans-serif', marginLeft: 6 }}>#{postNumber}</span>
        </div>
        <div style={{
          background: `${accentColor}18`, border: `1.5px solid ${accentColor}50`,
          borderRadius: 8, padding: '5px 16px',
          color: accentColor, fontSize: 19, fontFamily: 'sans-serif', fontWeight: 700, letterSpacing: 1,
        }}>
          {category.replace(/_/g, ' ')}
        </div>
      </div>

      {/* Variant label */}
      <div style={{
        position: 'absolute', top: HEADER_H, left: 52,
        color: accentColor, fontSize: 21, fontWeight: 800,
        letterSpacing: 5, fontFamily: 'sans-serif',
        opacity: headerOpacity,
      }}>
        {label}
      </div>

      {/* Prompt card — ~550px tall */}
      <div style={{
        position: 'absolute',
        top: PROMPT_TOP, left: 52, right: 52,
        height: PROMPT_BOTTOM - PROMPT_TOP,
        background: CARD_BG,
        border: `1px solid ${accentColor}35`,
        borderLeft: `4px solid ${accentColor}`,
        borderRadius: 12,
        padding: '32px 40px',
        display: 'flex', alignItems: 'center',
        overflow: 'hidden',
      }}>
        <span style={{
          color: '#D0DAF0', fontSize: 30, lineHeight: 1.6,
          fontFamily: 'monospace', wordBreak: 'break-word',
        }}>
          {promptText}
          {showPromptCursor && (
            <span style={{ color: accentColor, opacity: Math.sin(frame * 0.25) > 0 ? 1 : 0 }}>▋</span>
          )}
        </span>
      </div>

      {/* Divider */}
      <div style={{
        position: 'absolute', top: DIVIDER_TOP, left: 52, right: 52,
        display: 'flex', alignItems: 'center', gap: 16,
        opacity: interpolate(frame, [OUTPUT_START - fps * 0.3, OUTPUT_START], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }),
      }}>
        <div style={{ flex: 1, height: 1, background: '#1A2440' }} />
        <span style={{ color: '#2E3D5A', fontSize: 17, fontWeight: 700, letterSpacing: 4, fontFamily: 'sans-serif' }}>
          AI OUTPUT
        </span>
        <div style={{ flex: 1, height: 1, background: '#1A2440' }} />
      </div>

      {/* Output card — ~490px tall */}
      {frame >= OUTPUT_START && (
        <div style={{
          position: 'absolute',
          top: OUTPUT_TOP, left: 52, right: 52,
          height: OUTPUT_BOTTOM - OUTPUT_TOP,
          background: '#050810',
          border: '1px solid #141E32',
          borderRadius: 12,
          padding: '36px 40px',
          display: 'flex', alignItems: 'center',
          overflow: 'hidden',
          opacity: outputOpacity,
        }}>
          <span style={{
            color: '#6B80AA',
            fontSize: 33,
            lineHeight: 1.6,
            fontFamily: 'monospace',
            wordBreak: 'break-word',
          }}>
            {outputText}
            {showOutputCursor && (
              <span style={{ color: ACCENT_BLUE, opacity: Math.sin(frame * 0.18) > 0 ? 1 : 0 }}>▋</span>
            )}
          </span>
        </div>
      )}

      {/* Swipe hint on bad variant */}
      {variant === 'bad' && (
        <div style={{
          position: 'absolute', bottom: 28, left: 52, right: 52,
          display: 'flex', justifyContent: 'center',
          opacity: interpolate(frame, [durationInFrames - fps * 1.8, durationInFrames - fps * 1.2], [0, 1], {
            extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
          }),
        }}>
          <span style={{ color: ACCENT_BLUE, fontSize: 22, fontFamily: 'sans-serif', fontWeight: 600, letterSpacing: 2 }}>
            swipe for the fix →
          </span>
        </div>
      )}

      {/* Bottom accent bar */}
      <div style={{
        position: 'absolute', bottom: 0, left: 0, right: 0, height: 4,
        background: `linear-gradient(90deg, ${ACCENT_BLUE}, ${ACCENT_PINK})`,
        opacity: headerOpacity,
      }} />
    </AbsoluteFill>
  );
};
