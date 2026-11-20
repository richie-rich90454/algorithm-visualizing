/**
 * algorithmic-cooling.ts - Heat-Bath Algorithmic Cooling (Exact Toy Model)
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Heat-bath algorithmic cooling increases the polarization of a chosen compute
 * qubit by repeatedly moving entropy into two reset qubits and then discarding
 * that entropy into a cold bath. Each round performs an ideal reset of the two
 * bath qubits followed by a reversible permutation of the eight classical
 * basis states that sorts the largest populations into the compute-zero
 * subspace.
 *
 * ---------------------------------------------------------------------------
 * Scope of the model
 * ---------------------------------------------------------------------------
 * This is a SMALL EXACT SIMULATION. It tracks the full probability
 * distribution over three qubits (eight real populations) and applies ideal
 * resets and a population-sorting permutation. The permutation is a valid
 * reversible map of basis states but is not a device-optimized HBAC gate, and
 * there is no decoherence, gate error, or finite-temperature bath model beyond
 * the single reset bias. Physical implementations require real qubits and
 * error correction; no such claim is made here.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(rounds * 8 log 8) for the eight-state simulation
 *   Space: O(8)
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Eight bars show the probability of each computational basis state.
 *   - Bars are comparing during reset and sorted after compression.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

type Distribution = number[];

type CoolingInput = { computeBias?: number; bathBias?: number; rounds?: number };

function binaryLabel(index: number): string {
    return index.toString(2).padStart(3, "0");
}

function initialDistribution(computeBias: number, bathBias: number): Distribution {
    const pComputeZero = (1 + computeBias) / 2;
    const pBathZero = (1 + bathBias) / 2;
    const dist: Distribution = [];
    for (let i = 0; i < 8; i += 1) {
        const b0 = (i >> 2) & 1;
        const b1 = (i >> 1) & 1;
        const b2 = i & 1;
        const p0 = b0 === 0 ? pComputeZero : 1 - pComputeZero;
        const p1 = b1 === 0 ? pBathZero : 1 - pBathZero;
        const p2 = b2 === 0 ? pBathZero : 1 - pBathZero;
        dist.push(p0 * p1 * p2);
    }
    return dist;
}

/** Replace the two bath bits with fresh thermal bits, keeping the compute bit. */
function resetBath(dist: Distribution, bathBias: number): Distribution {
    const pZero = (1 + bathBias) / 2;
    const weights = [pZero * pZero, pZero * (1 - pZero), (1 - pZero) * pZero, (1 - pZero) * (1 - pZero)];
    const next: Distribution = new Array(8).fill(0);
    for (let b0 = 0; b0 <= 1; b0 += 1) {
        let mass = 0;
        for (let bath = 0; bath < 4; bath += 1) {
            mass += dist[b0 * 4 + bath] as number;
        }
        for (let bath = 0; bath < 4; bath += 1) {
            next[b0 * 4 + bath] = mass * (weights[bath] as number);
        }
    }
    return next;
}

/** Reversibly sort populations so the largest ones occupy compute-zero states. */
function compress(dist: Distribution): Distribution {
    const targets: number[] = [];
    for (let b0 = 0; b0 <= 1; b0 += 1) {
        for (let bath = 0; bath < 4; bath += 1) {
            targets.push(b0 * 4 + bath);
        }
    }
    const ordered = dist
        .map((probability, index) => ({ probability, index }))
        .sort((a, b) => b.probability - a.probability || a.index - b.index);
    const next: Distribution = new Array(8).fill(0);
    ordered.forEach((entry, rank) => {
        next[targets[rank] as number] = entry.probability;
    });
    return next;
}

function computeBiasOf(dist: Distribution): number {
    let bias = 0;
    for (let i = 0; i < 8; i += 1) {
        bias += ((i >> 2) & 1) === 0 ? (dist[i] as number) : -(dist[i] as number);
    }
    return bias;
}

