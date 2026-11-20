/**
 * anderson-acceleration.ts - Anderson Acceleration for Fixed Points
 *
 * Anderson acceleration speeds up a slowly converging fixed-point iteration.
 * Instead of using only the newest iterate, it keeps a short history of
 * residuals and chooses a linear combination whose residual has the smallest
 * norm, under the constraint that the mixing coefficients sum to one. The next
 * iterate is the same combination of the stored fixed-point images.
 *
 * The demo uses a linear map g(x) = A x + b whose exact fixed point is solved
 * directly, so the speedup over plain iteration is measurable.
 *
 * Limits of the demo: A is a small square matrix with an invertible I minus A,
 * and the mixing least-squares problem is solved by normal equations with a
 * damping term for numerical safety.
 *
 * Time: O(iterations * (d^2 + m^3)) for memory m; Space: O(m d).
 */

import type { AlgorithmModule, VisualEntity, VisualFrame } from "@/types";

type Matrix = number[][];

function matVec(A: Matrix, x: number[]): number[] {
    return A.map((row) => row.reduce((sum, aij, j) => sum + aij * (x[j] as number), 0));
}

function add(a: number[], b: number[]): number[] {
    return a.map((v, i) => v + (b[i] as number));
}

function sub(a: number[], b: number[]): number[] {
    return a.map((v, i) => v - (b[i] as number));
}

function scale(a: number[], s: number): number[] {
    return a.map((v) => v * s);
}

function dot(a: number[], b: number[]): number {
    return a.reduce((sum, v, i) => sum + v * (b[i] as number), 0);
}

/** Solve (M + lambda I) z = rhs by Gaussian elimination with pivoting. */
function solveLinear(M: Matrix, rhs: number[], lambda: number): number[] | null {
    const d = rhs.length;
    const A = M.map((row, i) =>
        row.map((v, j) => v + (i === j ? lambda : 0)),
    );
    const b = rhs.slice();
    for (let col = 0; col < d; col += 1) {
        let pivot = col;
        for (let r = col + 1; r < d; r += 1) {
            if (Math.abs((A[r] as number[])[col] as number) > Math.abs((A[pivot] as number[])[col] as number)) {
                pivot = r;
            }
        }
        if (Math.abs((A[pivot] as number[])[col] as number) < 1e-14) {
            return null;
        }
        [A[col], A[pivot]] = [A[pivot] as number[], A[col] as number[]];
        [b[col], b[pivot]] = [b[pivot] as number, b[col] as number];
        const pivotValue = (A[col] as number[])[col] as number;
        for (let r = col + 1; r < d; r += 1) {
            const factor = ((A[r] as number[])[col] as number) / pivotValue;
            for (let c = col; c < d; c += 1) {
                (A[r] as number[])[c] = ((A[r] as number[])[c] as number) - factor * ((A[col] as number[])[c] as number);
            }
            b[r] = (b[r] as number) - factor * (b[col] as number);
        }
    }
    const z = new Array<number>(d).fill(0);
    for (let i = d - 1; i >= 0; i -= 1) {
        let sum = b[i] as number;
        for (let j = i + 1; j < d; j += 1) {
            sum -= ((A[i] as number[])[j] as number) * (z[j] as number);
        }
        z[i] = sum / ((A[i] as number[])[i] as number);
    }
    return z;
}

/** Exact fixed point of g(x) = A x + b by solving (I - A)x = b. */
function exactFixedPoint(A: Matrix, b: number[]): number[] | null {
    const d = b.length;
    const M: Matrix = A.map((row, i) =>
        row.map((v, j) => v + (i === j ? -1 : 0)),
    );
    return solveLinear(M, b.map((v) => -v), 0);
}

