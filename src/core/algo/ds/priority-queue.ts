/**
 * priority-queue.ts – Priority Queue (binary heap)
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * A priority queue always removes the highest-priority element. Implemented as
 * a binary min-heap, the structure keeps the smallest value at the root.
 * insert() places the new key at the bottom and "bubbles up"; extractMin()
 * takes the root, moves the last leaf up, and "sifts down". Both cost
 * O(log n) thanks to the complete-tree array layout.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Insert / extract-min / peek: O(log n)
 *   Build from n keys:           O(n)
 *
 * ---------------------------------------------------------------------------
 * Visualisation mapping
 * ---------------------------------------------------------------------------
 *   - The heap is drawn as a tree (nodes) and as a backing array.
 *   - The inserted key's bubble-up path is YELLOW (comparing).
 *   - The extracted minimum is GREEN (sorted).
 *
 * ---------------------------------------------------------------------------
 * Properties
 * ---------------------------------------------------------------------------
 *   - The parent ≤ children invariant is the entire concept.
 */

import type { AlgorithmModule, VisualEdge, VisualEntity, VisualFrame } from "@/types";

/**
 * Build a heap tree visualisation.
 *
 * @param heap The heap array (0-indexed).
 * @param highlight Index to highlight (or -1).
 * @returns { nodes, edges } entity pairs.
 */
function buildHeap(heap: number[], highlight = -1): { nodes: VisualEntity[]; edges: VisualEdge[] } {
    const nodes: VisualEntity[] = heap.map((value, index) => ({
        id: `node-${index}`,
        type: "node" as const,
        label: String(value),
        value,
        state: index === highlight ? "comparing" : index === 0 ? "highlight" : "unvisited",
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: {
            parentId: index === 0 ? "root" : String(Math.floor((index - 1) / 2)),
        },
    }));
    const edges: VisualEdge[] = [];
    for (let i = 0; i < heap.length; i += 1) {
        const left = 2 * i + 1;
        const right = 2 * i + 2;
        if (left < heap.length) {
            edges.push({
                id: `edge-${i}-${left}`,
                sourceId: `node-${i}`,
                targetId: `node-${left}`,
                label: "",
                state: "idle",
                directed: false,
            });
        }
        if (right < heap.length) {
            edges.push({
                id: `edge-${i}-${right}`,
                sourceId: `node-${i}`,
                targetId: `node-${right}`,
                label: "",
                state: "idle",
                directed: false,
            });
        }
    }
    return { nodes, edges };
}

/**
 * The Priority Queue generator.
 *
 * @param input `{ inserts, extractCount }`.
 */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { inserts?: number[]; extractCount?: number } | null) ?? {};
    const inserts = task.inserts ?? [5, 3, 8, 1, 9];
    const extractCount = typeof task.extractCount === "number" ? task.extractCount : 2;

    let step = 0;
    const heap: number[] = [];

    // Frame 0: the empty heap.
    yield {
        stepNumber: step,
        entities: [
            {
                id: "node-0",
                type: "node" as const,
                label: "-",
                value: 0,
                state: "unvisited",
                x: 0,
                y: 0,
                width: 0,
                height: 0,
                metadata: { parentId: "root" },
            },
        ],
        edges: [],
        description: "Empty binary min-heap.",
        codeLineNumber: 0,
        layout: "tree",
        meta: { size: 0 },
    };
    step += 1;

    // Insert each value with bubble-up.
    for (const value of inserts) {
        heap.push(value);
        let i = heap.length - 1;
        // Bubble up while smaller than the parent.
        while (i > 0) {
            const parent = Math.floor((i - 1) / 2);
            if ((heap[i] ?? 0) < (heap[parent] ?? 0)) {
                const tmp = heap[i];
                heap[i] = heap[parent] ?? 0;
                heap[parent] = tmp ?? 0;
                i = parent;
            } else {
                break;
            }
        }
        const { nodes, edges } = buildHeap(heap, i);
        yield {
            stepNumber: step,
            entities: nodes.map((n) => ({ ...n })),
            edges: edges.map((e) => ({ ...e })),
            description: `Inserted ${value} and bubbled it up – heap is [${heap.join(", ")}].`,
            codeLineNumber: 2,
            layout: "tree",
            meta: { size: heap.length },
        };
        step += 1;
    }

    // Extract the minimum repeatedly.
    for (let e = 0; e < extractCount && heap.length > 0; e += 1) {
        const min = heap[0];
        const last = heap.pop();
        if (heap.length > 0 && last !== undefined) {
            heap[0] = last;
            // Sift down.
            let i = 0;
            for (;;) {
                const left = 2 * i + 1;
                const right = 2 * i + 2;
                let smallest = i;
                if (left < heap.length && (heap[left] ?? 0) < (heap[smallest] ?? 0)) {
                    smallest = left;
                }
                if (right < heap.length && (heap[right] ?? 0) < (heap[smallest] ?? 0)) {
                    smallest = right;
                }
                if (smallest === i) {
                    break;
                }
                const tmp = heap[i];
                heap[i] = heap[smallest] ?? 0;
                heap[smallest] = tmp ?? 0;
                i = smallest;
            }
        }
        const { nodes, edges } = buildHeap(heap);
        yield {
            stepNumber: step,
            entities: nodes.map((n) => ({ ...n })),
            edges: edges.map((e) => ({ ...e })),
            description: `Extracted the minimum ${min} and sifted the last leaf down.`,
            codeLineNumber: 3,
            layout: "tree",
            meta: { size: heap.length, extracted: min },
        };
        step += 1;
    }
}

/** The Priority Queue module, registered with the engine. */
const module: AlgorithmModule = {
    id: "priority-queue",
    name: "Priority Queue",
    category: "data-structures",
    complexity: { time: "O(log n) ops", space: "O(n)" },
    defaultInput: { inserts: [5, 3, 8, 1, 9], extractCount: 2 },
    visualType: "tree",
    run,
};

export default module;
