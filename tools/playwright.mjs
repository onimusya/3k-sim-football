// Resolves Playwright from wherever it happens to live.
//
// The project has no dependencies of its own — the game is CDN Phaser and plain
// ES modules — so these tools borrow whatever Playwright is already installed,
// including one that came along with an MCP server. Hardcoding one path makes the
// harness work on exactly one machine.

import { execSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const candidates = [];

// Anything resolvable normally (local node_modules, NODE_PATH)
candidates.push('playwright');

let globalRoot = null;
try {
    globalRoot = execSync('npm root -g', { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] })
        .trim().split(/\r?\n/).pop();
} catch { /* npm not on PATH; the other candidates may still work */ }

if (globalRoot && existsSync(globalRoot)) {
    candidates.push(join(globalRoot, 'playwright', 'index.mjs'));
    // Playwright bundled inside a globally installed package
    for (const owner of ['@executeautomation/playwright-mcp-server', '@playwright/mcp']) {
        candidates.push(join(globalRoot, owner, 'node_modules', 'playwright', 'index.mjs'));
    }
}

export async function loadPlaywright() {
    const tried = [];
    for (const c of candidates) {
        try {
            const spec = c === 'playwright' ? c : pathToFileURL(c).href;
            if (c !== 'playwright' && !existsSync(c)) { tried.push(c); continue; }
            return await import(spec);
        } catch (e) {
            tried.push(`${c} (${e.code || e.message})`);
        }
    }
    throw new Error('Could not load Playwright. Tried:\n  ' + tried.join('\n  ')
        + '\nInstall it with:  npm i -D playwright  (then npx playwright install chromium)');
}

/**
 * Headed by default and on purpose. Headless Chrome throttles
 * requestAnimationFrame to roughly 14fps here, and these tools exist to read
 * per-frame numbers, so throttling swamps the signal.
 */
export async function launch(playwright, opts = {}) {
    return playwright.chromium.launch({
        headless: false,
        args: ['--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows'],
        ...opts,
    });
}
