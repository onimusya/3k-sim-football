import { KINGDOMS, generatePlayers } from '../data/teams.js';
import { MatchEngine } from '../engine/MatchEngine.js';
import { audioManager } from '../engine/AudioManager.js';

import { C, kitFor, SKIN, HAIR } from '../art/Palette.js';
import { PixelText } from '../art/PixelFont.js';
import { Chibi, lookForPlayer, chibiPortrait } from '../art/Chibi.js';
import * as UI from '../art/UI.js';
import { IsoPitch, formationPositions } from '../art/IsoWorld.js';

// Depth bands. The pitch itself owns 0..9000 (sky 0 → near hoarding 9000).
const D = {
    ballShadow: 7990,
    ballGlow: 7994,
    ballRing: 7996,
    ball: 8000,
    nameTag: 8500,
    hud: 12000,
    flash: 14000,
    confetti: 15000,
    banner: 16000,
    card: 16500,
    intro: 20000,
};

const MATCH_DURATION = 18000;   // ms for a full 90 at 1x

export class MatchDayScene extends Phaser.Scene {
    constructor() {
        super({ key: 'MatchDayScene' });
    }

    create() {
        const { width, height } = this.cameras.main;
        const gameState = this.registry.get('gameState');
        const playerKingdom = KINGDOMS[gameState.playerKingdom.toUpperCase()];

        // Pick opponent
        const opponents = Object.values(KINGDOMS).filter(k => k.id !== playerKingdom.id);
        const opponent = opponents[Math.floor(Math.random() * opponents.length)];

        this.homeKingdom = playerKingdom;
        this.awayKingdom = opponent;
        this.homePlayers = gameState.players;
        this.awayPlayers = generatePlayers(opponent.id);

        this.homeKit = kitFor(this.homeKingdom.id);
        this.awayKit = kitFor(this.awayKingdom.id);

        // Playback state
        this.gameSpeed = 1;
        this.matchStarted = false;
        this.matchMinute = 0;
        this.homeScore = 0;
        this.awayScore = 0;
        this.actors = [];
        this.ballState = { fx: 0.5, fy: 0.5, air: 0 };

        // Scene instances are reused across scene.start(), so anything holding
        // GameObjects from the previous match must be cleared here or later
        // calls will touch destroyed objects.
        this.speedButtons = [];
        this.speedPlate = null;
        this.ball = null;
        this.ballShadow = null;
        this.pitch = null;
        this.commentaryText = null;
        this.clockText = null;
        this.scoreText = null;

        // Reset any time scaling left over from a previous visit
        this.tweens.timeScale = 1;
        this.time.timeScale = 1;

        // Run match simulation first
        const engine = new MatchEngine(
            { kingdom: playerKingdom, players: this.homePlayers },
            { kingdom: opponent, players: this.awayPlayers }
        );
        this.matchResult = engine.simulateMatch();

        // Show intro sequence, then start match
        this.showIntroSequence(width, height);
    }

    // ═══════════════════════════════════════════════════════════════
    // HELPERS
    // ═══════════════════════════════════════════════════════════════

    /** Kingdom names carry CJK glyphs; the score strip wants the roman part. */
    shortName(kingdom) {
        const ascii = String(kingdom.name || '').replace(/[^\x20-\x7E]/g, '').trim();
        return (ascii.length >= 2 ? ascii : String(kingdom.id)).toUpperCase();
    }

    /** Label on a small cream plate so callouts stay readable over the grass. */
    plateLabel(x, y, text, size = 15) {
        const container = this.add.container(x, y);
        const t = UI.label(this, 0, 0, text,
            { size, bold: true, color: '#2b2b33', ox: 0.5, oy: 0.5 });
        const w = Math.max(60, t.width + 24);
        const h = t.height + 12;

        const g = this.add.graphics();
        g.fillStyle(C.panelEdge, 1);
        g.fillRoundedRect(-w / 2 - 2, -h / 2 - 2, w + 4, h + 4, 6);
        g.fillStyle(C.rowCream, 1);
        g.fillRoundedRect(-w / 2, -h / 2, w, h, 5);
        g.fillStyle(0xffffff, 0.35);
        g.fillRect(-w / 2 + 3, -h / 2 + 3, w - 6, 4);
        container.add(g);
        container.add(t);
        return container;
    }

    /** Top two players by total stats — used for the intro portraits. */
    starPlayers(players, count = 2) {
        const total = (p) => Object.values(p.stats).reduce((a, b) => a + b, 0);
        return [...players].sort((a, b) => total(b) - total(a)).slice(0, count);
    }

    /**
     * UI.panel stores its inner rect on `.body`, which Phaser's destroy() mistakes
     * for a physics body. Move it out of the way so panels can be torn down safely.
     */
    panelAt(x, y, w, h, title = null, opts = {}) {
        const p = UI.panel(this, x, y, w, h, title, opts);
        p.bodyRect = p.bodyRect || p.body;
        if (p.body) delete p.body;
        return p;
    }

    /** Keeper first so formation slot 0 (GK) gets an actual goalkeeper. */
    lineupFor(players) {
        const gk = players.find(p => p.pos === 'GK');
        if (!gk) return players.slice();
        return [gk, ...players.filter(p => p !== gk)];
    }

