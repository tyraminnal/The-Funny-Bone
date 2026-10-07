# The Funny Bone

Upload a photo, get AI-written captions in four voices, and vote on the funniest. Built with Next.js, Supabase, and Gemini.

## Features

- **Daily theme.** A new prompt every day (Underground, Mystery Meal, Butler at 2am...) gives people a reason to come back and post.
- **AI captions.** Each upload gets four captions from Gemini: Deadpan, Chronically Online, Midwest Transplant, and Real New Yorker. The exact prompt is saved with every post.
- **Voting.** Signed-in users upvote or downvote captions. One vote per user per caption, and you can't vote on your own post.
- **Feed.** Sort by Hot, New, Top, or today's theme. The top caption from the last 24 hours shows as Caption of the Day.
- **Sharing.** Every post has its own page at `/post/<id>`.

## Setup

1. Run `supabase/migrations/20261007_captions_and_votes.sql` in the Supabase SQL Editor.
2. Add these environment variables to `.env.local` and to Vercel:

```
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...   # server only, never expose to the browser
GEMINI_API_KEY=...              # from aistudio.google.com
GEMINI_MODEL=gemini-3.5-flash   # optional
```

3. `npm install && npm run dev`

## Security

Row level security is on for every table:

| Table | Who can read | Who can write |
| --- | --- | --- |
| `profiles` | Only the owner | Only the owner |
| `tvshows` | Signed-in users | Nobody |
| `generations`, `captions` | Signed-in users | Only the server, after the AI responds |
| `caption_votes` | Only the voter | Only the voter, never on their own post |

Vote totals on `captions` are kept up to date by a database trigger, so users never need permission to edit captions.
