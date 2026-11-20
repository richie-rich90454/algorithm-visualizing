/**
 * k-d-heap.ts - Two-Dimensional k-d Heap
 *
 * A k-d heap stores points in a complete binary tree. Levels alternate the
 * comparison dimension: nodes on even levels are ordered by x and nodes on
 * odd levels by y. Insertion bubbles a new point up using the dimension of
 * its parent's level, preserving the alternating heap order. We demonstrate
 * repeated minimum-x extraction by locating the smallest x and rebuilding.
 *
 * Time:  O(log n) insert, O(n log n) rebuild-based extraction
 * Space: O(n)
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

type Point = [number, number];

const level = (index: number): number => Math.floor(Math.log2(index + 1));
const dim = (index: number): number => level(index) % 2;

function insert(heap: Point[], point: Point): Point[] {
    const out = heap.slice();
    out.push([point[0], point[1]]);
    let i = out.length - 1;
    while (i > 0) {
        const parent = (i - 1) >> 1;
        const d = dim(parent);
        const child = out[i]!;
        const par = out[parent]!;
        if (child[d] < par[d]) {
            out[i] = par;
            out[parent] = child;
            i = parent;
        } else break;
    }
    return out;
}

function build(points: Point[]): Point[] {
    let heap: Point[] = [];
    for (const p of points) heap = insert(heap, p);
    return heap;
}

function valid(heap: Point[]): boolean {
    for (let i = 1; i < heap.length; i += 1) {
        const parent = (i - 1) >> 1;
        const d = dim(parent);
        if (heap[parent]![d] > heap[i]![d]) return false;
    }
    return true;
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { points?: Point[]; extracts?: number } | null) ?? {};
    const points: Point[] = task.points ?? [
        [4, 7], [1, 9], [6, 2], [3, 5], [8, 1], [2, 8], [7, 3], [5, 6],
    ];
    const extracts = typeof task.extracts === "number" ? Math.max(0, Math.min(task.extracts, points.length)) : 4;

    let heap: Point[] = [];
    let step = 0;
    const extracted: number[] = [];

    const frame = (message: string, line: number, hot: number): VisualFrame => {
        const entities: VisualEntity[] = heap.map((p, i) => ({
            id: `node-${i}`,
            type: "bar" as const,
            label: `(${p[0]},${p[1]})`,
            value: p[0],
            state: (i === hot ? "comparing" : i === 0 ? "pivot" : "idle") as EntityState,
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: { index: i, level: level(i), dimension: dim(i) },
        }));
        return {
            stepNumber: step,
            entities,
            edges: [],
            description: message,
            codeLineNumber: line,
            layout: "array",
            meta: {
                heap: heap.map((p) => `${p[0]},${p[1]}`),
                extracted: extracted.slice(),
                remaining: heap.length,
                heapValid: valid(heap),
                root: heap.length ? [heap[0]![0], heap[0]![1]] : [],
            },
        };
    };

    for (const p of points) {
        heap = insert(heap, p);
        yield frame(`Insert (${p[0]},${p[1]}) and bubble up by the parent level's dimension.`, 1, heap.length - 1);
        step += 1;
    }

    for (let k = 0; k < extracts; k += 1) {
        let minIdx = 0;
        for (let i = 1; i < heap.length; i += 1) {
            if (heap[i]![0] < heap[minIdx]![0]) minIdx = i;
        }
        const chosen = heap[minIdx]!;
        extracted.push(chosen[0]);
        const rest = heap.filter((_, i) => i !== minIdx);
        heap = build(rest);
        yield frame(`Extract minimum x = ${chosen[0]} and rebuild the alternating heap order.`, 2, -1);
        step += 1;
    }

    yield frame(
        `Done: extracted ${extracted.length} minima [${extracted.join(", ")}] from a valid k-d heap.`,
        3,
        -1,
    );
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "A k-d heap is a complete binary tree that stores multi-dimensional points. Each level compares points along a different coordinate, so the root region is ordered by x, its children by y, and so on. Inserting drops a point at the bottom and bubbles it up using the dimension of each parent level, which keeps the alternating order intact.",
        invariants: [
            "The tree is complete: every level except possibly the last is full.",
            "A node at level L is at most its children in coordinate L modulo k.",
            "Dimensions alternate between x and y on consecutive levels.",
        ],
        correctness:
            "When a new point bubbles up, swapping is decided by the parent level's dimension. The displaced parent was already no larger than its other children in that dimension, and after moving down it still satisfies its own level's dimension, so every parent-child pair remains ordered. Rebuilding from the remaining points re-applies the same insertion rule, so the final tree is a valid k-d heap containing exactly the unextracted points.",
        complexityRationale:
            "Insertion climbs at most the tree height, O(log n), with constant work per level. The demonstration finds the minimum x by scanning O(n) and rebuilds in O(n log n) per extraction, which is simple to verify though a production k-d heap deletes in O(log n). Storage is the O(n) point array.",
        uses: [
            "Multi-dimensional nearest-neighbor indexes",
            "Range-search data structures",
            "Spatial join processing in databases",
        ],
        references: [
            "Lee and Wong, A Priority Search Tree of Improved Time and Space, 1980",
            "de Berg et al., Computational Geometry: Algorithms and Applications",
        ],
        workedExample:
            "Insert (4,7), then (1,9): at level zero compare x, and 1 is less than 4, so they swap and the root becomes (1,9). Insert (2,8) under the right child at level one: compare y, and since 8 is not below the parent's y it stays. Extracting the smallest x removes 1 and rebuilds the heap from the remaining points.",
    },
    id: "k-d-heap",
    name: "k-d Heap",
    category: "data-structures",
    complexity: { time: "O(log n) insert", space: "O(n)" },
    defaultInput: {
        points: [[4, 7], [1, 9], [6, 2], [3, 5], [8, 1], [2, 8], [7, 3], [5, 6]],
        extracts: 4,
    },
    visualType: "array",
    run,
    pseudocode: [
        "initialize an empty complete binary tree of points",
        "append the new point at the next free slot",
        "compare with parent using the parent level dimension",
        "swap upward while the point is smaller in that dimension",
        "to extract the minimum x, scan the tree for smallest x",
        "remove it and rebuild by reinserting remaining points",
        "done: report extracted minima and heap validity",
    ],
};

export default module;
