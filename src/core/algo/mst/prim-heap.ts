/**
 * prim-heap.ts – Prim's Algorithm (Binary Heap / O(E log V))
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Prim's algorithm with a binary min-heap. The matrix variant scans for the
 * cheapest frontier edge; the heap variant extracts it in O(log V) and pushes
 * candidate frontier edges in O(log V) each. For sparse graphs this drops the
 * running time to O(E log V).
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(E log V) with a binary heap
 *   Space: O(V + E)
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - The vertex popped from the heap is YELLOW (comparing).
 *   - The edge that joins the tree is CYAN (path).
 *   - Tree vertices are GREEN (sorted).
 *
 * ---------------------------------------------------------------------------
 * Properties
 * ---------------------------------------------------------------------------
 *   - The sparse-graph counterpart of the O(V²) matrix variant.
 *   - Same greedy idea, different data structure.
 */

import type { AlgorithmModule, VisualEdge, VisualEntity, VisualFrame } from "@/types";
import { makeGraphNodes } from "../graph/graph-util";

/**
 * A tiny binary min-heap keyed by edge weight, kept local for teaching.
 */
class MinHeap {
    private items: Array<{ weight: number; vertex: string }> = [];

    push(weight: number, vertex: string): void {
        this.items.push({ weight, vertex });
        let i = this.items.length - 1;
        while (i > 0) {
            const parent = Math.floor((i - 1) / 2);
            const parentItem = this.items[parent];
            const current = this.items[i];
            if (!parentItem || !current || parentItem.weight <= current.weight) {
                break;
            }
            this.items[i] = parentItem;
            this.items[parent] = current;
            i = parent;
        }
    }

