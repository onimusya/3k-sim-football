// LeagueScene — bright Kairosoft-style league hub.
// Sunny sky + mowed grass backdrop, white dialog panels with blue title bars,
// cream list rows, chunky pixel numerals. All visuals come from src/art.

import { KINGDOMS } from '../data/teams.js';

import { C, kitFor } from '../art/Palette.js';
import { PixelText } from '../art/PixelFont.js';
import * as UI from '../art/UI.js';
import { stadiumBackdrop } from '../art/Backdrop.js';

// ── depth bands ────────────────────────────────────────────────────────────
const D_BG = 0;
const D_CONTENT = 10;
const D_PLATE = 20;
const D_BTN = 30;
const D_TABS = 50;
const D_HUD = 60;

// Layout for the 960x640 canvas
const L = {
    tabY: 50,
    tabW: 140,
    tabH: 30,
    tabGap: 10,
    panel: { x: 20, y: 86, w: 920, h: 410 },
    plate: { x: 20, y: 504, w: 920, h: 48 },
    btnY: 562,
    btnW: 180,
    btnH: 40,
};

// Standings column offsets (local to a 900px wide row)
const COL = {
    rank: 28,
    shield: 62,
    name: 84,
    played: 440,
    won: 480,
    drawn: 520,
    lost: 560,
    gf: 606,
    ga: 652,
    gd: 715,
    pts: 812,
    form: 866,
};

export class LeagueScene extends Phaser.Scene {
    constructor() {
        super({ key: 'LeagueScene' });
    }

    create() {
        const { width, height } = this.cameras.main;
        const gameState = this.registry.get('gameState');
        const playerKingdom = KINGDOMS[gameState.playerKingdom.toUpperCase()];

        this.gameState = gameState;
        this.playerKingdom = playerKingdom;
        this.playerKit = kitFor(playerKingdom.id);
        this.screenW = width;
        this.screenH = height;

        // Active tab state
        this.activeTab = 'standings';
        this.tabContainers = {};
        this.tabButtons = [];

        // Bright backdrop
        this.createBackground(width, height);

        // Top HUD bar (money + date)
        this.createTopBar(width);

        // Tab bar
        this.createTabs(width);

        // Create all tab content (only show active)
        this.tabContainers.standings = this.createStandingsTab(width, height);
        this.tabContainers.fixtures = this.createFixturesTab(width, height);
        this.tabContainers.stats = this.createStatsTab(width, height);

        // Narrative plate (depends on the player's league position)
        this.createNarrativePlate(width);

        // Show only active tab
        this.showTab('standings');

        // Back button
        this.createBackButton(width, height);
    }

    // ═══════════════════════════════════════════════════════════════
    // BACKGROUND — the league is played in a real stadium, not on wallpaper.
    // Town skyline + terraces + crowd sit either side of the tab bar, the
    // hoarding runs under the back button, and figures stroll through the gaps.
    // ═══════════════════════════════════════════════════════════════
    createBackground(width, height) {
        this.bgWorld = stadiumBackdrop(this, {
            cx: 470, cy: 360, spanX: 960, spanY: 452, shearX: -160, tiltY: 44,
            depth: D_BG,
            strollers: [
                { y: 86, x0: 12, x1: 250, speed: 14 },
                { y: 80, x0: 706, x1: 946, speed: 12, dir: -1 },
                { y: 636, x0: 20, x1: 372, speed: 20 },
                { y: 640, x0: 588, x1: 940, speed: 17, dir: -1 },
                { y: 632, x0: 120, x1: 840, speed: 11 },
            ],
        });
    }

    update(_time, delta) {
        if (this.bgWorld) this.bgWorld.tick(delta);
    }

    // ═══════════════════════════════════════════════════════════════
    // TOP BAR
    // ═══════════════════════════════════════════════════════════════
    createTopBar(width) {
        const gs = this.gameState;
        this.topBarUI = UI.topBar(this, width);
        this.topBarUI.setDepth(D_HUD);
        this.topBarUI.setMoney(gs.gold ?? gs.money ?? 0);
        this.topBarUI.setDate(gs.season ?? 1, 1, gs.week ?? 1);

        // Kingdom crest in the mascot slot
        const crest = this.add.container(30, this.topBarUI.barH / 2).setDepth(D_HUD + 1);
        const cg = this.add.graphics();
        cg.fillStyle(C.panelEdge, 1);
        cg.fillRoundedRect(-17, -15, 34, 30, 5);
        cg.fillStyle(this.playerKit.jersey, 1);
        cg.fillRoundedRect(-15, -13, 30, 26, 4);
        cg.fillStyle(0xffffff, 0.28);
        cg.fillRect(-13, -11, 26, 8);
        crest.add(cg);
        crest.add(this.add.text(0, 0, this.playerKingdom.name.charAt(0), {
            fontFamily: 'serif', fontSize: '17px', color: '#ffffff',
            stroke: '#20202a', strokeThickness: 3,
        }).setOrigin(0.5));
    }

