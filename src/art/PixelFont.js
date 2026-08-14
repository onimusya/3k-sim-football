// PixelFont — chunky outlined bitmap glyphs.
// This is the signature "Kairosoft numeral" look: fat pixel digits with a hard
// dark outline, a highlight band on the upper half, and an optional drop shadow.
//
// Labels should use normal text; NUMBERS and badges should use this.

const G = {
    '0': ['01110','10001','10011','10101','11001','10001','01110'],
    '1': ['00100','01100','00100','00100','00100','00100','01110'],
    '2': ['01110','10001','00001','00010','00100','01000','11111'],
    '3': ['11111','00010','00100','00010','00001','10001','01110'],
    '4': ['00010','00110','01010','10010','11111','00010','00010'],
    '5': ['11111','10000','11110','00001','00001','10001','01110'],
    '6': ['00110','01000','10000','11110','10001','10001','01110'],
    '7': ['11111','00001','00010','00100','01000','01000','01000'],
    '8': ['01110','10001','10001','01110','10001','10001','01110'],
    '9': ['01110','10001','10001','01111','00001','00010','01100'],

    'A': ['01110','10001','10001','11111','10001','10001','10001'],
    'B': ['11110','10001','10001','11110','10001','10001','11110'],
    'C': ['01110','10001','10000','10000','10000','10001','01110'],
    'D': ['11110','10001','10001','10001','10001','10001','11110'],
    'E': ['11111','10000','10000','11110','10000','10000','11111'],
    'F': ['11111','10000','10000','11110','10000','10000','10000'],
    'G': ['01110','10001','10000','10111','10001','10001','01110'],
    'H': ['10001','10001','10001','11111','10001','10001','10001'],
    'I': ['11111','00100','00100','00100','00100','00100','11111'],
    'J': ['00111','00010','00010','00010','00010','10010','01100'],
    'K': ['10001','10010','10100','11000','10100','10010','10001'],
    'L': ['10000','10000','10000','10000','10000','10000','11111'],
    'M': ['10001','11011','10101','10101','10001','10001','10001'],
    'N': ['10001','11001','10101','10011','10001','10001','10001'],
    'O': ['01110','10001','10001','10001','10001','10001','01110'],
    'P': ['11110','10001','10001','11110','10000','10000','10000'],
    'Q': ['01110','10001','10001','10001','10101','10011','01111'],
    'R': ['11110','10001','10001','11110','10100','10010','10001'],
    'S': ['01111','10000','10000','01110','00001','00001','11110'],
    'T': ['11111','00100','00100','00100','00100','00100','00100'],
    'U': ['10001','10001','10001','10001','10001','10001','01110'],
    'V': ['10001','10001','10001','10001','10001','01010','00100'],
    'W': ['10001','10001','10001','10101','10101','11011','10001'],
    'X': ['10001','10001','01010','00100','01010','10001','10001'],
    'Y': ['10001','10001','01010','00100','00100','00100','00100'],
    'Z': ['11111','00001','00010','00100','01000','10000','11111'],

    '+': ['00000','00100','00100','11111','00100','00100','00000'],
    '-': ['00000','00000','00000','11111','00000','00000','00000'],
    '.': ['00000','00000','00000','00000','00000','01100','01100'],
    ',': ['00000','00000','00000','00000','01100','00100','01000'],
    ':': ['00000','01100','01100','00000','01100','01100','00000'],
    '/': ['00001','00001','00010','00100','01000','10000','10000'],
    '%': ['11001','11010','00100','00100','01000','01011','10011'],
    '$': ['00100','01111','10100','01110','00101','11110','00100'],
    '!': ['00100','00100','00100','00100','00100','00000','00100'],
    '?': ['01110','10001','00001','00110','00100','00000','00100'],
    '(': ['00010','00100','01000','01000','01000','00100','00010'],
    ')': ['01000','00100','00010','00010','00010','00100','01000'],
    '=': ['00000','00000','11111','00000','11111','00000','00000'],
    '<': ['00010','00100','01000','10000','01000','00100','00010'],
    '>': ['01000','00100','00010','00001','00010','00100','01000'],
    '*': ['00000','01010','00100','11111','00100','01010','00000'],
    "'": ['00100','00100','00000','00000','00000','00000','00000'],
    '#': ['01010','11111','01010','01010','01010','11111','01010'],
    '\u00A5': ['10001','10001','01010','11111','00100','11111','00100'], // ¥
    ' ': ['00000','00000','00000','00000','00000','00000','00000'],
};

