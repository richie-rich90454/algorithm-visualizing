/**
 * quantum-lanczos.ts - Quantum Lanczos Krylov Diagonalization (exact simulator)
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Quantum Lanczos (QLanczos) prepares a Krylov subspace by repeatedly applying
 * imaginary-time evolution e to the minus tau H to a reference state, instead
 * of repeatedly applying H as the classical Lanczos algorithm does. The
 * imaginary-time states are orthogonalized, the Hamiltonian is projected into
 * that small basis, and the projected matrix is diagonalized to give Ritz
 * estimates of the low energy spectrum. This is the subroutine behind
 * near-term algorithms for ground and excited state energies.
 *
 * ---------------------------------------------------------------------------
 * Scope of the model
 * ---------------------------------------------------------------------------
 * This is an exact state-vector simulation for a real symmetric Hamiltonian on
 * at most four levels. The imaginary-time operator is evaluated by a convergent
 * Taylor series and the projected matrix by a cyclic Jacobi eigensolver. No
 * Hadamard-test shot noise, ancilla qubits, or hardware decoherence are modeled,
 * and the reported energies are computed exactly rather than sampled.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time: O(m * n^3) for m Krylov states on an n level Hamiltonian
 *   Space: O(n^2) for the matrices and basis
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Bars show the components of each imaginary-time Krylov state.
 *   - The final frame shows the sorted Ritz values (energy estimates).
 *   - Meta records the basis Gram matrix so orthonormality is inspectable.
 */

import type { AlgorithmModule, VisualEntity, VisualFrame } from "@/types";

interface LanczosInput {
    energies?: number[];
    coupling?: number;
    tau?: number;
    initial?: number[];
    krylov?: number;
}

function matMul(a: number[][], b: number[][]): number[][] {
    const n = a.length;
    const out = Array.from({ length: n }, () => new Array<number>(n).fill(0));
    for (let i = 0; i < n; i += 1) {
        for (let j = 0; j < n; j += 1) {
            let sum = 0;
            for (let k = 0; k < n; k += 1) {
                sum += (a[i][k] ?? 0) * (b[k][j] ?? 0);
            }
            out[i][j] = sum;
        }
    }
    return out;
}

/** exp(-tau * H) by a truncated Taylor series in the matrix -tau H. */
function imaginaryTimeOperator(tau: number, h: number[][]): number[][] {
    const n = h.length;
    const a = h.map((row) => row.map((value) => -tau * value));
    let result: number[][] = Array.from({ length: n }, (_, i) =>
        Array.from({ length: n }, (_, j) => (i === j ? 1 : 0)),
    );
    let term: number[][] = Array.from({ length: n }, (_, i) =>
        Array.from({ length: n }, (_, j) => (i === j ? 1 : 0)),
    );
    for (let k = 1; k <= 200; k += 1) {
        const next = matMul(term, a).map((row) => row.map((value) => value / k));
        result = result.map((row, i) => row.map((value, j) => value + (next[i][j] ?? 0)));
        const largest = next.reduce((mx, row) => Math.max(mx, ...row.map(Math.abs)), 0);
        term = next;
        if (largest < 1e-16) {
            break;
        }
    }
    return result;
}

function matVec(matrix: number[][], vector: number[]): number[] {
    return matrix.map((row) => row.reduce((sum, value, index) => sum + value * (vector[index] ?? 0), 0));
}

function dot(a: number[], b: number[]): number {
    return a.reduce((sum, value, index) => sum + value * (b[index] ?? 0), 0);
}

function normalize(vector: number[]): number[] {
    const norm = Math.sqrt(dot(vector, vector));
    return norm < 1e-14 ? vector.map(() => 0) : vector.map((value) => value / norm);
}

/** Modified Gram-Schmidt: return an orthonormal basis plus its Gram matrix. */
function orthonormalize(vectors: number[][]): { basis: number[][]; gram: number[] } {
    const basis: number[][] = [];
    for (const vector of vectors) {
        let current = [...vector];
        for (const q of basis) {
            const coefficient = dot(q, current);
            current = current.map((value, index) => value - coefficient * (q[index] ?? 0));
        }
        const norm = Math.sqrt(dot(current, current));
        if (norm < 1e-10) {
            continue;
        }
        basis.push(current.map((value) => value / norm));
    }
    const gram: number[] = [];
    for (const a of basis) {
        for (const b of basis) {
            gram.push(dot(a, b));
        }
    }
    return { basis, gram };
}

