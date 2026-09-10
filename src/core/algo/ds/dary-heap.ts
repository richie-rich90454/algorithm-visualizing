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
 * This demo builds a min-heap via successive inserts (sift-up) and then
 * performs one extract-min (sift-down).
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

/** Build tree nodes for the current heap, optionally highlighting one index. */
function buildNodes(heap: number[], d: number, highlight = -1, sortedRoot = false): VisualEntity[] {
    return heap.map((value, index) => ({
        id: `n-${index}`,
        type: "node" as const,
        label: String(value),
        value,
        state:
            index === highlight ? "comparing" : index === 0 && sortedRoot ? "sorted" : "unvisited",
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { parentId: index === 0 ? "root" : `n-${Math.floor((index - 1) / d)}` },
    }));
}

/** Build d-ary tree edges for a heap of length n. */
function buildEdges(n: number, d: number): VisualEdge[] {
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
    return edges;
}

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

    // Degenerate inputs get honest frames.
    if (d < 2) {
        yield {
            stepNumber: step,
            entities: buildNodes(values.length > 0 ? values : [0], 2),
            edges: buildEdges(values.length > 0 ? values.length : 1, 2),
            description: `Degenerate degree d = ${d} – need d ≥ 2 for a ${d}-ary heap.`,
            codeLineNumber: 0,
            layout: "tree",
            meta: { size: values.length, degree: d },
        };
        return;
    }
    if (values.length === 0) {
        yield {
            stepNumber: step,
            entities: buildNodes([0], d),
            edges: [],
            description: `Empty input – nothing to heapify.`,
            codeLineNumber: 0,
            layout: "tree",
            meta: { size: 0, degree: d },
        };
        return;
    }

    // Build a min-heap via successive inserts with sift-up.
    const heap: number[] = [];
    for (const v of values) {
        heap.push(v);
        let i = heap.length - 1;
        while (i > 0) {
            const parent = Math.floor((i - 1) / d);
            if ((heap[i] ?? 0) < (heap[parent] ?? 0)) {
                const tmp = heap[i] ?? 0;
                heap[i] = heap[parent] ?? 0;
                heap[parent] = tmp;
                i = parent;
            } else {
                break;
            }
        }
        yield {
            stepNumber: step,
            entities: buildNodes(heap, d, i),
            edges: buildEdges(heap.length, d),
            description:
                heap.length === 1
                    ? `Insert ${v} into the empty ${d}-ary min-heap – heap [${heap.join(", ")}].`
                    : `Insert ${v}: sifted up to index ${i} – heap [${heap.join(", ")}].`,
            codeLineNumber: heap.length === 1 ? 0 : 1,
            layout: "tree",
            meta: { size: heap.length, degree: d },
        };
        step += 1;
    }

    // One extract-min: highlight the min, then remove it and sift down.
    const min = heap[0] ?? 0;
    yield {
        stepNumber: step,
        entities: buildNodes(heap, d, 0),
        edges: buildEdges(heap.length, d),
        description: `Extract-min: root ${min} is the minimum of [${heap.join(", ")}].`,
        codeLineNumber: 2,
        layout: "tree",
        meta: { size: heap.length, degree: d },
    };
    step += 1;

    const last = heap.pop() ?? 0;
    if (heap.length > 0) {
        heap[0] = last;
        let i = 0;
        for (;;) {
            let smallest = i;
            for (let c = 1; c <= d; c += 1) {
                const child = d * i + c;
                if (child < heap.length && (heap[child] ?? 0) < (heap[smallest] ?? 0)) {
                    smallest = child;
                }
            }
            if (smallest === i) {
                break;
            }
            const tmp = heap[i] ?? 0;
            heap[i] = heap[smallest] ?? 0;
            heap[smallest] = tmp;
            i = smallest;
        }
    }

    if (heap.length === 0) {
        yield {
            stepNumber: step,
            entities: buildNodes([min], d, -1, true),
            edges: [],
            description: `Extracted min ${min} – the heap is now empty.`,
            codeLineNumber: 3,
            layout: "tree",
            meta: { size: 0, degree: d, extractedMin: min },
        };
        return;
    }

    yield {
        stepNumber: step,
        entities: buildNodes(heap, d, -1, true),
        edges: buildEdges(heap.length, d),
        description: `Extracted min ${min} – sifted down to [${heap.join(", ")}], a valid ${d}-ary min-heap.`,
        codeLineNumber: 3,
        layout: "tree",
        meta: { size: heap.length, degree: d, extractedMin: min },
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
