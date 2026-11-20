/**
 * parallel-bfs.ts - Level-Synchronous Parallel Breadth-First Search
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Parallel BFS explores a graph one level at a time. All vertices in the
 * current frontier are expanded simultaneously, their undiscovered neighbors
 * form the next frontier, and only then are the new distances recorded. This
 * barrier between levels is what makes the work parallelizable.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(diameter) depth, O(V + E) work
 *   Space: O(V) for distances and frontiers
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Vertices are graph nodes; adjacency entries are directed edges.
 *   - The current frontier is yellow and already visited nodes are green.
 *   - The metadata reports the current level, frontier, and distances.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualEdge, VisualFrame } from "@/types";

/** Build node entities colored by their BFS distance. */
function makeNodes(
    count: number,
    distances: number[],
    frontier: Set<number>,
): VisualEntity[] {
    return Array.from({ length: count }, (_, index) => {
        const distance = distances[index] ?? -1;
        const state: EntityState = frontier.has(index)
            ? "comparing"
            : distance >= 0
              ? "visited"
              : "unvisited";
        return {
            id: `node-${index}`,
            type: "node" as const,
            label: String(index),
            value: index,
            state,
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: { index, distance },
        };
    });
}

/** Build directed edges from an adjacency list. */
function makeEdges(adjacency: number[][]): VisualEdge[] {
    const edges: VisualEdge[] = [];
    for (let from = 0; from < adjacency.length; from += 1) {
        for (const to of adjacency[from] ?? []) {
            if (to >= 0 && to < adjacency.length) {
                edges.push({
                    id: `edge-${from}-${to}`,
                    sourceId: `node-${from}`,
                    targetId: `node-${to}`,
                    label: "",
                    state: "idle",
                    directed: true,
                });
            }
        }
    }
    return edges;
}

/** The parallel BFS generator. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { adjacency?: number[][]; source?: number } | null) ?? {};
    const adjacency: number[][] =
        Array.isArray(task.adjacency) && task.adjacency.length > 0
            ? task.adjacency.map((list) => (Array.isArray(list) ? [...list] : []))
            : [
                  [1, 2],
                  [3],
                  [3, 4],
                  [4],
                  [],
              ];
    const count = adjacency.length;
    const source =
        typeof task.source === "number" && task.source >= 0 && task.source < count
            ? Math.floor(task.source)
            : 0;
    const distances: number[] = Array.from({ length: count }, () => -1);
    distances[source] = 0;
    let frontier = new Set<number>([source]);
    let level = 0;
    const edges = makeEdges(adjacency);

    let step = 0;
    yield {
        stepNumber: step,
        entities: makeNodes(count, distances, frontier),
        edges,
        description: `Starting parallel BFS from vertex ${source} with ${count} vertices.`,
        codeLineNumber: 0,
        layout: "graph",
        meta: { level: 0, frontier: [source], distances: [...distances], visited: 1 },
    };
    step += 1;

    while (frontier.size > 0) {
        const next = new Set<number>();
        for (const vertex of frontier) {
            for (const neighbor of adjacency[vertex] ?? []) {
                if (neighbor >= 0 && neighbor < count && (distances[neighbor] ?? -1) === -1) {
                    next.add(neighbor);
                }
            }
        }
        for (const vertex of next) {
            distances[vertex] = level + 1;
        }
        level += 1;
        frontier = next;
        if (frontier.size === 0) {
            break;
        }
        yield {
            stepNumber: step,
            entities: makeNodes(count, distances, frontier),
            edges,
            description: `Level ${level}: expanding all frontier vertices in parallel discovered ${frontier.size} new vertex(es) at distance ${level}.`,
            codeLineNumber: 2,
            layout: "graph",
            meta: { level, frontier: [...frontier], distances: [...distances], visited: distances.filter((d) => d >= 0).length },
        };
        step += 1;
    }

    yield {
        stepNumber: step,
        entities: makeNodes(count, distances, new Set()),
        edges,
        description: `BFS complete: ${distances.filter((d) => d >= 0).length} vertex(es) reachable from ${source} in ${level} level(s).`,
        codeLineNumber: 5,
        layout: "graph",
        meta: { level, frontier: [], distances: [...distances], visited: distances.filter((d) => d >= 0).length },
    };
}

/** The parallel BFS module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "A sequential queue visits one vertex at a time. Parallel BFS keeps a whole frontier of vertices at the same distance and expands them together, using a barrier between levels so no vertex is written twice. Each level corresponds to one round of parallel work.",
        invariants: [
            "Every vertex in the current frontier has the same distance from the source.",
            "A vertex is added to the next frontier only the first time it is discovered.",
            "All reads of distances happen before any writes for the next level.",
        ],
        correctness:
            "By induction on levels, the frontier at level k contains exactly the vertices at shortest distance k: the source starts at level 0, and expanding all level-k vertices reaches precisely their undiscovered neighbors, which are at distance k+1 because any shorter path would have discovered them earlier. The barrier ensures parallel writes cannot corrupt this argument, so the distances match sequential BFS.",
        complexityRationale:
            "Each vertex enters a frontier once and each edge is scanned once, giving O(V + E) total work spread over O(diameter) parallel rounds. Distances, frontiers, and the visited count use O(V) space.",
        uses: [
            "Graph traversal on GPUs and multicore machines",
            "Shortest-path preprocessing in road networks",
            "Level synchronization in graph analytics frameworks",
        ],
        references: [
            "Shiloach and Vishkin, An O(log n) Parallel Connectivity Algorithm, 1982",
            "Malewicz et al., Pregel: A System for Large-Scale Graph Processing, 2010",
        ],
        workedExample:
            "For edges 0 to {1,2}, 1 to {3}, 2 to {3,4}, 3 to {4}, starting at 0, level 1 discovers {1,2} and level 2 discovers {3,4}. The distances [0,1,1,2,2] match a queue-based BFS.",
    },
    id: "parallel-bfs",
    name: "Parallel BFS",
    category: "parallel-distributed",
    complexity: { time: "O(V + E) work, O(diameter) depth", space: "O(V)" },
    defaultInput: {
        adjacency: [
            [1, 2],
            [3],
            [3, 4],
            [4],
            [],
        ],
        source: 0,
    },
    visualType: "graph",
    run,
    pseudocode: [
        "set all distances to infinite and the source to zero",
        "place the source in the current frontier",
        "while the frontier is not empty",
        "expand every frontier vertex in parallel",
        "collect undiscovered neighbors into the next frontier",
        "set their distances after the barrier",
        "swap the frontier and advance one level",
        "done: report all shortest distances",
    ],
};

export default module;
