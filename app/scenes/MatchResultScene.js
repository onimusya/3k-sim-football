// MatchResultScene — bright Kairosoft-style post-match report.
// Sunny sky + grass backdrop, a punchy result banner, white dialog panels for
// stats / scorers / economy, a season progress bar and confetti on a win.

import { GameStateManager } from '../engine/GameState.js';

import { C, kitFor } from '../art/Palette.js';
import { PixelText } from '../art/PixelFont.js';
import * as UI from '../art/UI.js';
import { stadiumBackdrop } from '../art/Backdrop.js';

// ── depth bands ────────────────────────────────────────────────────────────
const D_BG = 0;
const D_PANEL = 10;
const D_BTN = 30;
const D_BANNER = 60;
const D_CONFETTI = 120;
const D_OVERLAY = 400;

// Layout for the 960x640 canvas
const L = {
    bannerY: 50,
    scoreY: 120,
    stats: { x: 16, y: 154, w: 452, h: 246 },
    scorers: { x: 492, y: 154, w: 452, h: 246 },
    economy: { x: 16, y: 406, w: 452, h: 156 },
    season: { x: 492, y: 406, w: 452, h: 156 },
    btnY: 572,
    btnW: 220,
    btnH: 42,
};

export class MatchResultScene extends Phaser.Scene {
    constructor() {
        super({ key: 'MatchResultScene' });
    }

    init(data) {
        this.result = data.result;
        this.homeKingdom = data.homeKingdom;
        this.awayKingdom = data.awayKingdom;
    }

    create() {
        const { width, height } = this.cameras.main;
        const gameState = this.registry.get('gameState');

        this.W = width;
        this.H = height;
        this.homeKit = kitFor(this.homeKingdom.id);
        this.awayKit = kitFor(this.awayKingdom.id);

        // Process match outcome for economy
        const isWin = this.result.homeScore > this.result.awayScore;
        const isDraw = this.result.homeScore === this.result.awayScore;
        const isLoss = !isWin && !isDraw;

        // Initialize state manager first (ensures fields exist without overwriting)
        GameStateManager.initializeState(this.registry);

        // Update game state after init
        gameState.lastMatchWon = isWin;
        if (isWin) {
            gameState.reputation = Math.min(100, (gameState.reputation || 50) + 3);
        } else if (isLoss) {
            gameState.reputation = Math.max(0, (gameState.reputation || 50) - 2);
        }
        this.registry.set('gameState', gameState);

        // Advance week with economy
        GameStateManager.advanceWeek(this.registry);

        // Sync gold
        const updatedState = this.registry.get('gameState');
        if (updatedState.money !== undefined) {
            updatedState.gold = updatedState.money;
        }
        this.registry.set('gameState', updatedState);

        // Bright backdrop
        this.createBackground(width, height);

        // Result banner + score line
        this.createResultBanner(width, isWin, isDraw);
        this.createScoreLine(width);

        // Match stats panel
        this.createStatsPanel(width, height);

        // Goal scorers
        this.createGoalScorers(width);

        // Economy summary
        this.createEconomySummary(width, height, updatedState, isWin);

        // Season progress
        this.createSeasonProgress(width, height, updatedState);

        // Continue button
        this.createContinueButton(width, height, updatedState);

        // Celebrate a win
        if (isWin) this.createConfetti(width);
    }

    // ═══════════════════════════════════════════════════════════════
    // BACKGROUND — the ground the match was just played on: town skyline,
    // terraces and crowd down both sides of the report, hoarding along the
    // bottom, and a few figures still milling about after the whistle.
    // ═══════════════════════════════════════════════════════════════
    createBackground(width, height) {
        this.bgWorld = stadiumBackdrop(this, {
            cx: 470, cy: 388, spanX: 900, spanY: 424, shearX: -160, tiltY: 44,
            depth: D_BG,
            strollers: [
                { y: 150, x0: 16, x1: 166, speed: 10 },
                { y: 146, x0: 794, x1: 944, speed: 12, dir: -1 },
                { y: 636, x0: 20, x1: 458, speed: 20 },
                { y: 640, x0: 470, x1: 932, speed: 16, dir: -1 },
                { y: 630, x0: 150, x1: 800, speed: 12 },
            ],
        });
    }

