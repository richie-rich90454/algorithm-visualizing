/**
 * nonnegative-least-squares.ts - Nonnegative Least Squares (Lawson-Hanson)
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Nonnegative least squares minimizes the squared residual norm of A x - b
 * subject to every component of x being nonnegative. The Lawson-Hanson active
 * set method keeps a passive set of variables allowed to be positive. It
 * repeatedly brings in the variable with the most positive gradient, solves
 * the unconstrained problem on the passive set, and shortens the step whenever
 * a variable would cross below zero, removing it from the passive set.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(m n^2) per passive-set solve, up to 2^n set changes in theory
 *   Space: O(m n + n^2) for the design matrix and the normal equations
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Bars show the current coefficient vector x, one per variable.
 *   - The entering variable is gold, zero (active) variables are gray.
 *   - meta carries x, the passive set, the objective, and the iteration count.
 */

import type { AlgorithmModule, VisualEntity, VisualFrame } from "@/types";

const TOL = 1e-10;

/** Solve G s = c by Gaussian elimination with partial pivoting. */
function solveLinear(system: number[][], right: number[]): number[] {
    const n = right.length;
    const a = system.map((row, i) => [...row, right[i] ?? 0]);
    for (let col = 0; col < n; col += 1) {
        let pivot = col;
        for (let row = col + 1; row < n; row += 1) {
            if (Math.abs(a[row]![col] ?? 0) > Math.abs(a[pivot]![col] ?? 0)) pivot = row;
        }
        const tmp = a[col]!;
        a[col] = a[pivot]!;
        a[pivot] = tmp;
        const pivotValue = a[col]![col] ?? 1;
        if (Math.abs(pivotValue) < 1e-14) continue;
        for (let row = col + 1; row < n; row += 1) {
            const factor = (a[row]![col] ?? 0) / pivotValue;
            if (factor === 0) continue;
            for (let j = col; j <= n; j += 1) {
                a[row]![j] = (a[row]![j] ?? 0) - factor * (a[col]![j] ?? 0);
            }
        }
    }
    const result = Array.from({ length: n }, () => 0);
    for (let row = n - 1; row >= 0; row -= 1) {
        let sum = a[row]![n] ?? 0;
        for (let j = row + 1; j < n; j += 1) sum -= (a[row]![j] ?? 0) * (result[j] ?? 0);
        result[row] = sum / (a[row]![row] ?? 1);
    }
    return result;
}

/** Solve the unconstrained least-squares problem restricted to the passive set. */
function passiveSolve(a: number[][], b: number[], passive: number[]): number[] {
    const k = passive.length;
    if (k === 0) return [];
    const gram = Array.from({ length: k }, () => Array.from({ length: k }, () => 0));
    const rhs = Array.from({ length: k }, () => 0);
    for (let i = 0; i < k; i += 1) {
        for (let j = 0; j < k; j += 1) {
            let value = 0;
            for (let row = 0; row < a.length; row += 1) {
                value += (a[row]?.[passive[i]!] ?? 0) * (a[row]?.[passive[j]!] ?? 0);
            }
            gram[i]![j] = value;
        }
        gram[i]![i] = (gram[i]![i] ?? 0) + 1e-12;
        let value = 0;
        for (let row = 0; row < a.length; row += 1) {
            value += (a[row]?.[passive[i]!] ?? 0) * (b[row] ?? 0);
        }
        rhs[i] = value;
    }
    return solveLinear(gram, rhs);
}

function residual(a: number[][], b: number[], x: number[]): number[] {
    return b.map((bi, row) => {
        let value = bi;
        for (let col = 0; col < x.length; col += 1) {
            value -= (a[row]?.[col] ?? 0) * (x[col] ?? 0);
        }
        return value;
    });
}

