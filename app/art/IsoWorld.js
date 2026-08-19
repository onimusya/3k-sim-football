// IsoWorld — isometric pitch, stands, crowd, and surrounding town scenery.
//
// Field space: fx along the length (0 = left goal line, 1 = right goal line),
//              fy across the width (0 = far touchline, 1 = near touchline).
// Screen space: a squashed 2:1-ish diamond. (0,0) is the TOP corner,
//              (1,0) the RIGHT, (1,1) the BOTTOM, (0,1) the LEFT.

import { C } from './Palette.js';

// Sheared projection rather than a strict 45° diamond: the touchlines stay
// close to horizontal (so the pitch fills a 16:10 frame) while the goal lines
// slant, which is the look the reference uses.
export class IsoPitch {
    /**
     * @param {Phaser.Scene} scene
     * @param {object} o { cx, cy, spanX, spanY, shearX, tiltY, surface }
     */
    constructor(scene, o = {}) {
        this.scene = scene;
        this.cx = o.cx ?? 480;
        this.cy = o.cy ?? 372;
        this.spanX = o.spanX ?? o.len ?? 820;   // horizontal extent goal-to-goal
        this.spanY = o.spanY ?? o.wid ?? 322;   // vertical extent across the width
        this.shearX = o.shearX ?? -190;         // how much the goal lines lean
        this.tiltY = o.tiltY ?? 88;             // slight downhill along the length
        this.surface = o.surface || 'grass';
        this.layers = {};
        this.crowd = [];
    }

    // ── projection ────────────────────────────────────────────────
    project(fx, fy) {
        return {
            x: this.cx + (fx - 0.5) * this.spanX + (fy - 0.5) * this.shearX,
            y: this.cy + (fx - 0.5) * this.tiltY + (fy - 0.5) * this.spanY,
        };
    }

    /** Depth for correct overlap: nearer (higher fy) draws on top. */
    depthAt(fx, fy) {
        return 1000 + fy * 800 + fx * 40;
    }

    poly(pts) {
        return pts.map(([fx, fy]) => {
            const p = this.project(fx, fy);
            return { x: p.x, y: p.y };
        });
    }

    // ── build everything ──────────────────────────────────────────
    build() {
        this.drawSkyAndGround();
        this.drawTown();
        this.drawStands();
        this.drawSurface();
        this.drawMarkings();
        this.drawGoals();
        this.drawNearFence();
        return this;
    }

    /** Screen point pushed away from the pitch centre — handy for placing props. */
    outward(fx, fy, dist) {
        const p = this.project(fx, fy);
        const dx = p.x - this.cx;
        const dy = p.y - this.cy;
        const m = Math.hypot(dx, dy) || 1;
        return { x: p.x + (dx / m) * dist, y: p.y + (dy / m) * dist };
    }

    // Sky band at the top, generic ground everywhere else
    drawSkyAndGround() {
        const { width, height } = this.scene.cameras.main;
        const g = this.scene.add.graphics().setDepth(0);

        // Horizon sits a little above the pitch's top corner
        const skyH = Math.max(78, this.project(0, 0).y - 58);
        this.horizonY = skyH;
        const bands = 10;
        for (let i = 0; i < bands; i++) {
            const col = Phaser.Display.Color.Interpolate.ColorWithColor(
                Phaser.Display.Color.ValueToColor(C.skyLight),
                Phaser.Display.Color.ValueToColor(C.skyDeep),
                bands - 1, i
            );
            g.fillStyle(Phaser.Display.Color.GetColor(col.r, col.g, col.b), 1);
            g.fillRect(0, (skyH / bands) * i, width, skyH / bands + 1);
        }

        // outer ground
        g.fillStyle(C.grassDark, 1);
        g.fillRect(0, skyH, width, height - skyH);

        // a couple of soft clouds
        const cloud = (x, y, s) => {
            g.fillStyle(0xffffff, 0.85);
            g.fillCircle(x, y, 13 * s);
            g.fillCircle(x + 15 * s, y + 3 * s, 10 * s);
            g.fillCircle(x - 15 * s, y + 4 * s, 9 * s);
            g.fillEllipse(x, y + 8 * s, 54 * s, 12 * s);
        };
        cloud(150, Math.min(46, skyH * 0.4), 1);
        cloud(760, Math.min(34, skyH * 0.3), 0.8);
        cloud(470, Math.min(24, skyH * 0.22), 0.6);

        this.layers.sky = g;
    }