    update(_time, delta) {
        if (this.bgWorld) this.bgWorld.tick(delta);
    }

    // ═══════════════════════════════════════════════════════════════
    // RESULT BANNER
    // ═══════════════════════════════════════════════════════════════
    createResultBanner(width, isWin, isDraw) {
        const text = isWin ? 'VICTORY!' : isDraw ? 'DRAW' : 'DEFEAT';
        const top = isWin ? 0x63d94a : isDraw ? 0xffd94a : 0xff7a6a;
        const bot = isWin ? 0x2f9e1e : isDraw ? 0xd8a13a : 0xc4342a;

        // UI.banner is square-cornered, which made this the only hard-edged
        // element on a screen of rounded panels, rows and buttons. Local rounded
        // version instead.
        const banner = this.roundedCallout(width / 2, L.bannerY, 460, text, {
            scale: 6, h: 58, top, bot,
        });
        banner.setDepth(D_BANNER);
        banner.setScale(0);

        this.tweens.add({
            targets: banner,
            scale: 1,
            duration: 520,
            ease: 'Back.easeOut',
        });

        // Small punch after the scale-in settles
        this.tweens.add({
            targets: banner,
            scaleX: 1.03,
            scaleY: 0.96,
            duration: 160,
            delay: 540,
            yoyo: true,
            ease: 'Sine.easeInOut',
        });
    }

    /**
     * Rounded-corner result callout: dark frame, banded gradient plate, pixel
     * lettering. Same API shape as UI.banner so the tweens are unchanged.
     */
    roundedCallout(cx, cy, w, text, opts = {}) {
        const h = opts.h || 58;
        const r = opts.radius ?? 10;
        const top = opts.top ?? C.titleBarTop;
        const bot = opts.bot ?? C.titleBarBot;

        const container = this.add.container(cx, cy);
        const g = this.add.graphics();

        // Frame + base plate
        g.fillStyle(C.panelEdge, 1);
        g.fillRoundedRect(-w / 2 - 3, -h / 2 - 3, w + 6, h + 6, r + 3);
        g.fillStyle(bot, 1);
        g.fillRoundedRect(-w / 2, -h / 2, w, h, r);

        // Banded gradient. Four bands keeps each band taller than the radius, so
        // only the first and last need corner rounding.
        const bands = 4;
        const bh = h / bands;
        for (let i = 0; i < bands; i++) {
            const col = Phaser.Display.Color.Interpolate.ColorWithColor(
                Phaser.Display.Color.ValueToColor(top),
                Phaser.Display.Color.ValueToColor(bot),
                bands - 1, i
            );
            g.fillStyle(Phaser.Display.Color.GetColor(col.r, col.g, col.b), 1);
            const y = -h / 2 + bh * i;
            if (i === 0) {
                g.fillRoundedRect(-w / 2, y, w, bh + 1, { tl: r, tr: r, bl: 0, br: 0 });
            } else if (i === bands - 1) {
                g.fillRoundedRect(-w / 2, y, w, bh, { tl: 0, tr: 0, bl: r, br: r });
            } else {
                g.fillRect(-w / 2, y, w, bh + 1);
            }
        }

        // Shine line, inset so it follows the rounded edge
        g.fillStyle(0xffffff, 0.4);
        g.fillRect(-w / 2 + r, -h / 2 + 5, w - r * 2, 2);
        container.add(g);

        const pt = new PixelText(this, 0, 0, text, {
            scale: opts.scale || 5, preset: 'gold',
        });
        pt.setOrigin(0.5, 0.5);
        container.add(pt.gfx);
        container.pixelText = pt;
        return container;
    }

