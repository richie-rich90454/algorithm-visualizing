/**
 * density-matrix-renormalization-group.ts - DMRG Density-Matrix Truncation
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * The density-matrix renormalization group finds ground states of one-dimensional
 * quantum chains by keeping only the most important states of a block. It splits
 * the chain into a left block and a right environment, forms the exact ground
 * state of the whole chain, and reshapes it into a matrix whose rows index the
 * left block. The reduced density matrix of that block is diagonalized, and only
 * the m eigenvectors with the largest weight are kept. Projecting the ground
 * state onto those states gives the optimal rank-m approximation of the wave
 * function, which is the core truncation step of a DMRG sweep.
 *
 * This module uses a transverse-field Ising chain of four spins, diagonalized
 * exactly by a small Jacobi eigensolver. It is an exact small simulation of the
 * truncation step, not a full production MPS sweep; the limit is stated in the
 * writeup.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(N^3) for dense diagonalization, N = 2^L; O(N) per truncation level
 *   Space: O(N^2) for the dense Hamiltonian
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Bars show the eigenvalues of the left-block reduced density matrix.
 *   - Kept states are green; discarded states are yellow.
 *   - Exact energy, truncated energy, kept weight, and error are in metadata.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

export interface Eigensystem {
    values: number[];
    /** Eigenvectors stored as columns: vectors[index][component]. */
    vectors: number[][];
}

/** Diagonalize a real symmetric matrix by cyclic Jacobi rotations. */
export function jacobiEigen(matrix: number[][]): Eigensystem {
    const n = matrix.length;
    const a = matrix.map((row) => [...row]);
    const v: number[][] = Array.from({ length: n }, (_, i) =>
        Array.from({ length: n }, (_, j) => (i === j ? 1 : 0)),
    );
    for (let sweep = 0; sweep < 100; sweep += 1) {
        let off = 0;
        for (let i = 0; i < n; i += 1) {
            for (let j = i + 1; j < n; j += 1) off = Math.max(off, Math.abs(a[i]![j]!));
        }
        if (off < 1e-14) break;
        for (let p = 0; p < n; p += 1) {
            for (let q = p + 1; q < n; q += 1) {
                const apq = a[p]![q]!;
                if (Math.abs(apq) < 1e-15) continue;
                const theta = (a[q]![q]! - a[p]![p]!) / (2 * apq);
                const sign = theta >= 0 ? 1 : -1;
                const t = sign / (Math.abs(theta) + Math.sqrt(1 + theta * theta));
                const c = 1 / Math.sqrt(1 + t * t);
                const s = t * c;
                const app = a[p]![p]!;
                const aqq = a[q]![q]!;
                for (let k = 0; k < n; k += 1) {
                    if (k === p || k === q) continue;
                    const akp = a[k]![p]!;
                    const akq = a[k]![q]!;
                    a[k]![p] = a[p]![k] = c * akp - s * akq;
                    a[k]![q] = a[q]![k] = s * akp + c * akq;
                }
                a[p]![p] = c * c * app - 2 * s * c * apq + s * s * aqq;
                a[q]![q] = s * s * app + 2 * s * c * apq + c * c * aqq;
                a[p]![q] = a[q]![p] = 0;
                for (let k = 0; k < n; k += 1) {
                    const vkp = v[k]![p]!;
                    const vkq = v[k]![q]!;
                    v[k]![p] = c * vkp - s * vkq;
                    v[k]![q] = s * vkp + c * vkq;
                }
            }
        }
    }
    const order = Array.from({ length: n }, (_, i) => i).sort((i, j) => a[i]![i]! - a[j]![j]!);
    return {
        values: order.map((i) => a[i]![i]!),
        vectors: order.map((i) => v.map((row) => row[i]!)),
    };
}

/** Transverse-field Ising Hamiltonian on L open spins (unit mass notation). */
export function isingHamiltonian(l: number, g: number): number[][] {
    const n = 1 << l;
    const h = Array.from({ length: n }, () => Array<number>(n).fill(0));
    for (let s = 0; s < n; s += 1) {
        let interaction = 0;
        for (let i = 0; i < l - 1; i += 1) {
            const zi = ((s >> i) & 1) === 0 ? 1 : -1;
            const zj = ((s >> (i + 1)) & 1) === 0 ? 1 : -1;
            interaction -= zi * zj;
        }
        h[s]![s] = interaction;
        for (let i = 0; i < l; i += 1) {
            const flipped = s ^ (1 << i);
            h[s]![flipped] = (h[s]![flipped] ?? 0) - g;
        }
    }
    return h;
}

