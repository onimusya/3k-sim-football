// TeamManagementScene — bright Kairosoft-style squad HQ.
// All visuals come from the src/art system: sunny sky + grass backdrop, white
// dialog panels with blue title bars, cream list rows, chunky pixel numerals,
// procedural chibi players and a small iso pitch for the formation view.

import { KINGDOMS, generatePlayers, getTeamOverall } from '../data/teams.js';
import { GameStateManager } from '../engine/GameState.js';

import {
    C, KIT, kitFor, statColor, posColor, posGroup,
    STAT_ORDER, STAT_LABEL, LABEL_FONT,
} from '../art/Palette.js';
import { PixelText, measure } from '../art/PixelFont.js';
import { Chibi, lookForPlayer, chibiPortrait } from '../art/Chibi.js';
import * as UI from '../art/UI.js';
import { IsoPitch, formationPositions } from '../art/IsoWorld.js';
import { stadiumBackdrop } from '../art/Backdrop.js';

// ── depth bands ────────────────────────────────────────────────────────────
const D_BG = 0;
const D_PANEL = 10;
const D_PITCH = 20;
const D_FIG = 30;
const D_HUD = 60;
const D_OVERLAY = 300;
const D_TOAST = 400;

// Layout constants for the 960x640 canvas
const L = {
    chipY: 50,
    contentY: 86,
    squad: { x: 14, y: 86, w: 330, h: 482 },
    player: { x: 356, y: 86, w: 590, h: 330 },
    form: { x: 356, y: 426, w: 590, h: 142 },
    btnY: 578,
    btnH: 40,
};

const STAT_ICON = {
    shooting: 'boot',
    pace: 'up',
    passing: 'ball',
    physical: 'shield',
    defense: 'whistle',
    morale: 'heart',
};

const FORMATIONS = ['4-3-3', '4-4-2', '3-5-2', '5-3-2', '3-4-3'];

export class TeamManagementScene extends Phaser.Scene {
    constructor() {
        super({ key: 'TeamManagementScene' });
        this.selectedPlayer = null;
        this.selectedPlayerIndex = -1;
        this.activeTab = null;
        this.tabContainers = {};
        this.playerDots = [];
        this.rosterItems = [];
        this.sortBy = 'overall';
        this.recruitMarket = null;
    }

    // ═══ LIFECYCLE ══════════════════════════════════════════════════════════

    create() {
        this.selectedPlayer = null;
        this.selectedPlayerIndex = -1;
        this.activeTab = null;
        this.tabContainers = {};
        this.playerDots = [];
        this.rosterItems = [];
        this.overlay = null;
        this.figures = [];
        this.detailStatBars = {};

        const { width, height } = this.cameras.main;
        this.W = width;
        this.H = height;

        const gameState = this.registry.get('gameState');
        this.kingdom = KINGDOMS[gameState.playerKingdom.toUpperCase()];
        this.kit = kitFor(this.kingdom.id);

        // Initialize players if not already
        if (!gameState.players) {
            gameState.players = generatePlayers(gameState.playerKingdom);
            this.registry.set('gameState', gameState);
        }

        // Initialize gold if not set
        if (gameState.gold === undefined) {
            gameState.gold = gameState.money || 1500;
            this.registry.set('gameState', gameState);
        }

        if (!gameState.formation) {
            gameState.formation = this.kingdom.formation;
            this.registry.set('gameState', gameState);
        }

        // Initialize recruit market
        if (!this.recruitMarket) {
            this.generateRecruitMarket();
        }

        this.players = gameState.players;

        this.createBackground();
        this.createTopBar();
        this.createHudChips();
        this.createSquadPanel();
        this.createPlayerPanel();
        this.createFormationPanel();
        this.createActionButtons();

        this.selectPlayer(0);
        this.performEntryAnimation();
    }

    update(_time, delta) {
        this.figures.forEach((f) => f.chibi.tick(delta));
        if (this.bgWorld) this.bgWorld.tick(delta);
    }

    /**
     * UI.panel stores its inner rect on `container.body`, which collides with the
     * slot Phaser reserves for a physics body (GameObject.destroy() would call
     * `this.body.destroy()`). Move it to `bodyArea` so panels tear down cleanly.
     */
    makePanel(x, y, w, h, title) {
        const p = UI.panel(this, x, y, w, h, title);
        p.bodyArea = p.bodyRect || p.body;
        if (p.body) delete p.body;
        return p;
    }

    // ═══ BACKGROUND ═════════════════════════════════════════════════════════

    /**
     * A real stadium sits behind the HQ panels: town skyline and terraces peek
     * out under the HUD strip, the mown pitch fills the middle, and the
     * advertising hoarding runs along the bottom margin. A few chibi figures
     * stroll through the gaps the panels leave open.
     */
    createBackground() {
        this.bgWorld = stadiumBackdrop(this, {
            cx: 468, cy: 372, spanX: 940, spanY: 470, shearX: -150, tiltY: 40,
            depth: D_BG,
            strollers: [
                { y: 86, x0: 618, x1: 952, speed: 15 },
                { y: 80, x0: 660, x1: 944, speed: 11, dir: -1 },
                { y: 640, x0: 24, x1: 470, speed: 20 },
                { y: 638, x0: 470, x1: 936, speed: 17, dir: -1 },
                { y: 642, x0: 180, x1: 780, speed: 13 },
            ],
        });
    }

    // ═══ TOP BAR + HUD CHIPS ════════════════════════════════════════════════

    createTopBar() {
        const gameState = this.registry.get('gameState');
        this.topBarUI = UI.topBar(this, 960);
        this.topBarUI.setDepth(D_HUD);
        this.topBarUI.setMoney(gameState.gold);
        this.topBarUI.setDate(gameState.season, 1, gameState.week);

        // Kingdom crest badge sitting in the bar's mascot slot
        const crest = this.add.container(30, this.topBarUI.barH / 2).setDepth(D_HUD + 1);
        const cg = this.add.graphics();
        cg.fillStyle(C.panelEdge, 1);
        cg.fillRoundedRect(-17, -15, 34, 30, 5);
        cg.fillStyle(this.kit.jersey, 1);
        cg.fillRoundedRect(-15, -13, 30, 26, 4);
        cg.fillStyle(0xffffff, 0.28);
        cg.fillRect(-13, -11, 26, 8);
        crest.add(cg);
        crest.add(this.add.text(0, 0, this.kingdom.name.charAt(0), {
            fontFamily: 'serif', fontSize: '17px', color: '#ffffff',
            stroke: '#20202a', strokeThickness: 3,
        }).setOrigin(0.5));
    }

    refreshTopBar() {
        const gameState = this.registry.get('gameState');
        this.topBarUI.setMoney(gameState.gold);
        this.topBarUI.setDate(gameState.season, 1, gameState.week);
    }

