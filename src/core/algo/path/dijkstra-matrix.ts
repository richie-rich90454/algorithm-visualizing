/**
 * dijkstra-matrix.ts – Dijkstra's Algorithm (Matrix / O(V²))
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Dijkstra's algorithm finds the shortest paths from a single source to every
 * other vertex in a graph with non-negative edge weights. It maintains a set
 * of "settled" vertices whose shortest distance is known, and repeatedly:
 *
 *   1. Picks the unsettled vertex with the smallest known distance.
 *   2. Settles it (its distance is now final).
 *   3. Relaxes each of its outgoing edges, possibly improving neighbors'
 *      tentative distances.
 *
 * This "matrix" variant scans the whole unsettled set to find the minimum on
 * each iteration, giving O(V²) – the best choice for dense graphs.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(V²) – V iterations, each scanning O(V) for the minimum
 *   Space: O(V) for the distance/predecessor arrays
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - The vertex being settled is YELLOW (comparing).
 *   - The edge being relaxed is BLUE (active).
 *   - Settled vertices are GREEN (sorted).
 *   - The final shortest path is CYAN (path).
 *
 * ---------------------------------------------------------------------------
 * Properties
 * ---------------------------------------------------------------------------
 *   - Requires non-negative edge weights (negative edges need Bellman-Ford).
 *   - The greedy "settle the smallest" step is the heart to teach.
 */

import type { AlgorithmModule, VisualEntity, VisualFrame } from "@/types";
import { makeGraphNodes, makeWeightedEdges } from "../graph/graph-util";

/**
 * The Dijkstra (Matrix) generator.
 *
 * @param input `{ graph, start, target }` where graph is a weighted adjacency
 *        list: `{ A: [["B", 4], ["C", 2]], ... }`.
 */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task =
        (input as {
            graph?: Record<string, Array<[string, number]>>;
            start?: string;
            target?: string;
        } | null) ?? {};
    const graph: Record<string, Array<[string, number]>> = task.graph ?? {
        A: [
            ["B", 4],
            ["C", 2],
        ],
        B: [
            ["D", 5],
            ["E", 3],
        ],
        C: [
            ["B", 1],
            ["D", 8],
        ],
        D: [
            ["E", 2],
            ["F", 6],
        ],
        E: [["F", 1]],
        F: [],
    };
    const start = task.start ?? "A";
    const target = task.target ?? "F";

    const vertices = Object.keys(graph);
    const nodes = makeGraphNodes(vertices);
    const edges = makeWeightedEdges(graph);

    const nodeById = new Map(nodes.map((n) => [n.id, n]));

    let step = 0;
    let settledCount = 0;

    // Distance and predecessor bookkeeping.
    const dist = new Map<string, number>();
    const settled = new Set<string>();
    const predecessor = new Map<string, string>();

    for (const v of vertices) {
        dist.set(v, Infinity);
    }
    dist.set(start, 0);

    // Frame 0: the untouched graph.
    yield {
        stepNumber: step,
        entities: nodes.map((n) => ({ ...n })),
        edges: edges.map((e) => ({ ...e })),
        description: `Dijkstra from ${start} to ${target} – settling vertices by smallest distance.`,
        codeLineNumber: 0,
        layout: "graph",
        meta: { settled: 0 },
    };
    step += 1;

    const buildFrame = (message: string): VisualFrame => ({
        stepNumber: step,
        entities: nodes.map((n) => ({ ...n })),
        edges: edges.map((e) => ({ ...e })),
        description: message,
        codeLineNumber: 2,
        layout: "graph",
        meta: { settled: settledCount },
    });

    // Repeat until every reachable vertex is settled.
    while (settled.size < vertices.length) {
        // Pick the unsettled vertex with the smallest tentative distance.
        let current = "";
        let bestDist = Infinity;
        for (const v of vertices) {
            if (!settled.has(v)) {
                const d = dist.get(v) ?? Infinity;
                if (d < bestDist) {
                    bestDist = d;
                    current = v;
                }
            }
        }

        // If the best is Infinity, the remaining vertices are unreachable.
        if (current === "" || bestDist === Infinity) {
            break;
        }

        // Settle the chosen vertex – its distance is now final.
        settled.add(current);
        settledCount += 1;

        const node = nodeById.get(`node-${current}`);
        if (node) {
            node.state = "comparing";
            node.label = String(bestDist);
        }
        yield buildFrame(`Settling ${current} (distance ${bestDist}).`);
        step += 1;

        // Relax every outgoing edge.
        for (const [neighbor, weight] of graph[current] ?? []) {
            // Reset all edge states to idle before marking new active edges.
            for (const edge of edges) {
                edge.state = "idle";
            }
            const alt = bestDist + weight;
            if (alt < (dist.get(neighbor) ?? Infinity)) {
                dist.set(neighbor, alt);
                predecessor.set(neighbor, current);
            }

            const edge = edges.find(
                (e) => e.sourceId === `node-${current}` && e.targetId === `node-${neighbor}`,
            );
            if (edge) {
                edge.state = "active";
            }
            const neighborNode = nodeById.get(`node-${neighbor}`);
            if (neighborNode) {
                neighborNode.state = "visited";
                neighborNode.label = String(dist.get(neighbor) ?? Infinity);
            }
            yield buildFrame(`Relaxing edge ${current} → ${neighbor} (weight ${weight}).`);
            step += 1;
        }

        if (node) {
            node.state = "sorted";
        }
        yield buildFrame(`${current} settled.`);
        step += 1;
    }

    // Reconstruct the shortest path to the target via predecessors.
    const path: string[] = [];
    let cursor = target;
    while (cursor !== undefined) {
        path.push(cursor);
        cursor = predecessor.get(cursor) ?? "";
        if (cursor === "") {
            break;
        }
    }
    path.reverse();

    // Color the path edges cyan.
    for (let i = 0; i < path.length - 1; i += 1) {
        const from = path[i];
        const to = path[i + 1];
        const edge = edges.find(
            (e) => e.sourceId === `node-${from}` && e.targetId === `node-${to}`,
        );
        if (edge) {
            edge.state = "path";
        }
    }

    yield {
        stepNumber: step,
        entities: nodes.map((n) => ({ ...n })),
        edges: edges.map((e) => ({ ...e })),
        description:
            dist.get(target) === Infinity
                ? `${target} is unreachable from ${start}.`
                : `Shortest path ${start} → ${target}: ${path.join(" → ")} (cost ${dist.get(target)}).`,
        codeLineNumber: 4,
        layout: "graph",
        meta: { settled: settledCount, distance: dist.get(target) ?? Infinity },
    };
}

/** The Dijkstra (Matrix) module, registered with the engine. */
const module: AlgorithmModule = {
    id: "dijkstra-matrix",
    name: "Dijkstra (Matrix)",
    category: "shortest-path",
    complexity: { time: "O(V²)", space: "O(V)" },
    // A small dense-ish graph; shortest A→F path is A→C→B→E→F (cost 6).
    defaultInput: {
        graph: {
            A: [
                ["B", 4],
                ["C", 2],
            ],
            B: [
                ["D", 5],
                ["E", 3],
            ],
            C: [
                ["B", 1],
                ["D", 8],
            ],
            D: [
                ["E", 2],
                ["F", 6],
            ],
            E: [["F", 1]],
            F: [],
        },
        start: "A",
        target: "F",
    },
    visualType: "graph",
    run,
};

export default module;
