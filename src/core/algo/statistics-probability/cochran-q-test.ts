/**
 * cochran-q-test.ts - Cochran's Q Test for Related Samples
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Cochran's Q test checks whether three or more related treatments differ when
 * each outcome is binary. It sums each treatment column and each subject row,
 * then builds a chi-square statistic from the variation among column totals
 * after accounting for how many treatments each subject endorsed.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(n * k) for n subjects and k treatments
 *   Space: O(n * k) for the displayed grid
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - The grid holds one cell per subject and treatment.
 *   - The row currently being tallied is highlighted.
 *   - The final frame reports Q and its degrees of freedom.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

function makeCells(matrix: number[][], activeRow: number, done: boolean): VisualEntity[] {
    return matrix.flatMap((row, r) =>
        row.map((value, c) => {
            let state: EntityState = "idle";
            if (done) {
                state = value === 1 ? "sorted" : "unvisited";
            } else if (r === activeRow) {
                state = "comparing";
            }
            return {
                id: `cell-${r}-${c}`,
                type: "cell" as const,
                label: String(value),
                value,
                state,
                x: 0,
                y: 0,
                width: 0,
                height: 0,
                metadata: { row: r, col: c, value },
            };
        }),
    );
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { subjects?: number[][] } | null) ?? {};
    const raw: number[][] = Array.isArray(task.subjects)
        ? task.subjects.map((row) => row.slice())
        : [
              [1, 1, 0, 1],
              [1, 0, 0, 1],
              [0, 1, 0, 0],
              [1, 1, 1, 1],
              [0, 0, 1, 0],
          ];
    const matrix = raw.map((row) => row.map((value) => (value === 1 ? 1 : 0)));
    const n = matrix.length;
    const k = n > 0 ? matrix[0].length : 0;

    yield {
        stepNumber: 0,
        entities: makeCells(matrix, -1, false),
        edges: [],
        description: `Cochran's Q on ${n} subject(s) and ${k} treatment(s).`,
        codeLineNumber: 0,
        layout: "grid",
        meta: { n, k, Q: 0, df: Math.max(0, k - 1) },
    };
    let step = 1;

    for (let i = 0; i < n; i += 1) {
        const rowTotal = (matrix[i] ?? []).reduce<number>((sum, value) => sum + value, 0);
        yield {
            stepNumber: step,
            entities: makeCells(matrix, i, false),
            edges: [],
            description: `Subject ${i + 1} endorsed ${rowTotal} of ${k} treatments.`,
            codeLineNumber: 3,
            layout: "grid",
            meta: { n, k, Q: 0, df: Math.max(0, k - 1) },
        };
        step += 1;
    }

    const columnTotals = Array.from({ length: k }, (_, j) =>
        matrix.reduce((sum, row) => sum + (row[j] ?? 0), 0),
    );
    yield {
        stepNumber: step,
        entities: makeCells(matrix, -1, true),
        edges: [],
        description: `Treatment column totals are ${columnTotals.join(", ")}.`,
        codeLineNumber: 2,
        layout: "grid",
        meta: { n, k, Q: 0, df: Math.max(0, k - 1), columnTotals },
    };
    step += 1;

    const total = columnTotals.reduce((sum, value) => sum + value, 0);
    let numeratorPart = 0;
    for (const value of columnTotals) {
        numeratorPart += value * value;
    }
    const numerator = (k - 1) * (k * numeratorPart - total * total);
    let sumRowTotals = 0;
    let sumRowSquares = 0;
    for (const row of matrix) {
        const rowTotal = row.reduce<number>((sum, value) => sum + value, 0);
        sumRowTotals += rowTotal;
        sumRowSquares += rowTotal * rowTotal;
    }
    const denominator = k * sumRowTotals - sumRowSquares;
    const Q = denominator > 0 ? Math.max(0, numerator / denominator) : 0;
    yield {
        stepNumber: step,
        entities: makeCells(matrix, -1, true),
        edges: [],
        description: `Q statistic is ${Q.toFixed(4)} on ${Math.max(0, k - 1)} degrees of freedom.`,
        codeLineNumber: 6,
        layout: "grid",
        meta: { n, k, Q, df: Math.max(0, k - 1), columnTotals },
    };
    step += 1;

    yield {
        stepNumber: step,
        entities: makeCells(matrix, -1, true),
        edges: [],
        description: `Cochran's Q = ${Q.toFixed(4)} with ${Math.max(0, k - 1)} degrees of freedom.`,
        codeLineNumber: 7,
        layout: "grid",
        meta: { n, k, Q, df: Math.max(0, k - 1), columnTotals },
    };
}

/** The Cochran Q module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "Cochran's Q is the McNemar idea extended past two treatments. It asks whether the treatments get endorsed at different rates, while remembering that the same subject contributes to every column and so the columns are not independent.",
        invariants: [
            "Every matrix entry is binary, so a row total counts how many treatments a subject endorsed.",
            "Column totals count how many subjects endorsed each treatment.",
            "Identical treatment columns give Q equal to zero.",
        ],
        correctness:
            "The numerator measures the spread of the column totals, multiplied by k minus one, while the denominator removes the between-subject variation captured by the row totals. Under the null that all treatments are equally likely, this ratio has an asymptotic chi-square distribution with k minus one degrees of freedom; identical columns leave the numerator at zero.",
        complexityRationale:
            "Each subject row is scanned once for its total and each column is summed once, so the work is proportional to the n by k entries. The grid of cells is the only storage beyond a few running totals.",
        uses: [
            "Comparing three or more diagnostic tests on the same patients",
            "Analyzing repeated binary survey responses",
            "Testing agreement among multiple raters with binary decisions",
        ],
        references: [
            "Cochran, The Comparison of Percentages in Matched Samples, 1950",
            "Agresti, Analysis of Categorical Data, Chapter 6",
        ],
        workedExample:
            "For three subjects with rows 1,1,0; 1,0,0 and 0,0,1, the column totals are 2, 1, 1 and the total is 4. The numerator is 2 times (3 times 6 minus 16), or 4. The row totals are 2, 1, 1 so the denominator is 3 times 4 minus 6, or 6, giving Q about 0.67.",
    },
    id: "cochran-q-test",
    name: "Cochran's Q Test",
    category: "statistics-probability",
    complexity: { time: "O(n * k)", space: "O(n * k)" },
    defaultInput: {
        subjects: [
            [1, 1, 0, 1],
            [1, 0, 0, 1],
            [0, 1, 0, 0],
            [1, 1, 1, 1],
            [0, 0, 1, 0],
        ],
    },
    visualType: "grid",
    run,
    pseudocode: [
        "read the binary subject by treatment matrix",
        "let n be the number of subjects and k the number of treatments",
        "for each treatment sum its column total G",
        "for each subject sum its row total L",
        "set the numerator to (k minus 1) times (k times sum of G squared minus total squared)",
        "set the denominator to k times sum of L minus sum of L squared",
        "set Q to the numerator over the denominator",
        "done: report Q with k minus 1 degrees of freedom",
    ],
};

export default module;
