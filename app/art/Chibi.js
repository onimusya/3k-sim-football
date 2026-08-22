// Chibi — procedural pixel-art characters.
// Big round head, dot eyes, colored kit, hard dark outline, oval shadow.
// Generates cached textures so thousands of draws stay cheap.
//
// Color keys in the templates:
//   .  transparent      h  hair        s  skin
//   e  eye (dark)       m  mouth       j  jersey
//   p  shorts           b  boots       w  white (keeper gloves / trim)

// Hair crown variants (rows 1-3). 'H' is a lightened hair tone used as a
// top rim-light so the head reads as a sphere instead of a flat decal.
const CROWNS = {
    bowl: [
        '....HHHHHH....',
        '..hHhhhhhhHh..',
        '..hhhhhhhhhh..',
    ],
    spiky: [
        '...H.H.H.H....',
        '..hHhHhHhHhh..',
        '..hhhhhhhhhh..',
    ],
    part: [
        '...HHHHHHH....',
        '..hhhHhhhhhs..',
        '..hhhhhhhhss..',
    ],
    tall: [
        '....HHHHHH....',
        '...hHhhhhHh...',
        '..hhhhhhhhhh..',
    ],
};

export const HAIR_STYLES = Object.keys(CROWNS);

// Distinguishing features. Six recoloured clones read as one character, so each
// of these changes the SILHOUETTE — beard mass, headgear, or body width — and
// stays legible at 34px with colour stripped out.
//   B = beard    P = plume/crown accent
const FEATURES = {
    none: (r) => r,

    beard: (r) => {
        r[8] = '...BBmmmmBB...';   // jaw sides, mouth still visible
        r[9] = '....BBBBBB....';   // chin
        return r;
    },

    // Guan Yu territory: beard tapers down onto the chest. It has to TAPER —
    // a solid block just reads as a black bib at this size.
    longbeard: (r) => {
        r[8] = '...BBmmmmBB...';
        r[9] = '....BBBBBB....';
        r[10] = '...jBBBBBBj...';
        r[11] = '.jjj.BBBB.jjj.';
        r[12] = '.sjjj.BB.jjjs.';
        return r;
    },

    // Plumed war helmet: plume above, and a brim a pixel wider than plain hair
    // so the head silhouette itself changes.
    helmet: (r) => {
        r[0] = '.....PPPP.....';
        r[4] = '.hhhsssssshhh.';
        return r;
    },

    // Spiked coronet
    crown: (r) => {
        r[0] = '..P.P.PP.P.P..';
        return r;
    },

    // Broad, heavy build
    wide: (r) => {
        r[10] = '..jjjjjjjjjj..';
        r[11] = 'jjjjjjjjjjjjjj';
        r[12] = 'sjjjjjjjjjjjjs';
        r[13] = '..pppppppppp..';
        return r;
    },

    // Heavy build AND a beard
    bigbeard: (r) => {
        FEATURES.wide(r);
        r[8] = '...BBmmmmBB...';
        r[9] = '....BBBBBB....';
        return r;
    },

    // Beard under a plumed helmet
    helmbeard: (r) => {
        FEATURES.beard(r);
        r[0] = '.....PPPP.....';
        r[4] = '.hhhsssssshhh.';
        return r;
    },
};

export const FEATURE_NAMES = Object.keys(FEATURES);

// Body rows shared by every facing. Arms end in skin-toned hands so the
// silhouette reads as a person rather than a tube.
const BODY_DOWN = [
    '...jjjjjjjj...',
    '.jjjjjjjjjjjj.',
    '.sjjjjjjjjjjs.',
    '...pppppppp...',
];

const BODY_SIDE = [
    '...jjjjjjj....',
    '..jjjjjjjjj...',
    '..sjjjjjjjs...',
    '...ppppppp....',
];

function applyFeature(rows, feature) {
    const fn = FEATURES[feature] || FEATURES.none;
    return fn(rows);
}

function faceDown(crown, feature) {
    return applyFeature([
        '..............',
        ...CROWNS[crown],
        '..hhsssssshh..',
        '..hssssssssh..',
        '..sseesseess..',
        '..ssssssssss..',
        '...ssmmmmss...',
        '....ssssss....',
        ...BODY_DOWN,
        '...pp....pp...',
        '...bb....bb...',
    ], feature);
}

