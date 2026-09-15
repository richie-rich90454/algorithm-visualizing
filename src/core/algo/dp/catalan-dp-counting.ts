/**
 * catalan-dp-counting.ts - Catalan Numbers (DP)
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Textbook dynamic programming: C[i] <- sum over j of C[j] * C[i-1-j].
 *
 * Why DP works: optimal substructure lets larger answers build on smaller
 * ones, and overlapping subproblems mean each state is solved once and reused.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(n\u00b2)
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
    const C: number[] = new Array<number>(n + 1).fill(0);
    C[0] = 1;
    yield {
        stepNumber: step,
        entities: makeCells([[...C]]),
        edges: [],
        description: `Catalan numbers up to C[${n}] (BSTs, bracketings, Dyck paths). C[0] = 1.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: { n },
    };
    step += 1;
    for (let i = 1; i <= n; i += 1) {
        let total = 0;
        for (let j = 0; j < i; j += 1) total += (C[j] ?? 0) * (C[i - 1 - j] ?? 0);
        C[i] = total;
        const states = new Map<string, EntityState>([[`0,${i}`, "comparing"]]);
        yield {
            stepNumber: step,
            entities: makeCells([[...C]], states),
            edges: [],
            description: `C[${i}] = ${total}.`,
            codeLineNumber: 2,
            layout: "grid",
            meta: { n },
        };
        step += 1;
    }
    yield {
        stepNumber: step,
        entities: makeCells([[...C]], new Map([[`0,${n}`, "sorted"]])),
        edges: [],
        description: `Traceback: C[${n}] = ${C[n]}.`,
        codeLineNumber: 6,
        layout: "grid",
        meta: { answer: C[n] },
    };
}

const module: AlgorithmModule = {
    id: "catalan-dp-counting",
    name: "Catalan Numbers (DP)",
    category: "dynamic-programming",
    complexity: { time: "O(n\u00b2)", space: "O(n)" },
    defaultInput: { n: 4 },
    visualType: "grid",
    run,
    pseudocode: [
        "set up C[0] <- 1 as the empty product base case",
        "C[n] counts BSTs, bracketings, and Dyck paths",
        "C[i] <- sum over j of C[j] * C[i-1-j]",
        "iterate i from 1 to n building on smaller counts",
        "each split picks a root with left and right subcounts",
        "accumulate products across all root positions",
        "answer <- C[n] with structures reconstructed from split picks",
    ],};

export default module;
