/**
 * boson-sampling.ts - Boson Sampling (Exact Small Simulation)
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Boson sampling sends n indistinguishable single photons through an m-mode
 * linear optical interferometer described by a unitary U and records which
 * modes they exit. The probability of an output occupation (s_0, ..., s_m-1)
 * is the squared permanent of the n by n submatrix formed by repeating row i
 * of U exactly s_i times and taking the input columns, divided by the product
 * of the factorials s_i!. Computing those permanents is the hard part that
 * makes boson sampling a candidate for demonstrating quantum advantage.
 *
 * This is an exact simulation for small instances: it builds a discrete
 * Fourier unitary, enumerates every output occupation, and evaluates each
 * permanent by brute-force permutation expansion. It models only the ideal
 * collision-inclusive output probabilities and seeded sampling. It does not
 * model loss, partial distinguishability, ZX calculus, or approximate samplers,
 * and exhaustive enumeration limits it to a handful of photons.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(C(n+m-1, n) * n * n!) for exhaustive permanent evaluation
 *   Space: O(C(n+m-1, n) * m) for the output distribution
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Each output occupation is a cell labeled by its mode counts.
 *   - The sampled outcome is green; the most likely outcome is yellow.
 *   - meta carries the distribution, sample, and probability sum.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface Complex {
    re: number;
    im: number;
}

const cAdd = (a: Complex, b: Complex): Complex => ({ re: a.re + b.re, im: a.im + b.im });
const cMul = (a: Complex, b: Complex): Complex => ({ re: a.re * b.re - a.im * b.im, im: a.re * b.im + a.im * b.re });
const cAbsSquared = (a: Complex): number => a.re * a.re + a.im * a.im;

/** The m by m discrete Fourier unitary, U[j][k] = exp(2 pi i jk / m) / sqrt(m). */
export function fourierUnitary(m: number): Complex[][] {
    const scale = 1 / Math.sqrt(m);
    return Array.from({ length: m }, (_, j) =>
        Array.from({ length: m }, (_, k) => {
            const angle = (2 * Math.PI * j * k) / m;
            return { re: Math.cos(angle) * scale, im: Math.sin(angle) * scale };
        }),
    );
}

/** Permanent of a small square complex matrix by permutation expansion. */
export function permanent(matrix: Complex[][]): Complex {
    const n = matrix.length;
    let total: Complex = { re: 0, im: 0 };
    const used = Array.from({ length: n }, () => false);
    const walk = (col: number, product: Complex): void => {
        if (col === n) {
            total = cAdd(total, product);
            return;
        }
        for (let row = 0; row < n; row += 1) {
            if (used[row]) {
                continue;
            }
            used[row] = true;
            walk(col + 1, cMul(product, matrix[row]?.[col] as Complex));
            used[row] = false;
        }
    };
    walk(0, { re: 1, im: 0 });
    return total;
}

function factorial(value: number): number {
    let result = 1;
    for (let i = 2; i <= value; i += 1) {
        result *= i;
    }
    return result;
}

export interface OutputOutcome {
    occupancy: number[];
    probability: number;
    label: string;
}

/** Enumerate output occupations and compute their exact probabilities. */
export function bosonDistribution(unitary: Complex[][], inputModes: number[], photons: number): OutputOutcome[] {
    const m = unitary.length;
    const outcomes: OutputOutcome[] = [];
    const occupancy = Array.from({ length: m }, () => 0);

    const record = (): void => {
        const submatrix: Complex[][] = [];
        for (let mode = 0; mode < m; mode += 1) {
            for (let copy = 0; copy < (occupancy[mode] as number); copy += 1) {
                submatrix.push(inputModes.map((input) => (unitary[mode]?.[input] as Complex)));
            }
        }
        const permanentValue = permanent(submatrix);
        let divisor = 1;
        for (let mode = 0; mode < m; mode += 1) {
            divisor *= factorial(occupancy[mode] as number);
        }
        const probability = cAbsSquared(permanentValue) / divisor;
        outcomes.push({
            occupancy: [...occupancy],
            probability,
            label: `(${occupancy.join(",")})`,
        });
    };

    const place = (mode: number, remaining: number): void => {
        if (mode === m - 1) {
            occupancy[mode] = remaining;
            record();
            occupancy[mode] = 0;
            return;
        }
        for (let count = 0; count <= remaining; count += 1) {
            occupancy[mode] = count;
            place(mode + 1, remaining - count);
        }
        occupancy[mode] = 0;
    };
    place(0, photons);
    return outcomes;
}