function faceUp(crown, feature) {
    // No face from behind, so a beard would not show — only headgear and build.
    const back = ['helmet', 'crown', 'wide'].includes(feature)
        ? feature
        : feature === 'bigbeard' ? 'wide'
        : feature === 'helmbeard' ? 'helmet'
        : 'none';
    return applyFeature([
        '..............',
        ...CROWNS[crown],
        '..hhhhhhhhhh..',
        '..hhhhhhhhhh..',
        '..hhhhhhhhhh..',
        '..hhhhhhhhhh..',
        '...hhhhhhhh...',
        '....hhhhhh....',
        ...BODY_DOWN,
        '...pp....pp...',
        '...bb....bb...',
    ], back);
}

// Facing left: one visible eye pair pushed left, hair covers the far side
function faceSide(crown, feature) {
    const rows = [
        '..............',
        ...CROWNS[crown],
        '..hssssssshh..',
        '..sssssssshh..',
        '..sseessssh...',
        '..ssssssssh...',
        '...smmsssh....',
        '....sssss.....',
        ...BODY_SIDE,
        '...pp..pp.....',
        '...bb..bb.....',
    ];

    // Profile beards/builds need their own narrower masks
    switch (feature) {
        case 'beard':
        case 'helmbeard':
            rows[8] = '..BBmmBBBh....';
            rows[9] = '...BBBBBB.....';
            if (feature === 'helmbeard') {
                rows[0] = '.....PPPP.....';
                rows[4] = '.hhssssssshh..';
            }
            break;
        case 'longbeard':
            rows[8] = '..BBmmBBBh....';
            rows[9] = '...BBBBBB.....';
            rows[10] = '..jBBBBBBj....';
            rows[11] = '.jj.BBBB.jj...';
            break;
        case 'helmet':
            rows[0] = '.....PPPP.....';
            rows[4] = '.hhssssssshh..';
            break;
        case 'crown':
            rows[0] = '..P.P.PP.P....';
            break;
        case 'wide':
            rows[10] = '..jjjjjjjj....';
            rows[11] = '.jjjjjjjjjj...';
            rows[12] = 'sjjjjjjjjjjs..';
            rows[13] = '..pppppppp....';
            break;
        case 'bigbeard':
            rows[8] = '..BBmmBBBh....';
            rows[9] = '...BBBBBB.....';
            rows[10] = '..jjjjjjjj....';
            rows[11] = '.jjjjjjjjjj...';
            rows[12] = 'sjjjjjjjjjjs..';
            rows[13] = '..pppppppp....';
            break;
        default:
            break;
    }
    return rows;
}

// Leg variants for walk cycle (rows 14 & 15). Index 3 is the kick pose, which
// the walk cycle never selects — see Chibi.kick().
const LEGS = [
    ['...pp....pp...', '...bb....bb...'], // 0 idle / stand
    ['....pp..pp....', '....bb..bb....'], // 1 mid stride
    ['..pp......pp..', '..bb......bb..'], // 2 wide stride
    ['..pp......pp..', '.bb........bb.'], // 3 kick — braced wide on both feet
];

const LEGS_SIDE = [
    ['...pp..pp.....', '...bb..bb.....'],
    ['....pppp......', '....bbbb......'],
    ['..pp....pp....', '..bb....bb....'],
    // 3 kick — near leg swung right through, far leg planted.
    //
    // Two things make this read at 32px. The boot leaves the turf line (nothing
    // on row 15 under it) so the outline pass draws air beneath it, and it is
    // pushed all the way clear of the torso: boots are near-black, the same
    // family as the outline and most hair, so a raised foot tucked under the body
    // just thickens the dark mass at the bottom of the sprite and reads as
    // nothing at all.
    ['bbpp...pp.....', '.......bb.....'],
];

const OUTLINE = 0x24242c;

/** Compose a template with a leg variant applied (legs live on rows 14-15). */
function withLegs(template, legSet, frame) {
    const rows = template.slice();
    const legs = legSet[frame % legSet.length];
    rows[14] = legs[0];
    rows[15] = legs[1];
    return rows;
}