    // ═══════════════════════════════════════════════════════════════
    // TABS — Standings | Fixtures | Stats (chunky UI buttons)
    // ═══════════════════════════════════════════════════════════════
    createTabs(width) {
        this.tabDefs = [
            { id: 'standings', label: 'Standings' },
            { id: 'fixtures', label: 'Fixtures' },
            { id: 'stats', label: 'Stats' },
        ];
        const totalW = this.tabDefs.length * L.tabW + (this.tabDefs.length - 1) * L.tabGap;
        this.tabStartX = width / 2 - totalW / 2;
        this.renderTabs();
    }

    renderTabs() {
        this.tabButtons.forEach((b) => b.destroy());
        this.tabButtons = [];

        this.tabDefs.forEach((def, i) => {
            const x = this.tabStartX + i * (L.tabW + L.tabGap);
            const isActive = def.id === this.activeTab;
            const btn = UI.button(this, x, L.tabY, L.tabW, L.tabH, def.label, {
                size: 14,
                color: isActive ? C.numGold : C.titleBarTop,
                colorDark: isActive ? C.numGoldDark : C.titleBarBot,
            });
            btn.setDepth(D_TABS);
            // Deferred by a tick: the click rebuilds these very buttons.
            btn.onClick(() => this.time.delayedCall(0, () => this.switchTab(def.id)));
            this.tabButtons.push(btn);
        });
    }

    switchTab(tabId) {
        if (tabId === this.activeTab) return;
        const oldTab = this.activeTab;
        this.activeTab = tabId;

        this.renderTabs();

        // Smooth alpha transition between the tab content containers
        const from = this.tabContainers[oldTab];
        if (from) {
            this.tweens.add({
                targets: from,
                alpha: 0,
                duration: 180,
                ease: 'Power2',
                onComplete: () => {
                    from.setVisible(false);
                    this.showTab(tabId);
                },
            });
        } else {
            this.showTab(tabId);
        }
    }

    showTab(tabId) {
        Object.keys(this.tabContainers).forEach((key) => {
            const c = this.tabContainers[key];
            if (!c) return;
            c.setVisible(key === tabId);
            if (key === tabId) {
                c.setAlpha(0);
                this.tweens.add({
                    targets: c,
                    alpha: 1,
                    duration: 260,
                    ease: 'Power2',
                });
            }
        });
    }

