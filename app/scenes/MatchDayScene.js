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
        this.play = null;
        this.focusActor = null;
        this.focusMarker = null;
        this.commentaryLockUntil = 0;
        this.nameTags = [];

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
        this.initPlay();
    }

    buildTeamActors(kingdom, players, kit, team) {
        const slots = formationPositions(kingdom.formation, team);
        const lineup = this.lineupFor(players);

        // How far forward each slot sits within its own team's shape, 0 (deepest
        // outfielder) to 1 (furthest forward). Used to let strikers push high
        // while the back line stays honest.
        const outfield = slots.filter(s => s.role !== 'GK');
        const dirSign = this.attackDirFor(team);
        const advOf = (slot) => {
            if (slot.role === 'GK' || !outfield.length) return 0;
            const vals = outfield.map(s => s.fx * dirSign);
            const lo = Math.min(...vals), hi = Math.max(...vals);
            if (hi - lo < 1e-6) return 0.5;
            return (slot.fx * dirSign - lo) / (hi - lo);
        };

        slots.forEach((slot, i) => {
            const player = lineup[i % lineup.length];
            const look = lookForPlayer(player, kit);
            const p = this.pitch.project(slot.fx, slot.fy);

            const chibi = new Chibi(this, p.x, p.y, { ...look, px: 2 });
            chibi.setFacing('side', team === 'home');   // home looks right, away looks left
            chibi.setDepth(this.pitch.depthAt(slot.fx, slot.fy));

            const pace = (player.stats && player.stats.pace) || 70;

            this.actors.push({
                chibi,
                player,
                team,
                role: slot.role,
                kit,
                // formation slot — the shape the player returns to
                homeFx: slot.fx,
                homeFy: slot.fy,
                adv: advOf(slot),   // 0 = deepest defender, 1 = furthest forward
                // live position
                fx: slot.fx,
                fy: slot.fy,
                // steering target, recomputed each frame
                tx: slot.fx,
                ty: slot.fy,
                // field units per second, scaled by the warrior's pace
                speed: 0.052 + (pace / 99) * 0.062,
                job: 'hold',        // hold | carry | support | press | keeper
                moving: false,
                jitter: Math.random() * Math.PI * 2,
            });
        });
    }

    // ═══════════════════════════════════════════════════════════════
    // PLAY STATE
    //
    // The MatchEngine result is authoritative for the scoreline, so this layer
    // never invents goals — it simulates the *ball flow* between the scripted
    // events so the pitch reads like a game rather than a formation diagram.
    // ═══════════════════════════════════════════════════════════════
    initPlay() {
        this.play = {
            possession: 'home',
            carrier: null,
            phase: 'kickoff',
            ballLoose: false,
            inFlight: false,
            passCooldown: 900,
            frozen: 0,
        };
        this.kickoff('home');
    }

    /** +1 attacks toward fx=1, -1 attacks toward fx=0. */
    attackDirFor(team) {
        return team === 'home' ? 1 : -1;
    }

    targetGoalFx(team) {
        return team === 'home' ? 0.985 : 0.015;
    }

    ownGoalFx(team) {
        return team === 'home' ? 0.015 : 0.985;
    }

    teamActors(team, includeGK = true) {
        return this.actors.filter(a =>
            a.team === team &&
            a.chibi && a.chibi.container.active &&
            (includeGK || a.role !== 'GK'));
    }

    findActorByName(name, team) {
        if (!name) return null;
        const pool = team ? this.teamActors(team, false) : this.actors;
        return pool.find(a => a.player && a.player.name === name) || null;
    }

    setPossession(team, carrier = null) {
        const p = this.play;
        p.possession = team;
        p.ballLoose = false;
        p.inFlight = false;
        p.carrier = carrier || this.pickBuildUpPlayer(team);
        p.phase = 'build';
        p.passCooldown = 500 + Math.random() * 500;
        if (p.carrier) this.setFocus(p.carrier);
    }

    /** Whoever is closest to the ball on that team, ignoring the keeper. */
    pickBuildUpPlayer(team) {
        const b = this.ballState;
        let best = null, bestD = Infinity;
        for (const a of this.teamActors(team, false)) {
            const dx = a.fx - b.fx, dy = (a.fy - b.fy) * 0.45;
            const d = dx * dx + dy * dy;
            if (d < bestD) { bestD = d; best = a; }
        }
        return best || this.teamActors(team)[0] || null;
    }

    kickoff(team) {
        const p = this.play;
        // Reset both teams into their own halves and drop the ball on the spot.
        this.actors.forEach(a => {
            a.fx = a.homeFx;
            a.fy = a.homeFy;
            a.job = a.role === 'GK' ? 'keeper' : 'hold';
            this.placeActor(a);
        });
        this.ballState.fx = 0.5;
        this.ballState.fy = 0.5;
        this.ballState.air = 0;
        this.placeBall();

        p.phase = 'kickoff';
        p.possession = team;
        p.ballLoose = false;
        p.inFlight = false;
        p.frozen = 420;                       // brief settle before the tap-off
        p.carrier = this.pickBuildUpPlayer(team);
        if (p.carrier) this.setFocus(p.carrier);
        this.time.delayedCall(460, () => {
            if (this.matchStarted && this.play.phase === 'kickoff') this.play.phase = 'build';
        });
    }

    /** Force a team onto the front foot — used when the engine scripts a chance. */
    forceAttack(team, carrierActor = null) {
        const dir = this.attackDirFor(team);
        const carrier = carrierActor || this.pickBuildUpPlayer(team);
        if (!carrier) return null;
        // Move the ball to that player so the run-up reads as continuous play
        this.ballState.fx = carrier.fx;
        this.ballState.fy = carrier.fy;
        this.placeBall();
        this.setPossession(team, carrier);
        this.play.phase = 'attack';
        // Nudge the carrier into the final third so the attack has somewhere to go
        carrier.fx = Phaser.Math.Clamp(carrier.fx + dir * 0.10, 0.06, 0.94);
        return carrier;
    }

    // ── steering targets ──────────────────────────────────────────

    /**
     * Formation slot translated along the pitch by where the ball is. This is
     * what stops both teams sitting in their own half all match: the whole shape
     * slides with play, further for the team in possession.
     */
    shapeTarget(a) {
        const b = this.ballState;
        const p = this.play;
        const attacking = p.possession === a.team;
        const dir = this.attackDirFor(a.team);

        // Everyone tracks the ball's position along the pitch...
        const ballPull = (b.fx - 0.5) * 0.78;
        // ...and the attacking side commits a real push upfield, scaled by how
        // advanced the player is. Strikers get right up the pitch while the back
        // line stays honest, which is what makes the shape stretch and compress
        // instead of sliding as one rigid block.
        const adv = a.adv ?? 0.5;
        const commit = attacking
            ? dir * (0.10 + adv * 0.30)
            : dir * -(0.04 + adv * 0.12);

        let tx = a.homeFx + ballPull + commit;
        // Defenders hold a line rather than streaming forward with the striker
        if (a.role !== 'GK') {
            const ownGoal = this.ownGoalFx(a.team);
            const maxUp = dir > 0 ? 0.94 : 0.06;
            tx = dir > 0
                ? Phaser.Math.Clamp(tx, Math.min(ownGoal + 0.06, 0.2), maxUp)
                : Phaser.Math.Clamp(tx, maxUp, Math.max(ownGoal - 0.06, 0.8));
        }

        // Drift laterally toward the ball's channel, keeping formation width
        const ty = a.homeFy + (b.fy - 0.5) * 0.34;

        return { tx, ty };
    }

    /** Keeper hugs the goal line and tracks the ball across it. */
    keeperTarget(a) {
        const b = this.ballState;
        const line = this.ownGoalFx(a.team);
        const dir = this.attackDirFor(a.team);
        // Comes a little off the line when the ball is near
        const threat = 1 - Math.min(1, Math.abs(b.fx - line) / 0.35);
        const tx = line + dir * (0.02 + threat * 0.045);
        const ty = Phaser.Math.Clamp(0.5 + (b.fy - 0.5) * 0.55, 0.36, 0.64);
        return { tx, ty };
    }

    /**
     * Decide what each player is doing this frame: carry, support the carrier,
     * press the ball, keep goal, or hold shape.
     */
    assignJobs() {
        const p = this.play;
        const b = this.ballState;

        for (const a of this.actors) {
            a.job = a.role === 'GK' ? 'keeper' : 'hold';
        }
        if (p.carrier && p.carrier.chibi.container.active) p.carrier.job = 'carry';

        const attackers = this.teamActors(p.possession, false)
            .filter(a => a !== p.carrier);
        const defenders = this.teamActors(
            p.possession === 'home' ? 'away' : 'home', false);

        const distToBall = (a) => {
            const dx = a.fx - b.fx, dy = (a.fy - b.fy) * 0.45;
            return dx * dx + dy * dy;
        };

        // Two nearest attackers make supporting runs ahead of the ball
        attackers.sort((x, y) => distToBall(x) - distToBall(y));
        attackers.slice(0, 2).forEach(a => { a.job = 'support'; });

        // Two nearest defenders close the ball down
        defenders.sort((x, y) => distToBall(x) - distToBall(y));
        defenders.slice(0, 2).forEach(a => { a.job = 'press'; });
    }

    /** Per-frame target for one actor based on its current job. */
    targetFor(a) {
        const p = this.play;
        const b = this.ballState;
        const dir = this.attackDirFor(a.team);

        switch (a.job) {
            case 'keeper':
                return this.keeperTarget(a);

            case 'carry': {
                // Drive at the opponent goal, weaving slightly so it isn't a
                // straight line, and drifting toward the middle to shoot.
                const goalFx = this.targetGoalFx(a.team);
                const weave = Math.sin(this.time.now / 420 + a.jitter) * 0.05;
                return {
                    tx: goalFx,
                    ty: Phaser.Math.Clamp(0.5 + weave + (a.fy - 0.5) * 0.4, 0.12, 0.88),
                };
            }

            case 'support': {
                // Run into space ahead of the ball, offset to one flank
                const side = a.homeFy < 0.5 ? -1 : 1;
                return {
                    tx: Phaser.Math.Clamp(b.fx + dir * 0.13, 0.08, 0.92),
                    ty: Phaser.Math.Clamp(b.fy + side * 0.16, 0.1, 0.9),
                };
            }

            case 'press': {
                // Go straight at the ball
                const lead = p.carrier ? dir * -0.015 : 0;
                return {
                    tx: Phaser.Math.Clamp(b.fx + lead, 0.03, 0.97),
                    ty: Phaser.Math.Clamp(b.fy, 0.06, 0.94),
                };
            }

            default:
                return this.shapeTarget(a);
        }
    }

    /**
     * Nudge apart players who end up on the same spot. Without this, converging
     * runs stack the sprites and it reads as a rendering fault rather than a
     * challenge for the ball.
     */
    separation(a) {
        let sx = 0, sy = 0;
        const R = 0.028;
        for (const o of this.actors) {
            if (o === a || !o.chibi || !o.chibi.container.active) continue;
            const dx = a.fx - o.fx;
            const dy = (a.fy - o.fy) * 0.45;
            const d = Math.hypot(dx, dy);
            if (d > 1e-5 && d < R) {
                const push = (R - d) / R;
                sx += (dx / d) * push;
                sy += (dy / d) * push;
            }
        }
        return { sx, sy };
    }

    /** Move one actor toward its target, driving the walk cycle and facing. */
    steerActor(a, dt) {
        const t = this.targetFor(a);
        // Keep a little personal space, except for whoever is on the ball —
        // a tackle should look like contact.
        if (a.job !== 'carry') {
            const s = this.separation(a);
            t.tx += s.sx * 0.045;
            t.ty += s.sy * 0.045;
        }
        a.tx = t.tx;
        a.ty = t.ty;

        let dx = a.tx - a.fx;
        // fy spans less screen distance than fx, so lateral motion needs a boost
        // to look like the same running speed.
        let dy = (a.ty - a.fy) * 1.55;

        const dist = Math.hypot(dx, dy);
        const sprint = (a.job === 'carry' || a.job === 'press' || a.job === 'support')
            ? 1.55 : 1;
        const step = a.speed * sprint * dt;

        if (dist < 0.006 || step <= 0) {
            if (a.moving) {
                a.moving = false;
                a.chibi.setWalking(false);
                a.chibi.setFacing('side', a.team === 'home');
            }
            return;
        }

        const k = Math.min(1, step / dist);
        a.fx = Phaser.Math.Clamp(a.fx + dx * k, 0.015, 0.985);
        a.fy = Phaser.Math.Clamp(a.fy + (a.ty - a.fy) * k, 0.05, 0.95);

        if (!a.moving) { a.moving = true; a.chibi.setWalking(true); }
        a.chibi.faceVector(dx, a.ty - a.fy);
        this.placeActor(a);
    }

    // ── ball flow ─────────────────────────────────────────────────

    /**
     * Advance possession every frame: keep the ball at the carrier's feet, run
     * the pass clock, and let defenders win it back.
     */
    updatePlay(dt, delta) {
        const p = this.play;
        if (!p) return;

        if (p.frozen > 0) {
            p.frozen -= delta;
            return;
        }
        // Shots and celebrations own the ball; don't fight the tween.
        if (p.phase === 'shot' || p.phase === 'celebrate' || p.phase === 'setpiece') return;

        const carrier = p.carrier;
        const carrierLive = carrier && carrier.chibi && carrier.chibi.container.active;

        if (!p.ballLoose && carrierLive) {
            // Ball sits just in front of the carrier's feet with a dribble bob
            const dir = this.attackDirFor(carrier.team);
            const bob = Math.sin(this.time.now / 90) * 0.004;
            this.ballState.fx = Phaser.Math.Clamp(carrier.fx + dir * 0.022, 0.01, 0.99);
            this.ballState.fy = Phaser.Math.Clamp(carrier.fy + bob, 0.04, 0.96);
            this.ballState.air = 0;
            this.placeBall();

            // Ran out of pitch: recycle rather than standing on the goal line
            // waiting for a scripted shot that may be minutes away.
            const dir2 = this.attackDirFor(carrier.team);
            const deep = dir2 > 0 ? carrier.fx > 0.90 : carrier.fx < 0.10;
            if (deep) {
                this.choosePass(true);
                return;
            }

            // Pass clock
            p.passCooldown -= delta;
            if (p.passCooldown <= 0) {
                this.choosePass();
                return;
            }

            // Pressure: a defender getting on top of the carrier wins the ball
            const stealer = this.pressureOn(carrier);
            if (stealer) this.turnover(stealer);
            return;
        }

        // Ball is loose — nearest player picks it up. Skipped while a pass or
        // shot is still travelling, otherwise a player standing near the passer
        // re-collects it immediately and the ball never actually goes anywhere.
        if (p.ballLoose && !p.inFlight) {
            const a = this.nearestActorToBall();
            if (a) {
                const dx = a.fx - this.ballState.fx;
                const dy = (a.fy - this.ballState.fy) * 0.45;
                if (Math.hypot(dx, dy) < 0.05) this.setPossession(a.team, a);
            }
        }
    }

    /** A defender within tackling range, if any. */
    pressureOn(carrier) {
        const other = carrier.team === 'home' ? 'away' : 'home';
        for (const d of this.teamActors(other, false)) {
            const dx = d.fx - carrier.fx;
            const dy = (d.fy - carrier.fy) * 0.45;
            if (Math.hypot(dx, dy) < 0.022) {
                // Defence vs the carrier's control decides it
                const def = (d.player.stats && d.player.stats.defense) || 70;
                const ctl = (carrier.player.stats && carrier.player.stats.passing) || 70;
                if (Math.random() < 0.022 + (def - ctl) / 4000) return d;
            }
        }
        return null;
    }

    turnover(winner) {
        this.setPossession(winner.team, winner);
        this.play.phase = 'build';
        this.typewriterCommentIfIdle(
            `${winner.player.name} wins the ball back!`);
    }

    /**
     * Pick a pass and play it. Forward options are preferred, weighted by the
     * passer's passing stat, so good passers progress play more often.
     */
    choosePass(recycle = false) {
        const p = this.play;
        const carrier = p.carrier;
        if (!carrier) return;

        const dir = this.attackDirFor(carrier.team);
        const mates = this.teamActors(carrier.team, false).filter(a => a !== carrier);
        if (!mates.length) return;

        const passSkill = (carrier.player.stats && carrier.player.stats.passing) || 70;

        const scored = mates.map(m => {
            const forward = (m.fx - carrier.fx) * dir;      // >0 means upfield
            const dx = m.fx - carrier.fx, dy = (m.fy - carrier.fy) * 0.45;
            const range = Math.hypot(dx, dy);
            // Normally favour progressive passes; when recycling out of a dead
            // end, deliberately look backwards for a teammate in space.
            let s = (recycle ? -forward * 1.8 : forward * 2.4)
                  - Math.abs(range - 0.18) * 1.6;
            s += (Math.random() - 0.5) * 0.55;
            return { m, s, range, forward };
        }).sort((a, b) => b.s - a.s);

        const pick = scored[0];
        if (!pick) return;

        // Long balls go higher and are easier to intercept
        const long = pick.range > 0.26;
        this.doPass(pick.m, {
            duration: 260 + pick.range * 900,
            air: long ? 34 : 14,
            intercept: Math.max(0.04, 0.24 - passSkill / 500) + (long ? 0.10 : 0),
        });
    }

    doPass(receiver, opts = {}) {
        const p = this.play;
        const from = p.carrier;
        p.ballLoose = true;
        p.inFlight = true;
        p.carrier = null;
        p.phase = 'pass';

        // The receiver breaks toward the ball so the pass reads as intentional
        receiver.job = 'support';
        this.setFocus(receiver);

        const tx = Phaser.Math.Clamp(receiver.fx + (Math.random() - 0.5) * 0.02, 0.03, 0.97);
        const ty = Phaser.Math.Clamp(receiver.fy + (Math.random() - 0.5) * 0.02, 0.06, 0.94);

        this.moveBall(tx, ty, {
            duration: opts.duration ?? 420,
            air: opts.air ?? 16,
            ease: 'Quad.easeOut',
            onDone: () => {
                this.play.inFlight = false;
                if (!this.matchStarted) return;
                // Interception check — a defender sitting on the landing spot
                const thief = this.interceptorAt(tx, ty, from ? from.team : receiver.team);
                if (thief && Math.random() < (opts.intercept ?? 0.12)) {
                    this.setPossession(thief.team, thief);
                    this.typewriterCommentIfIdle(`${thief.player.name} reads it and intercepts!`);
                    return;
                }
                if (receiver.chibi && receiver.chibi.container.active) {
                    this.setPossession(receiver.team, receiver);
                } else {
                    this.play.ballLoose = true;
                }
            },
        });
    }

    /** Opposition player nearest a point, if they're close enough to nick it. */
    interceptorAt(fx, fy, passingTeam) {
        const other = passingTeam === 'home' ? 'away' : 'home';
        let best = null, bestD = Infinity;
        for (const d of this.teamActors(other, false)) {
            const dx = d.fx - fx, dy = (d.fy - fy) * 0.45;
            const dd = Math.hypot(dx, dy);
            if (dd < 0.05 && dd < bestD) { bestD = dd; best = d; }
        }
        return best;
    }

    /**
     * Drive a scripted shot from a specific player: bring him onto the ball near
     * the box, then strike. `outcome` decides what happens after the strike.
     */
    shootFromActor(shooter, outcome, onDone) {
        const p = this.play;
        const team = shooter ? shooter.team : p.possession;
        const dir = this.attackDirFor(team);
        const goalFx = this.targetGoalFx(team);

        if (shooter) {
            // Place the shooter in a plausible shooting position and give him the ball
            shooter.fx = Phaser.Math.Clamp(goalFx - dir * (0.10 + Math.random() * 0.07), 0.05, 0.95);
            shooter.fy = Phaser.Math.Clamp(0.5 + (Math.random() - 0.5) * 0.26, 0.2, 0.8);
            this.placeActor(shooter);
            this.ballState.fx = shooter.fx + dir * 0.02;
            this.ballState.fy = shooter.fy;
            this.placeBall();
            this.setFocus(shooter);
            shooter.chibi.faceVector(dir, 0);
        }

        p.phase = 'shot';
        p.possession = team;
        p.carrier = null;
        p.ballLoose = false;
        p.inFlight = true;

        // Strike
        const targetFy = outcome === 'wide'
            ? (Math.random() > 0.5 ? 0.16 : 0.84)
            : 0.5 + Phaser.Math.FloatBetween(-0.045, 0.045);
        const targetFx = outcome === 'wide'
            ? Phaser.Math.Clamp(goalFx + dir * 0.045, -0.04, 1.04)
            : goalFx;

        this.moveBall(targetFx, targetFy, {
            duration: outcome === 'wide' ? 340 : 300,
            air: outcome === 'wide' ? 58 : 40,
            ease: 'Quad.easeIn',
            onDone: () => {
                this.play.inFlight = false;
                if (onDone) onDone();
            },
        });
        return shooter;
    }

    /** Whistle stop: everyone holds position for a beat. */
    freezePlay(ms) {
        this.play.frozen = ms;
        this.actors.forEach(a => {
            if (a.chibi && a.chibi.container.active) {
                a.chibi.setWalking(false);
                a.moving = false;
            }
        });
    }

    /** Restart with a team in possession after a stoppage. */
    restart(team, atFx, atFy, delay = 700) {
        this.play.phase = 'setpiece';
        this.play.inFlight = false;
        this.ballState.fx = Phaser.Math.Clamp(atFx, 0.03, 0.97);
        this.ballState.fy = Phaser.Math.Clamp(atFy, 0.06, 0.94);
        this.ballState.air = 0;
        this.placeBall();

        this.time.delayedCall(delay, () => {
            if (!this.matchStarted) return;
            const taker = this.pickBuildUpPlayer(team);
            if (taker) {
                taker.fx = this.ballState.fx - this.attackDirFor(team) * 0.02;
                taker.fy = this.ballState.fy;
                this.placeActor(taker);
            }
            this.setPossession(team, taker);
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
        // Possession is driven per-frame from update() — no random ball loop.
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
     * Put a kit-accent ellipse under the feet of the player on the ball, so the
     * eye always has somewhere to land among 22 sprites.
     */
    setFocus(a) {
        if (!this.matchStarted || !a || !a.chibi || !a.chibi.container.active) return;
        if (a === this.focusActor) return;

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

    /**
     * Commentary that won't stamp on a scripted line. Flow chatter (tackles,
     * interceptions) is lower priority than the engine's own events.
     */
    typewriterCommentIfIdle(text) {
        if (this.commentaryLockUntil && this.time.now < this.commentaryLockUntil) return;
        this.typewriterComment(text);
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
        this.commentaryLockUntil = this.time.now + 2600;

        // The scorer strikes it himself, then the whole side celebrates and we
        // reset to a kickoff for the team that conceded.
        const team = isHome ? 'home' : 'away';
        const scorer = this.findActorByName(event.data.scorer.name, team);
        this.shootFromActor(scorer, 'goal', () => {
            this.play.phase = 'celebrate';
        });

        this.cameras.main.shake(320, 0.008);

        this.time.delayedCall(3200, () => {
            if (!this.matchStarted) return;
            this.kickoff(isHome ? 'away' : 'home');
        });

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
        const team = isHome ? 'home' : 'away';
        const shooter = this.findActorByName(event.data.shooter.name, team);
        this.commentaryLockUntil = this.time.now + 1600;

        this.shootFromActor(shooter, 'save', () => {
            // Keeper parries it back into play, then his side builds from there
            const outFx = isHome ? 0.74 : 0.26;
            const outFy = 0.5 + Phaser.Math.FloatBetween(-0.2, 0.2);
            this.moveBall(outFx, outFy, {
                duration: 480, air: 46, ease: 'Quad.easeOut',
                onDone: () => {
                    if (!this.matchStarted) return;
                    this.play.phase = 'build';
                    this.play.ballLoose = true;   // scramble for the rebound
                },
            });
        });

        this.typewriterComment(
            `Great save! ${event.data.keeper.name} denies ${event.data.shooter.name}!`);
        this.showPlayerNameFlash(event.data.keeper.name);
    }

    // ── SHOT WIDE ─────────────────────────────────────────────────
    playShotWideEvent(event) {
        const isHome = event.team === 'home';
        const team = isHome ? 'home' : 'away';
        const shooter = this.findActorByName(event.data.shooter.name, team);
        this.commentaryLockUntil = this.time.now + 1600;

        this.shootFromActor(shooter, 'wide', () => {
            if (!this.matchStarted) return;
            // Goal kick to the other side
            const gkFx = isHome ? 0.06 : 0.94;
            this.restart(isHome ? 'away' : 'home', gkFx, 0.5, 600);
        });

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

        this.commentaryLockUntil = this.time.now + 1800;

        if (event.data.card) {
            this.showCardAnimation(event.data.card);
            this.typewriterComment(
                `${event.data.card.toUpperCase()} CARD! ${event.data.fouler.name} brings down ${event.data.fouled.name}!`);
        } else {
            this.typewriterComment(
                `Foul by ${event.data.fouler.name} on ${event.data.fouled.name}.`);
        }

        this.showPlayerNameFlash(event.data.fouler.name);

        // Whistle: play stops where the ball is, then the fouled side restarts.
        // event.team is the side that committed the foul.
        if (this.matchStarted && this.play) {
            const fouledTeam = event.team === 'home' ? 'away' : 'home';
            this.freezePlay(event.data.card ? 1100 : 700);
            this.restart(fouledTeam, this.ballState.fx, this.ballState.fy,
                event.data.card ? 1200 : 800);
        }
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
            this.commentaryLockUntil = this.time.now + 1200;
            this.typewriterComment(`${event.data.player.name} creates a dangerous opportunity!`);
            this.showPlayerNameFlash(event.data.player.name);

            // Hand that side the ball and send them upfield, so the "chance"
            // actually looks like a surge rather than a caption.
            if (this.matchStarted && this.play) {
                const team = event.team === 'home' ? 'home' : 'away';
                const maker = this.findActorByName(event.data.player.name, team);
                this.forceAttack(team, maker);
            }
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

        // Players genuinely run now, so the tag has to track its owner —
        // otherwise it's left stranded on empty grass. Only the rise and fade
        // are tweened; the anchor is re-applied from the actor every frame.
        const anim = { rise: 0 };
        this.nameTags.push({ tag, actor: a, anim });

        this.tweens.add({
            targets: anim,
            rise: 10,
            duration: 1600,
            delay: 700,
        });
        this.tweens.add({
            targets: tag,
            alpha: 0,
            duration: 1600,
            delay: 700,
            onComplete: () => {
                this.nameTags = this.nameTags.filter(n => n.tag !== tag);
                tag.destroy();
            },
        });
    }

    /** Keep floating name tags pinned above the player they belong to. */
    updateNameTags() {
        if (!this.nameTags || !this.nameTags.length) return;
        for (const n of this.nameTags) {
            const c = n.actor && n.actor.chibi;
            if (!c || !c.container.active || !n.tag.active) continue;
            n.tag.setPosition(c.x, c.y - 60 - n.anim.rise);
        }
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
    // UPDATE — possession simulation, steering, then walk cycles
    // ═══════════════════════════════════════════════════════════════
    update(time, delta) {
        if (!this.actors || !this.actors.length) return;

        // delta is unscaled by timeScale, so fold the speed setting in here to
        // keep the run cycles and movement in step at 2x and 4x.
        const scaled = Math.min(delta, 50) * (this.gameSpeed || 1);
        const dt = scaled / 1000;

        if (this.matchStarted && this.play) {
            this.updatePlay(dt, scaled);
            this.assignJobs();
            for (const a of this.actors) {
                if (a.chibi && a.chibi.container.active) this.steerActor(a, dt);
            }
        }

        for (const a of this.actors) {
            if (a.chibi && a.chibi.container.active) a.chibi.tick(scaled);
        }

        this.updateNameTags();
    }
}
