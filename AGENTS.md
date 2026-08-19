# AGENTS.md — How this project was built

This document describes the agent architecture and workflow that produced the game. It is intended for anyone studying how to use AI coding agents effectively, or for agents resuming work on this codebase.

## Architecture

The project was built by a lead agent (Kiro) orchestrating specialist sub-agents in parallel. The lead handled:

- Project scaffolding and file structure decisions
- Art direction (after comparing against the real reference)
- Integration, bug triage, and verification
- The critic loop: dispatching evaluators then routing their findings back to builders

Sub-agents were dispatched for:

| Role | What it did |
|------|-------------|
| **Builder** | Rewrote a single scene or module to a detailed spec, with the art API cheatsheet inlined so it could work without reading every dependency |
| **Critic** | Read the actual screenshots (ours + reference), scored dimensions 1–10, identified the single biggest gap, and returned prioritised concrete fixes |
| **Fixer** | Took the critic's specific bug list and made surgical changes, verifying each in a browser before reporting |

## Workflow

```
1. Build foundation (scenes, engine, data)
2. Dispatch critic with real screenshots
3. Critic returns: "decisions don't matter"
   → Rebuild match engine, add economy + events
4. Check reference screenshots for the first time
   → Discover art direction is inverted (dark vs bright)
5. Build new art layer (Palette, PixelFont, Chibi, UI, IsoWorld)
6. Convert all scenes onto it (parallel builders)
7. Dispatch critic again
   → "Characters are one sprite recoloured; crowd is blobs"
8. Add silhouette features, rebuild crowd
9. Fix layout bugs the critic identified
10. Verify end-to-end, commit
```

Key principle: **the critic must inspect real output, not descriptions**. Every critic pass read the actual PNG screenshots side-by-side with the reference, and scored them blind.

## Art API contract

Every scene imports from `src/art/` and must follow these rules:

- **Numbers** are always `PixelText`, never `scene.add.text` for digits
- **Panels** use `UI.panel()` which exposes `.bodyRect` (NOT `.body` — that slot is reserved by Phaser for physics bodies and causes crashes on destroy)
- **Characters** use `Chibi` class, anchored at the feet, with `lookForPlayer(player, kit)` for deterministic appearance
- **Pitch** uses `IsoPitch` with the sheared projection (not 45° iso)
- **Backdrop scenes** (TeamManagement, League, MatchResult) use `stadiumBackdrop()` from `Backdrop.js` and must call `.tick(delta)` in their `update()` loop
- **Depth bands** are documented at the top of each scene file

## Match simulation layer

`MatchDayScene` runs a per-frame possession model on top of the `MatchEngine`
result. The engine stays authoritative for the scoreline; the visual layer only
decides how the ball gets between the scripted events.

- `this.play` holds possession, carrier, phase (`kickoff` / `build` / `pass` /
  `attack` / `shot` / `setpiece` / `celebrate`), and the `inFlight` flag
- `assignJobs()` labels every actor each frame: `carry`, `support`, `press`,
  `keeper`, `hold`
- `shapeTarget()` slides the whole formation with the ball, scaled per player by
  `a.adv` (0 = deepest defender, 1 = furthest forward) so the shape stretches
- `choosePass()` / `doPass()` handle passing, interceptions and recycling
- Scripted events route through `shootFromActor()`, `forceAttack()`, `restart()`
  and `kickoff()` so goals, saves, wides and fouls resolve inside the same model

Two traps to remember when touching this:

1. **Never let the loose-ball pickup run while `play.inFlight` is true.** A player
   standing near the passer will re-collect the ball instantly and it will never
   travel. This cost a debugging cycle — symptom was the ball staying inside
   0.345–0.538 with only two players ever touching it.
2. **Anything anchored to a player must be re-pinned every frame.** Players now
   cover ground, so one-shot positioning leaves floating name tags stranded on
   empty grass. See `updateNameTags()`.

Useful sanity numbers for a healthy match (measured over ~10s of play):
ball fx range roughly 0.05–1.0, 8+ distinct carriers, 10+ possession changes,
average outfielder covering ~0.33 of the pitch length, and at most a couple of
momentary sprite overlaps.

## Persistence

`src/engine/SaveGame.js` owns the save. One slot in `localStorage` under
`threeKingdomsSoccer.save.v1`, roughly 2 KB of JSON.

