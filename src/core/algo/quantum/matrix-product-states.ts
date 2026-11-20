/**
 * matrix-product-states.ts - Matrix Product State (TT-SVD Decomposition)
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * A matrix product state factors the amplitudes of an n-qubit wavefunction into
 * a chain of small tensors connected by bonds of dimension chi. This module
 * performs the exact tensor-train singular-value decomposition: it repeatedly
 * reshapes the state into a matrix, takes its singular-value decomposition,
 * keeps the chi largest singular values, and passes the remainder to the next
 * tensor. The singular values across a cut give the entanglement entropy, and
 * contracting the cores back reconstructs an approximation whose fidelity is
 * reported.
 *
 * This is an exact small simulation for up to eight qubits with real
 * amplitudes, using a Jacobi eigendecomposition to compute each SVD. It does
 * not handle complex amplitudes, optimize a variational MPS, or simulate time
 * evolution. It is a teaching model of the TT-SVD factorization.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(n * 2^(3n/2)) for the successive small SVDs
 *   Space: O(n * chi^2 * 2) for the MPS cores
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - One node per physical amplitude of the wavefunction.
 *   - Bond nodes between sites show their dimension and entanglement entropy.
 *   - The final frame reports reconstruction fidelity and the bond dimensions.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface Input {
    qubits?: number;
    bondDimension?: number;
    state?: string;
}

/** Symmetric eigendecomposition by cyclic Jacobi rotations. Columns are vectors. */
function jacobiEigen(A: number[][]): { values: number[]; vectors: number[][] } {
    const n = A.length;
    const a = A.map((row) => [...row]);
    const v: number[][] = Array.from({ length: n }, (_, i) =>
        Array.from({ length: n }, (_, j) => (i === j ? 1 : 0)),
    );
    for (let sweep = 0; sweep < 60; sweep += 1) {
        let off = 0;
        for (let i = 0; i < n; i += 1) {
            for (let j = i + 1; j < n; j += 1) {
                off = Math.max(off, Math.abs(a[i]?.[j] ?? 0));
            }
        }
        if (off < 1e-14) break;
        for (let p = 0; p < n; p += 1) {
            for (let q = p + 1; q < n; q += 1) {
                const apq = a[p]?.[q] ?? 0;
                if (Math.abs(apq) < 1e-16) continue;
                const theta = ((a[q]?.[q] ?? 0) - (a[p]?.[p] ?? 0)) / (2 * apq);
                const t = (theta >= 0 ? 1 : -1) / (Math.abs(theta) + Math.sqrt(theta * theta + 1));
                const c = 1 / Math.sqrt(t * t + 1);
                const s = t * c;
                const shift = t * apq;
                a[p][p] = (a[p]?.[p] ?? 0) - shift;
                a[q][q] = (a[q]?.[q] ?? 0) + shift;
                a[p][q] = 0;
                a[q][p] = 0;
                for (let k = 0; k < n; k += 1) {
                    if (k === p || k === q) continue;
                    const g = a[k]?.[p] ?? 0;
                    const hh = a[k]?.[q] ?? 0;
                    a[k][p] = c * g - s * hh;
                    a[k][q] = s * g + c * hh;
                    a[p][k] = a[k][p];
                    a[q][k] = a[k][q];
                }
                for (let k = 0; k < n; k += 1) {
                    const g = v[k]?.[p] ?? 0;
                    const hh = v[k]?.[q] ?? 0;
                    v[k][p] = c * g - s * hh;
                    v[k][q] = s * g + c * hh;
                }
            }
        }
    }
    const pairs = Array.from({ length: n }, (_, i) => ({
        value: a[i]?.[i] ?? 0,
        vector: v.map((row) => row[i] ?? 0),
    }));
    pairs.sort((x, y) => y.value - x.value);
    return { values: pairs.map((p) => p.value), vectors: pairs.map((p) => p.vector) };
}