/** Exact ground-state energy and vector of a dense Hamiltonian. */
export function exactGroundState(hamiltonian: number[][]): { energy: number; vector: number[] } {
    const system = jacobiEigen(hamiltonian);
    return { energy: system.values[0] ?? 0, vector: (system.vectors[0] ?? []).slice() };
}

export interface DmrgLevel {
    keptStates: number;
    energy: number;
    keptWeight: number;
    truncationError: number;
}

export interface DmrgResult {
    exactEnergy: number;
    /** Left-block density-matrix eigenvalues, descending. */
    spectrum: number[];
    levels: DmrgLevel[];
}

/** Density-matrix truncation of the ground state for kept states 1..leftDim. */
export function dmrgTruncate(
    hamiltonian: number[][],
    ground: number[],
    leftDim: number,
    rightDim: number,
): DmrgResult {
    const energy = exactGroundState(hamiltonian).energy;
    const matrix = Array.from({ length: leftDim }, (_, a) =>
        Array.from({ length: rightDim }, (_, b) => ground[a * rightDim + b] ?? 0),
    );
    const rho = Array.from({ length: leftDim }, (_, a) =>
        Array.from({ length: leftDim }, (_, b) =>
            matrix[a]!.reduce((sum, value, r) => sum + value * (matrix[b]![r] ?? 0), 0),
        ),
    );
    const system = jacobiEigen(rho);
    const spectrum = [...system.values].reverse();
    const trace = spectrum.reduce((sum, value) => sum + value, 0);
    const levels: DmrgLevel[] = [];

    for (let m = 1; m <= leftDim; m += 1) {
        // Projector onto the m largest eigenvectors of rho.
        const projector = Array.from({ length: leftDim }, () => Array<number>(leftDim).fill(0));
        for (let k = 0; k < m; k += 1) {
            const columnIndex = leftDim - 1 - k;
            const u = system.vectors[columnIndex] ?? [];
            for (let a = 0; a < leftDim; a += 1) {
                for (let b = 0; b < leftDim; b += 1) {
                    projector[a]![b] = (projector[a]![b] ?? 0) + (u[a] ?? 0) * (u[b] ?? 0);
                }
            }
        }
        const flattened: number[] = [];
        for (let a = 0; a < leftDim; a += 1) {
            for (let b = 0; b < rightDim; b += 1) {
                let value = 0;
                for (let c = 0; c < leftDim; c += 1) {
                    value += (projector[a]![c] ?? 0) * (matrix[c]![b] ?? 0);
                }
                flattened.push(value);
            }
        }
        const norm = Math.sqrt(flattened.reduce((sum, value) => sum + value * value, 0));
        const normalized = flattened.map((value) => value / norm);
        const hTimes = hamiltonian.map((row) => row.reduce((sum, value, j) => sum + value * (normalized[j] ?? 0), 0));
        const levelEnergy = normalized.reduce((sum, value, i) => sum + value * (hTimes[i] ?? 0), 0);
        const keptWeight = spectrum.slice(0, m).reduce((sum, value) => sum + value, 0) / trace;
        levels.push({
            keptStates: m,
            energy: levelEnergy,
            keptWeight,
            truncationError: 1 - keptWeight,
        });
    }
    return { exactEnergy: energy, spectrum, levels };
}

/** Bars for the density-matrix spectrum. */
function makeBars(spectrum: number[], kept: number): VisualEntity[] {
    return spectrum.map((weight, index) => ({
        id: `bar-${index}`,
        type: "bar" as const,
        label: weight.toFixed(4),
        value: weight,
        state: (index < kept ? "sorted" : "comparing") as EntityState,
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { index, weight, kept: index < kept },
    }));
}