    // ═══════════════════════════════════════════════════════════════
    // STANDINGS TAB
    // ═══════════════════════════════════════════════════════════════
    createStandingsTab(width, height) {
        const container = this.add.container(0, 0).setDepth(D_CONTENT);
        const table = this.getLeagueTable(this.gameState);
        this.leagueTable = table;

        const p = L.panel;
        const rowH = 36;
        const step = 42;
        // Height follows the data: title bar + column header + rows + legend.
        // The fixed 410 left ~70px of blank white under the legend.
        const panelH = 34 + 26 + table.length * step + 44;
        const panel = UI.panel(this, p.x, p.y, p.w, panelH, 'Three Kingdoms League');
        container.add(panel);

        const rowX = 10;
        const rowW = p.w - 20;
        const headerY = panel.bodyRect.y + 12;
        const firstRowY = panel.bodyRect.y + 26;

        // Column headers
        const head = (x, text, ox = 0.5) => {
            panel.add(UI.label(this, rowX + x, headerY, text, {
                size: 11, bold: true, color: '#123a6b', ox, oy: 0.5,
            }));
        };
        head(COL.rank, '#');
        head(COL.name, 'KINGDOM', 0);
        head(COL.played, 'P');
        head(COL.won, 'W');
        head(COL.drawn, 'D');
        head(COL.lost, 'L');
        head(COL.gf, 'GF');
        head(COL.ga, 'GA');
        head(COL.gd, 'GD');
        head(COL.pts, 'PTS');
        head(COL.form, 'FORM');

        table.forEach((team, index) => {
            const rowY = firstRowY + index * step;
            const isPlayer = team.id === this.gameState.playerKingdom;
            const kingdom = KINGDOMS[team.id.toUpperCase()];
            const kit = kitFor(team.id);
            const gd = team.goalsFor - team.goalsAgainst;

            const row = UI.listRow(this, panel, rowX, rowY, rowW, rowH, {
                alt: index % 2 === 1,
            });
            if (isPlayer) row.setSelected(true);

            // Promotion-zone marker on the top two. It used to hug x=3, right up
            // against listRow's own dark frame at x=-2..0, so it just looked like
            // a thicker left border. Pulled inside with cream either side.
            if (index < 2) {
                const promo = this.add.graphics();
                promo.fillStyle(C.panelEdge, 1);
                promo.fillRoundedRect(5, 5, 9, rowH - 10, 4);
                promo.fillStyle(C.good, 1);
                promo.fillRoundedRect(6, 6, 7, rowH - 12, 3);
                row.add(promo);
            }

            // Rank
            const rank = new PixelText(this, 0, 0, index + 1, {
                scale: 3,
                preset: index < 2 ? 'gold' : 'dark',
                originX: 0.5, originY: 0.5,
            });
            rank.addTo(row, COL.rank, rowH / 2);

            // Kit shield swatch
            row.add(this.kitShield(COL.shield, rowH / 2, 11, kit));

            // Kingdom name. The subtitle was 9px #6a6a58 on cream — invisible.
            row.add(UI.label(this, COL.name, rowH / 2 - 7, kingdom.name, {
                size: 14, bold: true, color: '#2b2b33', oy: 0.5,
            }));
            row.add(UI.label(this, COL.name, rowH / 2 + 10, kingdom.fullName, {
                size: 11, color: '#5a5240', oy: 0.5,
            }));

            // P W D L GF GA
            const cells = [
                [COL.played, team.played],
                [COL.won, team.won],
                [COL.drawn, team.drawn],
                [COL.lost, team.lost],
                [COL.gf, team.goalsFor],
                [COL.ga, team.goalsAgainst],
            ];
            cells.forEach(([cx, val]) => {
                const pt = new PixelText(this, 0, 0, val, {
                    scale: 2, preset: 'dark', originX: 0.5, originY: 0.5,
                });
                pt.addTo(row, cx, rowH / 2);
            });

            // Goal difference
            const gdStr = (gd > 0 ? '+' : '') + gd;
            const gdPt = new PixelText(this, 0, 0, gdStr, {
                scale: 2,
                spacing: 2,
                preset: gd > 0 ? 'good' : gd < 0 ? 'bad' : 'dark',
                originX: 0.5, originY: 0.5,
            });
            gdPt.addTo(row, COL.gd, rowH / 2);

            // Points
            const pts = new PixelText(this, 0, 0, team.points, {
                scale: 3, preset: 'gold', originX: 0.5, originY: 0.5,
            });
            pts.addTo(row, COL.pts, rowH / 2);

            // Recent form pips (last five results, oldest first)
            row.add(this.formPips(COL.form, rowH / 2, this.recentForm(team.id)));

            // Staggered fade + slide in
            row.setAlpha(0);
            row.x = rowX + 26;
            this.tweens.add({
                targets: row,
                alpha: 1,
                x: rowX,
                duration: 320,
                delay: 120 + index * 70,
                ease: 'Cubic.easeOut',
            });
        });

        // Promotion legend — swatch matches the in-row marker exactly
        const legendY = firstRowY + table.length * step + 10;
        const legend = this.add.graphics();
        legend.fillStyle(C.panelEdge, 1);
        legend.fillRoundedRect(rowX + 5, legendY, 9, 14, 4);
        legend.fillStyle(C.good, 1);
        legend.fillRoundedRect(rowX + 6, legendY + 1, 7, 12, 3);
        panel.add(legend);
        panel.add(UI.label(this, rowX + 22, legendY + 7, 'Promotion zone — the top two kingdoms advance', {
            size: 11, color: '#4a4a55', oy: 0.5,
        }));
        panel.add(UI.label(this, rowX + rowW - 8, legendY + 7,
            'FORM: last five results, newest on the right', {
            size: 11, color: '#4a4a55', ox: 1, oy: 0.5,
        }));

        return container;
    }

