/**
 * lattice-surgery.ts - Lattice Surgery Merge and Split of Two Surface-Code Patches
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Lattice surgery performs logical operations without moving qubits around:
 * two surface-code patches are briefly merged along a common boundary, which
 * measures a joint logical Pauli, and then split apart again. This module
 * simulates the primitive exactly on the two logical qubits: a smooth merge
 * measures the joint parity Z0 Z1, projecting the state onto one parity
 * subspace, and the split leaves two independent logical patches in that
 * post-measurement state. Repeating the merge then gives the same outcome with
 * certainty.
 *
 * This is an exact small simulation of the logical-level state change. It uses
 * two abstract logical qubits rather than physical patch lattices, assumes
 * ideal noise-free measurements, and does not build the full CNOT sequence
 * (which needs two such merges plus Pauli corrections).
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(4) to project and normalize two logical qubits
 *   Space: O(4) for the two-qubit state vector
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Four bars show the amplitudes of the two logical qubits.
 *   - Bars in the measured parity sector are yellow during the merge.
 *   - The final frame is green and reports the surviving parity sector.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface SurgeryInput {
    amplitudes?: number[];
    outcome?: number;
}

const LABELS = ["00", "01", "10", "11"];

/** Joint Z0 Z1 parity of a two-bit index (qubit 0 is the high bit). */
function parityOf(index: number): number {
    return ((index >> 1) & 1) ^ (index & 1);
}

function makeBars(state: number[], sector: number, phase: string): VisualEntity[] {
    return state.map((amplitude, index) => {
        let entityState: EntityState = "idle";
        if (phase === "projecting" && parityOf(index) === sector) entityState = "comparing";
        if (phase === "done" && Math.abs(amplitude) > 1e-12) entityState = "sorted";
        return {
            id: `bar-${index}`,
            type: "bar" as const,
            label: `${LABELS[index] ?? String(index)}: ${amplitude.toFixed(4)}`,
            value: amplitude,
            state: entityState,
            x: index,
            y: 0,
            width: 0,
            height: 0,
            metadata: { index, basis: LABELS[index] ?? String(index), parity: parityOf(index), amplitude },
        };
    });
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as SurgeryInput | null) ?? {};
    const raw = Array.isArray(task.amplitudes) && task.amplitudes.length === 4
        ? task.amplitudes.map((value) => Number(value ?? 0))
        : [Math.SQRT1_2, 0, 0, Math.SQRT1_2];
    const norm = Math.hypot(...raw) || 1;
    const start = raw.map((value) => value / norm);

    const probs = [0, 0];
    for (let i = 0; i < 4; i += 1) {
        probs[parityOf(i)] = (probs[parityOf(i)] ?? 0) + (start[i] ?? 0) ** 2;
    }
    const requested = task.outcome === 1 ? 1 : 0;
    const sector = (probs[requested] ?? 0) > 1e-12 ? requested : 1 - requested;
    const sectorProb = probs[sector] ?? 0;
    const scale = sectorProb > 1e-12 ? 1 / Math.sqrt(sectorProb) : 0;
    const projected = start.map((value, index) => (parityOf(index) === sector ? value * scale : 0));
    const projectedNorm = Math.sqrt(projected.reduce((sum, value) => sum + value * value, 0));
    const repeatProbability = projected.reduce((sum, value, index) => (
        parityOf(index) === sector ? sum + value * value : sum
    ), 0);

    const metaBase = {
        parityProbabilities: [...probs],
        outcome: sector,
        outcomeProbability: sectorProb,
        projectedNorm,
        repeatProbability,
    };

    yield {
        stepNumber: 0,
        entities: makeBars(start, sector, "idle"),
        edges: [],
        description: "Preparing two logical patches in a two-qubit state before the smooth merge.",
        codeLineNumber: 0,
        layout: "array",
        meta: { ...metaBase, state: [...start] },
    };

    yield {
        stepNumber: 1,
        entities: makeBars(start, sector, "projecting"),
        edges: [],
        description: "A smooth merge joins the rough boundaries, so the joint operator Z0 Z1 becomes measurable.",
        codeLineNumber: 1,
        layout: "array",
        meta: { ...metaBase, state: [...start] },
    };

    yield {
        stepNumber: 2,
        entities: makeBars(start, sector, "projecting"),
        edges: [],
        description: `The merge outcome is parity ${sector}, occurring with probability ${sectorProb.toFixed(4)}.`,
        codeLineNumber: 2,
        layout: "array",
        meta: { ...metaBase, state: [...start] },
    };

    yield {
        stepNumber: 3,
        entities: makeBars(projected, sector, "projecting"),
        edges: [],
        description: "Projection keeps only the measured parity sector and renormalizes the surviving amplitudes.",
        codeLineNumber: 3,
        layout: "array",
        meta: { ...metaBase, state: [...projected] },
    };

    yield {
        stepNumber: 4,
        entities: makeBars(projected, sector, "done"),
        edges: [],
        description: `Splitting the merged patch restores two logical patches, and a repeat merge returns parity ${sector} with probability ${repeatProbability.toFixed(4)}.`,
        codeLineNumber: 4,
        layout: "array",
        meta: { ...metaBase, state: [...projected], done: true },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Instead of shuttling qubits, grow one patch into another along a shared edge and measure what happens. That single joint measurement tells you the parity of the two logical qubits. Once you record it, you cut the patch back apart and the two logical qubits remain, now correlated by the measurement you just made.",
        invariants: [
            "The joint parity Z0 Z1 splits the four basis states into two sectors of size two.",
            "The outcome probability of a sector is the sum of squared amplitudes in that sector.",
            "Projection followed by normalization leaves a state supported only on the measured sector.",
        ],
        correctness:
            "Z0 Z1 is Hermitian with eigenvalues plus and minus one, so its projectors are P_p = (I + p Z0 Z1)/2. Applying P_p to the state keeps exactly the amplitudes whose basis index has parity p, and dividing by the square root of the outcome probability restores unit norm. A projective measurement is idempotent, so measuring the same observable again yields the same outcome with probability one, which the simulation confirms.",
        complexityRationale:
            "The logical state has four amplitudes, so projection, normalization, and probability accounting each use a constant number of operations. A physical patch with distance d would use O(d squared) data qubits per logical qubit.",
        uses: [
            "Executing logical gates on surface-code quantum computers",
            "Measuring multi-qubit Pauli operators without transversal gates",
            "Reducing the qubit overhead of fault-tolerant circuits",
        ],
        references: [
            "Litinski, A Game of Surface Codes: Large-Scale Quantum Computing with Lattice Surgery, 2019",
            "Fowler et al., Surface Codes: Towards Practical Large-Scale Quantum Computation, 2012",
        ],
        workedExample:
            "For the state (|00> + |11>)/square root of two, both basis states have parity zero, so the merge returns zero with probability one. The projected state is unchanged and a second merge again returns zero, demonstrating idempotence.",
    },
    id: "lattice-surgery",
    name: "Lattice Surgery Merge and Split",
    category: "quantum",
    complexity: { time: "O(4)", space: "O(4)" },
    defaultInput: { amplitudes: [0.5, 0.5, 0.5, 0.5], outcome: 0 },
    visualType: "array",
    run,
    pseudocode: [
        "normalize the two-logical-qubit state vector",
        "partition basis states by joint Z0 Z1 parity",
        "compute the probability of each parity sector",
        "measure the joint parity by merging the patches",
        "project onto the observed sector and renormalize",
        "split the patch and record the logical state",
        "done: verify the repeat measurement is deterministic",
    ],
};

export default module;