/** The DMRG generator. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { length?: number; field?: number; keptStates?: number } | null) ?? {};
    const length = Math.max(2, Math.min(6, typeof task.length === "number" ? Math.floor(task.length) : 4));
    const evenLength = length % 2 === 0 ? length : length - 1;
    const g = typeof task.field === "number" ? task.field : 1;
    const hamiltonian = isingHamiltonian(evenLength, g);
    const ground = exactGroundState(hamiltonian);
    const leftDim = 1 << (evenLength / 2);
    const rightDim = leftDim;
    const result = dmrgTruncate(hamiltonian, ground.vector, leftDim, rightDim);
    const maxKept = typeof task.keptStates === "number"
        ? Math.max(1, Math.min(leftDim, Math.floor(task.keptStates)))
        : leftDim;

    let step = 0;
    yield {
        stepNumber: step++,
        entities: makeBars(result.spectrum, 0),
        edges: [],
        description: `Splitting a ${evenLength}-spin Ising chain into two blocks of ${leftDim} states each.`,
        codeLineNumber: 0,
        layout: "array",
        meta: {
            spins: evenLength,
            field: g,
            exactEnergy: result.exactEnergy,
            dmrgEnergy: result.exactEnergy,
            keptStates: 0,
            keptWeight: 0,
            truncationError: 1,
        },
    };

    for (const level of result.levels) {
        if (level.keptStates > maxKept) break;
        yield {
            stepNumber: step++,
            entities: makeBars(result.spectrum, level.keptStates),
            edges: [],
            description: `Keeping ${level.keptStates} state(s): energy ${level.energy.toFixed(6)}, kept weight ${level.keptWeight.toFixed(6)}, truncation error ${level.truncationError.toExponential(2)}.`,
            codeLineNumber: level.keptStates === leftDim ? 5 : 3,
            layout: "array",
            meta: {
                spins: evenLength,
                field: g,
                exactEnergy: result.exactEnergy,
                dmrgEnergy: level.energy,
                keptStates: level.keptStates,
                keptWeight: level.keptWeight,
                truncationError: level.truncationError,
            },
        };
    }

    const final = result.levels[Math.min(maxKept, leftDim) - 1]!;
    yield {
        stepNumber: step,
        entities: makeBars(result.spectrum, final.keptStates),
        edges: [],
        description: `DMRG complete: energy ${final.energy.toFixed(6)} with ${final.keptStates} kept state(s); exact energy is ${result.exactEnergy.toFixed(6)}.`,
        codeLineNumber: 6,
        layout: "array",
        meta: {
            spins: evenLength,
            field: g,
            exactEnergy: result.exactEnergy,
            dmrgEnergy: final.energy,
            keptStates: final.keptStates,
            keptWeight: final.keptWeight,
            truncationError: final.truncationError,
            spectrum: result.spectrum,
        },
    };
}

/** The DMRG module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "A quantum chain has far more possible states than any computer can store, but its ground state usually uses only a small corner of that space. DMRG finds which corner matters by measuring how much each block state contributes to the whole wave function, then throwing away the states with tiny weight. Repeating this rotation and truncation gives accurate ground states with surprisingly few states per block.",
        invariants: [
            "The reduced density matrix is symmetric and positive semidefinite, so its eigenvalues are nonnegative.",
            "Keeping all left-block states reproduces the exact ground state and its energy.",
            "The variational energy of any truncated state is at least the exact ground-state energy.",
        ],
        correctness:
            "Reshaping the ground state into a left-by-right matrix and forming rho = M M transpose gives the reduced density matrix of the left block; its eigenvectors are the states that best capture the block's contribution. The projector onto the m largest eigenvectors is the rank-m approximation that minimizes the Frobenius distance to M, so it is the optimal truncation. Since the truncated vector is normalized, the Rayleigh quotient with H is an upper bound on the true ground energy by the variational principle, and with m equal to the full block dimension the projector is the identity and the exact energy is recovered.",
        complexityRationale:
            "Dense Jacobi diagonalization of the 2-to-the-L Hamiltonian costs O(N^3) sweeps in the worst case with N = 2^L, and the reduced density matrix is small. Each kept-state level forms a projector and a Rayleigh quotient in O(N) work; the chain length is capped so the dense simulation stays exact and affordable.",
        uses: [
            "Ground states of strongly correlated one-dimensional materials",
            "Tensor-network and matrix-product-state methods",
            "Benchmarking small quantum chains against exact diagonalization",
        ],
        references: [
            "White, Density Matrix Formulation for Quantum Renormalization Groups, Physical Review Letters, 1992",
            "Schollwock, The Density-Matrix Renormalization Group in the Age of Matrix Product States, 2011",
        ],
        workedExample:
            "For a four-spin Ising chain the exact ground energy is about -5.24 at unit field. Splitting into two-spin blocks gives a four-state reduced density matrix; keeping all four states reproduces that energy, while keeping one state captures most of the weight but gives a higher, variational energy.",
    },
    id: "density-matrix-renormalization-group",
    name: "Density Matrix Renormalization Group",
    category: "quantum",
    complexity: { time: "O(N^3)", space: "O(N^2)" },
    defaultInput: { length: 4, field: 1, keptStates: 4 },
    visualType: "array",
    run,
    pseudocode: [
        "build the Hamiltonian of the open spin chain",
        "diagonalize it to obtain the exact ground state",
        "reshape the ground state into a left-block by environment matrix",
        "form the reduced density matrix of the left block",
        "diagonalize it and keep the largest eigenvalues",
        "project the ground state onto the retained eigenvectors",
        "compute the variational energy of the truncated state",
        "done: report the energy and the kept weight at each level",
    ],
};

export default module;
