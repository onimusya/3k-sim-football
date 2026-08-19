// MainMenuScene — bright, sunny, Kairosoft-style title screen.
// Sunny iso stadium backdrop, chibi players kicking a ball around, and six
// kingdom cards you pick from to start a save.

import { KINGDOMS, generatePlayers, getTeamOverall } from '../data/teams.js';

import { C, KIT, kitFor } from '../art/Palette.js';
import { PixelText } from '../art/PixelFont.js';
import { Chibi, lookForPlayer, chibiPortrait } from '../art/Chibi.js';
import * as UI from '../art/UI.js';
import { IsoPitch } from '../art/IsoWorld.js';
import { SaveGame } from '../engine/SaveGame.js';

// Depth bands. The pitch owns 0..9000 (sky 0 → near hoarding 9000).
const D = {
    cloud: 1,
    sparkle: 30,
    ballShadow: 8090,
    ball: 8100,
    hud: 12000,
    card: 13000,
    flash: 14000,
};

// Layout constants (canvas is 960x640)
const CARD_W = 142;
const CARD_H = 208;
const CARD_TOP = 232;
const CARD_GAP = 12;

// Field-space box the background players are allowed to roam in. Kept in the
// near half so they stay visible below the kingdom cards.
const ROAM = { fx0: 0.14, fx1: 0.88, fy0: 0.57, fy1: 0.95 };

export class MainMenuScene extends Phaser.Scene {
    constructor() {
        super({ key: 'MainMenuScene' });
        this.kingdomCards = [];
        this.actors = [];
        this.locked = false;
    }

    create() {
        const { width, height } = this.cameras.main;

        this.locked = false;
        this.kingdomCards = [];
        this.actors = [];

        // 1 ── sunny stadium backdrop, sitting low so the top half is sky
        this.pitch = new IsoPitch(this, {
            cx: width / 2,
            cy: 480,
            spanX: 900,
            spanY: 250,
        });
        this.pitch.build();

        // 8 ── ambient polish in the sky
        this.createClouds(width);
        this.createSparkles(width);

        // 2 ── chibis kicking a ball about on the grass
        this.createPitchPlayers();

        // 3 & 4 ── title block
        this.createTitle(width);

        // 5 ── kingdom selection cards
        this.createKingdomCards(width);

        // 7 ── start hint + version line
        this.createFooter(width, height);

        this.playIntro();

        // If there's a campaign on disk, offer to resume it before anything else.
        const summary = SaveGame.summary();
        if (summary) this.showResumePanel(width, height, summary);
    }

    // ─────────────────────────────────────────────
    // RESUME A SAVED CAMPAIGN
    // ─────────────────────────────────────────────
    showResumePanel(width, height, s) {
        const kingdom = KINGDOMS[String(s.kingdom).toUpperCase()];
        if (!kingdom) return;
        const kit = kitFor(kingdom.id);

        this.locked = true;   // don't let a stray card click start a new game

        const layer = this.add.container(0, 0).setDepth(D.flash + 100);

        const dim = this.add.rectangle(width / 2, height / 2, width, height, 0x0d1f2a, 0.55)
            .setInteractive();
        layer.add(dim);

        const pw = 440, ph = 300;
        const px = (width - pw) / 2, py = (height - ph) / 2;
        const panel = UI.panel(this, px, py, pw, ph, 'Welcome Back');
        layer.add(panel);

        // Who you were playing as
        panel.add(chibiPortrait(this, 70, 84, lookForPlayer({ name: kingdom.fullName }, kit), 62));
        panel.add(UI.label(this, 118, 64, kingdom.fullName, {
            size: 18, bold: true, color: '#123a6b',
        }));
        panel.add(UI.label(this, 118, 88, `"${kingdom.motto}"`, {
            size: 11, color: '#5a6a72',
        }));

        // Campaign digest — numbers as pixel text, as everywhere else
        UI.subPanel(this, panel, 18, 122, pw - 36, 84, {
            color: C.subPanel, edge: C.subPanelEdge,
        });
        const stat = (col, label, value, preset = 'gold') => {
            panel.add(UI.label(this, col, 132, label, {
                size: 10, bold: true, color: '#4a5a50', ox: 0.5,
            }));
            const pt = new PixelText(this, 0, 0, value, { scale: 3, preset });
            pt.setOrigin(0.5, 0);
            pt.addTo(panel, col, 150);
        };
        stat(74, 'SEASON', s.season);
        stat(166, 'WEEK', s.week);
        stat(262, 'GOLD', s.gold);
        stat(360, 'CUPS', s.trophies, s.trophies > 0 ? 'gold' : 'dark');

        panel.add(UI.label(this, pw / 2, 182, `Squad of ${s.squadSize} warriors`, {
            size: 11, color: '#4a5a50', ox: 0.5,
        }));

        // Continue
        const cont = UI.button(this, 18, 222, 194, 44, 'Continue', {
            color: C.hudGreen, colorDark: C.hudGreenDark, size: 17,
        });
        cont.onClick(() => this.resumeSavedGame(layer));
        panel.add(cont);

        // New game — destructive, so it asks first
        const fresh = UI.button(this, pw - 212, 222, 194, 44, 'New Game', {
            color: 0x8a93a4, colorDark: 0x5f6878, size: 17,
        });
        fresh.onClick(() => this.confirmNewGame(layer, width, height));
        panel.add(fresh);

        layer.setAlpha(0);
        this.tweens.add({ targets: layer, alpha: 1, duration: 300, delay: 260 });
        this.resumeLayer = layer;
    }

