/**
 * hermite-normal-form.ts - Hermite Normal Form of an Integer Matrix
 *
 * Reduces a full-row-rank integer matrix to row-style Hermite normal form with
 * unimodular row operations, recording the transformation matrix U so that
 * H = U*A. The result is upper triangular with positive diagonal pivots and
 * above-pivot entries reduced into the range [0, pivot).
 *
 *   Time:  O(m*n*min(m,n)) integer operations
 *   Space: O(m*n) for H and U
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface HermiteInput {
    matrix?: number[][];
}

function egcd(a: number, b: number): [number, number, number] {
    let oldR = a;
    let r = b;
    let oldS = 1;
    let s = 0;
    let oldT = 0;
    let t = 1;
    while (r !== 0) {
        const q = Math.trunc(oldR / r);
        [oldR, r] = [r, oldR - q * r];
        [oldS, s] = [s, oldS - q * s];
        [oldT, t] = [t, oldT - q * t];
    }
    if (oldR < 0) return [-oldS, -oldT, -oldR];
    return [oldS, oldT, oldR];
}

function determinant(matrix: number[][]): number {
    const n = matrix.length;
    if (n === 0) return 1;
    const a = matrix.map((row) => row.slice());
    let sign = 1;
    let previous = 1;
    for (let k = 0; k < n - 1; k += 1) {
        if (a[k]?.[k] === 0) {
            let swapped = false;
            for (let row = k + 1; row < n; row += 1) {
                if (a[row]?.[k] !== 0) {
                    const temp = a[k]!;
                    a[k] = a[row]!;
                    a[row] = temp;
                    sign = -sign;
                    swapped = true;
                    break;
                }
            }
            if (!swapped) return 0;
        }
        const pivot = a[k]![k]!;
        for (let i = k + 1; i < n; i += 1) {
            for (let j = k + 1; j < n; j += 1) {
                a[i]![j] = Math.round((a[i]![j]! * pivot - a[i]![k]! * a[k]![j]!) / previous);
            }
        }
        previous = pivot;
    }
    return Math.round(sign * a[n - 1]![n - 1]!);
}

function makeEntities(matrix: number[][], rows: number, cols: number): VisualEntity[] {
    const entities: VisualEntity[] = [];
    for (let r = 0; r < rows; r += 1) {
        for (let c = 0; c < cols; c += 1) {
            const value = matrix[r]?.[c] ?? 0;
            entities.push({
                id: `cell-${r}-${c}`,
                type: "cell" as const,
                label: String(value),
                value,
                state: (c === r && value !== 0 ? "active" : value === 0 ? "idle" : "comparing") as EntityState,
                x: 0,
                y: 0,
                width: 0,
                height: 0,
                metadata: { row: r, col: c },
            });
        }
    }
    return entities;
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as HermiteInput | null) ?? {};
    const raw = Array.isArray(task.matrix) ? task.matrix : null;
    const matrix = raw && raw.length > 0 && raw.every((row) => Array.isArray(row) && row.length === (raw[0]?.length ?? 0))
        ? raw.map((row) => row.slice())
        : [
              [2, 1, 1],
              [1, 2, 1],
              [1, 1, 2],
          ];
    const m = matrix.length;
    const n = matrix[0]?.length ?? 0;
    const H = matrix.map((row) => row.slice());
    const U: number[][] = Array.from({ length: m }, (_, i) =>
        Array.from({ length: m }, (_, j): number => (i === j ? 1 : 0)),
    );
    const swapRows = (i: number, j: number): void => {
        const h = H[i]!;
        H[i] = H[j]!;
        H[j] = h;
        const u = U[i]!;
        U[i] = U[j]!;
        U[j] = u;
    };

    let step = 0;
    yield {
        stepNumber: step,
        entities: makeEntities(H, m, n),
        edges: [],
        description: `Reduce a ${m} by ${n} integer matrix to row-style Hermite normal form.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: { rows: m, cols: n, m, n, phase: "input", rank: 0 },
    };
    step += 1;

    let pivotRow = 0;
    for (let col = 0; col < n && pivotRow < m; col += 1) {
        let found = -1;
        for (let row = pivotRow; row < m; row += 1) {
            if ((H[row]?.[col] ?? 0) !== 0) {
                found = row;
                break;
            }
        }
        if (found === -1) continue;
        if (found !== pivotRow) swapRows(found, pivotRow);

        for (let k = pivotRow + 1; k < m; k += 1) {
            const a = H[pivotRow]![col]!;
            const b = H[k]![col]!;
            if (b === 0) continue;
            const [s, t, g] = egcd(a, b);
            for (let j = col; j < n; j += 1) {
                const hp = s * H[pivotRow]![j]! + t * H[k]![j]!;
                const hk = (-b / g) * H[pivotRow]![j]! + (a / g) * H[k]![j]!;
                H[pivotRow]![j] = hp;
                H[k]![j] = hk;
            }
            for (let j = 0; j < m; j += 1) {
                const up = s * U[pivotRow]![j]! + t * U[k]![j]!;
                const uk = (-b / g) * U[pivotRow]![j]! + (a / g) * U[k]![j]!;
                U[pivotRow]![j] = up;
                U[k]![j] = uk;
            }
        }

        if (H[pivotRow]![col]! < 0) {
            for (let j = col; j < n; j += 1) H[pivotRow]![j] = -H[pivotRow]![j]!;
            for (let j = 0; j < m; j += 1) U[pivotRow]![j] = -U[pivotRow]![j]!;
        }

        const pivot = H[pivotRow]![col]!;
        for (let k = 0; k < pivotRow; k += 1) {
            const factor = Math.floor((H[k]![col] ?? 0) / pivot);
            if (factor === 0) continue;
            for (let j = col; j < n; j += 1) {
                H[k]![j] = (H[k]![j] ?? 0) - factor * H[pivotRow]![j]!;
            }
            for (let j = 0; j < m; j += 1) {
                U[k]![j] = (U[k]![j] ?? 0) - factor * U[pivotRow]![j]!;
            }
        }

        yield {
            stepNumber: step,
            entities: makeEntities(H, m, n),
            edges: [],
            description: `Column ${col}: pivot ${H[pivotRow]![col]}, unimodular determinant ${determinant(U)}.`,
            codeLineNumber: 1,
            layout: "grid",
            meta: { rows: m, cols: n, m, n, phase: "pivot", pivotRow, column: col, rank: pivotRow + 1 },
        };
        step += 1;
        pivotRow += 1;
    }

    yield {
        stepNumber: step,
        entities: makeEntities(H, m, n),
        edges: [],
        description: `Done: H has rank ${pivotRow} and det(U) = ${determinant(U)} with H = U*A.`,
        codeLineNumber: 4,
        layout: "grid",
        meta: { rows: m, cols: n, m, n, phase: "done", rank: pivotRow, Hflat: H.flat().map((v) => (v === 0 ? 0 : v)), Uflat: U.flat().map((v) => (v === 0 ? 0 : v)), detU: determinant(U) },
    };
}

const module: AlgorithmModule = {
    id: "hermite-normal-form",
    name: "Hermite Normal Form",
    category: "math",
    complexity: { time: "O(m*n*min(m,n))", space: "O(m*n)" },
    defaultInput: {
        matrix: [
            [2, 1, 1],
            [1, 2, 1],
            [1, 1, 2],
        ],
    },
    visualType: "grid",
    run,
    pseudocode: [
        "copy A into H and set U to the identity matrix",
        "for each column find a nonzero pivot row at or below the current row",
        "swap that row into place, recording the swap in U",
        "use extended gcd on two rows to zero the pivot column below the pivot",
        "reduce entries above the pivot modulo the pivot value",
        "negate the pivot row if its pivot is negative",
        "done: report H and the unimodular matrix U with H = U*A",
    ],
    education: {
        intuition:
            "The Hermite normal form is a canonical triangular version of an integer matrix obtained by reversible integer row operations. Think of it as Gaussian elimination restricted to integer steps: instead of dividing by arbitrary numbers, extended gcd combines two rows to create a gcd pivot and a zero, which keeps every entry integral.",
        invariants: [
            "After every operation H equals U times the original matrix.",
            "Every row operation on U has determinant plus or minus one.",
            "Processed pivot columns have zeros below the pivot and reduced entries above it.",
        ],
        correctness:
            "A swap, adding an integer multiple of one row to another, and the extended-gcd two-row recombination are all unimodular operations, so U stays invertible over the integers and H always equals U times A. The gcd recombination places the positive gcd on the pivot and zero below it, and reducing above the pivot makes each above entry lie in [0, pivot). Because these are exactly the defining conditions of row-style Hermite normal form, the finished H is the canonical form and U is unimodular.",
        complexityRationale:
            "There are at most min(m, n) pivot columns, each clearing O(m) rows and updating O(n) or O(m) entries, for O(m*n*min(m,n)) integer operations. Storing H and U takes O(m*n) space.",
        uses: [
            "Canonical representatives for integer lattices",
            "Solving systems of linear Diophantine equations",
            "Integer programming and lattice-based cryptography",
        ],
        references: [
            "Cohen, A Course in Computational Algebraic Number Theory, Section 2.4",
            "Wikipedia, Hermite normal form",
        ],
        workedExample:
            "For A = [[2,1,1],[1,2,1],[1,1,2]], extended-gcd row combinations drive the matrix toward an upper triangular H with positive diagonal entries, while U records each integer row move; the product U times A returns exactly H and det(U) is plus or minus one.",
    },
};

export default module;
