/**
 * sos-dp-sum-over-subsets.ts - SOS DP (Sum Over Subsets)
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Textbook dynamic programming: F[mask] <- F[mask] + F[mask ^ (1<<b)] when bit b set.
 *
 * Why DP works: optimal substructure lets larger answers build on smaller
 * ones, and overlapping subproblems mean each state is solved once and reused.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(n\u00b72^n)
 *   Space: O(2^n)
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
   - The cell being computed is YELLOW (comparing).
   - Source cells for the transition are BLUE (active).
   - The optimal value and path are GREEN (sorted).
 *
 * ---------------------------------------------------------------------------
 * Properties
 * ---------------------------------------------------------------------------
 *   - States build in dependency order so every transition reads final values.
 *   - The recurrence above is the single idea to memorize.
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
            meta: { step },
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
            meta: { step },
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
        codeLineNumber: 6,
        layout: "grid",
        meta: { answer: F[size - 1] },
    };
}

const module: AlgorithmModule = {

    education: {
        "intuition": "Sum over subsets DP computes, for every bitmask, the sum of values over all of its subsets. It starts with F equal to the input array and, for each bit b, adds F[mask without bit b] into F[mask] whenever that bit is set. After all bits are processed, F[mask] holds the total over every submask.",
        "invariants": [
            "After processing bits up to b, F[mask] sums values over submasks that differ only in those processed bits.",
            "The in-place update reuses the same array because the donor mask has bit b cleared.",
            "F[full] ends as the sum over all masks."
        ],
        "correctness": "For a fixed bit, adding the value of the mask with that bit cleared brings in exactly the submasks that omit the bit; combining over all bits enumerates every submask once. Induction over processed bits keeps F[mask] equal to the partial subset sum. After n bits the sum is complete.",
        "complexityRationale": "There are n bits and 2^n masks, each doing one conditional addition, giving O(n*2^n) time. The array of 2^n values uses O(2^n) space.",
        "uses": [
            "Fast subset convolution and zeta transforms",
            "Computing aggregate values over bitmask states",
            "Combinatorial counting over subsets"
        ],
        "references": [
            "KACTL handbook, subset DP chapter",
            "Cormen et al., Introduction to Algorithms, Chapter 15"
        ],
        "workedExample": "For arr = [1,2,3,4] over three bits, processing bit 0 adds arr[0] into arr[1] so F[1] becomes 3, the sum over submasks of mask 001. Continuing all bits yields F[full] as the total over all eight masks."
    },
    id: "sos-dp-sum-over-subsets",
    name: "SOS DP (Sum Over Subsets)",
    category: "dynamic-programming",
    complexity: { time: "O(n\u00b72^n)", space: "O(2^n)" },
    defaultInput: { arr: [1, 2, 3, 4, 5, 6, 7, 8] },
    visualType: "grid",
    run,
    pseudocode: [
        "set up F as a copy of array a over 2^n masks",
        "F[mask] holds partial subset sums for processed bits",
        "F[mask] <- F[mask] + F[mask ^ (1<<b)] when bit b set",
        "iterate bits outer and masks inner in order",
        "each bit folds subset contributions missing that bit",
        "in-place updates reuse the same array per bit layer",
        "answer <- F[full] as sum over all subsets with stages shown",
    ],
};

export default module;