    resumeSavedGame(layer) {
        if (!SaveGame.applyTo(this.registry)) {
            // Save vanished or failed validation between menu build and click
            this.dismissResume(layer);
            return;
        }
        import('../engine/AudioManager.js').then(({ audioManager }) => {
            audioManager.init();
            audioManager.playWarDrum();
        });
        const st = this.registry.get('gameState');
        const kit = kitFor(st.playerKingdom);
        this.cameras.main.flash(360,
            (kit.jersey >> 16) & 0xff, (kit.jersey >> 8) & 0xff, kit.jersey & 0xff);
        this.time.delayedCall(420, () => this.scene.start('TeamManagementScene'));
    }

    /** Starting over wipes the save, so make the player confirm it. */
    confirmNewGame(layer, width, height) {
        const ask = this.add.container(0, 0).setDepth(D.flash + 200);
        const dim = this.add.rectangle(width / 2, height / 2, width, height, 0x0d1f2a, 0.5)
            .setInteractive();
        ask.add(dim);

        // Both panels are centred, so leaving the resume panel at full opacity
        // makes this one look like a rendering glitch nested inside it. Push the
        // parent back while the question is on screen.
        this.tweens.add({ targets: layer, alpha: 0.12, duration: 180 });

        const pw = 380, ph = 190;
        const panel = UI.panel(this, (width - pw) / 2, (height - ph) / 2, pw, ph, 'Start Over?');
        ask.add(panel);

        panel.add(UI.label(this, pw / 2, 54, 'This deletes your saved campaign.', {
            size: 13, bold: true, color: '#a3341c', ox: 0.5,
        }));
        panel.add(UI.label(this, pw / 2, 76, 'Season progress, squad and trophies\nwill be lost for good.', {
            size: 11, color: '#4a4a55', ox: 0.5, align: 'center',
        }));

        const yes = UI.button(this, 20, 122, 160, 42, 'Delete & Start', {
            color: C.bad, colorDark: 0xa8281c, size: 15,
        });
        yes.onClick(() => {
            SaveGame.clear();
            this.registry.set('hasSavedGame', false);
            ask.destroy();
            this.dismissResume(layer);
        });
        panel.add(yes);

        const no = UI.button(this, pw - 180, 122, 160, 42, 'Keep Save', {
            color: C.titleBarTop, colorDark: C.titleBarBot, size: 15,
        });
        no.onClick(() => {
            ask.destroy();
            if (layer.active) this.tweens.add({ targets: layer, alpha: 1, duration: 180 });
        });
        panel.add(no);

        ask.setAlpha(0);
        this.tweens.add({ targets: ask, alpha: 1, duration: 180 });
    }