    // Town skyline drawn in SCREEN space so it always reads as background,
    // plus trees/floodlights hugging the pitch edges.
    drawTown() {
        const { width } = this.scene.cameras.main;
        const g = this.scene.add.graphics().setDepth(2);
        const horizon = this.horizonY;

        const building = (cx, baseY, bw, bh, roof) => {
            g.fillStyle(C.panelEdge, 1);
            g.fillRect(cx - bw / 2 - 1, baseY - bh - 1, bw + 2, bh + 2);
            g.fillStyle(C.buildWall, 1);
            g.fillRect(cx - bw / 2, baseY - bh, bw, bh);
            g.fillStyle(C.buildWallAlt, 1);
            g.fillRect(cx - bw / 2, baseY - bh * 0.32, bw, bh * 0.32);
            // roof
            g.fillStyle(C.panelEdge, 1);
            g.fillRect(cx - bw / 2 - 3, baseY - bh - 6, bw + 6, 6);
            g.fillStyle(roof, 1);
            g.fillRect(cx - bw / 2 - 2, baseY - bh - 5, bw + 4, 4);
            // windows
            g.fillStyle(0x8fd0ee, 1);
            const cols = Math.max(1, Math.floor((bw - 8) / 12));
            const rows = Math.max(1, Math.floor((bh - 10) / 15));
            for (let r = 0; r < rows; r++)
                for (let c = 0; c < cols; c++)
                    g.fillRect(cx - bw / 2 + 5 + c * 12, baseY - bh + 6 + r * 15, 7, 8);
        };

        // Skyline band
        const specs = [
            [40, 44, 40], [96, 62, 56], [162, 38, 34], [214, 54, 46],
            [286, 70, 40], [352, 46, 52], [412, 58, 36], [478, 74, 48],
            [552, 44, 40], [608, 62, 56], [676, 38, 32], [728, 56, 44],
            [796, 68, 38], [864, 46, 50], [922, 52, 34],
        ];
        specs.forEach(([cx, bw, bh], i) => {
            building(cx, horizon + 4, bw, bh, i % 2 ? C.buildRoofAlt : C.buildRoof);
        });

        // Road along the horizon
        g.fillStyle(C.road, 1);
        g.fillRect(0, horizon + 2, width, 14);
        g.fillStyle(C.panelEdge, 0.5);
        g.fillRect(0, horizon + 2, width, 1);
        g.fillStyle(C.roadLine, 0.8);
        for (let x = 6; x < width; x += 34) g.fillRect(x, horizon + 8, 16, 2);

        const tree = (x, y, s = 1) => {
            g.fillStyle(C.panelEdge, 1);
            g.fillRect(x - 3 * s, y - 15 * s, 6 * s, 15 * s);
            g.fillStyle(C.treeTrunk, 1);
            g.fillRect(x - 2 * s, y - 14 * s, 4 * s, 14 * s);
            g.fillStyle(C.panelEdge, 1);
            g.fillCircle(x, y - 23 * s, 12 * s);
            g.fillStyle(C.treeLeaf, 1);
            g.fillCircle(x, y - 23 * s, 10.5 * s);
            g.fillStyle(C.treeLeafAlt, 1);
            g.fillCircle(x - 3 * s, y - 26 * s, 4.5 * s);
        };

        // Trees hugging the outside of the near edges
        for (let t = 0.06; t <= 0.94; t += 0.14) {
            const p = this.outward(t, 1, 62);
            tree(p.x, p.y, 0.85);
        }
        for (let t = 0.12; t <= 0.9; t += 0.2) {
            const p = this.outward(1, t, 66);
            tree(p.x, p.y, 0.8);
        }
        [0.2, 0.55, 0.9].forEach((t) => {
            const p = this.outward(0, t, 58);
            tree(p.x, p.y, 0.8);
        });

        const floodlight = (x, y, s = 1) => {
            g.fillStyle(C.panelEdge, 1);
            g.fillRect(x - 3 * s, y - 78 * s, 6 * s, 78 * s);
            g.fillStyle(C.lightPole, 1);
            g.fillRect(x - 2 * s, y - 77 * s, 4 * s, 77 * s);
            g.fillStyle(C.panelEdge, 1);
            g.fillRect(x - 21 * s, y - 96 * s, 42 * s, 21 * s);
            g.fillStyle(0xd8dde2, 1);
            g.fillRect(x - 19 * s, y - 94 * s, 38 * s, 17 * s);
            g.fillStyle(0xfff9c4, 1);
            for (let r = 0; r < 2; r++)
                for (let c = 0; c < 4; c++)
                    g.fillRect(x - 16 * s + c * 9 * s, y - 91 * s + r * 8 * s, 7 * s, 6 * s);
        };

        // Floodlights just outside the two far corners
        const fl1 = this.outward(0, 0, 40);
        const fl2 = this.outward(1, 0, 46);
        floodlight(fl1.x, fl1.y, 0.85);
        floodlight(fl2.x, fl2.y, 0.85);

        this.layers.town = g;
    }

