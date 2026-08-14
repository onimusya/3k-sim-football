# 三國蹴鞠 — Three Kingdoms Soccer

A Romance of the Three Kingdoms football management simulation built with Phaser 3.60. No build step, no image assets — every sprite, glyph and panel is drawn in code at runtime.

![Match day](/.shots/j1_match.png)

## Play

```bash
npx serve . -l 3000
```

Open [http://localhost:3000](http://localhost:3000). That's it — no `npm install`, no bundler.

## What it is

You pick one of six kingdoms (Wei, Shu, Wu, Dong Zhuo's coalition, Yuan Shao's alliance, or Lü Bu's mercenaries), manage a squad of 11 historical warriors, train them, recruit from rival factions, choose formations and tactics, then watch your team battle through a 10-week season on an isometric pitch.

### Game systems

| System | Detail |
|--------|--------|
| **Match engine** | Formation-weighted zone strength. 60+ traits fire during simulation — counter-attack, fear factor, second-half surge, long shot, superstar, and more. |
| **Economy** | Weekly income based on league position, player wages, facility upgrades (training ground, medical tent, scout network). Go broke and your worst player's morale craters. |
| **Season** | 10-week round-robin. Top 2 qualify for the Three Kingdoms Cup. End-of-season trophies, gold rewards, stat decay (aging). |
| **Events** | 10 between-match events: injuries, rival poaching, sponsor offers, training breakthroughs, morale crises, challenge matches. Several require a decision with real consequences. |
| **Audio** | Procedural via the Web Audio API — goal fanfare, crowd roar, whistles, war drums, UI clicks. No audio files. |

### Art layer

Everything visual is generated at runtime from `src/art/`:

- **Palette** — bright saturated colour system with per-kingdom kits
- **PixelFont** — 5×7 bitmap glyphs rendered with a hard outline and rim highlight; used for every numeral
- **Chibi** — procedural pixel characters with four hair crowns, seven distinguishing features (tapering beards, plumed helmets, coronets, heavy builds), and per-warrior authored looks so Guan Yu, Lü Bu, Zhang Fei and Cao Cao read individually at 34px
- **UI** — white dialog panels with blue gradient title bars, cream list rows, coloured stat bars with dark value wells, HUD chips, position badges, chunky 3D buttons
- **IsoWorld** — sheared-projection pitch (not 45° iso, so both goals stay on a 960×640 canvas) with mown grass, full markings, wrap-around terraces, ~330 individual spectators, town skyline, floodlights, and advertising hoarding
- **Backdrop** — shared inhabited stadium behind the menu-style scenes, with chibi figures strolling through the gaps

### Scenes

1. **MainMenuScene** — sunny stadium backdrop, kingdom selection cards with chibi portraits, background kickabout
2. **TeamManagementScene** — squad roster, player detail with animated stat bars, formation editor on a mini iso pitch, Train / Recruit / Tactics / Rest overlays
3. **MatchDayScene** — pre-match intro, 22 animated chibi actors on the iso pitch, typewriter commentary, speed controls, goal celebrations with confetti and crowd cheer
4. **MatchResultScene** — result banner, mirrored stat bars, scorers + secondary events, economy summary with animated gold counter, season progress bar
5. **LeagueScene** — standings with form pips, fixtures, league leaders (top scorers / assists / cards)

## Display scaling

The canvas scales to fit any viewport from 480×800 to 2560×1440, centred on both axes, with correct aspect (3:2) and no scrollbars. A `ResizeObserver` + double-rAF `getParentBounds()` → `refresh()` covers every resize case Phaser's built-in listener misses.

## Project structure

```
index.html          Entry point (no build step)
progress.html       Build history + blind A/B comparison page
artlab.html         Character silhouette showcase
package.json        Metadata only (no dependencies)

src/
  main.js           Phaser config + scale management
  art/
    Palette.js      Colours, kit definitions, stat helpers
    PixelFont.js    Bitmap glyph renderer + PixelText class
    Chibi.js        Procedural character sprites
    UI.js           Panel/button/statBar/chip/badge widgets
    IsoWorld.js     Isometric pitch + stands + crowd + town
    Backdrop.js     Shared stadium behind menu scenes
  data/
    teams.js        Six kingdoms × 11 warriors each
  engine/
    MatchEngine.js  Formation-aware, trait-activated simulation
    GameState.js    Season progression, economy, random events
    AudioManager.js Procedural sounds via Web Audio API
  scenes/
    BootScene.js
    MainMenuScene.js
    TeamManagementScene.js
    MatchDayScene.js
    MatchResultScene.js
    LeagueScene.js

.shots/             Progress screenshots (committed for the build log)
.reference/         Pocket League Story screenshots (gitignored, not ours)
```

## Benchmarking

The game was iteratively compared against [Pocket League Story](https://store.steampowered.com/app/1923690/Pocket_League_Story/) (Kairosoft) via blind A/B critic passes. `progress.html` documents the scores, the gaps identified at each round, and what was changed. The reference screenshots are intentionally not committed (third-party © Kairosoft); that section degrades gracefully when they're absent.

## License

MIT
