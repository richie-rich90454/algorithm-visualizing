# Algorithmic Visualization Engine

An interactive, offline-capable web application for computer science education. It visualizes **over 230 classic and modern algorithms** with pixel-perfect, high-DPI canvas graphics, and serves as a standalone code reference -- every algorithm module is a self-contained teaching resource with extensive comments, complexity annotations, and a step-by-step narrative.

## Features

- **230+ algorithms** across 13 categories: sorting, searching, graph traversal, shortest paths, minimum spanning trees, network flow, tree algorithms, string algorithms, number theory, dynamic programming, game theory, computational geometry, and data structures.
- **Replayable frame engine**: every algorithm is a generator that yields one `VisualFrame` per step. Playback, stepping, and rewinding are instant and fully deterministic.
- **High-DPI canvas rendering** with a single `requestAnimationFrame` loop and dirty-flag redraws.
- **Five layout engines** (array, grid, tree, graph, text) matched to each algorithm's natural shape.
- **Pixel-perfect flat design** with a strict color palette, self-hosted Noto Sans font, and no CDN dependencies -- works completely offline.
- **Interaction**: hover tooltips with full metadata, click-to-select, and keyboard shortcuts.

## Tech Stack

- **Vue 3** (Composition API, `<script setup lang="ts">`)
- **TypeScript** (strict mode)
- **Vite** with `@` path alias to `src/`
- **Pinia** (setup store) for all visualizer state
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

## Algorithm Categories

| Category | Count | Description |
| -------- | ----- | ----------- |
| Sorting | 20+ | Bubble, quick, merge, heap, radix, counting, bucket, shell, tim, intro, smooth, comb, cocktail, patience, monkey, and more |
| Searching | 10+ | Linear, binary, jump, interpolation, exponential, ternary, and bounds |
| Graph Traversal | 10+ | BFS, DFS (recursive/iterative), bidirectional BFS, topological sort, flood fill, lexicographic BFS |
| Shortest Paths | 10+ | Dijkstra (heap/fibonacci/matrix), Bellman-Ford, SPFA, Floyd-Warshall, Johnson, A*, DAG, Karp minimum mean cycle |
| Minimum Spanning Trees | 5 | Kruskal, Prim (heap/matrix), Boruvka, second-best MST |
| Network Flow | 12 | Ford-Fulkerson, Edmonds-Karp, Dinic, Push-Relabel, Boykov-Kolmogorov, Min-Cut, Min-Cost Max-Flow, Cost Scaling, Hopcroft-Karp, Hungarian, Blossom |
| Tree Algorithms | 12 | Diameter, center, Euler tour, LCA (binary lifting, Euler+sparse, Tarjan offline), HLD, centroid decomposition, rerooting DP, isomorphism |
| String Algorithms | 20+ | KMP, Z-algorithm, Boyer-Moore, Aho-Corasick, Rabin-Karp, suffix array (doubling/DC3), LCP (Kasai), suffix automaton, suffix tree (Ukkonen), Manacher, Eertree, Duval, Booth, rolling hash 2D, prefix function automaton |
| Number Theory | 20+ | GCD, extended Euclid, binary exponentiation, modular inverse, sieve, Euler totient, Fermat, Miller-Rabin, Pollard Rho, CRT, Lucas, Mobius, NTT, FFT, Tonelli-Shanks, discrete root, matrix exponentiation, Bareiss, Gaussian elimination, linear sieve |
| Dynamic Programming | 15+ | Knapsack, LIS, edit distance, matrix chain, subset sum, bitmask TSP, DAG longest/shortest, tree DP (independent set, rerooting), monotonic queue DP, divide and conquer DP, counting DP, probability DP, shortest common supersequence |
| Game Theory | 6 | Nim, misere Nim, minimax, alpha-beta pruning, Sprague-Grundy, Wythoff |
| Computational Geometry | 14 | Dot/cross product, convex hull (Graham/Jarvis/monotone), point-in-polygon (ray/winding), segment intersection, sweep line, closest pair, polygon area, rotating calipers, half-plane intersection, minimum enclosing circle |
| Data Structures | 50+ | BST, AVL, red-black, treap, B-tree, B+ tree, binary heap, binomial heap, Fibonacci heap, pairing heap, leftist heap, d-ary heap, priority queue, segment tree (recursive/iterative/lazy/dynamic/persistent), Fenwick tree, DSU, persistent DSU, trie, ternary search trie, linked list (singly/doubly/circular/xor/unrolled), stack, queue (array/linked/concurrent/cyclic), deque, monotonic stack/queue, hash map (chaining/open), hash set, linked hash map, adjacency matrix/list, incidence matrix, edge list, CSR, min-stack, dynamic array, binary tree, and more |

## Font Attribution

Noto Sans is used under the SIL Open Font License 1.1. The font is bundled locally in `public/fonts/` (offline-first -- no CDN). See https://fonts.google.com/noto/specimen/Noto+Sans for details.

## License

MIT