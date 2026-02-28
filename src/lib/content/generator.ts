import { ContentCategory, PostFormat, PromptTechnique, Post } from '@/types';

const SYSTEM_PROMPT = `You are the content engine for well.prompted, an Instagram page that teaches prompt engineering through before/after comparisons.

Your job is to generate compelling prompt comparison content. Each post consists of:
1. A bad prompt (vague, under-specified, naive)
2. The weak output it produces
3. A well-crafted prompt using specific techniques
4. The dramatically better output it produces
5. Caption for the bad prompt post (explains WHY it fails — what's missing, what AI guesses wrong)
6. Caption for the good prompt post (explains WHAT changed and WHY each technique works)

The captions are the real value. They teach people to think about prompting, not just copy-paste.

Tone: Smart, direct, a little edgy. Not corporate. Not preachy. Like a senior engineer explaining something to a junior.`;

export interface GeneratedPost {
  bad_prompt: string;
  bad_output: string;
  good_prompt: string;
  good_output: string;
  caption_bad: string;
  caption_good: string;
  techniques: PromptTechnique[];
}

export async function generatePostContent(
  category: ContentCategory,
  format: PostFormat,
  topic?: string
): Promise<GeneratedPost> {
  const topicInstruction = topic
    ? `Topic: ${topic}`
    : `Choose an interesting, relatable topic in the ${category} category.`;

  const prompt = `${topicInstruction}
Format: ${format}
Category: ${category}

Generate a complete before/after prompt comparison post. Return as JSON with these exact fields:
- bad_prompt: string
- bad_output: string (simulate what a real AI would return for this bad prompt — mediocre, generic)
- good_prompt: string (use specific techniques: role assignment, constraints, format instructions, etc.)
- good_output: string (simulate the dramatically better AI response)
- caption_bad: string (2-3 sentences: why this prompt fails, what the AI is left to guess)
- caption_good: string (2-3 sentences: what specific techniques were added and why they work)
- techniques: array of technique names used`;

  // This will call the LLM — implementation depends on your AI provider
  // Placeholder for now — wire up Anthropic/OpenAI SDK here
  throw new Error('Generator not yet wired to LLM — add API key and SDK');
}

export function getCategoryWeight(weights: Record<ContentCategory, number>, category: ContentCategory): number {
  return weights[category] ?? 1;
}

export function pickCategory(weights: Record<ContentCategory, number>): ContentCategory {
  const categories = Object.keys(weights) as ContentCategory[];
  const total = categories.reduce((sum, c) => sum + (weights[c] ?? 1), 0);
  let rand = Math.random() * total;
  for (const category of categories) {
    rand -= weights[category] ?? 1;
    if (rand <= 0) return category;
  }
  return categories[0];
}