    createHudChips() {
        const gameState = this.registry.get('gameState');
        const overall = getTeamOverall(this.players);
        const rep = gameState.reputation !== undefined ? gameState.reputation : 50;
        const trophies = Array.isArray(gameState.trophies) ? gameState.trophies.length : 0;

        this.chipRow = this.add.container(0, 0).setDepth(D_HUD);

        const specs = [
            { icon: 'star', value: overall, key: 'overall' },
            { icon: 'heart', value: rep, key: 'rep' },
            { icon: 'trophy', value: trophies, key: 'trophies' },
            { icon: 'shield', value: this.players.length, key: 'count' },
        ];

        this.chips = {};
        specs.forEach((s, i) => {
            const chip = UI.hudChip(this, 14 + i * 96, L.chipY, s.icon, s.value, { w: 86, h: 28 });
            this.chipRow.add(chip);
            this.chips[s.key] = chip;
        });

        // Kingdom identity to the right of the chips. The backdrop's terrace and
        // crowd run through this band now, so the text gets its own opaque plate.
        const nameLabel = UI.label(this, 410, L.chipY + 1, this.kingdom.fullName, {
            size: 15, bold: true, color: '#123a6b',
        });
        const mottoLabel = UI.label(this, 410, L.chipY + 18, `"${this.kingdom.motto}"`, {
            size: 11, color: '#20486e',
        });

        const plateW = Math.max(nameLabel.width, mottoLabel.width) + 18;
        const plate = this.add.graphics();
        plate.fillStyle(C.panelEdge, 1);
        plate.fillRoundedRect(400, L.chipY - 3, plateW, 36, 6);
        plate.fillStyle(C.panelBody, 1);
        plate.fillRoundedRect(402, L.chipY - 1, plateW - 4, 32, 5);
        plate.fillStyle(0xffffff, 0.55);
        plate.fillRect(405, L.chipY + 2, plateW - 10, 7);
        this.chipRow.add(plate);
        this.chipRow.add(nameLabel);
        this.chipRow.add(mottoLabel);
    }

    refreshChips() {
        const gameState = this.registry.get('gameState');
        this.chips.overall.setValue(getTeamOverall(this.players));
        this.chips.rep.setValue(gameState.reputation !== undefined ? gameState.reputation : 50);
        this.chips.trophies.setValue(Array.isArray(gameState.trophies) ? gameState.trophies.length : 0);
        this.chips.count.setValue(this.players.length);
    }

    // ═══ SQUAD LIST (left column) ═══════════════════════════════════════════

    createSquadPanel() {
        const p = L.squad;
        this.squadPanel = this.makePanel(p.x, p.y, p.w, p.h, 'Squad');
        this.squadPanel.setDepth(D_PANEL);

        this.rosterLayer = this.add.container(0, 0);
        this.squadPanel.add(this.rosterLayer);

        this.renderRoster();
    }

    renderRoster() {
        this.rosterLayer.removeAll(true);
        this.rosterItems = [];

        const rowW = L.squad.w - 20;
        const rowH = 34;
        const step = 39;
        const top = this.squadPanel.bodyArea.y + 8;

        this.players.forEach((player, idx) => {
            const row = UI.listRow(this, this.rosterLayer, 10, top + idx * step, rowW, rowH, {
                alt: idx % 2 === 1,
            });

            row.add(UI.posBadge(this, 6, 6, posGroup(player.pos), posColor(player.pos), { w: 36, h: 22 }));

            let nameX = 50;
            if (player.injured) {
                row.add(this.injuryMark(50, 10));
                nameX = 70;
            }

            row.add(UI.label(this, nameX, rowH / 2, `${player.nameZh} ${player.name}`, {
                size: 12, bold: true, color: '#3a3020', oy: 0.5,
            }));

            const ovr = this.overallOf(player);
            const pt = new PixelText(this, 0, 0, ovr, { scale: 2, preset: 'dark' });
            pt.addTo(row, rowW - 10 - pt.width, (rowH - pt.height) / 2);

            row.hitZone.on('pointerdown', () => this.selectPlayer(idx));
            row.hitZone.on('pointerover', () => { if (idx !== this.selectedPlayerIndex) row.setAlpha(0.88); });
            row.hitZone.on('pointerout', () => row.setAlpha(1));

            row.setSelected(idx === this.selectedPlayerIndex);
            this.rosterItems.push(row);
        });
    }

    /** Small red cross marker for injured players. */
    injuryMark(x, y) {
        const g = this.add.graphics();
        g.setPosition(x, y);
        g.fillStyle(C.panelEdge, 1);
        g.fillRoundedRect(-1, -1, 16, 16, 4);
        g.fillStyle(C.bad, 1);
        g.fillRoundedRect(0, 0, 14, 14, 3);
        g.fillStyle(0xffffff, 1);
        g.fillRect(6, 3, 2, 8);
        g.fillRect(3, 6, 8, 2);
        return g;
    }

    // ═══ PLAYER DETAIL (right column, top) ══════════════════════════════════

    createPlayerPanel() {
        const p = L.player;
        this.playerPanel = this.makePanel(p.x, p.y, p.w, p.h, 'Player');
        this.playerPanel.setDepth(D_PANEL);

        this.detailContent = this.add.container(0, 0);
        this.playerPanel.add(this.detailContent);
    }

    renderDetail() {
        const player = this.selectedPlayer;
        this.detailContent.removeAll(true);
        this.detailStatBars = {};
        if (!player) return;

        const look = lookForPlayer(player, this.kit);
        const ovr = this.overallOf(player);
        const level = Math.max(1, Math.floor(ovr / 10));

        // Portrait
        this.detailPortrait = chibiPortrait(this, 76, 104, look, 84);
        this.detailContent.add(this.detailPortrait);

        // Cream name box — name on the left, identity block on the right so the
        // box is not 230px of empty cream.
        UI.subPanel(this, this.detailContent, 140, 48, 300, 58, {
            color: C.rowCream, edge: C.panelEdge,
        });
        this.detailContent.add(UI.label(this, 152, 52, player.nameZh, {
            size: 21, bold: true, color: '#3a2f18',
        }));
        this.detailContent.add(UI.label(this, 152, 80, player.name, {
            size: 12, bold: true, color: '#6a5a30',
        }));

        // Position group badge now lives in the name box, beside the portrait,
        // instead of dangling under it against the first stat row.
        this.detailContent.add(UI.posBadge(this, 296, 53, posGroup(player.pos), posColor(player.pos), {
            w: 44, h: 22,
        }));
        this.detailContent.add(this.kitChip(348, 53, 26, 22));
        this.detailContent.add(UI.label(this, 296, 80, this.kingdom.fullName, {
            size: 11, bold: true, color: '#5a4a20',
        }));

        // Trait block
        UI.subPanel(this, this.detailContent, 140, 112, 300, 50, {
            color: C.subPanel, edge: C.subPanelEdge,
        });
        this.detailContent.add(UI.icon(this, 155, 126, 'bulb', 15));
        this.detailContent.add(UI.label(this, 168, 117, player.trait, {
            size: 13, bold: true, color: '#1f6b32',
        }));
        this.detailContent.add(UI.label(this, 150, 134, this.getAbilityDescription(player.trait), {
            size: 10, color: '#46554a', wrap: 282,
        }));

        // Overall / level block
        UI.subPanel(this, this.detailContent, 458, 48, 108, 114, {
            color: C.subPanelAlt, edge: C.subPanelEdge,
        });
        this.detailContent.add(UI.label(this, 512, 54, 'OVR', {
            size: 12, bold: true, color: '#123a6b', ox: 0.5,
        }));
        const ovrText = new PixelText(this, 0, 0, ovr, { scale: 5, preset: 'gold' });
        ovrText.addTo(this.detailContent, 512, 96);
        ovrText.setOrigin(0.5, 0.5);

        this.detailContent.add(UI.label(this, 512, 122, 'LEVEL', {
            size: 10, bold: true, color: '#123a6b', ox: 0.5,
        }));
        const lvText = new PixelText(this, 0, 0, level, { scale: 3, preset: 'gold' });
        lvText.addTo(this.detailContent, 512, 146);
        lvText.setOrigin(0.5, 0.5);

        // Six stat bars, driven by STAT_ORDER. barH 26 (the UI default) needs a
        // 40px step: the track frame is barH + 4 tall.
        STAT_ORDER.forEach((key, i) => {
            const col = Math.floor(i / 3);
            const row = i % 3;
            const bar = UI.statBar(this, this.detailContent, 24 + col * 282, 176 + row * 40, {
                labelText: STAT_LABEL[key],
                value: player.stats[key],
                max: 99,
                color: statColor(key),
                barW: 150,
                barH: 26,
                labelW: 54,
                iconKind: STAT_ICON[key],
                animate: true,
                delay: i * 70,
            });
            this.detailStatBars[key] = bar;
        });

        // Condition strip fills the old dead band at the bottom of the panel and
        // carries the injury flag that used to collide with the stat columns.
        this.buildConditionStrip(player);

        this.detailContent.setAlpha(0);
        this.tweens.add({ targets: this.detailContent, alpha: 1, duration: 220, ease: 'Quad.easeOut' });
    }

