# Deep Field — design system

Saubhagya's portfolio is a small corner of space you fly around, painted like *Arcane*. This file is the source of truth for the idea, the voice, colour, type, motion, interaction and the rules the WebGL scene follows. Change colours in `src/data/palette.js` first (and mirror `BASE` in `src/styles/tokens.css`), then the code. Content lives in `src/data/worlds.js`.

## 1. The idea

You are an astronaut. From the start screen you pick a side: **the undercity** is who I am apart from work, **topside** is the work. The two sides are painted after Arcane's two cities: the undercity has Zaun's chem green, smog teal, gunmetal and a shimmer-pink second light; topside has Piltover's steel, blue-white and hextech blue. Inside a side you fly a small ship between things (a planet, twin suns, a quasar, a dead probe, a comet, a nebula, a station) and each one tells one piece of the story when you reach it. A gate on each side leads to the other, drawn in the style of the city it opens onto, because both halves are me.

It is a story told to a friend, set in a fictional place. It is not a résumé with a theme on top. The plain-text version at `/text` carries the same words plus the details a hiring manager needs.

## 2. Voice (non-negotiable)

- First person, lowercase-friendly, short sentences. The way you'd talk across a table.
- Concrete over clever. A number appears only when it is part of the story, never as a badge.
- Nothing pretentious. No metaphors stacked on metaphors, no "journey", no corporate nouns.
- Books and thinkers are described, not name-dropped. "one is very old and says…" never "Ashtavakra Gita".
- Every stop reads on its own and also as the next paragraph of one story. Adjacent stops reference each other lightly ("the same itch as the quasar back there").
- UI copy follows the same voice: "hold and drag to fly, or tap a flag", "not yet", "on to the gate".

## 3. Structure

```
/          The ride: the cockpit of the game's ship. Hold space (or click, or tap) and it takes off, stops
           four times (my name over Delhi, a million downloads, Tide now, the why), one card each in the
           middle of the canopy, and ends at a fork: the undercity, topside, or the game. About 35 s; holding
           space goes faster, → or a click moves on, Esc skips to the fork. Plays once per tab session; after
           that / opens at the fork. No portrait here.
/under     "me": delhi → the why → two books → the ones that didn't come back → the guessing game → the rules → gate
/top       "the work": unthinkable → elixia → super six → ok2 health → dtdc → tide → say hi → gate
/text      Everything as plain text, plus experience, skills, education.
/blue /red Old routes; redirect to /under and /top.
```

Order matters: the dashed route line, the numbers in the story panel ("03 / 06") and the "next" button all follow the array order in `worlds.js`.

## 4. Interaction rules

1. **Nothing requires clicking through.** Reaching a stop opens its story, whole, at once. Leaving closes it.
2. **Three ways to move, all equal:** hold and drag anywhere (mouse or finger), arrow/WASD keys, or click a flag to autopilot there. The "next" button in a story is autopilot to the next stop.
3. **Everything is labelled, with facts.** Each stop has a flag with its name and one plain, checkable line (`fact`: company · role · dates · place, or place · coordinates). The poetic `tag` lives in the story header. Off-screen stops clamp to the screen edge with an arrow and a short name, spread so they never overlap.
4. **The route is visible.** A dashed line joins the stops in order. The strip at the bottom shows the same order: gems on topside, vials on the undercity, lit or filled when visited, ringed when current.
5. **One light accent per city.** Undercity green `#8ff07a` or topside hextech blue `#5fd7ff` colours the flags, the route, the marker rings, the panel stroke and the strip. The city's material (gunmetal or steel plates) carries the rest of its identity. The other city's colour appears only on its gate.
6. **Keyboard works end to end.** Flags and the strip are buttons; Enter flies there; Escape closes a story.
7. **Reduced motion:** no cold open, no twinkle, no arrival dolly, FX animate continuously instead of on twos, no hex wipe (a straight cut), no panel slide; the launch seam snaps instead of following the pointer and the ship sits still. Flying still works because it is the content.
8. **No WebGL:** `/text` renders in place of everything.

## 5. Colour

All colour comes from `src/data/palette.js`. `BASE` is mirrored in `tokens.css`; city colours reach CSS as inline custom properties (`cityVars()`), and WebGL reads the module directly.

| Base | Hex | Use |
|---|---|---|
| `ink` | `#0a0b0f` | page background, the ink in outlines (tinted per city) |
| `paper` | `#eef2f8` | text, cool off-white |
| `dim` | `#aeb6c2` | secondary text |
| `faint` | `#6c7380` | decorative only |
| `line` | `#24272d` | dividers |
| `steel` | `#bcd4f6` | links, focus rings, rules, the ride's neutral accent (my name's card, the fork) |

