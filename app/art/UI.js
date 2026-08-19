// UI — the signature widget set: white dialog panels with blue gradient title
// bars, icon+value HUD chips, position badges, colored stat bars, cream list rows.

import { C, LABEL_FONT } from './Palette.js';
import { PixelText, measure } from './PixelFont.js';

/** Standard label text (proportional font, not pixel font). */
export function label(scene, x, y, text, opts = {}) {
    return scene.add.text(x, y, text, {
        fontFamily: LABEL_FONT,
        fontSize: (opts.size || 13) + 'px',
        color: opts.color || '#2b2b33',
        fontStyle: opts.bold ? 'bold' : 'normal',
        align: opts.align || 'left',
        wordWrap: opts.wrap ? { width: opts.wrap } : undefined,
    }).setOrigin(opts.ox ?? 0, opts.oy ?? 0);
}

/** Title-bar style label: white text with a dark shadow. */
export function titleLabel(scene, x, y, text, size = 17) {
    return scene.add.text(x, y, text, {
        fontFamily: LABEL_FONT,
        fontSize: size + 'px',
        color: '#ffffff',
        fontStyle: 'bold',
        stroke: '#123a6b',
        strokeThickness: 3,
        shadow: { offsetX: 0, offsetY: 2, color: '#0d2c52', blur: 0, fill: true },
    }).setOrigin(0.5, 0.5);
}

/**
 * The signature dialog panel.
 *
 *  ┌───────────────────────┐
 *  │  blue gradient title  │
 *  ├───────────────────────┤
 *  │   near-white body     │
 *  └───────────────────────┘
 *
 * Returns a container with .body{x,y,w,h} describing the usable inner area.
 */
export function panel(scene, x, y, w, h, title = null, opts = {}) {
    const container = scene.add.container(x, y);
    const titleH = title ? (opts.titleH || 34) : 0;
    const r = opts.radius ?? 8;

    // Drop shadow
    const shadow = scene.add.graphics();
    shadow.fillStyle(0x000000, 0.28);
    shadow.fillRoundedRect(4, 5, w, h, r);
    container.add(shadow);

    // Outer dark frame
    const frame = scene.add.graphics();
    frame.fillStyle(C.panelEdge, 1);
    frame.fillRoundedRect(-2, -2, w + 4, h + 4, r + 2);
    container.add(frame);

    // Body
    const body = scene.add.graphics();
    body.fillStyle(C.panelBody, 1);
    body.fillRoundedRect(0, 0, w, h, r);
    container.add(body);

    if (title) {
        // Title bar gradient (banded fills — crisp, no blurry gradients)
        const tb = scene.add.graphics();
        const bands = 8;
        for (let i = 0; i < bands; i++) {
            const t = i / (bands - 1);
            const col = Phaser.Display.Color.Interpolate.ColorWithColor(
                Phaser.Display.Color.ValueToColor(C.titleBarTop),
                Phaser.Display.Color.ValueToColor(C.titleBarBot),
                bands - 1,
                i
            );
            const c = Phaser.Display.Color.GetColor(col.r, col.g, col.b);
            tb.fillStyle(c, 1);
            const bandY = (titleH / bands) * i;
            const bandH = titleH / bands + 1;
            if (i === 0) {
                tb.fillRoundedRect(0, bandY, w, bandH + r, { tl: r, tr: r, bl: 0, br: 0 });
            } else {
                tb.fillRect(0, bandY, w, bandH);
            }
        }
        // Shine line near the top
        tb.fillStyle(C.titleBarShine, 0.55);
        tb.fillRect(6, 4, w - 12, 2);
        // Divider under the bar
        tb.fillStyle(C.panelEdge, 1);
        tb.fillRect(0, titleH - 2, w, 2);
        container.add(tb);

        const t = titleLabel(scene, w / 2, titleH / 2 - 1, title, opts.titleSize || 17);
        container.add(t);
        container.titleText = t;
    }

    // NOTE: deliberately NOT called `.body` — Phaser reserves that slot for a
    // physics body and GameObject.destroy() would try to call `body.destroy()`.
    container.bodyRect = { x: 0, y: titleH, w, h: h - titleH };
    container.panelW = w;
    container.panelH = h;
    return container;
}