    // ═══════════════════════════════════════════════════════════════
    // SCORE LINE — swatch + short name, big gold score, name + swatch
    // ═══════════════════════════════════════════════════════════════
    createScoreLine(width) {
        const cx = width / 2;
        const y = L.scoreY;
        const line = this.add.container(0, 0).setDepth(D_PANEL + 5);

        // Cream plate behind the score line so it reads over the sky
        const g = this.add.graphics();
        g.fillStyle(C.panelEdge, 1);
        g.fillRoundedRect(cx - 302, y - 34, 604, 68, 9);
        g.fillStyle(C.panelBody, 1);
        g.fillRoundedRect(cx - 300, y - 32, 600, 64, 8);
        g.fillStyle(0xffffff, 0.5);
        g.fillRect(cx - 296, y - 28, 592, 9);
        line.add(g);

        // Home
        line.add(this.kitSwatch(cx - 262, y, 17, this.homeKit));
        line.add(UI.label(this, cx - 236, y, this.homeKit.name, {
            size: 20, bold: true, color: '#123a6b', oy: 0.5,
        }));

        // Away
        line.add(UI.label(this, cx + 236, y, this.awayKit.name, {
            size: 20, bold: true, color: '#123a6b', ox: 1, oy: 0.5,
        }));
        line.add(this.kitSwatch(cx + 262, y, 17, this.awayKit));

        // Score
        const score = new PixelText(this, 0, 0,
            `${this.result.homeScore} - ${this.result.awayScore}`, {
            scale: 6, preset: 'gold', originX: 0.5, originY: 0.5,
        });
        score.addTo(line, cx, y);

        line.setAlpha(0);
        this.tweens.add({
            targets: line,
            alpha: 1,
            duration: 340,
            delay: 320,
            ease: 'Power2',
        });
    }

    // ═══════════════════════════════════════════════════════════════
    // MATCH STATS — mirrored bars per stat
    // ═══════════════════════════════════════════════════════════════
    createStatsPanel(width, height) {
        const stats = this.result.stats || {};
        const p = L.stats;
        const panel = UI.panel(this, p.x, p.y, p.w, p.h, 'Match Stats');
        panel.setDepth(D_PANEL);

        const rows = [
            {
                label: 'Possession',
                home: (stats.possession && stats.possession.home) || 0,
                away: (stats.possession && stats.possession.away) || 0,
                max: 100,
                color: C.statSpeed,
            },
            {
                label: 'Shots',
                home: (stats.shots && stats.shots.home) || 0,
                away: (stats.shots && stats.shots.away) || 0,
                max: null,
                color: C.statKick,
            },
            {
                label: 'Fouls',
                home: (stats.fouls && stats.fouls.home) || 0,
                away: (stats.fouls && stats.fouls.away) || 0,
                max: null,
                color: C.statKeeper,
            },
        ];

        // UI.statBar now defaults to barH 26 / numScale 3, so the old
        // label-above-two-bars stack no longer fits three stats in 212px. The
        // stat name moves to the left of the pair, which buys the height back and
        // leaves clear room for the Formation Fit footer.
        const barH = 24;
        const rowStep = 58;
        const firstRowY = panel.bodyRect.y + 8;
        const barX = 116;
        const barW = 264;

        rows.forEach((row, i) => {
            const gy = firstRowY + i * rowStep;
            const max = row.max !== null ? row.max : Math.max(1, row.home + row.away);

            panel.add(UI.label(this, 16, gy + barH + 3, row.label, {
                size: 12, bold: true, color: '#123a6b', oy: 0.5,
            }));

            UI.statBar(this, panel, barX, gy, {
                labelText: this.homeKit.name,
                value: row.home,
                max,
                color: row.color,
                barW,
                barH,
                labelW: 42,
                animate: true,
                delay: 300 + i * 110,
            });

            UI.statBar(this, panel, barX, gy + barH + 6, {
                labelText: this.awayKit.name,
                value: row.away,
                max,
                color: C.inkLight,
                barW,
                barH,
                labelW: 42,
                animate: true,
                delay: 360 + i * 110,
            });
        });

        // Formation fit footer, when the engine reported it. It used to land at
        // bodyRect.y + 20 + 3*58 = 228 inside a 246-tall rounded panel, which put
        // the glyphs on the frame; now it clears the border by 13px.
        if (stats.formationFit) {
            const fy = firstRowY + rows.length * rowStep + 10;
            const homeFit = Math.round((stats.formationFit.home || 1) * 100);
            const awayFit = Math.round((stats.formationFit.away || 1) * 100);

            panel.add(UI.label(this, p.w / 2, fy, 'Formation Fit', {
                size: 12, bold: true, color: '#123a6b', ox: 0.5, oy: 0.5,
            }));

            const hp = new PixelText(this, 0, 0, `${homeFit}%`, {
                scale: 2,
                spacing: 2,
                preset: homeFit >= 80 ? 'good' : 'dark',
                originX: 0.5, originY: 0.5,
            });
            hp.addTo(panel, 88, fy);

            const ap = new PixelText(this, 0, 0, `${awayFit}%`, {
                scale: 2,
                spacing: 2,
                preset: awayFit >= 80 ? 'good' : 'dark',
                originX: 0.5, originY: 0.5,
            });
            ap.addTo(panel, p.w - 88, fy);
        }
    }