    // Covered terrace along the far touchline, with neat rows of spectators
    drawStands() {
        const g = this.scene.add.graphics().setDepth(3);

        const strip = (fyOut, fyIn, col, fx0 = -0.14, fx1 = 1.14) => {
            const outer = this.poly([[fx0, fyOut], [fx1, fyOut], [fx1, fyIn], [fx0, fyIn]]);
            g.fillStyle(C.panelEdge, 1); g.fillPoints(outer, true);
            const inner = this.poly([
                [fx0 + 0.004, fyOut + 0.003], [fx1 - 0.004, fyOut + 0.003],
                [fx1 - 0.004, fyIn - 0.003], [fx0 + 0.004, fyIn - 0.003],
            ]);
            g.fillStyle(col, 1); g.fillPoints(inner, true);
        };

        // Four terrace steps along the far touchline, lightest nearest the pitch
        strip(-0.192, -0.150, 0x25603f);
        strip(-0.150, -0.108, 0x2b6a49);
        strip(-0.108, -0.070, 0x337954);
        strip(-0.070, -0.032, 0x3c8a60);

        // Concrete lip at the pitch edge
        strip(-0.032, -0.014, 0xb9c2b4);

        // Terraces wrapping behind BOTH goals so no bare ground is left in frame
        const goalStrip = (fxOut, fxIn, col) => {
            const outer = this.poly([[fxOut, -0.03], [fxIn, -0.03], [fxIn, 1.03], [fxOut, 1.03]]);
            g.fillStyle(C.panelEdge, 1); g.fillPoints(outer, true);
            const inner = this.poly([
                [fxOut + 0.003, -0.026], [fxIn - 0.003, -0.026],
                [fxIn - 0.003, 1.026], [fxOut + 0.003, 1.026],
            ]);
            g.fillStyle(col, 1); g.fillPoints(inner, true);
        };
        // behind the left goal
        goalStrip(-0.150, -0.112, 0x2b6a49);
        goalStrip(-0.112, -0.074, 0x337954);
        goalStrip(-0.074, -0.036, 0x3c8a60);
        goalStrip(-0.036, -0.016, 0xb9c2b4);
        // behind the right goal
        goalStrip(1.150, 1.112, 0x2b6a49);
        goalStrip(1.112, 1.074, 0x337954);
        goalStrip(1.074, 1.036, 0x3c8a60);
        goalStrip(1.036, 1.016, 0xb9c2b4);

        // Roof canopy, sitting above and behind the terrace
        const roof = this.poly([[-0.17, -0.176], [1.17, -0.176], [1.17, -0.140], [-0.17, -0.140]]);
        g.fillStyle(C.panelEdge, 1); g.fillPoints(roof, true);
        const roofIn = this.poly([[-0.164, -0.172], [1.164, -0.172], [1.164, -0.144], [-0.164, -0.144]]);
        g.fillStyle(C.standRoof, 1); g.fillPoints(roofIn, true);
        g.fillStyle(0x8fd0ee, 0.45);
        g.fillPoints(this.poly([[-0.164, -0.170], [1.164, -0.170], [1.164, -0.161], [-0.164, -0.161]]), true);

        this.layers.stands = g;
        this.spawnCrowd();
    }

