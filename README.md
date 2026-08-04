# Algorithmic Visualization Engine

An interactive, offline-capable web application for computer science education. It visualises **over 230 classic and modern algorithms** with pixel-perfect, high-DPI canvas graphics, and doubles as a standalone code reference – every algorithm module is a self-contained teaching resource with extensive comments, complexity annotations, and a step-by-step narrative.

## Features

- **230+ algorithms** across 13 categories: sorting, searching, graph traversal, shortest paths, minimum spanning trees, network flow, tree algorithms, string algorithms, number theory, dynamic programming, game theory, computational geometry, and data structures.
- **Replayable frame engine**: every algorithm is a generator that yields one `VisualFrame` per step. Playback, stepping, and rewinding are instant and fully deterministic.
- **High-DPI canvas rendering** with a single `requestAnimationFrame` loop and dirty-flag redraws.
- **Five layout engines** (array, grid, tree, graph, text) matched to each algorithm's natural shape.
- **Pixel-perfect flat design** with a strict colour palette, self-hosted Noto Sans font, and no CDN dependencies – works completely offline.
- **Interaction**: hover tooltips with full metadata, click-to-select, and keyboard shortcuts.

## Tech Stack

- **Vue 3** (Composition API, `<script setup lang="ts">`)
- **TypeScript** (strict mode)
- **Vite** with `@` path alias to `src/`
- **Pinia** (setup store) for all visualiser state
- **HTML5 Canvas 2D** for rendering
- **Bun** as the package manager
- **oxfmt** for formatting
- **Vitest** for unit tests

## Getting Started

```sh
bun install
bun dev          # start the dev server
bun run build    # type-check + production build
bun test         # run all tests
bun run format   # format with oxfmt
```

## Keyboard Shortcuts

| Key          | Action              |
| ------------ | ------------------- |
| `Space`      | Toggle play/pause   |
| `ArrowLeft`  | Step backward       |
| `ArrowRight` | Step forward        |
| `R`          | Reset to first step |

## How It Works

Each algorithm lives in `src/core/algo/<category>/<name>.ts` and exports a default `AlgorithmModule`:

```ts
{
  id: "bubble-sort",
  name: "Bubble Sort",
  category: "sorting",
  complexity: { time: "O(n²)", space: "O(1)" },
  defaultInput: [4, 2, 7, 1, 9, 3],
  visualType: "array",
  run: function* (input) { /* yields VisualFrame objects */ },
}
```

The `StepEngine` drains each generator eagerly into a frame buffer, then playback is just pointer movement. Layout engines position entities, and the four renderers (edges, entities, labels, overlay) paint the frame.

Every algorithm has a companion `*.test.ts` verifying it yields at least one frame; `bun test` runs them all.

## Font Attribution

Noto Sans is used under the SIL Open Font License 1.1. The font is bundled locally in `public/fonts/` (offline-first – no CDN). See https://fonts.google.com/noto/specimen/Noto+Sans for details.

## License

MIT