/**
 * Inner sub-panel — the light mint/blue inset blocks used inside dialogs.
 * Coordinates are local to the parent container.
 */
export function subPanel(scene, parent, x, y, w, h, opts = {}) {
    const g = scene.add.graphics();
    g.fillStyle(opts.color ?? C.subPanel, 1);
    g.fillRoundedRect(x, y, w, h, opts.radius ?? 5);
    g.lineStyle(2, opts.edge ?? C.subPanelEdge, 1);
    g.strokeRoundedRect(x, y, w, h, opts.radius ?? 5);
    if (parent) parent.add(g);
    return g;
}

/**
 * HUD chip: a framed box with a small icon and a pixel-font value.
 * Used for the heart/bulb/trophy stat readouts along the top of the screen.
 */
export function hudChip(scene, x, y, iconKind, value, opts = {}) {
    const w = opts.w || 74;
    const h = opts.h || 28;
    const container = scene.add.container(x, y);

    const g = scene.add.graphics();
    g.fillStyle(C.panelEdge, 1);
    g.fillRoundedRect(-2, -2, w + 4, h + 4, 5);
    g.fillStyle(0xf6f2d8, 1);
    g.fillRoundedRect(0, 0, w, h, 4);
    // icon well
    g.fillStyle(0xe4dcb8, 1);
    g.fillRect(2, 2, 26, h - 4);
    g.lineStyle(1, 0xbdb48f, 1);
    g.strokeRect(2, 2, 26, h - 4);
    container.add(g);

    container.add(icon(scene, 15, h / 2, iconKind, 16));

    const pt = new PixelText(scene, 0, 0, value, {
        scale: opts.numScale || 3,
        preset: 'gold',
    });
    pt.addTo(container, w - 6 - pt.width, (h - pt.height) / 2);
    container.value = pt;
    container.setValue = (v) => {
        pt.setText(v);
        pt.setPosition(w - 6 - pt.width, (h - pt.height) / 2);
        return container;
    };

    return container;
}

/**
 * Tiny procedural icons drawn with primitives. Keeps the art self-contained.
 * kinds: heart, bulb, trophy, coin, boot, shield, star, whistle, ball, up, down
 */
