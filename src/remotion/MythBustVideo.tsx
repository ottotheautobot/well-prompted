import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig, Easing, Audio, Img, staticFile } from 'remotion';

export interface MythBustVideoProps {
  mythStatement: string;
  truthStatement: string;
  effect: 'busted_text' | 'shattering_glass' | 'slash' | 'explosion';
  audioUrl?: string;
  musicUrl?: string;
  musicStartSec?: number;
}

const BLUE  = '#0085FF';
const PINK  = '#FF2D78';
const BG    = '#080B14';
const W     = 1080;
const H     = 1920;

export const MythBustVideo: React.FC<MythBustVideoProps> = ({
  mythStatement,
  truthStatement,
  effect,
  audioUrl,
  musicUrl,
  musicStartSec = 0,
}) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  
  // Timeline: myth (0-50), bust effect (50-100), truth (100+)
  const mythEnd = 50;
  const bustStart = 50;
  const bustEnd = 100;
  
  const mythOp = interpolate(frame, [0, mythEnd - 20, mythEnd], [0, 1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  
  const bustOp = interpolate(frame, [bustStart, bustEnd - 10, bustEnd], [0, 1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  
  const truthOp = interpolate(frame, [bustEnd - 10, bustEnd], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // Effect-specific animations
  const getBustAnimation = () => {
    switch (effect) {
      case 'busted_text':
        return (
          <div style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            <div style={{
              fontSize: 180,
              fontWeight: 900,
              color: PINK,
              letterSpacing: 8,
              textShadow: `0 0 40px ${PINK}`,
              transform: `scale(${interpolate(frame, [bustStart, bustEnd], [0, 1], { easing: Easing.out(Easing.cubic) })}) rotate(${interpolate(frame, [bustStart, bustEnd], [-15, 0], { easing: Easing.out(Easing.cubic) })}deg)`,
            }}>
              BUSTED
            </div>
          </div>
        );
      
      case 'shattering_glass':
        return (
          <svg width="1080" height="1920" style={{ position: 'absolute', top: 0, left: 0 }}>
            {/* Radial cracks from center */}
            {Array.from({ length: 12 }).map((_, i) => {
              const angle = (i / 12) * Math.PI * 2;
              const scale = interpolate(frame, [bustStart, bustEnd], [0, 1.5], { easing: Easing.out(Easing.cubic) });
              const x1 = 540;
              const y1 = 960;
              const x2 = 540 + Math.cos(angle) * 600 * scale;
              const y2 = 960 + Math.sin(angle) * 600 * scale;
              return (
                <line
                  key={i}
                  x1={x1}
                  y1={y1}
                  x2={x2}
                  y2={y2}
                  stroke={PINK}
                  strokeWidth={3}
                  opacity={1}
                />
              );
            })}
            {/* Concentric circles */}
            {Array.from({ length: 4 }).map((_, i) => {
              const radius = 100 * (i + 1) * interpolate(frame, [bustStart, bustEnd], [0, 1.5], { easing: Easing.out(Easing.cubic) });
              return (
                <circle
                  key={`circle-${i}`}
                  cx={540}
                  cy={960}
                  r={radius}
                  fill="none"
                  stroke={PINK}
                  strokeWidth={2}
                  opacity={Math.max(0, 1 - i * 0.2)}
                />
              );
            })}
          </svg>
        );
      
      case 'slash':
        return (
          <svg width="1080" height="1920" style={{ position: 'absolute', top: 0, left: 0 }}>
            <line
              x1={interpolate(frame, [bustStart, bustEnd], [0, 1080], { easing: Easing.out(Easing.cubic) })}
              y1={interpolate(frame, [bustStart, bustEnd], [1920, 0], { easing: Easing.out(Easing.cubic) })}
              x2={interpolate(frame, [bustStart, bustEnd], [1080, 0], { easing: Easing.out(Easing.cubic) })}
              y2={interpolate(frame, [bustStart, bustEnd], [0, 1920], { easing: Easing.out(Easing.cubic) })}
              stroke={PINK}
              strokeWidth={16}
              opacity={1}
            />
          </svg>
        );
      
      case 'explosion':
        return (
          <div style={{ position: 'absolute', inset: 0 }}>
            {Array.from({ length: 20 }).map((_, i) => {
              const angle = (i / 20) * Math.PI * 2;
              const distance = interpolate(frame, [bustStart, bustEnd], [0, 400], { easing: Easing.out(Easing.cubic) });
              const x = 540 + Math.cos(angle) * distance;
              const y = 960 + Math.sin(angle) * distance;
              const size = 40 - (i % 5) * 8;
              return (
                <div
                  key={i}
                  style={{
                    position: 'absolute',
                    left: x,
                    top: y,
                    width: size,
                    height: size,
                    background: i % 2 === 0 ? PINK : BLUE,
                    borderRadius: '50%',
                    opacity: Math.max(0, 1 - (frame - bustStart) / (bustEnd - bustStart) * 0.3),
                  }}
                />
              );
            })}
          </div>
        );
      
      default:
        return null;
    }
  };

  return (
    <AbsoluteFill style={{ background: BG }}>
      {/* MYTH STATEMENT */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          opacity: mythOp,
          paddingLeft: 88,
          paddingRight: 88,
          zIndex: 1,
          pointerEvents: 'none',
        }}
      >
        <div
          style={{
            textAlign: 'center',
            fontSize: 56,
            fontWeight: 700,
            color: '#E2E8F0',
            lineHeight: 1.3,
            fontFamily: 'Inter, sans-serif',
          }}
        >
          {mythStatement}
        </div>
      </div>

      {/* BUST EFFECT */}
      <div style={{ opacity: bustOp, zIndex: 2, pointerEvents: 'none' }}>
        {getBustAnimation()}
      </div>

      {/* TRUTH STATEMENT */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          opacity: truthOp,
          paddingLeft: 88,
          paddingRight: 88,
          zIndex: 3,
          pointerEvents: 'none',
        }}
      >
        <div style={{ textAlign: 'center' }}>
          <div
            style={{
              fontSize: 52,
              fontWeight: 700,
              color: BLUE,
              lineHeight: 1.3,
              marginBottom: 16,
              fontFamily: 'Inter, sans-serif',
            }}
          >
            {truthStatement}
          </div>
        </div>
      </div>

      {/* AUDIO */}
      {audioUrl && <Audio src={audioUrl} />}
      {musicUrl && <Audio src={musicUrl} startFrom={musicStartSec * fps} volume={0.3} />}
    </AbsoluteFill>
  );
};
