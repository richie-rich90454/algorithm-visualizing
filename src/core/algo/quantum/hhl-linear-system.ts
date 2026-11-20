/**
 * hhl-linear-system.ts - HHL Linear System Solver (Small Spectral Model)
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * The Harrow-Hassidim-Lloyd algorithm solves a linear system A x = b on a
 * quantum computer by decomposing b in the eigenbasis of A, estimating each
 * eigenvalue as a phase, applying a controlled rotation by the inverse
 * eigenvalue, and uncomputing to leave the answer in a register. This module
 * performs exactly that spectral computation on a two by two symmetric system:
 * x equals the sum over eigenpairs of (beta sub i over lambda sub i) times the
 * eigenvector, where beta sub i is the projection of b on that eigenvector.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(1) for this fixed two by two spectral model
 *   Space: O(1) for the eigenvalues, projections, and answer
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Bars show the right-hand side during decomposition and the solution at
 *     the end.
 *   - The inverse-eigenvalue stage is highlighted in yellow.
 *   - Frame metadata carries eigenvalues, projections, and the solution.
 *
 * This is a small exact linear-algebra model of the HHL spectral step, not a
 * fault-tolerant quantum execution. It does not simulate phase estimation or
 * measurement; the mathematical step it shows is exact.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

/** Build bars for a two-component vector. */
function makeBars(values: number[], state: EntityState, highlight: boolean): VisualEntity[] {
    return values.map((value, index) => ({
        id: `bar-${index}`,
        type: "bar" as const,
        label: value.toFixed(5),
        value,
        state: highlight ? "comparing" : state,
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { index, value },
    }));
}

/** Solve a symmetric two by two system by exact eigendecomposition. */
function spectralSolve(a: number, c: number, d: number, b: number[]): {
    eigenvalues: number[];
    betas: number[];
    solution: number[];
} {
    const halfTrace = (a + d) / 2;
    const radius = Math.hypot((a - d) / 2, c);
    const lambda1 = halfTrace + radius;
    const lambda2 = halfTrace - radius;
    const theta = 0.5 * Math.atan2(2 * c, a - d);
    const u1 = [Math.cos(theta), Math.sin(theta)];
    const u2 = [-Math.sin(theta), Math.cos(theta)];
    const beta1 = u1[0]! * (b[0] ?? 0) + u1[1]! * (b[1] ?? 0);
    const beta2 = u2[0]! * (b[0] ?? 0) + u2[1]! * (b[1] ?? 0);
    const scale1 = beta1 / lambda1;
    const scale2 = beta2 / lambda2;
    const solution = [
        scale1 * u1[0]! + scale2 * u2[0]!,
        scale1 * u1[1]! + scale2 * u2[1]!,
    ];
    return { eigenvalues: [lambda1, lambda2], betas: [beta1, beta2], solution };
}