export function icon(scene, x, y, kind, size = 16) {
    const g = scene.add.graphics();
    g.setPosition(x, y);
    const s = size / 16;
    const O = 0x24242c;

    const outlineCircle = (cx, cy, r, fill) => {
        g.fillStyle(O, 1); g.fillCircle(cx, cy, r + 1);
        g.fillStyle(fill, 1); g.fillCircle(cx, cy, r);
    };

    switch (kind) {
        case 'heart': {
            g.fillStyle(O, 1);
            g.fillCircle(-3 * s, -2 * s, 4.2 * s);
            g.fillCircle(3 * s, -2 * s, 4.2 * s);
            g.fillTriangle(-7 * s, 0, 7 * s, 0, 0, 7.5 * s);
            g.fillStyle(C.heart, 1);
            g.fillCircle(-3 * s, -2 * s, 3.2 * s);
            g.fillCircle(3 * s, -2 * s, 3.2 * s);
            g.fillTriangle(-5.8 * s, 0, 5.8 * s, 0, 0, 6 * s);
            g.fillStyle(0xffc0d8, 0.9);
            g.fillCircle(-3.4 * s, -3 * s, 1.1 * s);
            break;
        }
        case 'bulb': {
            outlineCircle(0, -2 * s, 4.6 * s, C.bulb);
            g.fillStyle(O, 1);
            g.fillRect(-2.6 * s, 2.4 * s, 5.2 * s, 4.4 * s);
            g.fillStyle(0xbdb48f, 1);
            g.fillRect(-2 * s, 3 * s, 4 * s, 1.2 * s);
            g.fillRect(-2 * s, 5 * s, 4 * s, 1.2 * s);
            g.fillStyle(0xfff6c0, 0.95);
            g.fillCircle(-1.4 * s, -3.2 * s, 1.3 * s);
            break;
        }
        case 'trophy': {
            g.fillStyle(O, 1);
            g.fillRect(-5 * s, -6 * s, 10 * s, 8 * s);
            g.fillRect(-2 * s, 2 * s, 4 * s, 4 * s);
            g.fillRect(-5 * s, 6 * s, 10 * s, 2.4 * s);
            g.fillStyle(C.trophy, 1);
            g.fillRect(-4 * s, -5 * s, 8 * s, 6.4 * s);
            g.fillRect(-1.2 * s, 2 * s, 2.4 * s, 4 * s);
            g.fillRect(-4 * s, 6.4 * s, 8 * s, 1.4 * s);
            g.fillStyle(0xffe9a8, 0.9);
            g.fillRect(-3 * s, -4.4 * s, 1.6 * s, 4 * s);
            break;
        }
        case 'coin': {
            outlineCircle(0, 0, 6 * s, C.numGold);
            g.fillStyle(C.numGoldDark, 1);
            g.fillCircle(0, 0, 3.6 * s);
            g.fillStyle(0xfff0a8, 0.9);
            g.fillCircle(-2 * s, -2.2 * s, 1.4 * s);
            break;
        }
        case 'ball': {
            outlineCircle(0, 0, 5.6 * s, 0xffffff);
            g.fillStyle(0x2b2b33, 1);
            g.fillCircle(0, -1 * s, 1.7 * s);
            g.fillCircle(-3 * s, 1.8 * s, 1.3 * s);
            g.fillCircle(3 * s, 1.8 * s, 1.3 * s);
            break;
        }
        case 'boot': {
            g.fillStyle(O, 1);
            g.fillRect(-6 * s, -1 * s, 8 * s, 6 * s);
            g.fillRect(-6 * s, 4 * s, 12 * s, 3 * s);
            g.fillStyle(C.statKick, 1);
            g.fillRect(-5 * s, 0, 6.4 * s, 4.4 * s);
            g.fillStyle(0xffffff, 1);
            g.fillRect(-5 * s, 4.8 * s, 10.4 * s, 1.6 * s);
            break;
        }
        case 'shield': {
            g.fillStyle(O, 1);
            g.beginPath();
            g.moveTo(-6 * s, -6 * s); g.lineTo(6 * s, -6 * s);
            g.lineTo(6 * s, 2 * s); g.lineTo(0, 7.5 * s); g.lineTo(-6 * s, 2 * s);
            g.closePath(); g.fill();
            g.fillStyle(C.posDF, 1);
            g.beginPath();
            g.moveTo(-4.6 * s, -4.6 * s); g.lineTo(4.6 * s, -4.6 * s);
            g.lineTo(4.6 * s, 1.6 * s); g.lineTo(0, 5.8 * s); g.lineTo(-4.6 * s, 1.6 * s);
            g.closePath(); g.fill();
            break;
        }
        case 'star': {
            const pts = [];
            for (let i = 0; i < 10; i++) {
                const a = (Math.PI / 5) * i - Math.PI / 2;
                const r = (i % 2 === 0 ? 7 : 3.2) * s;
                pts.push(Math.cos(a) * r, Math.sin(a) * r);
            }
            g.fillStyle(O, 1); g.fillPoints(
                pts.reduce((acc, v, i) => { if (i % 2 === 0) acc.push({ x: v * 1.18, y: pts[i + 1] * 1.18 }); return acc; }, []), true
            );
            g.fillStyle(C.bulb, 1);
            g.fillPoints(
                pts.reduce((acc, v, i) => { if (i % 2 === 0) acc.push({ x: v, y: pts[i + 1] }); return acc; }, []), true
            );
            break;
        }
        case 'whistle': {
            outlineCircle(-1 * s, 0, 5 * s, 0xd8d8e0);
            g.fillStyle(O, 1);
            g.fillRect(3 * s, -2 * s, 6 * s, 3.6 * s);
            g.fillStyle(0xb8b8c4, 1);
            g.fillRect(3 * s, -1.2 * s, 5 * s, 2.2 * s);
            break;
        }
        case 'up': {
            g.fillStyle(O, 1);
            g.fillTriangle(0, -7 * s, 7 * s, 3 * s, -7 * s, 3 * s);
            g.fillStyle(C.good, 1);
            g.fillTriangle(0, -5 * s, 5.2 * s, 2 * s, -5.2 * s, 2 * s);
            break;
        }
        case 'down': {
            g.fillStyle(O, 1);
            g.fillTriangle(0, 7 * s, 7 * s, -3 * s, -7 * s, -3 * s);
            g.fillStyle(C.bad, 1);
            g.fillTriangle(0, 5 * s, 5.2 * s, -2 * s, -5.2 * s, -2 * s);
            break;
        }
        default: {
            outlineCircle(0, 0, 5 * s, 0xcccccc);
        }
    }
    return g;
}

