/**
 * simons-problem.ts - Simon's Problem (Small Exact Oracle Model)
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Simon's problem asks for the hidden XOR mask s of a two-to-one function that
 * satisfies f(x) = f(x xor s). The quantum algorithm prepares a superposition,
 * queries the oracle, measures, and applies a Hadamard transform. Each sample
 * y is orthogonal to s modulo two, so n-1 independent samples determine s by a
 * linear system over GF(2). This module uses an explicit classical oracle and
 * exact bit arithmetic; it is a small teaching model, not a quantum computer or
 * a fault-tolerant implementation.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(n^3) for the GF(2) solve on n sampled bits
 *   Space: O(n^2) for the sampled bit matrix
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - A grid shows each sampled y as a row of bits and the recovered s below.
 *   - The newest sample is yellow; the recovered mask is green.
 *   - Sampling and verification facts appear in the frame metadata.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

/** Build the bit grid for all samples and the recovered mask. */
function makeCells(
    samples: number[],
    recovered: number,
    bits: number,
    activeRow: number,
    recoveredState: EntityState,
): VisualEntity[] {
    const rows = samples.length + 1;
    const entities: VisualEntity[] = [];
    for (let i = 0; i < rows; i += 1) {
        const value = i < samples.length ? (samples[i] ?? 0) : recovered;
        for (let j = 0; j < bits; j += 1) {
            const bit = (value >> (bits - 1 - j)) & 1;
            entities.push({
                id: `cell-${i}-${j}`,
                type: "cell" as const,
                label: String(bit),
                value: bit,
                state: i === samples.length ? recoveredState : i === activeRow ? "comparing" : "idle",
                x: 0,
                y: 0,
                width: 0,
                height: 0,
                metadata: { row: i, col: j },
            });
        }
    }
    return entities;
}

/** Parity of the bitwise AND of two integers, the GF(2) dot product. */
function parityAnd(a: number, b: number): number {
    let parity = 0;
    let value = a & b;
    while (value !== 0) {
        parity ^= 1;
        value &= value - 1;
    }
    return parity;
}

/** Collect independent nonzero samples y with y dot s equal to zero mod two. */
function collectSamples(bits: number, s: number): number[] {
    const samples: number[] = [];
    for (let y = 1; y < 1 << bits && samples.length < bits - 1; y += 1) {
        if (parityAnd(y, s) !== 0) {
            continue;
        }
        const candidate = [...samples, y];
        if (rankOf(candidate, bits) === candidate.length) {
            samples.push(y);
        }
    }
    return samples;
}

/** Gaussian elimination over GF(2), returning the row rank. */
function rankOf(values: number[], bits: number): number {
    const matrix = values.map((value) =>
        Array.from({ length: bits }, (_, j) => (value >> (bits - 1 - j)) & 1),
    );
    let pivotRow = 0;
    for (let col = 0; col < bits && pivotRow < matrix.length; col += 1) {
        const pivot = matrix.findIndex((row, i) => i >= pivotRow && row[col] === 1);
        if (pivot === -1) {
            continue;
        }
        [matrix[pivotRow], matrix[pivot]] = [matrix[pivot]!, matrix[pivotRow]!];
        for (let i = 0; i < matrix.length; i += 1) {
            if (i !== pivotRow && matrix[i]![col] === 1) {
                for (let j = col; j < bits; j += 1) {
                    matrix[i]![j] ^= matrix[pivotRow]![j];
                }
            }
        }
        pivotRow += 1;
    }
    return pivotRow;
}

/** Solve the homogeneous system y dot s = 0 for its one-dimensional null space. */
function solveMask(samples: number[], bits: number): number {
    const matrix = samples.map((value) =>
        Array.from({ length: bits }, (_, j) => (value >> (bits - 1 - j)) & 1),
    );
    const pivotCols: number[] = [];
    let pivotRow = 0;
    for (let col = 0; col < bits && pivotRow < matrix.length; col += 1) {
        const pivot = matrix.findIndex((row, i) => i >= pivotRow && row[col] === 1);
        if (pivot === -1) {
            continue;
        }
        [matrix[pivotRow], matrix[pivot]] = [matrix[pivot]!, matrix[pivotRow]!];
        for (let i = 0; i < matrix.length; i += 1) {
            if (i !== pivotRow && matrix[i]![col] === 1) {
                for (let j = col; j < bits; j += 1) {
                    matrix[i]![j] ^= matrix[pivotRow]![j];
                }
            }
        }
        pivotCols.push(col);
        pivotRow += 1;
    }
    const freeCols = Array.from({ length: bits }, (_, j) => j).filter(
        (j) => !pivotCols.includes(j),
    );
    const solution = new Array<number>(bits).fill(0);
    const free = freeCols[0];
    if (free === undefined) {
        return 0;
    }
    solution[free] = 1;
    for (let i = 0; i < pivotCols.length; i += 1) {
        solution[pivotCols[i]!] = matrix[i]![free];
    }
    let value = 0;
    for (let j = 0; j < bits; j += 1) {
        if (solution[j] === 1) {
            value |= 1 << (bits - 1 - j);
        }
    }
    return value;
}

/** Canonical two-to-one oracle: f(x) = f(x xor s). */
function oracle(x: number, s: number): number {
    return Math.min(x, x ^ s);
}

