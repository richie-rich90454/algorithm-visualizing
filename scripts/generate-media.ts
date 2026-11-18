/**
 * generate-media.ts - Reproducible media kit generator.
 *
 * Run: bun scripts/generate-media.ts
 *
 * Real captures (Chrome DevTools Protocol driving `bun run dev`):
 *   public/media/screenshot-desktop.png
 *   public/media/screenshot-mobile.png
 *   public/media/hero.gif
 *   public/media/trailer.mp4
 *
 * Rendered programmatically (SVG -> PNG via ImageMagick):
 *   public/media/og-image.png
 *   public/media/categories/<id>.png
 *
 * Requires Chrome at the known path and ffmpeg/magick on PATH. No npm
 * dependencies are added; Node 22+ global WebSocket drives CDP directly.
 */

import { spawn, execFileSync, type ChildProcess } from "node:child_process";
import { existsSync, mkdtempSync, mkdirSync, writeFileSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { MANIFEST } from "../src/core/manifest.ts";
import { CATEGORY_LABELS } from "../src/composables/categories.ts";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const MEDIA = path.join(ROOT, "public", "media");
const CAT_DIR = path.join(MEDIA, "categories");
const CHROME = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const VITE_PORT = 5177;
const CDP_PORT = 9333;
const APP_URL = `http://127.0.0.1:${VITE_PORT}/algorithm-visualizing/`;

const TEMP = mkdtempSync(path.join(tmpdir(), "algo-media-"));
const HERO_DIR = path.join(TEMP, "hero");
const TRAILER_DIR = path.join(TEMP, "trailer");
mkdirSync(HERO_DIR, { recursive: true });
mkdirSync(TRAILER_DIR, { recursive: true });
mkdirSync(CAT_DIR, { recursive: true });

const spawned: ChildProcess[] = [];

// ---------------------------------------------------------------------------
// Small utilities
// ---------------------------------------------------------------------------

function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

function run(cmd: string, args: string[]): string {
    return execFileSync(cmd, args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
}

function killTree(child: ChildProcess): void {
    try {
        if (process.platform === "win32") {
            run("taskkill", ["/PID", String(child.pid), "/T", "/F"]);
        } else {
            child.kill("SIGTERM");
        }
    } catch {
        /* already gone */
    }
}

function cleanup(): void {
    for (const child of spawned.reverse()) {
        killTree(child);
    }
    try {
        rmSync(TEMP, { recursive: true, force: true });
    } catch {
        /* best effort */
    }
}

async function waitFor<T>(fn: () => Promise<T> | T, timeoutMs: number, label: string): Promise<T> {
    const start = Date.now();
    let lastError: unknown;
    while (Date.now() - start < timeoutMs) {
        try {
            const value = await fn();
            if (value) return value;
        } catch (error) {
            lastError = error;
        }
        await sleep(150);
    }
    throw new Error(`Timed out waiting for ${label}${lastError ? `: ${String(lastError)}` : ""}`);
}

async function httpJson<T>(url: string): Promise<T> {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`HTTP ${response.status} from ${url}`);
    return (await response.json()) as T;
}

// ---------------------------------------------------------------------------
// Chrome DevTools Protocol client (Node global WebSocket, no dependencies)
// ---------------------------------------------------------------------------

type Pending = { resolve: (value: any) => void; reject: (reason: any) => void };

class Cdp {
    private ws: WebSocket;
    private nextId = 0;
    private pending = new Map<number, Pending>();

    private constructor(ws: WebSocket) {
        this.ws = ws;
        this.ws.onmessage = (event: MessageEvent) => this.onMessage(event.data);
    }

    static async connect(url: string): Promise<Cdp> {
        const ws = new WebSocket(url);
        await new Promise<void>((resolve, reject) => {
            ws.onopen = () => resolve();
            ws.onerror = (event) => reject(new Error(`CDP WebSocket error: ${String(event)}`));
        });
        return new Cdp(ws);
    }

    private onMessage(raw: unknown): void {
        const text = typeof raw === "string" ? raw : String(raw);
        const message = JSON.parse(text);
        if (message.id !== undefined) {
            const entry = this.pending.get(message.id);
            if (!entry) return;
            this.pending.delete(message.id);
            if (message.error) entry.reject(new Error(JSON.stringify(message.error)));
            else entry.resolve(message.result);
        }
    }

    send(method: string, params: Record<string, unknown> = {}): Promise<any> {
        const id = ++this.nextId;
        return new Promise((resolve, reject) => {
            this.pending.set(id, { resolve, reject });
            this.ws.send(JSON.stringify({ id, method, params }));
        });
    }

    async evaluate(expression: string): Promise<any> {
        const result = await this.send("Runtime.evaluate", {
            expression,
            returnByValue: true,
            awaitPromise: true,
        });
        if (result.exceptionDetails) {
            throw new Error(`Runtime.evaluate failed: ${JSON.stringify(result.exceptionDetails)}`);
        }
        return result.result?.value;
    }

    close(): void {
        try {
            this.ws.close();
        } catch {
            /* already closed */
        }
    }
}

// ---------------------------------------------------------------------------
// App driving helpers
// ---------------------------------------------------------------------------

async function startDevServer(): Promise<void> {
    let alreadyRunning = false;
    try {
        alreadyRunning = (await fetch(APP_URL)).ok;
    } catch {
        /* not running */
    }
    if (!alreadyRunning) {
        const child = spawn(
            "bun",
            ["run", "dev", "--", "--host", "127.0.0.1", "--port", String(VITE_PORT), "--strictPort"],
            { cwd: ROOT, stdio: "ignore" },
        );
        spawned.push(child);
        await waitFor(
            async () => {
                try {
                    return (await fetch(APP_URL)).ok;
                } catch {
                    return false;
                }
            },
            60000,
            "Vite dev server",
        );
    }
}

async function startChrome(): Promise<Cdp> {
    const userDataDir = path.join(TEMP, "chrome-profile");
    const child = spawn(
        CHROME,
        [
            "--headless=new",
            `--remote-debugging-port=${CDP_PORT}`,
            "--remote-allow-origins=*",
            `--user-data-dir=${userDataDir}`,
            "--no-first-run",
            "--no-default-browser-check",
            "--disable-gpu",
            "--hide-scrollbars",
            "--force-device-scale-factor=1",
            "--window-size=1440,900",
            "about:blank",
        ],
        { stdio: "ignore" },
    );
    spawned.push(child);

    const target = await waitFor(async () => {
        const targets = await httpJson<any[]>(`http://127.0.0.1:${CDP_PORT}/json/list`);
        return targets.find((entry) => entry.type === "page" && entry.webSocketDebuggerUrl);
    }, 30000, "Chrome page target");

    const cdp = await Cdp.connect(target.webSocketDebuggerUrl);
    await cdp.send("Page.enable");
    await cdp.send("Runtime.enable");
    return cdp;
}

/**
 * Pin the light theme for every capture. Headless Chrome reports a dark system
 * preference; forcing light keeps screenshots, GIF and trailer consistent with
 * the light root design tokens used by the programmatic stills.
 */
async function forceLightTheme(cdp: Cdp): Promise<void> {
    await cdp.send("Emulation.setEmulatedMedia", {
        features: [{ name: "prefers-color-scheme", value: "light" }],
    });
}

async function assertLightTheme(cdp: Cdp): Promise<void> {
    const theme: string = await cdp.evaluate("document.documentElement.dataset.theme || ''");
    if (theme !== "light") throw new Error(`Expected light theme for captures, got ${JSON.stringify(theme)}`);
}

async function setViewport(cdp: Cdp, width: number, height: number, mobile = false): Promise<void> {
    await cdp.send("Emulation.setDeviceMetricsOverride", {
        width,
        height,
        deviceScaleFactor: 1,
        mobile,
    });
    await sleep(350);
}

async function loadApp(cdp: Cdp): Promise<void> {
    for (let attempt = 0; attempt < 2; attempt += 1) {
        await cdp.send("Page.navigate", { url: APP_URL });
        try {
            await waitFor(
                () => cdp.evaluate("document.readyState === 'complete' && !!document.querySelector('button.leaf')"),
                60000,
                "app mount",
            );
            return;
        } catch (error) {
            if (attempt === 1) throw error;
            await sleep(1000);
        }
    }
}

/** Hide the Vite dev-only Vue devtools overlay so captures look production-clean. */
async function hideDevtoolsOverlay(cdp: Cdp): Promise<void> {
    await cdp.evaluate(`(() => {
        const style = document.createElement('style');
        style.textContent = '#vue-inspector-container,#__vue-devtools-container__,.vue-devtools__anchor,.vue-devtools-frame{display:none!important}';
        document.head.appendChild(style);
        return true;
    })()`);
    await sleep(150);
}

/** Expand a category (if needed) and click the leaf with the given name. */
async function selectAlgorithm(cdp: Cdp, name: string, categoryLabel: string): Promise<void> {
    const leafClick = `(() => {
        const b = Array.from(document.querySelectorAll('button.leaf'))
            .find(el => el.textContent.trim() === ${JSON.stringify(name)});
        if (b) { b.click(); return true; } return false;
    })()`;

    if (!(await cdp.evaluate(leafClick))) {
        const headerClick = `(() => {
            const h = Array.from(document.querySelectorAll('button.category-header'))
                .find(el => el.querySelector('.category-name')?.textContent.trim() === ${JSON.stringify(categoryLabel)});
            if (h) { h.click(); return true; } return false;
        })()`;
        if (!(await cdp.evaluate(headerClick))) {
            throw new Error(`Category header not found: ${categoryLabel}`);
        }
        await waitFor(
            () => cdp.evaluate(
                `Array.from(document.querySelectorAll('button.leaf')).some(el => el.textContent.trim() === ${JSON.stringify(name)})`,
            ),
            10000,
            `leaf ${name} after expanding ${categoryLabel}`,
        );
        if (!(await cdp.evaluate(leafClick))) {
            throw new Error(`Algorithm leaf could not be clicked: ${name}`);
        }
    }

    // Wait for the lazy chunk to load and the engine to expose frames.
    try {
        await waitFor(
            async () => {
                const counter: string = await cdp.evaluate(
                    "document.querySelector('.step-counter')?.textContent || ''",
                );
                const match = counter.match(/1\s*\/\s*(\d+)/);
                return !!match && Number(match[1]) > 1;
            },
            30000,
            `frames for ${name}`,
        );
    } catch (error) {
        const counter: string = await cdp.evaluate("document.querySelector('.step-counter')?.textContent || ''");
        const selected: string = await cdp.evaluate("document.querySelector('button.leaf.selected')?.textContent || ''");
        throw new Error(`Failed loading ${name}: counter=${JSON.stringify(counter)} selected=${JSON.stringify(selected)} (${String(error)})`);
    }
    await sleep(150);
}

const KEYS: Record<string, { key: string; code: string; vk: number }> = {
    ArrowRight: { key: "ArrowRight", code: "ArrowRight", vk: 39 },
    ArrowLeft: { key: "ArrowLeft", code: "ArrowLeft", vk: 37 },
    Space: { key: " ", code: "Space", vk: 32 },
    R: { key: "r", code: "KeyR", vk: 82 },
};

async function press(cdp: Cdp, key: keyof typeof KEYS): Promise<void> {
    const def = KEYS[key];
    const base = {
        key: def.key,
        code: def.code,
        windowsVirtualKeyCode: def.vk,
        nativeVirtualKeyCode: def.vk,
    };
    await cdp.send("Input.dispatchKeyEvent", { type: "keyDown", ...base });
    await cdp.send("Input.dispatchKeyEvent", { type: "keyUp", ...base });
}

async function screenshot(cdp: Cdp, file: string): Promise<void> {
    const result = await cdp.send("Page.captureScreenshot", {
        format: "png",
        captureBeyondViewport: false,
        fromSurface: true,
    });
    writeFileSync(file, Buffer.from(result.data, "base64"));
}

async function totalSteps(cdp: Cdp): Promise<number> {
    const counter: string = await cdp.evaluate("document.querySelector('.step-counter')?.textContent || ''");
    const match = counter.match(/\/\s*(\d+)/);
    return match ? Number(match[1]) : 0;
}

/** Step through a loaded algorithm and capture at most `maxFrames` full-app frames. */
async function captureRun(cdp: Cdp, name: string, category: string, maxFrames: number): Promise<Buffer[]> {
    await selectAlgorithm(cdp, name, category);
    await press(cdp, "R");
    await sleep(200);

    const total = await totalSteps(cdp);
    if (total < 2) throw new Error(`No frames produced for ${name}`);
    const stride = Math.max(1, Math.ceil(total / maxFrames));
    const frames: Buffer[] = [];

    for (let index = 0; index < total; index += stride) {
        if (index > 0) {
            for (let step = 0; step < stride; step += 1) {
                await press(cdp, "ArrowRight");
            }
        }
        await sleep(90);
        const result = await cdp.send("Page.captureScreenshot", {
            format: "png",
            captureBeyondViewport: false,
            fromSurface: true,
        });
        frames.push(Buffer.from(result.data, "base64"));
    }
    console.log(`  captured ${frames.length} frames of ${name} (${total} total steps)`);
    return frames;
}

function writeFrames(dir: string, frames: Buffer[]): void {
    frames.forEach((buffer, index) => {
        writeFileSync(path.join(dir, `frame_${String(index).padStart(3, "0")}.png`), buffer);
    });
}

// ---------------------------------------------------------------------------
// Programmatic stills (SVG -> PNG with ImageMagick)
// ---------------------------------------------------------------------------

function esc(text: string): string {
    return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function bars(x: number, base: number, heights: number[], colors: string[], w = 44, gap = 12): string {
    return heights
        .map((height, index) => {
            const color = colors[index] ?? "#34d399";
            return `<rect x="${x + index * (w + gap)}" y="${base - height}" width="${w}" height="${height}" rx="6" fill="${color}"/>`;
        })
        .join("");
}

function node(x: number, y: number, fill = "#3b82f6", r = 14): string {
    return `<circle cx="${x}" cy="${y}" r="${r}" fill="${fill}" stroke="#ffffff" stroke-width="3"/>`;
}

function edge(x1: number, y1: number, x2: number, y2: number, color = "#94a3b8", width = 4, dash = ""): string {
    const dashAttr = dash ? ` stroke-dasharray="${dash}"` : "";
    return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${color}" stroke-width="${width}"${dashAttr} stroke-linecap="round"/>`;
}

function ogSvg(): string {
    const green = "#34d399";
    const grid = Array.from(
        { length: 13 },
        (_, i) => `<line x1="${i * 100}" y1="0" x2="${i * 100 - 220}" y2="630"/>`,
    ).join("");
    const barHeights = [90, 140, 110, 190, 150, 230, 170];
    const barColors = [green, green, "#fbbf24", green, "#ef4444", green, green];
    return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#0f172a"/><stop offset="1" stop-color="#1e40af"/>
    </linearGradient>
  </defs>
  <rect width="1200" height="630" fill="url(#bg)"/>
  <g opacity="0.06" stroke="#ffffff" stroke-width="1">${grid}</g>
  <g transform="translate(64,52)">
    <rect width="56" height="56" rx="12" fill="#1e3a8a" stroke="#60a5fa" stroke-width="2"/>
    <g fill="${green}"><rect x="10" y="30" width="8" height="16" rx="2"/><rect x="24" y="22" width="8" height="24" rx="2"/><rect x="38" y="12" width="8" height="34" rx="2"/></g>
    <polyline points="14,30 28,22 42,12" fill="none" stroke="#ffffff" stroke-width="2.5" stroke-linecap="round"/>
  </g>
  <text x="140" y="99" font-family="Arial" font-weight="bold" font-size="50" fill="#ffffff">Algorithm Visualization Engine</text>
  <text x="64" y="158" font-family="Arial" font-size="26" fill="#cbd5e1">Watch ${MANIFEST.length} algorithms think, one step at a time.</text>
  <g>${bars(70, 548, barHeights, barColors, 60, 18)}</g>
  <g>
    ${edge(680, 500, 800, 430, "#06b6d4", 5)}
    ${edge(800, 430, 920, 470, "#06b6d4", 5)}
    ${edge(920, 470, 1040, 330, "#06b6d4", 5)}
    ${edge(1040, 330, 1140, 275, "#06b6d4", 5)}
    ${node(680, 500, "#8b5cf6", 11)}${node(800, 430, "#ffffff", 11)}${node(920, 470, "#ffffff", 11)}${node(1040, 330, "#ffffff", 11)}${node(1140, 275, "#8b5cf6", 11)}
  </g>
  <text x="64" y="605" font-family="Arial" font-size="19" fill="#93c5fd">${Object.keys(CATEGORY_LABELS).length} categories   Free, offline, open source</text>
</svg>`;
}

type Category = { id: string; label: string; caption: string; motif: string };

const CATEGORIES: Category[] = [
    {
        id: "sorting",
        label: "Sorting",
        caption: "compare adjacent pairs, swap when out of order",
        motif: `${bars(250, 410, [80, 120, 95, 155, 125, 185, 160], ["#34d399", "#34d399", "#fbbf24", "#34d399", "#ef4444", "#34d399", "#34d399"], 46, 14)}
        <text x="480" y="250" font-family="Arial" font-size="14" fill="#92400e">comparing</text>`,
    },
    {
        id: "searching",
        label: "Searching",
        caption: "narrow the search space to find a target",
        motif: `${bars(250, 410, [70, 110, 140, 95, 165, 120, 150], ["#e5e7eb", "#e5e7eb", "#3b82f6", "#e5e7eb", "#e5e7eb", "#e5e7eb", "#e5e7eb"], 46, 14)}
        <circle cx="432" cy="285" r="30" fill="none" stroke="#2563eb" stroke-width="4"/>
        <line x1="454" y1="307" x2="474" y2="327" stroke="#2563eb" stroke-width="6" stroke-linecap="round"/>`,
    },
    {
        id: "graph",
        label: "Graph Traversal",
        caption: "visit every vertex exactly once",
        motif: `${edge(360,230,480,180)}${edge(480,180,610,240)}${edge(360,230,420,360)}${edge(420,360,550,380)}${edge(550,380,610,240)}${edge(480,180,420,360)}
        ${node(360,230)}${node(480,180,"#fbbf24")}${node(610,240)}${node(420,360)}${node(550,380)}`,
    },
    {
        id: "shortest-path",
        label: "Shortest Path",
        caption: "find the cheapest route between two points",
        motif: `${edge(340,370,450,250)}${edge(450,250,570,200)}${edge(570,200,660,310)}${edge(340,370,470,390)}${edge(470,390,660,310)}
        ${edge(340,370,450,250,"#06b6d4",7)}${edge(450,250,570,200,"#06b6d4",7)}${edge(570,200,660,310,"#06b6d4",7)}
        ${node(340,370,"#8b5cf6")}${node(450,250)}${node(570,200)}${node(660,310,"#8b5cf6")}`,
    },
    {
        id: "mst",
        label: "Minimum Spanning Trees",
        caption: "connect all vertices with minimum total weight",
        motif: `${edge(340,240,470,190,"#94a3b8",4,"8 8")}${edge(470,190,620,260,"#94a3b8",4,"8 8")}${edge(340,240,430,370,"#10b981",6)}${edge(430,370,620,360,"#10b981",6)}${edge(470,190,430,370,"#10b981",6)}
        ${node(340,240)}${node(470,190)}${node(620,260)}${node(430,370)}${node(620,360)}`,
    },
    {
        id: "flow",
        label: "Network Flow",
        caption: "push as much flow as the network allows",
        motif: `${edge(330,300,450,220,"#3b82f6",5)}${edge(330,300,450,380,"#3b82f6",5)}${edge(450,220,600,300,"#3b82f6",5)}${edge(450,380,600,300,"#3b82f6",5)}
        ${node(330,300,"#10b981")}${node(450,220)}${node(450,380)}${node(600,300,"#ef4444")}
        <text x="380" y="248" font-family="Arial" font-size="13" fill="#6b7280">4</text>
        <text x="380" y="360" font-family="Arial" font-size="13" fill="#6b7280">2</text>`,
    },
    {
        id: "tree",
        label: "Tree Algorithms",
        caption: "traverse or rebalance a hierarchical structure",
        motif: `${edge(480,180,370,280)}${edge(480,180,590,280)}${edge(370,280,310,380)}${edge(370,280,430,380)}${edge(590,280,530,380)}${edge(590,280,650,380)}
        ${node(480,180,"#fbbf24")}${node(370,280)}${node(590,280)}${node(310,380)}${node(430,380)}${node(530,380)}${node(650,380)}`,
    },
    {
        id: "string",
        label: "String Algorithms",
        caption: "search and compare text efficiently",
        motif: `<g font-family="Courier New" font-size="40" font-weight="bold">
        <rect x="270" y="250" width="76" height="76" rx="8" fill="#f3f4f6" stroke="#d1d5db"/><text x="308" y="304" text-anchor="middle" fill="#111827">A</text>
        <rect x="358" y="250" width="76" height="76" rx="8" fill="#fce7f3" stroke="#db2777"/><text x="396" y="304" text-anchor="middle" fill="#9d174d">C</text>
        <rect x="446" y="250" width="76" height="76" rx="8" fill="#fce7f3" stroke="#db2777"/><text x="484" y="304" text-anchor="middle" fill="#9d174d">G</text>
        <rect x="534" y="250" width="76" height="76" rx="8" fill="#f3f4f6" stroke="#d1d5db"/><text x="572" y="304" text-anchor="middle" fill="#111827">T</text>
        <rect x="622" y="250" width="76" height="76" rx="8" fill="#f3f4f6" stroke="#d1d5db"/><text x="660" y="304" text-anchor="middle" fill="#111827">A</text>
        </g>`,
    },
    {
        id: "math",
        label: "Number Theory",
        caption: "reason about integers, primes, and residues",
        motif: `<g font-family="Arial" font-size="20" fill="#6b7280">
        ${[0, 1, 2, 3].map((r) => [0, 1, 2, 3].map((c) => `<rect x="${330 + c * 76}" y="${200 + r * 60}" width="64" height="48" rx="6" fill="${r === 1 && c === 2 ? "#ede9fe" : "#f9fafb"}" stroke="#e5e7eb"/><text x="${362 + c * 76}" y="${231 + r * 60}" text-anchor="middle" fill="${r === 1 && c === 2 ? "#6d28d9" : "#6b7280"}">${(r * 4 + c) * 7 + 3}</text>`).join("")).join("")}
        </g>`,
    },
    {
        id: "dynamic-programming",
        label: "Dynamic Programming",
        caption: "build the answer from smaller subproblems",
        motif: `<g font-family="Arial" font-size="16">
        ${[0, 1, 2].map((r) => [0, 1, 2, 3, 4].map((c) => `<rect x="${260 + c * 88}" y="${210 + r * 66}" width="76" height="54" rx="6" fill="${r === 2 && c === 4 ? "#3b82f6" : r === 0 ? "#dbeafe" : "#f9fafb"}" stroke="#e5e7eb"/><text x="${298 + c * 88}" y="${243 + r * 66}" text-anchor="middle" fill="${r === 2 && c === 4 ? "#ffffff" : "#374151"}">${r * 5 + c + 1}</text>`).join("")).join("")}
        </g>`,
    },
    {
        id: "game",
        label: "Game Theory",
        caption: "choose the best move by looking ahead",
        motif: `${edge(480,180,360,290)}${edge(480,180,600,290)}${edge(360,290,300,390)}${edge(360,290,420,390)}${edge(600,290,540,390)}${edge(600,290,660,390)}
        ${node(480,180,"#fbbf24")}${node(360,290)}${node(600,290)}${node(300,390,"#10b981")}${node(420,390)}${node(540,390)}${node(660,390,"#10b981")}
        <g font-family="Arial" font-size="14" fill="#059669"><text x="300" y="428" text-anchor="middle">+3</text><text x="660" y="428" text-anchor="middle">+2</text></g>`,
    },
    {
        id: "geometry",
        label: "Computational Geometry",
        caption: "compute with points, lines, and polygons",
        motif: `<polygon points="350,360 420,230 560,205 650,300 590,390" fill="rgba(6,182,212,0.12)" stroke="#06b6d4" stroke-width="4"/>
        ${node(350,360,"#111827",9)}${node(420,230,"#111827",9)}${node(560,205,"#111827",9)}${node(650,300,"#111827",9)}${node(590,390,"#111827",9)}
        ${node(480,320,"#f59e0b",9)}`,
    },
    {
        id: "data-structures",
        label: "Data Structures",
        caption: "organize data for efficient access",
        motif: `<g font-family="Arial" font-size="18" fill="#ffffff">
        <rect x="320" y="340" width="160" height="52" rx="6" fill="#3b82f6"/><text x="400" y="373" text-anchor="middle">top</text>
        <rect x="320" y="284" width="160" height="52" rx="6" fill="#dbeafe" stroke="#93c5fd"/><text x="400" y="317" text-anchor="middle" fill="#1e40af">3</text>
        <rect x="320" y="228" width="160" height="52" rx="6" fill="#dbeafe" stroke="#93c5fd"/><text x="400" y="261" text-anchor="middle" fill="#1e40af">7</text>
        <rect x="320" y="172" width="160" height="52" rx="6" fill="#dbeafe" stroke="#93c5fd"/><text x="400" y="205" text-anchor="middle" fill="#1e40af">9</text>
        </g>
        <path d="M520 200 L560 200 L560 360" fill="none" stroke="#6b7280" stroke-width="3" stroke-dasharray="6 6"/>
        <g font-family="Arial" font-size="14" fill="#6b7280"><text x="570" y="285">push / pop</text></g>`,
    },
    {
        id: "ml-ai",
        label: "Machine Learning & AI",
        caption: "learn patterns and make predictions from data",
        motif: `<g font-family="Arial" font-size="15" fill="#6b7280">
        ${node(300,320,"#8b5cf6")}${node(480,200,"#3b82f6")}${node(480,320,"#3b82f6")}${node(480,440,"#3b82f6")}${node(680,320,"#10b981")}
        ${edge(300,320,480,200,"#94a3b8",3)}${edge(300,320,480,320,"#94a3b8",3)}${edge(300,320,480,440,"#94a3b8",3)}
        ${edge(480,200,680,320,"#10b981",4)}${edge(480,320,680,320,"#10b981",4)}${edge(480,440,680,320,"#10b981",4)}
        </g>`,
    },
    {
        id: "cryptography-security",
        label: "Cryptography & Security",
        caption: "hide, authenticate, and verify information",
        motif: `<g font-family="Courier New" font-size="28" font-weight="bold">
        <text x="250" y="290" fill="#6b7280">C A E S A R</text><text x="250" y="350" fill="#2563eb">F D H V D U</text>
        <rect x="240" y="400" width="480" height="4" fill="#e5e7eb"/>
        </g>`,
    },
    {
        id: "parallel-distributed",
        label: "Parallel & Distributed Systems",
        caption: "coordinate work across many machines",
        motif: `${edge(480,200,330,330)}${edge(480,200,630,330)}${edge(330,330,480,440)}${edge(630,330,480,440)}
        ${node(480,200,"#fbbf24")}${node(330,330)}${node(630,330)}${node(480,440,"#10b981")}`,
    },
    {
        id: "numerical-optimization",
        label: "Numerical Methods & Optimization",
        caption: "approximate roots, solutions, and optima",
        motif: `<path d="M240 380 Q 330 140 430 300 T 720 200" fill="none" stroke="#3b82f6" stroke-width="4"/>
        <line x1="240" y1="400" x2="720" y2="400" stroke="#e5e7eb" stroke-width="2"/>
        ${node(360,300,"#ef4444",9)}${node(480,280,"#f59e0b",9)}${node(560,250,"#10b981",9)}`,
    },
    {
        id: "quantum",
        label: "Quantum Algorithms",
        caption: "compute with superposition and entanglement",
        motif: `<circle cx="400" cy="320" r="96" fill="none" stroke="#8b5cf6" stroke-width="4"/>
        <circle cx="600" cy="320" r="96" fill="none" stroke="#06b6d4" stroke-width="4"/>
        ${edge(400,320,600,320,"#f59e0b",5)}${node(400,320,"#8b5cf6")}${node(600,320,"#06b6d4")}`,
    },
    {
        id: "statistics-probability",
        label: "Statistics & Probability",
        caption: "reason about uncertainty and variation",
        motif: `${bars(250,410,[40,70,110,160,190,150,100,60,35],["#bfdbfe","#bfdbfe","#93c5fd","#3b82f6","#1d4ed8","#3b82f6","#93c5fd","#bfdbfe","#bfdbfe"],46,12)}`,
    },
    {
        id: "production-systems",
        label: "Production Systems",
        caption: "algorithms behind reliable software at scale",
        motif: `${bars(250,410,[120,120,120,120,120,120,120],["#e5e7eb","#e5e7eb","#e5e7eb","#10b981","#10b981","#10b981","#10b981"],56,14)}
        <text x="480" y="250" font-family="Arial" font-size="14" fill="#065f46">tokens available</text>`,
    },
];

function categorySvg(category: Category): string {
    return `<svg xmlns="http://www.w3.org/2000/svg" width="960" height="540" viewBox="0 0 960 540">
  <rect width="960" height="540" fill="#ffffff"/>
  <rect x="0" y="0" width="960" height="104" fill="#0f172a"/>
  <text x="36" y="40" font-family="Arial" font-size="15" fill="#94a3b8" letter-spacing="2">ALGORITHM VISUALIZATION ENGINE</text>
  <text x="36" y="80" font-family="Arial" font-weight="bold" font-size="34" fill="#ffffff">${esc(category.label)}</text>
  <rect x="36" y="132" width="56" height="4" fill="#3b82f6"/>
  ${category.motif}
  <text x="480" y="470" font-family="Arial" font-size="16" fill="#6b7280" text-anchor="middle">${esc(category.caption)}</text>
  <line x1="36" y1="500" x2="924" y2="500" stroke="#e5e7eb"/>
  <text x="36" y="526" font-family="Arial" font-size="15" fill="#9ca3af">algorithm-visualizing</text>
  <text x="924" y="526" font-family="Arial" font-size="15" fill="#9ca3af" text-anchor="end">interactive algorithms textbook</text>
</svg>`;
}

function renderPng(svg: string, output: string): void {
    const svgFile = path.join(TEMP, `${path.basename(output, ".png")}.svg`);
    writeFileSync(svgFile, svg, "utf8");
    run("magick", [svgFile, output]);
}

function generateStills(): void {
    console.log("Rendering programmatic stills with ImageMagick...");
    renderPng(ogSvg(), path.join(MEDIA, "og-image.png"));
    for (const category of CATEGORIES) {
        renderPng(categorySvg(category), path.join(CAT_DIR, `${category.id}.png`));
    }
    console.log(`  wrote og-image.png and ${CATEGORIES.length} category stills`);
}

// ---------------------------------------------------------------------------
// Video assembly
// ---------------------------------------------------------------------------

function buildVideos(): void {
    console.log("Encoding hero.gif from live-app frames...");
    run("ffmpeg", [
        "-y", "-loglevel", "error",
        "-framerate", "6",
        "-i", path.join(HERO_DIR, "frame_%03d.png"),
        "-vf", "scale=1000:-2:flags=lanczos,split[a][b];[a]palettegen=stats_mode=diff[p];[b][p]paletteuse=dither=bayer",
        "-loop", "0", "-an",
        path.join(MEDIA, "hero.gif"),
    ]);

    console.log("Encoding trailer.mp4 from live-app frames...");
    run("ffmpeg", [
        "-y", "-loglevel", "error",
        "-framerate", "5",
        "-i", path.join(TRAILER_DIR, "frame_%03d.png"),
        "-c:v", "libx264", "-preset", "medium", "-crf", "27",
        "-pix_fmt", "yuv420p", "-movflags", "+faststart", "-an",
        path.join(MEDIA, "trailer.mp4"),
    ]);
}

// ---------------------------------------------------------------------------
// Verification
// ---------------------------------------------------------------------------

function fileSize(file: string): string {
    const bytes = statSync(file).size;
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function sizeBudget(kind: string): number {
    return kind === "gif" ? 8 * 1024 * 1024 : 10 * 1024 * 1024;
}

function verify(): void {
    console.log("\nVerification:");
    const images: Array<[string, string]> = [
        [path.join(MEDIA, "og-image.png"), "1200x630"],
        [path.join(MEDIA, "screenshot-desktop.png"), "1440x900"],
        [path.join(MEDIA, "screenshot-mobile.png"), "390x844"],
        ...CATEGORIES.map((category) => [path.join(CAT_DIR, `${category.id}.png`), "960x540"] as [string, string]),
    ];
    for (const [image, expectedSize] of images) {
        if (!existsSync(image)) throw new Error(`Missing output: ${image}`);
        if (statSync(image).size < 5000) throw new Error(`Output too small: ${image}`);
        const info = run("magick", ["identify", "-format", "%wx%h %b", image]).trim();
        if (!info.startsWith(expectedSize)) {
            throw new Error(`Wrong dimensions for ${image}: expected ${expectedSize}, got ${info}`);
        }
        console.log(`  ${path.relative(ROOT, image)}: ${info}`);
    }

    const videos: Array<[string, string, number, number]> = [
        [path.join(MEDIA, "hero.gif"), "gif", 4, 8],
        [path.join(MEDIA, "trailer.mp4"), "mp4", 10, 20],
    ];
    for (const [file, kind, minDuration, maxDuration] of videos) {
        if (!existsSync(file)) throw new Error(`Missing output: ${file}`);
        const probe = JSON.parse(
            run("ffprobe", [
                "-v", "error",
                "-show_entries", "format=duration,size:stream=codec_name,width,height,nb_frames",
                "-of", "json", file,
            ]),
        );
        const stream = probe.streams?.[0] ?? {};
        const duration = Number(probe.format?.duration ?? 0);
        if (duration < minDuration || duration > maxDuration) {
            throw new Error(`${file} duration ${duration}s outside ${minDuration}-${maxDuration}s`);
        }
        if (sizeBudget(kind) < statSync(file).size) {
            throw new Error(`${file} exceeds expected size budget`);
        }
        console.log(
            `  ${path.relative(ROOT, file)}: ${kind} ${stream.codec_name} ${stream.width}x${stream.height}, ` +
                `${duration}s, ${fileSize(file)}`,
        );
    }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
    let cdp: Cdp | null = null;
    try {
        await startDevServer();
        console.log("Dev server ready.");
        cdp = await startChrome();
        console.log("Chrome + CDP ready.");
        await forceLightTheme(cdp);

        await setViewport(cdp, 1440, 900);
        await loadApp(cdp);
        await assertLightTheme(cdp);
        await hideDevtoolsOverlay(cdp);
        await selectAlgorithm(cdp, "Bubble Sort", "Sorting");
        await sleep(300);

        console.log("Capturing real screenshots...");
        await screenshot(cdp, path.join(MEDIA, "screenshot-desktop.png"));

        console.log("Capturing live algorithm frames...");
        const bubbleFrames = await captureRun(cdp, "Bubble Sort", "Sorting", 30);
        const astarFrames = await captureRun(cdp, "A*", "Shortest Path", 20);
        const geoFrames = await captureRun(cdp, "Convex Hull (Graham)", "Computational Geometry", 20);

        writeFrames(HERO_DIR, bubbleFrames);
        const trailerFrames = [...bubbleFrames, ...astarFrames, ...geoFrames];
        writeFrames(TRAILER_DIR, trailerFrames);

        console.log("Capturing real mobile screenshot...");
        await setViewport(cdp, 390, 844, true);
        await loadApp(cdp);
        await assertLightTheme(cdp);
        await hideDevtoolsOverlay(cdp);
        await selectAlgorithm(cdp, "Bubble Sort", "Sorting");
        await sleep(300);
        await screenshot(cdp, path.join(MEDIA, "screenshot-mobile.png"));

        cdp.close();
        cdp = null;

        generateStills();
        buildVideos();
        verify();
        console.log("\nDone. All media written to public/media/.");
    } finally {
        if (cdp) cdp.close();
        cleanup();
    }
}

main().catch((error) => {
    console.error(error);
    cleanup();
    process.exit(1);
});