    dismissResume(layer) {
        // confirmNewGame may still be fading this layer back; that tween would
        // fight the fade-out and leave the panel half visible.
        this.tweens.killTweensOf(layer);
        this.tweens.add({
            targets: layer,
            alpha: 0,
            duration: 220,
            onComplete: () => {
                layer.destroy();
                this.locked = false;   // kingdom cards become live again
            },
        });
    }

    // ─────────────────────────────────────────────
    // SKY POLISH
    // ─────────────────────────────────────────────
    createClouds(width) {
        const horizon = this.pitch.horizonY || 250;

        for (let i = 0; i < 6; i++) {
            const g = this.add.graphics();
            const s = 0.7 + Math.random() * 0.9;

            g.fillStyle(0xffffff, 0.92);
            g.fillCircle(0, 0, 15 * s);
            g.fillCircle(18 * s, 4 * s, 11 * s);
            g.fillCircle(-18 * s, 5 * s, 10 * s);
            g.fillEllipse(0, 9 * s, 64 * s, 14 * s);
            g.fillStyle(0xdaf0fb, 0.9);
            g.fillEllipse(0, 13 * s, 58 * s, 7 * s);

            const y = 26 + Math.random() * Math.max(40, horizon - 90);
            g.setPosition(Math.random() * (width + 200) - 100, y);
            g.setDepth(D.cloud);

            const span = width + 260;
            const speed = 26 + Math.random() * 22;   // px per second
            this.tweens.add({
                targets: g,
                x: g.x + span,
                duration: (span / speed) * 1000,
                ease: 'Linear',
                repeat: -1,
                onRepeat: () => {
                    g.x = -140;
                    g.y = 26 + Math.random() * Math.max(40, horizon - 90);
                },
            });
        }
    }

    createSparkles(width) {
        const horizon = this.pitch.horizonY || 250;

        for (let i = 0; i < 9; i++) {
            const x = 30 + Math.random() * (width - 60);
            const y = 30 + Math.random() * Math.max(60, horizon - 70);
            const star = UI.icon(this, x, y, 'star', 9 + Math.random() * 6);
            star.setDepth(D.sparkle);
            star.setAlpha(0.25);

            this.tweens.add({
                targets: star,
                alpha: { from: 0.2, to: 1 },
                scaleX: { from: 0.7, to: 1.15 },
                scaleY: { from: 0.7, to: 1.15 },
                angle: 90,
                duration: 1100 + Math.random() * 1400,
                delay: Math.random() * 2200,
                yoyo: true,
                repeat: -1,
                ease: 'Sine.easeInOut',
            });
        }
    }

    // ─────────────────────────────────────────────
    // BACKGROUND KICKABOUT
    // ─────────────────────────────────────────────
    createPitchPlayers() {
        const kits = [KIT.shu, KIT.wei, KIT.wu, KIT.yuan, KIT.dong];
        // Each player keeps to their own patch of grass and only breaks off to
        // chase the ball when it comes near — keeps them spread out.
        const spots = [
            [0.20, 0.66], [0.38, 0.90], [0.56, 0.62], [0.74, 0.88], [0.88, 0.70],
        ];

        spots.forEach(([fx, fy], i) => {
            const kit = kits[i % kits.length];
            const look = lookForPlayer({ name: 'Kickabout ' + i }, kit);
            const chibi = new Chibi(this, 0, 0, { ...look, px: 2 });
            const p = this.pitch.project(fx, fy);
            chibi.setPosition(p.x, p.y);
            chibi.setDepth(this.pitch.depthAt(fx, fy));

            this.actors.push({
                chibi,
                fx,
                fy,
                hx: fx,
                hy: fy,
                speed: 0.085 + Math.random() * 0.05,   // field units per second
                reach: 0.24 + Math.random() * 0.1,     // how far they'll chase
                cooldown: 0,
            });
        });

        // The ball
        this.ballF = { fx: 0.5, fy: 0.74, tx: 0.5, ty: 0.74, speed: 0.5, travelled: 0, total: 1, air: 0 };
        this.ballShadow = this.add.ellipse(0, 0, 12, 5, 0x000000, 0.26).setDepth(D.ballShadow);
        this.ball = UI.icon(this, 0, 0, 'ball', 15).setDepth(D.ball);
        this.pickBallTarget();
    }

