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

**Music Rooms**
- Create or join a room with a 6-character code
- Real-time queue — anyone in the room can search and add songs via Spotify search
- Host controls playback, guests sync in real time via Supabase Realtime
- AI DJ — when the queue is empty, Groq AI suggests the next song based on the room's listening history
- Live reactions — 5 emoji reactions that all members see simultaneously
- Vote to skip — majority vote skips the current song
- Members list with host indicator

**Auth**
- Email/password login via Supabase Auth
- Spotify OAuth for music features

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
| Music APIs | Spotify API, MusicBrainz API, Last.fm API |
| Visualisation | 3D Force Graph, D3.js |
| Deployment | Vercel (frontend + backend), Supabase (database) |

---

## Architecture
User → Next.js Frontend (React)
↓
Next.js API Routes (Backend)
↓
┌─────────────────────────────────┐
│  MusicBrainz  │  Spotify API   │
│  Last.fm API  │  Groq AI API   │
└─────────────────────────────────┘
↓
Supabase (PostgreSQL + Realtime)
**Key architectural decisions:**
- Next.js App Router for full-stack in a single repo — API routes and frontend together
- Supabase Realtime for WebSocket-like sync across room members without managing a WebSocket server
- Groq as the AI layer for structured JSON responses — prompt engineered to return artist data in a specific schema with graceful fallbacks
- MusicBrainz as the primary music data source (free, no auth) with Groq as fallback for influence data when MusicBrainz relations are sparse
- Spotify access tokens stored in httpOnly cookies for security, with automatic refresh token rotation

---

## Running locally

**Prerequisites:** Node.js 18+, pnpm, Spotify Developer account, Supabase account, Groq account, Last.fm account

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
room_playback   -- Current playback state synced across members
```

---

## Known limitations

- Spotify Web Playback SDK requires Extended Quota Mode approval for apps in production — currently in development mode, whitelisted users only
- Some YouTube videos restrict embedding by region — affects the influence graph's video previews
- MusicBrainz influence data is sparse for newer artists — Groq AI fills in the gaps

---

## Author

Deepankar Suman — [github.com/inimical1](https://github.com/inimical1)

SRM Institute of Science and Technology