/** Cyclic Jacobi eigenvalues of a small real symmetric matrix. */
function jacobiEigen(matrix: number[][]): number[] {
    const a = matrix.map((row) => [...row]);
    const n = a.length;
    for (let sweep = 0; sweep < 100; sweep += 1) {
        let off = 0;
        for (let i = 0; i < n; i += 1) {
            for (let j = i + 1; j < n; j += 1) {
                off += (a[i][j] ?? 0) ** 2;
            }
        }
        if (off < 1e-24) {
            break;
        }
        for (let p = 0; p < n - 1; p += 1) {
            for (let q = p + 1; q < n; q += 1) {
                const apq = a[p][q] ?? 0;
                if (Math.abs(apq) < 1e-15) {
                    continue;
                }
                const ratio = ((a[q][q] ?? 0) - (a[p][p] ?? 0)) / (2 * apq);
                const t = ratio >= 0
                    ? 1 / (ratio + Math.sqrt(1 + ratio * ratio))
                    : -1 / (-ratio + Math.sqrt(1 + ratio * ratio));
                const c = 1 / Math.sqrt(1 + t * t);
                const s = t * c;
                const app = a[p][p] ?? 0;
                const aqq = a[q][q] ?? 0;
                a[p][p] = app - t * apq;
                a[q][q] = aqq + t * apq;
                a[p][q] = 0;
                a[q][p] = 0;
                for (let k = 0; k < n; k += 1) {
                    if (k === p || k === q) {
                        continue;
                    }
                    const akp = a[k][p] ?? 0;
                    const akq = a[k][q] ?? 0;
                    a[k][p] = c * akp - s * akq;
                    a[p][k] = a[k][p];
                    a[k][q] = s * akp + c * akq;
                    a[q][k] = a[k][q];
                }
            }
        }
    }
    return a.map((row, i) => row[i] ?? 0).sort((x, y) => x - y);
}

function bars(values: number[], highlight: number): VisualEntity[] {
    return values.map((value, index) => ({
        id: `level-${index}`,
        type: "bar" as const,
        label: index < values.length ? `${value.toFixed(3)}` : "",
        value,
        state: (index === highlight ? "active" : "comparing") as VisualEntity["state"],
        x: index,
        y: 0,
        width: 0,
        height: 0,
        metadata: { index, value },
    }));
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as LanczosInput | null) ?? {};
    const energies = (task.energies ?? [0, 1, 2]).slice(0, 4);
    const n = Math.max(1, energies.length);
    const coupling = typeof task.coupling === "number" ? task.coupling : 0.3;
    const tau = typeof task.tau === "number" ? Math.max(0.01, task.tau) : 0.25;
    const initialSource = task.initial ?? new Array<number>(n).fill(1);
    const initial = normalize(Array.from({ length: n }, (_, i) => initialSource[i] ?? 0));
    const krylov = Math.max(1, Math.min(n, typeof task.krylov === "number" ? task.krylov : n));

    const h = Array.from({ length: n }, (_, i) =>
        Array.from({ length: n }, (_, j) => {
            if (i === j) {
                return energies[i] ?? 0;
            }
            if (Math.abs(i - j) === 1) {
                return coupling;
            }
            return 0;
        }),
    );
    const m = imaginaryTimeOperator(tau, h);

    const vectors: number[][] = [];
    let current = [...initial];
    for (let k = 0; k < krylov; k += 1) {
        vectors.push([...current]);
        current = matVec(m, current);
    }

    const { basis, gram } = orthonormalize(vectors);
    const dim = basis.length;
    const projected = Array.from({ length: dim }, (_, i) =>
        Array.from({ length: dim }, (_, j) => {
            const hq = matVec(h, basis[j] ?? []);
            return dot(basis[i] ?? [], hq);
        }),
    );
    const ritz = jacobiEigen(projected);
    const paddedRitz = Array.from({ length: n }, (_, i) => ritz[i] ?? 0);

    let step = 0;
    yield {
        stepNumber: step,
        entities: bars(initial, 0),
        edges: [],
        description: `Quantum Lanczos on ${n} levels: start from a normalized reference state with imaginary-time step ${tau.toFixed(3)}.`,
        codeLineNumber: 0,
        layout: "array",
        meta: { n, krylov, step: 0, coupling, tau },
    };
    step += 1;

    for (let k = 0; k < vectors.length; k += 1) {
        const shown = normalize(vectors[k] ?? []);
        yield {
            stepNumber: step,
            entities: bars(shown, k),
            edges: [],
            description: `Apply imaginary-time evolution ${k} time(s) to build Krylov state ${k + 1} of at most ${krylov}.`,
            codeLineNumber: 2,
            layout: "array",
            meta: { n, krylov, step: k + 1, krylovIndex: k },
        };
        step += 1;
    }

    yield {
        stepNumber: step,
        entities: bars(shownRitz(paddedRitz), Math.max(0, n - dim)),
        edges: [],
        description: `Orthogonalize ${dim} states and project H; the lowest Ritz value is ${(ritz[0] ?? 0).toFixed(4)} from ${dim} Krylov vectors.`,
        codeLineNumber: 4,
        layout: "array",
        meta: {
            n,
            krylov,
            step: vectors.length + 1,
            ritzCount: dim,
            lowest: ritz[0] ?? 0,
            ritzValues: ritz.map((value) => Number(value.toFixed(6))),
            gram,
        },
    };
}

