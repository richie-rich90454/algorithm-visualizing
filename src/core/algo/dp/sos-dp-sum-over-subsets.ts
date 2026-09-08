/**
 * SOS DP: F[mask] = sum of a[sub] over sub ⊆ mask, one bit at a time.
 * Time O(n*2^n), Space O(2^n). Default [1..8]: F[7] = 36.
 */
import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

function makeCells(
    matrix: number[][],
    states: Map<string, EntityState> = new Map(),
): VisualEntity[] {
    const cells: VisualEntity[] = [];
    for (let row = 0; row < matrix.length; row += 1) {
        const r = matrix[row];
        if (!r) continue;
        for (let col = 0; col < r.length; col += 1) {
            const value = r[col];
            if (value === undefined) continue;
            cells.push({
                id: `cell-${row}-${col}`,
                type: "cell" as const,
                label: String(value),
                value,
                state: states.get(`${row},${col}`) ?? "idle",
                x: 0,
                y: 0,
                width: 0,
                height: 0,
                metadata: { row, col },
            });
        }
    }
    return cells;
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { arr?: number[] } | null) ?? {};
    const arr = task.arr ?? [1, 2, 3, 4, 5, 6, 7, 8];
    let step = 0;
    if (arr.length === 0) {
        yield {
            stepNumber: step,
            entities: makeCells([[0]]),
            edges: [],
            description: "Empty array \u2013 nothing to sum.",
            codeLineNumber: 0,
            layout: "grid",
            meta: {},
        };
        return;
    }
    const size = arr.length;
    const bits = Math.round(Math.log2(size));
    if (1 << bits !== size) {
        yield {
            stepNumber: step,
            entities: makeCells([[...arr]]),
            edges: [],
            description: `Length ${size} is not a power of two \u2013 SOS needs 2^n entries.`,
            codeLineNumber: 0,
            layout: "grid",
            meta: {},
        };
        return;
    }
    const F = [...arr];
    yield {
        stepNumber: step,
        entities: makeCells([[...F]]),
        edges: [],
        description: `SOS over ${bits} bits; F starts as a copy of [${arr.join(", ")}].`,
        codeLineNumber: 0,
        layout: "grid",
        meta: { bits },
    };
    step += 1;
    for (let b = 0; b < bits; b += 1) {
        for (let mask = 0; mask < size; mask += 1) {
            if ((mask & (1 << b)) !== 0) F[mask] += F[mask ^ (1 << b)] ?? 0;
        }
        const states = new Map<string, EntityState>([[`0,${size - 1}`, "comparing"]]);
        yield {
            stepNumber: step,
            entities: makeCells([[...F]], states),
            edges: [],
            description: `Bit ${b} folded: F[${size - 1}] = ${F[size - 1]}.`,
            codeLineNumber: 2,
            layout: "grid",
            meta: { bits },
        };
        step += 1;
    }
    yield {
        stepNumber: step,
        entities: makeCells([[...F]], new Map([[`0,${size - 1}`, "sorted"]])),
        edges: [],
        description: `Traceback: F[${size - 1}] = ${F[size - 1]} (sum over all subsets).`,
        codeLineNumber: 4,
        layout: "grid",
        meta: { answer: F[size - 1] },
    };
}

const module: AlgorithmModule = {
    id: "sos-dp-sum-over-subsets",
    name: "SOS DP (Sum Over Subsets)",
    category: "dynamic-programming",
    complexity: { time: "O(n\u00b72^n)", space: "O(2^n)" },
    defaultInput: { arr: [1, 2, 3, 4, 5, 6, 7, 8] },
    visualType: "grid",
    run,
};

export default module;
