# Deep Field

Saubhagya Dubey's personal site: a small corner of space you fly around, painted in the style of *Arcane*. Pick the undercity to meet the person or topside to read the work, then fly a ship between planets, suns, a quasar and a station. Each stop tells one piece of the story.

Built with [React](https://react.dev/), [Vite](https://vite.dev/), [three.js](https://threejs.org/) through [React Three Fiber](https://r3f.docs.pmnd.rs/) and custom GLSL. The design system and the rules the scene follows live in [DESIGN.md](DESIGN.md). The concept log is [CONCEPT.md](CONCEPT.md).

## Getting started

Requires Node.js 20.19+ or 22.12+.

```bash
npm install
npm run dev
```

The dev server runs at http://localhost:5173.

## Scripts

| Command           | Description                                 |
| ----------------- | ------------------------------------------- |
| `npm run dev`     | Start the development server                |
| `npm run build`   | Build for production into `dist/`           |
| `npm run preview` | Serve the production build locally          |
| `npm run lint`    | Lint the project with Oxlint                |
| `npm test`        | Run the API tests (`node:test`, no deps)    |

## Routes

| Path     | What it is                                                   |
| -------- | ------------------------------------------------------------ |
| `/`      | Launch: a title card with both cities and my name between    |
| `/under` | The undercity, me: where I'm from, what I read, why I build  |
| `/top`   | Topside, the work: six places since 2020, and how to say hi  |
| `/text`  | Everything as plain text, plus experience, skills, education |
| `/play`  | Deep Field: Impact, an on-rails 3D shooter with a leaderboard |

`/blue` and `/red` (the old routes) redirect to `/under` and `/top`.

`vercel.json` rewrites every path to `index.html` so deep links work on Vercel.

## Editing content

Everything a visitor reads is in `src/data/worlds.js`: each stop's name, its factual flag line (`fact`), its poetic tag, story paragraphs, position on the map and look. Every colour is in `src/data/palette.js` (mirrored in `src/styles/tokens.css`). Professional details for the text version are in `src/data/portfolio.js`. The sixteen face frames are in `src/assets/portrait/`; they are painted at load by a worker until Arcane-style redraws replace them (see `PAINT_PORTRAITS` in `src/data/portrait.js`).

The painted look is a post-processing stack sized to the device. URL overrides:

| Query    | Effect                                                   |
| -------- | -------------------------------------------------------- |
| `?fx=0`  | No post-processing at all (debug view)                   |
| `?fx=1`  | Light tier: smaller brush, lighter ink                   |
| `?fx=2`  | Full tier: 5x5 Kuwahara brush, depth + luminance ink     |

Fonts: Orbitron (display), Chakra Petch (HUD), Fraunces (reading), IBM Plex Mono (labels), all self-hosted through Fontsource.

## Project structure

```
DESIGN.md                  Design system: idea, voice, colour, type, scene, motion, a11y
CONCEPT.md                 How the idea got here, iteration by iteration
public/textures/           Earth maps (NASA Blue Marble via the three.js examples)
public/assets/             Source grid of the portrait headshots
src/
  data/                    worlds.js (all copy), palette.js (all colour), portfolio.js, portrait.js
  state/                   zustand store + per-frame simulation state
  three/                   shaders.js and every scene object; Simulation.jsx is the flight model
  three/post/              the painted look: Paint (Kuwahara), Ink, Grade, Lens effects
  workers/                 paint.worker.js, which paints the portrait frames off the main thread
  lib/                     router, warp (paint-splash transition), tier (device quality), texture (masks)
  scenes/                  Launch, Explore, TextVersion, Play
  components/              Helmet, Flags, StoryPanel, RouteBar, Hud
  game/                    the shooter: GameLoop (all logic), state, waves, creatures, rules (shared with the API), board (leaderboard client)
  styles/                  tokens.css, base.css
api/                       Vercel functions for the leaderboard; shared code in api/_lib/
tests/                     API tests
```

## Leaderboard backend

`/play` keeps a leaderboard through four Vercel functions in `api/` backed by Firestore (`firebase-admin`):

| Route                  | What it does                                                                         |
| ---------------------- | ------------------------------------------------------------------------------------ |
| `GET /api/pilot`       | This browser's pilot (callsign, best, rank), or a suggested callsign; sets the cookie |
| `POST /api/pilot`      | Rename: `{ callsign }`, 3–16 characters (kept on the device until the first score)    |
| `POST /api/run`        | Start a run: returns a signed run token                                              |
| `POST /api/score`      | Spend the token with `{ run, score, wave, kills }`                                   |
| `GET /api/leaderboard` | Top 10 pilots by best run (no query string; CDN-cached for 10 s)                     |

**Accounts are cookies.** A visitor's pilot is a random id in a signed, HttpOnly `df_pilot` cookie scoped to `/api`. No sign-up; clearing cookies starts a new pilot. The board shows callsigns and a public tag, never the id. Nothing is written to Firestore until a pilot's first accepted score.

**Scores are checked against the game, not trusted.** A run token is issued at launch and can be spent once, only by the same cookie, within four hours. The API replays the game's own wave plan (`src/game/waveplan.js` and `src/game/rules.js`, shared with the game) to know how many creatures a run could have met by the wave it reports, the most those kills can score, and how soon that wave can be reached. The game runs in the browser, so a determined cheat can still post a perfect-play score; if one does, delete their doc in `pilots/` from the Firebase console.

**Abuse limits.** Each function instance rate-limits writes per IP (`api/_lib/limit.js`), but instances count separately. For a hard limit, add a Vercel Firewall rule: Project → Firewall → New rule → path starts with `/api/`, method POST, rate limit about 30 requests per minute per IP.

**Local dev needs nothing.** Without Firebase credentials, `npm run dev` (and `vite preview`) serve the API from Vite (`scripts/api-dev.js`) with an in-memory store that resets when the server restarts.

### Setting up Firebase (once)

Use a **dedicated project on your personal Google account**. The deploy below replaces the project's Firestore rules with deny-all, so it must never point at a project anything else uses. Always pass `--project` and `--account` explicitly; don't rely on whichever account the CLI is logged into.

1. In the [Firebase console](https://console.firebase.google.com/), signed in with your personal account, create a new project (for example `deep-field-board`) and add a **Firestore** database in Native mode.
2. Add your personal account to the CLI next to any work login, then deploy the rules (deny all client access; only the API talks to Firestore) and the TTL policy for spent runs:
   ```bash
   firebase login:add                     # your personal account; the work login stays untouched
   firebase deploy --only firestore --project deep-field-board --account you@personal.example
   ```
3. Project settings → Service accounts → **Generate new private key**. Save it **outside the repo** (it lands in `~/Downloads`); `*-firebase-adminsdk-*.json` is git-ignored as a backstop.
4. In Vercel → Project → Settings → Environment Variables, add (see `.env.example`):
   - `COOKIE_SECRET`: 32+ random characters (`node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"`)
   - `FIREBASE_SERVICE_ACCOUNT`: the key, base64-encoded: `base64 -i ~/Downloads/<project>-firebase-adminsdk-<id>.json | tr -d '\n'`
5. Delete the downloaded key file, then redeploy. To use Firestore locally too, put the same two variables in `.env.local`.

## Deployment

`npm run build` produces a static site in `dist/`; Vercel serves it and deploys `api/` as functions. `vercel.json` rewrites every other path to `index.html` so deep links work.

## Visual check without a browser open

`scripts/shoot.mjs` drives headless Chrome over the DevTools protocol, flies through both galaxies and saves screenshots. With the dev server running:

```bash
node scripts/shoot.mjs http://localhost:5173 shots
```

Scenarios: `home`, `under`, `top`, `fly`, `grade`, `splash`, `reduced`, `mobile`, `text`, `debug` (`blue` and `red` still work as aliases). Pass names to run a subset. Rendering is software-only there, so the simulation runs slower than on a real GPU; the script waits for docking instead of fixed delays.
