import { createClient } from '@supabase/supabase-js';

export type LogLevel = 'info' | 'warn' | 'error';
export type LogCategory =
  | 'generate'
  | 'audio'
  | 'render'
  | 'render-check'
  | 'publish'
  | 'approve'
  | 'regen'
  | 'schedule'
  | 'system';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function log(
  category: LogCategory,
  level: LogLevel,
  message: string,
  details?: Record<string, unknown> & { postId?: string }
) {
  try {
    const postId = details?.postId ?? null;
    const rest = details ? Object.fromEntries(Object.entries(details).filter(([k]) => k !== 'postId')) : null;
    await supabase.from('logs').insert({
      level,
      category,
      message,
      post_id: postId,
      details: rest && Object.keys(rest).length > 0 ? rest : null,
    });
  } catch {
    // Never let logging break the main flow
  }
}

// Fire-and-forget version for use in critical paths
export function logFire(
  category: LogCategory,
  level: LogLevel,
  message: string,
  details?: Record<string, unknown> & { postId?: string }
) {
  log(category, level, message, details).catch(() => {});
}