const GW = 5;
const GH = 7;

function glyph(ch) {
    return G[ch] || G[ch.toUpperCase()] || null;
}

/** Width in px of a rendered string. */
export function measure(text, scale = 3, spacing = 1) {
    const s = String(text);
    if (!s.length) return 0;
    return s.length * GW * scale + (s.length - 1) * spacing * scale;
}

export function heightOf(scale = 3) {
    return GH * scale;
}

/**
 * Build the on/off pixel grid for a whole string.
 * Returns { w, h, cells:Set('x,y') }
 */
function buildGrid(text, spacing) {
    const s = String(text);
    const cells = new Set();
    let cursor = 0;
    for (const ch of s) {
        const gl = glyph(ch);
        if (gl) {
            for (let y = 0; y < GH; y++) {
                const row = gl[y];
                for (let x = 0; x < GW; x++) {
                    if (row[x] === '1') cells.add(`${cursor + x},${y}`);
                }
            }
        }
        cursor += GW + spacing;
    }
    return { w: Math.max(0, cursor - spacing), h: GH, cells };
}

/**
 * Draw pixel text into a Graphics object.
 *
 * opts:
 *   scale      px size of one logical pixel (default 3)
 *   spacing    logical px between glyphs (default 1)
 *   fill       main color
 *   fillTop    optional highlight color for the upper rows
 *   outline    outline color (null to disable)
 *   shadow     drop shadow color (null to disable)
 *   shadowOff  shadow offset in logical px (default 1)
 */
export function drawInto(gfx, text, opts = {}) {
    const {
        scale = 3,
        spacing = 1,
        fill = 0xffffff,
        fillTop = null,
        outline = 0x2b2b33,
        shadow = null,
        shadowOff = 1,
    } = opts;

    const { w, h, cells } = buildGrid(text, spacing);
    const S = scale;

    // Drop shadow (solid silhouette offset down-right).
    // NOTE: alpha must be passed separately — Phaser's fillStyle takes a 24-bit
    // color, so packing alpha into the hex (0x00000055) silently yields navy.
    if (shadow !== null) {
        gfx.fillStyle(shadow, opts.shadowAlpha ?? 0.35);
        const off = shadowOff * S;
        cells.forEach((key) => {
            const [x, y] = key.split(',').map(Number);
            gfx.fillRect(x * S + off, y * S + off, S, S);
        });
    }

    // Outline: any empty cell touching a filled cell (8-neighbour)
    if (outline !== null) {
        const out = new Set();
        cells.forEach((key) => {
            const [x, y] = key.split(',').map(Number);
            for (let dy = -1; dy <= 1; dy++) {
                for (let dx = -1; dx <= 1; dx++) {
                    if (!dx && !dy) continue;
                    const k = `${x + dx},${y + dy}`;
                    if (!cells.has(k)) out.add(k);
                }
            }
        });
        gfx.fillStyle(outline, 1);
        out.forEach((key) => {
            const [x, y] = key.split(',').map(Number);
            gfx.fillRect(x * S, y * S, S, S);
        });
    }

    // Body — optional two-tone (highlight on the top rows)
    const splitRow = 3;
    if (fillTop !== null) {
        gfx.fillStyle(fillTop, 1);
        cells.forEach((key) => {
            const [x, y] = key.split(',').map(Number);
            if (y < splitRow) gfx.fillRect(x * S, y * S, S, S);
        });
        gfx.fillStyle(fill, 1);
        cells.forEach((key) => {
            const [x, y] = key.split(',').map(Number);
            if (y >= splitRow) gfx.fillRect(x * S, y * S, S, S);
        });
    } else {
        gfx.fillStyle(fill, 1);
        cells.forEach((key) => {
            const [x, y] = key.split(',').map(Number);
            gfx.fillRect(x * S, y * S, S, S);
        });
    }

    return { w: w * S, h: h * S };
}