    pop(): { weight: number; vertex: string } | undefined {
        const top = this.items[0];
        const last = this.items.pop();
        if (last === undefined) {
            return top;
        }
        if (this.items.length > 0) {
            this.items[0] = last;
            let i = 0;
            for (;;) {
                const left = 2 * i + 1;
                const right = 2 * i + 2;
                let smallest = i;
                const leftItem = this.items[left];
                const rightItem = this.items[right];
                const current = this.items[i];
                if (leftItem && current && leftItem.weight < current.weight) {
                    smallest = left;
                }
                const smallestItem = this.items[smallest];
                if (rightItem && smallestItem && rightItem.weight < smallestItem.weight) {
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
 * The Prim (Heap) generator.
 *
 * @param input `{ edges, vertices, start? }` – an undirected weighted edge list.
 */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task =
        (input as {
            edges?: Array<[string, string, number]>;
            vertices?: string[];
            start?: string;
        } | null) ?? {};
    const vertices = task.vertices ?? ["A", "B", "C", "D", "E", "F"];
    const edgeList: Array<[string, string, number]> = task.edges ?? [
        ["A", "B", 4],
        ["A", "C", 2],
        ["B", "C", 1],
        ["B", "D", 5],
        ["C", "D", 8],
        ["C", "E", 10],
        ["D", "E", 2],
        ["D", "F", 6],
        ["E", "F", 3],
    ];
    const start = task.start ?? "A";

    const nodes = makeGraphNodes(vertices);
    const nodeById = new Map(nodes.map((n) => [n.id, n]));

    // Neighbor map: vertex → list of (neighbor, weight).
    const neighbors = new Map<string, Array<[string, number]>>();
    for (const v of vertices) {
        neighbors.set(v, []);
    }
    edgeList.forEach(([a, b, weight]) => {
        neighbors.get(a)?.push([b, weight]);
        neighbors.get(b)?.push([a, weight]);
    });

    // Edge lookup for coloring.
    const edgesByPair = new Map<string, VisualEdge>();
    edgeList.forEach(([a, b, weight], index) => {
        edgesByPair.set([a, b].sort().join("-"), {
            id: `edge-${index}`,
            sourceId: `node-${a}`,
            targetId: `node-${b}`,
            label: String(weight),
            state: "idle",
            directed: false,
        });
    });
    const edges = [...edgesByPair.values()];

    let step = 0;
    const inTree = new Set<string>();
    const parent = new Map<string, string | null>();
    const best = new Map<string, number>();
    const heap = new MinHeap();

    inTree.add(start);
    heap.push(0, start);

    // Frame 0: the untouched graph.
    yield {
        stepNumber: step,
        entities: nodes.map((n) => ({ ...n })),
        edges: edges.map((e) => ({ ...e })),
        description: `Prim's algorithm (heap) starting from ${start}.`,
        codeLineNumber: 0,
        layout: "graph",
        meta: { inTree: inTree.size },
    };
    step += 1;

    // Preload the frontier: all edges from the start vertex.
    for (const [neighbor, weight] of neighbors.get(start) ?? []) {
        if (weight < (best.get(neighbor) ?? Infinity)) {
            best.set(neighbor, weight);
            parent.set(neighbor, start);
            heap.push(weight, neighbor);
        }
    }

    while (inTree.size < vertices.length && heap.size > 0) {
        // Pop the cheapest frontier edge.
        const entry = heap.pop();
        if (!entry) {
            break;
        }
        const { weight, vertex } = entry;

        // Skip vertices already in the tree (stale heap entries).
        if (inTree.has(vertex)) {
            continue;
        }

        // Add the vertex and its joining edge to the tree.
        inTree.add(vertex);
        const parentVertex = parent.get(vertex);
        if (parentVertex) {
            const edge = edgesByPair.get([parentVertex, vertex].sort().join("-"));
            if (edge) {
                edge.state = "path";
            }
        }

        const node = nodeById.get(`node-${vertex}`);
        if (node) {
            node.state = "comparing";
        }
        yield {
            stepNumber: step,
            entities: nodes.map((n) => ({ ...n })),
            edges: edges.map((e) => ({ ...e })),
            description: `Popped cheapest frontier edge (weight ${weight}) – added ${vertex} to the tree.`,
            codeLineNumber: 2,
            layout: "graph",
            meta: { inTree: inTree.size },
        };
        step += 1;

        // Relax the frontier: keep each outside neighbor's cheapest edge.
        for (const [neighbor, w] of neighbors.get(vertex) ?? []) {
            if (!inTree.has(neighbor) && w < (best.get(neighbor) ?? Infinity)) {
                best.set(neighbor, w);
                parent.set(neighbor, vertex);
                heap.push(w, neighbor);
            }
        }

        if (node) {
            node.state = "sorted";
        }
        yield {
            stepNumber: step,
            entities: nodes.map((n) => ({ ...n })),
            edges: edges.map((e) => ({ ...e })),
            description: `Pushed new frontier edges around ${vertex}.`,
            codeLineNumber: 3,
            layout: "graph",
            meta: { inTree: inTree.size },
        };
        step += 1;
    }

    // Total MST weight.
    const totalWeight = [...edgesByPair.values()]
        .filter((e) => e.state === "path")
        .reduce((sum, e) => sum + Number(e.label), 0);

    yield {
        stepNumber: step,
        entities: nodes.map((n) => ({ ...n })),
        edges: edges.map((e) => ({ ...e })),
        description: `Minimum spanning tree complete – ${inTree.size} vertices, total weight ${totalWeight}.`,
        codeLineNumber: 4,
        layout: "graph",
        meta: { inTree: inTree.size, totalWeight },
    };
}

/** The Prim (Heap) module, registered with the engine. */
const module: AlgorithmModule = {
    id: "prim-heap",
    name: "Prim's MST (Heap)",
    category: "mst",
    complexity: { time: "O(E log V)", space: "O(V + E)" },
    // Same graph as the other MST algorithms for comparison.
    defaultInput: {
        edges: [
            ["A", "B", 4],
            ["A", "C", 2],
            ["B", "C", 1],
            ["B", "D", 5],
            ["C", "D", 8],
            ["C", "E", 10],
            ["D", "E", 2],
            ["D", "F", 6],
            ["E", "F", 3],
        ],
        vertices: ["A", "B", "C", "D", "E", "F"],
        start: "A",
    },
    visualType: "graph",
    run,
};

export default module;