/** Lighten a color by a factor, used for the hair rim-light. */
function lighten(color, amt = 0.34) {
    const r = Math.min(255, ((color >> 16) & 0xff) + 255 * amt);
    const g = Math.min(255, ((color >> 8) & 0xff) + 255 * amt);
    const b = Math.min(255, (color & 0xff) + 255 * amt);
    return (Math.round(r) << 16) | (Math.round(g) << 8) | Math.round(b);
}

/**
 * Build a texture from a template + colors.
 * Pads by 1 cell so the outline has room, then outlines the silhouette.
 */
function buildTexture(scene, key, rows, colors, px) {
    if (scene.textures.exists(key)) return key;

    const H = rows.length;
    const W = rows[0].length;
    const PAD = 1;
    const gridW = W + PAD * 2;
    const gridH = H + PAD * 2;

    // Fill grid with color values (null = empty)
    const grid = [];
    for (let y = 0; y < gridH; y++) {
        grid.push(new Array(gridW).fill(null));
    }

    for (let y = 0; y < H; y++) {
        for (let x = 0; x < W; x++) {
            const ch = rows[y][x];
            if (ch === '.') continue;
            let col;
            switch (ch) {
                case 'h': col = colors.hair; break;
                case 'H': col = colors.hairLight; break;
                case 'B': col = colors.beard; break;
                case 'P': col = colors.plume; break;
                case 's': col = colors.skin; break;
                case 'e': col = colors.eye; break;
                case 'm': col = colors.mouth; break;
                case 'j': col = colors.jersey; break;
                case 'p': col = colors.shorts; break;
                case 'b': col = colors.boots; break;
                case 'w': col = 0xffffff; break;
                default:  col = colors.jersey;
            }
            grid[y + PAD][x + PAD] = col;
        }
    }

    // Outline pass — empty cells touching a filled cell (8-neighbour)
    const outlineCells = [];
    for (let y = 0; y < gridH; y++) {
        for (let x = 0; x < gridW; x++) {
            if (grid[y][x] !== null) continue;
            let touches = false;
            for (let dy = -1; dy <= 1 && !touches; dy++) {
                for (let dx = -1; dx <= 1; dx++) {
                    if (!dx && !dy) continue;
                    const ny = y + dy, nx = x + dx;
                    if (ny < 0 || ny >= gridH || nx < 0 || nx >= gridW) continue;
                    if (grid[ny][nx] !== null) { touches = true; break; }
                }
            }
            if (touches) outlineCells.push([x, y]);
        }
    }

    const g = scene.make.graphics({ x: 0, y: 0, add: false });

    g.fillStyle(OUTLINE, 1);
    outlineCells.forEach(([x, y]) => g.fillRect(x * px, y * px, px, px));

    for (let y = 0; y < gridH; y++) {
        for (let x = 0; x < gridW; x++) {
            const col = grid[y][x];
            if (col === null) continue;
            g.fillStyle(col, 1);
            g.fillRect(x * px, y * px, px, px);
        }
    }

    g.generateTexture(key, gridW * px, gridH * px);
    g.destroy();
    return key;
}

/** Darken a color by a factor, used for beards against the hair tone. */
function darken(color, amt = 0.16) {
    const r = Math.max(0, ((color >> 16) & 0xff) - 255 * amt);
    const g = Math.max(0, ((color >> 8) & 0xff) - 255 * amt);
    const b = Math.max(0, (color & 0xff) - 255 * amt);
    return (Math.round(r) << 16) | (Math.round(g) << 8) | Math.round(b);
}

function colorSet(opts) {
    const hair = opts.hair ?? 0x2e2118;
    return {
        hair,
        hairLight: opts.hairLight ?? lighten(hair),
        // Facial hair sits only a touch off the hair tone. Darkening it much
        // turns the beard into a void against a coloured shirt.
        beard:  opts.beard  ?? darken(hair, 0.03),
        plume:  opts.plume  ?? 0xe8462e,
        skin:   opts.skin   ?? 0xf6d3a8,
        eye:    opts.eye    ?? 0x24242c,
        mouth:  opts.mouth  ?? 0xc4705f,
        jersey: opts.jersey ?? 0x3f7fd8,
        shorts: opts.shorts ?? 0x24528f,
        boots:  opts.boots  ?? 0x2a2a30,
    };
}

/**
 * Get (creating if needed) a chibi texture key.
 *
 * @param {Phaser.Scene} scene
 * @param {object} o  { jersey, shorts, hair, skin, facing:'down'|'up'|'side', frame:0..2, px }
 */