    // ═══════════════════════════════════════════════════════════════
    // INTRO SEQUENCE — bright panel over a plain sky
    // ═══════════════════════════════════════════════════════════════
    showIntroSequence(width, height) {
        const gameState = this.registry.get('gameState');
        this.introContainer = this.add.container(0, 0).setDepth(D.intro);

        // Plain sunny backdrop (no dark overlays anywhere)
        const sky = this.add.graphics();
        const bands = 12;
        const horizon = height * 0.72;
        for (let i = 0; i < bands; i++) {
            const col = Phaser.Display.Color.Interpolate.ColorWithColor(
                Phaser.Display.Color.ValueToColor(C.skyLight),
                Phaser.Display.Color.ValueToColor(C.skyDeep),
                bands - 1, i
            );
            sky.fillStyle(Phaser.Display.Color.GetColor(col.r, col.g, col.b), 1);
            sky.fillRect(0, (horizon / bands) * i, width, horizon / bands + 1);
        }
        sky.fillStyle(C.grass, 1);
        sky.fillRect(0, horizon, width, height - horizon);
        sky.fillStyle(C.grassAlt, 1);
        for (let x = 0; x < width; x += 96) sky.fillRect(x, horizon, 48, height - horizon);
        // soft clouds
        [[140, 90, 1], [780, 64, 0.8], [470, 130, 0.6]].forEach(([cx, cy, s]) => {
            sky.fillStyle(0xffffff, 0.85);
            sky.fillCircle(cx, cy, 16 * s);
            sky.fillCircle(cx + 18 * s, cy + 4 * s, 12 * s);
            sky.fillCircle(cx - 18 * s, cy + 5 * s, 11 * s);
            sky.fillEllipse(cx, cy + 10 * s, 66 * s, 14 * s);
        });
        this.introContainer.add(sky);

        // Main dialog
        const pw = 800, ph = 476;
        const panel = this.panelAt((width - pw) / 2, 68, pw, ph, 'MATCH DAY');
        this.introContainer.add(panel);

        panel.add(UI.label(this, pw / 2, 48,
            `Season ${gameState.season}  ·  Week ${gameState.week}`,
            { size: 13, bold: true, color: '#4a4a55', ox: 0.5, oy: 0.5 }));

        const sides = [
            { kingdom: this.homeKingdom, players: this.homePlayers, kit: this.homeKit, cx: 196 },
            { kingdom: this.awayKingdom, players: this.awayPlayers, kit: this.awayKit, cx: pw - 196 },
        ];

        const fadeTargets = [];

        sides.forEach(({ kingdom, players, kit, cx }, side) => {
            const crest = this.createCrest(cx, 116, kingdom, 58);
            panel.add(crest);
            crest.setAlpha(0).setX(cx + (side === 0 ? -160 : 160));
            this.tweens.add({
                targets: crest, alpha: 1, x: cx,
                duration: 560, ease: 'Back.easeOut', delay: 260 + side * 180,
            });

            const name = UI.label(this, cx, 168, kingdom.fullName,
                { size: 17, bold: true, color: '#2b2b33', ox: 0.5, oy: 0.5 });
            const motto = UI.label(this, cx, 192, `"${kingdom.motto}"`,
                { size: 12, color: '#5a5a66', ox: 0.5, oy: 0.5 });
            const form = UI.label(this, cx, 214, `Formation ${kingdom.formation}`,
                { size: 12, bold: true, color: '#14539f', ox: 0.5, oy: 0.5 });
            [name, motto, form].forEach(t => { t.setAlpha(0); panel.add(t); fadeTargets.push(t); });

            // Star player portraits
            const stars = this.starPlayers(players, 2);
            stars.forEach((p, i) => {
                const px = cx + (i === 0 ? -42 : 42);
                const portrait = chibiPortrait(this, px, 262, lookForPlayer(p, kit), 54);
                portrait.setAlpha(0);
                panel.add(portrait);
                fadeTargets.push(portrait);

                const pname = UI.label(this, px, 296, p.name,
                    { size: 10, bold: true, color: '#2b2b33', ox: 0.5, oy: 0.5, wrap: 84, align: 'center' });
                pname.setAlpha(0);
                panel.add(pname);
                fadeTargets.push(pname);
            });

            // Squad shortlist
            players.slice(0, 5).forEach((p, i) => {
                const row = UI.label(this, cx, 336 + i * 20, `${p.pos}  ${p.name}`,
                    { size: 11, color: '#3a3a44', ox: 0.5, oy: 0.5 });
                row.setAlpha(0);
                panel.add(row);
                this.tweens.add({ targets: row, alpha: 1, duration: 180, delay: 1400 + side * 260 + i * 70 });
            });
        });

        this.tweens.add({ targets: fadeTargets, alpha: 1, duration: 320, delay: 900 });

        // VS
        const vs = new PixelText(this, 0, 0, 'VS', { scale: 6, preset: 'gold' });
        vs.setOrigin(0.5, 0.5);
        vs.addTo(panel, pw / 2, 176);
        vs.gfx.setScale(2.4).setAlpha(0);
        this.tweens.add({
            targets: vs.gfx, scale: 1, alpha: 1,
            duration: 420, ease: 'Back.easeOut', delay: 700,
        });

        const hint = UI.label(this, pw / 2, 446, 'Click anywhere to kick off',
            { size: 12, bold: true, color: '#5a5a66', ox: 0.5, oy: 0.5 });
        panel.add(hint);
        this.tweens.add({ targets: hint, alpha: 0.35, duration: 800, yoyo: true, repeat: -1 });

        let started = false;
        const startMatch = () => {
            if (started) return;
            started = true;
            this.tweens.add({
                targets: this.introContainer,
                alpha: 0,
                duration: 420,
                onComplete: () => {
                    this.introContainer.destroy();
                    this.introContainer = null;
                    this.buildMatchView();
                },
            });
        };

        this.input.once('pointerdown', startMatch);
        this.time.delayedCall(6000, startMatch);
    }

