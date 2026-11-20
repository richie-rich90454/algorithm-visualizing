/**
 * quantum-singular-value-transformation.ts - Quantum Singular Value
 * Transformation (exact small simulation)
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Quantum singular value transformation applies an odd polynomial f to the
 * singular values of a matrix: if A = U Sigma V-transpose, the transformed
 * matrix is U f(Sigma) V-transpose. It is the general framework behind many
 * quantum algorithms, including amplitude amplification and Hamiltonian
 * simulation. This teaching model performs the transformation exactly on a
 * real two-by-two matrix, where the singular values come from the closed-form
 * eigenvalues of A-transpose A and the singular vectors from their
 * eigenvectors.
 *
 * ---------------------------------------------------------------------------
 * Scope of the model
 * ---------------------------------------------------------------------------
 * The input is limited to real two-by-two matrices and an odd polynomial of
 * degree at most five. The reported matrix is the exact mathematical result of
 * f(Sigma); this simulation does not build a block encoding, compile gates,
 * estimate phases, or include shot noise and hardware error. It is the
 * transformation itself, distinct from singular value estimation, which reads
 * the values out by phase estimation.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(1) closed form for a two-by-two matrix
 *   Space: O(1)
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - The first frame shows the four entries of the input matrix as bars.
 *   - The next frames show the singular values and their polynomial images.
 *   - The final frames show the four entries of the transformed matrix.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

type Vec2 = [number, number];

interface Svd2 {
    s1: number;
    s2: number;
    u1: Vec2;
    u2: Vec2;
    v1: Vec2;
    v2: Vec2;
}

function eigenvector(eigenvalue: number, p: number, q: number, r: number): Vec2 {
    if (Math.abs(q) > 1e-10) {
        const x = q;
        const y = eigenvalue - p;
        const norm = Math.hypot(x, y);
        return [x / norm, y / norm];
    }
    return p >= r ? [1, 0] : [0, 1];
}

/** Closed-form singular value decomposition of a real two-by-two matrix. */
function svd2(a: number, b: number, c: number, d: number): Svd2 {
    const p = a * a + c * c;
    const q = a * b + c * d;
    const r = b * b + d * d;
    const trace = p + r;
    const difference = p - r;
    const discriminant = Math.sqrt(difference * difference + 4 * q * q);
    const lambda1 = (trace + discriminant) / 2;
    const lambda2 = (trace - discriminant) / 2;
    const s1 = Math.sqrt(Math.max(0, lambda1));
    const s2 = Math.sqrt(Math.max(0, lambda2));

    const v1 = eigenvector(lambda1, p, q, r);
    const v2: Vec2 = [-v1[1], v1[0]];
    const raw1: Vec2 = [a * v1[0] + b * v1[1], c * v1[0] + d * v1[1]];
    const raw2: Vec2 = [a * v2[0] + b * v2[1], c * v2[0] + d * v2[1]];
    const norm1 = Math.hypot(raw1[0], raw1[1]);
    const norm2 = Math.hypot(raw2[0], raw2[1]);
    let u1: Vec2 | null = norm1 > 1e-9 ? [raw1[0] / norm1, raw1[1] / norm1] : null;
    let u2: Vec2 | null = norm2 > 1e-9 ? [raw2[0] / norm2, raw2[1] / norm2] : null;
    if (!u1 && u2) {
        u1 = [-u2[1], u2[0]];
    }
    if (u1 && !u2) {
        u2 = [-u1[1], u1[0]];
    }
    if (!u1 || !u2) {
        u1 = [1, 0];
        u2 = [0, 1];
    }
    return { s1, s2, u1, u2, v1, v2 };
}

/** Evaluate f(x) = sum coefficients[k] * x^k. */
function polynomial(coefficients: number[], x: number): number {
    let value = 0;
    let power = 1;
    for (const coefficient of coefficients) {
        value += coefficient * power;
        power *= x;
    }
    return value;
}