export function chibiTexture(scene, o = {}) {
    const facing = o.facing || 'down';
    const frame = o.frame ?? 0;
    const px = o.px ?? 2;
    const crown = CROWNS[o.crown] ? o.crown : 'bowl';
    const feature = FEATURES[o.feature] ? o.feature : 'none';
    const c = colorSet(o);

    const key = [
        'chibi',
        facing,
        crown,
        feature,
        frame,
        px,
        c.jersey.toString(16),
        c.shorts.toString(16),
        c.hair.toString(16),
        c.skin.toString(16),
        c.plume.toString(16),
    ].join('_');

    if (scene.textures.exists(key)) return key;

    let base, legSet;
    if (facing === 'up') { base = faceUp(crown, feature); legSet = LEGS; }
    else if (facing === 'side') { base = faceSide(crown, feature); legSet = LEGS_SIDE; }
    else { base = faceDown(crown, feature); legSet = LEGS; }

    const rows = withLegs(base, legSet, frame);
    return buildTexture(scene, key, rows, c, px);
}

/**
 * Register walk animations for a given look. Returns the anim key prefix.
 * Creates `<prefix>_walk` and `<prefix>_idle`.
 */
export function ensureChibiAnims(scene, o = {}) {
    const px = o.px ?? 2;
    const facing = o.facing || 'down';
    const c = colorSet(o);
    const crown = CROWNS[o.crown] ? o.crown : 'bowl';
    const prefix = ['ca', facing, crown, px, c.jersey.toString(16), c.hair.toString(16)].join('_');

    const walkKey = `${prefix}_walk`;
    if (scene.anims.exists(walkKey)) return prefix;

    const frames = [0, 1, 0, 2].map((f) => ({
        key: chibiTexture(scene, { ...o, facing, frame: f, px }),
    }));

    scene.anims.create({
        key: walkKey,
        frames,
        frameRate: 6,
        repeat: -1,
    });

    scene.anims.create({
        key: `${prefix}_idle`,
        frames: [{ key: chibiTexture(scene, { ...o, facing, frame: 0, px }) }],
        frameRate: 1,
    });

    return prefix;
}

/**
 * A complete chibi actor: shadow ellipse + sprite, grouped in a container.
 * The container's (0,0) sits at the character's FEET, which makes iso depth
 * sorting and positioning straightforward.
 */
export class Chibi {
    constructor(scene, x, y, look = {}) {
        this.scene = scene;
        this.look = { px: 2, ...look };
        this.facing = look.facing || 'down';

        this.container = scene.add.container(x, y);

        const px = this.look.px;
        // Shadow sits just under the feet
        this.shadow = scene.add.ellipse(0, 1, 11 * px, 4.5 * px, 0x000000, 0.28);
        this.container.add(this.shadow);

        const key = chibiTexture(scene, { ...this.look, facing: this.facing, frame: 0 });
        this.sprite = scene.add.image(0, 0, key);
        this.sprite.setOrigin(0.5, 1); // feet anchored
        this.container.add(this.sprite);

        this.frame = 0;
        this.walking = false;
        this.kicking = false;
        this._t = 0;
    }

    setFacing(facing, flip = false) {
        if (this.facing === facing && this.sprite.flipX === flip) return this;
        this.facing = facing;
        this.sprite.flipX = flip;
        this._apply();
        return this;
    }

    /**
     * Point the character based on a movement vector.
     * Back-facing ('up') is avoided by default: it hides the kit colour, and on a
     * busy pitch that makes players unidentifiable. Pass allowUp:true to opt in.
     */
    faceVector(dx, dy, allowUp = false) {
        if (Math.abs(dx) > Math.abs(dy) * 0.6) {
            this.setFacing('side', dx > 0);
        } else if (dy < 0 && allowUp) {
            this.setFacing('up', false);
        } else {
            this.setFacing('down', false);
        }
        return this;
    }

    setWalking(on) {
        this.walking = on;
        // The scene calls this every frame, so a kick has to survive it —
        // otherwise the pose is overwritten before it can be seen.
        if (this.kicking) return this;
        if (!on) { this.frame = 0; this._apply(); }
        return this;
    }

