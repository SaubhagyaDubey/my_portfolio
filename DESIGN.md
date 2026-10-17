# Deep Field — design system

Saubhagya's portfolio is a small corner of space you fly around, painted like *Arcane*. This file is the source of truth for the idea, the voice, colour, type, motion, interaction and the rules the WebGL scene follows. Change colours in `src/data/palette.js` first (and mirror `BASE` in `src/styles/tokens.css`), then the code. Content lives in `src/data/worlds.js`.

## 1. The idea

You are an astronaut. From the start screen you pick a side: **the undercity** is who I am apart from work, **topside** is the work. The two sides are painted after Arcane's two cities: the undercity has Zaun's chem green, smog teal, rust and a shimmer-pink second light; topside has Piltover's brass, cream and hextech blue. Inside a side you fly a small ship between things (a planet, twin suns, a quasar, a dead probe, a comet, a nebula, a station) and each one tells one piece of the story when you reach it. A gate on each side leads to the other, drawn in the style of the city it opens onto, because both halves are me.

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
/          Launch: a chapter card. Undercity sky on the left, topside on the right (stacked on phones),
           my name between brass rules, the portrait in a painted plate. Hover a side and its city
           bleeds across the seam; click and the stars pull in, then paint splashes.
/under     "me": delhi → the why → two books → the ones that didn't come back → the guessing game → the rules → gate
/top       "the work": unthinkable → elixia → super six → ok2 health → dtdc → tide → say hi → gate
/text      Everything as plain text, plus experience, skills, education.
/blue /red Old routes; redirect to /under and /top.
```

Order matters: the dashed route line, the numbers in the story panel ("3 / 6") and the "next" button all follow the array order in `worlds.js`.

## 4. Interaction rules

1. **Nothing requires clicking through.** Reaching a stop opens its story, whole, at once. Leaving closes it.
2. **Three ways to move, all equal:** hold and drag anywhere (mouse or finger), arrow/WASD keys, or click a flag to autopilot there. The "next" button in a story is autopilot to the next stop.
3. **Everything is labelled, with facts.** Each stop has a flag with its name and one plain, checkable line (`fact`: company · role · dates · place, or place · coordinates). The poetic `tag` lives in the story header. Off-screen stops clamp to the screen edge with an arrow and a short name, spread so they never overlap.
4. **The route is visible.** A dashed line joins the stops in order. The strip at the bottom shows the same order: gems on topside, vials on the undercity, lit or filled when visited, ringed when current.
5. **One light accent per city.** Undercity green `#8ff07a` or topside hextech blue `#5fd7ff` colours the flags, the route, the marker rings, the panel stroke and the strip. The city's material (rust or brass plates) carries the rest of its identity. The other city's colour appears only on its gate.
6. **Keyboard works end to end.** Flags and the strip are buttons; Enter flies there; Escape closes a story.
7. **Reduced motion:** no twinkle, no arrival dolly, frozen grain, FX animate continuously instead of on twos, no paint splash (a straight cut), no panel swipe. Flying still works because it is the content.
8. **No WebGL:** `/text` renders in place of everything.

## 5. Colour

All colour comes from `src/data/palette.js`. `BASE` is mirrored in `tokens.css`; city colours reach CSS as inline custom properties (`cityVars()`), and WebGL reads the module directly.

| Base | Hex | Use |
|---|---|---|
| `ink` | `#0a0b0f` | page background, the ink in outlines (tinted per city) |
| `paper` | `#efe3cf` | text, warm off-white |
| `dim` | `#c9bda6` | secondary text |
| `faint` | `#857a69` | decorative only |
| `line` | `#2b2520` | dividers |
| `brass` | `#d9a84e` | links, focus rings, rules, the launch card's neutral accent |

| City | Undercity (me) | Topside (work) |
|---|---|---|
| `accent` (the one light) | `#8ff07a` chem green | `#5fd7ff` hextech blue |
| `accent2` (glows, gates, rare) | `#ff5fa8` shimmer pink | `#e2b55a` brass light |
| `plate` (UI material) | rust `#2a1d18` → `#140f0d` | brass `#5e4220` → `#2a1c0e` |
| `sky` | `#081311` → `#1a352a` | `#120d09` → `#3a2a18` |
| `grade` shadow / mid / high | teal / green / pink | brown / brass / cyan |

Never pure black, never pure white. Ink is mixed toward the city's `inkTint`, not black.

## 6. Type

