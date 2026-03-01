export type PostStatus = 'draft' | 'pending_review' | 'approved' | 'rendering' | 'pending_video_review' | 'scheduled' | 'published' | 'rejected';

export type PostFormat = 'before_after' | 'model_vs_model' | 'tip_card' | 'myth_bust' | 'ranked';

export type ContentCategory = 'writing' | 'coding' | 'business' | 'image_gen' | 'data' | 'creative' | 'productivity';

export type PromptTechnique =
  | 'role_assignment'
  | 'constraints'
  | 'format_instructions'
  | 'few_shot'
  | 'chain_of_thought'
  | 'output_format'
  | 'context_setting'
  | 'tone_specification';

export interface Post {
  id: string;
  created_at: string;
  updated_at: string;
  status: PostStatus;
  format: PostFormat;
  category: ContentCategory;
  techniques: PromptTechnique[];

  // Content
  bad_prompt: string;
  bad_output: string;
  bad_output_snippet?: string;  // Most revealing 1-2 sentences for video
  good_prompt: string;
  good_output: string;
  good_output_snippet?: string; // Most impressive 1-2 sentences for video

  // Captions
  caption_bad: string;   // Why this prompt fails
  caption_good: string;  // What changed and why

  // Video
  video_bad_url?: string;
  video_good_url?: string;
  render_status?: 'pending' | 'rendering' | 'done' | 'failed';

  // Scheduling
  scheduled_at?: string;
  published_at?: string;
  instagram_post_id?: string;

  // Engagement (populated after publishing)
  likes?: number;
  comments?: number;
  saves?: number;
  reach?: number;
}

export interface ContentIdea {
  id: string;
  created_at: string;
  category: ContentCategory;
  format: PostFormat;
  techniques: PromptTechnique[];
  topic: string;
  notes?: string;
  used: boolean;
  score?: number; // estimated engagement score
}

export interface PostingSlot {
  day: number; // 0=Sunday
  hour: number;
  minute: number;
}

export interface Settings {
  posting_slots: PostingSlot[];
  daily_post_limit: number;
  category_weights: Record<ContentCategory, number>;
  auto_generate: boolean;
  telegram_notify: boolean;
}