    /** Call from the scene's update loop. */
    tick(delta) {
        if (this.kicking || !this.walking) return;
        this._t += delta;
        if (this._t >= 130) {
            this._t = 0;
            this.frame = (this.frame + 1) % 4;
            this._apply();
        }
    }

    _apply() {
        const seq = [0, 1, 0, 2];
        const f = this.kicking ? 3 : (this.walking ? seq[this.frame] : 0);
        const key = chibiTexture(this.scene, { ...this.look, facing: this.facing, frame: f });
        this.sprite.setTexture(key);
    }

    setPosition(x, y) { this.container.setPosition(x, y); return this; }
    setDepth(d) { this.container.setDepth(d); return this; }
    setScale(s) { this.container.setScale(s); return this; }
    setAlpha(a) { this.container.setAlpha(a); return this; }
    setTint(c) { this.sprite.setTint(c); return this; }
    clearTint() { this.sprite.clearTint(); return this; }
    get x() { return this.container.x; }
    get y() { return this.container.y; }
    destroy() { this.container.destroy(); }

    /** Little celebration hop. */
    hop(scene, height = 10, times = 3) {
        scene.tweens.add({
            targets: this.sprite,
            y: -height,
            duration: 180,
            yoyo: true,
            repeat: times - 1,
            ease: 'Quad.easeOut',
            // yoyo returns to the recorded start value, but only if the tween is
            // allowed to finish. A kick() landing mid-hop kills it.
            onComplete: () => { if (this.sprite && this.sprite.active) this.sprite.y = 0; },
        });
        return this;
    }

    /**
     * Strike the ball: swing the extended-leg pose and lean into the contact.
     *
     * The lean matters as much as the leg. At 34px a single frame change is easy
     * to miss, but the whole body tipping over its planted foot is not — the
     * sprite's origin is already at the feet, so rotating it pivots in the right
     * place with no extra maths.
     *
     * `dirX` is the direction of the strike; positive is to the right.
     */
    kick(scene, dirX = 1, ms = 200) {
        if (!this.sprite || !this.sprite.active) return this;

        // Face along the strike so the swinging boot points at the ball
        if (dirX) this.setFacing('side', dirX > 0);

        this.kicking = true;
        this._apply();

        const lean = dirX >= 0 ? 13 : -13;
        // Killing the sprite's tweens can abandon a hop() part-way, which would
        // leave the character hanging above their own feet, so y is reset too.
        scene.tweens.killTweensOf(this.sprite);
        this.sprite.setAngle(0);
        this.sprite.y = 0;
        scene.tweens.add({
            targets: this.sprite,
            angle: lean,
            duration: 80,
            yoyo: true,
            hold: 40,
            ease: 'Quad.easeOut',
            onComplete: () => {
                if (!this.sprite || !this.sprite.active) return;
                this.sprite.setAngle(0);
                this.sprite.y = 0;
            },
        });

        // Recover through the scene clock so it follows the match speed control
        scene.time.delayedCall(ms, () => {
            if (!this.sprite || !this.sprite.active) return;
            this.kicking = false;
            this.frame = 0;
            this._apply();
            // Straighten up here rather than relying only on the tween's
            // onComplete. killTweensOf does not run onComplete, so a hop() or a
            // second kick() landing mid-lean skips it and the character is left
            // permanently tilted. Only kick() ever touches angle, so forcing it
            // back cannot interfere with anything else.
            this.sprite.setAngle(0);
        });
        return this;
    }
}

/**
 * Small standalone portrait: chibi head-and-shoulders inside a framed box,
 * like the roster/coach portraits in the reference HUD.
 */
export function chibiPortrait(scene, x, y, look = {}, size = 34) {
    const container = scene.add.container(x, y);
    const half = size / 2;

    // Frame
    const frame = scene.add.graphics();
    frame.fillStyle(0x8fd870, 1);
    frame.fillRoundedRect(-half, -half, size, size, 4);
    frame.lineStyle(2, 0x24242c, 1);
    frame.strokeRoundedRect(-half, -half, size, size, 4);
    container.add(frame);

    // Sky/grass backdrop inside the frame
    const bg = scene.add.graphics();
    bg.fillStyle(0xa8dcf0, 1);
    bg.fillRect(-half + 2, -half + 2, size - 4, (size - 4) * 0.55);
    bg.fillStyle(0x5fbf3a, 1);
    bg.fillRect(-half + 2, -half + 2 + (size - 4) * 0.55, size - 4, (size - 4) * 0.45);
    container.add(bg);

    // Chibi sized to sit inside the frame (no mask needed — it fits by design)
    const key = chibiTexture(scene, { ...look, facing: 'down', frame: 0, px: 2 });
    const img = scene.add.image(0, half - 3, key);
    img.setOrigin(0.5, 1);
    const fit = (size - 6) / 36;   // texture is 36px tall at px=2
    img.setScale(Math.max(0.6, fit));
    container.add(img);

    // Frame border re-drawn on top so the sprite never spills over the edge
    const border = scene.add.graphics();
    border.lineStyle(2, 0x24242c, 1);
    border.strokeRoundedRect(-half, -half, size, size, 4);
    container.add(border);

    container.chibiImage = img;
    return container;
}