    // ═══════════════════════════════════════════════════════════════
    // SCORERS
    // ═══════════════════════════════════════════════════════════════
    createGoalScorers(width) {
        const goals = (this.result.events || []).filter(e => e.type === 'goal');
        const p = L.scorers;
        const panel = UI.panel(this, p.x, p.y, p.w, p.h, 'Scorers');
        panel.setDepth(D_PANEL);

        const rowX = 12;
        const rowW = p.w - 24;
        const rowH = 28;
        const step = 33;
        const maxRows = 6;
        const shown = goals.slice(0, maxRows);

        if (goals.length === 0) {
            panel.add(UI.icon(this, p.w / 2, panel.bodyRect.y + 26, 'shield', 28));
            panel.add(UI.label(this, p.w / 2, panel.bodyRect.y + 52,
                'No goals — a stubborn defensive battle.', {
                size: 13, color: '#4a4a55', ox: 0.5, oy: 0.5,
            }));
            this.addSecondaryEvents(panel, rowX, rowW, panel.bodyRect.y + 64, p.h);
            return;
        }

        shown.forEach((goal, i) => {
            const rowY = panel.bodyRect.y + 8 + i * step;
            const isHome = goal.team === 'home';
            const kit = isHome ? this.homeKit : this.awayKit;

            const row = UI.listRow(this, panel, rowX, rowY, rowW, rowH, {
                alt: i % 2 === 1,
            });

            // Kit-colored dot
            const dot = this.add.graphics();
            dot.setPosition(20, rowH / 2);
            dot.fillStyle(C.panelEdge, 1);
            dot.fillCircle(0, 0, 8);
            dot.fillStyle(kit.jersey, 1);
            dot.fillCircle(0, 0, 6.5);
            dot.fillStyle(0xffffff, 0.35);
            dot.fillCircle(-2, -2.4, 2.2);
            row.add(dot);

            const scorerName = (goal.data && goal.data.scorer && goal.data.scorer.name) || 'Unknown';
            row.add(UI.label(this, 36, rowH / 2, scorerName, {
                size: 13, bold: true, color: '#2b2b33', oy: 0.5,
            }));

            row.add(UI.label(this, 200, rowH / 2, kit.name, {
                size: 11, color: '#5a5a48', oy: 0.5,
            }));

            const assistPlayer = goal.data && (goal.data.assister || goal.data.assist);
            const assist = assistPlayer ? assistPlayer.name : null;
            if (assist) {
                row.add(UI.label(this, 258, rowH / 2, `assist ${assist}`, {
                    size: 10, color: '#6a6a58', oy: 0.5,
                }));
            }

            // Minute
            const minute = new PixelText(this, 0, 0, `${goal.minute}'`, {
                scale: 2, preset: 'dark', originX: 1, originY: 0.5,
            });
            minute.addTo(row, rowW - 12, rowH / 2);

            row.setAlpha(0);
            this.tweens.add({
                targets: row,
                alpha: 1,
                duration: 260,
                delay: 420 + i * 90,
                ease: 'Power2',
            });
        });

        let nextY = panel.bodyRect.y + 8 + shown.length * step;

        if (goals.length > maxRows) {
            panel.add(UI.label(this, p.w / 2, nextY + 8,
                `+${goals.length - maxRows} more goals`, {
                size: 11, color: '#4a4a55', ox: 0.5, oy: 0.5,
            }));
            nextY += 18;
        }

        // A 1-0 used to leave this 452x246 panel more than half empty. Fill the
        // rest with the match's other notable moments as dimmer rows.
        this.addSecondaryEvents(panel, rowX, rowW, nextY + 4, p.h);
    }

