// Full visual/UX/interaction audit. READ-ONLY against source; writes results
// only under scripts/content/qa/. Run: node scripts/content/qa/audit.mjs
import { writeFileSync, statSync } from "node:fs";
import { spawn } from "node:child_process";
import { connect } from "./cdp.mjs";

const BASE = "http://localhost:5178/algorithm-visualizing/";
const OUT = "scripts/content/qa/audit-results.json";
const SHOT_DIR = "scripts/content/qa/screenshots";

const ALGOS = [
    { id: "bubble-sort", cat: "sorting" },
    { id: "linear-search", cat: "searching" },
    { id: "bfs", cat: "graph" },
    { id: "a-star", cat: "shortest-path" },
    { id: "kruskal", cat: "mst" },
    { id: "dinic", cat: "flow" },
    { id: "tree-traversals", cat: "tree" },
    { id: "knuth-morris-pratt", cat: "string" },
    { id: "sieve-eratosthenes", cat: "math" },
    { id: "knapsack-01", cat: "dynamic-programming" },
    { id: "minimax", cat: "game" },
    { id: "convex-hull-graham", cat: "geometry" },
    { id: "dsu", cat: "data-structures" },
    // One from each of the seven new categories.
    { id: "adaboost", cat: "ml-ai" },
    { id: "aes-gcm-encryption", cat: "cryptography-security" },
    { id: "atomic-broadcast", cat: "parallel-distributed" },
    { id: "adams-bashforth", cat: "numerical-optimization" },
    { id: "grover-search", cat: "quantum" },
    { id: "bayes-theorem", cat: "statistics-probability" },
    { id: "token-bucket-rate-limiter", cat: "production-systems" },
];

const results = {
    startedAt: new Date().toISOString(),
    base: BASE,
    checks: [],
    console: [],
    network: [],
    algorithms: [],
    screenshots: [],
    accessibility: {},
    interactions: {},
    sw: {},
};

function check(area, name, status, details = {}) {
    results.checks.push({ area, name, status, details });
}

const S = (body) =>
    `(() => { const el = document.querySelector('#app'); const a = el && el.__vue_app__; const s = a && a.config.globalProperties.$pinia._s.get('visualizer'); if (!s) return { __nostore: true }; return (${body}); })()`;

const CANVAS = (i = 0) => `(() => {
    const c = document.querySelectorAll('canvas.visual-canvas')[${i}];
    if (!c) return { error: 'no canvas' };
    const ctx = c.getContext('2d');
    const d = ctx.getImageData(0, 0, c.width, c.height).data;
    const colors = new Set(); let nonBg = 0;
    const bg = getComputedStyle(document.documentElement).getPropertyValue('--color-bg-canvas').trim();
    let br = 255, bgg = 255, bb = 255;
    const m = /^#([0-9a-f]{6})$/i.exec(bg);
    if (m) { br = parseInt(m[1].slice(0,2),16); bgg = parseInt(m[1].slice(2,4),16); bb = parseInt(m[1].slice(4,6),16); }
    for (let i = 0; i < d.length; i += 16) {
        const r = d[i], g = d[i+1], b = d[i+2], a = d[i+3];
        colors.add(((r >> 3) << 10) | ((g >> 3) << 5) | (b >> 3));
        if (a > 0 && (Math.abs(r-br) > 6 || Math.abs(g-bgg) > 6 || Math.abs(b-bb) > 6)) nonBg++;
    }
    return { w: c.width, h: c.height, cw: c.clientWidth, ch: c.clientHeight, uniqueColors: colors.size, nonBg, bg };
})()`;

const ENTITY_ISSUES = (which = "primary") => S(`(() => {
    const f = ${which === "compare" ? "s.compareFrame" : "s.currentFrame"};
    if (!f) return { noFrame: true };
    const c = document.querySelectorAll('canvas.visual-canvas')[${which === "compare" ? 1 : 0}];
    const w = c ? c.clientWidth : 0, h = c ? c.clientHeight : 0;
    const ids = new Set(f.entities.map(e => e.id));
    const bad = [], missingEdges = [], overlaps = [];
    for (const e of f.entities) {
        if (!Number.isFinite(e.x) || !Number.isFinite(e.y) || e.x < -60 || e.y < -60 || e.x > w + 60 || e.y > h + 60) {
            bad.push({ id: e.id, x: e.x, y: e.y, type: e.type });
        }
    }
    for (const edge of f.edges) {
        if (!ids.has(edge.sourceId) || !ids.has(edge.targetId)) missingEdges.push(edge);
    }
    // Collapse detector: 3+ entities packed into < 6px of space.
    if (f.entities.length >= 3) {
        const xs = f.entities.map(e => e.x).filter(Number.isFinite);
        const ys = f.entities.map(e => e.y).filter(Number.isFinite);
        const spanX = Math.max(...xs) - Math.min(...xs);
        const spanY = Math.max(...ys) - Math.min(...ys);
        if (spanX < 6 && spanY < 6) overlaps.push({ spanX, spanY, count: f.entities.length });
    }
    return { total: f.entities.length, edges: f.edges.length, layout: f.layout, bad, missingEdges, overlaps,
        description: (f.description || '').trim() };
})()`);