/** SVD of a real matrix A (m by n): U columns, singular values, V columns. */
function svd(A: number[][]): { U: number[][]; S: number[]; V: number[][] } {
    const m = A.length;
    const n = A[0]?.length ?? 0;
    const ATA: number[][] = Array.from({ length: n }, (_, i) =>
        Array.from({ length: n }, (_, j) =>
            A.reduce((sum, row) => sum + (row[i] ?? 0) * (row[j] ?? 0), 0),
        ),
    );
    const eig = jacobiEigen(ATA);
    const S = eig.values.map((val) => Math.sqrt(Math.max(0, val)));
    // eig.vectors holds one vector per column; transpose to V[row][column].
    const V: number[][] = Array.from({ length: n }, (_, row) =>
        Array.from({ length: n }, (_, col) => eig.vectors[col]?.[row] ?? 0),
    );
    const U: number[][] = Array.from({ length: m }, () => new Array<number>(n).fill(0));
    for (let col = 0; col < n; col += 1) {
        const s = S[col] ?? 0;
        if (s < 1e-7) continue;
        for (let row = 0; row < m; row += 1) {
            let sum = 0;
            for (let k = 0; k < n; k += 1) {
                sum += (A[row]?.[k] ?? 0) * (V[k]?.[col] ?? 0);
            }
            U[row][col] = sum / s;
        }
    }
    return { U, S, V };
}

/** Multiply two real matrices. */
function matmul(A: number[][], B: number[][]): number[][] {
    const m = A.length;
    const k = B.length;
    const n = B[0]?.length ?? 0;
    return Array.from({ length: m }, (_, i) =>
        Array.from({ length: n }, (_, j) => {
            let sum = 0;
            for (let r = 0; r < k; r += 1) sum += (A[i]?.[r] ?? 0) * (B[r]?.[j] ?? 0);
            return sum;
        }),
    );
}

/** Build the default GHZ-like state of n qubits. */
function makeState(qubits: number, kind: string): number[] {
    const N = 1 << qubits;
    const psi = new Array<number>(N).fill(0);
    if (kind === "random") {
        let norm = 0;
        for (let i = 0; i < N; i += 1) {
            psi[i] = Math.sin((i + 1) * 1.37) * Math.cos((i + 1) * 0.73);
            norm += psi[i] * psi[i];
        }
        const scale = 1 / Math.sqrt(norm || 1);
        for (let i = 0; i < N; i += 1) psi[i] *= scale;
    } else if (kind === "uniform") {
        for (let i = 0; i < N; i += 1) psi[i] = 1 / Math.sqrt(N);
    } else if (kind === "product") {
        psi[0] = 1;
    } else {
        psi[0] = 1 / Math.sqrt(2);
        psi[N - 1] = 1 / Math.sqrt(2);
    }
    return psi;
}

/** Von Neumann entropy of a normalized singular-value spectrum. */
function entropy(S: number[]): number {
    const sq = S.map((s) => s * s);
    const total = sq.reduce((a, b) => a + b, 0) || 1;
    let h = 0;
    for (const p of sq) {
        const prob = p / total;
        if (prob > 1e-14) h -= prob * Math.log2(prob);
    }
    return h;
}

/** Entanglement spectrum across a given cut of the full state. */
function cutSpectrum(psi: number[], qubits: number, cut: number): number[] {
    const left = 1 << (cut + 1);
    const right = 1 << (qubits - cut - 1);
    const M: number[][] = Array.from({ length: left }, (_, i) =>
        Array.from({ length: right }, (_, j) => psi[i * right + j] ?? 0),
    );
    return svd(M).S;
}

/** Contract MPS cores back into a full state vector. */
function reconstruct(cores: Array<{ left: number; phys: number; right: number; data: number[] }>, qubits: number): number[] {
    let T = cores[0]?.data.slice() ?? [];
    let rows = 2;
    let bond = cores[0]?.right ?? 1;
    for (let k = 1; k < qubits; k += 1) {
        const core = cores[k];
        if (!core) break;
        const A: number[][] = Array.from({ length: rows }, (_, i) =>
            Array.from({ length: bond }, (_, b) => T[i * bond + b] ?? 0),
        );
        const B: number[][] = Array.from({ length: bond }, (_, b) =>
            Array.from({ length: core.phys * core.right }, (_, j) => core.data[b * core.phys * core.right + j] ?? 0),
        );
        const C = matmul(A, B);
        rows *= 2;
        bond = core.right;
        T = C.flat();
    }
    return T;
}