    /**
     * Saves, shots off target and cards, as quieter rows under the scorers.
     * Fills whatever height is left in the panel and stops 12px short of the
     * rounded frame.
     */
    addSecondaryEvents(panel, rowX, rowW, startY, panelH) {
        const events = this.result.events || [];
        const name = (p) => (p && p.name) || 'Unknown';

        const cards = [];
        const saves = [];
        const wides = [];

        events.forEach((e) => {
            if (e.type === 'foul' && e.data && e.data.card) {
                cards.push({
                    minute: e.minute,
                    team: e.team,
                    tint: e.data.card === 'red' ? C.bad : C.warn,
                    text: e.data.card === 'red'
                        ? `${name(e.data.fouler)} sent off`
                        : `${name(e.data.fouler)} booked`,
                    note: e.data.fouled ? `foul on ${name(e.data.fouled)}` : '',
                });
            } else if (e.type === 'save' && e.data) {
                saves.push({
                    minute: e.minute,
                    team: e.team,
                    tint: C.statSpeed,
                    text: `${name(e.data.keeper)} saves`,
                    note: `from ${name(e.data.shooter)}`,
                });
            } else if (e.type === 'shot_wide' && e.data) {
                wides.push({
                    minute: e.minute,
                    team: e.team,
                    tint: C.inkLight,
                    text: `${name(e.data.shooter)} off target`,
                    note: '',
                });
            }
        });

        const rowH = 24;
        const step = 27;
        const bottomLimit = panelH - 12;
        let y = startY;

        // Header only if at least one row will fit under it
        const capacity = Math.floor((bottomLimit - (y + 18) + (step - rowH)) / step);
        if (capacity <= 0) return;

        const pool = [...cards, ...saves, ...wides].slice(0, capacity);
        if (pool.length === 0) return;
        pool.sort((a, b) => a.minute - b.minute);

        const divider = this.add.graphics();
        divider.fillStyle(C.subPanelEdge, 1);
        divider.fillRect(rowX, y + 8, rowW, 2);
        panel.add(divider);
        panel.add(UI.label(this, rowX + 6, y + 8, 'Other key moments', {
            size: 10, bold: true, color: '#5a5240', oy: 1,
        }));
        y += 18;

        pool.forEach((ev, i) => {
            const row = UI.listRow(this, panel, rowX, y + i * step, rowW, rowH, {
                alt: i % 2 === 1,
            });
            row.setAlpha(0.86);

            const dot = this.add.graphics();
            dot.setPosition(18, rowH / 2);
            dot.fillStyle(C.panelEdge, 1);
            dot.fillCircle(0, 0, 6);
            dot.fillStyle(ev.tint, 1);
            dot.fillCircle(0, 0, 4.5);
            row.add(dot);

            row.add(UI.label(this, 32, rowH / 2, ev.text, {
                size: 11, bold: true, color: '#4a4436', oy: 0.5,
            }));
            if (ev.note) {
                row.add(UI.label(this, 214, rowH / 2, ev.note, {
                    size: 10, color: '#6a6350', oy: 0.5,
                }));
            }

            const kit = ev.team === 'home' ? this.homeKit : this.awayKit;
            row.add(UI.label(this, rowW - 46, rowH / 2, kit.name, {
                size: 10, color: '#5a5a48', ox: 1, oy: 0.5,
            }));

            const minute = new PixelText(this, 0, 0, `${ev.minute}'`, {
                scale: 2, preset: 'dark', originX: 1, originY: 0.5,
            });
            minute.addTo(row, rowW - 8, rowH / 2);
        });
    }