/** Deterministic seeded categorical sampler over the probability distribution. */
export function sampleOutcome(outcomes: OutputOutcome[], seed: number): number {
    let state = seed >>> 0;
    state = (state * 1664525 + 1013904223) >>> 0;
    const target = state / 4294967296;
    let cumulative = 0;
    for (let index = 0; index < outcomes.length; index += 1) {
        cumulative += outcomes[index]?.probability ?? 0;
        if (target <= cumulative) {
            return index;
        }
    }
    return outcomes.length - 1;
}

/** Build cells for the output distribution. */
function makeCells(outcomes: OutputOutcome[], sampled: number, visible: number): VisualEntity[] {
    return outcomes.map((outcome, index) => {
        const shown = index <= visible;
        let state: EntityState = "unvisited";
        if (shown) {
            if (index === sampled) {
                state = "sorted";
            } else if (outcome.probability > 1 / outcomes.length) {
                state = "comparing";
            } else {
                state = "idle";
            }
        }
        return {
            id: `outcome-${index}`,
            type: "cell" as const,
            label: shown ? `${outcome.label} p=${outcome.probability.toFixed(4)}` : outcome.label,
            value: outcome.probability,
            state,
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: { row: 0, col: index, occupancy: outcome.occupancy.join(","), probability: outcome.probability },
        };
    });
}

