// SaveGame — persists the campaign to localStorage.
//
// Everything the player builds up (squad, gold, season, trophies, results) lived
// only in Phaser's in-memory registry, so a refresh threw the campaign away.
// This module owns reading and writing that state, and is deliberately defensive:
// storage can be unavailable (private browsing), full (quota), or hold data from
// an older build, and none of those may crash the game.

const KEY = 'threeKingdomsSoccer.save.v1';
const VERSION = 1;

/** Fields we persist. Anything not listed is derived or per-scene scratch. */
const PERSISTED = [
    'playerKingdom', 'season', 'week',
    'money', 'gold', 'reputation',
    'players', 'formation',
    'results', 'matchesThisSeason', 'seasonComplete',
    'facilities', 'trophies',
    'sponsorBonus', 'scoutBonus', 'weatherPenalty', 'challengeMatch',
    'lastMatchWon', 'initialized',
];

let storageWorks = null;

/** Probe localStorage once — it throws outright in some privacy modes. */
function storageAvailable() {
    if (storageWorks !== null) return storageWorks;
    try {
        const probe = '__tks_probe__';
        window.localStorage.setItem(probe, '1');
        window.localStorage.removeItem(probe);
        storageWorks = true;
    } catch (e) {
        console.warn('[SaveGame] localStorage unavailable — progress will not persist.', e);
        storageWorks = false;
    }
    return storageWorks;
}

export const SaveGame = {
    available() {
        return storageAvailable();
    },

    /**
     * Write the campaign. Returns true on success.
     * Only picks known fields so scene scratch data never leaks into the save.
     */
    save(gameState) {
        if (!storageAvailable() || !gameState) return false;
        // A campaign without a chosen kingdom is not worth persisting
        if (!gameState.playerKingdom) return false;

        const data = { __version: VERSION, __savedAt: Date.now() };
        for (const k of PERSISTED) {
            if (gameState[k] !== undefined) data[k] = gameState[k];
        }

        try {
            window.localStorage.setItem(KEY, JSON.stringify(data));
            return true;
        } catch (e) {
            // Most likely QuotaExceededError. Don't take the game down over it.
            console.warn('[SaveGame] Could not write save.', e);
            return false;
        }
    },

    /** Parsed save, or null if there isn't a usable one. */
    load() {
        if (!storageAvailable()) return null;
        let raw;
        try {
            raw = window.localStorage.getItem(KEY);
        } catch (e) {
            return null;
        }
        if (!raw) return null;

        let data;
        try {
            data = JSON.parse(raw);
        } catch (e) {
            console.warn('[SaveGame] Save was corrupt, discarding.', e);
            this.clear();
            return null;
        }

        if (!data || typeof data !== 'object') return null;

        // Written by a different build — discard rather than half-load it
        if (data.__version !== VERSION) {
            console.warn(`[SaveGame] Save version ${data.__version} != ${VERSION}, discarding.`);
            this.clear();
            return null;
        }

        // Shape check on the parts the scenes assume exist
        const ok = typeof data.playerKingdom === 'string'
            && Array.isArray(data.players) && data.players.length > 0
            && data.players.every(p => p && p.stats && typeof p.pos === 'string');
        if (!ok) {
            console.warn('[SaveGame] Save failed validation, discarding.');
            this.clear();
            return null;
        }

        return data;
    },

    hasSave() {
        return this.load() !== null;
    },

    /** Small digest for the menu's Continue card. */
    summary() {
        const s = this.load();
        if (!s) return null;
        return {
            kingdom: s.playerKingdom,
            season: s.season ?? 1,
            week: s.week ?? 1,
            gold: s.gold ?? s.money ?? 0,
            trophies: Array.isArray(s.trophies) ? s.trophies.length : 0,
            squadSize: s.players.length,
            savedAt: s.__savedAt || null,
        };
    },

    clear() {
        if (!storageAvailable()) return;
        try {
            window.localStorage.removeItem(KEY);
        } catch (e) { /* nothing useful to do */ }
    },

    /**
     * Merge a loaded save over the registry's default state, so fields added in
     * later builds keep their defaults instead of coming back undefined.
     */
    applyTo(registry) {
        const data = this.load();
        if (!data) return false;
        const state = registry.get('gameState') || {};
        for (const k of PERSISTED) {
            if (data[k] !== undefined) state[k] = data[k];
        }
        registry.set('gameState', state);
        return true;
    },

    /**
     * Autosave whenever gameState changes. Debounced, because a single player
     * action can touch the registry several times in a row.
     */
    attachAutosave(game, delay = 400) {
        if (!storageAvailable()) return;
        let timer = null;
        game.registry.events.on('changedata-gameState', (_parent, value) => {
            if (!value || !value.playerKingdom) return;
            clearTimeout(timer);
            timer = setTimeout(() => SaveGame.save(value), delay);
        });
        // Catch the case where the tab is closed inside the debounce window
        window.addEventListener('pagehide', () => {
            const s = game.registry.get('gameState');
            if (s && s.playerKingdom) SaveGame.save(s);
        });
    },
};