/**
 * Pick a deterministic look for a player so they always render the same.
 * Hair spans dark browns through blond and ginger — bright hair is what makes
 * individual players findable in a crowd of 22.
 */
/**
 * Hand-authored looks for the marquee warriors, so the characters people
 * actually recognise have the silhouette they should: Guan Yu's chest-length
 * beard, Lü Bu's plumed helmet, Zhang Fei's bulk, and so on.
 */
const NAMED_LOOKS = {
    // Shu
    'Liu Bei':      { feature: 'beard',     crown: 'part',  hair: 0x2e2118 },
    'Guan Yu':      { feature: 'longbeard', crown: 'part',  hair: 0x1f1a14, plume: 0x2f9e57 },
    'Zhang Fei':    { feature: 'bigbeard',  crown: 'spiky', hair: 0x171313 },
    'Zhao Yun':     { feature: 'helmet',    crown: 'tall',  hair: 0x8a8f9a, plume: 0xe8e8f0 },
    'Zhuge Liang':  { feature: 'crown',     crown: 'tall',  hair: 0x2e2118, plume: 0xf4f4e2 },
    'Ma Chao':      { feature: 'helmet',    crown: 'tall',  hair: 0x9aa0aa, plume: 0xd8d8e4 },
    'Huang Zhong':  { feature: 'longbeard', crown: 'bowl',  hair: 0x9a9aa8 },
    'Wei Yan':      { feature: 'beard',     crown: 'spiky', hair: 0x3a2a1e },
    'Jiang Wei':    { feature: 'none',      crown: 'part',  hair: 0x5a3418 },
    'Pang Tong':    { feature: 'beard',     crown: 'bowl',  hair: 0x4a3a2a },
    'Fa Zheng':     { feature: 'none',      crown: 'part',  hair: 0x2e2118 },

    // Wei
    'Cao Cao':      { feature: 'crown',     crown: 'part',  hair: 0x2a2118, plume: 0xffd130 },
    'Xiahou Dun':   { feature: 'bigbeard',  crown: 'spiky', hair: 0x241c14 },
    'Dian Wei':     { feature: 'bigbeard',  crown: 'spiky', hair: 0x1f1a14 },
    'Xu Chu':       { feature: 'wide',      crown: 'bowl',  hair: 0x3a2a1e },
    'Zhang Liao':   { feature: 'helmet',    crown: 'tall',  hair: 0x8a8f9a, plume: 0x3f7fd8 },
    'Xu Huang':     { feature: 'beard',     crown: 'part',  hair: 0x4a3418 },
    'Zhang He':     { feature: 'none',      crown: 'tall',  hair: 0xe8c060 },
    'Cao Ren':      { feature: 'helmet',    crown: 'bowl',  hair: 0x8a8f9a, plume: 0x3f7fd8 },
    'Guo Jia':      { feature: 'none',      crown: 'part',  hair: 0x2e2118 },
    'Sima Yi':      { feature: 'beard',     crown: 'crown', hair: 0x3a3a44 },
    'Cao Pi':       { feature: 'crown',     crown: 'part',  hair: 0x2a2118, plume: 0xffd130 },

    // Wu
    'Sun Jian':     { feature: 'helmbeard', crown: 'part',  hair: 0x3a2a1e, plume: 0x2fae5f },
    'Sun Ce':       { feature: 'none',      crown: 'spiky', hair: 0x5a3418 },
    'Sun Quan':     { feature: 'beard',     crown: 'crown', hair: 0xc85a2a, plume: 0xffd130 },
    'Zhou Yu':      { feature: 'none',      crown: 'tall',  hair: 0x2e2118 },
    'Lu Xun':       { feature: 'none',      crown: 'part',  hair: 0x5a3418 },
    'Gan Ning':     { feature: 'beard',     crown: 'spiky', hair: 0x241c14 },
    'Taishi Ci':    { feature: 'beard',     crown: 'tall',  hair: 0x3a2a1e },
    'Huang Gai':    { feature: 'bigbeard',  crown: 'bowl',  hair: 0x9a9aa8 },
    'Lu Meng':      { feature: 'beard',     crown: 'part',  hair: 0x4a3418 },
    'Ding Feng':    { feature: 'helmet',    crown: 'bowl',  hair: 0x8a8f9a, plume: 0x2fae5f },
    'Zhou Tai':     { feature: 'wide',      crown: 'spiky', hair: 0x1f1a14 },

    // Lü Bu's mercenaries
    'Lü Bu':        { feature: 'helmbeard', crown: 'tall',  hair: 0x8a8f9a, plume: 0xe8462e },
    'Diao Chan':    { feature: 'none',      crown: 'tall',  hair: 0x241c14 },
    'Gao Shun':     { feature: 'helmet',    crown: 'bowl',  hair: 0x8a8f9a, plume: 0xff5c5c },
    'Chen Gong':    { feature: 'beard',     crown: 'part',  hair: 0x3a3a44 },
    'Zang Ba':      { feature: 'bigbeard',  crown: 'spiky', hair: 0x241c14 },

    // Dong Zhuo's coalition
    'Dong Zhuo':    { feature: 'bigbeard',  crown: 'bowl',  hair: 0x3a2a1e },
    'Hua Xiong':    { feature: 'wide',      crown: 'spiky', hair: 0x1f1a14 },
    'Li Ru':        { feature: 'beard',     crown: 'part',  hair: 0x3a3a44 },
    'Jia Xu':       { feature: 'beard',     crown: 'crown', hair: 0x9a9aa8 },
    'Lü Bu ':       { feature: 'helmbeard', crown: 'tall',  hair: 0x8a8f9a },

    // Yuan Shao's alliance
    'Yuan Shao':    { feature: 'crown',     crown: 'part',  hair: 0x2e2118, plume: 0xffd130 },
    'Yuan Shu':     { feature: 'bigbeard',  crown: 'bowl',  hair: 0x3a2a1e, plume: 0xffd130 },
    'Yan Liang':    { feature: 'helmet',    crown: 'spiky', hair: 0x8a8f9a, plume: 0xe0b22c },
    'Wen Chou':     { feature: 'helmet',    crown: 'spiky', hair: 0x8a8f9a, plume: 0xe0b22c },
    'Gao Lan':      { feature: 'beard',     crown: 'bowl',  hair: 0x4a3418 },
};

