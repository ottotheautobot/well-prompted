import { Composition, registerRoot } from 'remotion';
import { PromptVideo } from './PromptVideo';
import { TipCard } from './TipCard';

const WIDTH = 1080;
const HEIGHT = 1350;
const FPS = 30;

const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="PromptVideo"
        component={PromptVideo as unknown as React.ComponentType<Record<string, unknown>>}
        durationInFrames={FPS * 8}
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
      <Composition
        id="TipCard"
        component={TipCard as unknown as React.ComponentType<Record<string, unknown>>}
        durationInFrames={FPS * 5}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
        defaultProps={{
          title: '5 Prompts That Save Hours Every Week',
          tips: [
            'Add "Think step by step" to any analysis prompt',
            'Specify word counts to prevent padding',
            'Assign a role before complex tasks',
            'Use numbered lists to force structure',
            'Ban filler phrases explicitly',
          ],
          tipNumber: 0,
          totalTips: 5,
          category: 'productivity',
          accentStyle: 'blue' as const,
        }}
      />
    </>
  );
};

registerRoot(RemotionRoot);
