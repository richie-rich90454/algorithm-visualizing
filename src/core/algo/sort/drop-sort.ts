/**
 * drop-sort.ts - Drop Sort (also called dropsort).
 *
 * A deliberately simple one-pass sort: walk the input once and keep an element
 * only when it is at least as large as the last element kept. Every discarded
 * element is smaller than its kept predecessor, so the surviving elements form
 * a nondecreasing subsequence. It is a real (if weak) sorting method: the
 * output is always sorted, but most inputs lose data.
 *
 * Time O(n), space O(n) for the reported output.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

function makeBars(values: number[], states: Map<number, EntityState> = new Map()): VisualEntity[] {
    return values.map((value, index) => ({
        id: `bar-${index}`,
        type: "bar" as const,
        label: `${value}`,
        value,
        state: states.get(index) ?? "idle",
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { index, value },
    }));
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { values?: number[] } | null) ?? {};
    const values = task.values ?? [3, 1, 4, 1, 5, 9, 2, 6, 5];

    let step = 0;
    const kept: number[] = [];
    const dropped: number[] = [];
    const keptIndices = new Set<number>();

    const frame = (
        states: Map<number, EntityState>,
        description: string,
        codeLineNumber: number,
        extra: Record<string, number | string | boolean | null> = {},
    ): VisualFrame => ({
        stepNumber: step,
        entities: makeBars(values, states),
        edges: [],
        description,
        codeLineNumber,
        layout: "array",
        meta: {
            kept: [...kept],
            dropped: [...dropped],
            keptCount: kept.length,
            droppedCount: dropped.length,
            ...extra,
        },
    });

    yield frame(new Map(), `Drop Sort on ${values.length} values: keep one nondecreasing subsequence.`, 0);
    step += 1;

    for (let i = 0; i < values.length; i += 1) {
        const value = values[i] as number;
        const last = kept.length > 0 ? (kept[kept.length - 1] as number) : null;
        const keep = last === null || value >= last;

        const states = new Map<number, EntityState>();
        for (const k of keptIndices) {
            states.set(k, "sorted");
        }
        for (let d = 0; d < i; d += 1) {
            if (!keptIndices.has(d)) {
                states.set(d, "error");
            }
        }
        states.set(i, "comparing");

        const reason = keep
            ? `keep, at least the last kept value ${last === null ? "none yet" : last}`
            : `drop, below the last kept value ${last}`;
        yield frame(states, `Index ${i} value ${value}: ${reason}.`, keep ? 2 : 3, {
            last,
            keep,
        });
        step += 1;

        if (keep) {
            kept.push(value);
            keptIndices.add(i);
        } else {
            dropped.push(value);
        }
    }

    const finalStates = new Map<number, EntityState>();
    for (let i = 0; i < values.length; i += 1) {
        finalStates.set(i, keptIndices.has(i) ? "sorted" : "error");
    }
    yield frame(
        finalStates,
        `Done: kept ${kept.length} value(s) [${kept.join(", ")}] in sorted order; dropped ${dropped.length}.`,
        4,
    );
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Drop Sort scans the input once, keeping an element only when it is at least as large as the last element it kept. Anything smaller is thrown away. The elements that survive are already in sorted order because the scan never keeps a value that would break the nondecreasing run.",
        invariants: [
            "The kept list is always nondecreasing from left to right.",
            "Every kept element appears in the original input at the same relative order.",
            "A dropped element is strictly smaller than the kept element immediately before it.",
        ],
        correctness:
            "Maintain that the kept sequence is nondecreasing. Initially it is empty. When a value is appended it is required to be at least the previous last value, so the property is preserved; otherwise it is discarded and the sequence is untouched. Therefore the final output is sorted. It is a subsequence of the input by construction, although many elements may be lost.",
        complexityRationale:
            "Each input value is examined exactly once with constant work, giving O(n) time. The kept and dropped output lists hold at most n values, so auxiliary space is O(n).",
        uses: [
            "A teaching counter-example showing that a sorted output need not preserve all input",
            "A simple streaming filter that extracts a single nondecreasing pass",
            "A baseline for discussing online algorithms that never reconsider a decision",
        ],
        references: [
            "Wikipedia, Drop sort (dropsort), overview article",
            "Knuth, The Art of Computer Programming, Vol. 3, sorting fundamentals",
        ],
        workedExample:
            "For [3, 1, 4, 1, 5, 9, 2, 6, 5], keep 3, drop 1, keep 4, drop 1, keep 5, keep 9, drop 2, drop 6, drop 5. The output [3, 4, 5, 9] is sorted, but five values were discarded.",
    },
    id: "drop-sort",
    name: "Drop Sort",
    category: "sorting",
    complexity: { time: "O(n)", space: "O(n)" },
    defaultInput: { values: [3, 1, 4, 1, 5, 9, 2, 6, 5] },
    visualType: "array",
    run,
    pseudocode: [
        "start with an empty kept list and an empty dropped list",
        "for each value in the input from left to right",
        "if the kept list is empty or value is at least its last element, append value",
        "otherwise append value to the dropped list",
        "done: the kept list is a sorted subsequence of the input",
    ],
};

export default module;
