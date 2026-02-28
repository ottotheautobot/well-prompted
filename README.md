# well.prompted — Content Management Portal

AI-powered Instagram content pipeline for @well.prompted.

## Stack
- **Next.js 15** — frontend + API routes
- **Supabase** — database + auth
- **Vercel** — hosting
- **Remotion** — video generation
- **Instagram Graph API** — publishing
- **Anthropic Claude** — content generation

## Setup

```bash
npm install
cp .env.example .env.local
# Fill in env vars
npm run dev
```

## Structure

```
src/
  app/
    queue/        # Content approval queue
    calendar/     # Publishing schedule
    settings/     # App settings
    api/
      posts/      # CRUD for posts
      generate/   # Trigger content generation
      approve/    # Approve/reject posts
      publish/    # Publish to Instagram
  lib/
    supabase/     # DB client + schema
    content/      # AI content generator
    instagram/    # Graph API client
    remotion/     # Video render triggers
  types/          # Shared TypeScript types
  components/     # UI components
```

## Database

Run `src/lib/supabase/schema.sql` in your Supabase SQL editor to set up tables.

## Flow

1. Content brain generates post ideas → saved as `content_ideas`
2. Generator picks an idea → runs prompts → saves as `draft` post
3. Video renderer picks up draft → renders two videos → updates `render_status`
4. Telegram notification sent to Allen for review
5. Allen approves in portal → status → `approved`
6. Scheduler picks approved posts → publishes at scheduled time → status → `published`
