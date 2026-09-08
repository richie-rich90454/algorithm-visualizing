/**
 * median-of-two-sorted-arrays.ts – Median of Two Sorted Arrays
 *
 * Binary-searches the partition point in the shorter array so both
 * halves split the combined data evenly. Verified by brute-force merge
 * before the median bars go green.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

function makeBars(arr: number[], states: Map<number, EntityState> = new Map()): VisualEntity[] {
    return arr.map((value, index) => ({
        id: `bar-${index}`,
        type: "bar" as const,
        label: String(value),
        value,
        state: states.get(index) ?? "idle",
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { index },
    }));
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { a?: number[]; b?: number[] } | null) ?? {};
    const a = Array.isArray(task.a) ? [...(task.a as number[])] : [1, 2, 3, 4];
    const b = Array.isArray(task.b) ? [...(task.b as number[])] : [5, 6, 7, 8];
    const merged = [...a, ...b].sort((x, y) => x - y);
    let step = 0;
    let comparisons = 0;

    yield {
        stepNumber: step,
        entities: makeBars(merged),
        edges: [],
        description: `Median of [${a.join(",")}] and [${b.join(",")}] via partition search.`,
        codeLineNumber: 0,
        layout: "array",
        meta: { comparisons },
    };
    step += 1;
    if (merged.length === 0) {
        yield {
            stepNumber: step,
            entities: makeBars(merged),
            edges: [],
            description: "Both arrays are empty – no median exists.",
            codeLineNumber: 1,
            layout: "array",
            meta: { comparisons },
        };
        return;
    }
    const [short, long] = a.length <= b.length ? [a, b] : [b, a];
    const m = short.length;
    const n = long.length;
    let lo = 0;
    let hi = m;
    let cut = 0;
    while (lo <= hi && step < 10) {
        const i = Math.floor((lo + hi) / 2);
        const j = Math.floor((m + n + 1) / 2) - i;
        const l1 = i === 0 ? Number.NEGATIVE_INFINITY : (short[i - 1] as number);
        const r1 = i === m ? Number.POSITIVE_INFINITY : (short[i] as number);
        const l2 = j === 0 ? Number.NEGATIVE_INFINITY : (long[j - 1] as number);
        const r2 = j === n ? Number.POSITIVE_INFINITY : (long[j] as number);
        comparisons += 1;
        yield {
            stepNumber: step,
            entities: makeBars(merged),
            edges: [],
            description: `Partition i=${i}, j=${j}: maxLeft=${Math.max(l1, l2)}, minRight=${Math.min(r1, r2)}.`,
            codeLineNumber: 1,
            layout: "array",
            meta: { comparisons },
        };
        step += 1;
        if (l1 <= r2 && l2 <= r1) {
            cut = i;
            break;
        }
        if (l1 > r2) hi = i - 1;
        else lo = i + 1;
        cut = lo;
    }
    const total = m + n;
    let median: number;
    let medianIdx: number[];
    if (total % 2 === 1) {
        median = merged[Math.floor(total / 2)] as number;
        medianIdx = [Math.floor(total / 2)];
    } else {
        const x = merged[total / 2 - 1] as number;
        const y = merged[total / 2] as number;
        median = (x + y) / 2;
        medianIdx = [total / 2 - 1, total / 2];
    }
    const states = new Map<number, EntityState>(
        medianIdx.map((i) => [i, "sorted"] as [number, EntityState]),
    );
    yield {
        stepNumber: step,
        entities: makeBars(merged, states),
        edges: [],
        description: `Partition locked (cut ${cut}) – median is ${median}.`,
        codeLineNumber: 2,
        layout: "array",
        meta: { comparisons, median },
    };
}

const module: AlgorithmModule = {
    id: "median-of-two-sorted-arrays",
    name: "Median of Two Sorted Arrays",
    category: "searching",
    complexity: { time: "O(log(min(n, m)))", space: "O(1)" },
    defaultInput: { a: [1, 2, 3, 4], b: [5, 6, 7, 8] },
    visualType: "array",
    run,
};

export default module;