    /** Kit-colored shield crest with the kingdom's leading glyph. */
    createCrest(x, y, kingdom, size) {
        const kit = kitFor(kingdom.id);
        const container = this.add.container(x, y);
        const h = size / 2;

        const shield = this.add.graphics();
        const path = (inset, color) => {
            const s = h - inset;
            shield.fillStyle(color, 1);
            shield.beginPath();
            shield.moveTo(-s, -s);
            shield.lineTo(s, -s);
            shield.lineTo(s, s * 0.45);
            shield.lineTo(0, s * 1.05);
            shield.lineTo(-s, s * 0.45);
            shield.closePath();
            shield.fill();
        };
        path(0, C.panelEdge);
        path(3, kit.jersey);
        shield.fillStyle(kit.accent, 1);
        shield.fillRect(-h + 4, -h + 4, size - 8, Math.max(3, size * 0.14));
        container.add(shield);

        const glyph = this.add.text(0, 2, String(kingdom.name).charAt(0), {
            fontFamily: 'serif',
            fontSize: `${Math.round(size * 0.52)}px`,
            color: '#ffffff',
            stroke: '#2b2b33',
            strokeThickness: 4,
        }).setOrigin(0.5);
        container.add(glyph);

        return container;
    }

    // ═══════════════════════════════════════════════════════════════
    // MATCH VIEW
    // ═══════════════════════════════════════════════════════════════
    buildMatchView() {
        const { width, height } = this.cameras.main;
        this.matchStarted = true;

        // spanX is capped near 820 so both goals stay on a 960-wide canvas;
        // the frame is filled by growing spanY instead of cropping sideways.
        this.pitch = new IsoPitch(this, { cx: 480, cy: 384, spanX: 820, spanY: 400 });
        this.pitch.build();

        this.createDugouts();
        this.createActors();
        this.createBall();
        this.createScoreboard(width);
        this.createSpeedControls(width);
        this.createCommentaryStrip(width, height);

        this.startMatchPlayback(width, height);
    }

    // ── DUGOUTS ───────────────────────────────────────────────────
    /**
     * The terraces wrap behind both goals now, but the apron outside the near
     * touchline is still flat grass in the bottom-left of the frame (measured:
     * a solid block roughly x 0..178, y 560..640). Two team dugouts fill it.
     *
     * On fy the benches sit just outside the touchline (1.13 / 1.20 — the
     * hoarding itself runs at 1.035). fx stays low rather than the 0.3 / 0.7
     * you'd expect for halfway-line dugouts: at fy≈1.1 those fx values project
     * to x≈208 and x≈536, both of which land behind the 600px commentary strip
     * (x 180..780), and anything further right runs off the bottom of the
     * canvas. Left of the strip is the only apron actually on screen.
     */
    createDugouts() {
        const g = this.add.graphics().setDepth(9100);   // nearer than the hoarding (9000), under the HUD

        const dugout = (fx, fy, kit) => {
            const p = this.pitch.project(fx, fy);
            const w = 58, sh = 22;            // shelter width / interior height
            const x0 = Math.round(p.x - w / 2);
            const base = Math.round(p.y);

            // ground shadow
            g.fillStyle(0x000000, 0.16);
            g.fillEllipse(p.x, base + 3, w + 10, 9);

            // dark shell
            g.fillStyle(C.panelEdge, 1);
            g.fillRect(x0 - 3, base - sh - 12, w + 6, sh + 14);
            // shaded interior
            g.fillStyle(C.statTrack, 1);
            g.fillRect(x0, base - sh - 8, w, sh + 8);
            // canopy with a highlight along the top
            g.fillStyle(C.standRoof, 1);
            g.fillRect(x0 - 2, base - sh - 11, w + 4, 5);
            g.fillStyle(0xffffff, 0.25);
            g.fillRect(x0 - 2, base - sh - 11, w + 4, 2);

            // three seated figures in the team's kit
            for (let i = 0; i < 3; i++) {
                const cx = x0 + 11 + i * 18;
                g.fillStyle(C.panelEdge, 1);
                g.fillRect(cx - 5, base - sh - 3, 10, 17);
                g.fillStyle(HAIR[(i * 2) % HAIR.length], 1);
                g.fillRect(cx - 4, base - sh - 2, 8, 3);
                g.fillStyle(SKIN[i % SKIN.length], 1);
                g.fillRect(cx - 4, base - sh + 1, 8, 5);
                g.fillStyle(kit.jersey, 1);
                g.fillRect(cx - 4, base - sh + 6, 8, 8);
                g.fillStyle(kit.accent, 1);
                g.fillRect(cx - 4, base - sh + 9, 8, 2);
            }

            // bench front, drawn over the figures' legs
            g.fillStyle(C.panelEdge, 1);
            g.fillRect(x0 - 3, base - 10, w + 6, 11);
            g.fillStyle(C.fence, 1);
            g.fillRect(x0 - 1, base - 9, w + 2, 8);
            g.fillStyle(kit.jersey, 0.85);
            g.fillRect(x0 - 1, base - 5, w + 2, 3);
        };

        dugout(0.23, 1.13, this.homeKit);
        dugout(0.14, 1.20, this.awayKit);

        this.dugouts = g;
    }

    // ── CHIBI ACTORS ──────────────────────────────────────────────
    createActors() {
        this.actors = [];
        this.buildTeamActors(this.homeKingdom, this.homePlayers, this.homeKit, 'home');
        this.buildTeamActors(this.awayKingdom, this.awayPlayers, this.awayKit, 'away');
        this.actors.forEach(a => this.startWander(a, Math.random() * 900));
    }

    buildTeamActors(kingdom, players, kit, team) {
        const slots = formationPositions(kingdom.formation, team);
        const lineup = this.lineupFor(players);

        slots.forEach((slot, i) => {
            const player = lineup[i % lineup.length];
            const look = lookForPlayer(player, kit);
            const p = this.pitch.project(slot.fx, slot.fy);

            const chibi = new Chibi(this, p.x, p.y, { ...look, px: 2 });
            chibi.setFacing('side', team === 'home');   // home looks right, away looks left
            chibi.setDepth(this.pitch.depthAt(slot.fx, slot.fy));

            this.actors.push({
                chibi,
                player,
                team,
                role: slot.role,
                kit,
                baseFx: slot.fx,
                baseFy: slot.fy,
                fx: slot.fx,
                fy: slot.fy,
            });
        });
    }

