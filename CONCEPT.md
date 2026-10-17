# Deep Field — concept, iteration 1

Working title for the new portfolio. Saubhagya as an astronaut travelling into deep space. The visitor picks a galaxy: **blue** to meet the person, **red** to read the mission log. Both halves get the same craft, because the work is also a big part of who he is.

This replaces the zine/sticker direction in DESIGN.md. Keep from the live FlutterBolt site what earns compliments: a story, a persona, a guided intro, information density. Lose what dates it: emoji headers, progress bars, Tailwind defaults, generic hero copy.

## Why this metaphor fits him

| Him | In the story |
|---|---|
| Builds irrespective of outcome | Probes launched knowing some never return (Voyager) |
| "Not all worked. Every one taught the next" | Lost Probes system: dead projects with what each taught |
| First principles, wants to know *why* | Observatory: instruments, a number pattern you can poke |
| Ashtavakra Gita (the self is the witness, not the doer) + Nietzsche (amor fati, becoming) | The Witness: two voices in the cockpit |
| GeoGuessr | Coordinates: guess where he is from a photo |
| Craft against a web that all looks the same | Craft: the rules this site committed to, shown as a checklist he actually followed |
| Built teams from zero three times | Crew |
| Ships apps used by a million people | Payloads, with real telemetry |

## Structure

**0. Launch (home).** Star field, helmet with his face in the visor (reusing the 16 expressions: he looks toward whichever galaxy you hover), name, a two-line first-person tagline, mission-log HUD in mono. Two galaxies drift left and right. Hover: stars streak toward it, the visor tints, the HUD heading changes. Click: warp.

**Blue galaxy — who's flying**
1. Origin: New Delhi, launch pad.
2. The Witness: Ashtavakra + Nietzsche, two short quotes he stands by, and his own line between them.
3. Observatory: first principles; one number pattern with a knob.
4. Lost Probes: side projects alive or dead, each with "what it taught".
5. Coordinates: a 3-round GeoGuessr with his photos, a pin-drop map, score.
6. Craft: the design rules of this site, and a "why most of the web looks the same" note.

**Red galaxy — mission log**
1. Ship's Log: six missions (Tide, DTDC, Ok2 Health, Super Six, Elixia, Unthinkable) as a route with a mission patch each. Achievements from `src/data/portfolio.js`.
2. Payloads: Fantasy Akhada 1M+, VUSport 800K+, 100K concurrent streams, ₹5–10 Cr/day payments, DTDC 5,000 partners, Retire 100 load time 60s → 12s.
3. Instruments: skills as cockpit gauges; tap a gauge for evidence (which mission proved it).
4. Crew: 20+ trained, 5-person teams led, two now at Tide with him.
5. Telemetry: how he works (spec before code, contract models, clear decisions).
6. Hail: contact.

