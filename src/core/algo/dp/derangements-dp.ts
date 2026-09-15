/**
 * derangements-dp.ts - Derangements (DP)
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Textbook dynamic programming: D[i] <- (i-1) * (D[i-1] + D[i-2]).
 *
 * Why DP works: optimal substructure lets larger answers build on smaller
 * ones, and overlapping subproblems mean each state is solved once and reused.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(n)
 *   Space: O(n)
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
    const task = (input as { n?: number } | null) ?? {};
    const n = typeof task.n === "number" ? task.n : 4;
    let step = 0;
    if (n < 0) {
        yield {
            stepNumber: step,
            entities: makeCells([[0]]),
            edges: [],
            description: "Negative n \u2013 nothing to count.",
            codeLineNumber: 0,
            layout: "grid",
            meta: { step },
        };
        return;
    }
    const D: number[] = new Array<number>(n + 1).fill(0);
    D[0] = 1;
    if (n >= 1) D[1] = 0;
    yield {
        stepNumber: step,
        entities: makeCells([[...D]]),
        edges: [],
        description: `Derangements up to D[${n}] (no element stays put). D[0] = 1.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: { n },
    };
    step += 1;
    if (n >= 1) {
        const states = new Map<string, EntityState>([["0,1", "comparing"]]);
        yield {
            stepNumber: step,
            entities: makeCells([[...D]], states),
            edges: [],
            description: `D[1] = 0 (a single item cannot move).`,
            codeLineNumber: 2,
            layout: "grid",
            meta: { n },
        };
        step += 1;
    }
    for (let i = 2; i <= n; i += 1) {
        D[i] = (i - 1) * ((D[i - 1] ?? 0) + (D[i - 2] ?? 0));
        const states = new Map<string, EntityState>([[`0,${i}`, "comparing"]]);
        yield {
            stepNumber: step,
            entities: makeCells([[...D]], states),
            edges: [],
            description: `D[${i}] = ${i - 1} * (${D[i - 1]} + ${D[i - 2]}) = ${D[i]}.`,
            codeLineNumber: 2,
            layout: "grid",
            meta: { n },
        };
        step += 1;
    }
    yield {
        stepNumber: step,
        entities: makeCells([[...D]], new Map([[`0,${n}`, "sorted"]])),
        edges: [],
        description: `Traceback: D[${n}] = ${D[n]}.`,
        codeLineNumber: 6,
        layout: "grid",
        meta: { answer: D[n] },
    };
}

const module: AlgorithmModule = {
    id: "derangements-dp",
    name: "Derangements (DP)",
    category: "dynamic-programming",
    complexity: { time: "O(n)", space: "O(n)" },
    defaultInput: { n: 4 },
    visualType: "grid",
    run,
    pseudocode: [
        "set up D[0] <- 1 and D[1] <- 0 as derangement bases",
        "D[i] holds permutations of i items with none fixed",
        "D[i] <- (i-1) * (D[i-1] + D[i-2])",
        "iterate i from 2 up to n using two prior values",
        "pick partner for item i then handle fixed-or-swapped cases",
        "multiply the summed subcases by the partner choices",
        "answer <- D[n] as derangement count with recurrence history",
    ],
};

export default module;
