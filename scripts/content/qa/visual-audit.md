# Visual / UX / Interaction Audit

- Date: 2026-11-18
- Branch: `expansion/best-in-category`
- Method: headless Chrome 157 via CDP (Node global `WebSocket`, no new dependencies), dev server at `http://localhost:5178/algorithm-visualizing/`.
- Coverage: 64 automated checks, 20 algorithms, 97 sampled frames. The algorithm set included bubble-sort, a-star, kruskal, knuth-morris-pratt (string), tree-traversals (tree), convex-hull-graham (geometry), and one algorithm from each of the seven new categories (ml-ai, cryptography-security, parallel-distributed, numerical-optimization, quantum, statistics-probability, production-systems), plus searching, flow, math, DP, game, and data-structures.
- Result: 64 PASS, 2 FAIL, 1 WARN. No source files were modified.

## Confirmed issues

### 1. High - Search results in collapsed categories are not clickable

**Reproduce**
1. Open the app at its base URL (no algorithm selected).
2. Type `grover` in the sidebar search box and wait for the 300 ms debounce.
3. Observe one category header, `Quantum Algorithms 1`, and zero algorithm buttons.

The filtered leaf is rendered only inside `<ul v-if="openCategories.has(category)">`, and the only category expanded by default is `sorting`. A result in any other category therefore requires the user to discover and manually expand the category header before it can be selected. This affects search for almost every algorithm in the library.

**Affected files**
- `src/components/CategoryTree.vue` (`groups` computed, `openCategories` default, leaf-list `v-if` at line 84)

**Suggested direction (not applied)**
Auto-expand every category that has matches while a query is active, or flatten search results into a single list.

### 2. Medium - Space does not activate focused buttons

**Reproduce**
1. Press Tab until the `Input` button in the header has focus.
2. Press Space.

Playback starts instead: the global `keydown` handler matches `Space`, calls `preventDefault()`, and toggles play. The focused button is never clicked, so keyboard users must use Enter for all header toggles (Enter was verified to work). The handler excludes `INPUT`, `TEXTAREA`, `SELECT`, and `contentEditable`, but not `BUTTON`.

**Affected file**
- `src/components/App.vue` (`onKeydown`, lines 94-127)

### 3. Medium - Light-theme selected sidebar leaf fails WCAG AA contrast

**Reproduce**
1. Switch to the light theme.
2. Select any algorithm so a sidebar leaf has the `selected` class.
3. Measure `.leaf.selected`: foreground `rgb(255,255,255)` on background `rgb(59,130,246)` gives **3.68:1**, below the 4.5:1 AA threshold for normal text.

The dark theme equivalent is 7.02:1 and passes. All other sampled text/surface pairs passed in both themes (title 17.74/13.34, description 16.98/16.12, buttons 17.74/13.34).

**Affected files**
- `src/styles/global.css` (`--state-active-bg`, `--state-active-text`)
- `src/components/CategoryTree.vue` (`.leaf.selected`)

### 4. Medium - Array bar labels overlap and clip at narrow widths

**Reproduce**
1. Set viewport to 390x844.
2. Open `?algo=grover-search&step=0`.

The 8 bars fill the 390 px canvas (45 px wide, centers 49 px apart), but their labels are 60-68 px wide. The short-bar overflow labels form a row above the baseline that overlaps adjacent labels by roughly 11-19 px each, and the first and last labels clip at the canvas edges. The result is an unreadable line of overlapping fragments. The same mechanism affects any array layout where bar width is at or below label width.

`EntityRenderer.drawBar` centers the full label on the bar with no clipping or fit check; `renderLabels` does the same for short bars; `ArrayLayout` reserves no horizontal padding for labels.

**Affected files**
- `src/visualization/renderers/EntityRenderer.ts` (`drawBar`, line 127)
- `src/visualization/renderers/LabelRenderer.ts` (line 40)
- `src/visualization/layout/ArrayLayout.ts` (bar width / `startX`)

**Evidence**: `screenshots/mobile-390x844.jpg` (51 KB, dark theme, Grover's Search).

### 5. Low - Empty state step counter reads "1 / 0"

**Reproduce**: open the app with no algorithm selected; the control bar shows `1 / 0`.

This is a cosmetic pre-existing limitation already noted in `HANDOFF.md`; reported here for completeness.

**Affected files**: `src/components/StepCounter.vue`, `src/stores/visualizer.ts`

## Areas checked with no confirmed issues

- **Algorithm rendering sweep**: none of the 20 sampled algorithms (97 frames) produced a blank canvas, NaN/Infinity or out-of-bounds entity positions, collapsed layouts, missing entity endpoints, or missing descriptions. This includes graph (a-star, kruskal, bfs, dinic), tree (tree-traversals, minimax, dsu), text (knuth-morris-pratt), grid (sieve-eratosthenes, knapsack-01, aes-gcm-encryption, atomic-broadcast, bayes-theorem, token-bucket-rate-limiter), point (convex-hull-graham, adaboost), and array (bubble-sort, linear-search, adams-bashforth, grover-search) layouts.
- **Deep links**: all 20 `?algo=<id>&step=3` links restored the correct algorithm and step; an unknown algorithm id degraded gracefully without errors.
- **Console and network**: zero console errors or warnings and zero failed requests across the full run (the Canvas2D `willReadFrequently` advisory seen initially was caused by the audit's own pixel sampling and was excluded).
- **Sidebar/categories**: category expansion toggles `aria-expanded` and reveals leaves correctly. Search debounce and clearing work (apart from issue 1).
- **Playback**: play/pause, reset, speed slider, and the ArrowLeft/ArrowRight/R shortcuts all work; shortcuts are correctly ignored inside text inputs.
- **Input form**: friendly fields, Random/Default, Run with restart, and JSON advanced-mode validation (`role="alert"`) all work.
- **Compare mode**: two labelled canvases, both counters, synchronized stepping, and clean teardown all work.
- **Share/export/learning**: deep-link and embed generation, copy feedback, four export languages with disclaimer, bookmarks, progress, related items, and quiz feedback all work.
- **Theme**: toggle flips CSS tokens, `data-theme`, and the theme-color meta; the canvas repaints.
- **Mobile 390x844**: hamburger drawer opens/closes, selection auto-closes it, no horizontal page overflow, controls remain reachable, and info panels stack below (apart from issue 4).
- **Accessibility**: every icon-only button has an `aria-label`; the canvas exposes `role="img"` with a descriptive label; descriptions use a polite live region; the text-alternative panel lists caption, entities, and connections; keyboard focus shows a visible ring; `prefers-reduced-motion` is honored by CSS. Playback animation is user-initiated and is intentionally not suppressed by reduced motion.
- **PWA**: `sw.js` registers with scope `/algorithm-visualizing/`, reaches `activated`, and its cache held 182 entries.

## Reproducing the audit

With the dev server running on port 5178:

```
node scripts/content/qa/audit.mjs
```

The script starts its own headless Chrome on CDP port 9223 if needed and writes `audit-results.json` plus screenshots under this directory. Harness files are `scripts/content/qa/cdp.mjs` and `scripts/content/qa/audit.mjs`.