    /** Small kit swatch used inside the player name box. */
    kitChip(x, y, w, h) {
        const g = this.add.graphics();
        g.setPosition(x, y);
        g.fillStyle(C.panelEdge, 1);
        g.fillRoundedRect(-2, -2, w + 4, h + 4, 4);
        g.fillStyle(this.kit.jersey, 1);
        g.fillRoundedRect(0, 0, w, h, 3);
        g.fillStyle(this.kit.accent, 1);
        g.fillRect(w * 0.36, 0, w * 0.28, h);
        g.fillStyle(0xffffff, 0.3);
        g.fillRect(2, 2, w - 4, Math.max(2, h * 0.3));
        return g;
    }

    /**
     * Morale/condition strip along the bottom of the Player panel. It fills the
     * band the stat rows used to leave empty and hosts the injury flag.
     */
    buildConditionStrip(player) {
        const y = 290;
        const h = 30;
        const cy = y + h / 2;

        UI.subPanel(this, this.detailContent, 24, y, 534, h, {
            color: C.subPanelAlt, edge: C.subPanelEdge,
        });

        this.detailContent.add(UI.icon(this, 42, cy, 'heart', 15));
        this.detailContent.add(UI.label(this, 56, cy, 'FORM', {
            size: 11, bold: true, color: '#123a6b', oy: 0.5,
        }));

        const morale = player.stats.morale;
        const filled = Math.max(1, Math.min(5, Math.round(morale / 20)));
        const pips = this.add.graphics();
        for (let i = 0; i < 5; i++) {
            const px = 100 + i * 16;
            pips.fillStyle(C.panelEdge, 1);
            pips.fillRoundedRect(px - 1, cy - 7, 14, 14, 4);
            pips.fillStyle(i < filled ? (morale >= 70 ? C.good : C.warn) : 0xc7d2c4, 1);
            pips.fillRoundedRect(px, cy - 6, 12, 12, 3);
        }
        this.detailContent.add(pips);

        let tx = 192;
        if (player.injured) {
            this.detailContent.add(this.injuryMark(188, cy - 8));
            tx = 210;
        }
        const note = player.injured
            ? 'Injured — rest to recover'
            : morale >= 78 ? 'Sharp — riding a hot streak'
            : morale >= 55 ? 'Match fit and ready'
            : 'Low spirit — a rest week would help';
        this.detailContent.add(UI.label(this, tx, cy, note, {
            size: 11, bold: true, color: player.injured ? '#b8281c' : '#3a5540', oy: 0.5,
        }));

        this.detailContent.add(UI.label(this, 496, cy, 'SPIRIT', {
            size: 10, bold: true, color: '#123a6b', ox: 1, oy: 0.5,
        }));
        const pt = new PixelText(this, 0, 0, morale, {
            scale: 2, preset: 'dark', originX: 1, originY: 0.5,
        });
        pt.addTo(this.detailContent, 546, cy);
    }

    // ═══ FORMATION VIEW (right column, bottom) ══════════════════════════════

    createFormationPanel() {
        const p = L.form;
        this.formPanel = this.makePanel(p.x, p.y, p.w, p.h, 'Formation');
        this.formPanel.setDepth(D_PANEL);

        // Clip anything the mini pitch draws outside the panel body
        const bodyAbs = {
            x: p.x + 2,
            y: p.y + this.formPanel.bodyArea.y + 2,
            w: p.w - 4,
            h: p.h - this.formPanel.bodyArea.y - 4,
        };
        const maskG = this.make.graphics({ x: 0, y: 0, add: false });
        maskG.fillStyle(0xffffff, 1);
        maskG.fillRect(bodyAbs.x, bodyAbs.y, bodyAbs.w, bodyAbs.h);
        this.formMask = maskG.createGeometryMask();

        this.pitch = new IsoPitch(this, {
            cx: p.x + p.w / 2 + 8,
            cy: 518,
            spanX: 486,
            spanY: 78,
            shearX: -74,
            tiltY: 14,
        });
        this.pitch.drawSurface();
        this.pitch.drawMarkings();
        this.pitch.layers.surface.setDepth(D_PITCH).setMask(this.formMask);
        this.pitch.layers.markings.setDepth(D_PITCH + 1).setMask(this.formMask);

        // Formation readout (numerals via PixelText)
        this.formationText = new PixelText(this, p.x + 12, p.y + this.formPanel.bodyArea.y + 6, '4-3-3', {
            scale: 2, preset: 'dark',
        });
        this.formationText.setDepth(D_PITCH + 2);

        this.renderFormation();
    }