    pickBallTarget() {
        const b = this.ballF;

        // Aim near one of the players so the kickabout keeps going
        const pool = this.actors.filter((a) => Math.hypot(a.hx - b.fx, a.hy - b.fy) > 0.12);
        const aim = pool.length
            ? pool[Math.floor(Math.random() * pool.length)]
            : this.actors[Math.floor(Math.random() * this.actors.length)];

        if (aim) {
            b.tx = aim.hx + (Math.random() - 0.5) * 0.1;
            b.ty = aim.hy + (Math.random() - 0.5) * 0.08;
        } else {
            b.tx = ROAM.fx0 + Math.random() * (ROAM.fx1 - ROAM.fx0);
            b.ty = ROAM.fy0 + Math.random() * (ROAM.fy1 - ROAM.fy0);
        }
        b.tx = Math.max(ROAM.fx0, Math.min(ROAM.fx1, b.tx));
        b.ty = Math.max(ROAM.fy0, Math.min(ROAM.fy1, b.ty));
        b.total = Math.max(0.05, Math.hypot(b.tx - b.fx, b.ty - b.fy));
        b.travelled = 0;
        b.speed = 0.34 + Math.random() * 0.3;
    }

    update(time, delta) {
        if (!this.pitch || !this.ballF) return;

        const dt = Math.min(delta, 60) / 1000;
        const b = this.ballF;

        // Ball glides toward its target, arcing gently as it goes
        const dx = b.tx - b.fx;
        const dy = b.ty - b.fy;
        const dist = Math.hypot(dx, dy);
        if (dist < 0.012) {
            this.pickBallTarget();
        } else {
            const step = Math.min(dist, b.speed * dt);
            b.fx += (dx / dist) * step;
            b.fy += (dy / dist) * step;
            b.travelled += step;
        }
        const t = Math.max(0, Math.min(1, b.travelled / b.total));
        b.air = Math.sin(t * Math.PI) * 18;

        const bp = this.pitch.ballPos(b.fx, b.fy, b.air);
        this.ball.setPosition(bp.x, bp.y);
        this.ball.setDepth(this.pitch.depthAt(b.fx, b.fy) + 6);
        this.ballShadow.setPosition(bp.x, bp.groundY);
        this.ballShadow.setScale(1 - b.air / 60);
        this.ballShadow.setDepth(this.pitch.depthAt(b.fx, b.fy) + 4);

        // Players chase the ball when it drifts into their patch, otherwise
        // they stroll back to it. Whoever reaches it boots it somewhere new.
        this.actors.forEach((a) => {
            a.cooldown = Math.max(0, a.cooldown - delta);

            const inRange = Math.hypot(b.fx - a.hx, b.fy - a.hy) < a.reach;
            const gx = inRange ? b.fx : a.hx;
            const gy = inRange ? b.fy : a.hy;

            const adx = gx - a.fx;
            const ady = gy - a.fy;
            const ad = Math.hypot(adx, ady);

            if (ad > 0.02) {
                const step = Math.min(ad, a.speed * dt);
                a.fx = Math.max(ROAM.fx0, Math.min(ROAM.fx1, a.fx + (adx / ad) * step));
                a.fy = Math.max(ROAM.fy0, Math.min(ROAM.fy1, a.fy + (ady / ad) * step));
                a.chibi.setWalking(true);
                a.chibi.faceVector(adx, ady);
            } else {
                a.chibi.setWalking(false);
            }

            // Kick when close enough and the ball is back on the deck
            if (inRange && a.cooldown <= 0 && b.air < 6
                && Math.hypot(b.fx - a.fx, b.fy - a.fy) < 0.055) {
                a.cooldown = 900;
                a.chibi.hop(this, 8, 1);
                this.pickBallTarget();
            }

            const p = this.pitch.project(a.fx, a.fy);
            a.chibi.setPosition(p.x, p.y);
            a.chibi.setDepth(this.pitch.depthAt(a.fx, a.fy));
            a.chibi.tick(delta);
        });
    }

