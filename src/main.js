import { BootScene } from './scenes/BootScene.js';
import { MainMenuScene } from './scenes/MainMenuScene.js';
import { TeamManagementScene } from './scenes/TeamManagementScene.js';
import { MatchDayScene } from './scenes/MatchDayScene.js';
import { LeagueScene } from './scenes/LeagueScene.js';
import { MatchResultScene } from './scenes/MatchResultScene.js';

// The design resolution. Scale.FIT letterboxes this into whatever the window
// is, preserving aspect, and autoCenter keeps it centred on both axes.
const BASE_WIDTH = 960;
const BASE_HEIGHT = 640;

const config = {
    type: Phaser.AUTO,
    backgroundColor: '#7ec8e8',
    scene: [BootScene, MainMenuScene, TeamManagementScene, MatchDayScene, MatchResultScene, LeagueScene],
    // Sprites land on whole pixels, which stops the generated pixel art
    // shimmering while it is tweened around.
    roundPixels: true,
    physics: {
        default: 'arcade',
        arcade: {
            gravity: { y: 0 },
            debug: false
        }
    },
    scale: {
        parent: 'game-container',
        mode: Phaser.Scale.FIT,
        autoCenter: Phaser.Scale.CENTER_BOTH,
        width: BASE_WIDTH,
        height: BASE_HEIGHT,
    }
};

const game = new Phaser.Game(config);

/*
 * Keep the canvas fitted and centred whenever its container changes size.
 *
 * Phaser 3.60 can register the new parent bounds without re-applying the FIT
 * scale on the same tick, which leaves the canvas at its old size in a resized
 * window. Watching the parent with a ResizeObserver and calling refresh() covers
 * every case the window `resize` event misses — being embedded in an iframe that
 * resizes, devtools opening, CSS layout settling after first paint.
 */
const parentEl = document.getElementById('game-container');

/**
 * getParentBounds() must run before refresh(): refresh() recomputes the FIT
 * scale from ScaleManager's *cached* parent size, so calling it alone leaves the
 * canvas one resize behind. The double rAF makes sure we measure after the
 * browser has finished laying the new size out.
 */
const refit = () => {
    game.scale.getParentBounds();
    game.scale.refresh();
};
const scheduleRefit = () => requestAnimationFrame(() => requestAnimationFrame(refit));

if (typeof ResizeObserver !== 'undefined' && parentEl) {
    new ResizeObserver(scheduleRefit).observe(parentEl);
}
window.addEventListener('resize', scheduleRefit);
window.addEventListener('orientationchange', scheduleRefit);
// One more pass after first paint, once percentage heights have resolved.
scheduleRefit();

// Exposed for debugging and automated visual checks.
window.game = game;