/** Build amplitude nodes and bond nodes for one frame. */
function makeEntities(psi: number[], qubits: number, bonds: number[], entropies: number[], upto: number): VisualEntity[] {
    const entities: VisualEntity[] = [];
    for (let i = 0; i < psi.length; i += 1) {
        entities.push({
            id: `amp-${i}`,
            type: "node",
            label: i.toString(2).padStart(qubits, "0"),
            value: psi[i] ?? 0,
            state: "idle",
            x: i,
            y: (psi[i] ?? 0) * 2,
            width: 0,
            height: 0,
            metadata: { index: i, amplitude: psi[i] ?? 0 },
        });
    }
    for (let k = 0; k < bonds.length; k += 1) {
        entities.push({
            id: `bond-${k}`,
            type: "node",
            label: `chi${k}=${bonds[k]}`,
            value: entropies[k] ?? 0,
            state: k === upto ? "comparing" : k < upto ? "sorted" : "unvisited",
            x: k + 0.5,
            y: 3,
            width: 0,
            height: 0,
            metadata: { kind: "bond", index: k, dimension: bonds[k] ?? 0, entropy: entropies[k] ?? 0 },
        });
    }
    return entities;
}

/** The matrix product state generator. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as Input | null) ?? {};
    const qubits = Math.max(2, Math.min(8, Math.floor(Number(task.qubits ?? 4)) || 4));
    const chi = Math.max(1, Math.min(16, Math.floor(Number(task.bondDimension ?? 4)) || 4));
    const psi = makeState(qubits, String(task.state ?? "ghz"));
    const N = 1 << qubits;

    const bonds: number[] = [];
    const entropies: number[] = [];
    for (let cut = 0; cut < qubits - 1; cut += 1) {
        const spectrum = cutSpectrum(psi, qubits, cut);
        bonds.push(Math.min(chi, spectrum.filter((s) => s > 1e-7).length));
        entropies.push(entropy(spectrum));
    }

    let step = 0;
    yield {
        stepNumber: step,
        entities: makeEntities(psi, qubits, bonds, entropies, -1),
        edges: [],
        description: `Matrix product state over ${qubits} qubits (${N} amplitudes) with maximum bond dimension ${chi}.`,
        codeLineNumber: 0,
        layout: "point",
        meta: { qubits, amplitudes: N, chi, bonds, entropies, fidelity: 0, doneBonds: 0 },
    };
    step += 1;

    for (let cut = 0; cut < qubits - 1; cut += 1) {
        yield {
            stepNumber: step,
            entities: makeEntities(psi, qubits, bonds, entropies, cut),
            edges: [],
            description: `Bond ${cut}: Schmidt rank ${bonds[cut]}, entanglement entropy ${(entropies[cut] ?? 0).toFixed(4)} bits.`,
            codeLineNumber: 2,
            layout: "point",
            meta: { qubits, amplitudes: N, chi, bonds, entropies, currentBond: cut, dimension: bonds[cut], entropyValue: entropies[cut], doneBonds: cut + 1 },
        };
        step += 1;
    }

    // TT-SVD: build the cores with bond dimension truncated to chi.
    const cores: Array<{ left: number; phys: number; right: number; data: number[] }> = [];
    let matrix: number[][] = Array.from({ length: 2 }, (_, i) =>
        Array.from({ length: N / 2 }, (_, j) => psi[i * (N / 2) + j] ?? 0),
    );
    let leftBond = 1;
    for (let k = 0; k < qubits; k += 1) {
        const cols = matrix[0]?.length ?? 1;
        const dec = svd(matrix);
        const significant = dec.S.filter((s) => s > 1e-7).length;
        const rank = Math.max(1, Math.min(chi, significant));
        const coreData: number[] = [];
        for (let b = 0; b < leftBond; b += 1) {
            for (let s = 0; s < 2; s += 1) {
                for (let r = 0; r < rank; r += 1) {
                    coreData.push(dec.U[b * 2 + s]?.[r] ?? 0);
                }
            }
        }
        cores.push({ left: leftBond, phys: 2, right: rank, data: coreData });
        const keptS = dec.S.slice(0, rank);
        const keptV = dec.V.map((row) => row.slice(0, rank));
        // nextRows = diag(keptS) * keptV^T, shape rank by cols.
        const nextRows: number[][] = Array.from({ length: rank }, (_, r) =>
            Array.from({ length: cols }, (_, c) => (keptS[r] ?? 0) * (keptV[c]?.[r] ?? 0)),
        );
        if (k === qubits - 1) break;
        const nextCols = cols / 2;
        matrix = Array.from({ length: rank * 2 }, (_, row) => {
            const r = Math.floor(row / 2);
            const s = row % 2;
            return Array.from({ length: nextCols }, (_, c) => nextRows[r]?.[s * nextCols + c] ?? 0);
        });
        leftBond = rank;
    }

    const rebuilt = reconstruct(cores, qubits);
    let overlap = 0;
    let normSq = 0;
    for (let i = 0; i < N; i += 1) {
        overlap += (psi[i] ?? 0) * (rebuilt[i] ?? 0);
        normSq += (rebuilt[i] ?? 0) ** 2;
    }
    const fidelity = normSq > 1e-14 ? (overlap * overlap) / normSq : 0;

    yield {
        stepNumber: step,
        entities: makeEntities(psi, qubits, bonds, entropies, qubits - 2),
        edges: [],
        description: `Contracted the ${cores.length} MPS cores back into a state with fidelity ${fidelity.toFixed(6)} relative to the original.`,
        codeLineNumber: 5,
        layout: "point",
        meta: { qubits, amplitudes: N, chi, bonds, entropies, fidelity, coreCount: cores.length, coreRanks: cores.map((c) => c.right), done: true },
    };
}

/** The matrix product state module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "A matrix product state compresses a wavefunction into a chain of small tensors, one per site. Each link between neighboring tensors carries only a limited number of states, so a state with little entanglement needs very small tensors even when it has many qubits. The algorithm finds those tensors by repeatedly splitting the state in two with a singular-value decomposition and keeping only the largest pieces.",
        invariants: [
            "Each bond dimension is at most the chosen cap chi.",
            "The singular values across a cut are the Schmidt coefficients of that bipartition.",
            "Recontracting all cores reproduces the original state exactly when no truncation is applied.",
        ],
        correctness:
            "Reshaping the state into a matrix and taking its SVD is exactly a Schmidt decomposition across that cut: the singular values are the Schmidt coefficients and their squared values give the reduced density matrix spectrum. The TT-SVD procedure factors the full tensor into cores whose bond dimensions equal the kept ranks. Truncating the smallest singular values minimizes the Frobenius-norm error of each split, so contracting the cores back yields the best rank-bounded approximation and a fidelity that approaches one as chi grows.",
        complexityRationale:
            "Each split takes an SVD of a matrix of dimension roughly 2 by 2 to the n-1, costing O(2 to the 3n/2) with the small Jacobi solver, repeated n times. The resulting cores store O(n chi squared) numbers and reconstruction is linear in that size.",
        uses: [
            "Simulating one-dimensional quantum many-body systems with limited entanglement",
            "The ansatz behind the density matrix renormalization group",
            "Classical compression of high-dimensional tensors in machine learning",
        ],
        references: [
            "Verstraete and Cirac, Matrix Product States and Projected Entangled Pair States, 2004",
            "Schollwoeck, The Density-Matrix Renormalization Group in the Age of Matrix Product States, 2011",
        ],
        workedExample:
            "The four-qubit GHZ state has amplitudes only on 0000 and 1111. Every cut separates these two components, so each bond has Schmidt rank two and entropy one bit. With chi at least two the TT-SVD keeps both singular values and recontracts the four cores to reproduce the state with fidelity one; with chi equal to one the approximation collapses to a product state and the fidelity drops.",
    },
    id: "matrix-product-states",
    name: "Matrix Product States (TT-SVD)",
    category: "quantum",
    complexity: { time: "O(n * 2^(3n/2))", space: "O(n * chi^2)" },
    defaultInput: { qubits: 4, bondDimension: 4, state: "ghz" },
    visualType: "point",
    run,
    pseudocode: [
        "reshape the wavefunction into a matrix over the first site",
        "compute its singular-value decomposition",
        "keep the chi largest singular values as the bond",
        "store the left vectors as the next core",
        "reshape the remaining factors and split the next site",
        "repeat until every site has a core",
        "contract the cores and measure fidelity",
        "done: report bond dimensions and entanglement",
    ],
};

export default module;