function makeBars(x: number[], residual: number): VisualEntity[] {
    return x.map((value, index) => ({
        id: `bar-${index}`,
        type: "bar" as const,
        label: `x${index}=${value.toFixed(5)}`,
        value,
        state: residual < 1e-6 ? ("sorted" as const) : ("comparing" as const),
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { index, residual },
    }));
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (
        input as { matrix?: Matrix; offset?: number[]; initial?: number[]; memory?: number; iterations?: number; damping?: number }
        | null
    ) ?? {};
    const A: Matrix = task.matrix ?? [
        [0.85, 0.12],
        [-0.1, 0.8],
    ];
    const b: number[] = task.offset ?? [0.4, -0.3];
    const d = b.length;
    const memory = Math.max(1, Math.min(6, Math.floor(Number(task.memory ?? 3)) || 3));
    const iterations = Math.max(1, Math.floor(Number(task.iterations ?? 12)) || 12);
    const damping = Math.max(0, Number(task.damping ?? 1e-8));
    let x: number[] = task.initial && task.initial.length === d
        ? task.initial.slice()
        : new Array<number>(d).fill(0);

    const g = (v: number[]) => add(matVec(A, v), b);
    let step = 0;

    yield {
        stepNumber: step,
        entities: makeBars(x, Number.POSITIVE_INFINITY),
        edges: [],
        description: `Start Anderson acceleration with memory ${memory} on a ${d}-dimensional affine fixed point.`,
        codeLineNumber: 0,
        layout: "array",
        meta: { x: x.slice(), memory, iterations, dimension: d },
    };
    step += 1;

    const historyX: number[][] = [];
    const historyG: number[][] = [];
    const historyF: number[][] = [];

    for (let k = 0; k < iterations; k += 1) {
        const gx = g(x);
        const fx = sub(gx, x);
        historyX.push(x.slice());
        historyG.push(gx.slice());
        historyF.push(fx.slice());
        if (historyF.length > memory) {
            historyF.shift();
            historyG.shift();
            historyX.shift();
        }

        let next: number[];
        let mode: "anderson" | "picard" = "picard";
        const m = historyF.length;
        if (m >= 2) {
            // Minimize || sum alpha_i f_i || subject to sum alpha_i = 1.
            // Solve with a Lagrange multiplier on the sum constraint.
            const size = m + 1;
            const M: Matrix = Array.from({ length: size }, () => new Array<number>(size).fill(0));
            const rhs = new Array<number>(size).fill(0);
            for (let i = 0; i < m; i += 1) {
                for (let j = 0; j < m; j += 1) {
                    M[i]![j] = 2 * dot(historyF[i] as number[], historyF[j] as number[]);
                }
                M[i]![m] = 1;
                M[m]![i] = 1;
                rhs[i] = 0;
            }
            rhs[m] = 1;
            const alphas = solveLinear(M, rhs, damping);
            if (alphas) {
                const maxIdx = m - 1;
                const free = alphas.slice(0, maxIdx);
                const last = 1 - free.reduce((s, v) => s + v, 0);
                const full = [...free, last];
                const mixX = new Array<number>(d).fill(0);
                for (let i = 0; i < m; i += 1) {
                    const xi = historyX[i] as number[];
                    for (let j = 0; j < d; j += 1) {
                        mixX[j] = (mixX[j] as number) + (full[i] as number) * (xi[j] as number);
                    }
                }
                // Apply one additional fixed-point map to the mixed point.
                next = g(mixX);
                mode = "anderson";
            } else {
                next = gx;
            }
        } else {
            next = gx;
        }

        x = next;
        const residual = Math.sqrt(dot(sub(g(x), x), sub(g(x), x)));
        yield {
            stepNumber: step,
            entities: makeBars(x, residual),
            edges: [],
            description: `Iteration ${k + 1} used a ${mode} step; residual norm ${residual.toExponential(3)}.`,
            codeLineNumber: mode === "anderson" ? 6 : 3,
            layout: "array",
            meta: {
                x: x.slice(),
                residual,
                iteration: k + 1,
                mode,
                historySize: historyF.length,
            },
        };
        step += 1;
    }

    const exact = exactFixedPoint(A, b);
    const residual = Math.sqrt(dot(sub(g(x), x), sub(g(x), x)));
    yield {
        stepNumber: step,
        entities: makeBars(x, residual),
        edges: [],
        description: `Finished with residual ${residual.toExponential(3)}; the exact fixed point is ${exact ? exact.map((v) => v.toFixed(5)).join(", ") : "unavailable"}.`,
        codeLineNumber: 7,
        layout: "array",
        meta: {
            x: x.slice(),
            residual,
            exact,
            error: exact ? Math.sqrt(dot(sub(x, exact), sub(x, exact))) : null,
            iterations,
        },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "A plain fixed-point iteration throws away all but the newest estimate. Anderson acceleration remembers a few recent iterates and their residuals, then picks the combination whose residual is smallest. Because a fixed point has zero residual, minimizing the residual across history pulls the next estimate much closer to the answer than a single step can.",
        invariants: [
            "The mixing coefficients always sum to one, so a true fixed-point history reproduces itself exactly.",
            "The stored history never exceeds the configured memory limit.",
            "The affine map g(x)=Ax+b has a unique fixed point whenever I minus A is invertible.",
        ],
        correctness:
            "If every stored iterate equals the fixed point, each residual is zero and the constrained least-squares problem returns any convex combination that is again the fixed point, so the fixed point is a fixed point of the accelerated iteration. For an affine map the residual is linear in the iterate; minimizing its norm over the stored history is a strictly convex quadratic, and the normal equations with the sum constraint find the unique minimizer, which cannot have a larger residual than the newest iterate alone.",
        complexityRationale:
            "Each step forms at most m residuals, assembles an (m+1) by (m+1) Gram system and solves it by elimination, costing O(d^2 + m^3) for dimension d and memory m; storing the history costs O(m d).",
        uses: [
            "Accelerating self-consistent field iterations in quantum chemistry",
            "Converging fixed-point solvers in computational finance and physics",
            "Speeding up iterative linear and nonlinear equation solvers",
        ],
        references: [
            "Anderson, Iterative Procedures for Nonlinear Integral Equations, JACM 1965",
            "Pollock, Rebholz and Xiao, Anderson Acceleration for Fixed-Point Iterations, SIAM 2019",
        ],
        workedExample:
            "For x = 0.85 x + 0.4 in one dimension the exact fixed point is 8/3. Starting at zero, plain iteration reaches about 2.43 after twelve steps. Anderson with a two-step memory fits a combination of the recent residuals and lands visibly closer in the same number of steps.",
    },
    id: "anderson-acceleration",
    name: "Anderson Acceleration",
    category: "numerical-optimization",
    complexity: { time: "O(iterations * (d^2 + m^3))", space: "O(m d)" },
    defaultInput: {
        matrix: [
            [0.85, 0.12],
            [-0.1, 0.8],
        ],
        offset: [0.4, -0.3],
        initial: [0, 0],
        memory: 3,
        iterations: 12,
    },
    visualType: "array",
    run,
    pseudocode: [
        "read the affine map, start point, memory and step limit",
        "apply the map to the start point and store its residual",
        "for each iteration",
        "append the current point, image and residual to the history",
        "if history has at least two entries solve the constrained least squares",
        "combine the stored points and apply one more map step",
        "otherwise use the plain fixed-point image",
        "record the residual and stop after the step limit",
    ],
};

export default module;