    // Evenly spaced spectator sprites — reads as a crowd, not confetti
    spawnCrowd() {
        const scene = this.scene;
        const shirts = [0xd8483c, 0x3f7fd8, 0xd8ab2c, 0x2f9e57, 0xe8e8e8, 0x8a4fb0];

        const hairs = [0x2e2118, 0x5a3418, 0xe8c060, 0xc85a2a, 0x9a9aa8, 0x241c14];
        const skins = [0xf6d3a8, 0xefc396, 0xe0ac7c];

        /**
         * A spectator is a tiny PERSON, not a coloured tick: visible head, hair,
         * shoulders and arms. Flat blobs are the thing that most obviously reads
         * as placeholder art in a stand.
         *   . transparent  k outline  h hair  s skin  j shirt
         */
        const SPEC = [
            '..hhh..',
            '.hhhhh.',
            '.hsssh.',
            '.ssoss.',
            '..sss..',
            '.jjjjj.',
            'sjjjjjs',
            'sjjjjjs',
            '.jj.jj.',
        ];

        const key = (col, hair, skin) => {
            const k = `spec_${col.toString(16)}_${hair.toString(16)}_${skin.toString(16)}`;
            if (scene.textures.exists(k)) return k;

            const P = 2;
            const W = SPEC[0].length;
            const H = SPEC.length;
            const PAD = 1;
            const g = scene.make.graphics({ add: false });

            const grid = [];
            for (let y = 0; y < H + PAD * 2; y++) grid.push(new Array(W + PAD * 2).fill(null));
            for (let y = 0; y < H; y++) {
                for (let x = 0; x < W; x++) {
                    const ch = SPEC[y][x];
                    if (ch === '.') continue;
                    grid[y + PAD][x + PAD] =
                        ch === 'h' ? hair :
                        ch === 's' ? skin :
                        ch === 'o' ? 0x2b2b33 :   // eyes
                        col;
                }
            }

            // silhouette outline so each fan separates from its neighbour
            g.fillStyle(0x24242c, 1);
            for (let y = 0; y < grid.length; y++) {
                for (let x = 0; x < grid[0].length; x++) {
                    if (grid[y][x] !== null) continue;
                    let touch = false;
                    for (let dy = -1; dy <= 1 && !touch; dy++) {
                        for (let dx = -1; dx <= 1; dx++) {
                            const ny = y + dy, nx = x + dx;
                            if (ny < 0 || nx < 0 || ny >= grid.length || nx >= grid[0].length) continue;
                            if (grid[ny][nx] !== null) { touch = true; break; }
                        }
                    }
                    if (touch) g.fillRect(x * P, y * P, P, P);
                }
            }
            for (let y = 0; y < grid.length; y++) {
                for (let x = 0; x < grid[0].length; x++) {
                    if (grid[y][x] === null) continue;
                    g.fillStyle(grid[y][x], 1);
                    g.fillRect(x * P, y * P, P, P);
                }
            }

            g.generateTexture(k, (W + PAD * 2) * P, (H + PAD * 2) * P);
            g.destroy();
            return k;
        };

        const seat = (fx, fy, i, r) => {
            const n = i * 7 + r * 3;
            // A few empty seats so attendance reads visually rather than as a
            // perfectly solid wall of people.
            if ((n * 13) % 17 === 0) return;
            const p = this.project(fx, fy);
            const col = shirts[n % shirts.length];
            const hair = hairs[(n * 3) % hairs.length];
            const skin = skins[(n * 5) % skins.length];
            const s = scene.add.image(p.x, p.y, key(col, hair, skin));
            s.setOrigin(0.5, 1).setDepth(4);
            this.crowd.push(s);
        };

        // Far touchline — 4 packed rows. Below ~55 per row the seats separate
        // and the stand reads as a picket fence rather than a crowd.
        const rows = [-0.170, -0.130, -0.091, -0.053];
        rows.forEach((fy, r) => {
            const count = 56;
            for (let i = 0; i < count; i++) {
                const off = (r % 2) * (0.5 / count);
                seat(-0.13 + (1.26 / (count - 1)) * i + off, fy, i, r);
            }
        });

        // Behind both goals
        [[-0.131, -0.093, -0.055], [1.131, 1.093, 1.055]].forEach((set, side) => {
            set.forEach((fx, r) => {
                const count = 22;
                for (let i = 0; i < count; i++) {
                    const off = (r % 2) * (0.5 / count);
                    seat(fx, -0.02 + (1.04 / (count - 1)) * i + off, i + side * 3, r);
                }
            });
        });
    }

