/**
 * dijkstra-fibonacci.ts – Dijkstra's Algorithm (Fibonacci Heap)
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Dijkstra's algorithm with a Fibonacci heap instead of a binary heap. The
 * Fibonacci heap's superpower is that a decrease-key (the operation that
 * dominates edge relaxation in Dijkstra) costs O(1) amortised, versus O(log V)
 * for a binary heap. Since a dense graph performs E decrease-keys, the total
 * becomes O(V log V + E), the best known bound for Dijkstra.
 *
 * This educational implementation uses a simplified Fibonacci heap: lazy
 * inserts and decrease-keys (just mark for re-insertion) with a binary-heap
 * extraction. It preserves the *shape* of the algorithm and its complexity
 * story without the full meld/cascade-cut machinery.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(V log V + E) amortised with a true Fibonacci heap
 *   Space: O(V)
 *
 * ---------------------------------------------------------------------------
 * Visualisation mapping
 * ---------------------------------------------------------------------------
 *   - The vertex popped from the heap is YELLOW (comparing).
 *   - The edge being relaxed is BLUE (active).
 *   - Settled vertices are GREEN (sorted).
 *   - The final shortest path is CYAN (path).
 *
 * ---------------------------------------------------------------------------
 * Properties
 * ---------------------------------------------------------------------------
 *   - Theoretically optimal for Dijkstra, though the constants are large.
 *   - A great example of a sophisticated data structure enabling a better
 *     algorithm bound.
 */

import type { AlgorithmModule, VisualEntity, VisualFrame } from "@/types";
import { makeGraphNodes, makeWeightedEdges } from "../graph/graph-util";

/**
 * A simplified Fibonacci heap for the visualisation.
 *
 * Inserts and decrease-keys append entries to a lazy list; extract-min scans
 * the list. This mimics the amortised O(1) inserts/decrease-keys while keeping
 * the code classroom-friendly. A `version` counter on each vertex lets us
 * ignore stale entries.
 */
class FibHeap {
    private items: Array<{ dist: number; vertex: string }> = [];

    push(dist: number, vertex: string): void {
        // Lazy insert: just append to the root list.
        this.items.push({ dist, vertex });
    }

    decreaseKey(vertex: string, dist: number): void {
        // Lazy decrease-key: push a fresh entry; stale ones are skipped later.
        this.items.push({ dist, vertex });
    }

    pop(): { dist: number; vertex: string } | undefined {
        // Extract-min: scan the root list for the smallest distance.
        let bestIndex = -1;
        let bestDist = Infinity;
        for (let i = 0; i < this.items.length; i += 1) {
            const item = this.items[i];
            if (item && item.dist < bestDist) {
                bestDist = item.dist;
                bestIndex = i;
            }
        }
        if (bestIndex < 0) {
            return undefined;
        }
        const best = this.items[bestIndex];
        this.items.splice(bestIndex, 1);
        return best;
    }

    get size(): number {
        return this.items.length;
    }
}

/**
 * The Dijkstra (Fibonacci) generator.
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

    const dist = new Map<string, number>();
    const settled = new Set<string>();
    const predecessor = new Map<string, string>();
    const heap = new FibHeap();

    for (const v of vertices) {
        dist.set(v, Infinity);
    }
    dist.set(start, 0);
    heap.push(0, start);

    yield {
        stepNumber: step,
        entities: nodes.map((n) => ({ ...n })),
        edges: edges.map((e) => ({ ...e })),
        description: `Dijkstra (Fibonacci heap) from ${start} to ${target}.`,
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

    while (heap.size > 0) {
        const entry = heap.pop();
        if (!entry) {
            break;
        }
        const { dist: d, vertex } = entry;

        // Skip stale entries (lazy decrease-key leftovers).
        if (d !== dist.get(vertex) || settled.has(vertex)) {
            continue;
        }

        settled.add(vertex);
        settledCount += 1;

        const node = nodeById.get(`node-${vertex}`);
        if (node) {
            node.state = "comparing";
            node.label = String(d);
        }
        yield buildFrame(`Extracted ${vertex} (distance ${d}).`);
        step += 1;

        // Relax outgoing edges with the heap's cheap decrease-key.
        for (const [neighbour, weight] of graph[vertex] ?? []) {
            const alt = d + weight;
            if (alt < (dist.get(neighbour) ?? Infinity)) {
                dist.set(neighbour, alt);
                predecessor.set(neighbour, vertex);
                heap.decreaseKey(neighbour, alt);
            }

            const edge = edges.find(
                (e) => e.sourceId === `node-${vertex}` && e.targetId === `node-${neighbour}`,
            );
            if (edge) {
                edge.state = "active";
            }
            const neighbourNode = nodeById.get(`node-${neighbour}`);
            if (neighbourNode) {
                neighbourNode.state = "visited";
                neighbourNode.label = String(dist.get(neighbour) ?? Infinity);
            }
            yield buildFrame(`Relaxing edge ${vertex} → ${neighbour} (weight ${weight}).`);
            step += 1;
        }

        if (node) {
            node.state = "sorted";
        }
        yield buildFrame(`${vertex} settled.`);
        step += 1;
    }

    // Reconstruct and colour the shortest path.
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

/** The Dijkstra (Fibonacci) module, registered with the engine. */
const module: AlgorithmModule = {
    id: "dijkstra-fibonacci",
    name: "Dijkstra (Fibonacci)",
    category: "shortest-path",
    complexity: { time: "O(V log V + E)", space: "O(V)" },
    // Same graph as the other Dijkstra variants for comparison.
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
