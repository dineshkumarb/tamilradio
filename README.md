# Tamil Radio — Ilayaraja & A.R. Rahman

A personal internet radio app that streams your local music collection. Pick an artist (Ilayaraja or A.R. Rahman), and the app plays their songs continuously with rich metadata and album art.

## Tech Stack

- **Frontend:** React 18, Vite, TailwindCSS, React Router, Socket.IO client
- **Backend:** Node.js, Express
- **Streaming:** HTTP audio stream (current track served as `audio/mpeg` or `audio/flac`)
- **Database:** SQLite via `better-sqlite3`
- **Metadata:** `music-metadata` for embedded ID3/FLAC tags; MusicBrainz and Last.fm API as fallback

## Prerequisites

- Node.js 18+
- Local folders of MP3/FLAC files for each artist

## Setup

### 1. Backend

```bash
cd radio-app/backend
cp .env.example .env
# Edit .env and set:
# - ILAYARAJA_MUSIC_PATH=/absolute/path/to/ilayaraja/songs
# - ARRAHMAN_MUSIC_PATH=/absolute/path/to/arrahman/songs
# - LASTFM_API_KEY=your_key_here  (optional; get one at https://www.last.fm/api/account/create)
# - PORT=3003

npm install
npm run dev
```

Backend runs at `http://localhost:3003`. The SQLite DB and schema are created automatically at `backend/data/radio.db`.

### 2. Frontend

```bash
cd radio-app/frontend
npm install
npm run dev
```

Frontend runs at `http://localhost:5173` and proxies `/api` and `/socket.io` to the backend.

### 3. Last.fm API Key (optional)