| City | Undercity (me) | Topside (work) |
|---|---|---|
| `accent` (the one light) | `#8ff07a` chem green | `#5fd7ff` hextech blue |
| `accent2` (glows, gates, rare) | `#ff5fa8` shimmer pink | `#dce8ff` blue-white light |
| `plate` (UI material) | gunmetal `#23262c` → `#121418` | steel `#3a4250` → `#1a1e26` |
| `sky` | `#081311` → `#1a352a` | `#07090d` → `#1e2633` |
| `grade` shadow / mid / high | teal / green / pink | navy / slate / cyan |

Never pure black, never pure white. Ink is mixed toward the city's `inkTint`, not black. The neutrals are black, grey, white and blue-white: nothing in the chrome is brown or beige.

**Air.** Each planet in `worlds.js` carries an `air` (sky, smog, ambient, grade, the same shape as a city's). While you're docked there, the backdrop, haze, ambient light and split tone blend to it over 1.6 s (`src/three/air.js`), and back to the city's when you leave. Text, plates and flags keep the city's colours. Stops without `air` leave the sky alone.

## 6. Type

- **Orbitron** (700/900, caps, `.04em`) for game display: the play-the-game slab, the game logo and banners, `/text` headings. Cyberpunk, wide; keep it to short lines. Never for long numbers: its slashed zero reads badly in a row.
- **Archivo** (variable, `font-stretch: 125%`) for poster type, set like a film one-sheet: a small kicker at 400, caps, `.55em` tracking (with a matching left pad so centred lines stay centred), over a title at 800, caps, line-height ~.9, `-.015em`. No plate: the scale is the decoration. The title is solid white, traced in ink, with two misregistered shadows behind it, warm down-left and cool up-right, each only cross-hatching in its city colour inside a thin contour (`shade` in `palette.js`: pink and green below, gold and cyan topside). Each shadow fades along its offset, once per line: the warm one is full under the letters and thins up their left sides, the cool one full along their tops and thinning down their right sides. The white sits on a soft two-layer drop shadow (a `filter`, since a `text-shadow` would paint over the clipped fill); the kicker gets a matching soft shadow. Every ~5 s the city's accent breaks from the middle of each line and spreads out past both ends, fading as it goes, the hatch boils on twos, and the shadows slip for two frames once a loop. The fit reads overflow off the text, not `scrollWidth`, since the shadows hang past the box. The shadows are `::before`/`::after` copies of the title from `data-text`, with empty alt text.
  - Home (the ride): each stop's card is centred in the canopy, its title sized to the largest that fits in two lines (≤ 150px, ≤ 19vh), the kicker above, then one line in Fraunces and the fact in Plex Mono. At the fork, ME / THE WORK in Archivo with their city names as kickers. The shared poster type lives in `src/styles/poster.css`.
  - Stops: when you dock, the stop's name is set over the scene left of the story plate, its `tag` as kicker. `StoryPanel` sizes it to the largest that fits its column (no word overflows, at most 60% of the column's height, ≤ 24vh). Flags stay above it.
- **Chakra Petch** (500/600) for the HUD: the top bar, flag names, the game's score, hull and buttons. Squared and techy but legible at 12–14px.
- **Fraunces** (variable) for everything you read: story text, the hello, `/text`. `opsz 14, WONK 1, SOFT 30` for body; italics for the hint.
- **IBM Plex Mono** for small labels: flag facts, tags, counters, the route strip, control lists. Labels are plain on purpose: they carry facts, so they look like signage, not decoration.
- Story text 17px / 1.7, measure ≤ 60ch. Flag names 13px caps `.1em`, facts 11px. Buttons 12.5px caps.

## 7. The scene

Built with three.js via React Three Fiber. Every surface follows the same painted rules, and a post stack paints over the lot.

**Object shaders** (`src/three/shaders.js`, shared helpers at the end of the `noise` chunk):
- Light falls in three bands with brushed, noise-jittered borders (`ramp`), never a smooth gradient.
- Albedo goes through a hand-painted four-colour gradient with uneven breaks (`ramp4`) and is dragged into strokes (`strokes`).
- A coloured rim light in the city accent sits on every lit edge (`rimBand`); rocky dark sides get light hatching.
- FX that are light rather than matter (coronas, accretion disk, jets, comet tail, gate swirl, sun surface) animate on twos (`stepT` at 8 fps) and use flat, banded alpha like hand-drawn effect plates.
- Nebula masses are painted shapes with hard-ish silhouettes and two flat value steps, normal-blended so they occlude like paint, plus one thin additive core.
- Gates: a faceted hextech gem going up to topside, a breathing chem vent going down to the undercity, framed by steel or gunmetal rings.
- Metal (ship, probe, station, gate rings) uses `MeshToonMaterial` with one shared four-step ramp.
- Earth is the real map, posterised halfway and brushed, with Delhi's light kept.
- Background: a painted dark gradient per city with undercity smog bands or a topside haze band, stars as turned, squashed paint dabs. No static specks or grain: the frame stays clean.
- Light direction per city is one vector (`world.sun`) shared by the directional light and every shader.