/** The Simon problem generator. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { bits?: number; hidden?: number } | null) ?? {};
    const bits = typeof task.bits === "number" && task.bits >= 2 && task.bits <= 6
        ? Math.floor(task.bits)
        : 3;
    const size = 1 << bits;
    const proposed =
        typeof task.hidden === "number" && task.hidden > 0 && task.hidden < size
            ? Math.floor(task.hidden)
            : 5 % size || 1;
    const s = proposed > 0 ? proposed : 1;
    const samples = collectSamples(bits, s);
    const recovered = solveMask(samples, bits);
    const rank = rankOf(samples, bits);
    let valid = recovered === s;
    for (let x = 0; x < size && valid; x += 1) {
        if (oracle(x, s) !== oracle(x ^ s, s)) {
            valid = false;
        }
    }

    let step = 0;
    yield {
        stepNumber: step,
        entities: makeCells(samples, recovered, bits, -1, "unvisited"),
        edges: [],
        description: `A hidden nonzero mask s on ${bits} bits makes the oracle two-to-one; find s with O(n) quantum samples.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: { rows: samples.length + 1, cols: bits, bits, samples: [], recovered, rank: 0, valid: false },
    };
    step += 1;

    yield {
        stepNumber: step,
        entities: makeCells(samples, recovered, bits, -1, "unvisited"),
        edges: [],
        description: "Hadamard gates put all 2^n inputs into an equal superposition before the oracle query.",
        codeLineNumber: 1,
        layout: "grid",
        meta: { rows: samples.length + 1, cols: bits, bits, samples: [], recovered, rank: 0, valid: false },
    };
    step += 1;

    yield {
        stepNumber: step,
        entities: makeCells(samples, recovered, bits, -1, "unvisited"),
        edges: [],
        description: "The oracle flips the phase of the matching pair; the final Hadamard reveals a y orthogonal to s.",
        codeLineNumber: 2,
        layout: "grid",
        meta: { rows: samples.length + 1, cols: bits, bits, samples: [], recovered, rank: 0, valid: false },
    };
    step += 1;

    for (let i = 0; i < samples.length; i += 1) {
        yield {
            stepNumber: step,
            entities: makeCells(samples, recovered, bits, i, "unvisited"),
            edges: [],
            description: `Sample ${i + 1}: y = ${(samples[i] ?? 0).toString(2).padStart(bits, "0")}, whose parity with s is zero.`,
            codeLineNumber: 3,
            layout: "grid",
            meta: {
                rows: samples.length + 1,
                cols: bits,
                bits,
                samples: samples.slice(0, i + 1),
                recovered,
                rank: rankOf(samples.slice(0, i + 1), bits),
                valid: false,
            },
        };
        step += 1;
    }

    yield {
        stepNumber: step,
        entities: makeCells(samples, recovered, bits, -1, "comparing"),
        edges: [],
        description: `The ${samples.length} independent samples give rank ${rank}; solving the GF(2) system yields s = ${recovered.toString(2).padStart(bits, "0")}.`,
        codeLineNumber: 5,
        layout: "grid",
        meta: { rows: samples.length + 1, cols: bits, bits, samples: [...samples], recovered, rank, valid: false },
    };
    step += 1;

    yield {
        stepNumber: step,
        entities: makeCells(samples, recovered, bits, -1, "sorted"),
        edges: [],
        description: valid
            ? `Verified f(x) = f(x xor s) for all ${size} inputs with s = ${recovered.toString(2).padStart(bits, "0")}.`
            : "The recovered mask failed the oracle check; this cannot happen with enough independent samples.",
        codeLineNumber: 7,
        layout: "grid",
        meta: { rows: samples.length + 1, cols: bits, bits, samples: [...samples], recovered, rank, valid },
    };
}

/** The Simon problem module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "The hidden mask s makes the oracle map each pair x and x xor s to the same answer. Quantum interference filters out every outcome y whose parity with s is one. Each surviving y is one linear equation over GF(2), and a little more than n such equations pin down s exactly.",
        invariants: [
            "Every sampled y satisfies y dot s equal to zero modulo two.",
            "Independent samples each raise the rank of the collected system by one.",
            "The oracle is two-to-one with f(x) equal to f(x xor s) for every input.",
        ],
        correctness:
            "The quantum Fourier sampling step yields y orthogonal to s with probability one and every other y with probability zero, because amplitudes of paired inputs cancel when the parity is odd. With n-1 independent such equations the solution space is one-dimensional over GF(2), so the nonzero null-space vector recovered by elimination is exactly s. The final brute-force oracle check confirms the identification.",
        complexityRationale:
            "The quantum procedure needs O(n) oracle queries. The classical post-processing performs Gaussian elimination on an n by n binary matrix, costing O(n^3) bit operations and O(n^2) space.",
        uses: [
            "A demonstration of exponential speedup over classical randomized search",
            "A precursor to Shor's factoring algorithm",
            "Testing hidden-period structure in black-box functions",
        ],
        references: [
            "Simon, On the Power of Quantum Computation, 1994",
            "Nielsen and Chuang, Quantum Computation and Quantum Information, Chapter 5",
        ],
        workedExample:
            "For three bits with hidden mask 101, sampling yields y values 011 and 110. Both have even parity with 101. The only nonzero vector orthogonal to both rows is 101, which is the hidden mask.",
    },
    id: "simons-problem",
    name: "Simon's Problem (Small Oracle Model)",
    category: "quantum",
    complexity: { time: "O(n^3)", space: "O(n^2)" },
    defaultInput: { bits: 3, hidden: 5 },
    visualType: "grid",
    run,
    pseudocode: [
        "prepare an equal superposition over all n-bit inputs",
        "query the oracle and measure the second register",
        "apply Hadamard gates to the first register and measure y",
        "keep y only when it raises the rank of the sample set",
        "repeat until n-1 independent samples are collected",
        "solve the homogeneous system y dot s equals zero over GF(2)",
        "check that f(x) equals f(x xor s) for every input",
        "done: report the recovered hidden mask s",
    ],
};

export default module;
