/**
 * correspondence-analysis.ts - Correspondence Analysis
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Correspondence analysis visualizes a contingency table as points in a low-
 * dimensional space. It converts the table to a correspondence matrix,
 * standardizes the departures from independence, and takes a singular value
 * decomposition. The squared singular values are principal inertias that add
 * up to the chi-square statistic divided by the grand total.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(sweeps * cols^3) for the Jacobi eigen decomposition
 *   Space: O(rows * cols) for the standardized matrix and coordinates
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - One bar per dimension shows its principal inertia.
 *   - The dimension currently being read is highlighted.
 *   - The final frame reports row and column principal coordinates.
 */

import type { AlgorithmModule, VisualEntity, VisualFrame } from "@/types";

type Matrix = number[][];

/** Symmetric eigen decomposition by cyclic Jacobi rotations. */
function jacobiEigen(input: Matrix): { values: number[]; vectors: Matrix } {
    const n = input.length;
    const a = input.map((row) => [...row]);
    const v: Matrix = Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) => (i === j ? 1 : 0)));
    for (let sweep = 0; sweep < 100; sweep += 1) {
        let off = 0;
        for (let i = 0; i < n; i += 1) for (let j = i + 1; j < n; j += 1) off += (a[i]?.[j] as number) * (a[i]?.[j] as number);
        if (off < 1e-22) break;
        for (let i = 0; i < n - 1; i += 1) {
            for (let j = i + 1; j < n; j += 1) {
                const aij = a[i]?.[j] as number;
                if (Math.abs(aij) < 1e-16) continue;
                const theta = ((a[j]?.[j] as number) - (a[i]?.[i] as number)) / (2 * aij);
                const t = theta === 0 ? 1 : Math.sign(theta) / (Math.abs(theta) + Math.sqrt(theta * theta + 1));
                const cosine = 1 / Math.sqrt(t * t + 1);
                const sine = t * cosine;
                for (let k = 0; k < n; k += 1) {
                    const aik = a[i]?.[k] as number;
                    const ajk = a[j]?.[k] as number;
                    a[i]![k] = cosine * aik - sine * ajk;
                    a[j]![k] = sine * aik + cosine * ajk;
                }
                for (let k = 0; k < n; k += 1) {
                    const aki = a[k]?.[i] as number;
                    const akj = a[k]?.[j] as number;
                    a[k]![i] = cosine * aki - sine * akj;
                    a[k]![j] = sine * aki + cosine * akj;
                }
                for (let k = 0; k < n; k += 1) {
                    const vki = v[k]?.[i] as number;
                    const vkj = v[k]?.[j] as number;
                    v[k]![i] = cosine * vki - sine * vkj;
                    v[k]![j] = sine * vki + cosine * vkj;
                }
            }
        }
    }
    const order = Array.from({ length: n }, (_, i) => i).sort((i, j) => (a[j]?.[j] as number) - (a[i]?.[i] as number));
    return {
        values: order.map((i) => Math.max(0, a[i]?.[i] as number)),
        vectors: order.map((i) => v.map((row) => row[i] as number)),
    };
}