    /**
     * Last five W/D/L outcomes for a kingdom, oldest first. Slots with no data
     * come back as null so the pip strip always renders five cells.
     */
    recentForm(teamId) {
        const out = [];
        (this.gameState.results || []).forEach((r) => {
            if (r.home !== teamId && r.away !== teamId) return;
            const isHome = r.home === teamId;
            const gf = isHome ? r.homeScore : r.awayScore;
            const ga = isHome ? r.awayScore : r.homeScore;
            out.push(gf > ga ? 'W' : gf < ga ? 'L' : 'D');
        });
        const last = out.slice(-5);
        while (last.length < 5) last.unshift(null);
        return last;
    }

    /** Five small W/D/L dots, centred on x. */
    formPips(x, y, form) {
        const g = this.add.graphics();
        const size = 10;
        const gap = 3;
        const total = form.length * size + (form.length - 1) * gap;
        let px = x - total / 2;

        form.forEach((r) => {
            g.fillStyle(C.panelEdge, 1);
            g.fillRoundedRect(px - 1, y - size / 2 - 1, size + 2, size + 2, 4);
            const fill = r === 'W' ? C.good
                : r === 'D' ? C.warn
                : r === 'L' ? C.bad
                : 0xd9d2ae;
            g.fillStyle(fill, 1);
            g.fillRoundedRect(px, y - size / 2, size, size, 3);
            if (r) {
                g.fillStyle(0xffffff, 0.42);
                g.fillRect(px + 1, y - size / 2 + 1, size - 2, 3);
            }
            px += size + gap;
        });

        return g;
    }

    // ═══════════════════════════════════════════════════════════════
    // FIXTURES TAB
    // ═══════════════════════════════════════════════════════════════
    createFixturesTab(width, height) {
        const container = this.add.container(0, 0).setDepth(D_CONTENT);
        const fixtures = this.generateFixtures();

        const p = L.panel;
        const panel = UI.panel(this, p.x, p.y, p.w, p.h, 'Fixtures');
        container.add(panel);

        const rowX = 10;
        const rowW = p.w - 20;
        const rowH = 34;
        const step = 40;
        const firstRowY = panel.bodyRect.y + 6;

        fixtures.forEach((fixture, index) => {
            const rowY = firstRowY + index * step;
            const isPlayerMatch = fixture.home === this.gameState.playerKingdom
                || fixture.away === this.gameState.playerKingdom;
            const homeKingdom = KINGDOMS[fixture.home.toUpperCase()];
            const awayKingdom = KINGDOMS[fixture.away.toUpperCase()];
            const homeKit = kitFor(fixture.home);
            const awayKit = kitFor(fixture.away);

            const row = UI.listRow(this, panel, rowX, rowY, rowW, rowH, {
                alt: index % 2 === 1,
            });
            if (isPlayerMatch) row.setSelected(true);

            // Week N
            row.add(UI.label(this, 14, rowH / 2, 'Week', {
                size: 11, bold: true, color: '#4a4a55', oy: 0.5,
            }));
            const wk = new PixelText(this, 0, 0, fixture.week, {
                scale: 2, preset: 'dark', originX: 0, originY: 0.5,
            });
            wk.addTo(row, 52, rowH / 2);

            // Your-match star
            if (isPlayerMatch) {
                row.add(UI.icon(this, 96, rowH / 2, 'star', 15));
            }

            // Home: swatch + name
            row.add(this.kitShield(180, rowH / 2, 10, homeKit));
            row.add(UI.label(this, 198, rowH / 2, homeKingdom.name, {
                size: 13,
                bold: fixture.home === this.gameState.playerKingdom,
                color: '#2b2b33', oy: 0.5,
            }));

            // vs
            row.add(UI.label(this, 400, rowH / 2, 'vs', {
                size: 12, color: '#6a6a58', ox: 0.5, oy: 0.5,
            }));

            // Away: name + swatch
            row.add(UI.label(this, 440, rowH / 2, awayKingdom.name, {
                size: 13,
                bold: fixture.away === this.gameState.playerKingdom,
                color: '#2b2b33', oy: 0.5,
            }));
            row.add(this.kitShield(512, rowH / 2, 10, awayKit));

            // Score, or a dash when it has not been played
            if (fixture.result) {
                const score = new PixelText(
                    this, 0, 0,
                    `${fixture.result.homeScore} - ${fixture.result.awayScore}`,
                    { scale: 3, preset: 'gold', originX: 0.5, originY: 0.5 }
                );
                score.addTo(row, 800, rowH / 2);
            } else {
                const dash = new PixelText(this, 0, 0, '-', {
                    scale: 3, preset: 'dark', originX: 0.5, originY: 0.5,
                });
                dash.addTo(row, 800, rowH / 2);
            }

            row.setAlpha(0);
            this.tweens.add({
                targets: row,
                alpha: 1,
                duration: 280,
                delay: 60 + index * 45,
                ease: 'Power2',
            });
        });

        if (fixtures.length === 0) {
            panel.add(UI.label(this, p.w / 2, panel.bodyRect.y + 80,
                'No fixtures scheduled yet.\nPlay matches to generate the schedule.', {
                size: 14, color: '#4a4a55', align: 'center', ox: 0.5, oy: 0.5,
            }));
        }

        return container;
    }