    // ─────────────────────────────────────────────
    // TITLE BLOCK
    // ─────────────────────────────────────────────
    createTitle(width) {
        const cx = width / 2;

        this.titleZh = this.add.text(cx, 76, '三國蹴鞠', {
            fontSize: '78px',
            fontFamily: 'Georgia, "Times New Roman", serif',
            color: '#ffffff',
            stroke: '#2b2b33',
            strokeThickness: 11,
            shadow: { offsetX: 0, offsetY: 7, color: '#1b3350', blur: 0, fill: true },
        }).setOrigin(0.5).setDepth(D.hud);

        this.titleEn = new PixelText(this, cx, 128, 'THREE KINGDOMS SOCCER', {
            scale: 4,
            preset: 'gold',
        });
        this.titleEn.setOrigin(0.5, 0).setDepth(D.hud);

        // Cream tagline plate
        const tagText = 'Conquer the pitch. Unite the kingdoms.';
        const tag = UI.label(this, cx, 178, tagText, {
            size: 16, bold: true, color: '#4a3a10', ox: 0.5, oy: 0.5,
        });
        tag.setDepth(D.hud + 1);

        const plateW = Math.ceil(tag.width) + 46;
        const plateH = 32;
        const plate = this.add.graphics().setDepth(D.hud);
        plate.fillStyle(C.panelEdge, 1);
        plate.fillRoundedRect(cx - plateW / 2 - 3, 178 - plateH / 2 - 3, plateW + 6, plateH + 6, 9);
        plate.fillStyle(C.rowCream, 1);
        plate.fillRoundedRect(cx - plateW / 2, 178 - plateH / 2, plateW, plateH, 7);
        plate.fillStyle(0xffffff, 0.42);
        plate.fillRect(cx - plateW / 2 + 4, 178 - plateH / 2 + 4, plateW - 8, 6);

        this.titleGroup = [this.titleZh, this.titleEn.gfx, plate, tag];
    }

    // ─────────────────────────────────────────────
    // KINGDOM CARDS
    // ─────────────────────────────────────────────
    styleColor(style) {
        switch (style) {
            case 'tactical':       return C.titleBarTop;
            case 'balanced':       return C.hudGreen;
            case 'aggressive':     return C.statKick;
            case 'defensive':      return C.statSpeed;
            case 'possession':     return C.numGoldDark;
            case 'counter-attack': return C.statMorale;
            default:               return C.inkLight;
        }
    }

    createKingdomCards(width) {
        const kingdoms = Object.values(KINGDOMS);
        const total = kingdoms.length * CARD_W + (kingdoms.length - 1) * CARD_GAP;
        let x = (width - total) / 2 + CARD_W / 2;
        const cy = CARD_TOP + CARD_H / 2;

        kingdoms.forEach((kingdom) => {
            this.kingdomCards.push(this.createKingdomCard(x, cy, kingdom));
            x += CARD_W + CARD_GAP;
        });
    }

