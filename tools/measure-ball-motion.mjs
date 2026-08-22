// Regression check for ball motion. Watches the ball for a stretch of live match
// and reports every frame where it jumps.
//
//   node tools/measure-ball-motion.mjs [url] [watchMs]
//
// WHAT COUNTS AS A JUMP
//
// Not "the ball moved a lot" — during a shot it should. A jump is a frame whose
// speed is wildly out of line with the frames either side of it. Speed is
// normalised per millisecond so a long frame is not mistaken for a teleport, and
// moves made while the ball is faded out (placeBallAt covers restarts that way)
// are excluded, because a jump nobody can see is not a jump.
//
// Every jump is attributed to whichever ball-moving method ran just before it,
// which is the difference between fixing this and guessing at it.
//
// EXPECTED OUTPUT
//
//   jerkCount 0-2, biggestVisibleFrameMove under ~55px over 20 seconds.
//
// For reference, before the smoothing work: 14 jerks and an 861px single-frame
// move, because passes flew at where the receiver had been standing and then
// teleported onto his feet, and restarts repositioned the ball instantly.

import { loadPlaywright, launch } from './playwright.mjs';
import { startCampaign, goToMatch, waitForLivePlay } from './lib-match.mjs';

const URL = process.argv[2] || 'http://localhost:3000/';
const WATCH_MS = Number(process.argv[3] || 20000);

const pw = await loadPlaywright();
const browser = await launch(pw);
const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
const errs = [];
page.on('pageerror', e => errs.push(e.message));

await startCampaign(page, URL);
const reached = await goToMatch(page);
if (!reached) {
    console.log(JSON.stringify({ error: 'never reached the pitch', errs }, null, 2));
    await browser.close();
    process.exit(1);
}
await waitForLivePlay(page);

const report = await page.evaluate((watchMs) => new Promise((resolve) => {
    const s = window.game.scene.getScene('MatchDayScene');
    const samples = [];

    // Trace which code path last touched the ball
    const calls = [];
    for (const name of ['placeBallAt', 'moveBall', 'setPossession', 'gatherBall', 'kickoff',
        'restart', 'forceAttack', 'doPass', 'releaseShot', 'shootFromActor', 'turnover']) {
        const orig = s[name];
        if (typeof orig !== 'function') continue;
        s[name] = function (...args) {
            calls.push({ t: performance.now(), name });
            return orig.apply(this, args);
        };
    }

    const t0 = performance.now();
    const tick = () => {
        if (!s.ball || !s.ball.active) {
            return resolve({ aborted: 'ball gone', frames: samples.length });
        }
        samples.push({
            t: performance.now(),
            x: s.ball.sprite.x,
            y: s.ball.sprite.y,
            alpha: s.ball.sprite.alpha,
            phase: s.play ? s.play.phase : '?',
            fx: +s.ballState.fx.toFixed(4),
            fy: +s.ballState.fy.toFixed(4),
            air: +s.ballState.air.toFixed(1),
        });
        if (performance.now() - t0 < watchMs && s.matchStarted) return requestAnimationFrame(tick);

        const d = samples.slice(1).map((v, i) => ({
            i: i + 1,
            t: v.t,
            px: +Math.hypot(v.x - samples[i].x, v.y - samples[i].y).toFixed(2),
            dt: +(v.t - samples[i].t).toFixed(2),
            phase: v.phase,
            vis: +Math.min(v.alpha, samples[i].alpha).toFixed(2),
        }));
        const speed = d.map(v => (v.dt > 0 ? v.px / v.dt : 0));

        const jerks = [];
        let hidden = 0;
        for (let i = 3; i < speed.length - 3; i++) {
            const around = [speed[i - 3], speed[i - 2], speed[i - 1],
                speed[i + 1], speed[i + 2], speed[i + 3]].sort((a, b) => a - b);
            const median = (around[2] + around[3]) / 2;
            const ratio = median > 0.005 ? speed[i] / median : (speed[i] > 0.5 ? 999 : 0);
            if (ratio <= 4 || d[i].px <= 12) continue;
            if (d[i].vis < 0.35) { hidden++; continue; }
            jerks.push({
                phase: d[i].phase,
                px: d[i].px,
                dt: d[i].dt,
                xNeighbours: +ratio.toFixed(1),
                from: [samples[i].fx, samples[i].fy, 'air' + samples[i].air],
                to: [samples[i + 1].fx, samples[i + 1].fy, 'air' + samples[i + 1].air],
                lastCalls: calls.filter(c => c.t <= d[i].t && d[i].t - c.t < 120)
                    .slice(-3).map(c => c.name),
            });
        }

        const visible = d.filter(v => v.vis >= 0.35).map(v => v.px);
        resolve({
            seconds: +((performance.now() - t0) / 1000).toFixed(1),
            frames: samples.length,
            fps: +(1000 / (d.reduce((a, b) => a + b.dt, 0) / d.length)).toFixed(0),
            biggestVisibleFrameMove: +Math.max(...visible).toFixed(1),
            jumpsHiddenByFade: hidden,
            jerkCount: jerks.length,
            jerks: jerks.sort((a, b) => b.px - a.px).slice(0, 8),
        });
    };
    requestAnimationFrame(tick);
}), WATCH_MS);

console.log(JSON.stringify({ url: URL, pageErrors: errs, report }, null, 2));
await browser.close();