/**
 * Position badge — the colored GK/DF/MF/FW chip with pixel lettering.
 */
export function posBadge(scene, x, y, text, color, opts = {}) {
    const w = opts.w || 34;
    const h = opts.h || 22;
    const container = scene.add.container(x, y);

    const g = scene.add.graphics();
    g.fillStyle(C.panelEdge, 1);
    g.fillRoundedRect(-2, -2, w + 4, h + 4, 4);
    g.fillStyle(color, 1);
    g.fillRoundedRect(0, 0, w, h, 3);
    // top shine
    g.fillStyle(0xffffff, 0.28);
    g.fillRect(2, 2, w - 4, Math.max(2, h * 0.28));
    container.add(g);

    const pt = new PixelText(scene, 0, 0, text, { scale: 2, preset: 'onDark' });
    pt.addTo(container, (w - pt.width) / 2, (h - pt.height) / 2);

    return container;
}

/**
 * Stat bar row: [icon] Label [====bar====] 186
 * Matches the reference's colored bars with pixel numerals on a dark track.
 */
export function statBar(scene, parent, x, y, opts = {}) {
    const {
        labelText = 'Kick',
        value = 0,
        max = 100,
        color = C.statKick,
        barW = 150,
        barH = 26,
        labelW = 52,
        iconKind = null,
        animate = false,
        delay = 0,
        numScale = 3,
    } = opts;

    const container = scene.add.container(x, y);

    let cursor = 0;
    if (iconKind) {
        container.add(icon(scene, 10, barH / 2, iconKind, 15));
        cursor = 22;
    }

    container.add(label(scene, cursor, barH / 2, labelText, {
        size: 13, bold: true, color: '#1d5a9e', oy: 0.5,
    }));

    const bx = cursor + labelW;

    // Track
    const track = scene.add.graphics();
    track.fillStyle(C.panelEdge, 1);
    track.fillRoundedRect(bx - 2, -2, barW + 4, barH + 4, 4);
    track.fillStyle(C.statTrack, 1);
    track.fillRoundedRect(bx, 0, barW, barH, 3);
    container.add(track);

    // Fill
    const pct = Math.max(0, Math.min(1, value / max));
    const fill = scene.add.graphics();
    container.add(fill);

    const drawFill = (p) => {
        fill.clear();
        const fw = Math.max(0, barW * p);
        if (fw <= 0) return;
        fill.fillStyle(color, 1);
        fill.fillRoundedRect(bx, 0, fw, barH, 3);
        // gloss
        fill.fillStyle(0xffffff, 0.3);
        fill.fillRect(bx + 1, 2, Math.max(0, fw - 2), Math.max(2, barH * 0.3));
    };

    if (animate) {
        drawFill(0);
        const o = { p: 0 };
        scene.tweens.add({
            targets: o, p: pct, duration: 520, delay, ease: 'Cubic.easeOut',
            onUpdate: () => drawFill(o.p),
        });
    } else {
        drawFill(pct);
    }

    // Value, right-aligned inside the bar. Big numerals are what separate a
    // game HUD from a spreadsheet, so this defaults to scale 3.
    const pt = new PixelText(scene, 0, 0, Math.round(value), {
        scale: numScale, preset: 'onDark',
    });

    // Dark well behind the numeral so it reads the same whether the fill has
    // reached it or not (a cream "Body" bar otherwise swallows white digits).
    const wellW = pt.width + 12;
    const well = scene.add.graphics();
    well.fillStyle(C.statTrack, 0.9);
    well.fillRoundedRect(bx + barW - wellW - 2, 2, wellW, barH - 4, 3);
    container.add(well);

    pt.addTo(container, bx + barW - pt.width - 8, (barH - pt.height) / 2);

    container.setValue = (v) => {
        pt.setText(Math.round(v));
        const w = pt.width + 12;
        well.clear();
        well.fillStyle(C.statTrack, 0.9);
        well.fillRoundedRect(bx + barW - w - 2, 2, w, barH - 4, 3);
        pt.setPosition(bx + barW - pt.width - 8, (barH - pt.height) / 2);
        drawFill(Math.max(0, Math.min(1, v / max)));
    };

    if (parent) parent.add(container);
    return container;
}