/** Place smaller Ritz values first for a stable readout. */
function shownRitz(values: number[]): number[] {
    return [...values].sort((a, b) => a - b);
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Classical Lanczos keeps multiplying a vector by the Hamiltonian to build a small subspace whose eigenvalues approximate the extremes of the full matrix. Quantum Lanczos builds the same kind of subspace with imaginary-time evolved states, which suppress high-energy components more aggressively. Projecting the Hamiltonian into those few states gives energy estimates from a matrix far smaller than the original.",
        invariants: [
            "Imaginary-time evolution damps excited-state components relative to the ground state.",
            "Each new Krylov state is orthogonalized against all previous states.",
            "Every Ritz value is a Rayleigh quotient and therefore cannot fall below the true ground energy.",
        ],
        correctness:
            "The Taylor series converges to the matrix exponential exp(-tau H) for a bounded Hermitian H, so the prepared states are the exact imaginary-time Krylov states. Modified Gram-Schmidt produces an orthonormal basis Q, and the projected matrix Q transpose H Q is the restriction of H to that subspace. A symmetric matrix's eigenvalues are stationary Rayleigh quotients, so the Jacobi eigenvalues of the projection are the Ritz values; by the min-max principle the smallest Ritz value is at least the true ground energy and decreases monotonically as the subspace grows.",
        complexityRationale:
            "Constructing m imaginary-time states by matrix-vector products costs O(m n^2), orthogonalizing them costs O(m^2 n), and diagonalizing the m by m projection costs O(m^3); with m at most n this is O(m n^3) or less, and storing the matrices and basis uses O(n^2) space.",
        uses: [
            "Estimating ground and excited state energies on near-term quantum processors",
            "Computing molecular spectra when exact diagonalization is too large",
            "A variational subspace method with a clear classical post-processing step",
        ],
        references: [
            "Stair, Huang and Evangelista, Adaptive Quantum Imaginary Time Evolution (2020)",
            "Lanczos, An Iteration Method for the Solution of the Eigenvalue Problem (1950)",
        ],
        workedExample:
            "For a two-level Hamiltonian with diagonal energies 0 and 2 and coupling 0.3, starting from the uniform state and applying imaginary-time evolution twice builds a two-vector Krylov basis. Projecting and diagonalizing gives Ritz values close to the exact eigenvalues about minus 0.044 and 2.044, with the lower value still above the true ground energy as required by the variational principle.",
    },
    id: "quantum-lanczos",
    name: "Quantum Lanczos",
    category: "quantum",
    complexity: { time: "O(m * n^3)", space: "O(n^2)" },
    defaultInput: {
        energies: [0, 1, 2],
        coupling: 0.3,
        tau: 0.25,
        initial: [1, 1, 1],
        krylov: 3,
    },
    visualType: "array",
    run,
    pseudocode: [
        "build the small symmetric Hamiltonian matrix",
        "compute the imaginary-time operator exp(-tau H)",
        "start from a normalized reference state",
        "apply imaginary-time evolution to build Krylov states",
        "orthogonalize the states into an orthonormal basis",
        "project the Hamiltonian into that basis",
        "diagonalize the small projected matrix by Jacobi rotations",
        "report the Ritz values as energy estimates",
    ],
};

export default module;
