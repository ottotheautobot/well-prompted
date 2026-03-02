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
const BLUE  = '#0085FF';
const BG    = '#080B14';
const CARD  = '#0C1220';

// Calculate the largest font size that fills ~80% of the available box height
function fillFontSize(text: string, boxHeight: number, boxWidth: number, min = 20, max = 88): number {
  const usableH = boxHeight - 72;  // 36px top + bottom padding
  const usableW = boxWidth - 88;   // 44px left + right padding
  const lineHeight = 1.65;
  const charWidthRatio = 0.58;     // monospace character width as fraction of fontSize

  let lo = min, hi = max;
  while (lo < hi - 1) {
    const mid = Math.floor((lo + hi) / 2);
    const charsPerLine = usableW / (mid * charWidthRatio);
    // Count lines accounting for word wrap
    const words = text.split(' ');
    let lines = 1, lineChars = 0;
    for (const word of words) {
      if (lineChars + word.length + 1 > charsPerLine && lineChars > 0) {
        lines++; lineChars = word.length + 1;
      } else {
        lineChars += word.length + 1;
      }
    }
    // Also count explicit newlines
    lines += (text.match(/\n/g) || []).length;
    const heightNeeded = lines * mid * lineHeight;
    if (heightNeeded <= usableH * 0.82) lo = mid;
    else hi = mid;
  }
  return lo;
}

// Parse text into segments for formatted rendering
function parseSegments(text: string): Array<{ type: 'bullet' | 'numbered' | 'text'; content: string; num?: string }> {
  return text.split('\n').filter(l => l.trim()).map(line => {
    const t = line.trim();
    if (/^[-*•]\s/.test(t)) return { type: 'bullet', content: t.replace(/^[-*•]\s+/, '') };
    const numMatch = t.match(/^(\d+)[.)]\s+(.*)/);
    if (numMatch) return { type: 'numbered', content: numMatch[2], num: numMatch[1] };
    return { type: 'text', content: t };
  });
}

// Animated formatted text component
const FormattedText: React.FC<{ text: string; fontSize: number; color: string; visibleChars: number; cursorVisible: boolean; accentColor: string }> = ({
  text, fontSize, color, visibleChars, cursorVisible, accentColor
}) => {
  const segments = parseSegments(text);
  let charCount = 0;
  const lineHeight = fontSize * 1.65;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: fontSize * 0.55 }}>
      {segments.map((seg, si) => {
        const prefix = seg.type === 'bullet' ? '• ' : seg.type === 'numbered' ? `${seg.num}. ` : '';
        const fullLine = prefix + seg.content;
        const lineStart = charCount;
        charCount += fullLine.length;
        const lineVisible = Math.max(0, visibleChars - lineStart);
        const visibleText = fullLine.slice(0, lineVisible);
        const isLastVisible = visibleChars > lineStart && visibleChars <= lineStart + fullLine.length;

        return (
          <div key={si} style={{ display: 'flex', gap: 0, alignItems: 'flex-start', lineHeight: `${lineHeight}px` }}>
            {seg.type !== 'text' && (
              <span style={{
                color: accentColor, fontWeight: 700, marginRight: 8, flexShrink: 0,
                fontSize, opacity: lineVisible > 0 ? 1 : 0,
              }}>
                {seg.type === 'bullet' ? '•' : `${seg.num}.`}
              </span>
            )}
            <span style={{ color, fontSize, fontFamily: 'monospace', wordBreak: 'break-word' }}>
              {seg.type !== 'text' ? visibleText.slice(prefix.length) : visibleText}
              {isLastVisible && <span style={{ color: accentColor, opacity: cursorVisible ? 1 : 0 }}>▋</span>}
            </span>
          </div>
        );
      })}
    </div>
  );
};