    placeActor(a) {
        const p = this.pitch.project(a.fx, a.fy);
        const depth = this.pitch.depthAt(a.fx, a.fy);
        a.chibi.setPosition(p.x, p.y);
        a.chibi.setDepth(depth);

        // The focus marker rides along under the highlighted player's feet.
        if (this.focusMarker && this.focusActor === a) {
            this.focusMarker.setPosition(p.x, p.y + 1);
            this.focusMarker.setDepth(depth - 1);
        }
    }

    /** Small idle wander around the formation slot, re-projected every frame. */
    startWander(a, delay = 0) {
        if (!this.matchStarted || !a.chibi || !a.chibi.container.active) return;

        const range = a.role === 'GK' ? 0.012 : 0.026;
        const targetFx = Phaser.Math.Clamp(
            a.baseFx + Phaser.Math.FloatBetween(-range, range), 0.02, 0.98);
        const targetFy = Phaser.Math.Clamp(
            a.baseFy + Phaser.Math.FloatBetween(-range * 1.3, range * 1.3), 0.05, 0.95);

        a.chibi.setWalking(true);
        a.chibi.faceVector(targetFx - a.fx, targetFy - a.fy);

        a.tween = this.tweens.add({
            targets: a,
            fx: targetFx,
            fy: targetFy,
            duration: 850 + Math.random() * 900,
            delay,
            ease: 'Sine.easeInOut',
            onUpdate: () => this.placeActor(a),
            onComplete: () => {
                if (!a.chibi || !a.chibi.container.active) return;
                a.chibi.setWalking(false);
                a.chibi.setFacing('side', a.team === 'home');
                this.time.delayedCall(200 + Math.random() * 800, () => this.startWander(a));
            },
        });
    }

    // ── BALL ──────────────────────────────────────────────────────
    createBall() {
        const pos = this.pitch.ballPos(0.5, 0.5, 0);

        this.ballShadow = this.add.ellipse(pos.x, pos.groundY + 2, 12, 6, 0x000000, 0.3)
            .setDepth(D.ballShadow);

        // Soft glow + a thin bright ring that pulses, so a 6px white dot stays
        // findable among 22 sprites. Both sit just under the ball's depth.
        this.ballGlow = this.add.circle(pos.x, pos.y, 13, C.numGold, 0.20)
            .setDepth(D.ballGlow);
        this.ballRing = this.add.circle(pos.x, pos.y, 11, 0xffffff, 0)
            .setDepth(D.ballRing);
        this.ballRing.setStrokeStyle(2, C.numGold, 0.95);

        this.tweens.add({
            targets: this.ballRing,
            scale: 1.32,
            alpha: 0.35,
            duration: 620,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut',
        });
        this.tweens.add({
            targets: this.ballGlow,
            scale: 1.18,
            alpha: 0.34,
            duration: 620,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut',
        });

        this.ball = this.add.circle(pos.x, pos.y, 6, 0xffffff).setDepth(D.ball);
        this.ball.setStrokeStyle(2, C.panelEdge, 1);

        this.placeBall();
        this.highlightNearestToBall();

        // Idle knock-about between actors
        this.ballLoop = this.time.addEvent({
            delay: 1500,
            loop: true,
            callback: () => this.passBallToRandomActor(),
        });
    }

    placeBall() {
        if (!this.ball || !this.ball.active) return;
        const b = this.ballState;
        const p = this.pitch.ballPos(b.fx, b.fy, b.air);
        this.ball.setPosition(p.x, p.y);
        if (this.ballRing) this.ballRing.setPosition(p.x, p.y);
        if (this.ballGlow) this.ballGlow.setPosition(p.x, p.y);
        this.ballShadow.setPosition(p.x, p.groundY + 2);
        const s = Math.max(0.5, 1 - b.air / 140);
        this.ballShadow.setScale(s);
        this.ballShadow.setAlpha(0.3 * s);
    }

    /** Tween the ball through field space with an optional air arc. */
    moveBall(fx, fy, opts = {}) {
        if (!this.ball || !this.ball.active) return;
        if (this.ballTween) this.ballTween.stop();

        const b = this.ballState;
        const from = { fx: b.fx, fy: b.fy };
        const peak = opts.air ?? 0;
        const o = { t: 0 };

        this.ballTween = this.tweens.add({
            targets: o,
            t: 1,
            duration: opts.duration ?? 700,
            ease: opts.ease || 'Sine.easeInOut',
            onUpdate: () => {
                b.fx = from.fx + (fx - from.fx) * o.t;
                b.fy = from.fy + (fy - from.fy) * o.t;
                b.air = Math.sin(Math.PI * o.t) * peak;
                this.placeBall();
            },
            onComplete: () => {
                b.air = 0;
                this.placeBall();
                this.highlightNearestToBall();
                if (opts.onDone) opts.onDone();
            },
        });
    }

    /** Actor closest to the ball in field space. */
    nearestActorToBall() {
        const b = this.ballState;
        let best = null, bestD = Infinity;
        for (const a of this.actors) {
            if (!a.chibi || !a.chibi.container.active) continue;
            // fy is the short axis of the pitch, so weight it to keep the
            // "closest" reading visually sensible rather than purely numeric.
            const dx = a.fx - b.fx, dy = (a.fy - b.fy) * 0.45;
            const d = dx * dx + dy * dy;
            if (d < bestD) { bestD = d; best = a; }
        }
        return best;
    }

