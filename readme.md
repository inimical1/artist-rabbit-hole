# Artist Rabbit Hole 🎵

A full-stack music discovery platform that lets you explore artists, their influences, and collaborative listening rooms — powered by AI, real-time sync, and Spotify.

**Live:** [artist-rabbit-hole.vercel.app](https://artist-rabbit-hole.vercel.app)

---

## What it does

Type any artist name and fall into a rabbit hole. The app pulls real data from multiple music APIs, generates AI-written stories about the artist, visualizes their influence network in 3D, and lets you listen together with friends in real-time music rooms.

---

## Features

**Artist Discovery**
- Search any artist and get a full profile — genres, active years, country
- AI-generated vibe summary and 3-paragraph music journalism style story (Groq/LLaMA 3)
- Interactive 3D influence graph showing who influenced the artist and who they influenced — click any node to explore that artist
- Sonic DNA bars showing energy, danceability, mood, acousticness, tempo
- Autocomplete search suggestions powered by Spotify API
- Dynamic colour theming — each artist page adapts its accent colour based on their image

**Trending**
- Live trending songs from Last.fm updated hourly
- Horizontal scrollable spotlight section on the homepage

**Spotify Integration**
- Connect your Spotify account to see your top 10 artists on the homepage
- Click any top artist to instantly explore their rabbit hole
- High quality artist images pulled from Spotify's catalog

**Music Rooms (The YouTube Evolution)**
- **The Spotify Era:** Originally built with the Spotify Web Playback SDK. While powerful, it hit the "Premium-only" wall and heavy developer quota restrictions that made universal rooms difficult for mixed-user groups.
- **The YouTube Shift:** To make rooms accessible to everyone, we migrated the entire playback engine to YouTube. Now, any track can be queued without requiring a Premium subscription.
- **The Stability Engine:** Includes a robust validation layer that fires multiple parallel searches, ranks tracks by "Official" status, and performs deep validation (oEmbed + direct frame checks) to ensure playability.
- **Resilient Playback:** A built-in "Error Recovery" system detects unplayable tracks (Error 150/101) in real-time and automatically blacklists them, skipping to the next valid song so the party never stops.
- **AI DJ Cooldown:** When the queue runs dry, the AI DJ suggests new tracks, now protected by a 60-second recovery cooldown to prevent API exhaustion during platform-level outages.

**Auth**
- Email/password login via Supabase Auth
- Spotify OAuth for profile and top artist discovery features

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React, Next.js 16 (App Router), Tailwind CSS |
| Backend | Next.js API Routes, Node.js |
| Database | Supabase (PostgreSQL) |
| Real-time | Supabase Realtime |
| Auth | Supabase Auth, Spotify OAuth 2.0 |
| AI | Groq API (LLaMA 3.3 70B) |
| Music APIs | YouTube Data API v3, Spotify API, MusicBrainz API, Last.fm API |
| Visualisation | 3D Force Graph, D3.js |
| Deployment | Vercel (frontend + backend), Supabase (database) |

---

## Architecture
User → Next.js Frontend (React)
↓
Next.js API Routes (Backend)
↓
┌─────────────────────────────────┐
│  MusicBrainz  │  YouTube API   │
│  Last.fm API  │  Spotify API   │
│  Groq AI API  │                │
└─────────────────────────────────┘
↓
Supabase (PostgreSQL + Realtime)

**Key architectural decisions:**
- **The YouTube Migration:** Swapped out the complex Spotify SDK for a custom `react-youtube` implementation to broaden access.
- **Ranking & Validation:** Implemented a scoring-based search strategy to prefer `Official Artist Channels` and `- Topic` videos, significantly reducing the "fan-made cover" noise.
- **Platform Integrity:** Added a `failedVideoIds` blacklist ref. Since YouTube embedding restrictions are often IP or domain-specific and unpredictable at the API level, the app now "learns" which videos are broken in real-time and avoids them for the rest of the session.
- Next.js App Router for full-stack in a single repo — API routes and frontend together.
- Supabase Realtime for WebSocket-like sync across room members without managing a WebSocket server.
- Groq as the AI layer for structured JSON responses — prompt engineered to return artist data in a specific schema with graceful fallbacks.
- MusicBrainz as the primary music data source (free, no auth) with Groq as fallback for influence data when MusicBrainz relations are sparse.

---

## Running locally

**Prerequisites:** Node.js 18+, pnpm, YouTube API Key, Spotify Developer account, Supabase account, Groq account, Last.fm account

**1. Clone the repo**
```bash
git clone https://github.com/inimical1/artist-rabbit-hole
cd artist-rabbit-hole
```

**2. Install dependencies**
```bash
pnpm install
```

**3. Set up environment variables**
Ensure `YOUTUBE_API_KEY` is added to your `.env.local`.

**4. Run the dev server**
```bash
npm run dev -- --hostname 127.0.0.1
```

Open [http://127.0.0.1:3000](http://127.0.0.1:3000)

---

## Database schema

```sql
rooms           -- Room metadata, host, room code
room_members    -- Users currently in a room
room_queue      -- Songs added to a room's queue
room_reactions  -- Emoji reactions per song per user
room_playback   -- Current playback state synced across members (supports YouTube Video IDs)
```

---

## Known limitations

- **YouTube Embedding restrictions:** Some record labels block embedding on third-party sites. While our validation engine catches 90% of these, some region-specific blocks only appear at runtime (Error 150). Our auto-skip engine handles these gracefully, but it remains a platform-level constraint.
- MusicBrainz influence data is sparse for newer artists — Groq AI fills in the gaps.
- Spotify features (Top Artists) still require a connected Spotify account.

---

## Author

Deepankar Suman — [github.com/inimical1](https://github.com/inimical1)

SRM Institute of Science and Technology