    // ═══════════════════════════════════════════════════════════════
    // ECONOMY
    // ═══════════════════════════════════════════════════════════════
    createEconomySummary(width, height, state, isWin) {
        const p = L.economy;
        const panel = UI.panel(this, p.x, p.y, p.w, p.h, 'Economy');
        panel.setDepth(D_PANEL);

        const income = GameStateManager.calculateIncome(state);
        const wages = GameStateManager.calculateWages(state);
        const net = income - wages;
        const totalGold = state.gold || state.money || 0;
        const reputation = state.reputation || 50;

        const items = [
            { icon: 'coin', label: 'Match Income', value: `+${income}`, preset: 'good' },
            { icon: 'boot', label: 'Player Wages', value: `-${wages}`, preset: 'bad' },
            { icon: 'up', label: 'Net This Week', value: `${net >= 0 ? '+' : ''}${net}`, preset: net >= 0 ? 'good' : 'bad' },
            { icon: 'trophy', label: 'Total Gold', value: totalGold, preset: 'gold', countUp: true },
            { icon: 'heart', label: 'Reputation', value: `${reputation}/100`, preset: 'gold' },
        ];

        items.forEach((item, i) => {
            const y = panel.bodyRect.y + 14 + i * 24;

            panel.add(UI.icon(this, 20, y, item.icon, 15));
            panel.add(UI.label(this, 36, y, item.label, {
                size: 12, bold: true, color: '#3a3a44', oy: 0.5,
            }));

            const pt = new PixelText(this, 0, 0, item.countUp ? 0 : item.value, {
                scale: 2, spacing: 2, preset: item.preset, originX: 1, originY: 0.5,
            });
            pt.addTo(panel, p.w - 16, y);

            if (item.countUp) {
                const counter = { v: Math.max(0, totalGold - Math.max(120, Math.abs(net) * 3)) };
                pt.setText(Math.round(counter.v));
                pt.setPosition(p.w - 16, y);
                this.tweens.add({
                    targets: counter,
                    v: totalGold,
                    duration: 900,
                    delay: 420,
                    ease: 'Cubic.easeOut',
                    onUpdate: () => {
                        pt.setText(Math.round(counter.v));
                        pt.setPosition(p.w - 16, y);
                    },
                    onComplete: () => {
                        pt.setText(totalGold);
                        pt.setPosition(p.w - 16, y);
                    },
                });
            }
        });

        // Sponsor payout hint on a win
        if (isWin) {
            const pop = UI.floatValue(this, p.x + p.w - 46, p.y + 96, `+${Math.max(0, net)}`, {
                preset: net >= 0 ? 'good' : 'bad', scale: 2, rise: 26,
            });
            pop.setDepth(D_PANEL + 30);
        }
    }

    // ═══════════════════════════════════════════════════════════════
    // SEASON PROGRESS
    // ═══════════════════════════════════════════════════════════════
    createSeasonProgress(width, height, state) {
        const p = L.season;
        const panel = UI.panel(this, p.x, p.y, p.w, p.h, 'Season');
        panel.setDepth(D_PANEL);

        const total = GameStateManager.SEASON_LENGTH;
        const played = state.matchesThisSeason || 0;
        const progress = Math.max(0, Math.min(1, played / total));

        panel.add(UI.label(this, 18, panel.bodyRect.y + 14, `Season ${state.season} Progress`, {
            size: 13, bold: true, color: '#123a6b', oy: 0.5,
        }));

        const barX = 18;
        const barY = panel.bodyRect.y + 34;
        const barW = p.w - 36;
        const barH = 20;

        const track = this.add.graphics();
        track.fillStyle(C.panelEdge, 1);
        track.fillRoundedRect(barX - 2, barY - 2, barW + 4, barH + 4, 5);
        track.fillStyle(C.subPanel, 1);
        track.fillRoundedRect(barX, barY, barW, barH, 4);
        panel.add(track);

        const fill = this.add.graphics();
        panel.add(fill);
        const drawFill = (t) => {
            fill.clear();
            const fw = barW * t;
            if (fw <= 0) return;
            fill.fillStyle(C.hudGreen, 1);
            fill.fillRoundedRect(barX, barY, fw, barH, 4);
            fill.fillStyle(0xffffff, 0.35);
            fill.fillRect(barX + 2, barY + 2, Math.max(0, fw - 4), 6);
        };
        const anim = { t: 0 };
        drawFill(0);
        this.tweens.add({
            targets: anim,
            t: progress,
            duration: 700,
            delay: 360,
            ease: 'Cubic.easeOut',
            onUpdate: () => drawFill(anim.t),
        });

        // Week markers
        const markers = this.add.graphics();
        markers.fillStyle(C.panelEdge, 0.55);
        for (let i = 1; i < total; i++) {
            const mx = barX + (barW / total) * i;
            markers.fillRect(mx - 1, barY, 2, barH);
        }
        panel.add(markers);

        // played / total
        const counter = new PixelText(this, 0, 0, `${played}/${total}`, {
            scale: 3, preset: 'gold', originX: 0.5, originY: 0.5,
        });
        counter.addTo(panel, p.w / 2, barY + barH + 26);

        panel.add(UI.label(this, p.w / 2, barY + barH + 48,
            state.seasonComplete ? 'SEASON COMPLETE!' : 'Weeks played this season', {
            size: 12,
            bold: !!state.seasonComplete,
            color: state.seasonComplete ? '#1f7a1f' : '#4a4a55',
            ox: 0.5, oy: 0.5,
        }));
    }

