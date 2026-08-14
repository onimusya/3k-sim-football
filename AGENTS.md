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

## Known issues and next steps

Per the last critic pass (scores: reference 62, ours 49):

1. **Match screen shows a formation, not a moment.** Needs: impact starbursts on tackles, varied chibi poses (kick/dive), a mini-map or possession indicator, and the ball carrier should be more prominent than a grey tooltip.
2. **Environment richness.** The terraces and town skyline are there, but there are no kiosks, no parked cars, no animated flag poles — the kind of detail that makes Kairosoft's world feel inhabited at rest.
3. **Personality.** The Three Kingdoms theme mostly lives in names and traits. The menu and management screens would benefit from faction-specific visual flair (banners, colour-tinted panel accents, mascot characters).

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