export const PromptVideo: React.FC<PromptVideoProps> = ({
  prompt, outputSnippet, variant, postNumber, category,
}) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  const accent      = variant === 'bad' ? PINK : BLUE;
  const label       = variant === 'bad' ? '↓  OKAY PROMPT' : '✓  WELL PROMPTED';
  const cardBg      = variant === 'bad' ? '#0C1220' : '#0A1525';
  const cardBorder  = variant === 'bad' ? `${PINK}35` : `${BLUE}50`;
  const outputColor = variant === 'bad' ? '#7A8FA8' : '#E2E8F0';

  // Card dimensions (px) — used for font size calculation
  const CARD_W = 1080 - 104; // full width minus left+right margins
  const PROMPT_H = 490;
  const OUTPUT_H = 530;

  const promptSize = fillFontSize(prompt, PROMPT_H, CARD_W, 22, 80);
  const outputSize = fillFontSize(outputSnippet, OUTPUT_H, CARD_W, 20, 72);

  // Timing
  const OUT_START  = Math.round(fps * 1.8);
  const HOLD_START = durationInFrames - fps * 3; // 3s hold at end
  const FADE_START = durationInFrames - fps * 0.3;

  // Header fade in
  const headerIn = spring({ frame, fps, from: 0, to: 1, config: { damping: 22 } });

  // Output stream — pauses during hold
  const outProgress = interpolate(
    Math.min(frame, HOLD_START),
    [OUT_START, HOLD_START - fps * 0.5],
    [0, 1],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.out(Easing.ease) }
  );
  const visibleChars   = Math.floor(outProgress * outputSnippet.length);
  const cursorVisible  = Math.sin(frame * 0.3) > 0;
  const outOpacity     = interpolate(frame, [OUT_START, OUT_START + 8], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const streamDone     = visibleChars >= outputSnippet.length;

  // Global fade out
  const globalOpacity = interpolate(frame, [FADE_START, durationInFrames], [1, 0], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
  });

  // Swipe hint: fades in when output finishes streaming
  const swipeOpacity = streamDone
    ? interpolate(frame, [HOLD_START - fps * 0.8, HOLD_START], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })
    : 0;

  return (
    <AbsoluteFill style={{ backgroundColor: BG, opacity: globalOpacity }}>

      {/* Top accent bar */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, height: 6,
        background: `linear-gradient(90deg, ${PINK}, ${BLUE})`,
        opacity: headerIn,
      }} />

      {/* Logo row  — top 20, h 68 */}
      <div style={{
        position: 'absolute', top: 20, left: 52, right: 52, height: 68,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        opacity: headerIn,
      }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 2 }}>
          <span style={{ color: '#FFF', fontWeight: 800, fontSize: 32, fontFamily: 'sans-serif' }}>well</span>
          <span style={{ color: BLUE,  fontWeight: 800, fontSize: 32, fontFamily: 'sans-serif' }}>.prompted</span>
        </div>
        <div style={{
          background: `${accent}15`, border: `1.5px solid ${accent}40`,
          borderRadius: 8, padding: '5px 16px',
          color: accent, fontSize: 18, fontFamily: 'sans-serif', fontWeight: 700, letterSpacing: 1,
        }}>
          {category.replace(/_/g, ' ')}
        </div>
      </div>

      {/* Variant label — top 98, h 44 */}
      <div style={{
        position: 'absolute', top: 98, left: 52, height: 44,
        display: 'flex', alignItems: 'center',
        color: accent, fontSize: 20, fontWeight: 800,
        letterSpacing: 4, fontFamily: 'sans-serif',
        opacity: headerIn,
      }}>
        {label}
      </div>

      {/* Prompt card — top 152, h 490 — visible from frame 0 */}
      <div style={{
        position: 'absolute', top: 152, left: 52, right: 52, height: 490,
        background: cardBg,
        border: `1px solid ${cardBorder}`,
        borderLeft: `5px solid ${accent}`,
        borderRadius: 14,
        padding: '36px 44px',
        display: 'flex', alignItems: 'center',
        overflow: 'hidden',
        opacity: headerIn,
      }}>
        <span style={{
          color: '#CAD6F0', fontSize: promptSize, lineHeight: 1.65,
          fontFamily: 'monospace', wordBreak: 'break-word',
        }}>
          {prompt}
        </span>
      </div>

      {/* AI Output header — top 660, h 48 */}
      <div style={{
        position: 'absolute', top: 660, left: 52, right: 52, height: 48,
        display: 'flex', alignItems: 'center', gap: 16,
        opacity: outOpacity,
      }}>
        <span style={{
          color: accent, fontSize: 20, fontWeight: 800,
          letterSpacing: 3, fontFamily: 'sans-serif',
        }}>
          AI OUTPUT
        </span>
        <div style={{ flex: 1, height: 1.5, background: `${accent}30` }} />
        {streamDone && (
          <span style={{ color: accent, fontSize: 16, fontFamily: 'sans-serif', opacity: 0.7 }}>
            #{postNumber}
          </span>
        )}
      </div>

      {/* Output card — top 720, h 530 — same style as prompt card */}
      {frame >= OUT_START && (
        <div style={{
          position: 'absolute', top: 720, left: 52, right: 52, height: OUTPUT_H,
          background: cardBg,
          border: `1px solid ${cardBorder}`,
          borderLeft: `5px solid ${accent}`,
          borderRadius: 14,
          padding: '36px 44px',
          display: 'flex', alignItems: 'center',
          overflow: 'hidden',
          opacity: outOpacity,
        }}>
          <FormattedText
            text={outputSnippet}
            fontSize={outputSize}
            color={outputColor}
            visibleChars={visibleChars}
            cursorVisible={cursorVisible}
            accentColor={accent}
          />
        </div>
      )}

      {/* Swipe hint — bad variant only, fades in when streaming done */}
      {variant === 'bad' && (
        <div style={{
          position: 'absolute', top: 1268, left: 0, right: 0,
          display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 12,
          opacity: swipeOpacity,
        }}>
          <div style={{ width: 40, height: 1.5, background: `${BLUE}50` }} />
          <span style={{ color: BLUE, fontSize: 20, fontFamily: 'sans-serif', fontWeight: 600, letterSpacing: 3 }}>
            swipe for prompt upgrade &nbsp;→
          </span>
          <div style={{ width: 40, height: 1.5, background: `${BLUE}50` }} />
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
