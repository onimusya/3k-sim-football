// End-to-end smoke test. Plays two full matches, including the scene-restart path
// where stale GameObject references are the recurring failure, screenshots the
// interesting moments, and checks nothing was left in a broken pose.
//
//   node tools/verify-match.mjs [url]
//
// Screenshots land in .shots/v_*.png.

import { loadPlaywright, launch } from './playwright.mjs';
import { startCampaign, goToMatch, waitForLivePlay, waitForResult } from './lib-match.mjs';

const URL = process.argv[2] || 'http://localhost:3000/';
const OUT = '.shots';
const log = [];

const pw = await loadPlaywright();
const browser = await launch(pw);
const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
const errs = [];
page.on('pageerror', e => errs.push(e.message));

await startCampaign(page, URL);
await page.screenshot({ path: `${OUT}/v_menu.png` });
log.push(`match 1 reached: ${await goToMatch(page)}`);
await waitForLivePlay(page);

// A deliberate long pass, sampled across the flight
await page.evaluate(() => {
    const s = window.game.scene.getScene('MatchDayScene');
    const c = s.play.carrier;
    const mates = s.teamActors(c.team, false).filter(a => a !== c);
    mates.sort((a, b) => Math.abs(b.fx - c.fx) - Math.abs(a.fx - c.fx));
    s.doPass(mates[0], { duration: 900, air: 42, intercept: 0 });
});
await page.waitForTimeout(70);
await page.screenshot({ path: `${OUT}/v_strike.png` });
await page.waitForTimeout(330);
await page.screenshot({ path: `${OUT}/v_flight.png` });
await page.waitForTimeout(600);
await page.screenshot({ path: `${OUT}/v_arrival.png` });

// A scripted shot, which exercises the feed-then-strike path
await page.waitForTimeout(1200);
await page.evaluate(() => {
    const s = window.game.scene.getScene('MatchDayScene');
    const team = s.play.possession || 'home';
    s.shootFromActor(s.teamActors(team, false)[0], 'save', () => {});
});
await page.waitForTimeout(260);
await page.screenshot({ path: `${OUT}/v_feed.png` });
await page.waitForTimeout(500);
await page.screenshot({ path: `${OUT}/v_shot.png` });

await page.waitForTimeout(4000);
log.push('stranded sprites: ' + await page.evaluate(() => {
    // Chibi.kick() leans the sprite and hop() lifts it; both must return to rest,
    // or a player is left tilted or hanging above their own feet
    const s = window.game.scene.getScene('MatchDayScene');
    const bad = s.actors.filter(a => a.chibi && a.chibi.sprite.active && !a.chibi.kicking
        && (Math.abs(a.chibi.sprite.y) > 0.5 || Math.abs(a.chibi.sprite.angle) > 0.5));
    return bad.length
        ? bad.map(a => `${a.player.name} y=${a.chibi.sprite.y.toFixed(1)} angle=${a.chibi.sprite.angle.toFixed(1)}`).join('; ')
        : 'none';
}));
log.push('ball alpha back to full: ' + await page.evaluate(() =>
    window.game.scene.getScene('MatchDayScene').ball.sprite.alpha));

log.push(`match 1 finished: ${await waitForResult(page)}`);
await page.waitForTimeout(2500);

await page.evaluate(() => window.game.scene.getScene('MatchResultScene').scene.start('TeamManagementScene'));
log.push(`match 2 reached: ${await goToMatch(page)}`);
await page.waitForTimeout(6000);
await page.screenshot({ path: `${OUT}/v_match2.png` });
log.push(`match 2 finished: ${await waitForResult(page)}`);

log.push('page errors: ' + (errs.length ? errs.join(' | ') : 'none'));
console.log(log.join('\n'));
await browser.close();
process.exit(errs.length ? 1 : 0);