    /**
     * Put a kit-accent ellipse under the feet of whoever is nearest the ball,
     * clearing it from the previous holder. Gives the eye a place to land.
     */
    highlightNearestToBall() {
        if (!this.matchStarted || !this.actors || !this.actors.length) return;
        const a = this.nearestActorToBall();
        if (!a || a === this.focusActor) return;

        if (!this.focusMarker) {
            this.focusMarker = this.add.ellipse(0, 0, 26, 12, C.numGold, 0.9);
            this.focusMarker.setStrokeStyle(2, C.panelEdge, 0.9);
            this.tweens.add({
                targets: this.focusMarker,
                scaleX: 1.16,
                scaleY: 1.16,
                alpha: 0.65,
                duration: 560,
                yoyo: true,
                repeat: -1,
                ease: 'Sine.easeInOut',
            });
        }

        this.focusActor = a;
        this.focusMarker.setFillStyle(a.kit.accent, 0.9);
        this.focusMarker.setVisible(true);
        this.placeActor(a);
    }

    passBallToRandomActor() {
        if (!this.matchStarted || !this.actors.length) return;
        const a = this.actors[Math.floor(Math.random() * this.actors.length)];
        if (!a || !a.chibi || !a.chibi.container.active) return;
        this.moveBall(
            Phaser.Math.Clamp(a.fx + Phaser.Math.FloatBetween(-0.02, 0.02), 0.03, 0.97),
            Phaser.Math.Clamp(a.fy + Phaser.Math.FloatBetween(-0.02, 0.02), 0.05, 0.95),
            { duration: 700, air: 12 + Math.random() * 18, ease: 'Quad.easeOut' }
        );
    }

    shootAtGoal(isHome, opts = {}) {
        const fx = isHome ? 0.995 : 0.005;
        const fy = 0.5 + Phaser.Math.FloatBetween(-0.045, 0.045);
        this.moveBall(fx, fy, {
            duration: opts.duration ?? 300,
            air: opts.air ?? 34,
            ease: 'Quad.easeIn',
            onDone: opts.onDone,
        });
    }

    // ── SCOREBOARD ────────────────────────────────────────────────
    createScoreboard(width) {
        const gameState = this.registry.get('gameState');

        // Green HUD band
        this.topBar = UI.topBar(this, width, { h: 42 }).setDepth(D.hud);
        this.topBar.setDate(gameState.season, 1, gameState.week);
        this.topBar.setMoney(gameState.gold ?? gameState.money ?? 0);

        // White score strip sitting over the band
        const sw = 380, sh = 54;

        // The strip is taller than the 42px band, so extend a matching green
        // shoulder behind it with the same cyan top line and dark bottom
        // border. The band and the strip then read as one moulded unit instead
        // of a torn seam.
        const shW = sw + 30, shH = 68;
        const shX = (width - shW) / 2;
        const shoulder = this.add.graphics().setDepth(D.hud + 5);
        // dark frame, rounded only at the bottom so it grows out of the band
        shoulder.fillStyle(C.panelEdge, 1);
        shoulder.fillRoundedRect(shX, 0, shW, shH, { tl: 0, tr: 0, bl: 11, br: 11 });
        // base green (darkest gradient stop) inside the frame
        shoulder.fillStyle(C.hudGreenDark, 1);
        shoulder.fillRoundedRect(shX + 2, 3, shW - 4, shH - 7, { tl: 0, tr: 0, bl: 9, br: 9 });
        // gradient bands, stopping clear of the rounded bottom corners
        const gradTop = 3, gradBot = shH - 16, gBands = 7;
        for (let i = 0; i < gBands; i++) {
            const col = Phaser.Display.Color.Interpolate.ColorWithColor(
                Phaser.Display.Color.ValueToColor(C.hudGreenLight),
                Phaser.Display.Color.ValueToColor(C.hudGreenDark),
                gBands - 1, i
            );
            shoulder.fillStyle(Phaser.Display.Color.GetColor(col.r, col.g, col.b), 1);
            const bh2 = (gradBot - gradTop) / gBands;
            shoulder.fillRect(shX + 2, gradTop + bh2 * i, shW - 4, bh2 + 1);
        }
        // cyan accent line continuing the band's top edge
        shoulder.fillStyle(C.hudEdge, 1);
        shoulder.fillRect(shX + 2, 0, shW - 4, 3);
        this.scoreShoulder = shoulder;

        const strip = this.panelAt((width - sw) / 2, 6, sw, sh);
        strip.setDepth(D.hud + 10);
        this.scoreStrip = strip;

        const swatch = (x, kit) => {
            const g = this.add.graphics();
            g.fillStyle(C.panelEdge, 1);
            g.fillRect(x - 2, 12, 22, 30);
            g.fillStyle(kit.jersey, 1);
            g.fillRect(x, 14, 18, 26);
            g.fillStyle(kit.accent, 1);
            g.fillRect(x, 32, 18, 8);
            strip.add(g);
        };

        swatch(12, this.homeKit);
        strip.add(UI.label(this, 40, 27, this.shortName(this.homeKingdom),
            { size: 14, bold: true, color: '#2b2b33', ox: 0, oy: 0.5 }));

        swatch(sw - 30, this.awayKit);
        strip.add(UI.label(this, sw - 44, 27, this.shortName(this.awayKingdom),
            { size: 14, bold: true, color: '#2b2b33', ox: 1, oy: 0.5 }));

        // Score — pixel numerals, punched on change
        this.scoreWrap = this.add.container(sw / 2, 19);
        strip.add(this.scoreWrap);
        this.scoreText = new PixelText(this, 0, 0, '0 - 0', { scale: 4, preset: 'gold' });
        this.scoreText.setOrigin(0.5, 0.5);
        this.scoreText.addTo(this.scoreWrap, 0, 0);

        // Clock
        this.clockText = new PixelText(this, 0, 0, "0'", { scale: 2, preset: 'dark' });
        this.clockText.setOrigin(0.5, 0);
        this.clockText.addTo(strip, sw / 2, 36);
    }