function makeBars(dist: Distribution, states: Map<number, EntityState>, final: boolean): VisualEntity[] {
    return dist.map((probability, index) => ({
        id: `state-${index}`,
        type: "bar" as const,
        label: binaryLabel(index),
        value: probability,
        state: final ? "sorted" : states.get(index) ?? "idle",
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { index, bitString: binaryLabel(index), probability },
    }));
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as CoolingInput | null) ?? {};
    const computeBias = typeof task.computeBias === "number" ? Math.max(-0.99, Math.min(0.99, task.computeBias)) : 0.1;
    const bathBias = typeof task.bathBias === "number" ? Math.max(0, Math.min(0.99, task.bathBias)) : 0.5;
    const rounds = typeof task.rounds === "number" ? Math.max(1, Math.min(12, task.rounds)) : 4;

    let dist = initialDistribution(computeBias, bathBias);
    let step = 0;

    yield {
        stepNumber: step,
        entities: makeBars(dist, new Map(), false),
        edges: [],
        description: `Three-qubit cooling model: compute bias ${computeBias}, bath bias ${bathBias}, ${rounds} round(s).`,
        codeLineNumber: 0,
        layout: "array",
        meta: { round: 0, phase: "initial", computeBias: computeBiasOf(dist), probabilities: [...dist] },
    };
    step += 1;

    for (let round = 1; round <= rounds; round += 1) {
        dist = resetBath(dist, bathBias);
        const resetStates = new Map<number, EntityState>();
        for (let i = 0; i < 8; i += 1) {
            resetStates.set(i, ((i >> 2) & 1) === 0 ? "comparing" : "visited");
        }
        yield {
            stepNumber: step,
            entities: makeBars(dist, resetStates, false),
            edges: [],
            description: `Round ${round}: reset the two bath qubits to bias ${bathBias}, leaving the compute bit unchanged.`,
            codeLineNumber: 2,
            layout: "array",
            meta: { round, phase: "reset", computeBias: computeBiasOf(dist), probabilities: [...dist] },
        };
        step += 1;

        dist = compress(dist);
        yield {
            stepNumber: step,
            entities: makeBars(dist, new Map(), false),
            edges: [],
            description: `Round ${round}: reversible compression moves the largest populations into compute-zero states.`,
            codeLineNumber: 4,
            layout: "array",
            meta: { round, phase: "compress", computeBias: computeBiasOf(dist), probabilities: [...dist] },
        };
        step += 1;
    }

    yield {
        stepNumber: step,
        entities: makeBars(dist, new Map(), true),
        edges: [],
        description: `Cooling finished: compute polarization ${computeBiasOf(dist).toFixed(4)} after ${rounds} round(s).`,
        codeLineNumber: 6,
        layout: "array",
        meta: {
            round: rounds,
            phase: "final",
            computeBias: computeBiasOf(dist),
            probabilities: [...dist],
            rounds,
        },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Polarization is like purity: a qubit biased toward zero carries less entropy. A cold bath supplies fresh low-entropy qubits. Algorithmic cooling repeatedly swaps entropy from the compute qubit into those bath qubits and throws the entropy away by resetting them, so the compute qubit ends up more polarized than the bath itself.",
        invariants: [
            "The eight populations are nonnegative and always sum to one.",
            "A reset changes only the two bath bits and preserves the compute marginal.",
            "Compression is a permutation of basis states, so it preserves the total probability.",
        ],
        correctness:
            "Reset exactly reassigns each compute marginal to the product thermal distribution of the bath bits. Compression is a bijection on the eight basis states, so it merely permutes populations; sorting them so the four largest occupy the compute-zero states makes the compute-zero mass as large as possible. Therefore the reported compute polarization is exactly the simulated marginal, and it cannot decrease across a round.",
        complexityRationale:
            "Each round touches eight populations: reset is constant work and compression sorts eight entries, so the simulation is O(rounds * 8 log 8) time and O(8) space. It simulates a fixed three-qubit system, not a general n-qubit register.",
        uses: [
            "Explaining polarization and entropy flow in NMR quantum computing",
            "Preparing a highly biased qubit from a colder reset reservoir",
            "Teaching the boundary between thermodynamically free and costly operations",
        ],
        references: [
            "Schulman, Mor, Weinstein, and Shankar, Heat Bath Algorithmic Cooling, 2005",
            "Nielsen and Chuang, Quantum Computation and Quantum Information, Chapter 11",
        ],
        workedExample:
            "Starting with compute bias 0.1 and bath bias 0.5, the bath reset makes the states 000 and 001 the most likely. Compression places those populations in the compute-zero states, raising the compute bias above 0.5 after a single round; further rounds push it closer to one.",
    },
    id: "algorithmic-cooling",
    name: "Heat-Bath Algorithmic Cooling (Exact Toy Model)",
    category: "quantum",
    complexity: { time: "O(rounds)", space: "O(1)" },
    defaultInput: { computeBias: 0.1, bathBias: 0.5, rounds: 4 },
    visualType: "array",
    run,
    pseudocode: [
        "initialize three qubits with compute and bath biases",
        "for each cooling round",
        "reset the two bath qubits to fresh thermal states",
        "sort the eight populations by decreasing probability",
        "map sorted populations onto compute-zero basis states",
        "record the new compute polarization",
        "done: report the final compute polarization",
    ],
};

export default module;
