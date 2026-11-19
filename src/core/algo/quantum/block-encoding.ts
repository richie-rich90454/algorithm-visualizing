/**
 * block-encoding.ts - Block Encoding of a Small Matrix
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Block encoding embeds a non-unitary matrix A as the upper-left block of a
 * larger unitary U, scaled by a constant alpha so that A over alpha has norm
 * at most one. The remaining blocks are matrix square roots of I minus A A
 * transpose and I minus A transpose A, which complete the unitary. This is the
 * interface that lets quantum algorithms apply matrices on a simulator.
 *
 * The simulation is exact small arithmetic on real two-by-two matrices. It
 * uses a closed-form square root for symmetric positive semidefinite two-by-two
 * matrices and verifies unitarity numerically. It does not model the quantum
 * circuit that prepares U, ancilla overhead, or Approximate Block Encoding
 * error, and it is limited to matrices with entries in minus three to three.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(1) for a two-by-two matrix
 *   Space: O(1) for the four-by-four unitary
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Cells show the input matrix, its normalized form, and the unitary.
 *   - The final frame reports the unitarity residual.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface BlockInput {
    a?: number;
    b?: number;
    c?: number;
    d?: number;
}

type Mat2 = [number, number, number, number];

/** Closed-form square root of a symmetric positive semidefinite two-by-two matrix. */
function sqrtSym(a: number, b: number, d: number): Mat2 {
    const det = Math.max(0, a * d - b * b);
    const s = Math.sqrt(det);
    const denom = Math.sqrt(Math.max(1e-12, a + d + 2 * s));
    return [(a + s) / denom, b / denom, b / denom, (d + s) / denom];
}

/** Largest singular value of a real two-by-two matrix. */
function spectralNorm(m: Mat2): number {
    const [a, b, c, d] = m;
    const x = a * a + b * b + c * c + d * d;
    const y = Math.abs(a * d - b * c);
    return Math.sqrt(Math.max(0, (x + Math.sqrt(Math.max(0, x * x - 4 * y * y))) / 2));
}

/** Cells for a matrix of arbitrary small shape. */
function makeCells(values: number[][], states: Map<string, EntityState> = new Map()): VisualEntity[] {
    const entities: VisualEntity[] = [];
    for (let i = 0; i < values.length; i += 1) {
        for (let j = 0; j < values[i]!.length; j += 1) {
            const id = `m-${i}-${j}`;
            entities.push({
                id,
                type: "cell",
                label: values[i]![j]!.toFixed(2),
                value: values[i]![j]!,
                state: states.get(id) ?? "idle",
                x: j,
                y: i,
                width: 0,
                height: 0,
                metadata: { row: i, col: j },
            });
        }
    }
    return entities;
}