function gradient(a: number[][], r: number[]): number[] {
    return Array.from({ length: a[0]?.length ?? 0 }, (_, col) => {
        let value = 0;
        for (let row = 0; row < a.length; row += 1) value += (a[row]?.[col] ?? 0) * (r[row] ?? 0);
        return value;
    });
}

function makeBars(x: number[], passive: number[], entering: number): VisualEntity[] {
    return x.map((value, index) => {
        let state: "comparing" | "sorted" | "idle" = "idle";
        if (index === entering) {
            state = "comparing";
        } else if (passive.includes(index) && value > TOL) {
            state = "sorted";
        }
        return {
            id: `bar-${index}`,
            type: "bar" as const,
            label: value.toFixed(3),
            value,
            state,
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: { index, passive: passive.includes(index) },
        };
    });
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { matrix?: number[][]; vector?: number[] } | null) ?? {};
    const rawA = Array.isArray(task.matrix) ? task.matrix : [];
    const a: number[][] =
        rawA.length > 0
            ? rawA.map((row) => (Array.isArray(row) ? row.map((v) => Number(v)) : []))
            : [
                  [1, 1],
                  [1, 2],
                  [1, 3],
                  [1, 4],
              ];
    const rawB = Array.isArray(task.vector) ? task.vector : [];
    const b: number[] =
        rawB.length > 0 ? rawB.map((v) => Number(v)) : [1, 2, 2, 3];
    const n = a[0]?.length ?? 0;
    const x = Array.from({ length: n }, () => 0);
    let passive: number[] = [];
    let active = Array.from({ length: n }, (_, i) => i);
    let iteration = 0;
    let entering = -1;

    const objective = () => {
        const r = residual(a, b, x);
        return r.reduce((sum, value) => sum + value * value, 0);
    };

    let step = 0;
    yield {
        stepNumber: step,
        entities: makeBars(x, passive, entering),
        edges: [],
        description: `Start with x = 0; all ${n} variables are active and fixed at zero.`,
        codeLineNumber: 0,
        layout: "array",
        meta: {
            n,
            x: x.slice(),
            passive: passive.slice(),
            active: active.slice(),
            objective: objective(),
            iteration,
        },
    };
    step += 1;

    while (active.length > 0 && iteration < 4 * n + 4) {
        const w = gradient(a, residual(a, b, x));
        let best = -1;
        let bestValue = TOL;
        for (const index of active) {
            const value = w[index] ?? 0;
            if (value > bestValue) {
                bestValue = value;
                best = index;
            }
        }
        if (best < 0) break;
        entering = best;
        passive.push(best);
        active = active.filter((index) => index !== best);
        iteration += 1;

        for (let inner = 0; inner < n + 2; inner += 1) {
            const s = passiveSolve(a, b, passive);
            let hasNegative = false;
            for (const value of s) {
                if (value < -TOL) {
                    hasNegative = true;
                    break;
                }
            }
            if (!hasNegative) {
                for (let k = 0; k < passive.length; k += 1) x[passive[k]!] = s[k] ?? 0;
                for (const index of active) x[index] = 0;
                break;
            }
            let alpha = Infinity;
            for (let k = 0; k < passive.length; k += 1) {
                const sk = s[k] ?? 0;
                if (sk < 0) {
                    const xk = x[passive[k]!] ?? 0;
                    alpha = Math.min(alpha, xk / (xk - sk));
                }
            }
            if (!Number.isFinite(alpha)) {
                for (let k = 0; k < passive.length; k += 1) x[passive[k]!] = Math.max(0, s[k] ?? 0);
                break;
            }
            for (let k = 0; k < passive.length; k += 1) {
                const idx = passive[k]!;
                x[idx] = (x[idx] ?? 0) + alpha * ((s[k] ?? 0) - (x[idx] ?? 0));
            }
            const removed = passive.filter((idx) => (x[idx] ?? 0) <= TOL);
            if (removed.length === 0) {
                for (let k = 0; k < passive.length; k += 1) x[passive[k]!] = s[k] ?? 0;
                break;
            }
            passive = passive.filter((idx) => !removed.includes(idx));
            active = active.concat(removed).sort((p, q) => p - q);
            for (const idx of removed) x[idx] = 0;
        }

        yield {
            stepNumber: step,
            entities: makeBars(x, passive, entering),
            edges: [],
            description: `Iteration ${iteration}: bring variable ${entering} into the passive set; ${passive.length} variables may be positive.`,
            codeLineNumber: 2,
            layout: "array",
            meta: {
                n,
                x: x.slice(),
                passive: passive.slice(),
                active: active.slice(),
                objective: objective(),
                iteration,
                entering,
            },
        };
        step += 1;
    }

    yield {
        stepNumber: step,
        entities: makeBars(x, passive, -1),
        edges: [],
        description: `Optimal nonnegative solution found with objective ${objective().toExponential(3)} after ${iteration} variable entrance(s).`,
        codeLineNumber: 7,
        layout: "array",
        meta: {
            n,
            x: x.slice(),
            passive: passive.slice(),
            active: active.slice(),
            objective: objective(),
            iteration,
        },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Think of the nonnegative constraint as a fence: most variables are pinned at zero until the data gives a strong reason to free them. The algorithm frees the variable whose release would reduce the error the most, solves the small unconstrained problem among freed variables, and pushes any variable that would cross below zero back to the fence. It repeats until no pinned variable wants to move.",
        invariants: [
            "Every coefficient stays nonnegative throughout the run.",
            "Variables in the active set are exactly those fixed at zero.",
            "The passive-set solution minimizes the residual over the currently free variables.",
        ],
        correctness:
            "When the loop stops, the gradient is nonpositive on every active variable (so freeing any of them cannot reduce the error) and the gradient is zero on the passive variables because they solve the unrestricted least-squares problem there. These are exactly the Karush-Kuhn-Tucker conditions for minimizing a convex quadratic over the nonnegative orthant, so the solution is the global minimum. Each inner step keeps feasibility by shortening the move before any variable turns negative.",
        complexityRationale:
            "Solving the passive problem forms an n by n normal-equation system and eliminates it, costing O(m n^2) for m rows. Although the active set could in principle change exponentially often, it typically changes only a handful of times. Storage is O(m n + n^2).",
        uses: [
            "Spectral unmixing where abundances cannot be negative",
            "Portfolio weights without short positions",
            "Image deconvolution and nonnegative matrix factorization subproblems",
        ],
        references: [
            "Lawson and Hanson, Solving Least Squares Problems, Chapter 23",
            "Nocedal and Wright, Numerical Optimization, Chapter 16",
        ],
        workedExample:
            "For A with rows [1,1], [1,2], [1,3] and b = [1,2,2], both gradients at x = 0 are positive. The first variable enters and gives x = (1.8, 0); the second gradient is then negative at the optimum, so the algorithm stops. The second column is left pinned at zero and the residual objective is about 0.4.",
    },
    id: "nonnegative-least-squares",
    name: "Nonnegative Least Squares",
    category: "numerical-optimization",
    complexity: { time: "O(m n^2) per solve", space: "O(m n + n^2)" },
    defaultInput: {
        matrix: [
            [1, 1],
            [1, 2],
            [1, 3],
            [1, 4],
        ],
        vector: [1, 2, 2, 3],
    },
    visualType: "array",
    run,
    pseudocode: [
        "start with x = 0, all variables active, and no passive variables",
        "compute the gradient of half the squared residual",
        "choose the active variable with the largest positive gradient",
        "move it to the passive set and solve least squares on that set",
        "if any solution component is negative find the largest feasible step",
        "shorten the step and return newly zero variables to the active set",
        "recompute the gradient and repeat",
        "stop when no active variable has a positive gradient",
        "done: report the nonnegative minimizer and its objective",
    ],
};

export default module;