/**
 * PixelText — a managed pixel-font label you can update.
 *
 * Usage:
 *   const t = new PixelText(scene, x, y, '1250', { scale: 3, preset: 'gold' });
 *   t.setText('1300');
 *   t.setOrigin(0.5, 0.5)  // re-centres based on measured size
 */
export const PRESET = {
    gold:   { fill: 0xffd130, fillTop: 0xfff08a, outline: 0x2b2b33, shadow: 0x1a2338, shadowAlpha: 0.3 },
    white:  { fill: 0xffffff, fillTop: null,     outline: 0x2b2b33, shadow: 0x1a2338, shadowAlpha: 0.28 },
    blueNum:{ fill: 0x9fd8ff, fillTop: 0xffffff, outline: 0x14395e, shadow: null },
    // `dark` is used on cream/white surfaces — a light outline makes it read
    // embossed instead of like a thin scratchy stencil.
    dark:   { fill: 0x2b2b33, fillTop: null,     outline: 0xfbfdf4, shadow: null },
    darkBare:{ fill: 0x2b2b33, fillTop: null,    outline: null,     shadow: null },
    good:   { fill: 0x4fdc4f, fillTop: 0xc8ffc8, outline: 0x0f3a0f, shadow: null },
    bad:    { fill: 0xff6a58, fillTop: 0xffc0b6, outline: 0x4a1410, shadow: null },
    onDark: { fill: 0xffffff, fillTop: null,     outline: 0x101820, shadow: null },
};

export class PixelText {
    /**
     * @param {Phaser.Scene} scene
     * @param {number} x
     * @param {number} y
     * @param {string|number} text
     * @param {object} opts  scale, spacing, preset, fill, fillTop, outline, shadow, originX, originY
     */
    constructor(scene, x, y, text, opts = {}) {
        this.scene = scene;
        this.opts = { scale: 3, spacing: 1, ...(PRESET[opts.preset] || PRESET.white), ...opts };
        this.gfx = scene.add.graphics();
        this.originX = opts.originX ?? 0;
        this.originY = opts.originY ?? 0;
        this._x = x;
        this._y = y;
        this.setText(text);
    }

    setText(text) {
        this.text = String(text);
        this.gfx.clear();
        const size = drawInto(this.gfx, this.text, this.opts);
        this.width = size.w;
        this.height = size.h;
        this._reposition();
        return this;
    }

    _reposition() {
        this.gfx.setPosition(
            this._x - this.width * this.originX,
            this._y - this.height * this.originY
        );
    }

    setPosition(x, y) {
        this._x = x;
        this._y = y;
        this._reposition();
        return this;
    }

    setOrigin(ox, oy = ox) {
        this.originX = ox;
        this.originY = oy;
        this._reposition();
        return this;
    }

    setScaleStep(scale) {
        this.opts.scale = scale;
        return this.setText(this.text);
    }

    setPreset(name) {
        Object.assign(this.opts, PRESET[name] || PRESET.white);
        return this.setText(this.text);
    }

    setDepth(d) { this.gfx.setDepth(d); return this; }
    setAlpha(a) { this.gfx.setAlpha(a); return this; }
    setVisible(v) { this.gfx.setVisible(v); return this; }
    get displayWidth() { return this.width; }
    destroy() { this.gfx.destroy(); }

    /** Add the underlying graphics to a container (and re-anchor to local space). */
    addTo(container, localX = null, localY = null) {
        if (localX !== null) this._x = localX;
        if (localY !== null) this._y = localY;
        this._reposition();
        container.add(this.gfx);
        return this;
    }
}

/** One-shot helper: returns a Graphics with the text baked in. */
export function pixelText(scene, x, y, text, opts = {}) {
    return new PixelText(scene, x, y, text, opts);
}