**Wormhole.** Every system has a crossing to its counterpart in the other galaxy (Lost Probes ↔ Payloads, Craft ↔ Instruments, Origin ↔ Ship's Log), so the two halves feel like one person.

## Micro-interactions (one per system, each must teach something)

- Cursor is a faint thruster; stars parallax on pointer.
- Scroll inside a galaxy = travel; a light-year counter in the HUD ticks up.
- Planet hover: orbit ring appears, moon labels fan out.
- Mission patch hover: patch flips to show dates and location, like a real embroidered patch.
- Gauges: needle settles with damping; tap shows the mission that earned the number.
- The visor face reacts throughout, not only on home.
- Sound: off by default, one toggle, subtle. Never autoplay.
- Reduced motion: everything readable with animation off. No blocking intros. Skip always visible.

## Visual language

- Palette: void `#05060C`, deep `#0B0E1C`, starlight `#ECE7D9`, gold telemetry `#E2B25A`, blue `#4DA3FF`, red `#FF5A4D`. No pure black, no pure white.
- Type: Bricolage Grotesque (display, condensed for headlines), IBM Plex Mono (HUD, telemetry, labels). Body in the display face at 400.
- Space rendered procedurally: canvas or WebGL shaders for galaxies and planets. He writes fragment shaders, so the site should visibly contain them. This is the single biggest personality signal for engineers who visit.
- Motion is physical: damping, inertia, slow drift. No bounce, no wobble, no cartoon squash.
- Tone: first person, direct, plain words. Persona is Saubhagya himself in a suit, not a superhero alias.

## Tagline candidates (two lines, first person)

1. Six years of shipping apps into the dark. A million people caught them.
2. I build whether or not it comes back. That's how you find out why.
3. Flutter lead. Team builder. I'd rather be wrong early than late.

## Tech

Stay in this Vite + React repo. Add `three` + `@react-three/fiber` for galaxies and planets (shaders in GLSL), keep `motion` for DOM transitions. Route per galaxy so both are shareable URLs. Static build on Vercel.

## Assets to gather

From Saubhagya:
- Astronaut illustration of him in the same style as the headshots (full body in suit, helmet off or visor open), plus one seated-in-cockpit pose.
- 3–5 photos of places for Coordinates, with the real location.
- Two quotes (one Ashtavakra, one Nietzsche) he actually stands by, and one line of his own.
- The number pattern for Observatory.
- Side projects list, including dead ones, with one sentence on what each taught.
- OK to show real numbers per mission publicly? (revenue, downloads)

I can produce:
- Mission patches as SVG (one per employer).
- Planets, galaxies, star fields, wormhole: procedural shaders.
- Sound design: skip for now.

## Open questions

1. Persona name: keep "FlutterBolt" anywhere, or retire it? Recommendation: retire it. The astronaut is you.
2. Should Launch require a choice, or scroll straight into blue by default with red one click away? Recommendation: require the choice on first visit, remember it.
3. GeoGuessr: real map tiles need a map provider. Alternative: a stylised globe you drop a pin on. Which?

---

# Iteration 2 (same day)

Feedback on iteration 1: opening animation good. Cards, pills, language, typography all rejected as childish, pretentious, templated.

Changes:
- **Inside a galaxy is now a game, not a page.** You fly a small ship (hold pointer, or arrow keys) through a hand-drawn star map. Objects have a faint dotted ring and a "come closer" prompt. Fly into one and a visual-novel dialogue opens: my face, my name tag, typed text, click to continue. A compass arrow at the screen edge points to the nearest thing you haven't found. Counter: "found 3 / 6".
- **Anime space, not generic space.** Cel-shaded planets with a hard terminator and screentone on the dark side, four-point sparkles, speed-line comet tail, quasar jets, a wormhole gate drawn with dashed rotating ellipses, a tiny ship with a pink thruster.
- **Voice.** Everything lowercase, short, first person, as if telling a friend. The two books are described, never named or credited. Numbers appear only where they're part of the story.
- **Type.** Shippori Mincho B1 for everything you read, DotGothic16 for game labels. No grotesk anywhere.
- **Blue objects:** delhi (planet), two books (twin star), why (quasar), guessing game (comet), one that didn't come back (derelict probe), the rules (nebula), gate to red.
- **Red objects:** six mission planets on a route from 2020 to now, a station for contact, gate to blue.

Still missing: a real astronaut drawing of Saubhagya, real side projects for the probe, the number pattern, place photos.

---

# Iteration 3 — built for real (same day)

Feedback on iteration 2: concept is good. Missing: connection between the parts, labels so people can choose where to go, less interaction to read a callout, and the visuals must look real (shaders, not drawings).

What shipped in the repo:

- **WebGL scene** with custom GLSL: procedural rocky / gas / ice planets with atmospheres and rings, real Earth for delhi with a light on the city, twin suns with coronas, a quasar with an accretion disk and jets, a comet with particle tails, a six-layer nebula, a ring station, and a swirl gate to the other galaxy. Bloom and a vignette on top. Background is mostly black with a wrapped star field and foreground dust for parallax.
- **Flags on everything.** Name plus one line, always visible, clamped to the screen edge with an arrow when off-screen and spread so they never stack. Click a flag to autopilot there.
- **Stories open on arrival**, whole, no click-through. "next →" flies to the next stop. Leaving closes it.
- **The connection:** a dashed route line through the stops in story order, "3 / 6" in each panel, the strip at the bottom with the same order, and copy that refers back and forward ("the same itch as the quasar back there", "the red side is through the gate").
- **Launch** kept as liked, now with spiral galaxies in WebGL and star streaks toward the hovered one.
- `/text` carries the whole thing as plain text plus the experience, skills and education for anyone hiring.

Still missing, for Saubhagya to supply:
- a drawn astronaut version of the portrait for the story panel
- real side projects for "the ones that didn't come back"
- the number pattern for the observatory idea (currently folded into "the why")
- photos for a proper geoguessr round

---

# Iteration 4 — Arcane (2026-10-17)

Feedback on iteration 3: the blueprint is right; the look should feel like *Arcane*.

Decisions taken with Saubhagya:

| Question | Decision |
|---|---|
| Scope | Full restyle: painterly post stack, painted object shaders, every UI surface, title-card launch, paint-splash transitions. Stops, copy, flight model, flags and route stay. |
| Cities | me = the undercity (Zaun: chem green, rust, shimmer pink) at `/under`; work = topside (Piltover: brass, cream, hextech blue) at `/top`. Old routes redirect. |
| Type | Rozha One for display, Fraunces for reading, IBM Plex Mono for every label. |
| Labels | "Grounded to reality": every flag carries a plain fact (company · role · dates · place). The poetic tag moved to the story header. |
| Portraits | The 16 frames stay as placeholders, painted at load by a worker. Redraws can drop in with the same names. |

What shipped:

- **Post stack**: Kuwahara brush with a world-glued flow field, brushed ink from depth and luminance, ACES + per-city split tone + paper + undercity halftone, edge chromatic aberration and grain on twos. Device tiers decide how much runs.
- **Shaders**: three-band brushed light, hand-painted four-colour gradients, city-coloured rim light, FX on twos, painted nebula masses, faceted gem and chem-vent gates, toon metal, paint-dab stars, smog and brass-haze skies.
- **UI**: torn-edge painted plates (brass with art-deco corners topside, rust with rivets below), engraved two-line flags, gem and vial route strips, pressed-metal buttons, a chapter-card launch with the two skies split by a torn seam that slides toward the hovered side.
- **Transition**: a splat of the destination city's colour grows from the click, the scene changes under it, it fades.

Still wanted from Saubhagya:
- 16 Arcane-style portrait redraws (1024² with alpha, chest-up, no die-cut border, same expression names).
- Optional: a full-body figure for wide launch screens, a 1200×630 two-cities key art for `og:image`.
- Confirmation of the `probe` and `geo` fact lines (which side projects; how often GeoGuessr).
