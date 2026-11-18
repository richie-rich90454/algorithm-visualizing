/**
 * trotter-suzuki-decomposition.ts - Trotter-Suzuki Product Formulas
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Simulating a quantum system whose Hamiltonian is a sum of noncommuting parts
 * is hard because the exact exponential of the sum is not the product of the
 * exponentials. Trotter-Suzuki formulas approximate it by alternating short
 * exponentials of each part. The first-order formula repeats exp(A/n)exp(B/n)
 * n times; the second-order (Strang) formula symmetrizes each slice, cutting
 * the error from O(1/n) to O(1/n squared). This module demonstrates both on a
 * two-level system with Pauli X and Z Hamiltonians.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(n) matrix products for n Trotter slices
 *   Space: O(1) for the two-by-two matrices
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - One bar per slice count shows the operator-norm error at that count.
 *   - The newest error is highlighted so the convergence trend is visible.
 *   - Frame metadata carries the exact matrix, the product matrix, and the
 *     error at each slice count for independent checking.
 *
 * This is an exact small matrix simulation on a two-dimensional Hilbert space.
 * Real simulations use large sparse Hamiltonians and hardware gate sequences;
 * neither noise nor gate compilation is modeled here.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

type Complex = [number, number];
type Matrix = [[Complex, Complex], [Complex, Complex]];

function cmul(a: Complex, b: Complex): Complex {
    return [a[0] * b[0] - a[1] * b[1], a[0] * b[1] + a[1] * b[0]];
}

function csub(a: Complex, b: Complex): Complex {
    return [a[0] - b[0], a[1] - b[1]];
}

function cabs(a: Complex): number {
    return Math.hypot(a[0], a[1]);
}

function matMul(a: Matrix, b: Matrix): Matrix {
    const out = [[[0, 0], [0, 0]], [[0, 0], [0, 0]]] as Matrix;
    for (let i = 0; i < 2; i += 1) {
        for (let j = 0; j < 2; j += 1) {
            out[i]![j] = cadd(cmul(a[i]![0]!, b[0]![j]!), cmul(a[i]![1]!, b[1]![j]!));
        }
    }
    return out;
}

function cadd(a: Complex, b: Complex): Complex {
    return [a[0] + b[0], a[1] + b[1]];
}

function expX(angle: number): Matrix {
    const c = Math.cos(angle);
    const s = Math.sin(angle);
    return [
        [[c, 0], [0, -s]],
        [[0, -s], [c, 0]],
    ];
}

function expZ(angle: number): Matrix {
    const c = Math.cos(angle);
    const s = Math.sin(angle);
    return [
        [[c, -s], [0, 0]],
        [[0, 0], [c, s]],
    ];
}

function exactEvolution(a: number, b: number, t: number): Matrix {
    const magnitude = Math.hypot(a, b);
    if (magnitude < 1e-15) {
        return [
            [[1, 0], [0, 0]],
            [[0, 0], [1, 0]],
        ];
    }
    const c = Math.cos(magnitude * t);
    const s = Math.sin(magnitude * t) / magnitude;
    return [
        [[c, -s * b], [0, -s * a]],
        [[0, -s * a], [c, s * b]],
    ];
}

function product(a: number, b: number, t: number, n: number, order: number): Matrix {
    let step: Matrix;
    if (order === 2) {
        const half = expX((a * t) / (2 * n));
        const middle = expZ((b * t) / n);
        step = matMul(matMul(half, middle), half);
    } else {
        step = matMul(expX((a * t) / n), expZ((b * t) / n));
    }
    let result: Matrix = [
        [[1, 0], [0, 0]],
        [[0, 0], [1, 0]],
    ];
    for (let i = 0; i < n; i += 1) {
        result = matMul(result, step);
    }
    return result;
}

function operatorError(approx: Matrix, exact: Matrix): number {
    let worst = 0;
    for (let i = 0; i < 2; i += 1) {
        for (let j = 0; j < 2; j += 1) {
            worst = Math.max(worst, cabs(csub(approx[i]![j]!, exact[i]![j]!)));
        }
    }
    return worst;
}

function flat(matrix: Matrix): string[] {
    return matrix.flat().map((c) => `${c[0].toFixed(6)}${c[1] >= 0 ? "+" : ""}${c[1].toFixed(6)}i`);
}

function makeBars(counts: number[], errors: number[], active: number): VisualEntity[] {
    return counts.map((n, i) => ({
        id: `bar-${n}`,
        type: "bar" as const,
        label: `n=${n} error=${(errors[i] ?? 0).toExponential(2)}`,
        value: errors[i] ?? 0,
        state: i === active ? "comparing" : errors[i]! < 1e-3 ? "sorted" : "idle",
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { n, error: errors[i] ?? 0 },
    }));
}

/** The Trotter-Suzuki generator. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { a?: number; b?: number; time?: number; order?: number; slices?: number[] } | null) ?? {};
    const a = typeof task.a === "number" ? task.a : 1;
    const b = typeof task.b === "number" ? task.b : 0.7;
    const t = typeof task.time === "number" ? task.time : 1;
    const order = task.order === 2 ? 2 : 1;
    const counts: number[] = Array.isArray(task.slices) && task.slices.length > 0
        ? task.slices.map((n) => Math.max(1, Math.floor(n)))
        : [1, 2, 4, 8, 16];
    const exact = exactEvolution(a, b, t);
    const errors: number[] = [];
    let step = 0;

    yield {
        stepNumber: step,
        entities: makeBars(counts, errors, -1),
        edges: [],
        description: `Comparing the ${order === 1 ? "first" : "second"} order Trotter product with the exact exp(-i(aX+bZ)t).`,
        codeLineNumber: 0,
        layout: "array",
        meta: { order, a, b, time: t, errors: [], exact: flat(exact), slices: counts },
    };
    step += 1;

    for (let i = 0; i < counts.length; i += 1) {
        const n = counts[i]!;
        const approx = product(a, b, t, n, order);
        const error = operatorError(approx, exact);
        errors.push(error);
        yield {
            stepNumber: step,
            entities: makeBars(counts, errors, i),
            edges: [],
            description: `With ${n} slice(s) the product differs from the exact evolution by ${error.toExponential(3)}.`,
            codeLineNumber: order === 1 ? 3 : 4,
            layout: "array",
            meta: {
                order,
                a,
                b,
                time: t,
                errors: [...errors],
                slices: counts,
                exact: flat(exact),
                approx: flat(approx),
                currentSlice: n,
            },
        };
        step += 1;
    }

    const first = errors[0] ?? 0;
    const last = errors[errors.length - 1] ?? 0;
    yield {
        stepNumber: step,
        entities: makeBars(counts, errors, -1),
        edges: [],
        description: `Error fell from ${first.toExponential(2)} to ${last.toExponential(2)} as slices increased.`,
        codeLineNumber: 6,
        layout: "array",
        meta: { order, errors: [...errors], slices: counts, done: true, exact: flat(exact) },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "The exponential of a sum of two operators is not the product of their exponentials when the operators do not commute. Trotter's idea is to split the time evolution into many tiny slices and alternate the two exponentials inside each slice. The finer the slices, the more the neglected commutator terms shrink, so the product converges to the true evolution. A symmetric arrangement of the slices cancels the leading error term.",
        invariants: [
            "Every Trotter factor is a unitary exponential of a Hermitian operator.",
            "The product approaches the exact evolution as the slice count grows.",
            "The second-order formula has error proportional to one over n squared.",
        ],
        correctness:
            "The Baker-Campbell-Hausdorff formula expands the product of exponentials as the exponential of the sum plus commutator corrections. Each first-order slice has leading error proportional to the time step, so n slices give O(1/n); pairing a half step of A around a step of B cancels the odd commutator terms, leaving O(1/n squared). For the two-by-two Pauli example the exact exponential is available in closed form, so the reported error is the true operator-norm difference.",
        complexityRationale:
            "Each slice needs a constant number of two-by-two matrix products, so n slices take O(n) time and O(1) memory. General sparse Hamiltonians replace the constant-size matrices with large operators, but the same slice count controls the error.",
        uses: [
            "Simulating quantum many-body Hamiltonians on quantum processors",
            "Time evolution in quantum chemistry and materials calculations",
            "Building blocks of quantum phase estimation and amplitude estimation",
        ],
        references: [
            "Trotter, On the Product of Semi-Groups of Operators, 1959",
            "Suzuki, Generalized Trotter's Formula and Systematic Approximants, 1985",
        ],
        workedExample:
            "For a=1, b=0.7, and t=1, one first-order slice has a visible error because X and Z do not commute. Doubling the number of slices roughly halves that error; the second-order symmetric product roughly quarters it, matching the predicted convergence rates.",
    },
    id: "trotter-suzuki-decomposition",
    name: "Trotter-Suzuki Decomposition",
    category: "quantum",
    complexity: { time: "O(n) matrix products", space: "O(1)" },
    defaultInput: { a: 1, b: 0.7, time: 1, order: 1, slices: [1, 2, 4, 8, 16] },
    visualType: "array",
    run,
    pseudocode: [
        "choose the Hamiltonians A and B, the time, and the order",
        "compute the exact evolution exp(-i(A+B)t) for comparison",
        "for each slice count n, set the slice time to t over n",
        "first order: multiply exp(A slice) by exp(B slice) n times",
        "second order: use half A, full B, half A in each slice",
        "measure the operator-norm error against the exact evolution",
        "record how the error shrinks as n grows",
        "done: report the error convergence for each slice count",
    ],
};

export default module;