const parseColor = (v) => {
    if (!v) return null;
    const hex = /^#([0-9a-f]{6})$/i.exec(v.trim());
    if (hex) return [0, 2, 4].map((i) => parseInt(hex[1].slice(i, i + 2), 16));
    const rgb = /rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/.exec(v);
    if (rgb) return [Number(rgb[1]), Number(rgb[2]), Number(rgb[3])];
    return null;
};
const lum = ([r, g, b]) => {
    const a = [r, g, b].map((c) => {
        c /= 255;
        return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * a[0] + 0.7152 * a[1] + 0.0722 * a[2];
};
const contrast = (fg, bg) => {
    const f = parseColor(fg), b = parseColor(bg);
    if (!f || !b) return null;
    const [hi, lo] = [lum(f), lum(b)].sort((a, b) => b - a);
    return Math.round(((hi + 0.05) / (lo + 0.05)) * 100) / 100;
};

function collectRuntimeEvents(cdp, from) {
    const slice = cdp.events.slice(from);
    const errs = slice
        .filter(
            (e) =>
                e.method === "Runtime.exceptionThrown" ||
                (e.method === "Runtime.consoleAPICalled" && ["error", "warning"].includes(e.params.type)) ||
                (e.method === "Log.entryAdded" && ["error", "warning"].includes(e.params.entry.level)),
        )
        .filter((e) => {
            // Ignore Chrome advisories caused by this audit's own getImageData probes.
            const text =
                e.params?.exceptionDetails?.text ||
                e.params?.args?.map((a) => a.value ?? a.description ?? "").join(" ") ||
                e.params?.entry?.text ||
                "";
            return !/willReadFrequently/i.test(text);
        })
        .map((e) => {
            if (e.method === "Runtime.exceptionThrown")
                return {
                    type: "exception",
                    text: e.params.exceptionDetails.text + " " + (e.params.exceptionDetails.exception?.description || ""),
                };
            if (e.method === "Runtime.consoleAPICalled")
                return {
                    type: e.params.type,
                    text: e.params.args.map((a) => a.value ?? a.description ?? "").join(" "),
                };
            return { type: "log:" + e.params.entry.level, text: e.params.entry.text };
        });
    const network = slice
        .filter((e) => e.method === "Network.responseReceived" && e.params.response.status >= 400)
        .map((e) => ({ status: e.params.response.status, url: e.params.response.url }))
        .concat(
            slice
                .filter((e) => e.method === "Network.loadingFailed")
                .map((e) => ({ type: "loadingFailed", text: e.params.errorText, url: e.params.requestId })),
        );
    return { errs, network };
}

const CHROME = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const CHROME_PROFILE = "C:\\Users\\rjian\\AppData\\Local\\Temp\\opencode\\qa-chrome-profile-audit";

async function ensureChrome() {
    try {
        await fetch("http://localhost:9223/json/version");
        return;
    } catch {
        /* launch below */
    }
    spawn(
        CHROME,
        [
            "--headless=new",
            "--remote-debugging-port=9223",
            `--user-data-dir=${CHROME_PROFILE}`,
            "--no-first-run",
            "--no-default-browser-check",
            "--disable-extensions",
            "--disable-background-networking",
            "--window-size=1440,900",
            "about:blank",
        ],
        { detached: true, stdio: "ignore" },
    ).unref();
    for (let i = 0; i < 60; i++) {
        await new Promise((r) => setTimeout(r, 250));
        try {
            await fetch("http://localhost:9223/json/version");
            return;
        } catch {
            /* keep waiting */
        }
    }
    throw new Error("Could not start headless Chrome on port 9223");
}

async function main() {
    await ensureChrome();
    const version = await fetch("http://localhost:9223/json/list").then((r) => r.json());
    const page = version.find((t) => t.type === "page" && t.url === "about:blank") || version.find((t) => t.type === "page");
    if (!page) throw new Error("No page target found");
    const cdp = await connect(page.webSocketDebuggerUrl);

    await cdp.send("Runtime.enable");
    await cdp.send("Log.enable");
    await cdp.send("Page.enable");
    await cdp.send("Network.enable");

    // ---------------------------------------------------------------- 0. smoke
    let mark = cdp.events.length;
    await cdp.goto(BASE);
    await cdp.waitFor(() => cdp.evaluate("!!document.querySelector('.sidebar-title')"), { label: "sidebar" });
    const storeOk = await cdp.evaluate(S("({ id: s.algorithmId, frames: s.totalSteps, loading: s.isLoading })"));
    check("Boot", "App mounts and store is reachable", storeOk && !storeOk.__nostore ? "PASS" : "FAIL", storeOk);
    const initial = await cdp.evaluate(`({
        title: document.title,
        desc: document.querySelector('.description-bar')?.textContent.trim(),
        steps: document.querySelector('.step-counter')?.textContent.trim(),
        canvases: document.querySelectorAll('canvas.visual-canvas').length,
        categories: document.querySelectorAll('.category-header').length,
        theme: document.documentElement.dataset.theme,
        lang: document.documentElement.lang
    })`);
    results.initial = initial;
    check("Boot", "Initial empty state renders without errors", initial.canvases === 1 && initial.categories === 20 ? "PASS" : "FAIL", initial);
    let ev = collectRuntimeEvents(cdp, mark);
    results.console.push(...ev.errs.map((e) => ({ phase: "boot", ...e })));
    results.network.push(...ev.network.map((e) => ({ phase: "boot", ...e })));
    check("Boot", "No console errors on first load", ev.errs.length === 0 ? "PASS" : "FAIL", ev.errs);
    check("Boot", "No failed network requests on first load", ev.network.length === 0 ? "PASS" : "FAIL", ev.network);

    // ---------------------------------------------------------------- 1. search
    mark = cdp.events.length;
    await cdp.evaluate(`(() => { const i = document.querySelector('.search-input'); i.value = 'bubble'; i.dispatchEvent(new Event('input', { bubbles: true })); return true; })()`);
    await cdp.sleep(450);
    const search = await cdp.evaluate(`({
        leaves: [...document.querySelectorAll('.leaf')].map(e => e.textContent.trim()),
        headers: document.querySelectorAll('.category-header').length,
        placeholder: document.querySelector('.search-input')?.placeholder
    })`);
    check("Sidebar", "Search filters the tree after debounce", search.leaves.some((x) => /bubble/i.test(x)) && search.leaves.length < 100 ? "PASS" : "FAIL", search);
    // A result in a NON-default category must be visible without manual expansion.
    await cdp.evaluate(`(() => { const i = document.querySelector('.search-input'); i.value = 'grover'; i.dispatchEvent(new Event('input', { bubbles: true })); return true; })()`);
    await cdp.sleep(450);
    const searchOther = await cdp.evaluate(`({
        headers: [...document.querySelectorAll('.category-header')].map(h => h.textContent.trim()),
        leaves: [...document.querySelectorAll('.leaf')].map(l => l.textContent.trim()),
        open: [...document.querySelectorAll('.category-header')].filter(h => h.getAttribute('aria-expanded') === 'true').length
    })`);
    results.searchOther = searchOther;
    check("Sidebar", "Search results in a collapsed category are directly clickable", searchOther.leaves.length > 0 ? "PASS" : "FAIL", searchOther);
    await cdp.evaluate(`(() => { const i = document.querySelector('.search-input'); i.value = ''; i.dispatchEvent(new Event('input', { bubbles: true })); return true; })()`);
    await cdp.sleep(450);
    const restored = await cdp.evaluate("document.querySelectorAll('.category-header').length");
    check("Sidebar", "Clearing search restores all 20 categories", restored === 20 ? "PASS" : "FAIL", { headers: restored });

    // ------------------------------------------------------------ 2. expansion
    const expandBefore = await cdp.evaluate(`(() => {
        const q = [...document.querySelectorAll('.category-header')].find(h => /Quantum/i.test(h.textContent));
        return q ? q.getAttribute('aria-expanded') : 'missing';
    })()`);
    await cdp.evaluate(`(() => { const q = [...document.querySelectorAll('.category-header')].find(h => /Quantum/i.test(h.textContent)); if (q) q.click(); return true; })()`);
    await cdp.sleep(120);
    const expandAfter = await cdp.evaluate(`(() => {
        const q = [...document.querySelectorAll('.category-header')].find(h => /Quantum/i.test(h.textContent));
        return q ? { expanded: q.getAttribute('aria-expanded'), leaves: q.nextElementSibling ? q.nextElementSibling.querySelectorAll('.leaf').length : 0, label: q.textContent.trim() } : null;
    })()`);
    const expand = { before: expandBefore, after: expandAfter?.expanded, leaves: expandAfter?.leaves, label: expandAfter?.label };
    check("Sidebar", "Category expand/collapse toggles aria-expanded and reveals leaves", expand.before === "false" && expand.after === "true" && expand.leaves > 0 ? "PASS" : "FAIL", expand);

    // ------------------------------------------------------- 3. selection + UI
    mark = cdp.events.length;
    await cdp.evaluate(`(() => { const i = document.querySelector('.search-input'); i.value = 'bubble sort'; i.dispatchEvent(new Event('input', { bubbles: true })); return true; })()`);
    await cdp.sleep(450);
    await cdp.evaluate(`(() => { const b = [...document.querySelectorAll('.leaf')].find(e => /bubble sort/i.test(e.textContent)); if (b) b.click(); return !!b; })()`);
    await cdp.waitFor(() => cdp.evaluate(S("s.algorithmId === 'bubble-sort' && !s.isLoading && s.totalSteps > 1")), { label: "bubble-sort load" });
    await cdp.sleep(150);
    const selected = await cdp.evaluate(`({
        active: document.querySelector('.leaf.selected')?.textContent.trim(),
        steps: document.querySelector('.step-counter')?.textContent.trim(),
        desc: document.querySelector('.description-bar')?.textContent.trim(),
        title: document.title,
        url: location.search,
        canvas: ${CANVAS(0)},
        entities: ${ENTITY_ISSUES()}
    })`);
    check("Canvas", "bubble-sort paints a non-blank canvas", selected.canvas.uniqueColors > 3 && selected.canvas.nonBg > 50 ? "PASS" : "FAIL", selected.canvas);
    check("Canvas", "bubble-sort entities are finite, in-bounds and described", !selected.entities.bad.length && !selected.entities.overlaps.length && !!selected.entities.description ? "PASS" : "FAIL", selected.entities);
    check("Selection", "Selecting a leaf highlights it and updates the URL/title", /bubble/i.test(selected.active || "") && selected.url.includes("algo=bubble-sort") && /bubble/i.test(selected.title) ? "PASS" : "FAIL", {
        active: selected.active, url: selected.url, title: selected.title,
    });
    const dlink = await cdp.evaluate(`(() => { const i = document.querySelector('.search-input'); return i ? true : false; })()`);

    // ------------------------------------------------------------ 4. playback
    mark = cdp.events.length;
    const beforePlay = await cdp.evaluate(S("s.stepIndex"));
    await cdp.evaluate("document.querySelector('.play-pause').click()");
    await cdp.sleep(800);
    const afterPlay = await cdp.evaluate(S("({ step: s.stepIndex, playing: s.isPlaying, label: document.querySelector('.play-pause').getAttribute('aria-label') })"));
    check("Playback", "Play advances frames and updates the button label", afterPlay.step > beforePlay && afterPlay.playing && afterPlay.label === "Pause" ? "PASS" : "FAIL", { beforePlay, afterPlay });
    await cdp.evaluate("document.querySelector('.play-pause').click()");
    const paused = await cdp.evaluate(S("({ playing: s.isPlaying, label: document.querySelector('.play-pause').getAttribute('aria-label') })"));
    check("Playback", "Pause stops playback and restores the Play label", !paused.playing && paused.label === "Play" ? "PASS" : "FAIL", paused);
    await cdp.evaluate("document.querySelector('.controls-bar button[aria-label=\"Reset to first step\"]').click()");
    const afterReset = await cdp.evaluate(S("s.stepIndex"));
    check("Playback", "Reset returns to frame 0", afterReset === 0 ? "PASS" : "FAIL", { afterReset });
    const speedBefore = await cdp.evaluate(S("s.speed"));
    await cdp.evaluate(`(() => { const el = document.querySelector('input[type=range]'); el.value = 90; el.dispatchEvent(new Event('input', { bubbles: true })); return true; })()`);
    const speedAfter = await cdp.evaluate(S("s.speed"));
    check("Playback", "Speed slider changes the interval", speedAfter !== speedBefore ? "PASS" : "FAIL", { speedBefore, speedAfter });
    await cdp.evaluate(S("s.speed = 300"));

    // ------------------------------------------------------------ 5. keyboard
    // Focus the first header button to test the Space-on-button interaction.
    await cdp.evaluate("document.querySelector('.header-actions button').focus()");
    const focused = await cdp.evaluate("document.activeElement?.textContent.trim()");
    const stepBeforeKey = await cdp.evaluate(S("s.stepIndex"));
    await cdp.key({ key: " ", code: "Space", windowsVirtualKeyCode: 32, nativeVirtualKeyCode: 32 });
    await cdp.sleep(100);
    const afterSpace = await cdp.evaluate(S("({ step: s.stepIndex, playing: s.isPlaying, active: document.activeElement?.textContent.trim() })"));
    check("Keyboard", "Space toggles playback", afterSpace.playing === true ? "PASS" : "FAIL", { focused, stepBeforeKey, afterSpace });
    // Native button semantics: Space should activate the focused button.
    const panelOpenedBySpace = await cdp.evaluate("!!document.querySelector('.input-panel')");
    check("Keyboard", "Space activates a focused header button (native semantics)", panelOpenedBySpace ? "PASS" : "FAIL", { focused, panelOpenedBySpace });
    // Enter remains the fallback activation key. Close any panel Space may have
    // opened, prime page focus, and dispatch with an explicit text value.
    await cdp.evaluate(`(() => {
        if (document.querySelector('.input-panel')) { const b = [...document.querySelectorAll('.header-actions button')].find(x => x.textContent.trim() === 'Input'); if (b) b.click(); }
        const b = document.querySelector('.header-actions button');
        window.__enterClicks = 0;
        b.addEventListener('click', () => { window.__enterClicks += 1; });
        b.focus();
        return true;
    })()`);
    await cdp.sleep(100);
    const enterKey = { key: "Enter", code: "Enter", windowsVirtualKeyCode: 13, nativeVirtualKeyCode: 13, text: "\r" };
    await cdp.send("Input.dispatchKeyEvent", { type: "keyDown", ...enterKey });
    await cdp.send("Input.dispatchKeyEvent", { type: "keyUp", ...enterKey });
    await cdp.sleep(150);
    const enterInfo = await cdp.evaluate(`({ clicks: window.__enterClicks, panel: !!document.querySelector('.input-panel'), hasFocus: document.hasFocus() })`);
    check("Keyboard", "Enter activates a focused header button", enterInfo.clicks > 0 || enterInfo.panel ? "PASS" : "FAIL", enterInfo);
    // Leave all toggles closed for the panel-specific phases below.
    await cdp.evaluate(`(() => { if (document.querySelector('.input-panel')) { const b = [...document.querySelectorAll('.header-actions button')].find(x => x.textContent.trim() === 'Input'); if (b) b.click(); } return true; })()`);
    await cdp.sleep(100);
    await cdp.evaluate(S("s.stopPlayback()"));
    const k0 = await cdp.evaluate(S("s.stepIndex"));
    await cdp.key({ key: "ArrowRight", code: "ArrowRight", windowsVirtualKeyCode: 39, nativeVirtualKeyCode: 39 });
    await cdp.sleep(60);
    const k1 = await cdp.evaluate(S("s.stepIndex"));
    await cdp.key({ key: "ArrowLeft", code: "ArrowLeft", windowsVirtualKeyCode: 37, nativeVirtualKeyCode: 37 });
    await cdp.sleep(60);
    const k2 = await cdp.evaluate(S("s.stepIndex"));
    await cdp.key({ key: "r", code: "KeyR", windowsVirtualKeyCode: 82, nativeVirtualKeyCode: 82 });
    await cdp.sleep(60);
    const k3 = await cdp.evaluate(S("s.stepIndex"));
    check("Keyboard", "ArrowRight / ArrowLeft / R step and reset", k1 === k0 + 1 && k2 === k0 && k3 === 0 ? "PASS" : "FAIL", { k0, k1, k2, k3 });
    // Shortcuts must be ignored while typing.
    await cdp.evaluate("(() => { const i = document.querySelector('.search-input'); i.focus(); return true; })()");
    const t0 = await cdp.evaluate(S("s.stepIndex"));
    await cdp.key({ key: "ArrowRight", code: "ArrowRight", windowsVirtualKeyCode: 39, nativeVirtualKeyCode: 39 });
    await cdp.sleep(60);
    const t1 = await cdp.evaluate(S("s.stepIndex"));
    check("Keyboard", "Arrow keys are ignored inside a text input", t0 === t1 ? "PASS" : "FAIL", { t0, t1 });
    await cdp.evaluate("document.querySelector('.search-input').blur()");

    // --------------------------------------------------------------- 6. theme
    mark = cdp.events.length;
    const light = await cdp.evaluate(`({
        theme: document.documentElement.dataset.theme,
        bg: getComputedStyle(document.documentElement).getPropertyValue('--color-bg-canvas').trim(),
        text: getComputedStyle(document.documentElement).getPropertyValue('--color-text-primary').trim(),
        metaColor: document.querySelector('meta[name=theme-color]')?.content
    })`);
    await cdp.evaluate("document.querySelector('.theme-toggle').click()");
    await cdp.sleep(120);
    const dark = await cdp.evaluate(`({
        theme: document.documentElement.dataset.theme,
        bg: getComputedStyle(document.documentElement).getPropertyValue('--color-bg-canvas').trim(),
        text: getComputedStyle(document.documentElement).getPropertyValue('--color-text-primary').trim(),
        metaColor: document.querySelector('meta[name=theme-color]')?.content,
        canvas: ${CANVAS(0)}
    })`);
    check("Theme", "Toggle flips light/dark theme, CSS tokens and theme-color meta", light.theme !== dark.theme && light.bg !== dark.bg && light.metaColor !== dark.metaColor ? "PASS" : "FAIL", { light, dark: { theme: dark.theme, bg: dark.bg, metaColor: dark.metaColor } });
    check("Canvas", "Canvas repaints in dark theme", dark.canvas.uniqueColors > 3 && dark.canvas.nonBg > 50 ? "PASS" : "FAIL", dark.canvas);
    results.darkCanvas = dark.canvas;

    // Contrast in both themes.
    async function contrastSnapshot() {
        return cdp.evaluate(`(() => {
            const theme = document.documentElement.dataset.theme;
            const pairs = [
                ['title', '.app-title', '.app-header'],
                ['description', '.description-bar', '.description-bar'],
                ['leaf', '.leaf.selected', '.sidebar'],
                ['button', '.header-actions button', '.app-header'],
                ['secondary', '.field-hint', '.input-panel']
            ];
            const bgOf = (el) => {
                let e = el;
                while (e) {
                    const c = getComputedStyle(e).backgroundColor;
                    if (c && c !== 'rgba(0, 0, 0, 0)' && c !== 'transparent') return c;
                    e = e.parentElement;
                }
                return 'rgb(255, 255, 255)';
            };
            return { theme, rows: pairs.map(([name, fgSel]) => {
                const fg = document.querySelector(fgSel);
                if (!fg) return { name, missing: true };
                return { name, fg: getComputedStyle(fg).color, bg: bgOf(fg) };
            }) };
        })()`);
    }
    const firstContrast = await contrastSnapshot();
    await cdp.evaluate("document.querySelector('.theme-toggle').click()");
    await cdp.sleep(120);
    const secondContrast = await contrastSnapshot();
    const contrastRows = [];
    for (const snap of [firstContrast, secondContrast]) {
        for (const row of snap.rows) {
            if (row.missing) continue;
            contrastRows.push({ theme: snap.theme, name: row.name, ratio: contrast(row.fg, row.bg), fg: row.fg, bg: row.bg });
        }
    }
    results.accessibility.contrast = contrastRows;
    const lowContrast = contrastRows.filter((r) => r.ratio !== null && r.ratio < 4.5);
    check("Accessibility", "Text contrast >= 4.5:1 in both themes", lowContrast.length === 0 ? "PASS" : "WARN", lowContrast);
    ev = collectRuntimeEvents(cdp, mark);
    results.console.push(...ev.errs.map((e) => ({ phase: "theme", ...e })));

    // ------------------------------------------------------------ 7. input form
    mark = cdp.events.length;
    await cdp.evaluate("[...document.querySelectorAll('.header-actions button')].find(b => b.textContent.trim() === 'Input').click()");
    await cdp.waitFor(() => cdp.evaluate("!!document.querySelector('.input-panel')"), { label: "input panel" });
    const inputForm = await cdp.evaluate(`({
        fields: [...document.querySelectorAll('.input-panel .field-label')].map(e => e.textContent.trim()),
        toolbar: [...document.querySelectorAll('.input-toolbar button')].map(e => e.textContent.trim()),
        run: !!document.querySelector('.run-button')
    })`);
    check("Input", "Friendly input form renders labelled fields and a Run button", inputForm.fields.length > 0 && inputForm.run ? "PASS" : "FAIL", inputForm);
    // Change the first numeric field and run.
    const inputBefore = await cdp.evaluate("document.querySelector('.input-panel input[type=text], .input-panel input[type=number]')?.value");
    await cdp.evaluate(`(() => {
        const num = document.querySelector('.input-panel input[type=text], .input-panel input[type=number]');
        if (!num) return false;
        num.value = '5, 3, 1, 4, 2'; num.dispatchEvent(new Event('input', { bubbles: true }));
        document.querySelector('.run-button').click();
        return true;
    })()`);
    await cdp.sleep(150);
    const inputRun = await cdp.evaluate(`({ notice: document.querySelector('.notice')?.textContent.trim(),
        step: ${S("s.stepIndex")}, frames: ${S("s.totalSteps")},
        input: document.querySelector('.input-panel input[type=text], .input-panel input[type=number]')?.value })`);
    inputRun.before = inputBefore;
    check("Input", "Editing a field and running restarts the algorithm", inputRun.step === 0 && /restarted/i.test(inputRun.notice || "") && inputRun.input !== inputBefore ? "PASS" : "FAIL", inputRun);
    // Random + Default buttons.
    await cdp.evaluate("[...document.querySelectorAll('.input-toolbar button')].find(b => /Random/i.test(b.textContent)).click()");
    const randomNotice = await cdp.evaluate("document.querySelector('.notice')?.textContent.trim()");
    await cdp.evaluate("[...document.querySelectorAll('.input-toolbar button')].find(b => /Default/i.test(b.textContent)).click()");
    const defaultNotice = await cdp.evaluate("document.querySelector('.notice')?.textContent.trim()");
    check("Input", "Random and Default buttons refill the form", /Random/i.test(randomNotice || "") && /Default/i.test(defaultNotice || "") ? "PASS" : "FAIL", { randomNotice, defaultNotice });
    // JSON mode validation.
    await cdp.evaluate("[...document.querySelectorAll('.input-toolbar button')].find(b => /Advanced JSON/i.test(b.textContent)).click()");
    await cdp.evaluate(`(() => { const t = document.querySelector('#input-json'); t.value = '{ bad json'; t.dispatchEvent(new Event('input', { bubbles: true })); document.querySelector('.run-button').click(); return true; })()`);
    const jsonError = await cdp.evaluate(`(() => { const e = document.querySelector('.message.error'); return e ? { text: e.textContent.trim(), role: e.getAttribute('role') } : null; })()`);
    check("Input", "Invalid JSON shows an alert-role validation message", !!jsonError && jsonError.role === "alert" ? "PASS" : "FAIL", jsonError);
    await cdp.evaluate("[...document.querySelectorAll('.input-toolbar button')].find(b => /Friendly form/i.test(b.textContent)).click()");
    ev = collectRuntimeEvents(cdp, mark);
    results.console.push(...ev.errs.map((e) => ({ phase: "input", ...e })));

    // --------------------------------------------------------- 8. compare mode
    mark = cdp.events.length;
    await cdp.evaluate("[...document.querySelectorAll('.header-actions button')].find(b => b.textContent.trim() === 'Compare').click()");
    await cdp.waitFor(() => cdp.evaluate("!!document.querySelector('.compare-panel')"), { label: "compare panel" });
    await cdp.evaluate(`(() => {
        const sel = document.querySelector('#compare-select');
        sel.value = 'insertion-sort';
        sel.dispatchEvent(new Event('change', { bubbles: true }));
        return true;
    })()`);
    await cdp.waitFor(() => cdp.evaluate(S("s.isCompareMode && !!s.compareFrame")), { label: "compare load" });
    await cdp.sleep(150);
    const compare = await cdp.evaluate(`({
        canvases: document.querySelectorAll('canvas.visual-canvas').length,
        labels: [...document.querySelectorAll('.canvas-label')].map(e => e.textContent.trim()),
        columns: [...document.querySelectorAll('.compare-column h3')].map(e => e.textContent.trim()),
        a: ${S("s.stepIndex")}, b: ${S("s.compareStepIndex")},
        canvasB: ${CANVAS(1)},
        entitiesB: ${ENTITY_ISSUES("compare")}
    })`);
    check("Compare", "Compare mode shows two labelled canvases and both counters", compare.canvases === 2 && compare.labels.length === 2 && compare.columns.length === 2 ? "PASS" : "FAIL", compare);
    check("Compare", "Comparison canvas B paints and has valid entities", compare.canvasB.uniqueColors > 3 && !compare.entitiesB.bad.length && !compare.entitiesB.noFrame ? "PASS" : "FAIL", { canvas: compare.canvasB, entities: compare.entitiesB });
    await cdp.evaluate(S("(s.nextStep(), s.nextStep())"));
    await cdp.sleep(100);
    const synced = await cdp.evaluate(S("({ a: s.stepIndex, b: s.compareStepIndex })"));
    check("Compare", "Both engines advance together", synced.a === synced.b ? "PASS" : "FAIL", synced);
    await cdp.evaluate(`(() => { const sel = document.querySelector('#compare-select'); sel.value = ''; sel.dispatchEvent(new Event('change', { bubbles: true })); return true; })()`);
    await cdp.waitFor(() => cdp.evaluate(S("!s.isCompareMode")), { label: "compare off" });
    ev = collectRuntimeEvents(cdp, mark);
    results.console.push(...ev.errs.map((e) => ({ phase: "compare", ...e })));

    // ---------------------------------------------------------------- 9. share
    mark = cdp.events.length;
    await cdp.evaluate("[...document.querySelectorAll('.header-actions button')].find(b => b.textContent.trim() === 'Share').click()");
    await cdp.waitFor(() => cdp.evaluate("!!document.querySelector('.share-panel')"), { label: "share panel" });
    const share = await cdp.evaluate(`({
        link: document.querySelector('#share-link')?.value,
        embed: document.querySelector('#embed-code')?.value,
        title: [...document.querySelectorAll('.share-meta dd')][0]?.textContent.trim(),
        statusRole: document.querySelector('.share-panel .status')?.getAttribute('aria-live')
    })`);
    check("Share", "Share panel builds a deep link and an embed snippet", /algo=bubble-sort/.test(share.link || "") && /<iframe/.test(share.embed || "") && share.statusRole === "polite" ? "PASS" : "FAIL", share);
    // Copy link (clipboard may be blocked in headless; accept either outcome but require a status).
    await cdp.evaluate("[...document.querySelectorAll('.share-actions button')].find(b => /Copy link/.test(b.textContent)).click()");
    await cdp.sleep(150);
    const copyStatus = await cdp.evaluate("document.querySelector('.share-panel .status')?.textContent.trim()");
    check("Share", "Copy link reports success or a clear failure", /copied|failed/i.test(copyStatus || "") ? "PASS" : "FAIL", { copyStatus });
    results.shareLink = share.link;
    ev = collectRuntimeEvents(cdp, mark);
    results.console.push(...ev.errs.map((e) => ({ phase: "share", ...e })));

    // --------------------------------------------------------------- 10. export
    mark = cdp.events.length;
    await cdp.evaluate("[...document.querySelectorAll('.header-actions button')].find(b => b.textContent.trim() === 'Export').click()");
    await cdp.waitFor(() => cdp.evaluate("!!document.querySelector('.export-panel')"), { label: "export panel" });
    const exportInit = await cdp.evaluate(`({
        tabs: [...document.querySelectorAll('.language-tabs button')].map(b => b.textContent.trim()),
        pressed: [...document.querySelectorAll('.language-tabs button')].filter(b => b.getAttribute('aria-pressed') === 'true').map(b => b.textContent.trim()),
        code: document.querySelector('.code-block code')?.textContent.trim().slice(0, 200),
        disclaimer: document.querySelector('.disclaimer')?.textContent.trim()
    })`);
    await cdp.evaluate("[...document.querySelectorAll('.language-tabs button')].find(b => /Java/i.test(b.textContent) && !/JavaScript/i.test(b.textContent)).click()");
    const exportJava = await cdp.evaluate("document.querySelector('.code-block code')?.textContent.trim().slice(0, 200)");
    check("Export", "Code export renders non-empty code for multiple languages", exportInit.tabs.length >= 4 && !!exportInit.code && exportJava !== exportInit.code && /pseudocode|not the canonical/i.test(exportInit.disclaimer || "") ? "PASS" : "FAIL", { tabs: exportInit.tabs, pressed: exportInit.pressed, py: exportInit.code?.slice(0, 100), java: exportJava?.slice(0, 100) });

    // -------------------------------------------------------------- 11. learning
    await cdp.evaluate("[...document.querySelectorAll('.header-actions button')].find(b => b.textContent.trim() === 'Learn').click()");
    await cdp.waitFor(() => cdp.evaluate("!!document.querySelector('.learning-panel')"), { label: "learning panel" });
    const learnBefore = await cdp.evaluate("document.querySelector('.bookmark-button')?.getAttribute('aria-pressed')");
    await cdp.evaluate("document.querySelector('.bookmark-button')?.click()");
    await cdp.sleep(120);
    const learnAfter = await cdp.evaluate("document.querySelector('.bookmark-button')?.getAttribute('aria-pressed')");
    await cdp.evaluate("document.querySelector('.quiz-choices button')?.click()");
    await cdp.sleep(120);
    const learn = await cdp.evaluate(`({ before: ${JSON.stringify(learnBefore)}, after: ${JSON.stringify(learnAfter)},
        saved: !!localStorage.getItem('algoviz-bookmarks'),
        quiz: document.querySelectorAll('.quiz-question').length,
        feedback: document.querySelector('.quiz-feedback')?.textContent.trim(),
        related: document.querySelectorAll('.learning-section h3').length,
        progress: Object.keys(JSON.parse(localStorage.getItem('algoviz-progress') || '{}')).length })`);
    check("Learning", "Bookmark, progress, related and quiz render and respond", learn.before !== learn.after && learn.saved && learn.quiz > 0 && !!learn.feedback && learn.progress > 0 ? "PASS" : "FAIL", learn);
    ev = collectRuntimeEvents(cdp, mark);
    results.console.push(...ev.errs.map((e) => ({ phase: "panels", ...e })));

    // --------------------------------------------------------- 12. a11y basics
    const a11y = await cdp.evaluate(`(() => {
        const iconless = [...document.querySelectorAll('button')]
            .filter(b => !(b.textContent || '').trim() && !b.getAttribute('aria-label'))
            .map(b => b.outerHTML.slice(0, 140));
        const canvas = document.querySelector('canvas.visual-canvas');
        const desc = document.querySelector('.description-bar');
        const details = document.querySelector('.text-alternative');
        const before = details.open;
        details.open = true;
        const textAlt = {
            summary: details.querySelector('summary')?.textContent.trim(),
            caption: details.querySelector('.frame-caption')?.textContent.trim(),
            entityRows: details.querySelectorAll('ul li').length,
            headings: [...details.querySelectorAll('h3')].map(h => h.textContent.trim())
        };
        details.open = before;
        return {
            iconless,
            canvasRole: canvas?.getAttribute('role'),
            canvasLabel: canvas?.getAttribute('aria-label'),
            descRole: desc?.getAttribute('role'),
            descLive: desc?.getAttribute('aria-live'),
            textAlt
        };
    })()`);
    results.accessibility.basics = a11y;
    check("Accessibility", "Every icon-only button has an aria-label", a11y.iconless.length === 0 ? "PASS" : "FAIL", a11y.iconless);
    check("Accessibility", "Canvas exposes role=img and a descriptive aria-label", a11y.canvasRole === "img" && /Visualization:/.test(a11y.canvasLabel || "") ? "PASS" : "FAIL", { role: a11y.canvasRole, label: a11y.canvasLabel });
    check("Accessibility", "Descriptions are announced through a polite live region", a11y.descRole === "status" && a11y.descLive === "polite" ? "PASS" : "FAIL", { role: a11y.descRole, live: a11y.descLive });
    check("Accessibility", "Text alternative panel lists caption, entities and connections", !!a11y.textAlt.caption && a11y.textAlt.headings.includes("Entities") && a11y.textAlt.headings.includes("Connections") ? "PASS" : "FAIL", a11y.textAlt);

    // Focus ring via real Tab navigation.
    await cdp.evaluate("document.body.focus()");
    let focusInfo = null;
    for (let i = 0; i < 8; i++) {
        await cdp.key({ key: "Tab", code: "Tab", windowsVirtualKeyCode: 9, nativeVirtualKeyCode: 9 });
        focusInfo = await cdp.evaluate(`(() => { const e = document.activeElement; const s = getComputedStyle(e); return { tag: e?.tagName, text: (e?.textContent || '').trim().slice(0, 40), outline: s.outlineStyle + ' ' + s.outlineWidth + ' ' + s.outlineColor, focusVisible: e?.matches(':focus-visible') }; })()`);
        if (focusInfo.focusVisible) break;
    }
    results.accessibility.focus = focusInfo;
    check("Accessibility", "Keyboard focus shows a visible focus ring", !!focusInfo?.focusVisible && /solid/.test(focusInfo.outline) && !/0px/.test(focusInfo.outline) ? "PASS" : "FAIL", focusInfo);

    // Reduced motion.
    await cdp.send("Emulation.setEmulatedMedia", { features: [{ name: "prefers-reduced-motion", value: "reduce" }] });
    await cdp.sleep(60);
    const reduced = await cdp.evaluate(`({
        matches: matchMedia('(prefers-reduced-motion: reduce)').matches,
        transition: getComputedStyle(document.querySelector('button')).transitionDuration,
        animation: getComputedStyle(document.querySelector('button')).animationDuration
    })`);
    await cdp.send("Emulation.setEmulatedMedia", { features: [] });
    results.accessibility.reducedMotion = reduced;
    check("Accessibility", "prefers-reduced-motion is honored by CSS", reduced.matches && /1e-05s|0\.00001s|^0s|0\.01ms/.test(reduced.transition) ? "PASS" : "WARN", reduced);

    // ------------------------------------------------------ 13. algorithm sweep
    for (const algo of ALGOS) {
        const markA = cdp.events.length;
        const rec = { id: algo.id, cat: algo.cat, frames: [], deepLink: null };
        try {
            await cdp.goto(`${BASE}?algo=${algo.id}&step=3`);
            await cdp.waitFor(() => cdp.evaluate(S(`s.algorithmId === '${algo.id}' && !s.isLoading && s.totalSteps > 0`)), {
                label: `load ${algo.id}`,
                timeout: 20000,
            });
            await cdp.sleep(120);
            const meta = await cdp.evaluate(S("({ id: s.algorithmId, total: s.totalSteps, step: s.stepIndex, name: s.algorithm?.name, layout: s.currentFrame?.layout })"));
            rec.total = meta.total;
            rec.name = meta.name;
            rec.layout = meta.layout;
            rec.deepLink = { requested: 3, got: meta.step, ok: meta.step === Math.min(3, Math.max(0, meta.total - 1)) };
            const targets = [...new Set([0, 1, Math.floor((meta.total - 1) / 2), Math.max(0, meta.total - 2), meta.total - 1])]
                .filter((n) => n >= 0 && n < meta.total);
            for (const t of targets) {
                await cdp.evaluate(S(`s.goToStep(${t})`));
                await cdp.sleep(90);
                const sample = await cdp.evaluate(`({
                    step: ${S("s.stepIndex")},
                    canvas: ${CANVAS(0)},
                    entities: ${ENTITY_ISSUES()},
                    bar: document.querySelector('.description-bar')?.textContent.trim()
                })`);
                rec.frames.push({
                    target: t,
                    step: sample.step,
                    uniqueColors: sample.canvas.uniqueColors,
                    nonBg: sample.canvas.nonBg,
                    bad: sample.entities.bad,
                    missingEdges: sample.entities.missingEdges,
                    overlaps: sample.entities.overlaps,
                    entityCount: sample.entities.total,
                    description: sample.entities.description?.slice(0, 120),
                    bar: (sample.bar || "").slice(0, 120),
                });
            }
            const evA = collectRuntimeEvents(cdp, markA);
            rec.consoleErrors = evA.errs;
            rec.networkErrors = evA.network;
            const blanks = rec.frames.filter((f) => f.uniqueColors <= 3 || f.nonBg <= 20);
            const bads = rec.frames.flatMap((f) => f.bad);
            const overlaps = rec.frames.flatMap((f) => f.overlaps);
            const missingDesc = rec.frames.filter((f) => !f.description || /^Loading/.test(f.description));
            rec.verdict = {
                blank: blanks.length,
                badEntities: bads.length,
                overlaps: overlaps.length,
                missingDesc: missingDesc.length,
                consoleErrors: evA.errs.length,
                networkErrors: evA.network.length,
                deepLinkOk: rec.deepLink.ok,
            };
            const ok = rec.verdict.blank === 0 && rec.verdict.badEntities === 0 && rec.verdict.overlaps === 0 && rec.verdict.missingDesc === 0 && rec.verdict.consoleErrors === 0 && rec.verdict.networkErrors === 0 && rec.verdict.deepLinkOk;
            check("AlgorithmSweep", `${algo.id} (${algo.cat})`, ok ? "PASS" : "FAIL", { total: rec.total, layout: rec.layout, frames: rec.frames.length, verdict: rec.verdict });
        } catch (err) {
            rec.error = String(err && err.message ? err.message : err);
            check("AlgorithmSweep", `${algo.id} (${algo.cat})`, "FAIL", { error: rec.error });
        }
        results.algorithms.push(rec);
    }

    // Unknown deep-link id must not crash the app.
    mark = cdp.events.length;
    await cdp.goto(`${BASE}?algo=definitely-not-an-algorithm&step=9`);
    await cdp.sleep(300);
    const unknown = await cdp.evaluate(S("({ id: s.algorithmId, loading: s.isLoading })"));
    ev = collectRuntimeEvents(cdp, mark);
    check("DeepLink", "Unknown algorithm id degrades gracefully", !unknown.id && !unknown.loading && ev.errs.length === 0 ? "PASS" : "FAIL", { unknown, errs: ev.errs });

    // ------------------------------------------------------ 14. service worker
    mark = cdp.events.length;
    await cdp.goto(BASE);
    await cdp.waitFor(() => cdp.evaluate("!!document.querySelector('.visual-canvas')"), { label: "reboot" });
    await cdp.sleep(600);
    const registrations = await cdp.evaluate(`navigator.serviceWorker.getRegistrations().then(rs => rs.map(r => ({ scope: r.scope, script: r.active?.scriptURL || r.installing?.scriptURL, state: r.active?.state || r.installing?.state })))`);
    const caches = await cdp.evaluate(`caches.keys().then(async ks => { const o = {}; for (const k of ks) o[k] = await caches.open(k).then(c => c.keys()).then(a => a.length); return o; })`);
    results.sw = { registrations, caches };
    check("PWA", "Service worker registers with the app scope", registrations.some((r) => /sw\.js/.test(r.script || "") && r.scope.includes("algorithm-visualizing")) ? "PASS" : "FAIL", registrations);
    check("PWA", "Service worker populates a cache", Object.values(caches).some((n) => n > 0) ? "PASS" : "FAIL", caches);

    // ------------------------------------------------------- 15. mobile 390x844
    await cdp.send("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
    await cdp.evaluate("window.dispatchEvent(new Event('resize'))");
    await cdp.sleep(400);
    const mobile = await cdp.evaluate(`({
        innerWidth, scrollWidth: document.documentElement.scrollWidth,
        clientWidth: document.documentElement.clientWidth,
        toggleDisplay: getComputedStyle(document.querySelector('.drawer-toggle')).display,
        wrapOpen: document.querySelector('.sidebar-wrap').classList.contains('open'),
        wrapTransform: getComputedStyle(document.querySelector('.sidebar-wrap')).transform,
        canvas: ${CANVAS(0)},
        appBodyOverflow: getComputedStyle(document.querySelector('.app-body')).overflowY,
        headerActions: (() => { const e = document.querySelector('.header-actions'); return { cw: e.clientWidth, sw: e.scrollWidth, overflow: getComputedStyle(e).overflowX }; })()
    })`);
    check("Mobile", "No horizontal page overflow at 390px", mobile.scrollWidth <= mobile.innerWidth + 1 ? "PASS" : "FAIL", { innerWidth: mobile.innerWidth, scrollWidth: mobile.scrollWidth });
    check("Mobile", "Sidebar becomes a closed drawer with a hamburger toggle", mobile.toggleDisplay !== "none" && !mobile.wrapOpen ? "PASS" : "FAIL", { toggle: mobile.toggleDisplay, wrapOpen: mobile.wrapOpen, canvasSize: { w: mobile.canvas.w, h: mobile.canvas.h, cw: mobile.canvas.cw, ch: mobile.canvas.ch } });
    check("Mobile", "Information column is reachable by scrolling", mobile.appBodyOverflow === "auto" ? "PASS" : "FAIL", { overflow: mobile.appBodyOverflow });
    // Open drawer, search, select, confirm auto-close.
    await cdp.evaluate("document.querySelector('.drawer-toggle').click()");
    await cdp.sleep(150);
    const drawerOpen = await cdp.evaluate("document.querySelector('.sidebar-wrap').classList.contains('open')");
    await cdp.evaluate(`(() => { const i = document.querySelector('.search-input'); i.value = 'grover'; i.dispatchEvent(new Event('input', { bubbles: true })); return true; })()`);
    await cdp.sleep(450);
    // Work around the known search/collapsed-category bug: expand the matching header.
    await cdp.evaluate(`(() => { const h = document.querySelector('.category-header'); if (h && h.getAttribute('aria-expanded') === 'false') h.click(); return true; })()`);
    const picked = await cdp.evaluate(`(() => { const b = [...document.querySelectorAll('.leaf')].find(e => /grover/i.test(e.textContent)); if (b) b.click(); return !!b; })()`);
    await cdp.waitFor(() => cdp.evaluate(S("s.algorithmId === 'grover-search' && !s.isLoading")), { label: "mobile grover load", timeout: 20000 });
    await cdp.sleep(200);
    const mobileAfter = await cdp.evaluate(`({
        wrapOpen: document.querySelector('.sidebar-wrap').classList.contains('open'),
        canvas: ${CANVAS(0)},
        desc: document.querySelector('.description-bar')?.textContent.trim().slice(0, 100)
    })`);
    check("Mobile", "Selecting an algorithm from the drawer closes it and paints the canvas", drawerOpen && picked && !mobileAfter.wrapOpen && mobileAfter.canvas.uniqueColors > 3 ? "PASS" : "FAIL", { drawerOpen, picked, wrapOpen: mobileAfter.wrapOpen, canvas: { colors: mobileAfter.canvas.uniqueColors, nonBg: mobileAfter.canvas.nonBg } });
    // Small screenshot (deviceScaleFactor 2 => 780x1688).
    const mobileShot = `${SHOT_DIR}/mobile-390x844.jpg`;
    await cdp.screenshot(mobileShot, { quality: 50 });
    results.screenshots.push({ path: mobileShot, bytes: statSync(mobileShot).size });
    await cdp.send("Emulation.clearDeviceMetricsOverride");

    // --------------------------------------------------------------- finalize
    results.finishedAt = new Date().toISOString();
    const counts = results.checks.reduce((a, c) => ((a[c.status] = (a[c.status] || 0) + 1), a), {});
    results.summary = counts;
    writeFileSync(OUT, JSON.stringify(results, null, 2));
    console.log("SUMMARY", JSON.stringify(counts));
    for (const c of results.checks.filter((x) => x.status !== "PASS")) {
        console.log(`${c.status} [${c.area}] ${c.name} :: ${JSON.stringify(c.details).slice(0, 300)}`);
    }
    console.log("TOTAL CONSOLE EVENTS", results.console.length);
    console.log("SCREENSHOTS", JSON.stringify(results.screenshots));
    cdp.close();
}

main().catch((err) => {
    console.error("AUDIT FAILED", err);
    try {
        results.finishedAt = new Date().toISOString();
        writeFileSync(OUT, JSON.stringify(results, null, 2));
    } catch {
        /* ignore */
    }
    process.exit(1);
});
