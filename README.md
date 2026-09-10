# Algorithmic Visualization Engine

An interactive, offline-capable web application for computer science education. It visualizes **771 classic and modern algorithms** with pixel-perfect, high-DPI canvas graphics, and serves as a standalone code reference -- every algorithm module is a self-contained teaching resource with extensive comments, complexity annotations, and a step-by-step narrative.

## Features

- **771 algorithms** across 13 categories: sorting, searching, graph traversal, shortest paths, minimum spanning trees, network flow, tree algorithms, string algorithms, number theory, dynamic programming, game theory, computational geometry, and data structures.
- **Replayable frame engine**: every algorithm is a generator that yields one `VisualFrame` per step. Playback, stepping, and rewinding are instant and fully deterministic.
- **High-DPI canvas rendering** with a single `requestAnimationFrame` loop and dirty-flag redraws.
- **Seven layout engines** (array, grid, matrix, tree, graph, text, point) matched to each algorithm's natural shape.
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

Every algorithm has a companion `*.test.ts` verifying it yields well-formed frames and terminates cleanly; `bun test` runs all 774 test files (1554 tests).

## Algorithm Categories

| Category | Count | Description |
| --- | --- | --- |
| Sorting | 64 | Bubble, quick (Lomuto/Hoare/3-way), merge (top-down/bottom-up), heap, weak-heap, radix (LSD/MSD), counting, bucket, shell, tim, intro, smooth, comb, cocktail, patience, cycle, pancake, strand, tournament, tree, splay, library, block, merge-insertion (Ford-Johnson), stooge, bead, burstsort, American flag, samplesort, external k-way/polyphase/cascade merges, and more |
| Searching | 39 | Linear, binary (iterative/recursive/bounds), jump, interpolation, exponential, ternary, Fibonacci, rotated/bitonic arrays, 1D/2D peak finding, saddleback, quickselect, median-of-medians, best-first/beam/IDA*/SMA*/RBFS searches, CSP/SAT solvers, majority vote, Floyd duplicate find, and more |
| Graph Traversal | 47 | BFS (incl. bidirectional/lexicographic), DFS (recursive/iterative), IDDFS, topological sort (DFS/Kahn), flood fill, SCC (Tarjan/Kosaraju/Gabow), articulation points, bridges, biconnected components, 2-SAT, Eulerian tours, Hamiltonian backtracking, coloring (Welsh-Powell/DSATUR), Bron-Kerbosch cliques, k-cores, centrality (Brandes/closeness/PageRank/HITS), Louvain/Girvan-Newman communities, dominators, VF2 isomorphism, transitive closure/reduction |
| Shortest Paths | 30 | Dijkstra (heap/Fibonacci/matrix/bucket/Dial/0-1/bidirectional), Bellman-Ford, SPFA, Goldberg-Radzik, Floyd-Warshall, Johnson, A*, IDA*, Jump Point Search, Theta*, Yen's k-shortest, widest/minimax paths, DAG paths, Karp minimum mean cycle, contraction hierarchies, D* Lite replanning, Pareto bicriteria |
| Minimum Spanning Trees | 18 | Kruskal, Prim (heap/matrix), Boruvka, reverse-delete, second-best MST, MST verification/sensitivity, Euclidean MST, Edmonds' arborescence, Steiner (KMB) approximation, randomized MST, capacitated/degree-constrained/diameter variants, spanning-tree counting and enumeration |
| Network Flow | 35 | Ford-Fulkerson, Edmonds-Karp, Dinic, Push-Relabel, capacity scaling, Boykov-Kolmogorov, Min-Cut (Stoer-Wagner/Karger/Gomory-Hu/cactus), Min-Cost Max-Flow, cycle canceling, network simplex, transportation, bipartite matching (Hopcroft-Karp/b-matching/online ranking), Hungarian, blossom (cardinality/weighted), Konig cover, DAG path cover, Suurballe pairs, circulation, max closure, project selection, baseball elimination, Gale-Shapley |
| Tree Algorithms | 39 | Diameter, center, Euler tour, traversals (incl. Morris O(1) space), LCA (binary lifting, Euler+sparse, Tarjan offline, max-edge queries), HLD, centroid decomposition, DSU on tree, virtual trees, Mo's on trees, tree DP (vertex cover/dominating set/matching/knapsack/partition/coloring/edge cover/path cover/steiner), tree hashing/edit distance/pattern matching, Prufer codes, Huffman/optimal BST, decision trees, expression trees |
| String Algorithms | 69 | KMP, Z-algorithm, Boyer-Moore (incl. Horspool/Sunday/set variants), Aho-Corasick, Rabin-Karp (single/double), Wu-Manber, bitap/shift-or, Myers bit-parallel, BNDM, two-way matching, suffix array (doubling/DC3) + indexed search, LCP (Kasai) + RMQ queries, suffix automaton + occurrence queries, suffix tree (Ukkonen), Manacher, Eertree, Duval/Lyndon runs, Booth rotation, BWT + LF-mapping + FM-index, Needleman-Wunsch/Smith-Waterman/Hirschberg alignments, Myers diff, CYK/Earley/LL(1)/LR(0) parsing, Thompson NFA/subset construction/DFA minimization, Jaro-Winkler/Soundex/Metaphone, BPE tokenization |
| Number Theory | 94 | GCD (Euclid/binary Stein), extended Euclid, binary exponentiation, modular inverse, sieves (Eratosthenes/linear/segmented/Atkin/Sundaram), Euler totient, Fermat/Miller-Rabin/Solovay-Strassen/Baillie-PSW/Wilson primality, Lucas-Lehmer, Pollard Rho (factoring/discrete log/p-1), Fermat factorization, CRT (coprime/generalized), Lucas theorems, Mobius, NTT, FFT, Karatsuba, Tonelli-Shanks, discrete logs/roots, primitive roots, continued fractions, Stern-Brocot, LU/Gaussian elimination (incl. mod p, GF(2), fraction-free Bareiss), Montgomery reduction, elliptic-curve point addition, Shamir sharing, Lagrange interpolation, Gray codes, Josephus, Goldbach/twin-prime sieves, Hamming codes, and more |
| Dynamic Programming | 65 | Knapsack (0/1/complete/multiple), LIS/bitonic, edit distance, matrix chain, subset sum, bitmask TSP/assignment, coin change (count/min), rod cutting, egg drop, burst balloons, grid paths/obstacles/min-path/dungeon, distinct subsequences, LPS (subsequence/substring), wildcard/regex matching, stock (III/cooldown/fee), house robber, jump game, SOS DP, convex hull trick, Li Chao tree, optimal game strategy, boolean parenthesization, word break, Catalan/derangements/tilings/decodings, weighted interval scheduling, maximal square/rectangle, Kadane 1D/2D, and more |
| Game Theory | 30 | Nim (xor theory + winning-move execution), misere Nim (parity rule), Wythoff (cold pairs), Kayles (incl. Dawson's), Treblecross, Chomp, Euclid's game, Fibonacci/Staircase/Moore's/Nimble/Turning-turtles Nim, Hackenbush stalks, Node Kayles, Cram, Snort, Col, Domineering, Geography, Go atari, dots-and-boxes, Sprouts, minimax, alpha-beta, expectiminimax, MCTS-UCT, proof-number search, retrograde analysis |
| Computational Geometry | 56 | Dot/cross product, convex hull (Graham/Jarvis/monotone), convex layers, point-in-polygon (ray/winding/convex-binary), segment intersection + sweep line, closest pair, polygon area/centroid/triangulation, rotating calipers, min enclosing circle/rectangle, half-plane intersection, polygon kernel, Delaunay triangulation, Voronoi diagrams, alpha shapes, line/circle intersections, Pick's theorem, Klee measure, k-means, DBSCAN, visibility polygons, art-gallery guards, funnel shortest paths, Bresenham/midpoint rasterization, polygon/line clipping, Douglas-Peucker simplification, marching squares, GJK distance, Hilbert ordering, Poisson-disk sampling, skyline, Christofides TSP |
| Data Structures | 185 | BST, AVL, red-black, AA/scapegoat/weight-balanced/zip/tango trees, treap, splay, 2-3 tree, B-tree, B+ tree, binary/d-ary/binomial/Fibonacci/pairing/leftist/skew/hollow/soft/min-max/interval/weak/radix/bucket/B-heap/funnel/quake/Brodal heaps, order-statistic/cartesian/interval/range/R*/k-d/ball/vp/BK/cover/M/BSP trees, quadtree, octree, segment tree (recursive/iterative/lazy/dynamic/persistent), Fenwick tree (1D/2D/range), sparse table, wavelet tree/matrix, merge sort tree, sqrt decomposition, DSU (+rollback/deletions/persistent), link-cut/Euler-tour/top trees, trie (+Patricia/binary/ART/HAMT/burst/double-array/X-fast/Y-fast/vEB/concurrent), suffix trie, cuckoo/robin-hood/hopscotch/coalesced/FKS/extendible/linear/consistent/rendezvous hashing, Bloom (+counting/cuckoo/quotient/xor) filters, Count-Min/Count sketches, HyperLogLog, MinHash, t-digest/KLL, LRU/LFU/ARC/clock caches, LSM/fractal/cache-oblivious/T-trees, rope/gap-buffer/piece-table, stacks/queues/deques (incl. lock-free, banker's, calendar, min-queue, steque), buddy/slab/free-list/arena allocators, union-find variants, and more |

## Font Attribution

Noto Sans is used under the SIL Open Font License 1.1. The font is bundled locally in `public/fonts/` (offline-first -- no CDN). See https://fonts.google.com/noto/specimen/Noto+Sans for details.

## License

MIT