    // ═══════════════════════════════════════════════════════════════
    // STATS TAB — three leader boards
    // ═══════════════════════════════════════════════════════════════
    createStatsTab(width, height) {
        const container = this.add.container(0, 0).setDepth(D_CONTENT);
        const stats = this.deriveLeagueStats();

        const p = L.panel;
        const panel = UI.panel(this, p.x, p.y, p.w, p.h, 'League Leaders');
        container.add(panel);

        const colW = 288;
        const colH = 352;
        const colY = panel.bodyRect.y + 10;
        const colXs = [14, 316, 618];

        const columns = [
            { title: 'Top Scorers', icon: 'ball', data: stats.topScorers },
            { title: 'Top Assists', icon: 'boot', data: stats.topAssists },
            { title: 'Most Cards', icon: 'whistle', data: stats.mostCards },
        ];

        columns.forEach((col, ci) => {
            const cx = colXs[ci];
            UI.subPanel(this, panel, cx, colY, colW, colH, {
                color: ci === 0 ? C.subPanel : C.subPanelAlt,
                edge: C.subPanelEdge,
            });

            // Column header
            panel.add(UI.icon(this, cx + 20, colY + 18, col.icon, 16));
            panel.add(UI.label(this, cx + 36, colY + 18, col.title, {
                size: 14, bold: true, color: '#123a6b', oy: 0.5,
            }));

            const divider = this.add.graphics();
            divider.fillStyle(C.subPanelEdge, 1);
            divider.fillRect(cx + 10, colY + 32, colW - 20, 2);
            panel.add(divider);

            const entries = (col.data || []).slice(0, 8);
            entries.forEach((entry, ei) => {
                const ey = colY + 42 + ei * 32;
                const isLeader = ei === 0 && entry.value > 0;

                if (isLeader) {
                    const tint = this.add.graphics();
                    tint.fillStyle(C.panelEdge, 1);
                    tint.fillRoundedRect(cx + 7, ey - 1, colW - 14, 30, 4);
                    tint.fillStyle(C.rowSelect, 1);
                    tint.fillRoundedRect(cx + 8, ey, colW - 16, 28, 3);
                    tint.fillStyle(0xffffff, 0.4);
                    tint.fillRect(cx + 10, ey + 2, colW - 20, 6);
                    panel.add(tint);
                }

                const rank = new PixelText(this, 0, 0, ei + 1, {
                    scale: 2,
                    preset: isLeader ? 'dark' : 'dark',
                    originX: 0.5, originY: 0.5,
                });
                rank.addTo(panel, cx + 20, ey + 14);

                panel.add(UI.label(this, cx + 36, ey + 8, entry.name, {
                    size: 12, bold: isLeader, color: '#2b2b33', oy: 0.5,
                }));

                const kingdom = entry.kingdom ? KINGDOMS[entry.kingdom.toUpperCase()] : null;
                if (kingdom) {
                    panel.add(UI.label(this, cx + 36, ey + 21, kingdom.name, {
                        size: 9, color: '#5a6a5a', oy: 0.5,
                    }));
                }

                const val = new PixelText(this, 0, 0, entry.value, {
                    scale: 2,
                    preset: isLeader ? 'gold' : 'dark',
                    originX: 1, originY: 0.5,
                });
                val.addTo(panel, cx + colW - 14, ey + 14);
            });

            if (entries.length === 0 || entries[0].value === 0) {
                panel.add(UI.label(this, cx + colW / 2, colY + 120,
                    'No data yet.\nPlay matches to\ngenerate stats.', {
                    size: 12, color: '#4a4a55', align: 'center', ox: 0.5, oy: 0.5,
                }));
            }
        });

        return container;
    }