    /** Ripple of hops through the crowd. */
    crowdCheer(intensity = 1) {
        this.crowd.forEach((s, i) => {
            this.scene.tweens.add({
                targets: s,
                y: s.y - (3 + Math.random() * 4) * intensity,
                duration: 130 + Math.random() * 60,
                yoyo: true,
                repeat: Math.floor(1 + Math.random() * 3),
                delay: (i % 24) * 14,
            });
        });
    }

    // Mown grass surface
    drawSurface() {
        const g = this.scene.add.graphics().setDepth(5);
        const base = this.surface === 'dirt' ? C.dirt : C.grass;
        const alt = this.surface === 'dirt' ? C.dirtAlt : C.grassAlt;

        // base
        g.fillStyle(base, 1);
        g.fillPoints(this.poly([[0, 0], [1, 0], [1, 1], [0, 1]]), true);

        // mowing stripes along the length
        const N = 14;
        for (let i = 0; i < N; i++) {
            if (i % 2 === 0) continue;
            const f0 = i / N, f1 = (i + 1) / N;
            g.fillStyle(alt, 1);
            g.fillPoints(this.poly([[f0, 0], [f1, 0], [f1, 1], [f0, 1]]), true);
        }

        // subtle wear speckle
        for (let i = 0; i < 160; i++) {
            const fx = Math.random(), fy = Math.random();
            const p = this.project(fx, fy);
            g.fillStyle(0x000000, 0.04 + Math.random() * 0.04);
            g.fillRect(p.x, p.y, 3, 2);
        }

        // touchline shadow from the stands, adds depth
        g.fillStyle(0x000000, 0.12);
        g.fillPoints(this.poly([[0, 0], [1, 0], [1, 0.045], [0, 0.045]]), true);

        this.layers.surface = g;
    }

    // White line markings, projected so circles become proper iso ellipses
    drawMarkings() {
        const g = this.scene.add.graphics().setDepth(6);
        const W = 0xffffff;
        const stroke = (pts, thickness = 3, alpha = 0.95, close = false) => {
            g.lineStyle(thickness, W, alpha);
            g.beginPath();
            g.moveTo(pts[0].x, pts[0].y);
            for (let i = 1; i < pts.length; i++) g.lineTo(pts[i].x, pts[i].y);
            if (close) g.closePath();
            g.strokePath();
        };

        // Outer boundary
        stroke(this.poly([[0, 0], [1, 0], [1, 1], [0, 1]]), 3, 0.95, true);
        // Halfway line
        stroke(this.poly([[0.5, 0], [0.5, 1]]), 3);

        // Centre circle (ellipse in field space → polygon in screen space)
        const ring = (cxF, cyF, rxF, ryF, from = 0, to = Math.PI * 2, steps = 44) => {
            const pts = [];
            for (let i = 0; i <= steps; i++) {
                const t = from + (to - from) * (i / steps);
                pts.push(this.project(cxF + Math.cos(t) * rxF, cyF + Math.sin(t) * ryF));
            }
            return pts.map((p) => ({ x: p.x, y: p.y }));
        };
        stroke(ring(0.5, 0.5, 0.087, 0.135), 3);

        // Centre spot
        const cs = this.project(0.5, 0.5);
        g.fillStyle(W, 0.95); g.fillCircle(cs.x, cs.y, 3.5);

        // Penalty boxes (16.5m) and goal areas (5.5m)
        const boxes = [
            { fx0: 0, fx1: 0.157, halfW: 0.296 },
            { fx0: 1 - 0.157, fx1: 1, halfW: 0.296 },
            { fx0: 0, fx1: 0.052, halfW: 0.135 },
            { fx0: 1 - 0.052, fx1: 1, halfW: 0.135 },
        ];
        boxes.forEach(({ fx0, fx1, halfW }) => {
            stroke(this.poly([
                [fx0, 0.5 - halfW], [fx1, 0.5 - halfW],
                [fx1, 0.5 + halfW], [fx0, 0.5 + halfW],
            ]), 3, 0.9);
        });

        // Penalty spots + arcs
        [0.105, 0.895].forEach((fx) => {
            const p = this.project(fx, 0.5);
            g.fillStyle(W, 0.95); g.fillCircle(p.x, p.y, 3);
            const isLeft = fx < 0.5;
            stroke(ring(fx, 0.5, 0.087, 0.135,
                isLeft ? -Math.PI / 2.35 : Math.PI - Math.PI / 2.35,
                isLeft ? Math.PI / 2.35 : Math.PI + Math.PI / 2.35, 22), 3, 0.9);
        });

        // Corner arcs
        [[0, 0, 0, Math.PI / 2], [1, 0, Math.PI / 2, Math.PI],
         [1, 1, Math.PI, Math.PI * 1.5], [0, 1, Math.PI * 1.5, Math.PI * 2]]
            .forEach(([fx, fy, a0, a1]) => {
                stroke(ring(fx, fy, 0.014, 0.022, a0, a1, 10), 3, 0.9);
            });

        // Corner flags
        [[0, 0], [1, 0], [1, 1], [0, 1]].forEach(([fx, fy]) => {
            const p = this.project(fx, fy);
            g.fillStyle(C.panelEdge, 1); g.fillRect(p.x - 1.5, p.y - 22, 3, 22);
            g.fillStyle(0xf2f2f2, 1); g.fillRect(p.x - 1, p.y - 21, 2, 21);
            g.fillStyle(C.numGold, 1);
            g.fillTriangle(p.x + 1, p.y - 21, p.x + 12, p.y - 17, p.x + 1, p.y - 13);
        });

        this.layers.markings = g;
    }

