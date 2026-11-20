/**
 * quantum-signal-processing.ts - Quantum Signal Processing (QSP)
 *
 * A QSP circuit alternates a fixed signal unitary A(x) with phase rotations
 * and produces a matrix whose entries are polynomials in x. With every phase
 * set to zero the product is A(x)^d, whose top-left entry is the Chebyshev
 * polynomial T_d(x). This module simulates that circuit with exact 2x2
 * complex arithmetic and checks the polynomial identity point by point.
 *
 * Limit: a single qubit (2x2 matrices), degree at most a few, noiseless,
 * phases supplied explicitly. This is a teaching simulator, not a compiler
 * for arbitrary target functions.
 *
 * Time:  O(|xs| * degree) complex matrix products
 * Space: O(|xs| + degree)
 */

import type { AlgorithmModule, VisualEntity, VisualFrame } from "@/types";

interface Complex {
    re: number;
    im: number;
}

type Matrix = [[Complex, Complex], [Complex, Complex]];

const C = (re: number, im = 0): Complex => ({ re, im });
const add = (a: Complex, b: Complex): Complex => C(a.re + b.re, a.im + b.im);
const mul = (a: Complex, b: Complex): Complex => C(a.re * b.re - a.im * b.im, a.re * b.im + a.im * b.re);

function matMul(a: Matrix, b: Matrix): Matrix {
    return [
        [add(mul(a[0][0]!, b[0][0]!), mul(a[0][1]!, b[1][0]!)), add(mul(a[0][0]!, b[0][1]!), mul(a[0][1]!, b[1][1]!))],
        [add(mul(a[1][0]!, b[0][0]!), mul(a[1][1]!, b[1][0]!)), add(mul(a[1][0]!, b[0][1]!), mul(a[1][1]!, b[1][1]!))],
    ];
}

function phaseRotation(phi: number): Matrix {
    return [
        [C(Math.cos(phi), Math.sin(phi)), C(0, 0)],
        [C(0, 0), C(Math.cos(phi), -Math.sin(phi))],
    ];
}

function signal(x: number): Matrix {
    const s = Math.sqrt(Math.max(0, 1 - x * x));
    return [
        [C(x, 0), C(0, s)],
        [C(0, s), C(x, 0)],
    ];
}

function simulate(x: number, phases: number[]): Matrix {
    let u = phaseRotation(phases[0] ?? 0);
    for (let k = 1; k < phases.length; k += 1) {
        u = matMul(u, signal(x));
        u = matMul(u, phaseRotation(phases[k] ?? 0));
    }
    return u;
}

function chebyshev(n: number, x: number): number {
    let prev = 1;
    let curr = x;
    if (n === 0) return 1;
    for (let k = 2; k <= n; k += 1) {
        const next = 2 * x * curr - prev;
        prev = curr;
        curr = next;
    }
    return curr;
}

function isUnitary(u: Matrix): boolean {
    const d00 = add(mul(C(u[0][0]!.re, -u[0][0]!.im), u[0][0]!), mul(C(u[1][0]!.re, -u[1][0]!.im), u[1][0]!));
    const d01 = add(mul(C(u[0][0]!.re, -u[0][0]!.im), u[0][1]!), mul(C(u[1][0]!.re, -u[1][0]!.im), u[1][1]!));
    return Math.abs(d00.re - 1) < 1e-8 && Math.abs(d00.im) < 1e-8 && Math.abs(d01.re) < 1e-8 && Math.abs(d01.im) < 1e-8;
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { xs?: number[]; phases?: number[] } | null) ?? {};
    const xs = task.xs ?? [-1, -0.75, -0.5, -0.25, 0, 0.25, 0.5, 0.75, 1];
    const phases = task.phases ?? [0, 0, 0];
    const degree = phases.length - 1;

    const results = xs.map((x) => {
        const u = simulate(x, phases);
        return {
            x,
            target: chebyshev(degree, x),
            approx: u[0][0]!.re,
            imag: u[0][0]!.im,
            unitary: isUnitary(u),
        };
    });
    const maxError = results.reduce((m, r) => Math.max(m, Math.abs(r.approx - r.target)), 0);
    const converged = results.every((r) => r.unitary && Math.abs(r.approx - r.target) < 1e-8);

    const bars = (focus: number, useApprox: boolean): VisualEntity[] =>
        results.map((result, i) => ({
            id: `bar-${i}`,
            type: "bar" as const,
            label: `x=${result.x.toFixed(2)}, p=${(useApprox ? result.approx : result.target).toFixed(3)}`,
            value: useApprox ? result.approx : result.target,
            state: i === focus ? ("active" as const) : ("idle" as const),
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: { index: i, x: result.x },
        }));

    let step = 0;
    yield {
        stepNumber: step,
        entities: bars(-1, false),
        edges: [],
        description: `Preparing a degree-${degree} QSP circuit; target polynomial is T_${degree}(x).`,
        codeLineNumber: 0,
        layout: "array",
        meta: { rows: 1, cols: xs.length, degree, xs, maxError, converged },
    };
    step += 1;

    for (let i = 0; i < results.length; i += 1) {
        const result = results[i]!;
        yield {
            stepNumber: step,
            entities: bars(i, true),
            edges: [],
            description: `At x=${result.x.toFixed(2)}: circuit gives ${result.approx.toFixed(6)}, T_${degree} gives ${result.target.toFixed(6)}, error ${Math.abs(result.approx - result.target).toExponential(2)}.`,
            codeLineNumber: 4,
            layout: "array",
            meta: { rows: 1, cols: xs.length, index: i, x: result.x, approx: result.approx, target: result.target, error: Math.abs(result.approx - result.target), unitary: result.unitary },
        };
        step += 1;
    }

    yield {
        stepNumber: step,
        entities: bars(-1, true),
        edges: [],
        description: converged
            ? `QSP reproduced T_${degree} on all ${xs.length} sample points with maximum error ${maxError.toExponential(2)}.`
            : `QSP did not reproduce the Chebyshev target on every sample point.`,
        codeLineNumber: 7,
        layout: "array",
        meta: { rows: 1, cols: xs.length, degree, converged, maxError, results },
    };
}