    renderFormation() {
        const gameState = this.registry.get('gameState');
        const formation = gameState.formation || this.kingdom.formation;
        this.formationText.setText(formation);

        // Tear down previous figures
        this.figures.forEach((f) => {
            f.chibi.destroy();
            f.hit.destroy();
        });
        this.figures = [];

        if (this.formMarker) { this.formMarker.destroy(); this.formMarker = null; }

        const spots = formationPositions(formation, 'home');

        // formationPositions keeps a side inside its own half; for this inset we
        // stretch it across the whole mini pitch so the shape reads clearly.
        const minFx = Math.min(...spots.map((s) => s.fx));
        const maxFx = Math.max(...spots.map((s) => s.fx));
        const span = Math.max(0.001, maxFx - minFx);
        const spreadFx = (fx) => 0.07 + ((fx - minFx) / span) * 0.85;

        // Same mapping the old scene used: GK is the LAST roster entry, then the
        // outfield slots walk backwards through the roster.
        let pIdx = this.players.length - 1;

        spots.forEach((spot) => {
            if (pIdx < 0) return;
            const player = this.players[pIdx];
            const idx = pIdx;
            pIdx--;

            const pos = this.pitch.project(spreadFx(spot.fx), spot.fy);
            const look = lookForPlayer(player, this.kit);
            const chibi = new Chibi(this, pos.x, pos.y, { ...look, px: 2 });
            chibi.setScale(0.62);
            chibi.setDepth(D_FIG + spot.fy * 10);
            chibi.container.setMask(this.formMask);
            chibi.setFacing('side', true);

            const hit = this.add.rectangle(pos.x, pos.y - 11, 22, 26, 0x000000, 0)
                .setDepth(D_FIG + 12)
                .setInteractive({ useHandCursor: true });
            hit.on('pointerdown', () => this.selectPlayer(idx));
            hit.on('pointerover', () => chibi.setScale(0.76));
            hit.on('pointerout', () => chibi.setScale(idx === this.selectedPlayerIndex ? 0.72 : 0.62));

            this.figures.push({ chibi, hit, index: idx, fx: spot.fx, fy: spot.fy });
        });

        // Selection marker sits under the chosen figure
        this.formMarker = this.add.graphics().setDepth(D_PITCH + 2).setMask(this.formMask);
        this.formMarker.fillStyle(C.numGold, 0.95);
        this.formMarker.fillEllipse(0, 0, 20, 8);
        this.formMarker.lineStyle(2, C.panelEdge, 1);
        this.formMarker.strokeEllipse(0, 0, 20, 8);
        this.formMarker.setVisible(false);

        this.highlightFormation();
    }

    highlightFormation() {
        if (!this.formMarker) return;
        const f = this.figures.find((x) => x.index === this.selectedPlayerIndex);
        if (!f) { this.formMarker.setVisible(false); return; }
        this.formMarker.setVisible(true);
        this.formMarker.setPosition(f.chibi.x, f.chibi.y + 1);
        this.figures.forEach((x) => x.chibi.setScale(x.index === this.selectedPlayerIndex ? 0.72 : 0.62));
    }

    // ═══ ACTION BUTTONS ═════════════════════════════════════════════════════

    createActionButtons() {
        const blue = { color: C.titleBarTop, colorDark: C.titleBarBot };
        const green = { color: C.hudGreen, colorDark: C.hudGreenDark };
        // Menu used to be slate grey, which read as a disabled button next to six
        // blue ones. It is a live navigation action, so it gets a live colour.
        const indigo = { color: 0x6b6fd8, colorDark: 0x4348a8 };

        const defs = [
            { text: 'Train', style: blue, fn: () => this.openTrainOverlay() },
            { text: 'Recruit', style: blue, fn: () => this.openRecruitOverlay() },
            { text: 'Tactics', style: blue, fn: () => this.openTacticsOverlay() },
            { text: 'Rest', style: blue, fn: () => this.restSquad() },
            { text: 'Play Match', style: green, fn: () => this.handleNavAction('match') },
            { text: 'League', style: blue, fn: () => this.handleNavAction('league') },
            { text: 'Menu', style: indigo, fn: () => this.handleNavAction('menu') },
        ];

        const bw = 124;
        const gap = 10;
        const totalW = defs.length * bw + (defs.length - 1) * gap;
        const startX = (this.W - totalW) / 2;

        this.buttonRow = this.add.container(0, 0).setDepth(D_PANEL + 5);
        defs.forEach((d, i) => {
            const b = UI.button(this, startX + i * (bw + gap), L.btnY, bw, L.btnH, d.text, {
                color: d.style.color,
                colorDark: d.style.colorDark,
                size: 14,
            });
            b.onClick(() => { if (!this.overlay) d.fn(); });
            this.buttonRow.add(b);
        });
    }

    // ═══ SELECTION ══════════════════════════════════════════════════════════

    selectPlayer(index) {
        if (index < 0 || index >= this.players.length) return;
        this.selectedPlayer = this.players[index];
        this.selectedPlayerIndex = index;

        this.rosterItems.forEach((row, i) => row.setSelected(i === index));
        this.highlightFormation();
        this.renderDetail();
    }

    overallOf(player) {
        const s = player.stats;
        return Math.round(
            (s.pace + s.shooting + s.passing + s.defense + s.physical + s.morale) / 6
        );
    }

    // ═══ OVERLAY PLUMBING ═══════════════════════════════════════════════════

    /**
     * Dim the scene and open a bright panel. Clicking the dim area closes it.
     * Returns { layer, panel } — panel coordinates are local to the panel.
     */
    openOverlay(w, h, title) {
        this.closeOverlay();

        const layer = this.add.container(0, 0).setDepth(D_OVERLAY);

        const dim = this.add.rectangle(this.W / 2, this.H / 2, this.W, this.H, 0x101822, 0.58)
            .setInteractive();
        dim.on('pointerdown', () => this.closeOverlay());
        layer.add(dim);
        layer.dimRect = dim;

        const px = Math.round((this.W - w) / 2);
        const py = Math.round((this.H - h) / 2);
        const panel = this.makePanel(px, py, w, h, title);
        layer.add(panel);

        dim.setAlpha(0);
        panel.setAlpha(0);
        panel.y = py + 18;
        this.tweens.add({ targets: dim, alpha: 0.58, duration: 150 });
        this.tweens.add({ targets: panel, alpha: 1, y: py, duration: 240, ease: 'Back.easeOut' });

        layer.panel = panel;
        this.overlay = layer;
        return { layer, panel };
    }

    closeOverlay() {
        if (!this.overlay) return;
        const layer = this.overlay;
        this.overlay = null;
        if (layer.dimRect) layer.dimRect.disableInteractive();
        this.tweens.add({
            targets: layer,
            alpha: 0,
            duration: 150,
            onComplete: () => layer.destroy(),
        });
    }

    /** Small close/cancel button helper for overlays. */
    addCloseButton(panel, x, y, w = 120, h = 34, text = 'Close') {
        const b = UI.button(this, x, y, w, h, text, {
            color: 0x8a93a4, colorDark: 0x5f6878, size: 14,
        });
        b.onClick(() => this.closeOverlay());
        panel.add(b);
        return b;
    }

    // ═══ TRAINING ═══════════════════════════════════════════════════════════

