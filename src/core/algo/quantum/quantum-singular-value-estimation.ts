/**
 * quantum-singular-value-estimation.ts - Quantum Singular Value Estimation
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Quantum singular value estimation reads the singular values of a small
 * matrix by applying phase estimation to the Hermitian matrix A transpose A.
 * The eigenvalues of that matrix are the squares of the singular values, so a
 * phase estimate on its unitary evolution reveals a singular value after a
 * square root.
 *
 * This is an exact small simulation: the input is limited to real two-by-two
 * matrices, eigenvalues come from the closed-form symmetric two-by-two
 * solution, and the phase-estimation distribution is computed directly from
 * the Dirichlet kernel with a four-bit register. It reports ideal
 * probabilities with no shot noise, gate error, or block-encoding overhead.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(2^t * t) for a t-bit phase register (simulator)
 *   Space: O(2^t) for the outcome probabilities
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Bars show the input matrix, the Gram matrix, and the eigenvalues.
 *   - A 16-bar histogram shows the phase outcome distribution.
 *   - The final frame reports the recovered singular values.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface SveInput {
    a?: number;
    b?: number;
    c?: number;
    d?: number;
}

const BITS = 4;
const OUTCOMES = 1 << BITS;

/** Bars for a real-valued display. */
function makeBars(values: number[], states: Map<number, EntityState> = new Map()): VisualEntity[] {
    return values.map((value, index) => ({
        id: `bar-${index}`,
        type: "bar" as const,
        label: value.toFixed(3),
        value,
        state: states.get(index) ?? "idle",
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { index },
    }));
}

/** Exact eigenvalues of a real symmetric two-by-two matrix. */
function eigenvalues(m00: number, m01: number, m11: number): [number, number] {
    const half = (m00 + m11) / 2;
    const spread = Math.sqrt((m00 - m11) ** 2 / 4 + m01 * m01);
    return [Math.max(0, half + spread), Math.max(0, half - spread)];
}

/** Phase-estimation outcome probability for an eigenphase theta. */
function phaseDistribution(theta: number): number[] {
    const probabilities = new Array<number>(OUTCOMES).fill(0);
    for (let y = 0; y < OUTCOMES; y += 1) {
        let re = 0;
        let im = 0;
        for (let k = 0; k < OUTCOMES; k += 1) {
            const angle = 2 * Math.PI * k * (theta - y / OUTCOMES);
            re += Math.cos(angle);
            im += Math.sin(angle);
        }
        probabilities[y] = (re * re + im * im) / (OUTCOMES * OUTCOMES);
    }
    return probabilities;
}