    // Goals with posts, crossbar and net mesh
    drawGoals() {
        const gh = 40;           // goal height in screen px
        const halfMouth = 0.058; // 7.32m of a 68m width

        const drawGoal = (fx, depthBias) => {
            const g = this.scene.add.graphics().setDepth(this.depthAt(fx, 0.5) + depthBias);
            const outward = fx < 0.5 ? -0.045 : 0.045;

            const a = this.project(fx, 0.5 - halfMouth);          // front-left post base
            const b = this.project(fx, 0.5 + halfMouth);          // front-right post base
            const a2 = this.project(fx + outward, 0.5 - halfMouth); // back-left base
            const b2 = this.project(fx + outward, 0.5 + halfMouth); // back-right base

            // Net volume (semi-transparent white)
            g.fillStyle(0xffffff, 0.16);
            g.fillPoints([
                { x: a.x, y: a.y - gh }, { x: b.x, y: b.y - gh },
                { x: b2.x, y: b2.y - gh }, { x: a2.x, y: a2.y - gh },
            ], true);
            g.fillPoints([
                { x: a2.x, y: a2.y - gh }, { x: b2.x, y: b2.y - gh },
                { x: b2.x, y: b2.y }, { x: a2.x, y: a2.y },
            ], true);
            g.fillPoints([
                { x: a.x, y: a.y - gh }, { x: a2.x, y: a2.y - gh },
                { x: a2.x, y: a2.y }, { x: a.x, y: a.y },
            ], true);
            g.fillPoints([
                { x: b.x, y: b.y - gh }, { x: b2.x, y: b2.y - gh },
                { x: b2.x, y: b2.y }, { x: b.x, y: b.y },
            ], true);

            // Net mesh lines on the back face
            g.lineStyle(1, 0xffffff, 0.4);
            for (let i = 1; i < 8; i++) {
                const t = i / 8;
                const px1 = a2.x + (b2.x - a2.x) * t;
                const py1 = a2.y + (b2.y - a2.y) * t;
                g.beginPath(); g.moveTo(px1, py1 - gh); g.lineTo(px1, py1); g.strokePath();
            }
            for (let i = 1; i < 4; i++) {
                const yy = gh * (i / 4);
                g.beginPath();
                g.moveTo(a2.x, a2.y - gh + yy);
                g.lineTo(b2.x, b2.y - gh + yy);
                g.strokePath();
            }

            // Frame: posts + crossbar (dark outline then white)
            const bar = (x1, y1, x2, y2, t) => {
                g.lineStyle(t + 2, C.panelEdge, 1);
                g.beginPath(); g.moveTo(x1, y1); g.lineTo(x2, y2); g.strokePath();
                g.lineStyle(t, 0xffffff, 1);
                g.beginPath(); g.moveTo(x1, y1); g.lineTo(x2, y2); g.strokePath();
            };
            bar(a.x, a.y, a.x, a.y - gh, 5);            // left post
            bar(b.x, b.y, b.x, b.y - gh, 5);            // right post
            bar(a.x, a.y - gh, b.x, b.y - gh, 5);       // crossbar
            bar(a2.x, a2.y, a2.x, a2.y - gh, 3);        // back posts
            bar(b2.x, b2.y, b2.x, b2.y - gh, 3);
            bar(a2.x, a2.y - gh, b2.x, b2.y - gh, 3);
            bar(a.x, a.y - gh, a2.x, a2.y - gh, 3);     // top rails
            bar(b.x, b.y - gh, b2.x, b2.y - gh, 3);

            return g;
        };

        this.layers.goalFar = drawGoal(0, -20);
        this.layers.goalNear = drawGoal(1, 400);
        this.goalHeight = gh;
    }