    openTrainOverlay() {
        if (!this.selectedPlayer) {
            this.showNotification('Select a player first!', C.bad);
            return;
        }

        const w = 560, h = 380;
        const { panel } = this.openOverlay(w, h, 'Training');
        const player = this.selectedPlayer;

        panel.add(UI.label(this, w / 2, 46, `${player.nameZh} ${player.name}`, {
            size: 16, bold: true, color: '#123a6b', ox: 0.5,
        }));

        panel.add(UI.label(this, 176, 76, 'Cost', { size: 13, bold: true, color: '#3a3a44' }));
        panel.add(UI.icon(this, 226, 84, 'coin', 18));
        const cost = new PixelText(this, 0, 0, 100, { scale: 3, preset: 'gold' });
        cost.addTo(panel, 240, 74);
        panel.add(UI.label(this, 300, 76, 'Gold', { size: 13, bold: true, color: '#3a3a44' }));

        // Selection highlight that slides behind the chosen stat button
        const marker = this.add.graphics();
        marker.setVisible(false);
        panel.add(marker);

        this.trainSelectedStat = null;
        const btnW = 230, btnH = 40;

        const statButtons = [];
        STAT_ORDER.forEach((key, i) => {
            const col = Math.floor(i / 3);
            const row = i % 3;
            const bx = 24 + col * 282;
            const by = 110 + row * 54;

            const b = UI.button(this, bx, by, btnW, btnH, STAT_LABEL[key], {
                color: statColor(key),
                colorDark: Phaser.Display.Color.ValueToColor(statColor(key)).darken(24).color,
                size: 15,
            });
            b.onClick(() => {
                this.trainSelectedStat = key;
                marker.clear();
                marker.setVisible(true);
                marker.lineStyle(4, C.numGold, 1);
                marker.strokeRoundedRect(bx - 6, by - 6, btnW + 12, btnH + 14, 8);
                selLabel.setText(`Selected: ${STAT_LABEL[key]}  (now ${player.stats[key]})`);
            });
            panel.add(b);
            statButtons.push(b);
        });

        const selLabel = UI.label(this, w / 2, 276, 'Pick a stat to train', {
            size: 14, bold: true, color: '#3a3a44', ox: 0.5,
        });
        panel.add(selLabel);

        const confirm = UI.button(this, 100, 300, 170, 40, 'Train!', {
            color: C.hudGreen, colorDark: C.hudGreenDark, size: 16,
        });
        confirm.onClick(() => this.performTraining());
        panel.add(confirm);

        this.addCloseButton(panel, 290, 300, 170, 40, 'Cancel');
    }

    performTraining() {
        const gameState = this.registry.get('gameState');

        if (!this.selectedPlayer) {
            this.showNotification('Select a player first!', C.bad);
            return;
        }
        if (!this.trainSelectedStat) {
            this.showNotification('Select a stat to train!', C.bad);
            return;
        }
        if (gameState.gold < 100) {
            this.showNotification('Not enough gold! Need 100.', C.bad);
            return;
        }

        // Deduct gold
        gameState.gold -= 100;

        // Calculate boost — 10% chance of critical
        const isCritical = Math.random() < 0.1;
        const boost = isCritical ? 5 : Math.floor(Math.random() * 3) + 1;
        const stat = this.trainSelectedStat;
        const player = this.selectedPlayer;

        player.stats[stat] = Math.min(99, player.stats[stat] + boost);
        gameState.week++;
        this.registry.set('gameState', gameState);

        this.closeOverlay();
        this.refreshTopBar();
        this.refreshChips();
        this.renderRoster();
        this.renderDetail();
        this.celebrateTraining(player, stat, boost, isCritical);
    }

    celebrateTraining(player, stat, boost, isCritical) {
        const fig = this.figures.find((f) => f.index === this.selectedPlayerIndex);

        // Float the gain over the player detail portrait
        const fx = L.player.x + 76;
        const fy = L.player.y + 104;
        UI.floatValue(this, fx, fy - 46, `+${boost}`, {
            preset: isCritical ? 'good' : 'gold',
            scale: isCritical ? 5 : 4,
            rise: 44,
        }).setDepth(D_TOAST);

        // Portrait bounce
        if (this.detailPortrait && this.detailPortrait.chibiImage) {
            const img = this.detailPortrait.chibiImage;
            const baseY = img.y;
            this.tweens.add({
                targets: img, y: baseY - 7, duration: 160,
                yoyo: true, repeat: 2, ease: 'Quad.easeOut',
            });
        }

        // Hop the matching figure on the mini pitch
        if (fig) {
            fig.chibi.hop(this, isCritical ? 14 : 9, isCritical ? 4 : 3);
            UI.floatValue(this, fig.chibi.x, fig.chibi.y - 24, `+${boost}`, {
                preset: isCritical ? 'good' : 'gold', scale: 2, rise: 26,
            }).setDepth(D_FIG + 20);
        }

        if (isCritical) {
            this.particleBurst(fx, fy, C.numGold);
            if (fig) this.particleBurst(fig.chibi.x, fig.chibi.y - 12, C.numGold, 14);
            this.showNotification(`CRITICAL! ${STAT_LABEL[stat]} +5`, C.good);
        } else {
            this.showNotification(`${STAT_LABEL[stat]} +${boost}`, C.titleBarTop);
        }

        // Flash the trained bar
        const bar = this.detailStatBars[stat];
        if (bar) {
            this.tweens.add({
                targets: bar, alpha: 0.35, duration: 110, yoyo: true, repeat: 2,
            });
        }
    }

    particleBurst(x, y, color, count = 24) {
        for (let i = 0; i < count; i++) {
            const p = this.add.circle(x, y, Phaser.Math.Between(2, 5), color)
                .setDepth(D_TOAST + 10);
            this.tweens.add({
                targets: p,
                x: x + Phaser.Math.Between(-90, 90),
                y: y + Phaser.Math.Between(-84, 24),
                alpha: 0,
                scale: 0,
                duration: Phaser.Math.Between(520, 1000),
                ease: 'Quad.easeOut',
                onComplete: () => p.destroy(),
            });
        }
    }

    // ═══ RECRUIT ════════════════════════════════════════════════════════════

    generateRecruitMarket() {
        const gameState = this.registry.get('gameState');
        const playerKingdom = gameState.playerKingdom;

        const allKingdoms = Object.keys(KINGDOMS).map((k) => k.toLowerCase());
        const otherKingdoms = allKingdoms.filter((k) => k !== playerKingdom);

        this.recruitMarket = [];
        for (let i = 0; i < 3; i++) {
            this.recruitMarket.push(this.makeRecruit(otherKingdoms));
        }
    }

    makeRecruit(otherKingdoms) {
        const kingdom = otherKingdoms[Math.floor(Math.random() * otherKingdoms.length)];
        const roster = generatePlayers(kingdom);
        const player = { ...roster[Math.floor(Math.random() * roster.length)] };
        player.stats = { ...player.stats };
        const ovr = this.overallOf(player);
        player.cost = Math.round(ovr * 4 + Math.random() * 100);
        player.fromKingdom = kingdom;
        return player;
    }

    openRecruitOverlay() {
        if (!this.recruitMarket || this.recruitMarket.length === 0) this.generateRecruitMarket();

        const w = 740, h = 470;
        const { panel } = this.openOverlay(w, h, 'Recruit');

        const target = this.selectedPlayer
            ? `${this.selectedPlayer.nameZh} ${this.selectedPlayer.name}`
            : 'nobody selected';
        panel.add(UI.label(this, w / 2, 40, `Signing replaces: ${target}`, {
            size: 13, bold: true, color: '#123a6b', ox: 0.5,
        }));

        const cardW = 220, cardH = 350;
        this.recruitMarket.forEach((recruit, i) => {
            const cx = 20 + i * 240;
            this.buildRecruitCard(panel, cx, 60, cardW, cardH, recruit, i);
        });

        this.addCloseButton(panel, (w - 140) / 2, 424, 140, 34, 'Close');
    }

