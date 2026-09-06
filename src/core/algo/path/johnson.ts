/**
 * johnson.ts – Johnson's Algorithm (All-Pairs Shortest Path)
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Johnson's algorithm computes all-pairs shortest paths for sparse graphs
 * faster than Floyd-Warshall. Its trick is to re-weight the graph with a
 * *potential function* so that every edge weight becomes non-negative, then
 * run Dijkstra from every vertex. The potentials come from one Bellman-Ford
 * run against a virtual source; this both handles negative edges and produces
 * the non-negative re-weighting.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(V·E + V·E log V) = one Bellman-Ford + V Dijkstras
 *   Space: O(V²) for the all-pairs distance table
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - The current Dijkstra source is YELLOW (comparing).
 *   - The edge being relaxed is BLUE (active).
 *   - The re-weighting step is announced before the Dijkstra phase.
 *
 * ---------------------------------------------------------------------------
 * Properties
 * ---------------------------------------------------------------------------
 *   - Best of both worlds: negative edges (Bellman-Ford) plus speed (Dijkstra).
 *   - The potential/height trick is a genuinely clever idea worth studying.
 */

import type { AlgorithmModule, VisualEntity, VisualFrame } from "@/types";
import { makeGraphNodes, makeWeightedEdges } from "../graph/graph-util";

