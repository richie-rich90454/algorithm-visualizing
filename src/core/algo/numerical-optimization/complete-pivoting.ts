/**
 * complete-pivoting.ts - Gaussian Elimination with Complete Pivoting
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Complete pivoting solves a dense linear system by choosing, at each step,
 * the largest remaining entry in the whole active submatrix as the pivot. Both
 * a row swap and a column swap may be needed, so the solution is unpermuted at
 * the end. Choosing the global maximum gives better numerical stability than
 * partial pivoting, at the cost of searching the entire submatrix each step.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(n^3) for elimination plus O(n^2) per pivot search
 *   Space: O(n^2) for the working matrix
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - The working matrix is drawn as grid cells with row and column metadata.
 *   - The chosen pivot is highlighted; the right column holds the right side.
 *   - The final frame reports the solution and determinant sign.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

function buildEntities(matrix: number[][], rhs: number[], pivot: [number, number] | null): VisualEntity[] {
    const cells: VisualEntity[] = [];
    const n = matrix.length;
    for (let i = 0; i < n; i += 1) {
        for (let j = 0; j < n; j += 1) {
            const isPivot = pivot !== null && pivot[0] === i && pivot[1] === j;
            cells.push({
                id: `cell-${i}-${j}`,
                type: "cell" as const,
                label: String(Number((matrix[i]?.[j] ?? 0).toFixed(3))),
                value: matrix[i]?.[j] ?? 0,
                state: (isPivot ? "pivot" : j < i ? "visited" : "idle") as EntityState,
                x: 0,
                y: 0,
                width: 0,
                height: 0,
                metadata: { row: i, col: j },
            });
        }
        cells.push({
            id: `rhs-${i}`,
            type: "cell" as const,
            label: String(Number((rhs[i] ?? 0).toFixed(3))),
            value: rhs[i] ?? 0,
            state: "active" as EntityState,
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: { row: i, col: n, isRhs: true },
        });
    }
    return cells;
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { matrix?: number[][]; rhs?: number[] } | null) ?? {};
    const source = task.matrix ?? [
        [2, 1, -1],
        [-3, -1, 2],
        [-2, 1, 2],
    ];
    const a: number[][] = source.map((row) => [...row]);
    const rhs: number[] = [...(task.rhs ?? [8, -11, -3])];
    const n = a.length;
    const colPerm = Array.from({ length: n }, (_, i) => i);
    const rowPerm = Array.from({ length: n }, (_, i) => i);
    let sign = 1;
    let singular = false;
    let step = 0;

    yield {
        stepNumber: step++,
        entities: buildEntities(a, rhs, null),
        edges: [],
        description: `Solving a ${n} by ${n} system with complete pivoting.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: { matrix: a.map((r) => [...r]), rhs: [...rhs], phase: "start" },
    };

    for (let k = 0; k < n && !singular; k += 1) {
        let max = -1;
        let pivotRow = k;
        let pivotCol = k;
        for (let i = k; i < n; i += 1) {
            const row = a[i] as number[];
            for (let j = k; j < n; j += 1) {
                const value = Math.abs(row[j] as number);
                if (value > max) {
                    max = value;
                    pivotRow = i;
                    pivotCol = j;
                }
            }
        }
        if (max < 1e-12) {
            singular = true;
            break;
        }

        if (pivotRow !== k) {
            [a[k], a[pivotRow]] = [a[pivotRow] as number[], a[k] as number[]];
            [rhs[k], rhs[pivotRow]] = [rhs[pivotRow] as number, rhs[k] as number];
            [rowPerm[k], rowPerm[pivotRow]] = [rowPerm[pivotRow] as number, rowPerm[k] as number];
            sign = -sign;
        }
        if (pivotCol !== k) {
            for (let i = 0; i < n; i += 1) {
                const row = a[i] as number[];
                [row[k], row[pivotCol]] = [row[pivotCol] as number, row[k] as number];
            }
            [colPerm[k], colPerm[pivotCol]] = [colPerm[pivotCol] as number, colPerm[k] as number];
            sign = -sign;
        }

        yield {
            stepNumber: step++,
            entities: buildEntities(a, rhs, [k, k]),
            edges: [],
            description: `Pivot ${max} found at original row ${rowPerm[k]}, column ${colPerm[k]}; swapped into position ${k}.`,
            codeLineNumber: 3,
            layout: "grid",
            meta: {
                matrix: a.map((r) => [...r]),
                rhs: [...rhs],
                phase: "pivot",
                k,
                pivotRow,
                pivotCol,
                pivotValue: max,
                rowPerm: [...rowPerm],
                colPerm: [...colPerm],
            },
        };

        const pivot = a[k]?.[k] as number;
        for (let i = k + 1; i < n; i += 1) {
            const factor = (a[i]?.[k] as number) / pivot;
            (a[i] as number[])[k] = factor;
            for (let j = k + 1; j < n; j += 1) {
                (a[i] as number[])[j] = (a[i]?.[j] as number) - factor * (a[k]?.[j] as number);
            }
            rhs[i] = (rhs[i] as number) - factor * (rhs[k] as number);
        }
        yield {
            stepNumber: step++,
            entities: buildEntities(a, rhs, [k, k]),
            edges: [],
            description: `Eliminated below pivot ${k}; multipliers now occupy the lower triangle.`,
            codeLineNumber: 5,
            layout: "grid",
            meta: { matrix: a.map((r) => [...r]), rhs: [...rhs], phase: "eliminate", k },
        };
    }

    const y = new Array<number>(n).fill(0);
    if (!singular) {
        for (let i = n - 1; i >= 0; i -= 1) {
            let sum = rhs[i] as number;
            for (let j = i + 1; j < n; j += 1) sum -= (a[i]?.[j] as number) * (y[j] as number);
            y[i] = sum / (a[i]?.[i] as number);
        }
    }
    const x = new Array<number>(n).fill(0);
    for (let i = 0; i < n && !singular; i += 1) x[colPerm[i] as number] = y[i] as number;
    let determinant = sign;
    for (let i = 0; i < n && !singular; i += 1) determinant *= a[i]?.[i] as number;

    yield {
        stepNumber: step++,
        entities: buildEntities(a, rhs, null),
        edges: [],
        description: singular
            ? "A zero pivot was found; the matrix is singular."
            : `Solution x = [${x.map((v) => Number(v.toFixed(4))).join(", ")}].`,
        codeLineNumber: 6,
        layout: "grid",
        meta: {
            matrix: a.map((r) => [...r]),
            rhs: [...rhs],
            phase: "done",
            solution: x,
            colPerm: [...colPerm],
            rowPerm: [...rowPerm],
            determinant: singular ? 0 : determinant,
            singular,
        },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Instead of accepting whatever diagonal entry appears, complete pivoting scans the entire unreduced submatrix and brings its largest magnitude to the diagonal by swapping both rows and columns. The larger pivot shrinks growth in the eliminated entries, which improves numerical stability. Column swaps mean the solved variables come out in a permuted order that must be undone.",
        invariants: [
            "After step k the leading k by k block is upper triangular.",
            "Row and column permutation arrays track the original indices of every pivot.",
            "The product of the diagonal entries times the permutation sign equals the determinant.",
        ],
        correctness:
            "Each row or column swap is an elementary operation that only permutes equations or unknowns, and rowPerm and colPerm record those swaps exactly. Gaussian elimination then produces an upper triangular system whose back-substitution gives y in the permuted variable order. Setting x[colPerm[i]] = y[i] restores the original order, so A x equals b up to rounding error.",
        complexityRationale:
            "Finding the global maximum examines (n-k)^2 entries at step k, summing to O(n^3) over all steps, matching the elimination work. Only one working matrix and the permutation arrays are stored, so space is O(n^2).",
        uses: [
            "Solving dense linear systems where numerical stability matters",
            "Computing determinants with explicit permutation tracking",
            "A stable baseline for comparing cheaper pivoting strategies",
        ],
        references: [
            "Golub and Van Loan, Matrix Computations, chapter on Gaussian elimination",
            "Higham, Accuracy and Stability of Numerical Algorithms",
        ],
        workedExample:
            "For [[2,1],[-3,-1]] the largest entry is -3 at row 2, column 1. Swapping rows and columns puts -3 on the diagonal, elimination clears the entry below, and back-substitution followed by unpermuting returns the solution in the original variable order.",
    },
    id: "complete-pivoting",
    name: "Gaussian Elimination with Complete Pivoting",
    category: "numerical-optimization",
    complexity: { time: "O(n^3)", space: "O(n^2)" },
    defaultInput: {
        matrix: [
            [2, 1, -1],
            [-3, -1, 2],
            [-2, 1, 2],
        ],
        rhs: [8, -11, -3],
    },
    visualType: "grid",
    run,
    pseudocode: [
        "copy the matrix and right side into working arrays",
        "for each diagonal position k up to n minus one",
        "find the largest entry in the remaining submatrix and record its indices",
        "swap that row and column into position k and flip the determinant sign",
        "subtract a multiple of row k from every row below it",
        "back-substitute to obtain y in the permuted variable order",
        "set x at each original column index and return x",
    ],
};

export default module;
