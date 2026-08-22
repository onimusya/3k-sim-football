// Shared driving code for the match-day tools: boot the game, start a campaign,
// and get onto the pitch.

/** Click a point given in Phaser's design-space coordinates. */
export async function clickWorld(page, wx, wy) {
    const pt = await page.evaluate(([x, y]) => {
        const cv = document.querySelector('canvas');
        const r = cv.getBoundingClientRect();
        const g = window.game;
        return [r.left + x * (r.width / g.scale.width), r.top + y * (r.height / g.scale.height)];
    }, [wx, wy]);
    await page.mouse.click(pt[0], pt[1]);
}

const onPitch = (page) => page.evaluate(() => window.game.scene.isActive('MatchDayScene'));

/**
 * A random event can put a dialog between team management and kickoff. Clicks the
 * dismissing button for either overlay shape.
 */
export async function clearEventDialog(page) {
    if (await onPitch(page)) return true;
    const d = await page.evaluate(() => ({ w: window.game.scale.width, h: window.game.scale.height }));
    // [panel w, panel h, button x, button y] for showDecisionEvent and showEventOverlay
    for (const [w, h, bx, by] of [[500, 300, 355, 227], [460, 260, 230, 227]]) {
        const px = Math.round((d.w - w) / 2), py = Math.round((d.h - h) / 2);
        await clickWorld(page, px + bx, py + by);
        await page.waitForTimeout(1100);
        if (await onPitch(page)) return true;
    }
    return onPitch(page);
}

export async function startCampaign(page, url, kingdom = 'shu') {
    await page.goto(url, { waitUntil: 'networkidle' });
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await page.waitForFunction(() => window.game && window.game.scene.isActive('MainMenuScene'),
        null, { timeout: 40000 });
    await page.waitForTimeout(3000);
    await page.evaluate((id) => {
        const m = window.game.scene.getScene('MainMenuScene');
        m.selectKingdom(m.kingdomCards.find(k => k.kingdom.id === id).kingdom);
    }, kingdom);
}

export async function goToMatch(page) {
    await page.waitForFunction(() => window.game.scene.isActive('TeamManagementScene'),
        null, { timeout: 60000 });
    await page.waitForTimeout(2000);
    await page.evaluate(() => window.game.scene.getScene('TeamManagementScene').handleNavAction('match'));
    await page.waitForTimeout(1500);
    return clearEventDialog(page);
}

export const waitForLivePlay = (page) => page.waitForFunction(() => {
    const s = window.game.scene.getScene('MatchDayScene');
    return !!(s && s.matchStarted && s.play && s.play.carrier
        && s.play.carrier.chibi && s.play.carrier.chibi.container.active);
}, null, { timeout: 60000 });

export const waitForResult = (page) => page.waitForFunction(
    () => window.game.scene.isActive('MatchResultScene'),
    null, { timeout: 240000, polling: 1000 }).then(() => true).catch(() => false);
