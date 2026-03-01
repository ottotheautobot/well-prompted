import { Composition, registerRoot } from 'remotion';
import { PromptVideo } from './PromptVideo';

// 4:5 portrait — 1080x1350 @ 30fps
const WIDTH = 1080;
const HEIGHT = 1350;
const FPS = 30;
const DURATION_SECONDS = 8;

const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="PromptVideo"
        component={PromptVideo}
        durationInFrames={FPS * DURATION_SECONDS}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
        defaultProps={{
          prompt: 'write me a cold email to get clients',
          output: 'Subject: Working Together\n\nHi there, I hope this finds you well. I wanted to reach out because I think we could work together. We have great services. Let me know if you want to chat!',
          variant: 'bad' as const,
          postNumber: 1 as const,
          category: 'business',
        }}
      />
    </>
  );
};

registerRoot(RemotionRoot);
