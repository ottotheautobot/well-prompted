import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig, Audio } from 'remotion';

export interface MythBustVideoProps {
  mythStatement: string;
  truthStatement: string;
  audioUrl?: string;
  musicUrl?: string;
  musicStartSec?: number;
}

const BLUE  = '#0085FF';
const PINK  = '#FF2D78';
const BG    = '#080B14';
const W     = 1080;
const H     = 1920;

// Timeline (in frames at 30fps)
const MYTH_START = 0;
const MYTH_SHOW_START = 15; // Let "MYTH:" appear first
const MYTH_END = 105; // 3.5s hold (myth label + statement)
const BUST_START = 105;
const BUST_END = 120; // 0.5s
const TRUTH_START = 120;
const TRUTH_SETTLE = 165; // 1.5s animation with spring
const NARRATION_STARTS_AT = 165; // When truth text settles

export const MythBustVideo: React.FC<MythBustVideoProps> = ({
  mythStatement,
  truthStatement,
  audioUrl,
  musicUrl,
  musicStartSec = 0,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  
  // ── MYTH STATEMENT + HEADING ──
  const mythOp = interpolate(frame, [MYTH_START, MYTH_SHOW_START + 10, MYTH_END - 15, MYTH_END], [0, 1, 1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const headingOp = interpolate(frame, [MYTH_START, MYTH_SHOW_START, MYTH_END - 15], [0, 1, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const mythScale = interpolate(frame, [MYTH_END - 15, MYTH_END], [1, 0.8], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  
  // ── FLASH OVERLAY (RED BURST) ──
  const flashOp = interpolate(frame, [BUST_START, BUST_START + 5, BUST_END], [0, 0.5, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  
  // ── BUSTED TEXT (SLIDES FROM RIGHT WITH SPRING) ──
  const bustedProgress = spring({
    frame: Math.max(0, frame - BUST_START),
    config: { damping: 6, mass: 1, tension: 100 },
    fps,
  });
  const bustedX = interpolate(bustedProgress, [0, 1], [200, 0]);
  const bustedOp = interpolate(frame, [BUST_START, BUST_START + 5, BUST_END + 10, TRUTH_START], [0, 1, 1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  
  // ── TRUTH STATEMENT (SLIDES UP FROM BOTTOM WITH SPRING) ──
  const truthProgress = spring({
    frame: Math.max(0, frame - TRUTH_START),
    config: { damping: 7, mass: 1, tension: 90 },
    fps,
  });
  const truthY = interpolate(truthProgress, [0, 1], [150, 0]);
  const truthOp = interpolate(frame, [TRUTH_START, TRUTH_SETTLE - 15, TRUTH_SETTLE - 5], [0, 0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  
  // ── ACCENT LINE (DRAWS LEFT TO RIGHT) ──
  const lineDrawProgress = interpolate(frame, [TRUTH_SETTLE - 5, TRUTH_SETTLE + 15], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const lineLength = 300;
  const lineDashOffset = lineLength * (1 - lineDrawProgress);

  return (
    <AbsoluteFill style={{ background: BG, fontFamily: 'Inter, sans-serif', overflow: 'hidden' }}>
      
      {/* FLASH OVERLAY */}
      {flashOp > 0 && (
        <div style={{
          position: 'absolute',
          inset: 0,
          background: PINK,
          opacity: flashOp,
          pointerEvents: 'none',
          zIndex: 5,
        }} />
      )}
      
      {/* MYTH STATEMENT WITH HEADING */}
      <div style={{
        position: 'absolute',
        inset: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        opacity: mythOp,
        zIndex: 2,
        pointerEvents: 'none',
      }}>
        <div style={{
          textAlign: 'center',
          paddingLeft: 88,
          paddingRight: 88,
          maxWidth: 800,
          transform: `scale(${mythScale})`,
        }}>
          <div style={{
            opacity: headingOp,
            fontSize: 24,
            fontWeight: 600,
            color: PINK,
            letterSpacing: 2,
            marginBottom: 16,
            textTransform: 'uppercase',
          }}>
            MYTH
          </div>
          <div style={{
            fontSize: 56,
            fontWeight: 700,
            color: '#E2E8F0',
            lineHeight: 1.3,
          }}>
            {mythStatement}
          </div>
        </div>
      </div>
      
      {/* BUSTED TEXT */}
      <div style={{
        position: 'absolute',
        inset: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        opacity: bustedOp,
        zIndex: 3,
        pointerEvents: 'none',
      }}>
        <div style={{
          fontSize: 72,
          fontWeight: 900,
          color: PINK,
          letterSpacing: 4,
          transform: `translateX(${bustedX}px)`,
          textShadow: `0 0 30px ${PINK}80`,
        }}>
          ✕ BUSTED
        </div>
      </div>
      
      {/* TRUTH STATEMENT + ACCENT LINE */}
      <div style={{
        position: 'absolute',
        inset: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        opacity: truthOp,
        zIndex: 4,
        pointerEvents: 'none',
        transform: `translateY(${truthY}px)`,
      }}>
        <div style={{
          textAlign: 'center',
          paddingLeft: 88,
          paddingRight: 88,
        }}>
          <div style={{
            fontSize: 52,
            fontWeight: 700,
            color: BLUE,
            lineHeight: 1.3,
            maxWidth: 800,
            marginBottom: 20,
          }}>
            {truthStatement}
          </div>
          
          {/* Accent line underneath */}
          <svg width="300" height="8" style={{ display: 'block', margin: '0 auto' }}>
            <line
              x1="0"
              y1="4"
              x2="300"
              y2="4"
              stroke={PINK}
              strokeWidth="4"
              strokeDasharray={`${lineLength} ${lineLength}`}
              strokeDashoffset={lineDashOffset}
              strokeLinecap="round"
            />
          </svg>
        </div>
      </div>
      
      {/* AUDIO */}
      {audioUrl && <Audio src={audioUrl} />}
      {musicUrl && <Audio src={musicUrl} startFrom={musicStartSec * fps} volume={0.3} />}
      
    </AbsoluteFill>
  );
};
