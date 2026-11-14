# Artei

Free, legally licensed music with synced lyrics and a live, audio-reactive visual world for every song.
Claude (on the backend) designs each track's **Visual DNA** — palette, scene, motion, particles, typography
and the moments where the visuals shift — and Artei's own WebGL engine renders it in real time.

Works as an installable PWA on Android and looks great on desktop.

## Features

- **Streaming from Jamendo** (Creative Commons) **and the Internet Archive / Musopen** (public-domain and CC
  recordings, no key needed). Every player screen shows the title, artist, source link and license with a link
  to its deed. Archive recordings get their own "Public-domain classics" shelf, are mixed into Focus (1 in 3)
  and appear in search.
- **Seven visual worlds** rendered with GLSL shaders + a particle field: nebula, liquid chrome, rain on glass,
  paper cutouts, neon city, aurora, ink in water. Bass, mids, highs and beats drive them through the Web Audio API.
- **Visual DNA by Claude**: one Claude call per track (cached in SQLite). Claude returns parameters only — strict
  JSON validated with zod; nothing it returns is ever executed. Invalid output is retried once, then a
  preset is used.
- **Lyrics inside the scene**: the current line in Claude's chosen typography, words pulsing on beats, past
  lines dissolving into particles. Timestamped lyrics are followed exactly; untimed lyrics are spread across the
  song and can be locked with tap-to-sync or nudged ±0.5 s. No lyrics → "Instrumental" and full-screen visuals.
- **Mood timeline** under the seek bar showing how the visuals will shift through the song.
- **Visual DNA cards**: palette, scene name and Claude's mood line — save to your library or share as an image.
- **Remix the vibe**: "make it feel like a monsoon evening" → Claude adjusts the DNA (10 remixes/day per user).
- **15-second clip export**: vertical video of the visuals, lyrics and audio with the credit and license burned
  in. Disabled for NoDerivatives (ND) tracks, because syncing music to video counts as an adaptation.
- **Focus mode**, **calm visuals** (follows `prefers-reduced-motion`), automatic quality scaling for weaker phones,
  render loop paused in hidden tabs.
- **PWA**: install button, offline app shell, lock-screen / notification media controls.

## Repo layout

```
packages/shared   Track + Visual DNA types, zod schema (server), presets (both)
apps/server       Fastify + TypeScript API. Holds every API key. SQLite via Drizzle.
apps/web          React + Vite + TypeScript + Tailwind + Framer Motion + three.js
Dockerfile        One container: API + built PWA
render.yaml       Render Blueprint (free hosting)
```

## Run it on your computer