    // ═══════════════════════════════════════════════════════════════
    // NARRATIVE PLATE — cream banner keyed to the player's position
    // ═══════════════════════════════════════════════════════════════
    createNarrativePlate(width) {
        const table = this.leagueTable || this.getLeagueTable(this.gameState);
        const playerPosition = table.findIndex(t => t.id === this.gameState.playerKingdom) + 1;

        let storyText;
        let iconKind;
        if (playerPosition === 1) {
            storyText = 'Your banner flies highest! The other kingdoms tremble before your might.';
            iconKind = 'trophy';
        } else if (playerPosition <= 3) {
            storyText = 'The battle for supremacy rages on. Victory is within reach.';
            iconKind = 'star';
        } else {
            storyText = 'Your warriors must fight harder to rise. The road to glory demands sacrifice.';
            iconKind = 'up';
        }

        const p = L.plate;
        const plate = this.add.container(p.x, p.y).setDepth(D_PLATE);

        const g = this.add.graphics();
        g.fillStyle(C.panelEdge, 1);
        g.fillRoundedRect(-2, -2, p.w + 4, p.h + 4, 7);
        g.fillStyle(C.rowCream, 1);
        g.fillRoundedRect(0, 0, p.w, p.h, 6);
        g.fillStyle(0xffffff, 0.4);
        g.fillRect(3, 3, p.w - 6, 8);
        plate.add(g);

        plate.add(UI.icon(this, 26, p.h / 2, iconKind, 20));
        plate.add(UI.label(this, 50, p.h / 2, storyText, {
            size: 14, bold: true, color: '#4a3a12', oy: 0.5, wrap: p.w - 70,
        }));

        // Position readout on the right
        const pos = new PixelText(this, 0, 0, playerPosition, {
            scale: 3, preset: 'gold', originX: 1, originY: 0.5,
        });
        pos.addTo(plate, p.w - 18, p.h / 2);
        plate.add(UI.label(this, p.w - 62, p.h / 2, 'RANK', {
            size: 11, bold: true, color: '#4a3a12', ox: 1, oy: 0.5,
        }));

        this.tweens.add({
            targets: plate,
            alpha: { from: 0, to: 1 },
            duration: 420,
            delay: 260,
            ease: 'Power2',
        });
    }

    // ═══════════════════════════════════════════════════════════════
    // KIT SHIELD SWATCH
    // ═══════════════════════════════════════════════════════════════
    kitShield(x, y, s, kit) {
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

        // Accent stripe + top shine
        g.fillStyle(kit.accent, 1);
        g.fillRect(-s * 0.3, -s, s * 0.6, s * 1.2);
        g.fillStyle(0xffffff, 0.3);
        g.fillRect(-s + 1, -s + 1, s * 2 - 2, s * 0.45);
        return g;
    }

    // ═══════════════════════════════════════════════════════════════
    // BACK BUTTON
    // ═══════════════════════════════════════════════════════════════
    createBackButton(width, height) {
        const btn = UI.button(this, width / 2 - L.btnW / 2, L.btnY, L.btnW, L.btnH, 'Back to Team', {
            size: 15,
            color: C.titleBarTop,
            colorDark: C.titleBarBot,
        });
        btn.setDepth(D_BTN);
        btn.onClick(() => {
            this.cameras.main.fadeOut(300, 255, 255, 255);
            this.cameras.main.once('camerafadeoutcomplete', () => {
                this.scene.start('TeamManagementScene');
            });
        });
    }

