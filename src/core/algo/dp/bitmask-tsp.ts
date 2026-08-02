/**
 * bitmask-tsp.ts – Travelling Salesman Problem (bitmask DP, Held-Karp)
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * The Held-Karp algorithm solves TSP exactly with a bitmask DP:
 *
 *   dp[mask][v] = minimum cost of a tour visiting exactly the cities in
 *                 `mask`, ending at city v.
 *
 * The recurrence extends a tour by one city:
 *   dp[mask | 1<<u][u] = min(dp[mask][v] + cost[v][u]).
 *
 * The answer is the min over dp[all][v] + cost[v][0], closing the cycle.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(2^n · n²)
 *   Space: O(2^n · n)
 *
 * ---------------------------------------------------------------------------
 * Visualisation mapping
 * ---------------------------------------------------------------------------
 *   - The mask being extended is YELLOW (comparing).
 *   - The graph is shown as nodes.
 *   - The best tour edges are GREEN (sorted).
 *
 * ---------------------------------------------------------------------------
 * Properties
 * ---------------------------------------------------------------------------
 *   - The exponential-but-tractable "subset DP" template.
 *   - Demonstrates why n ≤ 20 is the practical limit.
 */

import type { AlgorithmModule, VisualEdge, VisualEntity, VisualFrame } from "@/types";
import { makeGraphNodes, makeWeightedEdges } from "../graph/graph-util";

/**
 * The Bitmask TSP generator.
 *
 * @param input `{ graph, vertices, start? }` – a weighted complete-ish graph.
 */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task =
        (input as {
            graph?: Record<string, Array<[string, number]>>;
            vertices?: string[];
            start?: string;
        } | null) ?? {};
    const vertices = task.vertices ?? ["A", "B", "C", "D"];
    const graph: Record<string, Array<[string, number]>> = task.graph ?? {
        A: [
            ["B", 10],
            ["C", 15],
            ["D", 20],
        ],
        B: [
            ["A", 10],
            ["C", 35],
            ["D", 25],
        ],
        C: [
            ["A", 15],
            ["B", 35],
            ["D", 30],
        ],
        D: [
            ["A", 20],
            ["B", 25],
            ["C", 30],
        ],
    };
    const start = task.start ?? "A";

    const n = vertices.length;
    const startIndex = vertices.indexOf(start);

    // Cost matrix.
    const cost: number[][] = Array.from({ length: n }, () => new Array<number>(n).fill(Infinity));
    for (const [from, neighbours] of Object.entries(graph)) {
        const i = vertices.indexOf(from);
        for (const [to, weight] of neighbours) {
            const j = vertices.indexOf(to);
            if (i >= 0 && j >= 0) {
                cost[i][j] = weight;
                cost[j][i] = weight;
            }
        }
    }

    // dp[mask][v]: a Map keyed by `mask,v`.
    const dp = new Map<string, number>();
    const parent = new Map<string, number>();

    const key = (mask: number, v: number): string => `${mask},${v}`;

    // Base: starting city visited, ending at itself, cost 0.
    dp.set(key(1 << startIndex, startIndex), 0);

    let step = 0;

    const nodes = makeGraphNodes(vertices);
    const edges = makeWeightedEdges(graph);

    // Frame 0: the graph.
    yield {
        stepNumber: step,
        entities: nodes.map((n) => ({ ...n })),
        edges: edges.map((e) => ({ ...e })),
        description: `Held-Karp DP for the TSP on ${vertices.length} cities.`,
        codeLineNumber: 0,
        layout: "graph",
        meta: {},
    };
    step += 1;

    // Iterate over masks in increasing order.
    for (let mask = 1; mask < 1 << n; mask += 1) {
        // Only consider masks containing the start.
        if ((mask & (1 << startIndex)) === 0) {
            continue;
        }
        for (let v = 0; v < n; v += 1) {
            if ((mask & (1 << v)) === 0) {
                continue;
            }
            const current = dp.get(key(mask, v));
            if (current === undefined) {
                continue;
            }

            // Extend to every unvisited city u.
            for (let u = 0; u < n; u += 1) {
                if ((mask & (1 << u)) !== 0) {
                    continue;
                }
                const nextMask = mask | (1 << u);
                const nextKey = key(nextMask, u);
                const alt = current + (cost[v]?.[u] ?? Infinity);
                if (alt < (dp.get(nextKey) ?? Infinity)) {
                    dp.set(nextKey, alt);
                    parent.set(nextKey, v);
                }

                yield {
                    stepNumber: step,
                    entities: nodes.map((nn) => ({ ...nn })),
                    edges: edges.map((e) => ({ ...e })),
                    description: `mask ${mask.toString(2).padStart(n, "0")} ending at ${vertices[v]} → extend to ${vertices[u]} (cost ${alt}).`,
                    codeLineNumber: 2,
                    layout: "graph",
                    meta: { mask },
                };
                step += 1;
            }
        }
    }

    // Reconstruct the best tour.
    const fullMask = (1 << n) - 1;
    let bestCost = Infinity;
    let bestEnd = -1;

    for (let v = 0; v < n; v += 1) {
        if (v === startIndex) {
            continue;
        }
        const closed = (dp.get(key(fullMask, v)) ?? Infinity) + (cost[v]?.[startIndex] ?? Infinity);
        if (closed < bestCost) {
            bestCost = closed;
            bestEnd = v;
        }
    }

    const tour: number[] = [];
    if (bestEnd >= 0) {
        let mask = fullMask;
        let v = bestEnd;
        while (v !== startIndex) {
            tour.push(v);
            const p = parent.get(key(mask, v));
            mask &= ~(1 << v);
            v = p ?? startIndex;
        }
        tour.push(startIndex);
        tour.reverse();
        tour.push(startIndex);
    }

    const tourLabels = tour.map((i) => vertices[i]);

    // Highlight the tour edges.
    for (let i = 0; i < tourLabels.length - 1; i += 1) {
        const a = tourLabels[i];
        const b = tourLabels[i + 1];
        const edge = edges.find(
            (e) =>
                (e.sourceId === `node-${a}` && e.targetId === `node-${b}`) ||
                (e.sourceId === `node-${b}` && e.targetId === `node-${a}`),
        );
        if (edge) {
            edge.state = "sorted";
        }
    }

    yield {
        stepNumber: step,
        entities: nodes.map((n) => ({ ...n })),
        edges: edges.map((e) => ({ ...e })),
        description: `Optimal tour ${tourLabels.join(" → ")} with cost ${bestCost}.`,
        codeLineNumber: 4,
        layout: "graph",
        meta: { bestCost },
    };
}

/** The Bitmask TSP module, registered with the engine. */
const module: AlgorithmModule = {
    id: "bitmask-tsp",
    name: "Bitmask TSP (Held-Karp)",
    category: "dynamic-programming",
    complexity: { time: "O(2^n·n²)", space: "O(2^n·n)" },
    // A symmetric 4-city instance with a clean tour.
    defaultInput: {
        graph: {
            A: [
                ["B", 10],
                ["C", 15],
                ["D", 20],
            ],
            B: [
                ["A", 10],
                ["C", 35],
                ["D", 25],
            ],
            C: [
                ["A", 15],
                ["B", 35],
                ["D", 30],
            ],
            D: [
                ["A", 20],
                ["B", 25],
                ["C", 30],
            ],
        },
        vertices: ["A", "B", "C", "D"],
        start: "A",
    },
    visualType: "graph",
    run,
};

export default module;
