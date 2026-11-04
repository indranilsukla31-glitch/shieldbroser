# Artei

Free, legally licensed music with a live, audio-reactive visual world for every song.
Claude (on the backend) designs each track's **Visual DNA**; our own WebGL engine renders it.

> **Status:** Phase (a) — Jamendo playback with a basic player. Visual engine, Visual DNA,
> lyrics overlay, PWA and remix/clip export arrive in phases (b)–(f).

## Repo layout

```
packages/shared   Types shared by server + web (Track, License, Lyrics; Visual DNA schema later)
apps/server       Fastify + TypeScript API. Holds every API key. SQLite via Drizzle.
apps/web          React + Vite + TypeScript + Tailwind + Framer Motion
```

## Setup

Requires Node 20+.

```bash
npm install
cp .env.example .env
```

Edit `.env`:

| Variable | What it is |
|---|---|
| `JAMENDO_CLIENT_ID` | Free key from <https://devportal.jamendo.com> (create an app → copy the Client ID). Non-commercial use. |
| `COOKIE_SECRET` | Any long random string (signs the anonymous session cookie). |
| `MOCK_CATALOG` | `1` = built-in offline catalog with synthesized audio. No key or network needed. |
| `ANTHROPIC_API_KEY` | Used from phase (c). |

## Run (development)

```bash
npm run dev          # API on :8787 and web on :5173 (Vite proxies /api → :8787)
```

Open <http://localhost:5173>. To try it on your Android phone on the same Wi-Fi, open
`http://<your-computer-ip>:5173` (Vite prints the Network URL).

No Jamendo key yet? `MOCK_CATALOG=1 npm run dev` gives you 8 demo tracks with real
(synthesized) beats, bass and pads, plus demo lyrics and a mix of CC licenses.

## Test

```bash
npm test             # server: routes, license/lyrics/range parsing, stream proxy, library
npm run typecheck
```

Tests never touch the network: Jamendo is replaced with a fake `fetch` and a fixture
(`apps/server/test/fixtures/jamendo-tracks.json`).

## API (so far)

| Method | Path | Notes |
|---|---|---|
| GET | `/api/health` | which catalog is active, which keys are configured (never the keys) |
| POST | `/api/session` | sets the signed, httpOnly anonymous-ID cookie |
| GET | `/api/tracks/trending?limit=` | |
| GET | `/api/tracks/mood/:mood` | `chill`, `focus`, `workout`, `latenight` |
| GET | `/api/tracks/search?q=` | |
| GET | `/api/tracks/:ref` | `ref` = `jamendo:<id>` or `mock:<id>` |
| GET | `/api/tracks/:ref/lyrics` | `{ kind: "synced" \| "plain" \| "none", lines }` |
| GET | `/api/stream/:ref` | audio proxy with HTTP Range; only proxies `*.jamendo.com` |
| GET/PUT/DELETE | `/api/library/likes[/:ref]` | per anonymous user |

Errors always look like `{ "error": { "code", "message" } }`.

## Licensing rules the app follows

- **Music:** only Jamendo (Creative Commons) for now; Internet Archive / Musopen public domain later.
  Every player screen shows the title, artist, source link, and license name + deed link.
- **Lyrics:** only the artist-supplied lyrics that Jamendo returns with the track. No scraping.
  Tracks without lyrics get the instrumental state.
- **Clip export (phase f):** disabled for NoDerivatives (ND) tracks, because CC 4.0 treats syncing
  music to moving images as an adaptation. Unknown licenses are treated as most restrictive.
- **Jamendo's free API is for non-commercial use.** Artei is a personal, non-commercial project.

## Database

SQLite file at `apps/server/artei.db` (path set by `DATABASE_PATH`). Migrations live in
`apps/server/src/db/migrations` and run automatically on startup. After changing
`src/db/schema.ts`, run `npm run db:generate --workspace @artei/server`.
Moving to Postgres means swapping the Drizzle driver and generating the schema with the `pg` dialect.