/** The boson-sampling generator. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { modes?: number; photons?: number; inputModes?: number[]; seed?: number } | null) ?? {};
    const modes = Math.min(6, Math.max(2, Math.floor(Number(task.modes ?? 4)) || 4));
    const photons = Math.min(5, Math.max(1, Math.floor(Number(task.photons ?? 2)) || 2));
    const inputModes: number[] = Array.isArray(task.inputModes) && task.inputModes.length === photons
        ? [...task.inputModes]
        : Array.from({ length: photons }, (_, index) => index % modes);
    const seed = typeof task.seed === "number" ? Math.floor(task.seed) : 11;
    const unitary = fourierUnitary(modes);
    const outcomes = bosonDistribution(unitary, inputModes, photons);
    const probabilitySum = outcomes.reduce((sum, outcome) => sum + outcome.probability, 0);
    const sampled = sampleOutcome(outcomes, seed);
    const mostLikely = outcomes.reduce((best, outcome, index) => (outcome.probability > (outcomes[best]?.probability ?? -1) ? index : best), 0);

    let step = 0;
    yield {
        stepNumber: step++,
        entities: makeCells(outcomes, sampled, -1),
        edges: [],
        description: `Boson sampling: ${photons} photons in input modes [${inputModes.join(", ")}] through a ${modes}-mode Fourier interferometer; ${outcomes.length} possible outcomes.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: { rows: 1, cols: outcomes.length, modes, photons, sampled: "", probabilitySum: 0, probability: 0 },
    };

    for (let index = 0; index < outcomes.length; index += 1) {
        const outcome = outcomes[index] as OutputOutcome;
        yield {
            stepNumber: step++,
            entities: makeCells(outcomes, sampled, index),
            edges: [],
            description: `Outcome ${outcome.label}: squared permanent ${outcome.probability.toFixed(6)}${index === mostLikely ? " (most likely)" : ""}.`,
            codeLineNumber: index === mostLikely ? 4 : 3,
            layout: "grid",
            meta: { rows: 1, cols: outcomes.length, modes, photons, sampled: "", probabilitySum: 0, probability: outcome.probability, label: outcome.label },
        };
    }

    yield {
        stepNumber: step,
        entities: makeCells(outcomes, sampled, outcomes.length - 1),
        edges: [],
        description: `Probabilities sum to ${probabilitySum.toFixed(9)}. Seeded sample: ${outcomes[sampled]?.label} with probability ${outcomes[sampled]?.probability.toFixed(6)}.`,
        codeLineNumber: 6,
        layout: "grid",
        meta: {
            rows: 1,
            cols: outcomes.length,
            modes,
            photons,
            sampled: outcomes[sampled]?.label ?? "",
            sampledOccupancy: outcomes[sampled]?.occupancy ?? [],
            probability: outcomes[sampled]?.probability ?? 0,
            probabilitySum,
            distribution: outcomes.map((outcome) => `${outcome.label}:${outcome.probability.toFixed(6)}`),
            note: "exact small simulation: brute-force permanents, at most 5 photons and 6 modes",
        },
    };
}

/** The boson-sampling module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "Send indistinguishable photons through a network of beam splitters and phase shifters and watch where they land. Because photons are bosons, amplitudes for different ways of reaching the same output add constructively, and the chance of an output pattern is a permanent of a submatrix of the interferometer. Permanents are much harder to compute than determinants, which is why sampling from this distribution is believed to be hard for classical computers even though the physics is simple.",
        invariants: [
            "The interferometer matrix is unitary, so all output probabilities sum to one.",
            "An output occupation repeats a matrix row once for each photon in that mode.",
            "A factorial divisor corrects for photons that are indistinguishable within one output mode.",
        ],
        correctness:
            "For n single photons entering distinct input modes of a unitary U, the transition amplitude to a Fock output with occupations s_i is Perm(U_sub) divided by the square root of the product of s_i factorial, where U_sub repeats row i exactly s_i times and keeps the occupied input columns. Squaring gives the stated probability. Because U is unitary, the completeness relation for permanents guarantees the probabilities over all occupations sum to one, which this simulation verifies numerically. Evaluating each permanent by summing over all n permutations is exact for the small n used here.",
        complexityRationale:
            "There are C(n+m-1, n) output occupations. Each permanent expands over n factorial permutations with n multiplications, so the work is O(C(n+m-1, n) * n * n!). Storing the distribution uses O(C(n+m-1, n) * m) space, which is why the teaching model caps n at five and m at six.",
        uses: [
            "Demonstrating quantum computational advantage with photonics",
            "Modeling linear optical interferometers in quantum optics",
            "Teaching why permanents replace determinants for bosons",
        ],
        references: [
            "Aaronson and Arkhipov, The Computational Complexity of Linear Optics, 2011",
            "Hamilton et al., Gaussian Boson Sampling, 2017",
        ],
        workedExample:
            "Two photons enter the two input ports of a balanced beamsplitter, whose Fourier unitary has entries 1/sqrt(2) with a sign on one diagonal. The bunched outcomes (2,0) and (0,2) each have probability one half, while the split outcome (1,1) has permanent zero, the Hong-Ou-Mandel interference dip.",
    },
    id: "boson-sampling",
    name: "Boson Sampling (Exact Small Simulation)",
    category: "quantum",
    complexity: { time: "O(C(n+m-1,n) * n * n!)", space: "O(C(n+m-1,n) * m)" },
    defaultInput: { modes: 4, photons: 2, inputModes: [0, 1], seed: 11 },
    visualType: "grid",
    run,
    pseudocode: [
        "build an m by m unitary for the interferometer",
        "place n indistinguishable photons in distinct input modes",
        "enumerate every output occupation summing to n",
        "repeat each unitary row once per photon in that mode",
        "compute the submatrix permanent by summing permutations",
        "divide the squared permanent by the mode factorials",
        "verify the probabilities sum to one",
        "draw one outcome from the distribution with a seed",
        "done: report the sampled occupation",
    ],
};

export default module;
