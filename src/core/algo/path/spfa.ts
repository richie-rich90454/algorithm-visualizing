/**
 * spfa.ts – Shortest Path Faster Algorithm (SPFA)
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * SPFA is an optimisation of Bellman-Ford that uses a queue. Instead of
 * relaxing every edge in every round, it only relaxes edges leaving vertices
 * whose own distance changed recently. A vertex is enqueued when it improves;
 * when dequeued, its outgoing edges are relaxed. This typically visits far
 * fewer edges than Bellman-Ford, and the same negative-cycle detection applies:
 * a vertex that gets enqueued V+1 times lies on a negative cycle.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(V × E) worst, but often O(E) in practice
 *   Space: O(V) for the queue and in-queue flags
 *
 * ---------------------------------------------------------------------------
 * Visualisation mapping
 * ---------------------------------------------------------------------------
 *   - The vertex being processed from the queue is YELLOW (comparing).
 *   - The edge being relaxed is BLUE (active).
 *   - Improved vertices are ORANGE (visited).
 *   - The final shortest path is CYAN (path).
 *
 * ---------------------------------------------------------------------------
 * Properties
 * ---------------------------------------------------------------------------
 *   - Handles negative edges, like Bellman-Ford, but is usually much faster.
 *   - The queue can reprocess a vertex many times – that is the cost of
 *     avoiding a full round of relaxation.
 */

import type { AlgorithmModule, VisualEntity, VisualFrame } from "@/types";
import { makeGraphNodes, makeWeightedEdges } from "../graph/graph-util";

/**
 * The SPFA generator.
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
    const inQueue = new Set<string>();
    const enqueueCount = new Map<string, number>();

    for (const v of vertices) {
        dist.set(v, Infinity);
        enqueueCount.set(v, 0);
    }
    dist.set(start, 0);

    yield {
        stepNumber: step,
        entities: nodes.map((n) => ({ ...n })),
        edges: edges.map((e) => ({ ...e })),
        description: `SPFA from ${start} – only relaxing edges of recently-improved vertices.`,
        codeLineNumber: 0,
        layout: "graph",
        meta: {},
    };
    step += 1;

    // Seed the queue with the source.
    const queue: string[] = [start];
    inQueue.add(start);
    enqueueCount.set(start, 1);

    const buildFrame = (message: string): VisualFrame => ({
        stepNumber: step,
        entities: nodes.map((n) => ({ ...n })),
        edges: edges.map((e) => ({ ...e })),
        description: message,
        codeLineNumber: 2,
        layout: "graph",
        meta: { queueSize: queue.length },
    });

    let hasNegativeCycle = false;

    while (queue.length > 0) {
        // Dequeue and process the next improved vertex.
        const current = queue.shift();
        if (!current) {
            continue;
        }
        inQueue.delete(current);

        const currentDist = dist.get(current) ?? Infinity;
        const node = nodeById.get(`node-${current}`);
        if (node) {
            node.state = "comparing";
            node.label = String(currentDist);
        }
        yield buildFrame(`Processing ${current} (distance ${currentDist}).`);
        step += 1;

        // Relax every outgoing edge of the dequeued vertex.
        for (const edge of edges) {
            edge.state = "idle";
        }
        for (const [neighbour, weight] of graph[current] ?? []) {
            const alt = currentDist + weight;
            if (alt < (dist.get(neighbour) ?? Infinity)) {
                dist.set(neighbour, alt);
                predecessor.set(neighbour, current);

                // Enqueue the improved vertex if it is not already queued.
                if (!inQueue.has(neighbour)) {
                    queue.push(neighbour);
                    inQueue.add(neighbour);
                    const count = (enqueueCount.get(neighbour) ?? 0) + 1;
                    enqueueCount.set(neighbour, count);
                    // Enqueued V+1 times ⇒ negative cycle reachable.
                    if (count > vertices.length) {
                        hasNegativeCycle = true;
                    }
                }

                const edge = edges.find(
                    (e) => e.sourceId === `node-${current}` && e.targetId === `node-${neighbour}`,
                );
                if (edge) {
                    edge.state = "active";
                }
                const neighbourNode = nodeById.get(`node-${neighbour}`);
                if (neighbourNode) {
                    neighbourNode.state = "visited";
                    neighbourNode.label = String(alt);
                }
                yield buildFrame(`Relaxed ${current} → ${neighbour}: now ${alt}.`);
                step += 1;
            }
        }

        if (node) {
            node.state = "visited";
        }
        if (hasNegativeCycle) {
            break;
        }
    }

    // Reconstruct and colour the shortest path.
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
            ? "Negative cycle detected via excessive re-enqueues."
            : dist.get(target) === Infinity
              ? `${target} is unreachable from ${start}.`
              : `Shortest path ${start} → ${target}: ${path.join(" → ")} (cost ${dist.get(target)}).`,
        codeLineNumber: 4,
        layout: "graph",
        meta: { negativeCycle: hasNegativeCycle, distance: dist.get(target) ?? Infinity },
    };
}

/** The SPFA module, registered with the engine. */
const module: AlgorithmModule = {
    id: "spfa",
    name: "SPFA",
    category: "shortest-path",
    complexity: { time: "O(V × E)", space: "O(V)" },
    // Same negative-edge graph as Bellman-Ford for comparison.
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
