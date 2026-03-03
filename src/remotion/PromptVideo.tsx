import {
  AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig, Easing, Audio,
} from 'remotion';

// 1080 × 1920  |  9:16 Reel  |  2 pages:
//   Page 1 — two dynamic panes (okay prompt + well prompted, proportional height)
//   Page 2 — why this works (big text, phone-readable)

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
  audioUrl?: string;
  totalAudioSec?: number; // actual full narration duration — video must not end before this
  musicUrl?: string;
  musicStartSec?: number;
}

const BLUE  = '#0085FF';
const PINK  = '#FF2D78';
const BG    = '#080B14';
const MX    = 44;
const W     = 1080;
const H     = 1920;
const CARD_W = W - MX * 2; // 992px

// ── count wrapped lines for a given font size & box width ──
function countLines(text: string, fontSize: number, boxW: number): number {
  const usableW = boxW - 88;
  const cpl = usableW / (fontSize * 0.56);
  const words = text.split(' ');
  let lines = 1, lc = 0;
  for (const w of words) {
    if (lc + w.length + 1 > cpl && lc > 0) { lines++; lc = w.length + 1; }
    else lc += w.length + 1;
  }
  return lines + (text.match(/\n/g) || []).length;
}

// ── find the largest shared font where both cards fit in the available height ──
function computeLayout(okay: string, well: string) {
  const LABEL_H   = 44;   // each label row
  const GAP       = 24;   // gap between cards
  const CARD_PAD  = 80;   // vertical padding inside each card (top+bottom)
  const LH        = 1.65;
  const LOGO_BOT  = 96;   // below logo
  const AVAIL     = H - LOGO_BOT - 20; // 1804px total
  const CARDS_AVAIL = AVAIL - LABEL_H * 2 - GAP - 32; // for both cards combined

  for (let fs = 68; fs >= 36; fs--) {
    const lOkay = countLines(okay, fs, CARD_W);
    const lWell = countLines(well, fs, CARD_W);
    const hOkay = Math.ceil(lOkay * fs * LH) + CARD_PAD;
    const hWell = Math.ceil(lWell * fs * LH) + CARD_PAD;
    if (hOkay + hWell <= CARDS_AVAIL) {
      return { fontSize: fs, hOkay, hWell };
    }
  }
  // fallback: split proportionally at min font
  const fs = 36;
  const lOkay = countLines(okay, fs, CARD_W);
  const lWell = countLines(well, fs, CARD_W);
  const total  = lOkay + lWell || 1;
  const hOkay  = Math.floor(CARDS_AVAIL * lOkay / total);
  const hWell  = CARDS_AVAIL - hOkay;
  return { fontSize: fs, hOkay, hWell };
}

// Dynamic font sizes for why breakdown based on number of items + text length
function calcWhyFontSizes(items: WhyItem[], availH: number, cardW: number) {
  const NUM_W      = 90;   // number circle (66px) + gap
  const CARD_PAD_H = 80;   // horizontal padding inside card
  const CARD_PAD_V = 72;   // vertical padding inside card (top+bottom)
  const T_DESC_GAP = 10;   // gap between title and description
  const textW = cardW - CARD_PAD_H - NUM_W;
  const perItemH = availH / items.length;
  const textAreaH = perItemH - CARD_PAD_V;

  for (let ts = 46; ts >= 18; ts--) {
    const ds = Math.round(ts * 0.87);
    const maxTLines = Math.max(...items.map(it => countLines(it.title, ts, textW)));
    const maxDLines = Math.max(...items.map(it => countLines(it.description, ds, textW)));
    const titleH = maxTLines * ts * 1.25;
    const descH  = maxDLines * ds * 1.5;
    if (titleH + descH + T_DESC_GAP <= textAreaH) return { titleSize: ts, descSize: ds };
  }
  return { titleSize: 18, descSize: 16 };
}

