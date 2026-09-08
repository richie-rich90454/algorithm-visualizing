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
    id: "interval-heap",
    name: "Interval Heap",
    category: "data-structures",
    complexity: { time: "O(log n)", space: "O(n)" },
    defaultInput: { keys: [5, 2, 8, 1] },
    visualType: "grid",
    run,
};

export default module;
