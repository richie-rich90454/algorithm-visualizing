/**
 * dijkstra-heap.ts – Dijkstra's Algorithm (Binary Heap / O(E log V))
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Dijkstra's algorithm with a binary min-heap (priority queue). The matrix
 * variant scans the whole unsettled set to find the minimum; the heap variant
 * extracts the minimum in O(log V) instead, and each edge relaxation performs
 * a push or decrease-key that costs O(log V). The total drops to O(E log V),
 * which is much better for sparse graphs.
 *
 * The heap holds `(distance, vertex)` entries; a stale entry (one whose
 * distance no longer matches the settled distance) is simply skipped when
 * popped.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(E log V) with a binary heap
 *   Space: O(V + E)
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
 *   - The go-to implementation for sparse graphs.
 *   - Lazy-deletion (skipping stale heap entries) is a common simplification
 *     worth teaching.
 */

import type { AlgorithmModule, VisualEntity, VisualFrame } from "@/types";
import { makeGraphNodes, makeWeightedEdges } from "../graph/graph-util";

/**
 * A tiny binary min-heap keyed by distance. Kept local to the algorithm so the
 * file stays a self-contained teaching resource.
 */
class MinHeap {
    private items: Array<{ dist: number; vertex: string }> = [];

    push(dist: number, vertex: string): void {
        this.items.push({ dist, vertex });
        let i = this.items.length - 1;
        // Bubble up: swap with the parent while this entry is smaller.
        while (i > 0) {
            const parent = Math.floor((i - 1) / 2);
            const parentItem = this.items[parent];
            const current = this.items[i];
            if (!parentItem || !current || parentItem.dist <= current.dist) {
                break;
            }
            this.items[i] = parentItem;
            this.items[parent] = current;
            i = parent;
        }
    }

    pop(): { dist: number; vertex: string } | undefined {
        const top = this.items[0];
        const last = this.items.pop();
        if (last === undefined) {
            return top;
        }
        if (this.items.length > 0) {
            this.items[0] = last;
            // Sift down: swap with the smaller child while out of order.
            let i = 0;
            for (;;) {
                const left = 2 * i + 1;
                const right = 2 * i + 2;
                let smallest = i;
                const leftItem = this.items[left];
                const rightItem = this.items[right];
                const current = this.items[i];
                if (leftItem && current && leftItem.dist < current.dist) {
                    smallest = left;
                }
                const smallestItem = this.items[smallest];
                if (rightItem && smallestItem && rightItem.dist < smallestItem.dist) {
                    smallest = right;
                }
                if (smallest === i) {
                    break;
                }
                const smallestVal = this.items[smallest];
                const iVal = this.items[i];
                if (smallestVal && iVal) {
                    this.items[i] = smallestVal;
                    this.items[smallest] = iVal;
                }
                i = smallest;
            }
        }
        return top;
    }

    get size(): number {
        return this.items.length;
    }
}

/**
 * The Dijkstra (Heap) generator.
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
    const heap = new MinHeap();

    for (const v of vertices) {
        dist.set(v, Infinity);
    }
    dist.set(start, 0);
    heap.push(0, start);

    // Frame 0: the untouched graph.
    yield {
        stepNumber: step,
        entities: nodes.map((n) => ({ ...n })),
        edges: edges.map((e) => ({ ...e })),
        description: `Dijkstra (heap) from ${start} to ${target} – popping the smallest distance.`,
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

        // Lazy deletion: skip stale entries whose distance is out of date.
        if (d !== dist.get(vertex)) {
            continue;
        }
        if (settled.has(vertex)) {
            continue;
        }

        // Settle the vertex – its distance is now final.
        settled.add(vertex);
        settledCount += 1;

        const node = nodeById.get(`node-${vertex}`);
        if (node) {
            node.state = "comparing";
            node.label = String(d);
        }
        yield buildFrame(`Popped ${vertex} (distance ${d}).`);
        step += 1;

        // Relax every outgoing edge, pushing improved distances onto the heap.
        for (const [neighbour, weight] of graph[vertex] ?? []) {
            // Reset all edge states to idle before marking new active edges.
            for (const edge of edges) {
                edge.state = "idle";
            }

            const alt = d + weight;
            if (alt < (dist.get(neighbour) ?? Infinity)) {
                dist.set(neighbour, alt);
                predecessor.set(neighbour, vertex);
                heap.push(alt, neighbour);
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

/** The Dijkstra (Heap) module, registered with the engine. */
const module: AlgorithmModule = {
    id: "dijkstra-heap",
    name: "Dijkstra (Heap)",
    category: "shortest-path",
    complexity: { time: "O(E log V)", space: "O(V + E)" },
    // Same graph as the matrix version for a direct comparison.
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