Requires **Node.js 20+** (download the LTS from <https://nodejs.org>).

```bash
git clone -b claude/aura-music-ai-visuals-tn8u6p https://github.com/indranilsukla31-glitch/shieldbroser.git
cd shieldbroser
npm install
cp .env.example .env        # Windows: copy .env.example .env
```

Edit `.env`:

| Variable | What it is |
|---|---|
| `JAMENDO_CLIENT_ID` | Free key from <https://devportal.jamendo.com> (create an app → Client ID). |
| `ANTHROPIC_API_KEY` | Your Claude API key from <https://console.anthropic.com>. Without it, Artei uses built-in presets and Remix is off. |
| `COOKIE_SECRET` | Any long random string. |
| `MOCK_CATALOG` | `1` = offline demo catalog with synthesized audio (no keys needed). |
| `ARCHIVE_ENABLED` | `1` (default) adds Internet Archive / Musopen recordings; `0` turns them off. |
| `REMIX_DAILY_LIMIT` | Remixes per user per day (default 10). |

Start it:

```bash
npm run dev                 # Mac/Linux: API on :8787 + web on :5173
# Windows: run these in two terminals
npm run dev:server
npm run dev:web
```

Open <http://localhost:5173>. On your Android phone (same Wi-Fi), open the "Network" address Vite prints.
(Installing as an app needs HTTPS, so for that use the hosted version below.)

Production build on your machine: `npm run build && npm start` → everything on <http://localhost:8787>.

## Put it online and install it on Android (Render, free)

1. Sign up at <https://render.com> with your GitHub account.
2. **New → Blueprint**, pick the `shieldbroser` repo. Render reads `render.yaml` from the selected branch — if it
   only offers `main`, merge the `claude/aura-music-ai-visuals-tn8u6p` branch into `main` first.
3. When asked, paste your `JAMENDO_CLIENT_ID` and `ANTHROPIC_API_KEY`. `COOKIE_SECRET` is generated for you.
4. Wait for the first deploy (a few minutes) and open the `https://….onrender.com` address.
5. On your Android phone, open that address in **Chrome** → tap **Install app** on the home screen
   (or Chrome menu → *Add to Home screen* / *Install app*).

Notes for the free plan: the service sleeps when idle (first load after a while takes ~30–60 s), and it has no
persistent disk, so cached Visual DNA, likes and saved cards reset when Render redeploys or restarts it.
For persistence, use a paid instance with a disk mounted at `/data` and set `DATABASE_PATH=/data/artei.db`.

**Railway / any Docker host:** deploy the `Dockerfile`, set the same environment variables, and mount a volume
at `/data` (the default `DATABASE_PATH`). The container listens on `$PORT` (default 8787).

## Test

```bash
npm test             # server (41) + web (14) tests — no network or keys needed
npm run typecheck
```

Server tests replace Jamendo with a fixture and Claude with a scripted fake model, covering: track routes, license
and lyrics parsing, the audio proxy (Range + host allowlist), the Visual DNA validator, retry → preset fallback,
caching and de-duplication, remix limits, saved cards. Web tests cover lyric timing/sync, the DNA → visuals
mapping, and the ND clip rule.

Preview any scene without Claude: open the player and add `?scene=aurora` (or `nebula`, `liquid_chrome`,
`rain_on_glass`, `paper_cutouts`, `neon_city`, `ink_in_water`) to the `/now` URL. Force a quality tier with
`&tier=low|mid|high`.

## API

| Method | Path | Notes |
|---|---|---|
| GET | `/api/health` | active catalog, which keys are configured (never the keys) |
| POST | `/api/session` | sets the signed, httpOnly anonymous-ID cookie |
| GET | `/api/tracks/trending` · `/mood/:mood` · `/search?q=` · `/classics` | `mood` = chill, focus, workout, latenight |
| GET | `/api/tracks/:ref` · `/api/tracks/:ref/lyrics` | `ref` = `jamendo:<id>` or `archive:<identifier>~<file>` |
| GET | `/api/stream/:ref` | audio proxy with HTTP Range; only proxies `*.jamendo.com` and `*.archive.org` |
| POST | `/api/visual-dna` | `{ trackRef }` → cached or newly generated Visual DNA |
| GET | `/api/visual-dna/:ref` | cached only |
| POST | `/api/visual-dna/:ref/remix` | `{ prompt ≤140, baseId? }`, per-user daily limit + IP rate limit |
| GET | `/api/visual-dna/:ref/remixes` | your remixes + remaining allowance |
| GET | `/api/cards/:id` | public card data for sharing |
| GET/PUT/DELETE | `/api/library/likes[/:ref]` · `/api/library/cards[/:id]` | per anonymous user |

Errors are always `{ "error": { "code", "message" } }`.

## How Claude is used

`apps/server/src/claude/`:
- `prompts.ts` — the system prompt explaining what each parameter does; track metadata and catalog lyrics go in
  delimited blocks and are treated as content, not instructions.
- `model.ts` — Anthropic SDK call to `ANTHROPIC_MODEL` (default `claude-sonnet-5-5`) with structured outputs built
  from the shared zod schema and server-side refusal fallbacks. If the API rejects either feature, it switches
  to plain JSON mode automatically.
- `generate.ts` — parse → zod-validate → one retry with the validation errors → otherwise report failure.
- `service.ts` — one call per track, cached; concurrent requests share one call; preset fallback; remix limits.

Cost: one call per track the first time anyone plays it, plus one per remix.

## Licensing rules the app follows

- **Music**: Jamendo's Creative Commons catalog, plus Internet Archive items from the `musopen` and
  `opensource_audio` collections **only when the item's license is a public-domain mark/CC0 or a Creative
  Commons license** — items without a clear license are skipped. Credit (title, artist, source, license + deed link) is
  shown on the player, on Visual DNA cards and inside exported clips. Unknown licenses are treated as most
  restrictive.
- **Lyrics**: only artist-supplied lyrics returned by Jamendo with the track. Nothing is scraped.
- **Clips**: blocked for ND licenses. NC tracks: clips are for personal, non-commercial sharing.
- **Jamendo's free API is for non-commercial use**; Artei is a personal, non-commercial project.

## Known limitations

- Clips are recorded as MP4 or WebM, whichever the browser can record. Depending on the browser the MP4 may
  use VP9 video, which a few apps won't accept; re-share the downloaded file or use another app if that happens.
- On Android, playback is routed through Web Audio for the visuals. Lock-screen controls work; if your phone
  aggressively stops background audio for Chrome, add Artei/Chrome to the battery-optimisation exceptions.
- iPhone Safari is not a target: the app runs, but install, lock-screen controls and clip export are limited there.
- Internet Archive items rely on the uploader's license field; Artei only trusts public-domain and Creative
  Commons values there. Archive recordings have no lyrics.
- If your host restricts outbound network access, allow `api.jamendo.com`, `*.storage.jamendo.com`,
  `usercontent.jamendo.com`, `archive.org`, `*.archive.org` and `api.anthropic.com`.

## Database

SQLite file at `DATABASE_PATH`. Migrations live in `apps/server/src/db/migrations` and run automatically on
startup. After changing `src/db/schema.ts`, run `npm run db:generate --workspace @artei/server`.
Moving to Postgres means swapping the Drizzle driver and generating the schema with the `pg` dialect.