    // ═══════════════════════════════════════════════════════════════
    // DATA: League Table Calculation
    // ═══════════════════════════════════════════════════════════════
    getLeagueTable(gameState) {
        const kingdoms = Object.values(KINGDOMS);
        const table = kingdoms.map(k => ({
            id: k.id,
            played: 0,
            won: 0,
            drawn: 0,
            lost: 0,
            goalsFor: 0,
            goalsAgainst: 0,
            points: 0
        }));

        // Process results
        (gameState.results || []).forEach(result => {
            const home = table.find(t => t.id === result.home);
            const away = table.find(t => t.id === result.away);
            if (!home || !away) return;

            home.played++;
            away.played++;
            home.goalsFor += result.homeScore;
            home.goalsAgainst += result.awayScore;
            away.goalsFor += result.awayScore;
            away.goalsAgainst += result.homeScore;

            if (result.homeScore > result.awayScore) {
                home.won++;
                home.points += 3;
                away.lost++;
            } else if (result.homeScore < result.awayScore) {
                away.won++;
                away.points += 3;
                home.lost++;
            } else {
                home.drawn++;
                away.drawn++;
                home.points += 1;
                away.points += 1;
            }
        });

        // If no games played, generate simulated history
        if (!gameState.results || gameState.results.length === 0) {
            table.forEach(team => {
                const games = Math.floor(Math.random() * 3) + 2;
                team.played = games;
                team.won = Math.floor(Math.random() * games);
                team.lost = Math.floor(Math.random() * (games - team.won));
                team.drawn = games - team.won - team.lost;
                team.goalsFor = team.won * 2 + team.drawn + Math.floor(Math.random() * 3);
                team.goalsAgainst = team.lost * 2 + team.drawn + Math.floor(Math.random() * 2);
                team.points = team.won * 3 + team.drawn;
            });
        }

        // Sort by points, then goal difference, then goals scored
        table.sort((a, b) => {
            if (b.points !== a.points) return b.points - a.points;
            const gdA = a.goalsFor - a.goalsAgainst;
            const gdB = b.goalsFor - b.goalsAgainst;
            if (gdB !== gdA) return gdB - gdA;
            return b.goalsFor - a.goalsFor;
        });

        return table;
    }

    // ═══════════════════════════════════════════════════════════════
    // DATA: Generate fixtures from results + upcoming
    // ═══════════════════════════════════════════════════════════════
    generateFixtures() {
        const kingdoms = Object.values(KINGDOMS);
        const currentWeek = this.gameState.week || 1;
        const results = this.gameState.results || [];
        const fixtures = [];

        // Past results as fixtures
        results.forEach((result, i) => {
            fixtures.push({
                week: result.week || i + 1,
                home: result.home,
                away: result.away,
                result: { homeScore: result.homeScore, awayScore: result.awayScore }
            });
        });

        // Generate upcoming fixtures using round-robin pairings
        const teamIds = kingdoms.map(k => k.id);
        const upcomingCount = Math.min(8, teamIds.length * (teamIds.length - 1) / 2);
        let generated = 0;
        let week = currentWeek;

        // Use seeded approach for consistent fixture generation
        const usedPairs = new Set(results.map(r => `${r.home}-${r.away}`));

        for (let i = 0; i < teamIds.length && generated < upcomingCount; i++) {
            for (let j = i + 1; j < teamIds.length && generated < upcomingCount; j++) {
                const pairKey = `${teamIds[i]}-${teamIds[j]}`;
                const pairKeyR = `${teamIds[j]}-${teamIds[i]}`;
                if (!usedPairs.has(pairKey) && !usedPairs.has(pairKeyR)) {
                    // Determine home/away (alternate)
                    const isFirstHome = generated % 2 === 0;
                    fixtures.push({
                        week: week + Math.floor(generated / 3),
                        home: isFirstHome ? teamIds[i] : teamIds[j],
                        away: isFirstHome ? teamIds[j] : teamIds[i],
                        result: null
                    });
                    usedPairs.add(pairKey);
                    generated++;
                }
            }
        }

        // Sort by week
        fixtures.sort((a, b) => a.week - b.week);

        // Return a maximum of 9 fixtures to fit the view
        return fixtures.slice(0, 9);
    }