The hook is deliberately indirect. `SaveGame.attachAutosave(game)` (called once in
`main.js`) listens for the registry's `changedata-gameState` event and writes on a
400 ms debounce, with a `pagehide` listener to flush a close that lands inside the
debounce window. **Do not add manual `SaveGame.save()` calls at mutation sites.**
Every scene already ends its state changes with `this.registry.set('gameState', …)`,
so the event covers all present and future write sites; hand-placed calls would
drift out of date the moment someone adds a new one.

`PERSISTED` is a whitelist of field names. Anything not on that list is treated as
derived or per-scene scratch and is not written. If you add a campaign-level field
to `gameState`, add it to `PERSISTED` or it will silently fail to survive a
refresh. `applyTo()` merges the save *over* the registry defaults rather than
replacing the object, so fields added in later builds keep their defaults instead
of coming back `undefined`.

Failure modes are all non-fatal by design: `localStorage` throwing outright
(private browsing), `QuotaExceededError` on write, unparseable JSON, a
`__version` mismatch, or a save whose `players` array is missing or malformed.
Each of those logs a warning and either discards the save or skips the write. The
version check discards rather than migrates — there are no old saves in the wild
yet, so a migration path would be speculative code.

`BootScene` sets `hasSavedGame` in the registry; `MainMenuScene.showResumePanel`
turns a valid save into the *Welcome Back* card and sets `this.locked = true` so a
stray kingdom-card click cannot start a new campaign underneath the overlay.

Two things that are easy to break:

1. **`selectKingdom` must reset every campaign field explicitly.** Resuming a save
   loads a squad, gold and season into the registry; if the player then backs out
   to the menu and starts a new game, anything not reset is inherited by the new
   campaign. This is why that method reads as a long list of assignments.
2. **`confirmNewGame` and `dismissResume` tween the same layer.** `dismissResume`
   calls `killTweensOf` first, otherwise the fade-back-in from *Keep Save* fights
   the fade-out and leaves the panel stuck half visible.

Testing this in a browser needs `page.bringToFront()` before anything else. A
backgrounded headless page throttles `requestAnimationFrame` to ~1 fps, which
stalls Phaser's clock — `delayedCall` and `scene.start` appear to hang, and every
`waitForFunction` on scene state times out for reasons that have nothing to do
with the code under test. This cost two debugging cycles.

## Known issues and next steps

1. **Match moments still lack impact.** Possession, runs, passing and pressing now
   read correctly, but there are no impact starbursts on tackles, no dedicated
   kick or dive poses, and no mini-map. The chibi has only walk frames.
2. **Environment richness.** The terraces and town skyline are there, but there
   are no kiosks, parked cars or animated flag poles — the detail that makes
   Kairosoft's world feel inhabited at rest.
3. **Personality.** The Three Kingdoms theme mostly lives in names, traits and
   warrior silhouettes. The menu and management screens would benefit from
   faction-specific flair (banners, tinted panel accents, mascots).

## Deployment

Static deploy to Vercel: `vercel --prod` from the project root, config in
`vercel.json` (no build step, `outputDirectory: "."`).

**`/src/**` must send a revalidating `Cache-Control`.** The filenames are
unversioned — there is no content hashing — so an `immutable` long-max-age header
pins returning visitors to whichever copy of the source their browser cached.
This actually happened: a deploy shipped correct code while the live site kept
executing the previous build. Only `/.shots/**` is safe to cache hard.

## Resuming work

1. Run `npx serve . -l 3000` from the project root
2. Open `http://localhost:3000` — the game loads instantly (CDN Phaser, ES modules, no build)
3. Open the browser console and use `window.game` to drive scenes programmatically
4. `artlab.html` renders the character silhouette showcase for visual QA
5. `progress.html` has the live game embedded plus the evaluation history

When making changes:
- Read the scene you're changing first — they are 800–1400 lines each
- The art API cheatsheet at the top of this file (in each builder prompt) is the contract; if you change `UI.panel`'s return shape, update every scene
- Run two full match cycles after any change to confirm the scene-restart path doesn't crash (stale GameObject references are the #1 recurring bug)
- Take a screenshot and compare to `.shots/` before declaring a visual change done