function makeBars(values: number[], current: number, done: boolean): VisualEntity[] {
    return values.map((value, index) => ({
        id: `bar-${index}`,
        type: "bar" as const,
        label: value.toFixed(5),
        value,
        state: done || index < current ? "sorted" : index === current ? "comparing" : "idle",
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { index, inertia: value },
    }));
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { table?: number[][] } | null) ?? {};
    const table = task.table ?? [
        [23, 9, 6],
        [11, 12, 7],
        [6, 9, 14],
    ];
    const rows = table.length;
    const cols = table[0]?.length ?? 0;
    const grand = table.reduce((sum, row) => sum + row.reduce((a, b) => a + Math.max(0, b), 0), 0) || 1;
    const p = table.map((row) => row.map((value) => Math.max(0, value) / grand));
    const r = p.map((row) => row.reduce((a, b) => a + b, 0));
    const c = Array.from({ length: cols }, (_, j) => p.reduce((sum, row) => sum + (row[j] as number), 0));
    const s: Matrix = Array.from({ length: rows }, (_, i) =>
        Array.from({ length: cols }, (_, j) => {
            const denom = Math.sqrt((r[i] as number) * (c[j] as number));
            return denom > 0 ? ((p[i]?.[j] as number) - (r[i] as number) * (c[j] as number)) / denom : 0;
        }),
    );
    const gram: Matrix = Array.from({ length: cols }, (_, j) =>
        Array.from({ length: cols }, (_, l) => s.reduce((sum, row) => sum + (row[j] as number) * (row[l] as number), 0)),
    );
    const { values, vectors } = jacobiEigen(gram);
    const dimensions = cols;
    const rowCoords: Matrix = Array.from({ length: rows }, (_, i) =>
        Array.from({ length: dimensions }, (_, d) => {
            let sum = 0;
            for (let j = 0; j < cols; j += 1) sum += (s[i]?.[j] as number) * (vectors[d]?.[j] as number);
            return sum / Math.sqrt(r[i] || 1);
        }),
    );
    const colCoords: Matrix = Array.from({ length: cols }, (_, j) =>
        Array.from({ length: dimensions }, (_, d) => (Math.sqrt(values[d] as number) * (vectors[d]?.[j] as number)) / Math.sqrt(c[j] || 1)),
    );
    let chiSquare = 0;
    for (let i = 0; i < rows; i += 1) {
        for (let j = 0; j < cols; j += 1) {
            const expected = (r[i] as number) * (c[j] as number);
            const denom = expected;
            if (denom > 0) chiSquare += grand * Math.pow((p[i]?.[j] as number) - expected, 2) / denom;
        }
    }
    const totalInertia = values.reduce((a, b) => a + b, 0);

    yield {
        stepNumber: 0,
        entities: makeBars(new Array<number>(dimensions).fill(0), -1, false),
        edges: [],
        description: `Preparing correspondence analysis of a ${rows} by ${cols} contingency table.`,
        codeLineNumber: 0,
        layout: "array",
        meta: { rows, cols, dimensions, inertia: [], rowCoords: [], colCoords: [], chiSquare, totalInertia, complete: false },
    };
    let step = 1;
    const shown: number[] = [];
    for (let d = 0; d < dimensions; d += 1) {
        shown.push(values[d] as number);
        yield {
            stepNumber: step,
            entities: makeBars([...shown, ...new Array<number>(dimensions - d - 1).fill(0)], d, false),
            edges: [],
            description: `Dimension ${d}: principal inertia ${(values[d] as number).toFixed(5)}.`,
            codeLineNumber: 2,
            layout: "array",
            meta: { rows, cols, dimensions, inertia: [...shown], rowCoords: [], colCoords: [], chiSquare, totalInertia, complete: false },
        };
        step += 1;
    }

    yield {
        stepNumber: step,
        entities: makeBars(values, dimensions, true),
        edges: [],
        description: `Analysis complete: total inertia ${totalInertia.toFixed(5)} equals chi-square ${chiSquare.toFixed(5)} over the grand total.`,
        codeLineNumber: 5,
        layout: "array",
        meta: { rows, cols, dimensions, inertia: values, rowCoords, colCoords, chiSquare, totalInertia, complete: true },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Correspondence analysis turns a table of counts into a map. Rows and columns become points whose distances reflect how similar their count patterns are. The axes are chosen so that the first captures as much of the departure from independence as possible, the second captures the next most, and so on.",
        invariants: [
            "The correspondence matrix entries are nonnegative and sum to one.",
            "The squared singular values are the principal inertias of the decomposition.",
            "The inertias sum to the Pearson chi-square statistic divided by the grand total.",
        ],
        correctness:
            "Standardizing the residual P minus the outer product of row and column masses by the square root of the masses gives the matrix S. Its singular value decomposition S equals U diagonal(sigma) V transpose yields principal inertias sigma squared. The sum of squared entries of S is both the trace of S transpose S and the chi-square statistic divided by the grand total, so the inertias add to that quantity. Principal coordinates are the singular vectors scaled by the singular values and by the inverse square root of the masses.",
        complexityRationale:
            "Forming the Gram matrix of S costs O(rows times cols squared), and the cyclic Jacobi eigensolver needs a bounded number of sweeps over cols squared rotations, each costing O(cols), for O(sweeps times cols cubed) time. Coordinates and the standardized matrix use O(rows times cols) space.",
        uses: [
            "Exploring relationships in survey and marketing cross-tabs",
            "Visualizing term-document count matrices in text analysis",
            "Displaying ecological species-by-site tables",
        ],
        references: [
            "Greenacre, Theory and Applications of Correspondence Analysis, Chapter 3",
            "Benzecri, La Pratique de l'Analyse des Donnees, Volume 2",
        ],
        workedExample:
            "For the two-by-two table with counts 10, 20, 20, 10, both row and column totals are 30. The single nontrivial inertia equals (10*10 minus 20*20) squared divided by 30 times 30 times 30 times 30, which is 90000 over 810000, or about 0.111. Multiplying by the grand total of 60 gives a chi-square statistic of about 6.67.",
    },
    id: "correspondence-analysis",
    name: "Correspondence Analysis",
    category: "statistics-probability",
    complexity: { time: "O(rows * cols^2 + sweeps * cols^3)", space: "O(rows * cols)" },
    defaultInput: {
        table: [
            [23, 9, 6],
            [11, 12, 7],
            [6, 9, 14],
        ],
    },
    visualType: "array",
    run,
    pseudocode: [
        "read the contingency table and compute its grand total",
        "divide by the grand total to get correspondence matrix P",
        "compute row masses r and column masses c from P",
        "form standardized matrix S with entries (P - r c) / sqrt(r c)",
        "diagonalize the Gram matrix S transpose S by Jacobi rotations",
        "set each principal inertia to the corresponding eigenvalue",
        "scale singular vectors by masses to get row and column coordinates",
        "done: report inertias, coordinates, and total chi-square inertia",
    ],
};

export default module;