1. Go to [Last.fm API accounts](https://www.last.fm/api/account/create).
2. Create an application to get an API key.
3. Put the key in backend `.env` as `LASTFM_API_KEY=your_key_here`.

Used for fetching metadata and album art when tags are missing. If album art still doesn’t appear, check the backend console: invalid API key, “no track found”, or “track found but no album art” are logged. Many Tamil/Indian film tracks have no album art on Last.fm; embedded art (from your files) is always used first when present.

### Docker (production)

One image serves the built frontend and API. Data and uploads are persisted with named volumes; music folders are bind-mounted from the host.

```bash
cd radio-app
cp .env.docker.example .env
# Edit .env: set ILAYARAJA_MUSIC_PATH and ARRAHMAN_MUSIC_PATH to absolute host paths to your music folders,
# and set JWT_SECRET, ADMIN_PASSWORD, and optionally LASTFM_API_KEY.

docker compose up -d --build
```

App is at `http://localhost:3030` (or the port in `PORT`). To push to a registry:

```bash
docker compose build
docker tag radio-app-app:latest your-registry/tamil-radio:latest
docker push your-registry/tamil-radio:latest
```

On the server, use the same `docker-compose.yml` and `.env`, or run the image with env and volumes set (e.g. `-e ILAYARAJA_MUSIC_PATH=/music/ilayaraja` and `-v /host/ira:/music/ilayaraja:ro`).

## Usage

**Listeners (no login):**
1. **Home:** Two artist cards with Ilayaraja and A.R. Rahman photos. Each shows song count; click to open that artist’s player.
2. **Player:** Play/Pause, Skip, volume, progress bar, now-playing metadata and album art. Queue is shuffled; “Up next” shows upcoming tracks.

**Admins (login required):**
3. **Login:** Go to `/login` (or click “Admin” when logged in). Default credentials: `admin` / `admin` (set `ADMIN_USERNAME` and `ADMIN_PASSWORD` in `.env` to change).
4. **Admin:** From `/admin` you can open **Library** for Ilayaraja or A.R. Rahman. There you can **Scan library**, **Edit** metadata, **Fetch** from Last.fm/MusicBrainz, and **Delete** tracks. The Library link in the header is only visible when logged in as admin.

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST   | `/api/stream/start/:artist` | Start stream (ilayaraja / arrahman) |
| POST   | `/api/stream/stop/:artist`  | Stop stream |
| GET    | `/api/stream/status/:artist`| Stream status + current song |
| POST   | `/api/stream/skip/:artist`  | Skip to next track |
| GET    | `/api/stream/audio/:artist` | HTTP stream of current track (use as `<audio src>`) |
| POST   | `/api/auth/login`          | Body: `{ "username", "password" }` — returns `{ token, user }` |
| POST   | `/api/auth/change-password` | **Admin.** Body: `{ "currentPassword", "newPassword" }` — change own password |
| GET    | `/api/library/:artist/count` | **Public.** Song count for artist (for home page). |
| GET    | `/api/library/:artist`      | **Admin.** List all songs for artist |
| POST   | `/api/library/scan`        | **Admin.** Body: `{ "artist": "ilayaraja" \| "arrahman" }` — scan configured music folder |
| DELETE | `/api/library/:id`        | **Admin.** Remove song from library |
| PUT    | `/api/library/:id`        | **Admin.** Body: `{ "title", "album", "year", "genre" }` — update metadata |
| GET    | `/api/library/:id/metadata`| **Admin.** Fetch metadata from Last.fm/MusicBrainz (optional query: `artistName`, `title`) |
| GET    | `/api/nowplaying/:artist`  | Current song + queue |

## Environment (backend `.env`)

| Variable | Description |
|----------|-------------|
| `ILAYARAJA_MUSIC_PATH` | Absolute path to folder containing Ilayaraja MP3/FLAC files |
| `ARRAHMAN_MUSIC_PATH` | Absolute path to folder containing A.R. Rahman MP3/FLAC files |
| `LASTFM_API_KEY` | Last.fm API key for metadata/art fallback |
| `PORT` | Server port (default `3003`) |
| `JWT_SECRET` | Secret for signing JWTs (change in production) |
| `ADMIN_USERNAME` | First admin user created on first run (default `admin`) |
| `ADMIN_PASSWORD` | First admin password (default `admin`; change in production) |
| `CORS_ORIGIN` | Allowed origin for CORS (default allows all; set e.g. `http://localhost:5173` in production) |

### Changing the admin password in production

The initial admin is created from `ADMIN_USERNAME` and `ADMIN_PASSWORD` only on first run. Changing `.env` later does **not** update the existing user’s password. Use either of these:

1. **From the app (recommended)**  
   Log in as admin, then call:
   - `POST /api/auth/change-password`  
   - Headers: `Authorization: Bearer <your-jwt>`  
   - Body: `{ "currentPassword": "old", "newPassword": "new" }`  
   You can add a “Change password” form in the Admin UI that uses this endpoint.

2. **CLI script (e.g. locked out or first production set)**  
   On the server, from the backend directory:
   ```bash
   node scripts/change-admin-password.js admin YourNewSecurePassword
   ```
   Replace `admin` with the actual username if different. The script updates the password in the SQLite DB.

## Project Structure

```
radio-app/
├── backend/
│   ├── src/
│   │   ├── routes/       # stream, library, nowplaying
│   │   ├── services/     # streamManager, metadataService, libraryScanner, socketBroadcast
│   │   ├── db/           # SQLite schema + queries
│   │   └── index.js
│   ├── data/             # radio.db (created at runtime)
│   ├── .env.example
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── components/   # ArtistCard, Player, LibraryTable, AlbumArt
│   │   ├── pages/        # Home, PlayerPage, LibraryPage
│   │   ├── hooks/        # useNowPlaying, useStream
│   │   ├── api/          # client
│   │   └── App.jsx
│   └── package.json
└── README.md
```

## Notes

- **Polling:** The frontend polls `/api/nowplaying/:artist` every 5 seconds and also subscribes to Socket.IO `nowplaying` for the same artist for live updates.
- **Album art:** Taken from embedded tags first; otherwise from Last.fm when `LASTFM_API_KEY` is set. Stored as base64 or URL in SQLite.
- **Audio:** Only MP3 and FLAC are indexed; streaming uses the file’s native format (Content-Type: `audio/mpeg` or `audio/flac`).

## License

MIT
