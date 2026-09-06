/**
 * bellman-ford.ts – Bellman-Ford Algorithm
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Bellman-Ford finds shortest paths from a single source in a weighted graph,
 * *including graphs with negative edge weights* – something Dijkstra cannot
 * handle. It relaxes every edge V−1 times; after k rounds, all paths of up to
 * k edges have correct distances. A final extra round detects negative cycles:
 * if any distance still improves, a negative cycle is reachable and no finite
 * shortest path exists.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(V × E) – V−1 rounds, each relaxing all E edges
 *   Space: O(V)
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - The edge being relaxed is BLUE (active).
 *   - The vertex whose distance improved is YELLOW (comparing).
 *   - Settled/final vertices are GREEN (sorted).
 *   - The final shortest path is CYAN (path).
 *
 * ---------------------------------------------------------------------------
 * Properties
 * ---------------------------------------------------------------------------
 *   - Slower than Dijkstra but handles negative weights.
 *   - Negative cycles make shortest paths undefined – worth teaching clearly.
 */

import type { AlgorithmModule, VisualEntity, VisualFrame } from "@/types";
import { makeGraphNodes, makeWeightedEdges } from "../graph/graph-util";

/**
 * The Bellman-Ford generator.
 *
 * @param input `{ graph, start, target }` with a weighted adjacency list.
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
            ["C", 5],
        ],
        B: [
            ["C", -3],
            ["D", 2],
        ],
        C: [
            ["D", 6],
            ["E", 1],
        ],
        D: [
            ["E", -2],
            ["F", 3],
        ],
        E: [["F", 2]],
        F: [],
    };
    const start = task.start ?? "A";
    const target = task.target ?? "F";

    const vertices = Object.keys(graph);
    const nodes = makeGraphNodes(vertices);
    const edges = makeWeightedEdges(graph);

    const nodeById = new Map(nodes.map((n) => [n.id, n]));

    let step = 0;
    const dist = new Map<string, number>();
    const predecessor = new Map<string, string>();
    const edgeList: Array<{ from: string; to: string; weight: number }> = [];

    for (const v of vertices) {
        dist.set(v, Infinity);
    }
    dist.set(start, 0);

    // Flatten the weighted adjacency list into a plain edge list.
    for (const [from, neighbors] of Object.entries(graph)) {
        for (const [to, weight] of neighbors) {
            edgeList.push({ from, to, weight });
        }
    }

    yield {
        stepNumber: step,
        entities: nodes.map((n) => ({ ...n })),
        edges: edges.map((e) => ({ ...e })),
        description: `Bellman-Ford from ${start} – relaxing every edge V−1 times.`,
        codeLineNumber: 0,
        layout: "graph",
        meta: { relaxed: 0 },
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

    let relaxedAny = false;

    // V−1 relaxation rounds.
    for (let round = 0; round < vertices.length - 1; round += 1) {
        relaxedAny = false;

        for (const { from, to, weight } of edgeList) {
            const fromDist = dist.get(from) ?? Infinity;
            if (fromDist === Infinity) {
                continue;
            }
            const alt = fromDist + weight;
            if (alt < (dist.get(to) ?? Infinity)) {
                // Reset all edge states to idle before marking new active edges.
                for (const edge of edges) {
                    edge.state = "idle";
                }
                dist.set(to, alt);
                predecessor.set(to, from);
                relaxedAny = true;

                const edge = edges.find(
                    (e) => e.sourceId === `node-${from}` && e.targetId === `node-${to}`,
                );
                if (edge) {
                    edge.state = "active";
                }
                const node = nodeById.get(`node-${to}`);
                if (node) {
                    node.state = "comparing";
                    node.label = String(alt);
                }
                yield buildFrame(`Round ${round + 1}: improved ${to} to ${alt} via ${from}.`);
                step += 1;
            }
        }

        yield buildFrame(
            relaxedAny
                ? `Round ${round + 1} complete – distances improved.`
                : `Round ${round + 1} complete – no changes.`,
        );
        step += 1;
    }

    // Negative-cycle detection: one extra full pass.
    let hasNegativeCycle = false;
    for (const { from, to, weight } of edgeList) {
        const fromDist = dist.get(from) ?? Infinity;
        if (fromDist !== Infinity && fromDist + weight < (dist.get(to) ?? Infinity)) {
            hasNegativeCycle = true;
            break;
        }
    }

    // Reconstruct the shortest path (only when finite).
    const path: string[] = [];
    if (!hasNegativeCycle && dist.get(target) !== Infinity) {
        let cursor = target;
        while (cursor !== undefined) {
            path.push(cursor);
            cursor = predecessor.get(cursor) ?? "";
            if (cursor === "") {
                break;
            }
        }
        path.reverse();

        for (let i = 0; i < path.length - 1; i += 1) {
            const edge = edges.find(
                (e) => e.sourceId === `node-${path[i]}` && e.targetId === `node-${path[i + 1]}`,
            );
            if (edge) {
                edge.state = "path";
            }
        }
    }

    yield {
        stepNumber: step,
        entities: nodes.map((n) => ({ ...n })),
        edges: edges.map((e) => ({ ...e })),
        description: hasNegativeCycle
            ? "Negative cycle detected – no finite shortest paths exist."
            : dist.get(target) === Infinity
              ? `${target} is unreachable from ${start}.`
              : `Shortest path ${start} → ${target}: ${path.join(" → ")} (cost ${dist.get(target)}).`,
        codeLineNumber: 4,
        layout: "graph",
        meta: { negativeCycle: hasNegativeCycle, distance: dist.get(target) ?? Infinity },
    };
}

/** The Bellman-Ford module, registered with the engine. */
const module: AlgorithmModule = {
    id: "bellman-ford",
    name: "Bellman-Ford",
    category: "shortest-path",
    complexity: { time: "O(V × E)", space: "O(V)" },
    // Contains a negative edge (B→C = −3) that Dijkstra would reject.
    defaultInput: {
        graph: {
            A: [
                ["B", 4],
                ["C", 5],
            ],
            B: [
                ["C", -3],
                ["D", 2],
            ],
            C: [
                ["D", 6],
                ["E", 1],
            ],
            D: [
                ["E", -2],
                ["F", 3],
            ],
            E: [["F", 2]],
            F: [],
        },
        start: "A",
        target: "F",
    },
    visualType: "graph",
    run,
};

export default module;