/**
 * Cream list row (roster entries). Returns a container with .setSelected(bool)
 */
export function listRow(scene, parent, x, y, w, h, opts = {}) {
    const container = scene.add.container(x, y);
    const g = scene.add.graphics();
    container.add(g);

    let selected = false;
    const draw = () => {
        g.clear();
        g.fillStyle(C.panelEdge, 1);
        g.fillRoundedRect(-2, -2, w + 4, h + 4, 4);
        g.fillStyle(selected ? C.rowSelect : (opts.alt ? C.rowCreamAlt : C.rowCream), 1);
        g.fillRoundedRect(0, 0, w, h, 3);
        g.fillStyle(0xffffff, selected ? 0.45 : 0.3);
        g.fillRect(2, 2, w - 4, Math.max(2, h * 0.22));
    };
    draw();

    container.setSelected = (v) => { selected = v; draw(); return container; };
    container.hitZone = scene.add.rectangle(w / 2, h / 2, w, h, 0x000000, 0)
        .setInteractive({ useHandCursor: true });
    container.add(container.hitZone);

    if (parent) parent.add(container);
    return container;
}

/**
 * Chunky 3D-ish button with a pressed state.
 */
export function button(scene, x, y, w, h, text, opts = {}) {
    const container = scene.add.container(x, y);
    let base = opts.color ?? 0x5cc236;
    let dark = opts.colorDark ?? 0x3f9e1e;

    const g = scene.add.graphics();
    container.add(g);

    let pressed = false;
    const draw = () => {
        g.clear();
        const off = pressed ? 2 : 0;
        // outline + bottom lip
        g.fillStyle(C.panelEdge, 1);
        g.fillRoundedRect(-2, -2 + off, w + 4, h + 4 + (pressed ? 0 : 3), 6);
        g.fillStyle(dark, 1);
        g.fillRoundedRect(0, off, w, h + (pressed ? 0 : 3), 5);
        g.fillStyle(base, 1);
        g.fillRoundedRect(0, off, w, h, 5);
        g.fillStyle(0xffffff, 0.3);
        g.fillRect(3, 3 + off, w - 6, Math.max(2, h * 0.26));
    };
    draw();

    const t = scene.add.text(w / 2, h / 2, text, {
        fontFamily: LABEL_FONT,
        fontSize: (opts.size || 14) + 'px',
        color: '#ffffff',
        fontStyle: 'bold',
        stroke: opts.stroke || '#1d4a12',
        strokeThickness: 3,
    }).setOrigin(0.5);
    container.add(t);

    /** Recolour in place — lets a button group show state by colour alone. */
    container.setColors = (c, d, strokeColor) => {
        // Guard against being called on a button whose scene has already torn
        // down (stale references survive scene.start()).
        if (!container.active || !t.active || !g.active) return container;
        if (c != null) base = c;
        if (d != null) dark = d;
        if (strokeColor) t.setStroke(strokeColor, 3);
        draw();
        return container;
    };

    const hit = scene.add.rectangle(w / 2, h / 2, w, h + 4, 0x000000, 0)
        .setInteractive({ useHandCursor: true });
    container.add(hit);

    hit.on('pointerdown', () => { pressed = true; draw(); t.setY(h / 2 + 2); });
    const release = () => { if (!pressed) return; pressed = false; draw(); t.setY(h / 2); };
    hit.on('pointerup', release);
    hit.on('pointerout', release);
    hit.on('pointerover', () => { g.setAlpha(0.92); });
    hit.on('pointerout', () => { g.setAlpha(1); });

    container.onClick = (fn) => { hit.on('pointerup', fn); return container; };
    container.hit = hit;
    container.labelText = t;
    return container;
}

