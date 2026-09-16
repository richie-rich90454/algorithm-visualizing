# Algorithm Visualization Engine

An interactive, offline-capable web application for computer science education. It visualizes classic and modern algorithms with high-DPI canvas graphics. Each algorithm module is a self-contained teaching resource with comments, complexity annotations, and a step-by-step narrative.

[Live Demo](https://richie-rich90454.github.io/algorithm-visualizing/)

## Features

- Broad algorithm library organized by category, from sorting and searching to graph theory, strings, number theory, dynamic programming, geometry, and data structures.
- Replayable frame engine: each algorithm is a generator that yields one `VisualFrame` per step. Playback, stepping, and rewinding are instant and deterministic.
- High-DPI canvas rendering with a single `requestAnimationFrame` loop and dirty-flag redraws.
- Layout engines matched to each algorithm's natural shape: array, grid, matrix, tree, graph, text, and point.
- Pixel-perfect flat design with a strict color palette, self-hosted Noto Sans font, and no CDN dependencies. Works completely offline.
- Interaction: hover tooltips with metadata, click-to-select, and keyboard shortcuts.

## Tech Stack

- Vue 3 (Composition API, `<script setup lang="ts">`)
- TypeScript (strict mode)
- Vite with `@` path alias to `src/`
- Pinia (setup store) for visualizer state
- HTML5 Canvas 2D for rendering
- Bun as the package manager
- oxfmt for formatting
- Vitest for unit tests

## Getting Started

```sh
bun install
bun dev          # start the dev server
bun run build    # type-check + production build
bun test         # run all tests
bun run format   # format with oxfmt
```

## Keyboard Shortcuts

| Key | Action |
| --- | --- |
| `Space` | Toggle play/pause |
| `ArrowLeft` | Step backward |
| `ArrowRight` | Step forward |
| `R` | Reset to first step |

## How It Works

Each algorithm lives in `src/core/algo/<category>/<name>.ts` and exports a default `AlgorithmModule`:

```ts
{
  id: "<algorithm-id>",
  name: "<Algorithm Name>",
  category: "<category>",
  complexity: { time: "<time>", space: "<space>" },
  defaultInput: [...],
  visualType: "<layout>",
  run: function* (input) { /* yields VisualFrame objects */ },
}
```

The `StepEngine` drains each generator into a frame buffer, so playback is just pointer movement. Layout engines position entities, and the renderers paint edges, entities, labels, and overlays.

Every algorithm has a companion test file that verifies it yields well-formed frames and terminates cleanly. The algorithm gallery is generated from the module registry, so adding or removing algorithm modules updates the application automatically.

## Adding an Algorithm

Create a module under `src/core/algo/<category>/` that exports an `AlgorithmModule`. The gallery is derived from the registry, so no hardcoded lists or counts need to be updated. Add a companion test file and run `bun test`.

## Algorithm Categories

| Category | Focus |
| --- | --- |
| Sorting | Comparison and non-comparison sorting, hybrid sorts, external sorts, and related ordering algorithms. |
| Searching | Array, graph, constraint, and best-first search strategies, including selection and peak-finding. |
| Graph Traversal | Traversal, connectivity, topological ordering, components, centrality, community detection, and graph structure analysis. |
| Shortest Paths | Point-to-point, all-pairs, heuristic, multi-criteria, and dynamic shortest-path algorithms. |
| Minimum Spanning Trees | Spanning-tree construction, verification, sensitivity, and constrained variants. |
| Network Flow | Maximum flow, minimum cut, matching, assignment, circulation, and flow-based optimization. |
| Tree Algorithms | Tree traversal, decomposition, dynamic programming, hashing, and tree-based string and encoding problems. |
| String Algorithms | Exact and approximate matching, indexing, compression, alignment, parsing, and tokenization. |
| Number Theory | Primes, factorization, modular arithmetic, transforms, linear algebra over finite fields, and cryptographic primitives. |
| Dynamic Programming | Optimization and counting over sequences, grids, subsets, intervals, and game states. |
| Game Theory | Combinatorial games, minimax search, Monte Carlo tree search, and retrograde analysis. |
| Computational Geometry | Convexity, intersections, triangulation, clustering, rasterization, and geometric optimization. |
| Data Structures | Trees, heaps, hash tables, filters, sketches, caches, tries, segment trees, union-find, and more. |

## Font Attribution

Noto Sans is used under the SIL Open Font License 1.1. The font is bundled locally in `public/fonts/` for offline use. See https://fonts.google.com/noto/specimen/Noto+Sans for details.

## License

[MIT](LICENSE)
