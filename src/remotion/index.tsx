import { Composition, registerRoot } from 'remotion';
import { PromptVideo, calcVideoDuration } from './PromptVideo';
import { TipCard } from './TipCard';
import { MythBustVideo } from './MythBustVideo';

const FPS = 30;

const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="PromptVideo"
        component={PromptVideo as unknown as React.ComponentType<Record<string, unknown>>}
        calculateMetadata={async ({ props }) => ({
          durationInFrames: calcVideoDuration(props as unknown as Parameters<typeof calcVideoDuration>[0], FPS),
          fps: FPS,
        })}
        durationInFrames={FPS * 30}
        fps={FPS}
        width={1080}
        height={1920}
        defaultProps={{
          okayPrompt: "Write me an email asking my boss for a raise. I've been here 2 years and I work really hard.",
          wellPrompt: "Write a raise request email to [Manager's name]. Frame it as a business case, not tenure. Include: one specific achievement with a measurable result like [increased client retention 15%], a clear ask of [15-18%], and mention of expanded responsibilities. Confident tone, not aggressive. 3-4 paragraphs max.",
          whyBreakdown: [
            { title: "Business case, not tenure", description: "Bosses approve raises based on ROI, not years served. Framing around impact changes the entire email." },
            { title: "Specific number", description: "Vague asks get vague answers. A clear % gives the AI something real to write toward." },
            { title: "Measurable achievement", description: "Generic hard work is invisible. A number makes your contribution concrete and defensible." },
            { title: "Tone constraint", description: "'Confident but not aggressive' is a direction the AI can actually follow. Without it, you get either begging or demands." },
          ],
          category: 'career',
          postNumber: 1,
        }}
      />
      <Composition
        id="TipCard"
        component={TipCard as unknown as React.ComponentType<Record<string, unknown>>}
        durationInFrames={FPS * 5}
        fps={FPS}
        width={1080}
        height={1350}
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
      <Composition
        id="MythBustVideo"
        component={MythBustVideo as unknown as React.ComponentType<Record<string, unknown>>}
        durationInFrames={FPS * 27}
        fps={FPS}
        width={1080}
        height={1920}
        defaultProps={{
          mythStatement: "ChatGPT and Claude work the same way, so prompts are interchangeable",
          truthStatement: "They think differently. Adjust your prompts for each model.",
        }}
      />
    </>
  );
};

registerRoot(RemotionRoot);
