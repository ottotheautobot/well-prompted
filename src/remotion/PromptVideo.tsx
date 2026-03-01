import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig, Easing } from 'remotion';

interface PromptVideoProps {
  prompt: string;
  output: string;        // full output (not used in video, kept for compat)
  outputSnippet: string; // 1-2 sentence highlight for the video
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

  // Timing
  const PROMPT_START = Math.floor(fps * 0.8);
  const PROMPT_DONE  = Math.floor(fps * 2.4);
  const OUTPUT_START = Math.floor(fps * 2.8);
  const FADE_OUT_START = durationInFrames - fps * 0.5;

  // Header/logo fade in
  const headerOpacity = spring({ frame, fps, from: 0, to: 1, config: { damping: 20 } });

  // Prompt typewriter — ends at PROMPT_DONE
  const promptProgress = interpolate(frame, [PROMPT_START, PROMPT_DONE], [0, 1], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
    easing: Easing.out(Easing.ease),
  });
  const promptChars = Math.floor(promptProgress * prompt.length);
  const promptText = prompt.slice(0, promptChars);
  const showPromptCursor = frame < OUTPUT_START;

  // Output snippet fade in + typewriter
  const outputOpacity = interpolate(frame, [OUTPUT_START, OUTPUT_START + 8], [0, 1], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
  });
  const outputProgress = interpolate(frame, [OUTPUT_START, OUTPUT_START + fps * 2.5], [0, 1], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
    easing: Easing.out(Easing.ease),
  });
  const outputChars = Math.floor(outputProgress * outputSnippet.length);
  const outputText = outputSnippet.slice(0, outputChars);
  const showOutputCursor = frame >= OUTPUT_START && outputChars < outputSnippet.length;

  // Global fade out
  const globalOpacity = interpolate(frame, [FADE_OUT_START, durationInFrames], [1, 0], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
  });

  return (
    <AbsoluteFill style={{ backgroundColor: BG, opacity: globalOpacity, fontFamily: 'monospace' }}>

      {/* Top gradient bar */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, height: 6,
        background: `linear-gradient(90deg, ${ACCENT_PINK}, ${ACCENT_BLUE})`,
        opacity: headerOpacity,
      }} />

      {/* Logo + handle */}
      <div style={{
        position: 'absolute', top: 52, left: 52,
        display: 'flex', alignItems: 'center', gap: 10,
        opacity: headerOpacity,
      }}>
        <span style={{ color: '#FFFFFF', fontWeight: 800, fontSize: 34, fontFamily: 'sans-serif', letterSpacing: -0.5 }}>
          well
        </span>
        <span style={{ color: ACCENT_BLUE, fontWeight: 800, fontSize: 34, fontFamily: 'sans-serif', letterSpacing: -0.5 }}>
          .prompted
        </span>
        <span style={{ color: '#2A3250', fontSize: 24, fontFamily: 'sans-serif', marginLeft: 8 }}>
          #{postNumber}
        </span>
      </div>

      {/* Category badge */}
      <div style={{
        position: 'absolute', top: 56, right: 52,
        background: `${accentColor}18`,
        border: `1.5px solid ${accentColor}55`,
        borderRadius: 8, padding: '6px 16px',
        color: accentColor, fontSize: 20,
        fontFamily: 'sans-serif', fontWeight: 700,
        letterSpacing: 1,
        opacity: headerOpacity,
      }}>
        {category.replace('_', ' ')}
      </div>

      {/* Variant label */}
      <div style={{
        position: 'absolute', top: 160, left: 52,
        color: accentColor, fontSize: 22, fontWeight: 800,
        letterSpacing: 5, fontFamily: 'sans-serif',
        opacity: headerOpacity,
      }}>
        {label}
      </div>

      {/* Prompt card */}
      <div style={{
        position: 'absolute', top: 205, left: 52, right: 52,
        background: CARD_BG,
        border: `1px solid ${accentColor}40`,
        borderLeft: `4px solid ${accentColor}`,
        borderRadius: 10,
        padding: '30px 36px',
        minHeight: 130,
      }}>
        <span style={{
          color: '#D8E0F0', fontSize: 28, lineHeight: 1.55,
          fontFamily: 'monospace', wordBreak: 'break-word',
        }}>
          {promptText}
          {showPromptCursor && (
            <span style={{
              color: accentColor,
              opacity: Math.sin(frame * 0.25) > 0 ? 1 : 0,
            }}>▋</span>
          )}
        </span>
      </div>

      {/* Output section */}
      {frame >= OUTPUT_START && (
        <>
          {/* "AI OUTPUT" divider */}
          <div style={{
            position: 'absolute', top: 430, left: 52, right: 52,
            display: 'flex', alignItems: 'center', gap: 16,
            opacity: outputOpacity,
          }}>
            <div style={{ flex: 1, height: 1, background: '#1E2840' }} />
            <span style={{
              color: '#3A4A6A', fontSize: 18, fontWeight: 700,
              letterSpacing: 4, fontFamily: 'sans-serif',
            }}>
              AI OUTPUT
            </span>
            <div style={{ flex: 1, height: 1, background: '#1E2840' }} />
          </div>

          {/* Output snippet card */}
          <div style={{
            position: 'absolute', top: 478, left: 52, right: 52, bottom: 120,
            background: '#050810',
            border: '1px solid #151F35',
            borderRadius: 10,
            padding: '36px 40px',
            display: 'flex', alignItems: 'center',
            opacity: outputOpacity,
          }}>
            <span style={{
              color: '#7A8FB5',
              fontSize: 34,
              lineHeight: 1.55,
              fontFamily: 'monospace',
              wordBreak: 'break-word',
            }}>
              {outputText}
              {showOutputCursor && (
                <span style={{
                  color: ACCENT_BLUE,
                  opacity: Math.sin(frame * 0.18) > 0 ? 1 : 0,
                }}>▋</span>
              )}
            </span>
          </div>
        </>
      )}

      {/* Swipe hint (bad variant only, appears near end) */}
      {variant === 'bad' && frame > durationInFrames - fps * 2 && (
        <div style={{
          position: 'absolute', bottom: 48, left: 52, right: 52,
          display: 'flex', justifyContent: 'center',
          opacity: interpolate(frame, [durationInFrames - fps * 2, durationInFrames - fps * 1.5], [0, 1], { extrapolateRight: 'clamp' }),
        }}>
          <span style={{
            color: ACCENT_BLUE, fontSize: 22, fontFamily: 'sans-serif',
            fontWeight: 600, letterSpacing: 2,
          }}>
            swipe for the fix →
          </span>
        </div>
      )}

      {/* Bottom gradient bar */}
      <div style={{
        position: 'absolute', bottom: 0, left: 0, right: 0, height: 4,
        background: `linear-gradient(90deg, ${ACCENT_BLUE}, ${ACCENT_PINK})`,
        opacity: headerOpacity,
      }} />
    </AbsoluteFill>
  );
};