    updateScoreboard(punch = false) {
        if (!this.scoreText) return;
        this.scoreText.setText(`${this.homeScore} - ${this.awayScore}`);
        if (punch && this.scoreWrap && this.scoreWrap.active) {
            this.scoreWrap.setScale(1.6);
            this.tweens.add({
                targets: this.scoreWrap,
                scale: 1,
                duration: 320,
                ease: 'Back.easeOut',
            });
        }
    }

    // ── SPEED CONTROLS ────────────────────────────────────────────
    createSpeedControls() {
        // A dark plate anchors the trio so they don't float on the town
        // skyline, and its left edge lines up with the scene's 16px margin.
        const px = 16, py = 48, pw = 156, ph = 42;
        const plate = this.add.graphics().setDepth(D.hud + 2);
        plate.fillStyle(C.panelEdge, 1);
        plate.fillRoundedRect(px, py, pw, ph, 8);
        plate.fillStyle(C.statTrack, 0.94);
        plate.fillRoundedRect(px + 2, py + 2, pw - 4, ph - 4, 6);
        plate.fillStyle(0xffffff, 0.10);
        plate.fillRect(px + 5, py + 5, pw - 10, 4);
        this.speedPlate = plate;

        this.speedButtons = [];
        [1, 2, 4].forEach((speed, i) => {
            const btn = UI.button(this, px + 6 + i * 50, py + 6, 44, 26, `${speed}x`, {
                size: 13,
            });
            btn.setDepth(D.hud + 3);
            btn.onClick(() => this.setGameSpeed(speed));
            this.speedButtons.push({ btn, speed });
        });
        this.setGameSpeed(1);
    }

    setGameSpeed(speed) {
        this.gameSpeed = speed;
        // State reads through colour only — full alpha and full scale on all
        // three, so an unselected button never looks like a rendering glitch.
        (this.speedButtons || []).forEach(({ btn, speed: s }) => {
            const on = s === speed;
            btn.setAlpha(1);
            btn.setScale(1);
            btn.setColors(
                on ? C.numGold : C.titleBarTop,
                on ? C.numGoldDark : C.titleBarBot,
                on ? '#8a5c08' : '#123a6b'
            );
        });
        this.tweens.timeScale = speed;
        this.time.timeScale = speed;
    }

    // ── COMMENTARY ────────────────────────────────────────────────
    createCommentaryStrip(width, height) {
        // Sized to the sentence rather than the canvas, and centred, so the
        // bottom of the frame isn't 900px of empty cream.
        const bw = 600, bh = 54;
        const strip = this.panelAt((width - bw) / 2, height - bh - 8, bw, bh);
        strip.setDepth(D.hud);
        this.commentaryStrip = strip;

        UI.subPanel(this, strip, 6, 6, bw - 12, bh - 12, {
            color: C.rowCream,
            edge: C.panelEdge,
        });

        // A coach/commentator portrait in the player's own kit, so the line
        // reads as somebody speaking it.
        const speaker = this.homePlayers && this.homePlayers.length
            ? this.homePlayers[0] : null;
        if (speaker) {
            const portrait = chibiPortrait(
                this, 32, bh / 2, lookForPlayer(speaker, this.homeKit), 36);
            strip.add(portrait);
        }

        strip.add(UI.icon(this, 62, bh / 2, 'whistle', 15));

        this.commentaryText = UI.label(this, 78, bh / 2, '', {
            size: 13,
            bold: true,
            color: '#2b2b33',
            ox: 0,
            oy: 0.5,
            wrap: bw - 90,
        });
        strip.add(this.commentaryText);
    }

    typewriterComment(text) {
        if (!this.commentaryText || !this.commentaryText.active) return;
        this.commentaryText.setText('');
        let idx = 0;
        const fullText = String(text);

        if (this.typewriterTimer) this.typewriterTimer.destroy();

        this.typewriterTimer = this.time.addEvent({
            delay: 30,
            callback: () => {
                if (idx < fullText.length && this.commentaryText && this.commentaryText.active) {
                    idx++;
                    this.commentaryText.setText(fullText.substring(0, idx));
                }
            },
            repeat: fullText.length - 1,
        });
    }

    // ═══════════════════════════════════════════════════════════════
    // PLAYBACK
    // ═══════════════════════════════════════════════════════════════
    startMatchPlayback(width, height) {
        const events = this.matchResult.events;
        const timePerMinute = MATCH_DURATION / 90;

        audioManager.init();
        audioManager.playWhistle();
        audioManager.startCrowdAmbience();

        this.time.addEvent({
            delay: timePerMinute,
            repeat: 89,
            callback: () => {
                if (this.matchMinute < 90) {
                    this.matchMinute++;
                    if (this.clockText) this.clockText.setText(`${this.matchMinute}'`);
                }
            },
        });

        this.typewriterComment(
            `The match begins! ${this.homeKingdom.fullName} vs ${this.awayKingdom.fullName}!`);

        events.forEach((event) => {
            this.time.delayedCall(event.minute * timePerMinute, () => {
                this.playMatchEvent(event, width, height);
            });
        });

        this.time.delayedCall(45 * timePerMinute, () => {
            this.typewriterComment('Half-time! The warriors take a brief rest.');
            this.showHalfTime(width, height);
        });

        this.time.delayedCall(MATCH_DURATION + 1500, () => {
            this.showFullTime(width, height);
        });
    }

    playMatchEvent(event, width, height) {
        switch (event.type) {
            case 'goal':
                this.playGoalEvent(event, width, height);
                break;
            case 'save':
                this.playSaveEvent(event);
                break;
            case 'shot_wide':
                this.playShotWideEvent(event);
                break;
            case 'foul':
                this.playFoulEvent(event, width, height);
                break;
            case 'chance':
                this.playChanceEvent(event);
                break;
        }
    }

