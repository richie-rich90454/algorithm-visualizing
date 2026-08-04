/**
 * binary-heap.ts – Binary Heap (max-heap)
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * A binary heap is a complete binary tree stored in a flat array where every
 * parent is ≥ its children (max-heap) or ≤ (min-heap). Children of index i
 * are 2i+1 and 2i+2; the parent of i is ⌊(i−1)/2⌋. Because the tree is
 * complete, the array layout wastes no space and gives O(log n) insert and
 * extract-max.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Insert / extract: O(log n)
 *   Peek:             O(1)
 *   Space:            O(n)
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - The heap is drawn as a tree AND as a flat array.
 *   - The bubbling element is YELLOW (comparing).
 *
 * ---------------------------------------------------------------------------
 * Properties
 * ---------------------------------------------------------------------------
 *   - The parent-≥-children invariant is the entire concept.
 */

import type { AlgorithmModule, VisualEdge, VisualEntity, VisualFrame } from "@/types";

/**
 * Build a max-heap tree visualization.
 *
 * @param heap The heap array.
 * @param highlight Index to highlight (or -1).
 * @returns { nodes, edges } entity pairs.
 */
function buildHeap(heap: number[], highlight = -1): { nodes: VisualEntity[]; edges: VisualEdge[] } {
    const nodes: VisualEntity[] = heap.map((value, index) => ({
        id: `node-${index}`,
        type: "node" as const,
        label: String(value),
        value,
        state: index === highlight ? "comparing" : "unvisited",
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { parentId: index === 0 ? "root" : String(Math.floor((index - 1) / 2)) },
    }));
    const edges: VisualEdge[] = [];
    for (let i = 0; i < heap.length; i += 1) {
        for (const child of [2 * i + 1, 2 * i + 2]) {
            if (child < heap.length) {
                edges.push({
                    id: `edge-${i}-${child}`,
                    sourceId: `node-${i}`,
                    targetId: `node-${child}`,
                    label: "",
                    state: "idle",
                    directed: false,
                });
            }
        }
    }
    return { nodes, edges };
}

/**
 * The Binary Heap generator.
 *
 * @param input `{ values }` – values to heapify.
 */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { values?: number[] } | null) ?? {};
    const values = task.values ?? [5, 9, 4, 7, 3, 2];

    let step = 0;

    // Frame 0: the raw array.
    yield {
        stepNumber: step,
        entities: values.map((value, index) => ({
            id: `cell-${index}`,
            type: "cell" as const,
            label: String(value),
            value,
            state: "unvisited",
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: { row: 0, col: index },
        })),
        edges: [],
        description: `Raw array [${values.join(", ")}] – heapify into a max-heap.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: { size: values.length },
    };
    step += 1;

    // Build the heap via sift-down (heapify).
    const heap = [...values];
    const n = heap.length;

    const siftDown = (index: number): void => {
        for (;;) {
            const left = 2 * index + 1;
            const right = 2 * index + 2;
            let largest = index;
            if (left < n && (heap[left] ?? 0) > (heap[largest] ?? 0)) {
                largest = left;
            }
            if (right < n && (heap[right] ?? 0) > (heap[largest] ?? 0)) {
                largest = right;
            }
            if (largest === index) {
                break;
            }
            const tmp = heap[index];
            heap[index] = heap[largest] ?? 0;
            heap[largest] = tmp ?? 0;
            index = largest;
        }
    };

    for (let i = Math.floor(n / 2) - 1; i >= 0; i -= 1) {
        siftDown(i);
        const { nodes, edges } = buildHeap(heap);
        yield {
            stepNumber: step,
            entities: nodes.map((nd) => ({ ...nd })),
            edges: edges.map((e) => ({ ...e })),
            description: `Sifted subtree rooted at index ${i} – heap is [${heap.join(", ")}].`,
            codeLineNumber: 2,
            layout: "tree",
            meta: { size: values.length },
        };
        step += 1;
    }

    yield {
        stepNumber: step,
        entities: values.map((value, index) => ({
            id: `cell-${index}`,
            type: "cell" as const,
            label: String(heap[index] ?? 0),
            value: heap[index] ?? 0,
            state: "sorted",
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: { row: 0, col: index },
        })),
        edges: [],
        description: `Max-heap array: [${heap.join(", ")}] – the root is the maximum.`,
        codeLineNumber: 3,
        layout: "grid",
        meta: { size: values.length },
    };
}

/** The Binary Heap module, registered with the engine. */
const module: AlgorithmModule = {
    id: "binary-heap",
    name: "Binary Heap",
    category: "data-structures",
    complexity: { time: "O(log n) ops", space: "O(n)" },
    defaultInput: { values: [5, 9, 4, 7, 3, 2] },
    visualType: "tree",
    run,
};

export default module;
