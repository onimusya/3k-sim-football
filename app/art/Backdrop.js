// Backdrop — the inhabited stadium behind the menu-style scenes.
//
// This replaces the old per-scene wallpaper (banded sky + mowed grass stripes +
// a couple of circle clouds) with a real IsoPitch world: town skyline, road,
// trees, floodlights, covered terraces, a packed crowd, mown pitch, markings,
// goals and advertising hoarding — plus a handful of chibi figures strolling
// through the gaps the UI panels leave open.
//
// Every layer is pushed into a low depth band so the scene's panels (depth 10+)
// still sit cleanly on top; no dark scrim is used anywhere.

import { IsoPitch } from './IsoWorld.js';
import { Chibi } from './Chibi.js';
import { KIT } from './Palette.js';

const KITS = Object.values(KIT);
const HAIRS = [0x2e2118, 0x5a3418, 0xe8c060, 0xc85a2a, 0x8a6a3a, 0x9a9aa8];
const CROWNS = ['bowl', 'spiky', 'part', 'tall'];

// Depth offsets inside the backdrop band. Keep all of these below the scene's
// panel depth (10 in every scene that uses this).
const D = {
    sky: 0,
    town: 1,
    stands: 2,
    crowd: 3,
    surface: 4,
    markings: 5,
    goals: 6,
    fence: 7,
    figures: 8,
};

/**
 * One chibi walking back and forth along a horizontal screen-space lane.
 * Pauses briefly at each end, turns around, and keeps going.
 */
class Stroller {
    constructor(scene, spec, i) {
        const kit = spec.kit || KITS[(i * 2 + 1) % KITS.length];

        this.x0 = Math.min(spec.x0, spec.x1);
        this.x1 = Math.max(spec.x0, spec.x1);
        this.x = spec.x ?? this.x0 + (this.x1 - this.x0) * (((i * 0.37) + 0.12) % 1);
        this.dir = spec.dir ?? (i % 2 === 0 ? 1 : -1);
        this.speed = spec.speed ?? 16;
        this.pause = 0;

        this.chibi = new Chibi(scene, Math.round(this.x), spec.y, {
            jersey: kit.jersey,
            shorts: kit.shorts,
            hair: HAIRS[i % HAIRS.length],
            crown: CROWNS[i % CROWNS.length],
            px: 2,
        });
        this.chibi.setScale(spec.scale ?? 0.55);
        this.chibi.setDepth((spec.depth ?? D.figures) + i * 0.01);
        this.chibi.setWalking(true);
        this.chibi.faceVector(this.dir, 0);
    }

    tick(delta) {
        if (this.pause > 0) {
            this.pause -= delta;
            if (this.pause <= 0) this.chibi.setWalking(true);
            return;
        }

        this.chibi.tick(delta);
        this.x += (this.dir * this.speed * delta) / 1000;

        if (this.x <= this.x0 || this.x >= this.x1) {
            this.x = Math.min(this.x1, Math.max(this.x0, this.x));
            this.dir *= -1;
            this.chibi.faceVector(this.dir, 0);
            this.chibi.setWalking(false);
            this.pause = 500 + Math.random() * 900;
        }

        this.chibi.setPosition(Math.round(this.x), this.chibi.y);
    }

    destroy() {
        this.chibi.destroy();
    }
}

/**
 * Build the backdrop.
 *
 * @param {Phaser.Scene} scene
 * @param {object} opts
 *    cx, cy, spanX, spanY, shearX, tiltY — IsoPitch tuning (per scene)
 *    strollers — array of { y, x0, x1, x?, dir?, speed?, scale?, kit? }
 * @returns {{ pitch: IsoPitch, strollers: Stroller[], tick(delta), destroy() }}
 */
export function stadiumBackdrop(scene, opts = {}) {
    const pitch = new IsoPitch(scene, {
        cx: opts.cx ?? 480,
        cy: opts.cy ?? 600,
        spanX: opts.spanX ?? 1080,
        spanY: opts.spanY ?? 300,
        shearX: opts.shearX ?? -140,
        tiltY: opts.tiltY ?? 40,
    });
    pitch.build();

    const base = opts.depth ?? 0;
    const put = (layer, d) => { if (layer) layer.setDepth(base + d); };
    put(pitch.layers.sky, D.sky);
    put(pitch.layers.town, D.town);
    put(pitch.layers.stands, D.stands);
    put(pitch.layers.surface, D.surface);
    put(pitch.layers.markings, D.markings);
    put(pitch.layers.goalFar, D.goals);
    put(pitch.layers.goalNear, D.goals);
    put(pitch.layers.nearFence, D.fence);
    pitch.crowd.forEach((s) => s.setDepth(base + D.crowd));

    const strollers = (opts.strollers || []).map(
        (spec, i) => new Stroller(scene, { depth: base + D.figures, ...spec }, i)
    );

    return {
        pitch,
        strollers,
        tick(delta) {
            for (let i = 0; i < strollers.length; i++) strollers[i].tick(delta);
        },
        destroy() {
            strollers.forEach((s) => s.destroy());
        },
    };
}