**Post stack** (`src/three/Effects.jsx`, effects in `src/three/post/`), in order. Nothing is laid over the whole frame: no brush, paper, halftone or grain (removed 2026-10-17, matching the shooter).
1. **Ink**: Sobel on depth (silhouettes of solid things) and luminance (painted shapes, dark side only), threshold wandering with noise, never pure black. Galaxies only; off on the ride.
2. **Bloom** (halation, threshold 0.55) and **Grade**: ACES, per-city three-way split tone, soft S-curve, saturation, vignette. On the ride the split tone follows each stop's `air`.
3. **Lens**: chromatic aberration toward the frame edge.

Neighbour-sampling effects are flagged `CONVOLUTION` so `postprocessing` keeps them in their own passes and in this order. Runtime values are written onto uniforms in `useFrame`, never passed as props (that would rebuild the effect).

**Tiers** (`src/lib/tier.js`): tier 2 ink + MSAA, dpr ≤ 1.5; tier 1 lighter ink, dpr ≤ 1.25; tier 0 grade + bloom only, dpr 1. `?fx=0|1|2` overrides.

Performance rules: no per-frame React state (the render loop mutates `sim` and writes DOM transforms directly), shader noise ≤ 5 octaves, materials disposed on unmount. `sim.fps` holds a smoothed frame rate for tuning.

## 8. Motion

- Physical, damped, slow. Acceleration and drag for the ship; lerped camera with a little lead; springless.
- Nothing bounces, wobbles or squashes. Nothing auto-plays across the screen, with one exception: the cold open.
- **The ride** (`src/lib/journey.js`, `src/scenes/Journey.jsx`, `src/three/JourneyScene.jsx`): first person from the game's cockpit. A take-off ring fills while space is held (0.6 s) or by itself after a click. Legs are 1.3 s smootherstep flights down -z with dust streaking past; each stop's body grows out of the dark on its own leg and its card rises as the ship brakes, then you fly through it on the way out. The sky blends to each stop's `air`. Galaxies unwind at the fork only on the last leg. Picking a way out turns the ship toward it and floors it (1 s), then the hex wipe. Reduced motion: no flight, cuts between stops, nothing moves on by itself. `?journey=1|0` forces the ride or the fork.
- Matter moves smoothly; painted FX step on twos. Ambient motion is always slow enough to ignore.
- Scene change: a hextech hex of the destination city's colour opens from where you clicked (220 ms), the scene changes underneath, then it fades (260 ms). From the fork, the ship turns and dives into the chosen galaxy first (1 s). Arrival eases the camera down from far above over ~2 s; a deep link autopilots the last stretch to its stop.
- Story panel slides in over 320 ms; the poster title rises out of a mask over 700 ms and its kicker drifts in. Reduced motion holds the shadows and highlight still.

## 9. Accessibility

- Every interactive thing is a real `<button>` or `<a>` with a label. Focus ring: 2px dotted steel.
- Story panel is `aria-live="polite"`. The strip count announces progress.
- Contrast: `--paper` on `--ink` about 17:1, `--dim` on `--ink` about 9.5:1, both city accents on `--ink` ≥ 10:1. `--faint` is decorative only.
- `/text` is the full site for screen readers and for anyone who prefers to read.

## 10. Files

```
src/data/palette.js       every colour (BASE + the two cities); tokens.css mirrors BASE
src/three/air.js          the live sky: blends to the docked planet's `air` and back
src/data/worlds.js        every stop, its copy, fact line, position, look, and the launch copy
src/data/portfolio.js     experience, skills, education (used by /text)
src/data/portrait.js      the sixteen face frames (not shown anywhere right now; kept for the Arcane redraws)
src/state/store.js        reactive UI state (zustand) + per-frame `sim` + flag element map
src/three/*               shaders and scene objects; Simulation.jsx is the flight model
src/three/post/*          Ink, Grade, Lens effects
src/data/journey.js       the home page's ride: its stops, their cards and bodies, the fork's copy
src/three/JourneyScene.jsx the ride's WebGL: Director (one clock), cockpit rig (ShipModel + eye), dust, far sky,
                          stop bodies, fork galaxies (galaxy.js)
src/lib/*                 router (+ ?stop deep links), warp (hex wipe), tier (device quality), journey (the ride's
                          state machine), arrival (deep-link start point)
src/styles/poster.css     poster type, shared by the stop titles and the ride's cards
src/scenes/*              Journey (home), Explore, Play, TextVersion and their CSS
src/components/*          Flags, StoryPanel, RouteBar, Hud
```

## 11. What Arcane means here

Five rules the restyle committed to before any code:

1. **Painted light, clean frame.** Light in bands, strokes in the flat areas; the painting lives in the materials. No brush, paper or grain over the frame.
2. **One light per city.** Green below, hextech blue above. Steel and gunmetal are materials, not lights.
3. **FX on twos.** Anything that is light rather than matter steps at 8 fps, like hand-drawn effects over 3D.
4. **Ink is never black.** Outlines and shadows lean toward the city's own dark.
5. **Labels are facts.** The poetry is in the story; the flags say who, what, when and where.
