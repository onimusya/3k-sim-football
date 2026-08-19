// Palette — bright, saturated, sunny. Modeled on Kairosoft sim art direction.
// Everything here is high-key. No dark backgrounds anywhere in the UI.

export const C = {
    // ── Outlines / text ───────────────────────────────────────────
    ink:        0x2b2b33,   // primary dark outline
    inkSoft:    0x4a4a55,
    inkLight:   0x7a7a88,
    white:      0xffffff,
    offWhite:   0xf4fafa,

    // ── Sky & ground ──────────────────────────────────────────────
    sky:        0x7ec8e8,
    skyLight:   0xa8dcf0,
    skyDeep:    0x5ab0d8,

    grass:      0x5fbf3a,
    grassAlt:   0x54b02f,   // mowing stripe
    grassDark:  0x3d8f22,
    grassLight: 0x74d24c,
    dirt:       0xd8b878,   // the sandy pitch variant
    dirtAlt:    0xcfae6b,

    // ── HUD top bar ───────────────────────────────────────────────
    hudGreen:      0x5cc236,
    hudGreenDark:  0x3f9e1e,
    hudGreenLight: 0x7ada52,
    hudEdge:       0x2de0d0,   // cyan top accent line

    // ── Panels (the signature dialog look) ────────────────────────
    panelBody:     0xf0f8f8,
    panelBodyAlt:  0xe2eef0,
    panelEdge:     0x2b2b33,
    panelShadow:   0x000000,

    titleBarTop:   0x2f7fd8,
    titleBarBot:   0x14539f,
    titleBarShine: 0x6fb4ee,

    // Inner sub-panels
    subPanel:      0xe9f6ea,
    subPanelEdge:  0xa9c9aa,
    subPanelAlt:   0xdfeff2,

    // List rows
    rowCream:      0xf6e9a2,
    rowCreamAlt:   0xefdd8c,
    rowSelect:     0xffd34d,

    // ── Numerals ──────────────────────────────────────────────────
    numGold:       0xffd130,
    numGoldDark:   0xe8a81c,
    numWhite:      0xffffff,
    numBlue:       0xbfe4ff,
    numRed:        0xff7a6a,

    // ── Stat colors (per-attribute bars) ──────────────────────────
    statKick:   0xe63a2e,   // shooting
    statSpeed:  0x2f92e6,   // pace
    statTech:   0x3fc23f,   // passing
    statBody:   0xf2f0dc,   // physical
    statKeeper: 0xf2ce2c,   // defense/keeper
    statMorale: 0xff6fae,   // morale
    statTrack:  0x2a3440,   // dark bar track

    // ── Position badges ───────────────────────────────────────────
    posGK:  0x3a8fd8,
    posDF:  0x3a8fd8,
    posMF:  0xf0a030,
    posFW:  0xe04040,

    // ── Semantic ──────────────────────────────────────────────────
    good:    0x3fc23f,
    warn:    0xf2ce2c,
    bad:     0xe63a2e,
    heart:   0xff5f8f,
    bulb:    0xffd94a,
    trophy:  0xd8a13a,

    // ── World props ───────────────────────────────────────────────
    treeLeaf:    0x3f9e2e,
    treeLeafAlt: 0x54b83c,
    treeTrunk:   0x8a5a32,
    road:        0x9aa0a6,
    roadLine:    0xf0f0e0,
    buildWall:   0xe8eef2,
    buildWallAlt:0xd2dae2,
    buildRoof:   0x4a90c0,
    buildRoofAlt:0xd06a5a,
    fence:       0xc8ccd0,
    standRoof:   0x3f8fc4,
    standSeat:   0x2f6f4f,
    lightPole:   0x8a9098,
};

// Kingdom kit colors — brightened so chibi jerseys pop on green grass.
// Keyed to the kingdom ids in data/teams.js
export const KIT = {
    wei:  { jersey: 0x3f7fd8, shorts: 0x24528f, accent: 0x8fc4ff, name: 'Wei' },
    shu:  { jersey: 0xe04438, shorts: 0x9e2620, accent: 0xffa090, name: 'Shu' },
    wu:   { jersey: 0x2fae5f, shorts: 0x1c7340, accent: 0x8fe8b0, name: 'Wu' },
    dong: { jersey: 0x9a52c0, shorts: 0x63307d, accent: 0xd9a8ee, name: 'Dong' },
    yuan: { jersey: 0xe0b22c, shorts: 0x9a7615, accent: 0xffe08a, name: 'Yuan' },
    // Lü Bu's mercenaries are the "dark" kit, but pure black reads as a hole on
    // grass — this is a slate that still holds its shape at 34px.
    lu:   { jersey: 0x5a5f70, shorts: 0x33373f, accent: 0xff5c5c, name: 'Lu' },
};

// Hair / skin variety so a roster doesn't look cloned
export const HAIR = [0x2e2118, 0x4a2f1c, 0x1a1a20, 0x6b3f22, 0x8a6a3a, 0x3a3a44];
export const SKIN = [0xf6d3a8, 0xefc396, 0xe0ac7c, 0xf8ddbb];

// Helpers
export const hex = (n) => '#' + n.toString(16).padStart(6, '0');

export function kitFor(kingdomId) {
    return KIT[kingdomId] || KIT.wei;
}

export function statColor(key) {
    switch (key) {
        case 'shooting': return C.statKick;
        case 'pace':     return C.statSpeed;
        case 'passing':  return C.statTech;
        case 'physical': return C.statBody;
        case 'defense':  return C.statKeeper;
        case 'morale':   return C.statMorale;
        default:         return C.statTech;
    }
}

// Display labels matching the reference's short stat naming
export const STAT_LABEL = {
    shooting: 'Kick',
    pace:     'Speed',
    passing:  'Tech',
    physical: 'Body',
    defense:  'Guard',
    morale:   'Spirit',
};

export const STAT_ORDER = ['shooting', 'pace', 'passing', 'physical', 'defense', 'morale'];

export function posColor(pos) {
    if (pos === 'GK') return C.posGK;
    if (['CB', 'LB', 'RB'].includes(pos)) return C.posDF;
    if (['CM', 'LM', 'RM', 'AM'].includes(pos)) return C.posMF;
    return C.posFW;
}

// Short position group label like the reference (GK/DF/MF/FW)
export function posGroup(pos) {
    if (pos === 'GK') return 'GK';
    if (['CB', 'LB', 'RB'].includes(pos)) return 'DF';
    if (['CM', 'LM', 'RM', 'AM'].includes(pos)) return 'MF';
    return 'FW';
}

// UI label font stack (labels use a clean rounded sans; NUMBERS use PixelFont)
export const LABEL_FONT = '"Trebuchet MS", "Segoe UI", Verdana, sans-serif';
