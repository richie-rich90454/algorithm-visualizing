/**
 * hidden-shift-algorithm.ts - Hidden Shift Algorithm on the Boolean Cube
 *
 * Given two functions f and g on the group {0,1}^n with g(x) = f(x + s), the
 * hidden shift problem asks for the unknown shift s. The quantum algorithm
 * Fourier-samples the difference of the two functions; for functions whose
 * Fourier transform is supported everywhere, a sample is a random vector y
 * together with the phase bit parity(y and s). Collecting enough independent
 * samples gives a linear system over GF(2) whose solution is s.
 *
 * This is an exact small simulation with stated limits: rather than simulating
 * amplitudes, the oracle is modeled as returning unbiased phase samples, which
 * is what the ideal Fourier measurement produces, and a fixed seed makes the
 * sample sequence deterministic. The shift is recovered by Gaussian
 * elimination over GF(2) and verified against the supplied secret.
 *
 * Time: O(n^3) for the GF(2) solve. Space: O(n^2).
 */

import type { AlgorithmModule, VisualEntity, VisualFrame } from "@/types";

function parity(a: number, b: number): number {
    let bits = a & b;
    let p = 0;
    while (bits !== 0) {
        p ^= 1;
        bits &= bits - 1;
    }
    return p;
}

function makeCells(rows: number[], sampleCount: number, activeRow: number): VisualEntity[] {
    const entities: VisualEntity[] = rows.map((row, index) => ({
        id: `cell-${index}`,
        type: "cell" as const,
        label: `y${index}=${row.toString(2).padStart(4, "0")}`,
        value: row,
        state: index === activeRow ? ("active" as const) : ("idle" as const),
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { index, row, rowIndex: index, col: 0 },
    }));
    entities.push({
        id: "cell-count",
        type: "cell" as const,
        label: `samples=${sampleCount}`,
        value: sampleCount,
        state: "highlight" as const,
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { index: -1, row: sampleCount, rowIndex: rows.length, col: 1 },
    });
    return entities;
}

/** Solve an augmented GF(2) system, returning the solution bits. */
function solveGF2(matrix: number[][], rhs: number[], n: number): number[] | null {
    const rows = matrix.map((row, i) => [...row, rhs[i] as number]);
    let pivotRow = 0;
    const pivotCols: number[] = [];
    for (let col = 0; col < n && pivotRow < rows.length; col += 1) {
        let pivot = -1;
        for (let r = pivotRow; r < rows.length; r += 1) {
            if (((rows[r] as number[])[col] as number) === 1) {
                pivot = r;
                break;
            }
        }
        if (pivot === -1) {
            continue;
        }
        [rows[pivotRow], rows[pivot]] = [rows[pivot] as number[], rows[pivotRow] as number[]];
        for (let r = 0; r < rows.length; r += 1) {
            if (r !== pivotRow && ((rows[r] as number[])[col] as number) === 1) {
                for (let c = col; c <= n; c += 1) {
                    (rows[r] as number[])[c] = ((rows[r] as number[])[c] as number) ^ ((rows[pivotRow] as number[])[c] as number);
                }
            }
        }
        pivotCols.push(col);
        pivotRow += 1;
    }
    if (pivotRow < n) {
        return null;
    }
    const solution = new Array<number>(n).fill(0);
    for (let i = 0; i < pivotRow; i += 1) {
        const col = pivotCols[i] as number;
        solution[col] = (rows[i] as number[])[n] as number;
    }
    return solution;
}