/** The block encoding generator. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as BlockInput | null) ?? {};
    const clamp = (value: unknown, fallback: number): number =>
        typeof value === "number" && Number.isFinite(value) ? Math.max(-3, Math.min(3, value)) : fallback;
    const m: Mat2 = [clamp(task.a, 0.5), clamp(task.b, 0), clamp(task.c, 0), clamp(task.d, 0.5)];
    const alpha = Math.max(spectralNorm(m), 1e-12);
    const n: Mat2 = [m[0] / alpha, m[1] / alpha, m[2] / alpha, m[3] / alpha];

    const aaT: [number, number, number] = [n[0] ** 2 + n[1] ** 2, n[0] * n[2] + n[1] * n[3], n[2] ** 2 + n[3] ** 2];
    const ata: [number, number, number] = [n[0] ** 2 + n[2] ** 2, n[0] * n[1] + n[2] * n[3], n[1] ** 2 + n[3] ** 2];
    const s1 = sqrtSym(1 - aaT[0], -aaT[1], 1 - aaT[2]);
    const s2 = sqrtSym(1 - ata[0], -ata[1], 1 - ata[2]);

    const u = [
        [n[0], n[1], s1[0], s1[1]],
        [n[2], n[3], s1[2], s1[3]],
        [s2[0], s2[1], -n[0], -n[2]],
        [s2[2], s2[3], -n[1], -n[3]],
    ];
    let residual = 0;
    for (let i = 0; i < 4; i += 1) {
        for (let j = 0; j < 4; j += 1) {
            let dot = 0;
            for (let k = 0; k < 4; k += 1) dot += u[k]![i]! * u[k]![j]!;
            residual = Math.max(residual, Math.abs(dot - (i === j ? 1 : 0)));
        }
    }

    const metaBase = {
        alpha,
        flatA: [...m],
        flatNormalized: [...n],
        flatU: u.flat(),
        residual,
    };

    let step = 0;
    yield {
        stepNumber: step,
        entities: makeCells([[m[0], m[1]], [m[2], m[3]]]),
        edges: [],
        description: `Loaded a two-by-two matrix with spectral norm ${alpha.toFixed(4)}.`,
        codeLineNumber: 0,
        layout: "matrix",
        meta: { ...metaBase, phase: "input" },
    };
    step += 1;

    yield {
        stepNumber: step,
        entities: makeCells([[n[0], n[1]], [n[2], n[3]]]),
        edges: [],
        description: `Scaled the matrix by one over alpha so its norm is at most one.`,
        codeLineNumber: 1,
        layout: "matrix",
        meta: { ...metaBase, phase: "normalize" },
    };
    step += 1;

    yield {
        stepNumber: step,
        entities: makeCells([[s1[0], s1[1]], [s1[2], s1[3]], [s2[0], s2[1]], [s2[2], s2[3]]]),
        edges: [],
        description: `Computed the square-root completions for I minus A A transpose and I minus A transpose A.`,
        codeLineNumber: 2,
        layout: "matrix",
        meta: { ...metaBase, phase: "completion" },
    };
    step += 1;

    const highlight = new Map<string, EntityState>();
    for (let i = 0; i < 2; i += 1) {
        for (let j = 0; j < 2; j += 1) highlight.set(`m-${i}-${j}`, "sorted");
    }
    yield {
        stepNumber: step,
        entities: makeCells(u, highlight),
        edges: [],
        description: `The four-by-four block encoding is unitary to within ${residual.toExponential(2)}.`,
        codeLineNumber: 3,
        layout: "matrix",
        meta: { ...metaBase, phase: "done" },
    };
}

/** The block encoding module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "Quantum evolution must be unitary, but the matrices used in data analysis usually are not. Block encoding solves this by hiding the matrix in the top-left corner of a bigger unitary, scaled so it fits. The rest of the unitary is filled with square-root terms that soak up the remaining probability amplitude.",
        invariants: [
            "The normalization constant alpha is an upper bound on the spectral norm of A.",
            "The normalized top-left block has operator norm at most one.",
            "The completed four-by-four matrix U satisfies U transpose U equals the identity.",
        ],
        correctness:
            "For a matrix with norm at most one, the matrices I minus A A transpose and I minus A transpose A are positive semidefinite, so their square roots exist. Assembling the four blocks gives U transpose U equal to the block diagonal matrix whose entries are A transpose A plus the square root squared of I minus A transpose A in one corner, which is the identity, and similarly for the other corner. The cross blocks cancel because the same square root appears on both sides of each product, proving unitarity.",
        complexityRationale:
            "All operations are on constant-size two-by-two and four-by-four matrices, so the simulation is O(1) time and space. On hardware the cost is dominated by preparing the square-root blocks, which is the subject of practical block-encoding constructions.",
        uses: [
            "Applying non-unitary matrices inside quantum algorithms",
            "A prerequisite for quantum linear systems and singular value estimation",
            "Qubitization and quantum walk constructions",
        ],
        references: [
            "Low and Chuang, Hamiltonian Simulation by Qubitization, 2019",
            "Gilyard et al., A Unified Quantum Algorithm for Linear Systems, 2019",
        ],
        workedExample:
            "For a diagonal matrix with entries one half and one quarter, alpha is one half and the normalized block is diagonal with entries one and one half. The completions are sqrt of one minus one and sqrt of one minus one quarter, so the unitary contains zero and square-root-three over two on its diagonal complements.",
    },
    id: "block-encoding",
    name: "Block Encoding",
    category: "quantum",
    complexity: { time: "O(1)", space: "O(1)" },
    defaultInput: { a: 0.5, b: 0, c: 0, d: 0.25 },
    visualType: "matrix",
    run,
    pseudocode: [
        "load the real two-by-two matrix A",
        "compute alpha as the spectral norm of A",
        "normalize A by alpha so its norm is at most one",
        "form A A transpose and A transpose A",
        "take square roots of the complement matrices",
        "assemble the four-by-four unitary U",
        "done: verify U transpose U is the identity",
    ],
};

export default module;