    buildRecruitCard(panel, cx, cy, cardW, cardH, recruit, index) {
        const gameState = this.registry.get('gameState');
        const kit = kitFor(recruit.fromKingdom || 'wei');
        const look = lookForPlayer(recruit, kit);
        const ovr = this.overallOf(recruit);

        UI.subPanel(this, panel, cx, cy, cardW, cardH, {
            color: C.subPanel, edge: C.subPanelEdge,
        });

        panel.add(chibiPortrait(this, cx + cardW / 2, cy + 48, look, 80));

        panel.add(UI.label(this, cx + cardW / 2, cy + 94, recruit.nameZh, {
            size: 17, bold: true, color: '#2b2b33', ox: 0.5,
        }));
        panel.add(UI.label(this, cx + cardW / 2, cy + 118, recruit.name, {
            size: 11, bold: true, color: '#4a5a4c', ox: 0.5,
        }));

        panel.add(UI.posBadge(this, cx + cardW / 2 - 24, cy + 138,
            posGroup(recruit.pos), posColor(recruit.pos), { w: 48, h: 22 }));

        panel.add(UI.label(this, cx + 46, cy + 170, 'OVR', {
            size: 11, bold: true, color: '#123a6b',
        }));
        const ovrPt = new PixelText(this, 0, 0, ovr, { scale: 3, preset: 'gold' });
        ovrPt.addTo(panel, cx + 84, cy + 164);

        // Mini stat bars — numScale 2 keeps the numerals inside these short bars
        // now that UI.statBar defaults to scale 3.
        ['shooting', 'pace', 'defense'].forEach((key, i) => {
            UI.statBar(this, panel, cx + 12, cy + 198 + i * 28, {
                labelText: STAT_LABEL[key],
                value: recruit.stats[key],
                max: 99,
                color: statColor(key),
                barW: 112,
                barH: 20,
                labelW: 46,
                numScale: 2,
                animate: true,
                delay: 60 + i * 60,
            });
        });

        // Cost
        panel.add(UI.icon(this, cx + 46, cy + 288, 'coin', 18));
        const costPt = new PixelText(this, 0, 0, recruit.cost, {
            scale: 3,
            preset: gameState.gold >= recruit.cost ? 'gold' : 'bad',
        });
        costPt.addTo(panel, cx + 62, cy + 278);

        const affordable = gameState.gold >= recruit.cost;
        const b = UI.button(this, cx + 62, cy + 306, 96, 32, 'Sign', {
            color: affordable ? C.hudGreen : 0x9aa0a6,
            colorDark: affordable ? C.hudGreenDark : 0x6a7076,
            size: 14,
        });
        b.onClick(() => this.recruitPlayer(index));
        panel.add(b);
    }

    recruitPlayer(marketIndex) {
        const gameState = this.registry.get('gameState');
        const recruit = this.recruitMarket[marketIndex];
        if (!recruit) return;

        if (!this.selectedPlayer) {
            this.showNotification('Select a player to replace first!', C.bad);
            return;
        }
        if (gameState.gold < recruit.cost) {
            this.showNotification(`Not enough gold! Need ${recruit.cost}.`, C.bad);
            return;
        }

        gameState.gold -= recruit.cost;
        const newPlayer = {
            name: recruit.name,
            nameZh: recruit.nameZh,
            pos: recruit.pos,
            stats: { ...recruit.stats },
            trait: recruit.trait,
        };
        gameState.players[this.selectedPlayerIndex] = newPlayer;
        this.players = gameState.players;
        this.registry.set('gameState', gameState);

        // Refresh that market slot
        const allKingdoms = Object.keys(KINGDOMS).map((k) => k.toLowerCase());
        const otherKingdoms = allKingdoms.filter((k) => k !== gameState.playerKingdom);
        this.recruitMarket.splice(marketIndex, 1, this.makeRecruit(otherKingdoms));

        this.closeOverlay();
        this.refreshTopBar();
        this.refreshChips();
        this.renderRoster();
        this.renderFormation();
        this.selectPlayer(this.selectedPlayerIndex);
        this.showNotification(`Signed ${newPlayer.nameZh} ${newPlayer.name}!`, C.good);
    }

    // ═══ TACTICS ════════════════════════════════════════════════════════════

    openTacticsOverlay() {
        const w = 520, h = 380;
        const { panel } = this.openOverlay(w, h, 'Tactics');

        const gameState = this.registry.get('gameState');
        const current = gameState.formation || this.kingdom.formation;

        panel.add(UI.label(this, w / 2, 44, `Team style: ${this.kingdom.style.toUpperCase()}`, {
            size: 13, bold: true, color: '#123a6b', ox: 0.5,
        }));

        FORMATIONS.forEach((formation, i) => {
            const bx = 160, by = 72 + i * 46;
            const active = formation === current;
            const b = UI.button(this, bx, by, 200, 38, formation, {
                color: active ? C.numGold : C.titleBarTop,
                colorDark: active ? C.numGoldDark : C.titleBarBot,
                size: 16,
            });
            b.onClick(() => this.applyFormation(formation));
            panel.add(b);

            if (active) {
                const chk = this.add.graphics();
                chk.fillStyle(C.good, 1);
                chk.fillCircle(bx - 22, by + 19, 8);
                chk.lineStyle(2, C.panelEdge, 1);
                chk.strokeCircle(bx - 22, by + 19, 8);
                panel.add(chk);
            }
        });

        panel.add(UI.label(this, w / 2, 306, this.getStyleDescription(this.kingdom.style), {
            size: 11, color: '#46554a', ox: 0.5, align: 'center', wrap: w - 60,
        }));

        this.addCloseButton(panel, (w - 140) / 2, 332, 140, 34, 'Close');
    }

    applyFormation(formation) {
        const gameState = this.registry.get('gameState');
        gameState.formation = formation;
        this.kingdom.formation = formation;
        this.registry.set('gameState', gameState);

        this.closeOverlay();
        this.renderFormation();
        this.showNotification(`Formation set to ${formation}`, C.titleBarTop);
    }

    // ═══ REST ═══════════════════════════════════════════════════════════════

    restSquad() {
        const gameState = this.registry.get('gameState');
        gameState.players.forEach((p) => {
            p.stats.morale = Math.min(99, p.stats.morale + 5);
        });
        gameState.week++;
        this.registry.set('gameState', gameState);
        this.players = gameState.players;

        this.refreshTopBar();
        this.refreshChips();
        this.renderRoster();
        this.renderDetail();

        const w = 460, h = 250;
        const { panel } = this.openOverlay(w, h, 'Rest');

        panel.add(UI.icon(this, w / 2, 72, 'heart', 32));
        panel.add(UI.label(this, w / 2, 96, 'The squad rested for a week.', {
            size: 15, bold: true, color: '#123a6b', ox: 0.5,
        }));

        const plus = new PixelText(this, 0, 0, '+5', { scale: 4, preset: 'good' });
        plus.addTo(panel, w / 2, 126);
        plus.setOrigin(0.5, 0);
        panel.add(UI.label(this, w / 2, 164, 'Spirit for everyone', {
            size: 13, bold: true, color: '#1f6b32', ox: 0.5,
        }));

        this.addCloseButton(panel, (w - 150) / 2, 194, 150, 36, 'Nice!');

        this.figures.forEach((f, i) => {
            this.time.delayedCall(i * 55, () => f.chibi.hop(this, 7, 1));
        });
    }