/** Deterministic pseudo-random sampler over a fixed seed. */
function makeSampler(seed: number, n: number) {
    let state = seed >>> 0;
    return (): number => {
        state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
        return state & ((1 << n) - 1);
    };
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { bits?: number; secret?: number; seed?: number } | null) ?? {};
    const n = Math.max(1, Math.min(8, Math.floor(Number(task.bits ?? 4)) || 4));
    const secret = typeof task.secret === "number" ? task.secret & ((1 << n) - 1) : 0b1011 & ((1 << n) - 1);
    const seed = Math.floor(Number(task.seed ?? 12345)) || 12345;
    const nextSample = makeSampler(seed, n);
    let step = 0;

    yield {
        stepNumber: step,
        entities: makeCells([], 0, -1),
        edges: [],
        description: `Search for an ${n}-bit hidden shift using Fourier phase samples.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: { bits: n, seed, secret },
    };
    step += 1;

    const seen = new Set<number>();
    const rows: number[] = [];
    const phases: number[] = [];
    // A GF(2) basis kept in row-echelon form; a sample is useful only when it
    // increases the rank, which guarantees a solvable square system at the end.
    const basis: number[] = new Array<number>(n).fill(0);
    const independent = (candidate: number): boolean => {
        let v = candidate;
        for (let bit = n - 1; bit >= 0; bit -= 1) {
            if (((v >> bit) & 1) === 0) {
                continue;
            }
            const pivot = basis[bit] as number;
            if (pivot === 0) {
                basis[bit] = v;
                return true;
            }
            v ^= pivot;
        }
        return false;
    };
    let attempts = 0;
    while (seen.size < n && attempts < 500) {
        attempts += 1;
        const y = nextSample();
        if (y === 0 || seen.has(y) || !independent(y)) {
            continue;
        }
        seen.add(y);
        rows.push(y);
        phases.push(parity(y, secret));
        yield {
            stepNumber: step,
            entities: makeCells(rows, rows.length, rows.length - 1),
            edges: [],
            description: `Sample ${rows.length}: measured y=${y.toString(2).padStart(n, "0")} with phase bit ${phases[phases.length - 1]}.`,
            codeLineNumber: 2,
            layout: "grid",
            meta: {
                sample: y,
                phase: phases[phases.length - 1],
                sampleCount: rows.length,
                needed: n,
            },
        };
        step += 1;
    }

    if (rows.length < n) {
        yield {
            stepNumber: step,
            entities: makeCells(rows, rows.length, -1),
            edges: [],
            description: "Too few independent samples were produced; the linear system is underdetermined.",
            codeLineNumber: 6,
            layout: "grid",
            meta: { found: false, samples: rows.length, needed: n },
        };
        return;
    }

    const solution = solveGF2(rows.map((y) => {
        const bits = new Array<number>(n).fill(0);
        for (let b = 0; b < n; b += 1) {
            bits[b] = (y >> b) & 1;
        }
        return bits;
    }), phases, n);

    if (!solution) {
        yield {
            stepNumber: step,
            entities: makeCells(rows, rows.length, -1),
            edges: [],
            description: "The sampled equations were linearly dependent, so no unique shift was determined.",
            codeLineNumber: 6,
            layout: "grid",
            meta: { found: false, singular: true },
        };
        return;
    }

    const recovered = solution.reduce((value, bit, index) => value + bit * (1 << index), 0);
    const consistent = rows.every((y, i) => parity(y, recovered) === phases[i]);
    yield {
        stepNumber: step,
        entities: makeCells(rows, rows.length, -1),
        edges: [],
        description: `Solved the parity system: recovered shift ${recovered.toString(2).padStart(n, "0")} (expected ${secret.toString(2).padStart(n, "0")}).`,
        codeLineNumber: 6,
        layout: "grid",
        meta: {
            found: recovered === secret,
            recovered,
            secret,
            samples: rows.length,
            allParitiesConsistent: consistent,
        },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "If g is f shifted by an unknown amount, comparing their Fourier transforms reveals that shift one random frequency at a time. Each measurement gives a random vector y and a single parity bit telling you the dot product of y with the shift. After enough different y vectors those parity equations pin down the shift exactly, just as solving a system of linear equations does.",
        invariants: [
            "Every sampled equation states that parity(y and shift) equals the measured phase bit.",
            "Samples are reused only when their y vectors are distinct and nonzero.",
            "The recovered shift must satisfy all collected parity equations.",
        ],
        correctness:
            "For functions with full Fourier support the ideal hidden-shift measurement returns a uniformly random y and the phase bit parity(y and s). Those are exactly the rows and right-hand sides of a GF(2) linear system whose unique solution, once n independent rows are collected, is the secret shift s. Gaussian elimination over GF(2) finds that unique solution, and the final consistency check confirms it satisfies every sample.",
        complexityRationale:
            "Collecting n distinct nonzero samples takes O(n) expected oracle calls for n bits with a full-support sampler. Row reduction on an n by n binary matrix costs O(n^3) arithmetic on machine words.",
        uses: [
            "Cryptanalysis of shift-style symmetric constructions",
            "Learning hidden translations in group-structured data",
            "Foundational study of quantum Fourier sampling algorithms",
        ],
        references: [
            "Nielsen and Chuang, Quantum Computation and Quantum Information, Chapter 5",
            "Rotteler, Quantum Algorithms for Computing Hidden Shifts, 2008",
        ],
        workedExample:
            "For a 3-bit secret 101, a sample y=110 yields parity 1 because bits 1 and 0 overlap. Collecting three independent vectors such as 110, 101 and 011 gives three parity equations; solving them over GF(2) recovers 101, and each equation is satisfied by that answer.",
    },
    id: "hidden-shift-algorithm",
    name: "Hidden Shift Algorithm",
    category: "quantum",
    complexity: { time: "O(n^3)", space: "O(n^2)" },
    defaultInput: { bits: 4, secret: 11, seed: 12345 },
    visualType: "grid",
    run,
    pseudocode: [
        "read the number of bits, secret shift and sampler seed",
        "repeat until n independent samples are collected",
        "draw a random nonzero frequency vector y",
        "measure the phase bit parity of y and the hidden shift",
        "form one linear equation over GF(2) from y and the bit",
        "solve the collected system by binary Gaussian elimination",
        "verify the recovered shift against the secret",
    ],
};

export default module;