    // ═══════════════════════════════════════════════════════════════
    // CONTINUE BUTTON
    // ═══════════════════════════════════════════════════════════════
    createContinueButton(width, height, state) {
        const label = state.seasonComplete ? 'Season Summary' : 'Continue';
        const btn = UI.button(this, width / 2 - L.btnW / 2, L.btnY, L.btnW, L.btnH, label, {
            size: 16,
            color: state.seasonComplete ? C.numGold : C.hudGreen,
            colorDark: state.seasonComplete ? C.numGoldDark : C.hudGreenDark,
        });
        btn.setDepth(D_BTN);
        btn.onClick(() => {
            if (state.seasonComplete) {
                this.showSeasonSummary(width, height);
            } else {
                this.cameras.main.fadeOut(300, 255, 255, 255);
                this.cameras.main.once('camerafadeoutcomplete', () => {
                    this.scene.start('TeamManagementScene');
                });
            }
        });
        this.continueBtn = btn;
    }

    // ═══════════════════════════════════════════════════════════════
    // SEASON SUMMARY OVERLAY
    // ═══════════════════════════════════════════════════════════════
    showSeasonSummary(width, height) {
        const rewards = GameStateManager.endSeason(this.registry);
        const state = this.registry.get('gameState');
        if (state.money !== undefined) state.gold = state.money;
        this.registry.set('gameState', state);

        const layer = this.add.container(0, 0).setDepth(D_OVERLAY);

        // Bright wash instead of a dark scrim
        const wash = this.add.graphics();
        wash.fillStyle(0xffffff, 0.6);
        wash.fillRect(0, 0, width, height);
        wash.setInteractive(new Phaser.Geom.Rectangle(0, 0, width, height), Phaser.Geom.Rectangle.Contains);
        layer.add(wash);

        const pw = 600;
        const ph = 452;
        const px = width / 2 - pw / 2;
        const py = 84;
        const panel = UI.panel(this, px, py, pw, ph, 'Season Complete');
        layer.add(panel);

        const hasTrophy = rewards.trophy !== null;

        // Big trophy
        panel.add(UI.icon(this, pw / 2, panel.bodyRect.y + 56, 'trophy', hasTrophy ? 76 : 54));

        if (hasTrophy) {
            const champBanner = this.roundedCallout(pw / 2, panel.bodyRect.y + 128, pw - 60, 'CHAMPION!', {
                scale: 5, h: 58, top: 0xffe07a, bot: 0xd8a13a,
            });
            panel.add(champBanner);
            champBanner.setScale(0);
            this.tweens.add({
                targets: champBanner,
                scale: 1,
                duration: 480,
                ease: 'Back.easeOut',
            });

            panel.add(UI.label(this, pw / 2, panel.bodyRect.y + 172, rewards.trophy, {
                size: 15, bold: true, color: '#123a6b', ox: 0.5, oy: 0.5,
            }));
        } else {
            panel.add(UI.label(this, pw / 2, panel.bodyRect.y + 124,
                'The season closes. Regroup, retrain, and ride again.', {
                size: 15, color: '#3a3a44', ox: 0.5, oy: 0.5,
            }));
        }

        // Reward rows
        const rowsTop = panel.bodyRect.y + (hasTrophy ? 200 : 164);
        panel.add(UI.label(this, pw / 2, rowsTop, 'SEASON REWARDS', {
            size: 13, bold: true, color: '#123a6b', ox: 0.5, oy: 0.5,
        }));

        const rewardItems = [
            { icon: 'coin', label: 'Gold Bonus', value: `+${rewards.gold}`, preset: 'gold' },
            { icon: 'heart', label: 'Reputation', value: `+${rewards.reputation}`, preset: 'good' },
        ];

        rewardItems.forEach((item, i) => {
            const y = rowsTop + 28 + i * 32;
            const row = UI.listRow(this, panel, 60, y, pw - 120, 28, { alt: i % 2 === 1 });
            row.add(UI.icon(this, 20, 14, item.icon, 16));
            row.add(UI.label(this, 38, 14, item.label, {
                size: 13, bold: true, color: '#2b2b33', oy: 0.5,
            }));
            const pt = new PixelText(this, 0, 0, item.value, {
                scale: 2, spacing: 2, preset: item.preset, originX: 1, originY: 0.5,
            });
            pt.addTo(row, pw - 132, 14);
        });

        if (rewards.trophy) {
            const y = rowsTop + 28 + rewardItems.length * 32;
            const row = UI.listRow(this, panel, 60, y, pw - 120, 28, { alt: rewardItems.length % 2 === 1 });
            row.add(UI.icon(this, 20, 14, 'trophy', 16));
            row.add(UI.label(this, 38, 14, rewards.trophy, {
                size: 13, bold: true, color: '#4a3a12', oy: 0.5,
            }));
        }

        // Start next season
        const btnW = 220;
        const btn = UI.button(this, width / 2 - btnW / 2, py + ph - 62, btnW, 42,
            `Start Season ${state.season}`, {
            size: 16, color: C.hudGreen, colorDark: C.hudGreenDark,
        });
        layer.add(btn);
        btn.onClick(() => {
            this.cameras.main.fadeOut(500, 255, 255, 255);
            this.cameras.main.once('camerafadeoutcomplete', () => {
                this.scene.start('TeamManagementScene');
            });
        });

        layer.setAlpha(0);
        this.tweens.add({ targets: layer, alpha: 1, duration: 280, ease: 'Power2' });
    }