// cross-fade for page transitions
function pageAlpha(frame: number, start: number, end: number, fadeDur: number) {
  const fadeIn  = interpolate(frame, [start, start + fadeDur], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const fadeOut = interpolate(frame, [end,   end   + fadeDur], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  return Math.min(fadeIn, fadeOut);
}

// Called by calculateMetadata — same math as inside the component
export function calcVideoDuration(props: PromptVideoProps, fps = 30): number {
  const itemCount  = props.whyBreakdown?.length || 4;
  const ITEM_DELAY = Math.round(fps * 0.45);
  const whyAnimDur = Math.round(fps * 0.3) + itemCount * ITEM_DELAY;
  const FADE       = Math.round(fps * 0.45);
  const HOLD_END   = Math.round(fps * 3); // 3s hold at very end after why page

  // Always typing-based — 5s after well prompt finishes
  const WELL_TYPE_START = Math.round(fps * 1.2);
  const typeDuration    = Math.round(fps * Math.max(5, (props.wellPrompt || '').length / 26));
  const p1End           = WELL_TYPE_START + typeDuration + Math.round(fps * 5);

  const computed = p1End + FADE + whyAnimDur + HOLD_END + FADE;

  // Hard floor: video must outlast the full narration + 2s buffer
  const audioFloor = props.totalAudioSec
    ? Math.round(props.totalAudioSec * fps) + Math.round(fps * 3)
    : 0;

  return Math.max(computed, audioFloor);
}

export const PromptVideo: React.FC<PromptVideoProps> = ({
  okayPrompt, wellPrompt, whyBreakdown, category, audioUrl, totalAudioSec,
  musicUrl, musicStartSec = 0,
}) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  const FADE = Math.round(fps * 0.45);

  // Typing — well prompt starts at 1.2s
  const WELL_TYPE_START = Math.round(fps * 1.2);
  const typeDuration    = Math.round(fps * Math.max(5, wellPrompt.length / 26));
  const WELL_TYPE_END   = WELL_TYPE_START + typeDuration;

  // P1_END is always typing-based — 5s hold after the well prompt finishes typing
  // Never driven by narration timing (which causes the gap to vary unpredictably)
  const P1_END = WELL_TYPE_END + Math.round(fps * 5);
  const P2_START = P1_END;
  const P2_END   = durationInFrames - FADE;

  const op1 = pageAlpha(frame, 0,        P1_END, FADE);
  const op2 = pageAlpha(frame, P2_START, P2_END, FADE);

  const globalIn = spring({ frame, fps, from: 0, to: 1, config: { damping: 22 } });

  const typeProgress = interpolate(
    frame,
    [WELL_TYPE_START, WELL_TYPE_END],
    [0, 1],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.out(Easing.ease) },
  );
  const visibleChars = Math.floor(typeProgress * wellPrompt.length);
  const cursorOn     = Math.sin(frame * 0.28) > 0;

  // Layout computed once
  const { fontSize, hOkay, hWell } = computeLayout(okayPrompt, wellPrompt);

  const LOGO_BOT = 96;

  // Why section font sizes — dynamic based on item count + text length
  const WHY_AVAIL_H = H - LOGO_BOT - 56 - 20;
  const { titleSize: whyTitleSize, descSize: whyDescSize } = calcWhyFontSizes(whyBreakdown, WHY_AVAIL_H, CARD_W);
  const LABEL_H  = 44;
  const GAP      = 24;
  const okayLabelTop = LOGO_BOT;
  const okayCardTop  = okayLabelTop + LABEL_H;
  const wellLabelTop = okayCardTop + hOkay + GAP;
  const wellCardTop  = wellLabelTop + LABEL_H;

  // Why breakdown item timing
  const ITEM_DELAY = Math.round(fps * 0.45);
  const ITEM_FADE  = Math.round(fps * 0.3);

  return (
    <AbsoluteFill style={{ backgroundColor: BG, overflow: 'hidden' }}>

      {/* Narration audio */}
      {audioUrl && <Audio src={audioUrl} volume={1} />}

      {/* Background music — low volume, fades out at end */}
      {musicUrl && (
        <Audio
          src={musicUrl}
          volume={(f) => {
            const fadeOutStart = durationInFrames - fps * 2;
            return interpolate(f, [fadeOutStart, durationInFrames], [0.18, 0], {
              extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
            });
          }}
          startFrom={Math.round(musicStartSec * fps)}
        />
      )}

      {/* Accent bars */}
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 8,
        background: `linear-gradient(90deg,${PINK},${BLUE})`, opacity: globalIn }} />
      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 4,
        background: `linear-gradient(90deg,${BLUE},${PINK})`, opacity: globalIn }} />

      {/* Logo */}
      <div style={{
        position: 'absolute', top: 22, left: MX, right: MX, height: 56,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        opacity: globalIn,
      }}>
        <div>
          <span style={{ color: '#FFF', fontWeight: 800, fontSize: 30, fontFamily: 'sans-serif' }}>well</span>
          <span style={{ color: BLUE,  fontWeight: 800, fontSize: 30, fontFamily: 'sans-serif' }}>.prompted</span>
        </div>
        <span style={{ color: '#2C3D5C', fontSize: 14, fontWeight: 700, letterSpacing: 3, fontFamily: 'sans-serif' }}>
          {category.replace(/_/g,' ').toUpperCase()}
        </span>
      </div>

      {/* ══════════ PAGE 1 — TWO DYNAMIC PANES ══════════ */}
      <div style={{ position: 'absolute', inset: 0, opacity: op1 }}>

        {/* OKAY label */}
        <div style={{
          position: 'absolute', top: okayLabelTop, left: MX,
          display: 'flex', alignItems: 'center', gap: 10,
        }}>
          <div style={{ width: 4, height: 20, borderRadius: 2, background: PINK }} />
          <span style={{ color: PINK, fontSize: 14, fontWeight: 800, letterSpacing: 5, fontFamily: 'sans-serif' }}>
            OKAY PROMPT
          </span>
        </div>

        {/* OKAY card */}
        <div style={{
          position: 'absolute',
          top: okayCardTop, left: MX, right: MX, height: hOkay,
          background: '#0B1220',
          border: `1px solid ${PINK}28`,
          borderLeft: `5px solid ${PINK}`,
          borderRadius: 16,
          padding: '0 44px',
          display: 'flex', alignItems: 'center',
          overflow: 'hidden',
        }}>
          <span style={{
            color: '#A8B8CC',
            fontSize,
            lineHeight: 1.65,
            fontFamily: 'monospace',
            wordBreak: 'break-word',
          }}>
            {okayPrompt}
          </span>
        </div>

        {/* WELL label */}
        <div style={{
          position: 'absolute', top: wellLabelTop, left: MX,
          display: 'flex', alignItems: 'center', gap: 10,
        }}>
          <div style={{ width: 4, height: 20, borderRadius: 2, background: BLUE }} />
          <span style={{ color: BLUE, fontSize: 14, fontWeight: 800, letterSpacing: 5, fontFamily: 'sans-serif' }}>
            WELL PROMPTED
          </span>
        </div>

        {/* WELL card */}
        <div style={{
          position: 'absolute',
          top: wellCardTop, left: MX, right: MX, height: hWell,
          background: '#091525',
          border: `1px solid ${BLUE}40`,
          borderLeft: `5px solid ${BLUE}`,
          borderRadius: 16,
          padding: '0 44px',
          display: 'flex', alignItems: 'center',
          overflow: 'hidden',
        }}>
          <span style={{
            color: '#C8D8F0',
            fontSize,
            lineHeight: 1.65,
            fontFamily: 'monospace',
            wordBreak: 'break-word',
          }}>
            {wellPrompt.slice(0, visibleChars)}
            {visibleChars < wellPrompt.length && (
              <span style={{ color: BLUE, opacity: cursorOn ? 1 : 0 }}>▋</span>
            )}
          </span>
        </div>
      </div>

      {/* ══════════ PAGE 2 — WHY THIS WORKS ══════════ */}
      <div style={{ position: 'absolute', inset: 0, opacity: op2 }}>

        {/* Header row */}
        <div style={{
          position: 'absolute', top: LOGO_BOT, left: MX, right: MX,
          display: 'flex', alignItems: 'center', gap: 16,
        }}>
          <div style={{ width: 4, height: 24, borderRadius: 2, background: BLUE }} />
          <span style={{ color: '#2C3D5C', fontSize: 15, fontWeight: 800, letterSpacing: 4, fontFamily: 'sans-serif' }}>
            WHY THIS WORKS
          </span>
          <div style={{ flex: 1, height: 1, background: '#1A2540' }} />
        </div>

        {/* Items — evenly spaced in remaining height */}
        <div style={{
          position: 'absolute',
          top: LOGO_BOT + 56,
          left: MX, right: MX, bottom: 20,
          display: 'flex', flexDirection: 'column',
          justifyContent: 'space-evenly',
        }}>
          {whyBreakdown.map((item, i) => {
            const iStart = P2_START + Math.round(fps * 0.3) + i * ITEM_DELAY;
            const iOp = interpolate(frame, [iStart, iStart + ITEM_FADE], [0, 1], {
              extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
            });
            const iY = interpolate(frame, [iStart, iStart + ITEM_FADE], [20, 0], {
              extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
            });

            return (
              <div key={i} style={{
                display: 'flex', gap: 24, alignItems: 'flex-start',
                opacity: iOp, transform: `translateY(${iY}px)`,
                background: '#0B1220',
                border: `1px solid #1A2540`,
                borderLeft: `4px solid ${BLUE}50`,
                borderRadius: 18,
                padding: '36px 40px',
              }}>
                {/* Number */}
                <div style={{
                  width: Math.max(44, whyTitleSize + 20), height: Math.max(44, whyTitleSize + 20),
                  borderRadius: 14,
                  background: `${BLUE}15`, border: `1px solid ${BLUE}35`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: BLUE, fontSize: Math.round(whyTitleSize * 0.72), fontWeight: 800, fontFamily: 'sans-serif',
                  flexShrink: 0,
                }}>
                  {i + 1}
                </div>
                {/* Text */}
                <div style={{ flex: 1 }}>
                  <div style={{
                    color: '#E2E8F0', fontSize: whyTitleSize, fontWeight: 700,
                    fontFamily: 'sans-serif', lineHeight: 1.25, marginBottom: 10,
                  }}>
                    {item.title}
                  </div>
                  <div style={{
                    color: '#5A7090', fontSize: whyDescSize, fontFamily: 'sans-serif',
                    lineHeight: 1.5,
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