/** The singular value estimation generator. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as SveInput | null) ?? {};
    const clamp = (value: unknown, fallback: number): number =>
        typeof value === "number" && Number.isFinite(value) ? Math.max(-3, Math.min(3, value)) : fallback;
    const a = clamp(task.a, 1);
    const b = clamp(task.b, 0);
    const c = clamp(task.c, 0);
    const d = clamp(task.d, 2);

    const m00 = a * a + c * c;
    const m01 = a * b + c * d;
    const m11 = b * b + d * d;
    const lambda = eigenvalues(m00, m01, m11);
    const singularValues = lambda.map((value) => Math.sqrt(value));
    const scale = Math.max(lambda[0], 1e-9);
    const thetas = lambda.map((value) => value / (2 * scale));
    const d0 = phaseDistribution(thetas[0]!);
    const d1 = phaseDistribution(thetas[1]!);
    const mixture = d0.map((value, index) => (value + d1[index]!) / 2);
    const peak0 = d0.indexOf(Math.max(...d0));
    const peak1 = d1.indexOf(Math.max(...d1));
    const estimates = [peak0, peak1].map((outcome) => Math.sqrt(Math.max(0, (2 * scale * outcome) / OUTCOMES)));

    const metaBase = {
        bits: BITS,
        outcomes: OUTCOMES,
        flatA: [a, b, c, d],
        flatM: [m00, m01, m01, m11],
        eigenvalues: lambda,
        singularValues,
        theta: thetas,
        peakOutcomes: [peak0, peak1],
        estimatedSingularValues: estimates,
    };

    let step = 0;
    yield {
        stepNumber: step,
        entities: makeBars([a, b, c, d], new Map([[0, "comparing"], [3, "comparing"]])),
        edges: [],
        description: `Loaded the real two-by-two matrix with entries ${a}, ${b}, ${c}, ${d}.`,
        codeLineNumber: 0,
        layout: "array",
        meta: { ...metaBase, phase: "input" },
    };
    step += 1;

    yield {
        stepNumber: step,
        entities: makeBars([m00, m01, m01, m11]),
        edges: [],
        description: `Formed the Gram matrix A transpose A, whose eigenvalues are the singular values squared.`,
        codeLineNumber: 1,
        layout: "array",
        meta: { ...metaBase, phase: "gram" },
    };
    step += 1;

    yield {
        stepNumber: step,
        entities: makeBars(lambda),
        edges: [],
        description: `The two eigenvalues are ${lambda[0]!.toFixed(3)} and ${lambda[1]!.toFixed(3)}; their square roots are the singular values.`,
        codeLineNumber: 2,
        layout: "array",
        meta: { ...metaBase, phase: "eigen" },
    };
    step += 1;

    const highlight = new Map<number, EntityState>([
        [peak0, "sorted"],
        [peak1, "comparing"],
    ]);
    yield {
        stepNumber: step,
        entities: makeBars(mixture, highlight),
        edges: [],
        description: `Four-bit phase estimation peaks near outcomes ${peak0} and ${peak1} for the two eigenphases.`,
        codeLineNumber: 3,
        layout: "array",
        meta: { ...metaBase, phase: "phase", phaseProbabilities: mixture },
    };
    step += 1;

    yield {
        stepNumber: step,
        entities: makeBars(singularValues),
        edges: [],
        description: `Recovered singular values ${singularValues[0]!.toFixed(3)} and ${singularValues[1]!.toFixed(3)}; the phase peaks estimate ${estimates[0]!.toFixed(3)} and ${estimates[1]!.toFixed(3)}.`,
        codeLineNumber: 4,
        layout: "array",
        meta: { ...metaBase, phase: "done", phaseProbabilities: mixture },
    };
}

/** The quantum singular value estimation module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "Singular values describe how much a matrix stretches space. If you can build a unitary whose eigenphases are proportional to the eigenvalues of A transpose A, then quantum phase estimation reads those phases into a register. Taking a square root of each measured phase gives a singular value, which is the quantity many quantum linear-algebra algorithms need.",
        invariants: [
            "The Gram matrix A transpose A is real and symmetric, so its eigenvalues are nonnegative.",
            "The eigenvalues of the Gram matrix are exactly the squared singular values of A.",
            "Each phase-estimation distribution is a Dirichlet kernel centered on its eigenphase.",
        ],
        correctness:
            "For a symmetric two-by-two matrix the characteristic polynomial has the closed-form roots (trace over two) plus or minus the square root of ((m00 minus m11) over two) squared plus m01 squared, which are nonnegative. Phase estimation on the unitary whose eigenphases are those eigenvalues scaled into one period produces a peaked distribution whose most likely outcome encodes the eigenvalue. Dividing by the known scale and taking the square root recovers the singular value.",
        complexityRationale:
            "The simulator evaluates a t-bit Dirichlet kernel for each of two eigenvalues, costing O(2^t times t) trigonometric operations with a four-bit register. Memory holds O(2^t) outcome probabilities. On hardware, phase estimation uses O(t) ancillas and controlled powers of the block-encoding unitary.",
        uses: [
            "Quantum linear system and recommendation algorithms",
            "Estimating condition numbers and spectral norms",
            "A subroutine in quantum principal component analysis",
        ],
        references: [
            "Harrow, Hassidim, and Lloyd, Quantum Algorithm for Linear Systems of Equations, 2009",
            "Nielsen and Chuang, Quantum Computation and Quantum Information, Chapter 5",
        ],
        workedExample:
            "For the diagonal matrix with entries one and two, the Gram matrix is diagonal with eigenvalues one and four. The singular values are one and two. With a four-bit phase register the two phase distributions peak at the outcomes encoding those scaled eigenvalues, and the square roots of the decoded phases return one and two.",
    },
    id: "quantum-singular-value-estimation",
    name: "Quantum Singular Value Estimation",
    category: "quantum",
    complexity: { time: "O(2^t t) simulator", space: "O(2^t)" },
    defaultInput: { a: 1, b: 0, c: 0, d: 2 },
    visualType: "array",
    run,
    pseudocode: [
        "load the real two-by-two matrix A",
        "form the Gram matrix A transpose A",
        "compute its two exact eigenvalues",
        "scale the eigenvalues into phase angles",
        "build the four-bit phase-estimation histogram",
        "read the peak outcome for each eigenphase",
        "decode and take square roots for singular values",
    ],
};

export default module;