    createKingdomCard(cx, cy, kingdom) {
        const kit = kitFor(kingdom.id);
        const rating = getTeamOverall(generatePlayers(kingdom.id));
        const roster = generatePlayers(kingdom.id);
        const look = lookForPlayer(roster[0], kit);

        const wrapper = this.add.container(cx, cy).setDepth(D.card);

        const panel = UI.panel(this, -CARD_W / 2, -CARD_H / 2, CARD_W, CARD_H);
        wrapper.add(panel);

        const midX = CARD_W / 2;

        // Portrait in the kingdom's kit colors
        const portrait = chibiPortrait(this, midX, 44, look, 62);
        panel.add(portrait);

        // Kit-colored stripe
        const stripe = this.add.graphics();
        stripe.fillStyle(C.panelEdge, 1);
        stripe.fillRoundedRect(11, 81, 120, 13, 3);
        stripe.fillStyle(kit.jersey, 1);
        stripe.fillRoundedRect(13, 83, 116, 9, 2);
        stripe.fillStyle(kit.accent, 1);
        stripe.fillRect(13, 83, 116, 3);
        panel.add(stripe);

        // Kingdom name
        const name = UI.label(this, midX, 98, kingdom.name, {
            size: 16, bold: true, color: '#2b2b33', ox: 0.5, oy: 0,
        });
        panel.add(name);

        // Play-style chip
        const chipText = UI.label(this, 0, 0, String(kingdom.style).toUpperCase(), {
            size: 10, bold: true, color: '#ffffff', ox: 0.5, oy: 0.5,
        });
        const chipW = Math.ceil(chipText.width) + 18;
        const chipY = 128;
        const chip = this.add.graphics();
        chip.fillStyle(C.panelEdge, 1);
        chip.fillRoundedRect(midX - chipW / 2 - 2, chipY - 11, chipW + 4, 22, 6);
        chip.fillStyle(this.styleColor(kingdom.style), 1);
        chip.fillRoundedRect(midX - chipW / 2, chipY - 9, chipW, 18, 5);
        chip.fillStyle(0xffffff, 0.3);
        chip.fillRect(midX - chipW / 2 + 3, chipY - 7, chipW - 6, 5);
        panel.add(chip);
        chipText.setPosition(midX, chipY);
        panel.add(chipText);

        // Squad rating
        const ratingCap = UI.label(this, midX, 141, 'SQUAD', {
            size: 9, bold: true, color: '#6d7a6d', ox: 0.5, oy: 0,
        });
        panel.add(ratingCap);

        const ratingNum = new PixelText(this, 0, 0, rating, { scale: 3, preset: 'gold' });
        ratingNum.addTo(panel, midX - ratingNum.width / 2, 155);

        // Formation footnote
        const form = UI.label(this, midX, 183, kingdom.formation, {
            size: 11, bold: true, color: '#5a6a7a', ox: 0.5, oy: 0,
        });
        panel.add(form);

        // Hover outline
        const glow = this.add.graphics();
        glow.lineStyle(4, kit.accent, 1);
        glow.strokeRoundedRect(-CARD_W / 2 - 5, -CARD_H / 2 - 5, CARD_W + 10, CARD_H + 10, 12);
        glow.setAlpha(0);
        wrapper.add(glow);

        // Hit area
        const hit = this.add.rectangle(0, 0, CARD_W + 6, CARD_H + 6, 0x000000, 0)
            .setInteractive({ useHandCursor: true });
        wrapper.add(hit);

        hit.on('pointerover', () => {
            if (this.locked) return;
            this.tweens.add({
                targets: wrapper,
                y: cy - 6,
                scaleX: 1.05,
                scaleY: 1.05,
                duration: 170,
                ease: 'Back.easeOut',
            });
            this.tweens.add({ targets: glow, alpha: 1, duration: 140 });
        });

        hit.on('pointerout', () => {
            if (this.locked) return;
            this.tweens.add({
                targets: wrapper,
                y: cy,
                scaleX: 1,
                scaleY: 1,
                duration: 170,
                ease: 'Cubic.easeOut',
            });
            this.tweens.add({ targets: glow, alpha: 0, duration: 140 });
        });

        hit.on('pointerdown', () => this.selectKingdom(kingdom));

        return { wrapper, glow, hit, baseY: cy, kingdom };
    }

    // ─────────────────────────────────────────────
    // FOOTER
    // ─────────────────────────────────────────────
    createFooter(width, height) {
        const cx = width / 2;

        // Bouncing START hint, sat on a cream plate so it reads over the grass
        this.startHint = this.add.container(cx, 470).setDepth(D.hud);
        const hintText = UI.label(this, 0, 0, 'START  \u25B8  Choose Your Kingdom', {
            size: 15, bold: true, color: '#3a2e08', ox: 0.5, oy: 0.5,
        });
        const hintW = Math.ceil(hintText.width) + 34;
        const hintPlate = this.add.graphics();
        hintPlate.fillStyle(C.panelEdge, 1);
        hintPlate.fillRoundedRect(-hintW / 2 - 3, -17, hintW + 6, 34, 9);
        hintPlate.fillStyle(C.rowSelect, 1);
        hintPlate.fillRoundedRect(-hintW / 2, -14, hintW, 28, 7);
        hintPlate.fillStyle(0xffffff, 0.45);
        hintPlate.fillRect(-hintW / 2 + 4, -10, hintW - 8, 6);
        this.startHint.add(hintPlate);
        this.startHint.add(hintText);

        this.tweens.add({
            targets: this.startHint,
            y: 462,
            duration: 620,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut',
        });

        // Version line
        this.versionLabel = this.add.container(cx, height - 18).setDepth(D.hud);
        const verText = UI.label(this, 0, 0,
            'v0.1  \u00B7  A Romance of the Three Kingdoms Soccer Simulation', {
                size: 11, bold: true, color: '#f4fafa', ox: 0.5, oy: 0.5,
            });
        const verW = Math.ceil(verText.width) + 26;
        const verPlate = this.add.graphics();
        verPlate.fillStyle(0x1f3a20, 0.7);
        verPlate.fillRoundedRect(-verW / 2, -12, verW, 24, 12);
        this.versionLabel.add(verPlate);
        this.versionLabel.add(verText);
    }