    // ── GOAL ──────────────────────────────────────────────────────
    playGoalEvent(event, width, height) {
        const isHome = event.team === 'home';
        if (isHome) this.homeScore++;
        else this.awayScore++;

        audioManager.init();
        audioManager.playGoal();

        // Ball arcs into the net
        this.shootAtGoal(isHome, { duration: 320, air: 52 });

        this.cameras.main.shake(320, 0.008);

        this.time.delayedCall(300, () => {
            this.updateScoreboard(true);
            if (this.pitch) this.pitch.crowdCheer(1.5);
        });

        this.time.delayedCall(340, () => {
            this.showGoalBanner(event, width, height);
            this.spawnConfetti(width, height, isHome);
            this.celebrateGoal(isHome, event);
        });

        this.typewriterComment(`GOAL! ${event.data.description}`);
    }

    showGoalBanner(event, width, height) {
        const banner = UI.banner(this, width / 2, height * 0.42, width, 'GOAL!', {
            scale: 6,
            top: C.hudGreenLight,
            bot: C.hudGreenDark,
            h: 62,
        });
        banner.setDepth(D.banner);
        banner.setScale(1, 0);

        const scorer = this.plateLabel(width / 2, height * 0.42 + 52,
            `${event.data.scorer.name}   ${event.minute}'`);
        scorer.setDepth(D.banner);
        scorer.setAlpha(0);

        this.tweens.add({ targets: banner, scaleY: 1, duration: 260, ease: 'Back.easeOut' });
        this.tweens.add({ targets: scorer, alpha: 1, duration: 260, delay: 200 });

        this.time.delayedCall(2400, () => {
            this.tweens.add({
                targets: [banner, scorer],
                alpha: 0,
                duration: 420,
                onComplete: () => { banner.destroy(); scorer.destroy(); },
            });
        });
    }

    celebrateGoal(isHome, event) {
        const team = isHome ? 'home' : 'away';
        this.actors.forEach((a) => {
            if (a.team !== team || !a.chibi || !a.chibi.container.active) return;
            a.chibi.hop(this, 12, 3);
        });
        if (event.data.scorer) this.showPlayerNameFlash(event.data.scorer.name);
    }

    spawnConfetti(width, height, isHome) {
        const kit = isHome ? this.homeKit : this.awayKit;
        const colors = [kit.jersey, kit.accent, C.numGold, 0xffffff];

        for (let i = 0; i < 46; i++) {
            const cx = width / 2 + (Math.random() - 0.5) * width * 0.85;
            const color = colors[Math.floor(Math.random() * colors.length)];
            const size = 3 + Math.random() * 5;
            const bit = Math.random() > 0.5
                ? this.add.rectangle(cx, -12, size, size * 2, color, 1)
                : this.add.circle(cx, -12, size / 2, color, 1);
            bit.setDepth(D.confetti);

            this.tweens.add({
                targets: bit,
                y: height + 24,
                x: cx + (Math.random() - 0.5) * 110,
                angle: Math.random() * 720 - 360,
                alpha: 0,
                duration: 1900 + Math.random() * 1400,
                ease: 'Quad.easeIn',
                onComplete: () => bit.destroy(),
            });
        }
    }

    // ── SAVE ──────────────────────────────────────────────────────
    playSaveEvent(event) {
        const isHome = event.team === 'home';
        this.shootAtGoal(isHome, {
            duration: 280,
            air: 40,
            onDone: () => {
                // Parried back out into play
                this.moveBall(
                    isHome ? 0.78 : 0.22,
                    0.5 + Phaser.Math.FloatBetween(-0.2, 0.2),
                    { duration: 520, air: 46, ease: 'Quad.easeOut' }
                );
            },
        });

        this.typewriterComment(
            `Great save! ${event.data.keeper.name} denies ${event.data.shooter.name}!`);
        this.showPlayerNameFlash(event.data.keeper.name);
    }

    // ── SHOT WIDE ─────────────────────────────────────────────────
    playShotWideEvent(event) {
        const isHome = event.team === 'home';
        this.moveBall(
            isHome ? 1.04 : -0.04,
            Math.random() > 0.5 ? 0.16 : 0.84,
            { duration: 340, air: 58, ease: 'Quad.easeIn' }
        );
        this.typewriterComment(`${event.data.shooter.name} fires wide! Close but no cigar.`);
    }

    // ── FOUL / CARDS ──────────────────────────────────────────────
    playFoulEvent(event) {
        audioManager.playWhistle();
        if (event.data.card) audioManager.playCard();

        const tint = event.data.card === 'red' ? C.bad
            : event.data.card === 'yellow' ? C.warn
            : 0xffffff;
        this.flashScreen(tint, event.data.card ? 0.26 : 0.18);

        if (event.data.card) {
            this.showCardAnimation(event.data.card);
            this.typewriterComment(
                `${event.data.card.toUpperCase()} CARD! ${event.data.fouler.name} brings down ${event.data.fouled.name}!`);
        } else {
            this.typewriterComment(
                `Foul by ${event.data.fouler.name} on ${event.data.fouled.name}.`);
        }

        this.showPlayerNameFlash(event.data.fouler.name);
    }

    flashScreen(color = 0xffffff, alpha = 0.2) {
        const { width, height } = this.cameras.main;
        const g = this.add.graphics().setDepth(D.flash);
        g.fillStyle(color, alpha);
        g.fillRect(0, 0, width, height);
        this.tweens.add({
            targets: g,
            alpha: 0,
            duration: 320,
            onComplete: () => g.destroy(),
        });
    }

