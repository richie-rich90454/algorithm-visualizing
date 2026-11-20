/**
 * integer-relation-pslq.ts - PSLQ Integer Relation Detection
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * PSLQ searches for small integers c_i, not all zero, such that the sum of
 * c_i times x_i is zero. It maintains an orthogonal matrix that shrinks the
 * residual vector toward a coordinate axis while two integer matrices record
 * how each row was transformed. Each step swaps the most promising row with
 * its neighbor, rotates the matrix to preserve orthogonality, and size-reduces
 * the entries. When one residual drops below tolerance, the corresponding
 * column of the accumulator is the integer relation.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 *   Time:  O(steps * n^2) for a vector of length n
 *   Space: O(n^2) for the three matrices
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - The integer accumulator matrix is drawn as a grid of cells.
 *   - Each iteration highlights the pivot row and the residual vector.
 *   - The final frame reports the discovered coefficients or no relation.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface PslqIteration {
    pivot: number;
    residuals: number[];
    accumulator: number[][];
}

interface PslqResult {
    relation: number[] | null;
    iterations: PslqIteration[];
    error: number;
}

function identity(size: number): number[][] {
    return Array.from({ length: size + 1 }, (_unused, row) =>
        Array.from({ length: size + 1 }, (_unused2, col) => (row > 0 && col > 0 && row === col ? 1 : 0)),
    );
}

/** Bailey's PSLQ algorithm translated to double-precision arithmetic. */
function pslq(values: number[], tolerance: number, maxCoeff: number, maxSteps: number): PslqResult {
    const n = values.length;
    const iterations: PslqIteration[] = [];
    if (n < 2 || values.some((value) => !Number.isFinite(value) || value === 0)) {
        return { relation: null, iterations, error: 0 };
    }

    const g = Math.sqrt(4 / 3);
    const x = [0, ...values];
    const A = identity(n);
    const B = identity(n);
    const H = Array.from({ length: n + 1 }, () => new Array<number>(n + 1).fill(0));

    const s = new Array<number>(n + 1).fill(0);
    for (let k = 1; k <= n; k += 1) {
        let total = 0;
        for (let j = k; j <= n; j += 1) {
            total += (x[j] as number) * (x[j] as number);
        }
        s[k] = Math.sqrt(total);
    }
    const norm = s[1] as number;
    const y = new Array<number>(n + 1).fill(0);
    for (let k = 1; k <= n; k += 1) {
        y[k] = (x[k] as number) / norm;
        s[k] = (s[k] as number) / norm;
    }

    for (let i = 1; i <= n; i += 1) {
        if (i <= n - 1) {
            H[i][i] = (s[i] as number) ? (s[i + 1] as number) / (s[i] as number) : 0;
        }
        for (let j = 1; j < i; j += 1) {
            const denominator = (s[j] as number) * (s[j + 1] as number);
            H[i][j] = denominator ? -((y[i] as number) * (y[j] as number)) / denominator : 0;
        }
    }

    for (let i = 2; i <= n; i += 1) {
        for (let j = i - 1; j >= 1; j -= 1) {
            if (H[j][j] === 0) {
                continue;
            }
            const factor = Math.round((H[i][j] as number) / (H[j][j] as number));
            y[j] = (y[j] as number) + factor * (y[i] as number);
            for (let k = 1; k <= j; k += 1) {
                H[i][k] = (H[i][k] as number) - factor * (H[j][k] as number);
            }
            for (let k = 1; k <= n; k += 1) {
                A[i][k] = (A[i][k] as number) - factor * (A[j][k] as number);
                B[k][j] = (B[k][j] as number) + factor * (B[k][i] as number);
            }
        }
    }

    for (let repetition = 0; repetition < maxSteps; repetition += 1) {
        let pivot = -1;
        let largest = -1;
        for (let i = 1; i <= n - 1; i += 1) {
            const size = Math.pow(g, i) * Math.abs(H[i][i] as number);
            if (size > largest) {
                pivot = i;
                largest = size;
            }
        }
        if (pivot < 0) {
            break;
        }

        const next = pivot + 1;
        const swappedY = y[pivot] as number;
        y[pivot] = y[next] as number;
        y[next] = swappedY;
        for (let i = 1; i <= n; i += 1) {
            const swappedH = H[pivot][i] as number;
            H[pivot][i] = H[next][i] as number;
            H[next][i] = swappedH;
            const swappedA = A[pivot][i] as number;
            A[pivot][i] = A[next][i] as number;
            A[next][i] = swappedA;
        }
        for (let i = 1; i <= n; i += 1) {
            const swappedB = B[i][pivot] as number;
            B[i][pivot] = B[i][next] as number;
            B[i][next] = swappedB;
        }

        if (pivot <= n - 2) {
            const t0 = Math.hypot(H[pivot][pivot] as number, H[pivot][next] as number);
            if (t0 === 0) {
                break;
            }
            const c = (H[pivot][pivot] as number) / t0;
            const sn = (H[pivot][next] as number) / t0;
            for (let i = pivot; i <= n; i += 1) {
                const oldP = H[i][pivot] as number;
                const oldN = H[i][next] as number;
                H[i][pivot] = c * oldP + sn * oldN;
                H[i][next] = -sn * oldP + c * oldN;
            }
        }

        for (let i = next; i <= n; i += 1) {
            for (let j = Math.min(i - 1, next); j >= 1; j -= 1) {
                if (H[j][j] === 0) {
                    break;
                }
                const factor = Math.round((H[i][j] as number) / (H[j][j] as number));
                y[j] = (y[j] as number) + factor * (y[i] as number);
                for (let k = 1; k <= j; k += 1) {
                    H[i][k] = (H[i][k] as number) - factor * (H[j][k] as number);
                }
                for (let k = 1; k <= n; k += 1) {
                    A[i][k] = (A[i][k] as number) - factor * (A[j][k] as number);
                    B[k][j] = (B[k][j] as number) + factor * (B[k][i] as number);
                }
            }
        }

        iterations.push({
            pivot,
            residuals: y.slice(1),
            accumulator: B.slice(1).map((row) => row.slice(1)),
        });

        for (let i = 1; i <= n; i += 1) {
            if (Math.abs(y[i] as number) < tolerance) {
                const relation: number[] = [];
                for (let j = 1; j <= n; j += 1) {
                    relation.push(Math.round(B[j][i] as number));
                }
                if (relation.some((coefficient) => coefficient !== 0)
                    && Math.max(...relation.map(Math.abs)) < maxCoeff) {
                    return { relation, iterations, error: Math.abs(y[i] as number) };
                }
            }
        }

        let reciprocalNorm = 0;
        for (let i = 1; i <= n; i += 1) {
            for (let j = 1; j <= n; j += 1) {
                reciprocalNorm = Math.max(reciprocalNorm, Math.abs(H[i][j] as number));
            }
        }
        const lowerBound = reciprocalNorm ? 1 / (reciprocalNorm * 100) : Infinity;
        if (lowerBound >= maxCoeff) {
            break;
        }
    }

    return {
        relation: null,
        iterations,
        error: Math.min(...y.slice(1).map((value) => Math.abs(value))),
    };
}