    // Low advertising hoarding along the near edges, drawn on top of players
    drawNearFence() {
        const g = this.scene.add.graphics().setDepth(9000);
        const h = 20;

        const run = (f0, f1, steps) => {
            for (let i = 0; i < steps; i++) {
                const t0 = i / steps, t1 = (i + 1) / steps;
                const p0 = this.project(
                    f0[0] + (f1[0] - f0[0]) * t0, f0[1] + (f1[1] - f0[1]) * t0);
                const p1 = this.project(
                    f0[0] + (f1[0] - f0[0]) * t1, f0[1] + (f1[1] - f0[1]) * t1);
                g.fillStyle(C.panelEdge, 1);
                g.fillPoints([
                    { x: p0.x, y: p0.y - h - 1 }, { x: p1.x, y: p1.y - h - 1 },
                    { x: p1.x, y: p1.y + 1 }, { x: p0.x, y: p0.y + 1 },
                ], true);
                g.fillStyle(i % 2 === 0 ? 0xf4f6f8 : 0xdfe6ec, 1);
                g.fillPoints([
                    { x: p0.x, y: p0.y - h }, { x: p1.x, y: p1.y - h },
                    { x: p1.x, y: p1.y }, { x: p0.x, y: p0.y },
                ], true);
                g.fillStyle(i % 2 === 0 ? C.hudGreen : C.titleBarTop, 0.75);
                g.fillPoints([
                    { x: p0.x, y: p0.y - h + 5 }, { x: p1.x, y: p1.y - h + 5 },
                    { x: p1.x, y: p1.y - 4 }, { x: p0.x, y: p0.y - 4 },
                ], true);
            }
        };

        run([0, 1.035], [1, 1.035], 14);    // near touchline
        run([1.035, 0], [1.035, 1], 10);    // right goal line
        run([-0.035, 0], [-0.035, 1], 10);  // left goal line (was missing — asymmetric)

        this.layers.nearFence = g;
    }

    /** Screen position for a ball at field pos with an air height (px). */
    ballPos(fx, fy, air = 0) {
        const p = this.project(fx, fy);
        return { x: p.x, y: p.y - air, groundY: p.y };
    }
}

/**
 * Formation → field positions in normalized coords.
 * side 'home' defends fx=0 and attacks toward fx=1.
 */
export function formationPositions(formation, side) {
    const lines = String(formation).split('-').map(Number);
    const pos = [];

    // Keeper
    pos.push({ fx: 0.045, fy: 0.5, role: 'GK' });

    // Keep each side inside its own half so the two teams read as distinct
    const zoneStart = 0.15;
    const zoneEnd = 0.455;
    const n = lines.length;

    lines.forEach((count, li) => {
        const fx = zoneStart + ((zoneEnd - zoneStart) * (li + 1)) / (n + 0.15);
        for (let i = 0; i < count; i++) {
            // spread across the full width, not just the middle
            const fy = 0.1 + (0.8 * i) / Math.max(1, count - 1) + (count === 1 ? 0.3 : 0);
            // stagger ranks so they don't form a rigid grid
            const jitter = (li % 2 === 0 ? 0.016 : -0.016) * ((i % 2) ? 1 : -1);
            pos.push({ fx, fy: Math.max(0.07, Math.min(0.93, fy + jitter)), role: 'OUT' });
        }
    });

    if (side === 'away') {
        return pos.map((p) => ({ ...p, fx: 1 - p.fx }));
    }
    return pos;
}
