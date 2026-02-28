-- well.prompted database schema

create table posts (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  status text not null default 'draft',
  format text not null default 'before_after',
  category text not null,
  techniques text[] default '{}',

  bad_prompt text,
  bad_output text,
  good_prompt text,
  good_output text,

  caption_bad text,
  caption_good text,

  video_bad_url text,
  video_good_url text,
  render_status text default 'pending',

  scheduled_at timestamptz,
  published_at timestamptz,
  instagram_post_id text,

  likes int default 0,
  comments int default 0,
  saves int default 0,
  reach int default 0
);

create table content_ideas (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz default now(),
  category text not null,
  format text not null default 'before_after',
  techniques text[] default '{}',
  topic text not null,
  notes text,
  used boolean default false,
  score int default 0
);

create table settings (
  id int primary key default 1,
  posting_slots jsonb default '[]',
  daily_post_limit int default 3,
  category_weights jsonb default '{}',
  auto_generate boolean default false,
  telegram_notify boolean default true
);

-- Indexes
create index posts_status_idx on posts(status);
create index posts_scheduled_at_idx on posts(scheduled_at);
create index content_ideas_used_idx on content_ideas(used);

-- Updated at trigger
create or replace function update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger posts_updated_at
  before update on posts
  for each row execute function update_updated_at();
