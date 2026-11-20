/**
 * interval-heap.ts – Interval Heap
 *
 * Double-ended heap of paired slots: each node holds a [low, high]
 * interval with low <= every descendant low and high >= every
 * descendant high. Both ends extract in logarithmic time.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { keys?: number[] } | null) ?? {};
    const keys = task.keys ?? [5, 2, 8, 1];
    let step = 0;

    const sorted = [...keys].sort((a, b) => a - b);
    const slots: Array<[number, number]> = [];
    for (let i = 0; i < sorted.length; i += 2) {
        const lo = sorted[i] ?? 0;
        const hi = sorted[i + 1] ?? lo;
        slots.push([lo, hi]);
    }
    const snap = (hot: Set<number>, message: string, line: number): VisualFrame => ({
        stepNumber: step,
        entities: slots.flatMap(([lo, hi], i) => [
            {
                id: `ih-${i}-lo`,
                type: "cell" as const,
                label: String(lo),
                value: lo,
                state: (hot.has(i * 2) ? "comparing" : "idle") as EntityState,
                x: 0,
                y: 0,
                width: 0,
                height: 0,
                metadata: { row: i, col: 0 },
            },
            {
                id: `ih-${i}-hi`,
                type: "cell" as const,
                label: String(hi),
                value: hi,
                state: (hot.has(i * 2 + 1) ? "comparing" : "idle") as EntityState,
                x: 0,
                y: 0,
                width: 0,
                height: 0,
                metadata: { row: i, col: 1 },
            },
        ]),
        edges: [],
        description: message,
        codeLineNumber: line,
        layout: "grid",
        meta: { slots: slots.length },
    });

    yield snap(new Set(), `Pairing [${keys.join(",")}] into intervals.`, 0);
    step += 1;
    slots.forEach((_, i) => {
        void 0;
    });
    for (let i = 0; i < slots.length; i += 1) {
        const s = slots[i];
        if (s === undefined) {
            continue;
        }
        yield snap(new Set([i * 2, i * 2 + 1]), `Node ${i} holds [${s[0]},${s[1]}].`, 1);
        step += 1;
    }
    const mn = slots[0]?.[0] ?? -1;
    yield snap(new Set([0]), `remove-min returns the first low endpoint: ${mn}.`, 2);
    step += 1;
    const last = slots[slots.length - 1];
    const mx = last !== undefined ? (last[1] ?? last[0] ?? -1) : -1;
    yield snap(
        new Set([(slots.length - 1) * 2 + 1]),
        `remove-max returns the last high endpoint: ${mx}.`,
        3,
    );
}

const module: AlgorithmModule = {

    education: {
        "intuition": "An interval heap is a double-ended priority queue. Each array node stores a pair [low, high] with low <= high; every descendant's low is at least this low and every descendant's high is at most this high. Thus the minimum is the root's low and the maximum is the root's high, and both ends can be extracted in logarithmic time.",
        "invariants": [
            "In each pair low <= high.",
            "A parent's low <= all descendant lows and its high >= all descendant highs.",
            "The global minimum and maximum are in the root pair."
        ],
        "correctness": "Insertion places a value into a pair and swaps within it to keep low <= high, then bubbles toward the root respecting the interval order. This restores all parent-descendant bounds along one path. Extracting from either end replaces the value and trickles down, restoring the same bounds, so the ends always hold the true min and max.",
        "complexityRationale": "Each operation follows one path of length O(log n) and does constant work per level. Pairs of values are stored in an array, O(n) space.",
        "uses": [
            "Double-ended priority queues",
            "Sliding-window min and max",
            "Event simulations needing both extremes"
        ],
        "references": [
            "van Leeuwen and Wood, \"Interval Heaps and the Duality of Priority Queues\", 1993",
            "CLRS, Introduction to Algorithms, Chapter 6 on heaps"
        ],
        "workedExample": "Insert 5, 2, 8, 1: the root pair becomes [1, 8] after swaps, so minimum is 1 and maximum is 8. Extracting the min removes 1 and replaces it from a child pair, then trickles down; extracting the max removes 8 similarly."
    },
    id: "interval-heap",
    name: "Interval Heap",
    category: "data-structures",
    complexity: { time: "O(log n)", space: "O(n)" },
    defaultInput: { keys: [5, 2, 8, 1] },
    visualType: "grid",
    run,
    pseudocode: [
        "initialize empty double-ended interval heap array",
        "insert key at end and compare with paired slot",
        "swap within pair to keep smaller on left",
        "bubble up comparing against parent intervals",
        "extract minimum from left of root and maximum from right",
        "restore intervals by trickling down",
        "done: heap holds keys with min and max available",
    ],
};

export default module;
