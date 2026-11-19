/**
 * pade-approximant.ts - Padé Approximant of the Exponential
 *
 * Builds the [m/n] rational Padé approximant to the exponential power series
 * by solving a small linear system for the denominator coefficients, then
 * forming the numerator by convolution. The result matches the series through
 * order m+n, which is twice the order a Taylor polynomial of the same size
 * would match.
 *
 *   Time:  O((m+n)^3) for the linear solve
 *   Space: O((m+n)^2)
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface PadeInput {
    m?: number;
    n?: number;
}

function expSeries(upTo: number): number[] {
    const coefficients = [1];
    let factorial = 1;
    for (let k = 1; k <= upTo; k += 1) {
        factorial *= k;
        coefficients.push(1 / factorial);
    }
    return coefficients;
}

function solveLinear(matrix: number[][], rhs: number[]): number[] {
    const size = rhs.length;
    const a = matrix.map((row, i) => [...row, rhs[i] ?? 0]);
    for (let col = 0; col < size; col += 1) {
        let pivot = col;
        for (let row = col + 1; row < size; row += 1) {
            if (Math.abs(a[row]?.[col] ?? 0) > Math.abs(a[pivot]?.[col] ?? 0)) pivot = row;
        }
        const temp = a[col]!;
        a[col] = a[pivot]!;
        a[pivot] = temp;
        const pivotValue = a[col]?.[col] ?? 0;
        for (let row = col + 1; row < size; row += 1) {
            const factor = (a[row]?.[col] ?? 0) / (pivotValue || 1);
            for (let j = col; j <= size; j += 1) {
                a[row]![j] = (a[row]![j] ?? 0) - factor * (a[col]![j] ?? 0);
            }
        }
    }
    const solution = new Array<number>(size).fill(0);
    for (let row = size - 1; row >= 0; row -= 1) {
        let value = a[row]?.[size] ?? 0;
        for (let j = row + 1; j < size; j += 1) {
            value -= (a[row]![j] ?? 0) * (solution[j] ?? 0);
        }
        solution[row] = value / (a[row]?.[row] || 1);
    }
    return solution;
}

function makeEntities(system: number[][], rhs: number[], solved: boolean): VisualEntity[] {
    const entities: VisualEntity[] = [];
    for (let r = 0; r < system.length; r += 1) {
        for (let c = 0; c < (system[r]?.length ?? 0); c += 1) {
            entities.push({
                id: `cell-${r}-${c}`,
                type: "cell" as const,
                label: (system[r]?.[c] ?? 0).toFixed(4),
                value: system[r]?.[c] ?? 0,
                state: (solved ? "sorted" : c === system[r]?.length - 1 ? "comparing" : "idle") as EntityState,
                x: 0,
                y: 0,
                width: 0,
                height: 0,
                metadata: { row: r, col: c },
            });
        }
        entities.push({
            id: `rhs-${r}`,
            type: "cell" as const,
            label: (rhs[r] ?? 0).toFixed(4),
            value: rhs[r] ?? 0,
            state: (solved ? "sorted" : "active") as EntityState,
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: { row: r, col: system[r]?.length ?? 0 },
        });
    }
    return entities;
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as PadeInput | null) ?? {};
    const m = typeof task.m === "number" && task.m >= 1 && task.m <= 4 ? Math.trunc(task.m) : 2;
    const n = typeof task.n === "number" && task.n >= 1 && task.n <= 4 ? Math.trunc(task.n) : 2;
    const order = m + n;
    const c = expSeries(order);
    const system: number[][] = [];
    const rhs: number[] = [];
    for (let i = 1; i <= n; i += 1) {
        const row: number[] = [];
        for (let j = 1; j <= n; j += 1) {
            row.push(c[m + i - j] ?? 0);
        }
        system.push(row);
        rhs.push(-(c[m + i] ?? 0));
    }
    const qTail = solveLinear(system, rhs);
    const q = [1, ...qTail];
    const p: number[] = [];
    for (let k = 0; k <= m; k += 1) {
        let value = 0;
        for (let j = 0; j <= Math.min(k, n); j += 1) {
            value += (c[k - j] ?? 0) * (q[j] ?? 0);
        }
        p.push(value);
    }
    let maxMismatch = 0;
    for (let k = 0; k <= order; k += 1) {
        let convolution = 0;
        for (let j = 0; j <= Math.min(k, n); j += 1) {
            convolution += (q[j] ?? 0) * (c[k - j] ?? 0);
        }
        const expected = k <= m ? (p[k] ?? 0) : 0;
        maxMismatch = Math.max(maxMismatch, Math.abs(convolution - expected));
    }

    let step = 0;
    yield {
        stepNumber: step,
        entities: makeEntities(system, rhs, false),
        edges: [],
        description: `Build the [${m}/${n}] Padé system from exponential series coefficients through order ${order}.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: { rows: n, cols: n + 1, m, n, order, solved: false },
    };
    step += 1;

    for (let i = 0; i < n; i += 1) {
        yield {
            stepNumber: step,
            entities: makeEntities(system, rhs, false).map((entity) =>
                entity.metadata["row"] === i ? { ...entity, state: "comparing" as EntityState } : entity,
            ),
            edges: [],
            description: `Elimination row ${i + 1}: solve for denominator coefficient q${i + 1}.`,
            codeLineNumber: 1,
            layout: "grid",
            meta: { rows: n, cols: n + 1, m, n, order, row: i, solved: false },
        };
        step += 1;
    }

    yield {
        stepNumber: step,
        entities: makeEntities(system, rhs, true),
        edges: [],
        description: `Done: numerator ${p.map((v) => v.toFixed(4)).join(", ")} and denominator ${q.map((v) => v.toFixed(4)).join(", ")} match order ${order} within ${maxMismatch.toExponential(2)}.`,
        codeLineNumber: 4,
        layout: "grid",
        meta: { rows: n + 1, cols: Math.max(n + 1, m + 1), m, n, order, numerator: p, denominator: q, maxMismatch, solved: true },
    };
}

const module: AlgorithmModule = {
    id: "pade-approximant",
    name: "Padé Approximant",
    category: "math",
    complexity: { time: "O((m+n)^3)", space: "O((m+n)^2)" },
    defaultInput: { m: 2, n: 2 },
    visualType: "grid",
    run,
    pseudocode: [
        "write the exponential series coefficients c0 through c(m+n)",
        "for i = 1..n set row i of the system to c(m+i-j) for j = 1..n",
        "set the right-hand side of row i to minus c(m+i)",
        "solve the system by Gaussian elimination for q1 through qn with q0 = 1",
        "form pk = sum over j of c(k-j) times qj for k = 0..m",
        "done: report the numerator p and denominator q",
    ],
    education: {
        intuition:
            "A Taylor polynomial matches a function's derivatives at one point, but a rational function can do better with the same number of terms. A Padé approximant chooses a numerator and denominator so that their quotient agrees with the series as far out as possible, effectively reusing higher-order information hidden in the lower coefficients.",
        invariants: [
            "The denominator constant term q0 equals one.",
            "The convolution of numerator and series agrees with the denominator times the series through order m+n.",
            "For the exponential the coefficients are reciprocals of factorials.",
        ],
        correctness:
            "The Padé conditions require that q(x) times the series minus p(x) has zero coefficients through degree m+n. Writing those conditions for degrees m+1 through m+n gives a linear system for q1 through qn; the remaining lower degrees then define p by convolution. Gaussian elimination with partial pivoting solves that system exactly up to roundoff, so the constructed pair satisfies all matching conditions, which the test verifies by direct convolution.",
        complexityRationale:
            "The denominator system is n by n and Gaussian elimination on it costs O(n^3), while series generation and convolution cost O(m+n). Storing the system uses O(n^2) space.",
        uses: [
            "High-accuracy function evaluation in numerical libraries",
            "Model order reduction of transfer functions in control theory",
            "Diagonal Padé schemes for stiff differential equations",
        ],
        references: [
            "Baker and Graves-Morris, Padé Approximants",
            "Wikipedia, Padé approximant",
        ],
        workedExample:
            "For exp(x) with m = n = 2 the series is 1 + x + x^2/2 + x^3/6 + x^4/24. Solving gives q = (1, -1/2, 1/12) and p = (1, 1/2, 1/12), so the approximant is (1 + x/2 + x^2/12) / (1 - x/2 + x^2/12), which matches exp through order four.",
    },
};

export default module;