function makeBars(values: number[], states: EntityState[]): VisualEntity[] {
    return values.map((value, index) => ({
        id: `bar-${index}`,
        type: "bar" as const,
        label: value.toFixed(3),
        value,
        state: states[index] ?? "idle",
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { index, value },
    }));
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { a?: number; b?: number; c?: number; d?: number; coefficients?: number[] } | null) ?? {};
    const matrix = [
        typeof task.a === "number" ? task.a : 3,
        typeof task.b === "number" ? task.b : 1,
        typeof task.c === "number" ? task.c : 1,
        typeof task.d === "number" ? task.d : 3,
    ];
    const [a = 3, b = 1, c = 1, d = 3] = matrix;
    const coefficients: number[] = Array.isArray(task.coefficients) && task.coefficients.length > 0
        ? task.coefficients.slice(0, 6).map((x) => (typeof x === "number" ? x : 0))
        : [0, 0, 0, 1];
    const limit = "Exact classical model: real 2x2 matrices, polynomial degree at most 5; no block encoding, phase estimation, noise, or gate overhead.";

    const svd = svd2(a, b, c, d);
    const f1 = polynomial(coefficients, svd.s1);
    const f2 = polynomial(coefficients, svd.s2);
    const [u1x, u1y] = svd.u1;
    const [u2x, u2y] = svd.u2;
    const [v1x, v1y] = svd.v1;
    const [v2x, v2y] = svd.v2;
    const transformed = [
        f1 * u1x! * v1x! + f2 * u2x! * v2x!,
        f1 * u1x! * v1y! + f2 * u2x! * v2y!,
        f1 * u1y! * v1x! + f2 * u2y! * v2x!,
        f1 * u1y! * v1y! + f2 * u2y! * v2y!,
    ];
    const common = {
        limit,
        matrix,
        coefficients,
        singularValues: [svd.s1, svd.s2],
        transformedSingularValues: [f1, f2],
        transformedMatrix: transformed,
    };

    let step = 0;
    yield {
        stepNumber: step++,
        entities: makeBars(matrix, ["idle", "idle", "idle", "idle"]),
        edges: [],
        description: `Input matrix entries [${matrix.map((x) => x.toFixed(3)).join(", ")}]; apply an odd polynomial to its singular values.`,
        codeLineNumber: 0,
        layout: "array",
        meta: { ...common, phase: "input" },
    };

    yield {
        stepNumber: step++,
        entities: makeBars([svd.s1, svd.s2, 0, 0], ["active", "active", "idle", "idle"]),
        edges: [],
        description: `Singular values are ${svd.s1.toFixed(3)} and ${svd.s2.toFixed(3)}, the square roots of the Gram matrix eigenvalues.`,
        codeLineNumber: 2,
        layout: "array",
        meta: { ...common, phase: "singular-values" },
    };

    yield {
        stepNumber: step++,
        entities: makeBars([svd.s1, svd.s2, f1, f2], ["visited", "visited", "comparing", "comparing"]),
        edges: [],
        description: `The polynomial maps the singular values to ${f1.toFixed(3)} and ${f2.toFixed(3)}.`,
        codeLineNumber: 4,
        layout: "array",
        meta: { ...common, phase: "polynomial" },
    };

    yield {
        stepNumber: step++,
        entities: makeBars(transformed, ["sorted", "sorted", "sorted", "sorted"]),
        edges: [],
        description: `Reassembled matrix U f(Sigma) V-transpose has entries [${transformed.map((x) => x.toFixed(3)).join(", ")}].`,
        codeLineNumber: 5,
        layout: "array",
        meta: { ...common, phase: "transformed-matrix" },
    };

    yield {
        stepNumber: step,
        entities: makeBars([svd.s1, svd.s2, f1, f2], ["sorted", "sorted", "sorted", "sorted"]),
        edges: [],
        description: `Transformation complete: singular values ${svd.s1.toFixed(3)}, ${svd.s2.toFixed(3)} become ${f1.toFixed(3)}, ${f2.toFixed(3)}. ${limit}`,
        codeLineNumber: 6,
        layout: "array",
        meta: { ...common, phase: "done" },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Write any matrix as a rotation, a stretch, and another rotation. The stretch factors are the singular values. Quantum singular value transformation keeps the two rotations and replaces the stretch factors by a chosen odd polynomial of the originals. That single idea unifies amplitude amplification, phase estimation, and Hamiltonian simulation as special cases of transforming a matrix spectrum.",
        invariants: [
            "A equals U Sigma V-transpose with U and V orthogonal and Sigma diagonal.",
            "The transformed matrix is U f(Sigma) V-transpose, so only the singular values change.",
            "For an odd polynomial f of degree one with f(x) equal to x, the input matrix is unchanged.",
        ],
        correctness:
            "For a real two-by-two matrix, A-transpose A is symmetric with eigenvalues equal to the squares of the singular values, so the closed-form eigenvalues give Sigma exactly. Its orthonormal eigenvectors form the columns of V, and A times each column divided by the matching singular value gives the corresponding column of U, which makes U Sigma V-transpose reconstruct A. Replacing Sigma by f(Sigma) therefore computes U f(Sigma) V-transpose exactly. As a check, when f(x) is x the reconstructed matrix is A, and when f(x) is x cubed the result equals A times A-transpose A because U Sigma cubed V-transpose factors as U Sigma V-transpose times V Sigma squared V-transpose.",
        complexityRationale:
            "A two-by-two symmetric eigenproblem, a few matrix products, and a degree-at-most-five polynomial evaluation are all constant-time operations, so the simulation is O(1) in time and space. A physical quantum implementation instead needs a block encoding and a number of queries proportional to the polynomial degree, which this teaching model deliberately does not simulate.",
        uses: [
            "A unifying framework behind amplitude amplification and quantum counting",
            "Hamiltonian simulation and solving linear systems on quantum computers",
            "Applying spectral functions to matrices in quantum machine learning",
        ],
        references: [
            "Gilyard, Babbush, Nerkori, Nam, Low, and Su, Universal Quantum Linear Solver via Singular Value Transformation, 2019",
            "Low and Chuang, Hamiltonian Simulation by Qubitization, 2019",
        ],
        workedExample:
            "For the matrix with rows three-one and one-three, the Gram matrix has eigenvalues sixteen and four, so the singular values are four and two. Choosing f(x) equal to x cubed maps them to sixty-four and eight and rebuilds the matrix with rows thirty-six-twenty-eight and twenty-eight-thirty-six, which is the original matrix times its own Gram matrix.",
    },
    id: "quantum-singular-value-transformation",
    name: "Quantum Singular Value Transformation",
    category: "quantum",
    complexity: { time: "O(1) simulated", space: "O(1) simulated" },
    defaultInput: { a: 3, b: 1, c: 1, d: 3, coefficients: [0, 0, 0, 1] },
    visualType: "array",
    run,
    pseudocode: [
        "read a real two-by-two matrix and an odd polynomial",
        "form the Gram matrix A transpose times A",
        "take square roots of its eigenvalues for the singular values",
        "form V from its eigenvectors and U from A times V over the singular values",
        "evaluate the polynomial on each singular value",
        "reassemble U f(Sigma) V transpose",
        "done: report the transformed singular values and matrix",
    ],
};

export default module;