    showCardAnimation(cardType) {
        const { width } = this.cameras.main;
        const color = cardType === 'red' ? C.bad : C.warn;
        const cx = width / 2 + 170;

        const card = this.add.container(cx, -70).setDepth(D.card);

        const g = this.add.graphics();
        g.fillStyle(C.panelEdge, 1);
        g.fillRoundedRect(-16, -23, 32, 46, 5);
        g.fillStyle(color, 1);
        g.fillRoundedRect(-13, -20, 26, 40, 4);
        g.fillStyle(0xffffff, 0.3);
        g.fillRect(-11, -18, 22, 10);
        card.add(g);

        const letter = new PixelText(this, 0, 0, cardType === 'red' ? 'R' : 'Y',
            { scale: 2, preset: 'dark' });
        letter.setOrigin(0.5, 0.5);
        letter.addTo(card, 0, 2);

        this.tweens.add({
            targets: card,
            y: 176,
            duration: 540,
            ease: 'Bounce.easeOut',
        });
        this.tweens.add({
            targets: card,
            angle: cardType === 'red' ? -14 : 12,
            duration: 540,
            ease: 'Quad.easeOut',
            onComplete: () => {
                this.time.delayedCall(1200, () => {
                    this.tweens.add({
                        targets: card,
                        y: 126,
                        alpha: 0,
                        duration: 480,
                        onComplete: () => card.destroy(),
                    });
                });
            },
        });
    }

    // ── CHANCE ────────────────────────────────────────────────────
    playChanceEvent(event) {
        if (event.data && event.data.player) {
            this.typewriterComment(`${event.data.player.name} creates a dangerous opportunity!`);
            this.showPlayerNameFlash(event.data.player.name);
        }
    }

    // ── NAME TAG FLASH ────────────────────────────────────────────
    showPlayerNameFlash(playerName) {
        const a = this.actors.find(
            x => x.player && x.player.name === playerName && x.chibi.container.active);
        if (!a) return;

        // A speech-bubble tail points down at the sprite, so the name is
        // clearly attributed to that chibi rather than floating loose.
        // The chibi is 43px tall above its feet anchor, so the plate rides at
        // -60: any closer and the 24px plate covers the head it's labelling.
        // The 8px tail closes the gap and lands on the crown.
        const tag = this.add.container(a.chibi.x, a.chibi.y - 60).setDepth(D.nameTag);

        const text = UI.label(this, 0, 0, playerName,
            { size: 11, bold: true, color: '#2b2b33', ox: 0.5, oy: 0.5 });
        const w = Math.max(44, text.width + 14);

        const g = this.add.graphics();
        g.fillStyle(C.panelEdge, 1);
        g.fillRoundedRect(-w / 2 - 2, -12, w + 4, 24, 6);
        g.fillTriangle(-8, 10, 8, 10, 0, 18);
        g.fillStyle(C.rowCream, 1);
        g.fillRoundedRect(-w / 2, -10, w, 20, 5);
        g.fillTriangle(-5.5, 9, 5.5, 9, 0, 15);
        tag.add(g);
        tag.add(text);

        a.chibi.hop(this, 7, 1);

        this.tweens.add({
            targets: tag,
            y: tag.y - 10,
            alpha: 0,
            duration: 1600,
            delay: 700,
            onComplete: () => tag.destroy(),
        });
    }

    // ── HALF TIME ─────────────────────────────────────────────────
    showHalfTime(width, height) {
        const banner = UI.banner(this, width / 2, height * 0.42, width, 'HALF TIME', {
            scale: 5,
            h: 58,
        });
        banner.setDepth(D.banner);
        banner.setScale(1, 0);

        this.tweens.add({ targets: banner, scaleY: 1, duration: 260, ease: 'Back.easeOut' });
        this.time.delayedCall(1600, () => {
            this.tweens.add({
                targets: banner,
                alpha: 0,
                duration: 440,
                onComplete: () => banner.destroy(),
            });
        });
    }

    // ── FULL TIME ─────────────────────────────────────────────────
    showFullTime(width, height) {
        if (this.clockText) this.clockText.setText('FT');

        audioManager.playWhistle();
        audioManager.stopCrowdAmbience();

        this.matchStarted = false;
        if (this.ballLoop) this.ballLoop.remove(false);

        const banner = UI.banner(this, width / 2, height * 0.42, width, 'FULL TIME', {
            scale: 5,
            h: 62,
        });
        banner.setDepth(D.banner);
        banner.setScale(1, 0);

        const line = this.plateLabel(width / 2, height * 0.42 + 54,
            `${this.shortName(this.homeKingdom)}  ${this.homeScore} - ${this.awayScore}  ${this.shortName(this.awayKingdom)}`,
            16);
        line.setDepth(D.banner);
        line.setAlpha(0);

        this.tweens.add({ targets: banner, scaleY: 1, duration: 320, ease: 'Back.easeOut' });
        this.tweens.add({ targets: line, alpha: 1, duration: 320, delay: 280 });

        if (this.pitch) this.pitch.crowdCheer(1);
        this.typewriterComment('The battle is over! The warriors lay down their arms.');

        // Persist the result
        const gameState = this.registry.get('gameState');
        gameState.results.push({
            home: this.homeKingdom.id,
            away: this.awayKingdom.id,
            homeScore: this.matchResult.homeScore,
            awayScore: this.matchResult.awayScore,
            season: gameState.season,
            week: gameState.week,
        });
        gameState.week++;
        this.registry.set('gameState', gameState);

        this.time.delayedCall(3500, () => {
            this.tweens.timeScale = 1;
            this.time.timeScale = 1;
            this.cameras.main.fadeOut(800, 0, 0, 0);
            this.cameras.main.once('camerafadeoutcomplete', () => {
                this.scene.start('MatchResultScene', {
                    result: this.matchResult,
                    homeKingdom: this.homeKingdom,
                    awayKingdom: this.awayKingdom,
                });
            });
        });
    }

    // ═══════════════════════════════════════════════════════════════
    // UPDATE — drive the chibi walk cycles
    // ═══════════════════════════════════════════════════════════════
    update(time, delta) {
        if (!this.actors || !this.actors.length) return;
        for (const a of this.actors) {
            if (a.chibi && a.chibi.container.active) a.chibi.tick(delta);
        }
    }
}