    // ─────────────────────────────────────────────
    // INTRO REVEAL
    // ─────────────────────────────────────────────
    playIntro() {
        this.titleGroup.forEach((obj, i) => {
            obj.setAlpha(0);
            this.tweens.add({
                targets: obj,
                alpha: 1,
                duration: 420,
                delay: 120 + i * 110,
                ease: 'Cubic.easeOut',
            });
        });

        this.kingdomCards.forEach((card, i) => {
            card.wrapper.setAlpha(0);
            card.wrapper.setScale(0.82);
            this.tweens.add({
                targets: card.wrapper,
                alpha: 1,
                scaleX: 1,
                scaleY: 1,
                duration: 380,
                delay: 620 + i * 90,
                ease: 'Back.easeOut',
            });
        });

        [this.startHint, this.versionLabel].forEach((obj, i) => {
            obj.setAlpha(0);
            this.tweens.add({
                targets: obj,
                alpha: 1,
                duration: 400,
                delay: 1200 + i * 180,
            });
        });
    }

    // ─────────────────────────────────────────────
    // KINGDOM SELECTION (preserved game logic)
    // ─────────────────────────────────────────────
    selectKingdom(kingdom) {
        if (this.locked) return;
        this.locked = true;

        const gameState = this.registry.get('gameState');

        // Picking a kingdom starts a fresh campaign. Wipe anything a previously
        // resumed save left in the registry, otherwise the new game inherits the
        // old squad, gold and season.
        gameState.playerKingdom = kingdom.id;
        gameState.players = null;          // TeamManagementScene regenerates it
        gameState.formation = kingdom.formation;
        gameState.season = 1;
        gameState.week = 1;
        gameState.money = 1500;
        gameState.gold = 1500;
        gameState.reputation = 50;
        gameState.results = [];
        gameState.matchesThisSeason = 0;
        gameState.seasonComplete = false;
        gameState.initialized = false;
        gameState.facilities = { trainingGround: 1, medicalTent: 0, scoutNetwork: 0 };
        gameState.trophies = [];
        gameState.sponsorBonus = 0;
        gameState.scoutBonus = false;
        gameState.weatherPenalty = null;
        gameState.challengeMatch = false;
        gameState.lastMatchWon = false;
        this.registry.set('gameState', gameState);

        // Audio: war drum on selection
        import('../engine/AudioManager.js').then(({ audioManager }) => {
            audioManager.init();
            audioManager.playWarDrum();
        });

        const kit = kitFor(kingdom.id);

        // Flash the camera in the kit color and get the crowd going
        this.cameras.main.flash(420,
            (kit.jersey >> 16) & 0xff,
            (kit.jersey >> 8) & 0xff,
            kit.jersey & 0xff
        );
        this.pitch.crowdCheer(2);

        // The chosen card pops forward
        const chosen = this.kingdomCards.find((c) => c.kingdom.id === kingdom.id);
        if (chosen) {
            chosen.glow.setAlpha(1);
            this.tweens.add({
                targets: chosen.wrapper,
                scaleX: 1.18,
                scaleY: 1.18,
                y: chosen.baseY - 12,
                duration: 260,
                ease: 'Back.easeOut',
            });
        }

        this.actors.forEach((a) => a.chibi.hop(this, 12, 3));

        this.time.delayedCall(760, () => {
            this.scene.start('TeamManagementScene');
        });
    }
}