    // ═══ NAVIGATION ═════════════════════════════════════════════════════════

    handleNavAction(action) {
        if (action === 'match') {
            // Roll random event before match
            const gameState = this.registry.get('gameState');
            GameStateManager.initializeState(this.registry);
            const event = GameStateManager.rollRandomEvent(gameState);
            this.registry.set('gameState', gameState);

            if (event && !event.requiresDecision) {
                // Show event notification briefly, then start match
                this.showEventOverlay(event, () => {
                    this.cameras.main.fadeOut(300, 0, 0, 0);
                    this.cameras.main.once('camerafadeoutcomplete', () => {
                        this.scene.start('MatchDayScene');
                    });
                });
                return;
            } else if (event && event.requiresDecision) {
                // Show decision event
                this.showDecisionEvent(event, () => {
                    this.cameras.main.fadeOut(300, 0, 0, 0);
                    this.cameras.main.once('camerafadeoutcomplete', () => {
                        this.scene.start('MatchDayScene');
                    });
                });
                return;
            }
        }

        // Fade out transition
        this.cameras.main.fadeOut(300, 0, 0, 0);
        this.cameras.main.once('camerafadeoutcomplete', () => {
            switch (action) {
                case 'match':
                    this.scene.start('MatchDayScene');
                    break;
                case 'league':
                    this.scene.start('LeagueScene');
                    break;
                case 'menu':
                    this.scene.start('MainMenuScene');
                    break;
            }
        });
    }

    showEventOverlay(event, callback) {
        const { W, H } = this;
        const w = 460, h = 260;

        const layer = this.add.container(0, 0).setDepth(D_OVERLAY + 20);

        const dim = this.add.rectangle(W / 2, H / 2, W, H, 0x101822, 0.7).setInteractive();
        layer.add(dim);

        const px = Math.round((W - w) / 2);
        const py = Math.round((H - h) / 2);
        const panel = this.makePanel(px, py, w, h, 'Event');
        layer.add(panel);

        panel.add(UI.label(this, w / 2, 50, event.title, {
            size: 18, bold: true, color: '#123a6b', ox: 0.5, align: 'center', wrap: w - 40,
        }));

        UI.subPanel(this, panel, 24, 90, w - 48, 96, {
            color: C.subPanel, edge: C.subPanelEdge,
        });
        panel.add(UI.label(this, w / 2, 100, event.text, {
            size: 13, color: '#33403a', ox: 0.5, align: 'center', wrap: w - 72,
        }));

        const hint = UI.label(this, w / 2, 208, 'Click to continue', {
            size: 12, bold: true, color: '#5a6a72', ox: 0.5,
        });
        panel.add(hint);
        this.tweens.add({ targets: hint, alpha: 0.35, duration: 600, yoyo: true, repeat: -1 });

        dim.setAlpha(0);
        panel.setAlpha(0);
        panel.y = py + 18;
        this.tweens.add({ targets: dim, alpha: 0.7, duration: 200 });
        this.tweens.add({ targets: panel, alpha: 1, y: py, duration: 320, ease: 'Back.easeOut' });

        this.input.once('pointerdown', () => {
            this.tweens.add({
                targets: layer,
                alpha: 0,
                duration: 260,
                onComplete: () => {
                    layer.destroy();
                    callback();
                },
            });
        });
    }

    showDecisionEvent(event, callback) {
        const { W, H } = this;
        const w = 500, h = 300;

        const layer = this.add.container(0, 0).setDepth(D_OVERLAY + 20);

        const dim = this.add.rectangle(W / 2, H / 2, W, H, 0x101822, 0.75).setInteractive();
        layer.add(dim);

        const px = Math.round((W - w) / 2);
        const py = Math.round((H - h) / 2);
        const panel = this.makePanel(px, py, w, h, 'Decision');
        layer.add(panel);

        panel.add(UI.label(this, w / 2, 48, event.title, {
            size: 18, bold: true, color: '#a34a10', ox: 0.5, align: 'center', wrap: w - 40,
        }));

        UI.subPanel(this, panel, 24, 88, w - 48, 100, {
            color: C.rowCream, edge: C.panelEdge,
        });
        panel.add(UI.label(this, w / 2, 98, event.text, {
            size: 13, color: '#3a3020', ox: 0.5, align: 'center', wrap: w - 72,
        }));

        dim.setAlpha(0);
        panel.setAlpha(0);
        panel.y = py + 18;
        this.tweens.add({ targets: dim, alpha: 0.75, duration: 200 });
        this.tweens.add({ targets: panel, alpha: 1, y: py, duration: 320, ease: 'Back.easeOut' });

        let done = false;
        const dismiss = () => {
            if (done) return;
            done = true;
            dim.disableInteractive();
            this.tweens.add({
                targets: layer,
                alpha: 0,
                duration: 260,
                onComplete: () => {
                    layer.destroy();
                    callback();
                },
            });
        };

        const accept = UI.button(this, 60, 206, 170, 42, 'Accept', {
            color: C.hudGreen, colorDark: C.hudGreenDark, size: 16,
        });
        accept.onClick(() => {
            const gameState = this.registry.get('gameState');
            if (event.id === 'rival_poach') {
                if (gameState.gold >= 300) {
                    gameState.gold -= 300;
                } else {
                    // Can't afford, lose the player
                    const idx = gameState.players.findIndex((p) => p.name === event.player.name);
                    if (idx >= 0) {
                        const replacements = generatePlayers('yuan');
                        gameState.players[idx] = replacements[Math.floor(Math.random() * replacements.length)];
                    }
                }
            } else if (event.id === 'challenge_match') {
                gameState.challengeMatch = true;
            }
            this.registry.set('gameState', gameState);
            dismiss();
        });
        panel.add(accept);

        const decline = UI.button(this, 270, 206, 170, 42, 'Decline', {
            color: C.bad, colorDark: 0xa8281c, size: 16,
        });
        decline.onClick(() => {
            const gameState = this.registry.get('gameState');
            if (event.id === 'rival_poach') {
                // Lose the player
                const idx = gameState.players.findIndex((p) => p.name === event.player.name);
                if (idx >= 0) {
                    const replacements = generatePlayers('yuan');
                    gameState.players[idx] = replacements[Math.floor(Math.random() * replacements.length)];
                }
            }
            this.registry.set('gameState', gameState);
            dismiss();
        });
        panel.add(decline);
    }

    // ═══ ENTRY ANIMATION ════════════════════════════════════════════════════

    performEntryAnimation() {
        const groups = [
            this.topBarUI,
            this.chipRow,
            this.squadPanel,
            this.playerPanel,
            this.formPanel,
            this.buttonRow,
        ];

        groups.forEach((el, i) => {
            if (!el) return;
            const baseY = el.y;
            el.setAlpha(0);
            el.y = baseY + 14;
            this.tweens.add({
                targets: el,
                alpha: 1,
                y: baseY,
                duration: 320,
                delay: i * 70,
                ease: 'Quad.easeOut',
            });
        });
    }

    // ═══ UTILITY ════════════════════════════════════════════════════════════

