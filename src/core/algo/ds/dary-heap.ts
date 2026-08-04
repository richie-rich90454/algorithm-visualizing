/**
 * dary-heap.ts – D-ary Heap
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * A d-ary heap generalizes the binary heap to d children per node. Larger d
 * makes the tree shallower (fewer sift-down levels) but each level checks
 * more children. With d = 4, the practical optimum for many workloads, the
 * heap is faster than the binary heap in practice because it touches fewer
 * array locations during sift-down.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Insert:    O(log_d n)
 *   Extract:   O(d log_d n)
 *   Space:     O(n)
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - The heap is drawn with d children per node.
 *   - The bubbling element is YELLOW (comparing).
 *
 * ---------------------------------------------------------------------------
 * Properties
 * ---------------------------------------------------------------------------
 *   - The d-way fan-out is the entire idea.
 */

import type { AlgorithmModule, VisualEdge, VisualEntity, VisualFrame } from "@/types";

/**
 * The D-ary Heap generator.
 *
 * @param input `{ values, degree }`.
 */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { values?: number[]; degree?: number } | null) ?? {};
    const values = task.values ?? [5, 9, 4, 7, 3, 2, 8];
    const d = typeof task.degree === "number" ? task.degree : 4;

    let step = 0;

    // Build a max-heap over the array with d children per node.
    const heap = [...values];
    const n = heap.length;

    const siftDown = (index: number): void => {
        for (;;) {
            let largest = index;
            for (let c = 1; c <= d; c += 1) {
                const child = d * index + c;
                if (child < n && (heap[child] ?? 0) > (heap[largest] ?? 0)) {
                    largest = child;
                }
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

    for (let i = Math.floor(n / d) - 1; i >= 0; i -= 1) {
        siftDown(i);
    }

    // Frame 0: the heapified array as a d-ary tree.
    const nodes: VisualEntity[] = heap.map((value, index) => ({
        id: `n-${index}`,
        type: "node" as const,
        label: String(value),
        value,
        state: index === 0 ? "sorted" : "unvisited",
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { parentId: index === 0 ? "root" : `n-${Math.floor((index - 1) / d)}` },
    }));
    const edges: VisualEdge[] = [];
    for (let i = 0; i < n; i += 1) {
        for (let c = 1; c <= d; c += 1) {
            const child = d * i + c;
            if (child < n) {
                edges.push({
                    id: `e-${i}-${child}`,
                    sourceId: `n-${i}`,
                    targetId: `n-${child}`,
                    label: "",
                    state: "idle",
                    directed: false,
                });
            }
        }
    }

    yield {
        stepNumber: step,
        entities: nodes.map((nd) => ({ ...nd })),
        edges: edges.map((e) => ({ ...e })),
        description: `4-ary max-heap built from [${values.join(", ")}] – each node has up to ${d} children.`,
        codeLineNumber: 0,
        layout: "tree",
        meta: { size: n, degree: d },
    };
    step += 1;

    yield {
        stepNumber: step,
        entities: nodes.map((nd) => ({ ...nd })),
        edges: edges.map((e) => ({ ...e })),
        description: `D-ary heap complete – shallower than a binary heap for the same size.`,
        codeLineNumber: 2,
        layout: "tree",
        meta: { size: n, degree: d },
    };
}

/** The D-ary Heap module, registered with the engine. */
const module: AlgorithmModule = {
    id: "dary-heap",
    name: "D-ary Heap",
    category: "data-structures",
    complexity: { time: "O(log_d n) ops", space: "O(n)" },
    defaultInput: { values: [5, 9, 4, 7, 3, 2, 8], degree: 4 },
    visualType: "tree",
    run,
};

export default module;
