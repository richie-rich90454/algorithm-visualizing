/**
 * dag-shortest-dp.ts – Shortest Path in a DAG (DP / topological)
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * In a DAG, shortest paths from a source can be computed in O(V + E) by
 * processing vertices in topological order and relaxing edges once each. This
 * "DP over topological order" view makes the recurrence explicit:
 *
 *   dist[v] = min over in-edges (u→v) of dist[u] + w(u, v).
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(V + E)
 *   Space: O(V)
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - The vertex being finalised is YELLOW (comparing).
 *   - The edge being relaxed is BLUE (active).
 *   - The shortest path is CYAN (path).
 *
 * ---------------------------------------------------------------------------
 * Properties
 * ---------------------------------------------------------------------------
 *   - The same idea as "shortest-path-dag" but framed as DP.
 */

import type { AlgorithmModule, VisualEdge, VisualEntity, VisualFrame } from "@/types";
import { makeGraphNodes, makeWeightedEdges } from "../graph/graph-util";

/**
 * The DAG Shortest DP generator.
 *
 * @param input `{ graph, vertices, start, target }`.
 */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task =
        (input as {
            graph?: Record<string, Array<[string, number]>>;
            vertices?: string[];
            start?: string;
            target?: string;
        } | null) ?? {};
    const vertices = task.vertices ?? ["A", "B", "C", "D", "E"];
    const graph: Record<string, Array<[string, number]>> = task.graph ?? {
        A: [
            ["B", 3],
            ["C", 6],
        ],
        B: [
            ["C", 2],
            ["D", 4],
        ],
        C: [
            ["D", 1],
            ["E", 5],
        ],
        D: [["E", 2]],
        E: [],
    };
    const start = task.start ?? "A";
    const target = task.target ?? "E";

    const nodes = makeGraphNodes(vertices);
    const edges = makeWeightedEdges(graph);
    const nodeById = new Map(nodes.map((n) => [n.id, n]));

    let step = 0;

    // Frame 0: the untouched graph.
    yield {
        stepNumber: step,
        entities: nodes.map((n) => ({ ...n })),
        edges: edges.map((e) => ({ ...e })),
        description: `DAG shortest paths from ${start} using topological DP.`,
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

    // Topological order (Kahn's algorithm).
    const inDegree = new Map<string, number>();
    for (const v of vertices) {
        inDegree.set(v, 0);
    }
    for (const neighbors of Object.values(graph)) {
        for (const [to] of neighbors) {
            inDegree.set(to, (inDegree.get(to) ?? 0) + 1);
        }
    }
    const queue: string[] = vertices.filter((v) => (inDegree.get(v) ?? 0) === 0);
    const topo: string[] = [];
    while (queue.length > 0) {
        const current = queue.shift();
        if (!current) {
            continue;
        }
        topo.push(current);
        for (const [neighbor] of graph[current] ?? []) {
            inDegree.set(neighbor, (inDegree.get(neighbor) ?? 0) - 1);
            if ((inDegree.get(neighbor) ?? 0) === 0) {
                queue.push(neighbor);
            }
        }
    }

    // DP over the topological order.
    const dist = new Map<string, number>();
    const parent = new Map<string, string>();
    for (const v of vertices) {
        dist.set(v, Infinity);
    }
    dist.set(start, 0);

    for (const current of topo) {
        const currentDist = dist.get(current) ?? Infinity;
        if (currentDist === Infinity) {
            continue;
        }

        const node = nodeById.get(`node-${current}`);
        if (node) {
            node.state = "comparing";
            node.label = String(currentDist);
        }
        yield buildFrame(`Finalising ${current} (distance ${currentDist}).`);
        step += 1;

        for (const edge of edges) {
            edge.state = "idle";
        }
        for (const [neighbor, weight] of graph[current] ?? []) {
            const alt = currentDist + weight;
            if (alt < (dist.get(neighbor) ?? Infinity)) {
                dist.set(neighbor, alt);
                parent.set(neighbor, current);
            }

            const edge = edges.find(
                (e) => e.sourceId === `node-${current}` && e.targetId === `node-${neighbor}`,
            );
            if (edge) {
                edge.state = "active";
            }
            yield buildFrame(`Relaxing ${current} → ${neighbor}.`);
            step += 1;
        }

        if (node) {
            node.state = "sorted";
        }
    }

    // Reconstruct and color the path.
    const path: string[] = [];
    if (dist.get(target) !== Infinity) {
        let cursor = target;
        while (cursor !== undefined) {
            path.push(cursor);
            cursor = parent.get(cursor) ?? "";
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
        description:
            dist.get(target) === Infinity
                ? `${target} unreachable from ${start}.`
                : `Shortest path ${start} → ${target}: ${path.join(" → ")} (cost ${dist.get(target)}).`,
        codeLineNumber: 4,
        layout: "graph",
        meta: { distance: dist.get(target) ?? Infinity },
    };
}

/** The DAG Shortest DP module, registered with the engine. */
const module: AlgorithmModule = {
    id: "dag-shortest-dp",
    name: "DAG Shortest Path (DP)",
    category: "dynamic-programming",
    complexity: { time: "O(V + E)", space: "O(V)" },
    // A layered DAG; shortest A→E route is A→B→D→E (cost 9).
    defaultInput: {
        graph: {
            A: [
                ["B", 3],
                ["C", 6],
            ],
            B: [
                ["C", 2],
                ["D", 4],
            ],
            C: [
                ["D", 1],
                ["E", 5],
            ],
            D: [["E", 2]],
            E: [],
        },
        vertices: ["A", "B", "C", "D", "E"],
        start: "A",
        target: "E",
    },
    visualType: "graph",
    run,
};

export default module;