    // ═══════════════════════════════════════════════════════════════
    // DATA: Derive league statistics from match results
    // ═══════════════════════════════════════════════════════════════
    deriveLeagueStats() {
        const results = this.gameState.results || [];
        const scorers = {};
        const assisters = {};
        const cardHolders = {};

        results.forEach(result => {
            const events = result.events || [];
            events.forEach(event => {
                if (event.type === 'goal' && event.data) {
                    // Track scorer
                    const scorerName = event.data.scorer ? event.data.scorer.name : null;
                    if (scorerName) {
                        if (!scorers[scorerName]) {
                            scorers[scorerName] = { name: scorerName, value: 0, kingdom: event.team === 'home' ? result.home : result.away };
                        }
                        scorers[scorerName].value++;
                    }

                    // Track assister
                    const assistName = event.data.assister ? event.data.assister.name : null;
                    if (assistName) {
                        if (!assisters[assistName]) {
                            assisters[assistName] = { name: assistName, value: 0, kingdom: event.team === 'home' ? result.home : result.away };
                        }
                        assisters[assistName].value++;
                    }
                }

                if ((event.type === 'yellow_card' || event.type === 'red_card') && event.data) {
                    const playerName = event.data.player ? event.data.player.name : null;
                    if (playerName) {
                        if (!cardHolders[playerName]) {
                            cardHolders[playerName] = { name: playerName, value: 0, kingdom: event.team === 'home' ? result.home : result.away };
                        }
                        cardHolders[playerName].value += event.type === 'red_card' ? 2 : 1;
                    }
                }
            });
        });

        // Sort and take top 10
        const topScorers = Object.values(scorers).sort((a, b) => b.value - a.value).slice(0, 10);
        const topAssists = Object.values(assisters).sort((a, b) => b.value - a.value).slice(0, 10);
        const mostCards = Object.values(cardHolders).sort((a, b) => b.value - a.value).slice(0, 10);

        // If no real data, generate placeholder stats from team rosters
        if (topScorers.length === 0) {
            const kingdoms = Object.values(KINGDOMS);
            const placeholderScorers = [];
            const placeholderAssists = [];
            const placeholderCards = [];

            kingdoms.forEach(k => {
                // Pick strikers/attackers as likely scorers
                const roster = this.getKingdomRosterNames(k.id);
                roster.forEach((player, pi) => {
                    const isAttacker = pi < 3;
                    const isMid = pi >= 3 && pi < 7;
                    if (isAttacker) {
                        const goals = Math.floor(Math.random() * 5);
                        if (goals > 0) placeholderScorers.push({ name: player, value: goals, kingdom: k.id });
                    }
                    if (isMid) {
                        const assists = Math.floor(Math.random() * 4);
                        if (assists > 0) placeholderAssists.push({ name: player, value: assists, kingdom: k.id });
                    }
                    const cards = Math.floor(Math.random() * 3);
                    if (cards > 0) placeholderCards.push({ name: player, value: cards, kingdom: k.id });
                });
            });

            return {
                topScorers: placeholderScorers.sort((a, b) => b.value - a.value).slice(0, 10),
                topAssists: placeholderAssists.sort((a, b) => b.value - a.value).slice(0, 10),
                mostCards: placeholderCards.sort((a, b) => b.value - a.value).slice(0, 10)
            };
        }

        return { topScorers, topAssists, mostCards };
    }

    getKingdomRosterNames(kingdomId) {
        const nameMap = {
            wei: ['Dian Wei', 'Zhang Liao', 'Cao Cao', 'Guo Jia', 'Sima Yi', 'Zhang He', 'Xiahou Dun', 'Xu Chu', 'Xu Huang', 'Cao Ren', 'Cao Pi'],
            shu: ['Zhang Fei', 'Zhao Yun', 'Ma Chao', 'Zhuge Liang', 'Liu Bei', 'Jiang Wei', 'Guan Yu', 'Wei Yan', 'Huang Zhong', 'Pang Tong', 'Fa Zheng'],
            wu: ['Sun Jian', 'Sun Ce', 'Gan Ning', 'Zhou Yu', 'Sun Quan', 'Lu Xun', 'Taishi Ci', 'Huang Gai', 'Lu Meng', 'Ding Feng', 'Zhou Tai'],
            dong: ['Li Jue', 'Guo Si', 'Hua Xiong', 'Li Ru', 'Dong Zhuo', 'Zhang Ji', 'Fan Chou', 'Niu Fu', 'Xu Rong', 'Jia Xu', 'Chen Gong'],
            yuan: ['Yan Liang', 'Wen Chou', 'Zhang He', 'Yuan Shao', 'Ju Shou', 'Yuan Shu', 'Gao Lan', 'Tian Feng', 'Chunyu Qiong', 'Feng Ji', 'Shen Pei'],
            lu: ['Lü Bu', 'Gao Shun', 'Zhang Liao', 'Chen Gong', 'Zang Ba', 'Diao Chan', 'Cao Xing', 'Hou Cheng', 'Song Xian', 'Wei Xu', 'Qin Yi']
        };
        return nameMap[kingdomId] || nameMap.wei;
    }
}