/**
 * The Johnson's Algorithm generator.
 *
 * @param input `{ graph, vertices? }` – a weighted adjacency list.
 */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task =
        (input as {
            graph?: Record<string, Array<[string, number]>>;
            vertices?: string[];
        } | null) ?? {};
    const graph: Record<string, Array<[string, number]>> = task.graph ?? {
        A: [
            ["B", 3],
            ["C", 8],
        ],
        B: [
            ["C", 2],
            ["D", 7],
        ],
        C: [
            ["D", 1],
            ["A", -4],
        ],
        D: [["C", 5]],
    };
    const vertices = task.vertices ?? ["A", "B", "C", "D"];

    const nodes = makeGraphNodes(vertices);
    const edges = makeWeightedEdges(graph);

    let step = 0;

    // Frame 0: the untouched graph.
    yield {
        stepNumber: step,
        entities: nodes.map((n) => ({ ...n })),
        edges: edges.map((e) => ({ ...e })),
        description:
            "Johnson's algorithm – re-weighting edges before running Dijkstra from every vertex.",
        codeLineNumber: 0,
        layout: "graph",
        meta: {},
    };
    step += 1;

    const buildFrame = (message: string): VisualFrame => ({
        stepNumber: step,
        entities: nodes.map((n) => ({ ...n })),
        edges: edges.map((e) => ({ ...e })),
        description: message,
        codeLineNumber: 2,
        layout: "graph",
        meta: {},
    });

    // ------------------------------------------------------------------
    // Phase 1: Bellman-Ford from a virtual source to get the potentials.
    // The virtual source reaches every vertex with weight 0.
    // ------------------------------------------------------------------
    const potential = new Map<string, number>();
    for (const v of vertices) {
        potential.set(v, 0);
    }

    // Relax all edges V times (the virtual source adds nothing, so the first
    // round is equivalent to Bellman-Ford over the real edges).
    const edgeList: Array<{ from: string; to: string; weight: number }> = [];
    for (const [from, neighbors] of Object.entries(graph)) {
        for (const [to, weight] of neighbors) {
            edgeList.push({ from, to, weight });
        }
    }

    for (let round = 0; round < vertices.length; round += 1) {
        for (const { from, to, weight } of edgeList) {
            const fromDist = potential.get(from) ?? Infinity;
            if (fromDist !== Infinity && fromDist + weight < (potential.get(to) ?? Infinity)) {
                potential.set(to, fromDist + weight);
            }
        }
    }

    // Negative cycle check.
    let hasNegativeCycle = false;
    for (const { from, to, weight } of edgeList) {
        const fromDist = potential.get(from) ?? Infinity;
        if (fromDist !== Infinity && fromDist + weight < (potential.get(to) ?? Infinity)) {
            hasNegativeCycle = true;
            break;
        }
    }

    yield buildFrame(
        hasNegativeCycle
            ? "Negative cycle detected – Johnson's algorithm cannot proceed."
            : `Potentials computed – re-weighting edges so all weights are non-negative.`,
    );
    step += 1;

    // ------------------------------------------------------------------
    // Phase 2: run Dijkstra from every vertex on the re-weighted graph.
    // ------------------------------------------------------------------
    const results: Record<string, number> = {};

    for (const source of vertices) {
        // A simple O(V²) Dijkstra over the re-weighted edges.
        const dist = new Map<string, number>();
        const settled = new Set<string>();
        for (const v of vertices) {
            dist.set(v, Infinity);
        }
        dist.set(source, 0);

        while (settled.size < vertices.length) {
            let current = "";
            let best = Infinity;
            for (const v of vertices) {
                if (!settled.has(v) && (dist.get(v) ?? Infinity) < best) {
                    best = dist.get(v) ?? Infinity;
                    current = v;
                }
            }
            if (current === "") {
                break;
            }
            settled.add(current);

            const currentNode = nodes.find((n) => n.id === `node-${current}`);
            if (currentNode) {
                currentNode.state = "comparing";
            }
            // Reset all edge states to idle before marking new active edges.
            for (const edge of edges) {
                edge.state = "idle";
            }
            yield buildFrame(`Dijkstra from ${source} – settling ${current}.`);
            step += 1;

            for (const [neighbor, weight] of graph[current] ?? []) {
                // Re-weighted cost = original weight + potential[current] − potential[neighbor].
                const reweighted =
                    weight + (potential.get(current) ?? 0) - (potential.get(neighbor) ?? 0);
                const alt = best + reweighted;
                if (alt < (dist.get(neighbor) ?? Infinity)) {
                    dist.set(neighbor, alt);
                }

                const edge = edges.find(
                    (e) => e.sourceId === `node-${current}` && e.targetId === `node-${neighbor}`,
                );
                if (edge) {
                    edge.state = "active";
                }
            }

            if (currentNode) {
                currentNode.state = "visited";
            }
        }

        // Un-re-weight distances before storing the result.
        for (const v of vertices) {
            if ((dist.get(v) ?? Infinity) < Infinity) {
                const original =
                    (dist.get(v) ?? Infinity) -
                    (potential.get(source) ?? 0) +
                    (potential.get(v) ?? 0);
                results[`${source}→${v}`] = original;
            }
        }
    }

    yield {
        stepNumber: step,
        entities: nodes.map((n) => ({ ...n })),
        edges: edges.map((e) => ({ ...e })),
        description: hasNegativeCycle
            ? "All-pairs computation aborted due to a negative cycle."
            : `All-pairs shortest paths computed (${vertices.length} Dijkstra runs).`,
        codeLineNumber: 4,
        layout: "graph",
        meta: { negativeCycle: hasNegativeCycle, sources: vertices.length },
    };
}

/** The Johnson's Algorithm module, registered with the engine. */
const module: AlgorithmModule = {
    id: "johnson",
    name: "Johnson's Algorithm",
    category: "shortest-path",
    complexity: { time: "O(V·E log V)", space: "O(V²)" },
    // Same graph as Floyd-Warshall, showing the sparse-graph alternative.
    defaultInput: {
        graph: {
            A: [
                ["B", 3],
                ["C", 8],
            ],
            B: [
                ["C", 2],
                ["D", 7],
            ],
            C: [
                ["D", 1],
                ["A", -4],
            ],
            D: [["C", 5]],
        },
        vertices: ["A", "B", "C", "D"],
    },
    visualType: "graph",
    run,
};

export default module;
