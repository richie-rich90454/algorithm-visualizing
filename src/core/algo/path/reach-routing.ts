/**
 * reach-routing.ts - REACH Preprocessing for Road-Network Routing
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * REACH assigns every vertex a value measuring how far it can be "bypassed":
 * reach(v) is the largest excess of the shortest path through v over the true
 * shortest path between the same endpoints. A vertex with a large reach is
 * rarely needed on a shortest route, so a query can skip expansions that cannot
 * beat the current best distance. This module computes the reach table exactly
 * from all-pairs shortest distances, which is practical for small networks.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(V^3) for all-pairs distances and the reach double scan
 *   Space: O(V^2) for the distance and reach tables
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - The vertex whose reach is being evaluated is YELLOW.
 *   - Vertices with a positive reach are PINK in the final frame.
 *   - Edge labels show traversal cost; meta carries the reach table.
 */

import type { AlgorithmModule, EntityState, VisualEdge, VisualEntity, VisualFrame } from "@/types";
import { makeGraphNodes, makeWeightedEdges } from "../graph/graph-util";

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task =
        (input as { graph?: Record<string, Array<[string, number]>> } | null) ?? {};
    const wadj: Record<string, Array<[string, number]>> = task.graph ?? {
        A: [
            ["B", 1],
            ["C", 10],
        ],
        B: [["D", 1]],
        C: [["B", 1]],
        D: [],
    };

    const labels = [
        ...new Set([
            ...Object.keys(wadj),
            ...Object.values(wadj).flatMap((vs) => vs.map(([v]) => String(v))),
        ]),
    ].sort();
    const n = labels.length;
    const index = new Map(labels.map((v, i) => [v, i] as const));
    const INF = Number.POSITIVE_INFINITY;
    const dist: number[][] = Array.from({ length: n }, () => Array<number>(n).fill(INF));
    for (let i = 0; i < n; i += 1) {
        dist[i] = Array<number>(n).fill(INF);
        (dist[i] as number[])[i] = 0;
    }
    for (const [a, pairs] of Object.entries(wadj)) {
        const i = index.get(a);
        if (i === undefined) {
            continue;
        }
        for (const [bRaw, weight] of pairs) {
            const j = index.get(String(bRaw));
            if (j !== undefined && weight < (dist[i] as number[])[j]) {
                (dist[i] as number[])[j] = weight;
            }
        }
    }
    for (let k = 0; k < n; k += 1) {
        for (let i = 0; i < n; i += 1) {
            for (let j = 0; j < n; j += 1) {
                const through = (dist[i] as number[])[k] + (dist[k] as number[])[j];
                if (through < (dist[i] as number[])[j]) {
                    (dist[i] as number[])[j] = through;
                }
            }
        }
    }

    const reach = Array<number>(n).fill(0);
    const frames: VisualFrame[] = [];

    const push = (description: string, line: number, focus: number, done: boolean): void => {
        const nodes: VisualEntity[] = makeGraphNodes(labels);
        nodes.forEach((node, i) => {
            if (i === focus) {
                node.state = "active";
            } else if (done && (reach[i] as number) > 0) {
                node.state = "highlight";
            } else {
                node.state = "unvisited";
            }
            node.metadata = { ...node.metadata, reach: reach[i] as number };
        });
        const edges: VisualEdge[] = makeWeightedEdges(wadj).filter(
            (e) => index.has(e.sourceId.replace("node-", "")) && index.has(e.targetId.replace("node-", "")),
        );
        frames.push({
            stepNumber: frames.length,
            entities: nodes,
            edges,
            description,
            codeLineNumber: line,
            layout: "graph",
            meta: {
                reach: [...reach],
                vertex: focus >= 0 ? (labels[focus] as string) : "",
            },
        });
    };

    if (n === 0) {
        push("Empty graph - no reach values to compute.", 0, -1, true);
        for (const frame of frames) {
            yield frame;
        }
        return;
    }

    push("REACH: quantify how far each vertex can be bypassed on a shortest route.", 0, -1, false);

    for (let v = 0; v < n; v += 1) {
        let best = 0;
        for (let s = 0; s < n; s += 1) {
            if (s === v) {
                continue;
            }
            for (let t = 0; t < n; t += 1) {
                if (t === v || t === s) {
                    continue;
                }
                const viaSource = (dist[s] as number[])[v] as number;
                const viaTarget = (dist[v] as number[])[t] as number;
                const direct = (dist[s] as number[])[t] as number;
                if (!Number.isFinite(viaSource) || !Number.isFinite(viaTarget) || !Number.isFinite(direct)) {
                    continue;
                }
                best = Math.max(best, viaSource + viaTarget - direct);
            }
        }
        reach[v] = best;
        push(
            `Reach of ${labels[v]} is ${best}; it can be bypassed by that much on a shortest route.`,
            4,
            v,
            false,
        );
    }

    push(
        `Reach table complete: ${reach.map((r, i) => `${labels[i]}=${r}`).join(", ")}.`,
        7,
        -1,
        true,
    );

    for (const frame of frames) {
        yield frame;
    }
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "A vertex is useful for a query only when the best route actually needs to pass through it. REACH measures, for each vertex, the largest gap between going through it and taking a genuine shortest route between the same endpoints. A large gap means the vertex is easy to bypass, so a search can safely ignore it when even an optimistic route through it would not beat the current best answer.",
        invariants: [
            "All-pairs distances satisfy the triangle inequality after Floyd-Warshall.",
            "A reach value is nonnegative and is zero when the vertex has no predecessor or no successor.",
            "The stored reach is the maximum bypass excess over every ordered pair of other vertices.",
        ],
        correctness:
            "Floyd-Warshall computes the exact shortest distance between every ordered pair because it considers each vertex as a candidate intermediate in turn. For a vertex v and endpoints s and t, the shortest s-to-t route through v has length d(s,v) + d(v,t), while the true optimum is d(s,t); their difference is the bypass excess. Taking the maximum over all s and t yields exactly the REACH value, and a zero is recorded when no finite pair exists.",
        complexityRationale:
            "Floyd-Warshall performs three nested loops over V vertices, costing O(V^3). The reach scan also examines every ordered pair (s, t) for each v, another O(V^3). The distance and reach tables require O(V^2) space.",
        uses: [
            "Speeding up point-to-point queries on road networks",
            "Pruning searches in time-dependent and multimodal route planners",
            "Preprocessing transit graphs for landmark-based routing",
        ],
        references: [
            "Goldberg, Kaplan, Werneck, Zhang and Levine, Reach: A New Algorithm for Shortest-Path Search, 2008",
            "Cormen, Leiserson, Rivest and Stein, Introduction to Algorithms, chapter on all-pairs shortest paths",
        ],
        workedExample:
            "With edges A to B cost 1, A to C cost 10, C to B cost 1, and B to D cost 1, the shortest A-to-B route costs 1 while routing through C costs 11. The bypass excess for C is therefore 10, so reach(C) = 10; vertices A, B and D have reach zero because no endpoint pair gains a longer route through them.",
    },
    id: "reach-routing",
    name: "REACH Routing Preprocessing",
    category: "shortest-path",
    complexity: { time: "O(V^3)", space: "O(V^2)" },
    defaultInput: {
        graph: {
            A: [
                ["B", 1],
                ["C", 10],
            ],
            B: [["D", 1]],
            C: [["B", 1]],
            D: [],
        },
    },
    visualType: "graph",
    run,
    pseudocode: [
        "read the weighted directed graph and list its vertices",
        "initialize the distance matrix with zero diagonal and edge costs",
        "run Floyd-Warshall to obtain all-pairs shortest distances",
        "for each vertex v, start its reach at zero",
        "for every ordered pair s, t different from v",
        "raise reach of v by the excess of the route through v over the direct distance",
        "store the largest excess found as reach of v",
        "report the complete reach table",
    ],
};

export default module;
