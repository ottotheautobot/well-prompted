import { Composition, registerRoot } from 'remotion';
import { PromptVideo } from './PromptVideo';

const WIDTH = 1080;
const HEIGHT = 1350;
const FPS = 30;
const DURATION_SECONDS = 8;

const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="PromptVideo"
        component={PromptVideo as unknown as React.ComponentType<Record<string, unknown>>}
        durationInFrames={FPS * DURATION_SECONDS}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
        defaultProps={{
          prompt: 'write me a cold email to get clients',
          output: 'Subject: Working Together\n\nHi there, I hope this finds you well.',
          outputSnippet: 'Hi there, I hope this finds you well.',
          variant: 'bad' as const,
          postNumber: 1 as const,
          category: 'business',
        }}
      />
    </>
  );
};

registerRoot(RemotionRoot);