/**
 * Top HUD bar: green band, mascot slot, Y/M/W pixel counters, money box.
 * Returns container with .setMoney(v) / .setDate(y,m,w)
 */
export function topBar(scene, w, opts = {}) {
    const h = opts.h || 42;
    const container = scene.add.container(0, 0);

    const g = scene.add.graphics();
    // cyan accent line
    g.fillStyle(C.hudEdge, 1);
    g.fillRect(0, 0, w, 3);
    // green band
    const bands = 6;
    for (let i = 0; i < bands; i++) {
        const col = Phaser.Display.Color.Interpolate.ColorWithColor(
            Phaser.Display.Color.ValueToColor(C.hudGreenLight),
            Phaser.Display.Color.ValueToColor(C.hudGreenDark),
            bands - 1, i
        );
        g.fillStyle(Phaser.Display.Color.GetColor(col.r, col.g, col.b), 1);
        g.fillRect(0, 3 + ((h - 3) / bands) * i, w, (h - 3) / bands + 1);
    }
    g.fillStyle(C.panelEdge, 1);
    g.fillRect(0, h - 2, w, 2);
    container.add(g);

    // Money box on the right — auto-shrinks the numerals if the value is long
    const boxW = 196, boxH = 30;
    const boxX = w - boxW - 10, boxY = (h - boxH) / 2 + 1;
    const mb = scene.add.graphics();
    mb.fillStyle(C.panelEdge, 1);
    mb.fillRoundedRect(boxX - 2, boxY - 2, boxW + 4, boxH + 4, 5);
    mb.fillStyle(0xffffff, 1);
    mb.fillRoundedRect(boxX, boxY, boxW, boxH, 4);
    container.add(mb);

    const money = new PixelText(scene, 0, 0, '0', { scale: 3, preset: 'gold' });
    container.add(money.gfx);
    container.setMoney = (v) => {
        const str = '$' + Number(v).toLocaleString('en-US');
        // pick the largest scale that still fits the box
        let sc = 3;
        while (sc > 1 && measure(str, sc, 1) > boxW - 14) sc--;
        money.opts.scale = sc;
        money.setText(str);
        money.setPosition(boxX + boxW - money.width - 7, boxY + (boxH - money.height) / 2);
        return container;
    };

    // Date counters
    const dateX = 74;
    const dY = new PixelText(scene, dateX, (h - 21) / 2 + 1, '1', { scale: 3, preset: 'gold' });
    container.add(dY.gfx);
    const lY = scene.add.text(0, 0, 'Y', { fontFamily: LABEL_FONT, fontSize: '12px', color: '#eafbe0', fontStyle: 'bold' });
    container.add(lY);
    const dM = new PixelText(scene, 0, 0, '1', { scale: 3, preset: 'gold' });
    container.add(dM.gfx);
    const lM = scene.add.text(0, 0, 'M', { fontFamily: LABEL_FONT, fontSize: '12px', color: '#eafbe0', fontStyle: 'bold' });
    container.add(lM);
    const dW = new PixelText(scene, 0, 0, '1', { scale: 3, preset: 'gold' });
    container.add(dW.gfx);
    const lW = scene.add.text(0, 0, 'W', { fontFamily: LABEL_FONT, fontSize: '12px', color: '#eafbe0', fontStyle: 'bold' });
    container.add(lW);

    container.setDate = (y, m, wk) => {
        const cy = (h - 21) / 2 + 1;
        let cx = dateX;
        dY.setText(y).setPosition(cx, cy); cx += dY.width + 2;
        lY.setPosition(cx, cy + 6); cx += 14;
        dM.setText(m).setPosition(cx, cy); cx += dM.width + 2;
        lM.setPosition(cx, cy + 6); cx += 16;
        dW.setText(wk).setPosition(cx, cy); cx += dW.width + 2;
        lW.setPosition(cx, cy + 6);
        return container;
    };

    container.barH = h;
    return container;
}