    showNotification(message, color) {
        if (this.toast) { this.toast.destroy(); this.toast = null; }

        const tint = typeof color === 'number'
            ? color
            : Phaser.Display.Color.HexStringToColor(color || '#2f7fd8').color;

        const container = this.add.container(this.W / 2, 306).setDepth(D_TOAST);
        this.toast = container;

        const text = this.add.text(0, 0, message, {
            fontFamily: LABEL_FONT,
            fontSize: '15px',
            color: '#ffffff',
            fontStyle: 'bold',
            stroke: '#20202a',
            strokeThickness: 3,
        }).setOrigin(0.5);

        const w = Math.max(180, text.width + 44);
        const h = 38;

        const g = this.add.graphics();
        g.fillStyle(C.panelEdge, 1);
        g.fillRoundedRect(-w / 2 - 2, -h / 2 - 2, w + 4, h + 4, 8);
        g.fillStyle(tint, 1);
        g.fillRoundedRect(-w / 2, -h / 2, w, h, 6);
        g.fillStyle(0xffffff, 0.3);
        g.fillRect(-w / 2 + 3, -h / 2 + 3, w - 6, 9);
        container.add(g);
        container.add(text);

        container.setScale(0.85);
        this.tweens.add({ targets: container, scale: 1, duration: 200, ease: 'Back.easeOut' });
        this.tweens.add({
            targets: container,
            alpha: 0,
            y: 274,
            duration: 700,
            delay: 1300,
            ease: 'Quad.easeIn',
            onComplete: () => {
                if (this.toast === container) this.toast = null;
                container.destroy();
            },
        });
    }

    getPositionColor(pos) {
        return '#' + posColor(pos).toString(16).padStart(6, '0');
    }

    getAbilityDescription(trait) {
        const abilities = {
            'Strategist': 'Boosts passing accuracy of nearby teammates by 10% in matches.',
            'Iron Will': 'Cannot be injured. Morale never drops below 60.',
            'Berserker': 'Shooting +15 when team is losing. Physical never fatigues.',
            'Tiger Guard': 'Adjacent defenders gain +5 defense during matches.',
            'Lightning Raid': 'Double chance of successful counterattacks.',
            'Axe Master': 'Tackles have 80% success rate regardless of opponent pace.',
            'Graceful': 'Dribbling ignores first defender. +10 pace in final third.',
            'Fortress': 'Penalty area defense boosted by 20%.',
            'Oracle': 'Team gains +5% possession in first half.',
            'Patience': 'Second half passing accuracy increased by 15%.',
            'Heir': 'Saves gain +10% in high-pressure moments.',
            'Benevolence': 'All teammates gain +3 morale per match.',
            'God of War': 'Cannot be dribbled past. Aerial duels always won.',
            'Thunderbolt': 'Long shots have 2x accuracy. Intimidates nearby opponents.',
            'Dragon': 'All stats +5 when morale is above 90.',
            'Sleeping Dragon': 'Creates 2 extra chances per match through vision.',
            'Splendor': 'Pace +10 on flanks. Crosses are pinpoint accurate.',
            'Veteran Archer': 'Free kicks and long shots have elite accuracy.',
            'Rebel Spirit': 'Gains +10 all stats when team is losing.',
            'Heir of Stars': 'Inherits formation bonuses at double rate.',
            'Phoenix': 'Creates unpredictable plays that confuse defenders.',
            'Sharp Mind': 'Distribution from goal kicks reaches midfield 90% of time.',
            'Tiger of Jiang Dong': 'Scores 2x in first 15 minutes of each half.',
            'Little Conqueror': 'Speed cannot be matched — outpaces all defenders.',
            'Ruler': 'Team organization +10%. Less likely to concede from set pieces.',
            'Fire Tactician': 'Set piece delivery is world class. Corner success +30%.',
            'Young Genius': 'Adapts to opponent weakness mid-match.',
            'Pirate King': 'Surprise runs from deep create unmarked chances.',
            'Loyal Archer': 'Long range passing and shooting accuracy +20%.',
            'Fire Ship': 'Last-ditch tackles always succeed. Yellow card immune.',
            'Scholar General': 'Reads the game — interceptions doubled.',
            'Snow Warrior': 'Performance unaffected by morale drops.',
            'Scarred Guardian': 'Saves shots that would be goals. Last line +25%.',
            'Tyrant': 'Forces opponents to lose morale on goals scored.',
            'Raider': 'Fast breaks have guaranteed final pass accuracy.',
            'Cutthroat': 'Finishes all 1v1 chances against keeper.',
            'Gate Breaker': 'Headers from corners always on target.',
            'Dark Counsel': 'Opponents in zone lose 5% passing accuracy.',
            'Nomad': 'Can play any midfield position without penalty.',
            'Horseman': 'Wing play speed doubled. Cross delivery elite.',
            'Loyal Brute': 'Blocks shots in penalty area at 90% rate.',
            'Ambusher': 'Tackles from behind never foul.',
            'Poisoned Mind': 'Opposing midfield loses 3% accuracy over time.',
            'Loyalist': 'Morale boost to entire team when making saves.',
            'Noble Birth': 'Team starts with +5% possession advantage.',
            'False Emperor': 'Flashy plays but 20% chance of losing ball.',
            'Vanguard': 'First attacker on every counterattack. +10 pace on breaks.',
            'Fearless': 'Never intimidated. Performs same vs any opposition.',
            'Stalwart': 'Defensive line holds — offside trap success +30%.',
            'Ignored Counsel': 'Passing lanes created even when team ignores plan.',
            'Unheeded': 'Creates chances others waste. Assist potential +20%.',
            'Drunkard': 'Unpredictable saves — either brilliant or terrible.',
            'Schemer': 'Defensive positioning covers for teammates mistakes.',
            'Defender of Ye': 'Last man standing — performance spikes when losing.',
            'Unrivaled': 'All offensive stats +10. Cannot be stopped 1v1.',
            'Loyal Advisor': 'Team tactics effectiveness doubled.',
            'Camp Breaker': 'Set piece defense impenetrable. Headers cleared.',
            'Defector': 'Gains form faster than other players.',
            'Bandit King': 'Ball stealing from opponents at 2x rate.',
            'Traitor': 'Underperforms in high morale; excels in chaos.',
            'Opportunist': 'Positioning exploits gaps left by attackers.',
            'Turncoat': 'Random performance — genius or invisible.',
            'Enchantress': 'Opposing defenders hesitate, creating 1-sec advantage.',
            'Eye Shot': 'Long range shots curve unpredictably.',
            'Unknown Hero': 'Random match events favor this goalkeeper.',
        };
        return abilities[trait] || 'A unique warrior ability that manifests in battle.';
    }

    getStyleDescription(style) {
        const descriptions = {
            'tactical': 'Emphasizes positional play and intelligent passing. Strong midfield control with calculated attacks.',
            'balanced': 'Adapts to opponent weaknesses. Solid in all areas with no exploitable gaps.',
            'aggressive': 'High press, fast transitions, and relentless attacking. Takes risks for rewards.',
            'defensive': 'Compact shape, absorbs pressure, and strikes on the counter.',
            'possession': 'Patient build-up with high passing accuracy. Controls tempo of the match.',
            'counter-attack': 'Baits opponents forward then explodes with devastating speed on the break.',
        };
        return descriptions[style] || 'A unique tactical approach.';
    }
}