const module: AlgorithmModule = {
    id: "quantum-signal-processing",
    name: "Quantum Signal Processing (QSP)",
    category: "quantum",
    complexity: { time: "O(|xs| * degree)", space: "O(|xs| + degree)" },
    defaultInput: {
        xs: [-1, -0.75, -0.5, -0.25, 0, 0.25, 0.5, 0.75, 1],
        phases: [0, 0, 0],
    },
    visualType: "array",
    run,
    pseudocode: [
        "choose a degree d and a list of d+1 phase angles",
        "define the signal unitary A(x) with eigenvalues exp(plus or minus i*theta)",
        "start with the first phase rotation diag(exp(i*phi0), exp(-i*phi0))",
        "for each remaining phase, multiply by A(x) then by that phase rotation",
        "read the top-left entry of the product as the effective polynomial",
        "for each sample x evaluate the target Chebyshev polynomial T_d(x)",
        "compare the simulated entry with the target and check unitarity",
        "done: report the maximum approximation error",
    ],
    education: {
        intuition:
            "Quantum signal processing turns a simple two-level rotation into an arbitrary polynomial by interleaving it with phase flips. The phases act like coefficients: choosing them well shapes the polynomial that appears in the matrix entries. Even with every phase set to zero, repeated application of the signal already produces the Chebyshev polynomials.",
        invariants: [
            "Every factor in the product is unitary, so the simulated matrix stays unitary.",
            "The top-left entry is a real polynomial in x when all phases are zero.",
            "With d signal applications the polynomial has degree at most d.",
        ],
        correctness:
            "The signal unitary equals cos(theta) times the identity plus i sin(theta) times sigma_x, where x = cos(theta). Its d-th power is cos(d theta) times the identity plus i sin(d theta) times sigma_x, and cos(d theta) is exactly the Chebyshev polynomial T_d(x). Writing the d-th power as repeated multiplication and inserting identity phase rotations leaves the product unchanged, so the simulated top-left entry must equal T_d(x).",
        complexityRationale:
            "A degree-d circuit performs d matrix products per sample, each a constant-size 2x2 multiplication, so the cost is O(|xs| * d) time and O(|xs| + d) space to hold the samples and phases.",
        uses: [
            "Designing near-optimal quantum algorithms for linear systems and matrix inversion",
            "Implementing polynomial approximations of non-linear functions on quantum processors",
            "A minimal teaching model for phase-controlled quantum signal processing",
        ],
        references: [
            "Low and Chuang, Optimal Hamiltonian Simulation by Quantum Signal Processing, 2017",
            "Gilyard et al., A Unified Framework of Quantum Signal Processing, 2019",
        ],
        workedExample:
            "With phases [0,0,0] the circuit is A(x)^3. Since A(x) = cos(theta)I + i sin(theta)sigma_x and x = cos(theta), the top-left entry is cos(3 theta) = 4x^3 - 3x = T_3(x). At x = 0.5 this is -1, matching the simulation exactly.",
    },
};

export default module;
