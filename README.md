# The Funny Bone

Upload a photo, get AI-written captions in four voices, and vote on the funniest. Built with Next.js, Supabase, and Gemini.

## Features

- **AI meme for visitors.** Logged-out visitors see a meme Gemini writes about today's theme on a classic template, with a fresh one every few hours.
- **AI captions.** Signed-in users upload a photo, type the voice they want ("my mom on Facebook", "a tired TA"...), and Gemini writes four captions. The exact prompt is saved with every post.
- **Captions on the photo.** Each caption is drawn over the image meme-style; Prev / Next flips through them.
- **Voting.** Signed-in users vote LOL or meh on each caption. Every vote inserts a new row in `caption_votes`; changing a vote deletes the old row and inserts a new one.
- **Suggested pics.** No photo handy? Pick a classic meme template on Make a Meme and get captions for that instead.
- **Battleground.** Write a caption for a pic and battle the AI, which writes its own without seeing yours. Everyone else votes blind on the funnier one, then sees who wrote which. A Humans vs AI scoreboard on the Battleground tracks who's winning.
- **Share on socials.** Posts and battles have Share buttons (native share sheet on phones, plus X, Facebook, Reddit, WhatsApp, and Copy Link). Shared links need sign-in, and people land back on the shared page after signing in.
- **Live points ranking.** Updates on its own as people post and vote, with ▲/▼ badges when ranks change. +2 per pic or battle posted, +1 per vote cast, +1 per LOL your captions get (−1 per meh), +1 per vote you win against the AI. Votes on your own posts don't count.
- **Daily theme, Caption of the Day, and shareable post pages.** Plus Classic, Emo, and Glitter profile skins.

## Setup

1. Run every file in `supabase/migrations/` in the Supabase SQL Editor, oldest first.
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
| `generations`, `captions` | Signed-in users | Only the server, after the AI responds |
| `caption_votes` | Only the voter | Only the voter (insert and delete, never update) |
| `showcase_memes` | Only the server | Only the server |
| `battles` | Signed-in users | Only the server, after the AI responds |
| `battle_answers` (which side is the AI) | Only the server | Only the server |
| `battle_votes` | Only the voter | Only the voter (insert only; votes are final, and not on your own battle) |

Which caption the AI wrote is only handed out by `battle_reveals()`, and only for battles you started or already voted on, so nobody can peek before voting.

The points ranking comes from a `leaderboard()` function that only signed-in users can call. It returns display names, avatars, and points, never full profiles.

Vote totals on `captions` are kept up to date by a database trigger, so users never need permission to edit captions.