- **Orbitron** (700/900, caps, `.04em`) for display: my name, chapter titles, stop headlines, galaxy titles, the game logo and banners. Cyberpunk, wide; keep it to short lines. Never for long numbers: its slashed zero reads badly in a row.
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
- Gates: a faceted hextech gem going up to topside, a breathing chem vent going down to the undercity, framed by brass or rust rings.
- Metal (ship, probe, station, gate rings) uses `MeshToonMaterial` with one shared four-step ramp.
- Earth is the real map, posterised halfway and brushed, with Delhi's light kept.
- Background: a painted dark gradient per city with undercity smog bands or a topside haze band and brass specks, stars as turned, squashed paint dabs.
- Light direction per city is one vector (`world.sun`) shared by the directional light and every shader.

**Post stack** (`src/three/Effects.jsx`, effects in `src/three/post/`), in order:
1. **Paint**: generalised Kuwahara, four quadrants weighted by flatness, sample offsets turned by a noise flow field that is glued to the world as the camera pans. 5×5 on tier 2, 3×3 on tier 1.
2. **Ink**: Sobel on depth (silhouettes of solid things) and luminance (painted shapes, dark side only), threshold wandering with noise, broken like a dry brush, never pure black. Off on the launch card.
3. **Bloom** (halation, threshold 0.55) and **Grade**: ACES, per-city three-way split tone, soft S-curve, saturation, paper grain, undercity halftone in object shadows, vignette. On the launch card the two grades blend across the seam.
4. **Lens**: chromatic aberration toward the frame edge, film grain on twos.

Neighbour-sampling effects are flagged `CONVOLUTION` so `postprocessing` keeps them in their own passes and in this order. Runtime values are written onto uniforms in `useFrame`, never passed as props (that would rebuild the effect).

**Tiers** (`src/lib/tier.js`): tier 2 everything, dpr ≤ 1.5; tier 1 lighter brush and ink, dpr ≤ 1.25; tier 0 grade + bloom only, dpr 1. `?fx=0|1|2` overrides.

Performance rules: no per-frame React state (the render loop mutates `sim` and writes DOM transforms directly), shader noise ≤ 5 octaves, materials disposed on unmount. `sim.fps` holds a smoothed frame rate for tuning.

## 8. Motion

- Physical, damped, slow. Acceleration and drag for the ship; lerped camera with a little lead; springless.
- Nothing bounces, wobbles or squashes. Nothing auto-plays across the screen.
- Matter moves smoothly; painted FX step on twos. Ambient motion is always slow enough to ignore.
- Scene change: one paint splat of the destination city grows from where you clicked (220 ms), the scene changes underneath, then it fades (260 ms). Arrival eases the camera down from far above over ~2 s.
- Story panel opens with a 320 ms swipe, a ragged edge sweeping left to right.

## 9. Accessibility

- Every interactive thing is a real `<button>` or `<a>` with a label. Focus ring: 2px dotted brass.
- Story panel is `aria-live="polite"`. The strip count announces progress.
- Contrast: `--paper` on `--ink` about 15:1, `--dim` on `--ink` about 10:1, both city accents on `--ink` ≥ 10:1. `--faint` is decorative only.
- `/text` is the full site for screen readers and for anyone who prefers to read.

## 10. Files

```
src/data/palette.js       every colour (BASE + the two cities); tokens.css mirrors BASE
src/data/worlds.js        every stop, its copy, fact line, position, look, and the launch copy
src/data/portfolio.js     experience, skills, education (used by /text)
src/data/portrait.js      the sixteen face frames + the painted copies (PAINT_PORTRAITS)
src/workers/paint.worker.js  paints the portrait frames off the main thread
src/state/store.js        reactive UI state (zustand) + per-frame `sim` + flag element map
src/three/*               shaders and scene objects; Simulation.jsx is the flight model
src/three/post/*          Paint, Ink, Grade, Lens effects
src/lib/*                 router, warp (splash), tier (device quality), texture (torn masks, splat, paper)
src/scenes/*              Launch, Explore, TextVersion and their CSS
src/components/*          Helmet, Flags, StoryPanel, RouteBar, Hud
```

## 11. What Arcane means here

Five rules the restyle committed to before any code:

1. **Painted, not rendered.** Light in bands, strokes in the flat areas, a brush over the whole frame.
2. **One light per city.** Green below, hextech blue above. Brass and rust are materials, not lights.
3. **FX on twos.** Anything that is light rather than matter steps at 8 fps, like hand-drawn effects over 3D.
4. **Ink is never black.** Outlines and shadows lean toward the city's own dark.
5. **Labels are facts.** The poetry is in the story; the flags say who, what, when and where.