/** The HHL spectral model generator. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (
        input as { a?: number[][]; b?: number[] } | null
    ) ?? {};
    const matrix = Array.isArray(task.a) && task.a.length === 2
        ? task.a.map((row) => [...row])
        : [[2, 1], [1, 2]];
    const b = Array.isArray(task.b) && task.b.length === 2
        ? [...task.b]
        : [1, 0];
    const a = matrix[0]?.[0] ?? 1;
    const c = matrix[0]?.[1] ?? 0;
    const d = matrix[1]?.[1] ?? 1;
    const { eigenvalues, betas, solution } = spectralSolve(a, c, d, b);
    const inverseScales = betas.map((beta, i) => beta / (eigenvalues[i] ?? 1));
    let frame = 0;

    yield {
        stepNumber: frame,
        entities: makeBars(b, "idle", false),
        edges: [],
        description: `Solve A x = b for a two by two symmetric A with right-hand side (${b[0]}, ${b[1]}).`,
        codeLineNumber: 0,
        layout: "array",
        meta: { b: [...b], eigenvalues: [], betas: [], inverseScales: [], solution: [...b] },
    };
    frame += 1;

    yield {
        stepNumber: frame,
        entities: makeBars(b, "comparing", true),
        edges: [],
        description: `Eigenvalues are ${eigenvalues.map((v) => v.toFixed(4)).join(" and ")}.`,
        codeLineNumber: 1,
        layout: "array",
        meta: { b: [...b], eigenvalues: [...eigenvalues], betas: [], inverseScales: [], solution: [...b] },
    };
    frame += 1;

    yield {
        stepNumber: frame,
        entities: makeBars(b, "comparing", true),
        edges: [],
        description: `Decompose b in the eigenbasis with projections ${betas.map((v) => v.toFixed(4)).join(" and ")}.`,
        codeLineNumber: 2,
        layout: "array",
        meta: { b: [...b], eigenvalues: [...eigenvalues], betas: [...betas], inverseScales: [], solution: [...b] },
    };
    frame += 1;

    yield {
        stepNumber: frame,
        entities: makeBars(b, "comparing", true),
        edges: [],
        description: "Apply the controlled inverse-eigenvalue rotation to each projection.",
        codeLineNumber: 3,
        layout: "array",
        meta: {
            b: [...b],
            eigenvalues: [...eigenvalues],
            betas: [...betas],
            inverseScales: [...inverseScales],
            solution: [...b],
        },
    };
    frame += 1;

    yield {
        stepNumber: frame,
        entities: makeBars(solution, "idle", false),
        edges: [],
        description: "Recombine the scaled eigenvectors to form the solution register.",
        codeLineNumber: 5,
        layout: "array",
        meta: {
            b: [...b],
            eigenvalues: [...eigenvalues],
            betas: [...betas],
            inverseScales: [...inverseScales],
            solution: [...solution],
        },
    };
    frame += 1;

    yield {
        stepNumber: frame,
        entities: makeBars(solution, "sorted", false),
        edges: [],
        description: `Solution is (${solution[0]?.toFixed(4)}, ${solution[1]?.toFixed(4)}); A x reproduces b.`,
        codeLineNumber: 7,
        layout: "array",
        meta: {
            b: [...b],
            eigenvalues: [...eigenvalues],
            betas: [...betas],
            inverseScales: [...inverseScales],
            solution: [...solution],
        },
    };
}

/** The HHL spectral model module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "A symmetric matrix has perpendicular eigenvectors with simple scaling factors. Rewrite the right-hand side in that eigenbasis, divide each piece by its eigenvalue, and put the pieces back together. That is the linear algebra at the heart of HHL; the quantum circuit does the same work through phase estimation and a controlled rotation instead of forming the inverse directly.",
        invariants: [
            "The two eigenvectors are orthonormal because the matrix is symmetric.",
            "Each projection beta is the dot product of b with one eigenvector.",
            "The reconstructed solution satisfies A x = b for a nonsingular A.",
        ],
        correctness:
            "For a symmetric matrix A equals U times the diagonal eigenvalue matrix times U transpose, with U orthogonal. Its inverse is U times the diagonal of one over each eigenvalue times U transpose. Since beta equals U transpose times b, the product U times the inverse diagonal times beta equals the sum of beta sub i over lambda sub i times the i-th eigenvector, which is exactly the solution x. Multiplying by A returns b, confirming correctness.",
        complexityRationale:
            "This toy computes two eigenvalues and two projections with a constant number of arithmetic operations, so O(1) time and space. The general quantum algorithm runs in time logarithmic in the dimension plus the cost of matrix access and phase estimation, with an exponential speedup under strict sparsity and condition-number assumptions.",
        uses: [
            "Solving sparse linear systems in quantum algorithms",
            "Quantum machine learning regression subroutines",
            "A teaching model for eigenvalue-based linear solvers",
        ],
        references: [
            "Harrow, Hassidim, and Lloyd, Quantum Algorithm for Linear Systems of Equations, 2009",
            "Nielsen and Chuang, Quantum Computation and Quantum Information, Chapter 5",
        ],
        workedExample:
            "For A = [[2,1],[1,2]] and b = (1,0), the eigenvalues are 3 and 1 with projections about 0.707 and minus 0.707. Dividing by the eigenvalues and recombining gives x = (0.6667, minus 0.3333), and A x is exactly (1, 0).",
    },
    id: "hhl-linear-system",
    name: "HHL Linear System (Small Model)",
    category: "quantum",
    complexity: { time: "O(1)", space: "O(1)" },
    defaultInput: { a: [[2, 1], [1, 2]], b: [1, 0] },
    visualType: "array",
    run,
    pseudocode: [
        "load the symmetric system A x = b",
        "compute the eigenvalues of A",
        "project b onto each eigenvector",
        "apply a rotation by one over each eigenvalue",
        "uncompute to isolate the solution register",
        "recombine the scaled eigencomponents",
        "report the solution vector",
        "done: verify that A x equals b",
    ],
};

export default module;
