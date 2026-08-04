/**
 * shortest-path-dag.ts – Shortest Path in a DAG (topological DP)
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * In a directed acyclic graph (DAG), the shortest path from a source to every
 * vertex can be found in linear time by processing vertices in topological
 * order and relaxing each vertex's outgoing edges exactly once. This works
 * because a topological order guarantees that all predecessors of a vertex are
 * processed before it, so by the time we relax a vertex its distance is final.
 * It even handles negative weights – no Bellman-Ford rounds needed.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(V + E) – a topological sort plus one relaxation pass
 *   Space: O(V)
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - The vertex being processed in topological order is YELLOW (comparing).
 *   - The edge being relaxed is BLUE (active).
 *   - Final distances are GREEN (sorted).
 *   - The shortest path is CYAN (path).
 *
 * ---------------------------------------------------------------------------
 * Properties
 * ---------------------------------------------------------------------------
 *   - The fastest possible single-source shortest path algorithm – but only
 *     for DAGs.
 *   - A beautiful example of how topological order unlocks linear-time DP.
 */

import type { AlgorithmModule, VisualEntity, VisualFrame } from "@/types";
import { makeGraphNodes, makeWeightedEdges } from "../graph/graph-util";

/**
 * The Shortest Path DAG generator.
 *
 * @param input `{ graph, vertices?, start?, target? }` – a weighted DAG
 *        adjacency list.
 */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task =
        (input as {
            graph?: Record<string, Array<[string, number]>>;
            vertices?: string[];
            start?: string;
            target?: string;
        } | null) ?? {};
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
    const vertices = task.vertices ?? ["A", "B", "C", "D", "E"];
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
        description: `Shortest path in a DAG from ${start} – processing in topological order.`,
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
    // Topological order via Kahn's algorithm on the unweighted structure.
    // ------------------------------------------------------------------
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

    yield buildFrame(`Topological order: ${topo.join(" → ")}.`);
    step += 1;

    // ------------------------------------------------------------------
    // DP relaxation over the topological order.
    // ------------------------------------------------------------------
    const dist = new Map<string, number>();
    const predecessor = new Map<string, string>();
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
        yield buildFrame(`Processing ${current} (final distance ${currentDist}).`);
        step += 1;

        // Relax each outgoing edge exactly once.
        for (const edge of edges) {
            edge.state = "idle";
        }
        for (const [neighbor, weight] of graph[current] ?? []) {
            const alt = currentDist + weight;
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
                neighborNode.label = String(dist.get(neighbor) ?? Infinity);
            }
            yield buildFrame(`Relaxing ${current} → ${neighbor}.`);
            step += 1;
        }

        if (node) {
            node.state = "sorted";
        }
    }

    // Reconstruct and colour the shortest path.
    const path: string[] = [];
    if (dist.get(target) !== Infinity) {
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
        description:
            dist.get(target) === Infinity
                ? `${target} is unreachable from ${start}.`
                : `Shortest path ${start} → ${target}: ${path.join(" → ")} (cost ${dist.get(target)}).`,
        codeLineNumber: 4,
        layout: "graph",
        meta: { distance: dist.get(target) ?? Infinity },
    };
}

/** The Shortest Path DAG module, registered with the engine. */
const module: AlgorithmModule = {
    id: "shortest-path-dag",
    name: "Shortest Path in a DAG",
    category: "shortest-path",
    complexity: { time: "O(V + E)", space: "O(V)" },
    // A small layered DAG with a clear shortest route A→B→D→E (cost 9).
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