/**
 * Bottom name plate with a portrait slot, like the reference's coach bar.
 */
export function namePlate(scene, x, y, w, h, opts = {}) {
    const container = scene.add.container(x, y);
    const g = scene.add.graphics();
    g.fillStyle(C.panelEdge, 1);
    g.fillRoundedRect(-2, -2, w + 4, h + 4, 6);
    g.fillStyle(C.hudGreenDark, 1);
    g.fillRoundedRect(0, 0, w, h, 5);
    g.fillStyle(0x18320c, 1);
    g.fillRoundedRect(h - 4, 5, w - h - 1, h - 10, 3);
    container.add(g);
    return container;
}

/** Floating "+23" style popup used for training gains and score changes. */
export function floatValue(scene, x, y, text, opts = {}) {
    const pt = new PixelText(scene, x, y, text, {
        scale: opts.scale || 3,
        preset: opts.preset || 'good',
    });
    pt.setOrigin(0.5, 0.5);
    scene.tweens.add({
        targets: pt.gfx,
        y: pt.gfx.y - (opts.rise || 34),
        alpha: 0,
        duration: opts.duration || 1100,
        ease: 'Quad.easeOut',
        onComplete: () => pt.destroy(),
    });
    return pt;
}

/** Full-width banner used for GOAL / HALF TIME callouts. */
export function banner(scene, cx, cy, w, text, opts = {}) {
    const h = opts.h || 58;
    const container = scene.add.container(cx, cy);
    const g = scene.add.graphics();
    g.fillStyle(C.panelEdge, 1);
    g.fillRect(-w / 2, -h / 2 - 2, w, h + 4);
    const top = opts.top ?? C.titleBarTop;
    const bot = opts.bot ?? C.titleBarBot;
    const bands = 8;
    for (let i = 0; i < bands; i++) {
        const col = Phaser.Display.Color.Interpolate.ColorWithColor(
            Phaser.Display.Color.ValueToColor(top),
            Phaser.Display.Color.ValueToColor(bot),
            bands - 1, i
        );
        g.fillStyle(Phaser.Display.Color.GetColor(col.r, col.g, col.b), 1);
        g.fillRect(-w / 2, -h / 2 + (h / bands) * i, w, h / bands + 1);
    }
    g.fillStyle(0xffffff, 0.4);
    g.fillRect(-w / 2, -h / 2 + 4, w, 2);
    container.add(g);

    const pt = new PixelText(scene, 0, 0, text, { scale: opts.scale || 5, preset: 'gold' });
    pt.setOrigin(0.5, 0.5);
    container.add(pt.gfx);
    container.pixelText = pt;
    return container;
}