function accumulatorCells(matrix: number[][]): VisualEntity[] {
    return matrix.flatMap((row, rowIndex) =>
        row.map((value, colIndex) => ({
            id: `cell-${rowIndex}-${colIndex}`,
            type: "cell" as const,
            label: String(Math.round(value)),
            value: Math.round(value),
            state: (rowIndex === colIndex ? "active" : "idle") as EntityState,
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: { row: rowIndex, col: colIndex },
        })),
    );
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { values?: number[]; maxSteps?: number; tolerance?: number } | null) ?? {};
    const values = Array.isArray(task.values)
        ? (task.values as number[]).map(Number).slice()
        : [1, 1.4142135623730951, 2.414213562373095];
    const tolerance = typeof task.tolerance === "number" && task.tolerance > 0 ? task.tolerance : 1e-10;
    const maxSteps = typeof task.maxSteps === "number" && task.maxSteps >= 1
        ? Math.floor(Math.min(task.maxSteps, 300))
        : 120;
    const n = values.length;
    const size = Math.max(n, 1);
    const result = pslq(values, tolerance, 1000, maxSteps);

    let step = 0;
    yield {
        stepNumber: step,
        entities: accumulatorCells(identity(size).slice(1).map((row) => row.slice(1))),
        edges: [],
        description: `Test ${n} real value(s) for a small integer relation using PSLQ.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: { rows: size, cols: size, phase: "setup", vector: values.slice(), n },
    };
    step += 1;

    for (const iteration of result.iterations) {
        yield {
            stepNumber: step,
            entities: accumulatorCells(iteration.accumulator),
            edges: [],
            description: `Iteration ${step - 1}: swapped pivot row ${iteration.pivot} with its neighbor and reduced the residual vector.`,
            codeLineNumber: 6,
            layout: "grid",
            meta: {
                rows: size,
                cols: size,
                phase: "iterate",
                pivot: iteration.pivot,
                residuals: iteration.residuals,
                n,
            },
        };
        step += 1;
    }

    const relation = result.relation;
    let dot = 0;
    if (relation) {
        relation.forEach((coefficient, index) => {
            dot += coefficient * (values[index] ?? 0);
        });
    }
    yield {
        stepNumber: step,
        entities: accumulatorCells(
            relation
                ? [relation]
                : identity(size).slice(1).map((row) => row.slice(1)),
        ),
        edges: [],
        description: relation
            ? `Found relation (${relation.join(", ")}) with residual ${result.error.toExponential(2)}.`
            : `No small integer relation found after ${result.iterations.length} iteration(s).`,
        codeLineNumber: relation ? 7 : 8,
        layout: "grid",
        meta: {
            rows: n > 0 && relation ? 1 : size,
            cols: n > 0 && relation ? n : size,
            phase: "done",
            found: relation !== null,
            relation: relation ?? [],
            residual: result.error,
            dot,
            n,
        },
    };
}

/** The PSLQ integer-relation module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "Given a list of real numbers, look for a small integer combination that cancels them to zero. PSLQ repeatedly reshapes the vector so one entry becomes tiny while tracking every integer row operation in a companion matrix. The moment a residual is small enough, the matching column of that matrix is the answer.",
        invariants: [
            "The orthogonal matrix stays orthogonal up to rounding as swaps and rotations are applied.",
            "The accumulator matrices record an integer unimodular change of basis at every step.",
            "A candidate relation always has integer coefficients bounded by the coefficient limit.",
            "The residual checked against tolerance is one entry of the transformed vector.",
        ],
        correctness:
            "Each PSLQ step applies an orthogonal transformation to the vector and the matching unimodular transformation to the accumulator, so the relation candidate always transforms back to the original coordinates. The algorithm drives the smallest residual toward zero monotonically in exact arithmetic. When a residual falls below tolerance and its coefficient column is bounded, that column gives a genuine integer relation to within the stated tolerance.",
        complexityRationale:
            "Each iteration swaps rows, applies one rotation over at most n rows, and size-reduces over O(n) row pairs, each touching O(n) matrix entries. That is O(n^2) work per step, and at most a fixed number of steps are attempted. The three n by n matrices dominate space at O(n^2).",
        uses: [
            "Finding minimal polynomials of algebraic constants",
            "Discovering Machin-like formulas for pi",
            "Detecting linear dependencies among experimental constants",
        ],
        references: [
            "Bailey, The PSLQ Integer Relation Algorithm, 1990",
            "Bailey and Broadhurst, Parallel Integer Relation Detection, 2000",
        ],
        workedExample:
            "For the vector (1, sqrt(2), 1 + sqrt(2)), PSLQ returns the coefficients (1, 1, -1). Their dot product is 1 + sqrt(2) minus (1 + sqrt(2)), which is zero. The residual after reduction is at the level of floating-point roundoff, so the relation is exact up to numerical precision.",
    },
    id: "integer-relation-pslq",
    name: "PSLQ Integer Relation Detection",
    category: "math",
    complexity: { time: "O(steps * n^2)", space: "O(n^2)" },
    defaultInput: {
        values: [1, 1.4142135623730951, 2.414213562373095],
        maxSteps: 120,
        tolerance: 1e-10,
    },
    visualType: "grid",
    run,
    pseudocode: [
        "read the vector of real numbers to test",
        "initialize the orthogonal and accumulator matrices to identity",
        "normalize the vector and fill the initial orthogonal matrix",
        "for each iteration up to the step limit",
        "choose the pivot row with the largest scaled diagonal entry",
        "swap that row with the next one and apply a rotation",
        "subtract rounded multiples of lower rows to reduce entries",
        "if a residual is below tolerance, return its integer coefficients",
        "done: report the relation or that none was found",
    ],
};

export default module;