/**
 * Pick a deterministic look for a player so they always render the same.
 * Named warriors get their authored silhouette; everyone else gets a stable
 * hash-derived combination so a roster never looks cloned.
 */
export function lookForPlayer(player, kit) {
    const HAIRS = [
        0x2e2118, // near-black brown
        0x5a3418, // chestnut
        0x8a6a3a, // light brown
        0xe8c060, // blond
        0xc85a2a, // ginger
        0x9a9aa8, // grey (veterans)
    ];
    const SKINS = [0xf6d3a8, 0xefc396, 0xe0ac7c, 0xf8ddbb];
    // Plain faces stay common so beards read as a distinguishing trait
    const FALLBACK_FEATURES = ['none', 'none', 'beard', 'none', 'wide', 'beard', 'helmet', 'none'];

    const name = player?.name || 'x';
    let h = 0;
    for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) & 0xffff;

    const named = NAMED_LOOKS[name] || {};

    return {
        hair: named.hair ?? HAIRS[h % HAIRS.length],
        skin: SKINS[(h >> 3) % SKINS.length],
        crown: named.crown ?? HAIR_STYLES[(h >> 5) % HAIR_STYLES.length],
        feature: named.feature ?? FALLBACK_FEATURES[(h >> 7) % FALLBACK_FEATURES.length],
        plume: named.plume ?? kit.accent,
        jersey: kit.jersey,
        shorts: kit.shorts,
    };
}