    // ═══════════════════════════════════════════════════════════════
    // HELPERS
    // ═══════════════════════════════════════════════════════════════
    kitSwatch(x, y, s, kit) {
        const g = this.add.graphics();
        g.setPosition(x, y);

        const path = (o) => {
            g.beginPath();
            g.moveTo(-s - o, -s - o);
            g.lineTo(s + o, -s - o);
            g.lineTo(s + o, s * 0.35 + o);
            g.lineTo(0, s + o * 1.4);
            g.lineTo(-s - o, s * 0.35 + o);
            g.closePath();
        };

        g.fillStyle(C.panelEdge, 1);
        path(2);
        g.fillPath();
        g.fillStyle(kit.jersey, 1);
        path(0);
        g.fillPath();
        g.fillStyle(kit.accent, 1);
        g.fillRect(-s * 0.3, -s, s * 0.6, s * 1.2);
        g.fillStyle(0xffffff, 0.3);
        g.fillRect(-s + 1, -s + 1, s * 2 - 2, s * 0.45);
        return g;
    }

    createConfetti(width) {
        const colors = [C.numGold, C.good, C.titleBarTop, C.heart, C.white, C.warn];
        for (let i = 0; i < 64; i++) {
            const g = this.add.graphics().setDepth(D_CONFETTI);
            g.fillStyle(colors[i % colors.length], 1);
            g.fillRect(-4, -6, 8, 12);
            g.setPosition(
                Phaser.Math.Between(10, width - 10),
                Phaser.Math.Between(-280, -10)
            );
            g.setAngle(Phaser.Math.Between(0, 360));

            const fall = Phaser.Math.Between(2400, 4200);
            const delay = i * 26;
            this.tweens.add({
                targets: g,
                y: this.H + 30,
                duration: fall,
                delay,
                ease: 'Sine.easeIn',
                onComplete: () => g.destroy(),
            });
            this.tweens.add({
                targets: g,
                angle: g.angle + Phaser.Math.Between(360, 900),
                x: g.x + Phaser.Math.Between(-70, 70),
                duration: fall,
                delay,
                ease: 'Sine.easeInOut',
            });
        }
    }
}
