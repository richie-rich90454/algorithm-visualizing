/**
 * differential-phase-shift-qkd.ts - Differential Phase Shift QKD (Toy Model)
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * In differential phase shift quantum key distribution, Alice sends a train of
 * coherent pulses and encodes each key bit in the phase difference between two
 * neighboring pulses. Bob feeds consecutive pulses into an unbalanced
 * interferometer; the port that fires reveals the phase difference and hence
 * the bit, with no basis reconciliation step.
 *
 * This is an exact small teaching model. Detection probabilities are the ideal
 * single-photon interference values, the phase is either zero or pi, and a
 * seeded generator supplies the shot outcomes and an optional bit-flip noise
 * rate. There is no channel loss, dark count, or afterpulsing model, and no
 * privacy amplification or error correction.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(r) for r adjacent pulse pairs
 *   Space: O(r) for the sifted results
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - A grid row per pulse pair shows phase difference and detection port.
 *   - The final frame reports the raw key and the quantum bit error rate.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface DpsInput {
    bits?: number[];
    seed?: number;
    noise?: number;
}

/** Deterministic linear-congruential generator in [0, 1). */
function makeRandom(seed: number): () => number {
    let state = seed >>> 0;
    return () => {
        state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
        return state / 4294967296;
    };
}

/** Grid cells for one row of the round table. */
function makeRows(rows: number[][]): VisualEntity[] {
    const entities: VisualEntity[] = [];
    for (let i = 0; i < rows.length; i += 1) {
        for (let j = 0; j < 4; j += 1) {
            const value = rows[i]![j]!;
            entities.push({
                id: `cell-${i}-${j}`,
                type: "cell",
                label: String(value),
                value,
                state: (j === 3 && value === 1 ? "error" : j === 3 ? "sorted" : "idle") as EntityState,
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

/** The DPS-QKD generator. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as DpsInput | null) ?? {};
    const source = Array.isArray(task.bits) && task.bits.length >= 2
        ? task.bits.slice(0, 16).map((bit) => (bit ? 1 : 0))
        : [0, 1, 1, 0, 1, 0, 0, 1];
    const seed = Number.isFinite(task.seed) ? Math.floor(task.seed as number) : 7;
    const noise = Math.max(0, Math.min(1, Number.isFinite(task.noise) ? Number(task.noise) : 0));
    const random = makeRandom(seed);

    const phaseDiffs: number[] = [];
    const portProbs: number[] = [];
    const bobBits: number[] = [];
    const flips: number[] = [];
    let matches = 0;

    const rows: number[][] = [];
    for (let i = 1; i < source.length; i += 1) {
        const bit = source[i]!;
        const diff = bit ? Math.PI : 0;
        const prob = (1 + Math.cos(diff)) / 2;
        const received = random() < prob ? 0 : 1;
        const flipped = random() < noise ? 1 : 0;
        const bobBit = received ^ flipped;
        phaseDiffs.push(diff);
        portProbs.push(prob);
        bobBits.push(bobBit);
        flips.push(flipped);
        if (bobBit === bit) matches += 1;
        rows.push([i, bit, prob, bobBit]);
    }
    const rounds = phaseDiffs.length;
    const qber = rounds === 0 ? 0 : (rounds - matches) / rounds;

    const metaBase = {
        rounds,
        aliceBits: [...source.slice(1)],
        phaseDiffs,
        portProbs,
        bobBits,
        flips,
        matches,
        qber,
        seed,
        noise,
    };

    let step = 0;
    yield {
        stepNumber: step,
        entities: makeRows(rows.map((row) => [row[0]!, row[1]!, 0, 0])),
        edges: [],
        description: `Alice prepared ${source.length} pulses; each adjacent phase difference carries one key bit.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: { ...metaBase, phase: "prepare" },
    };
    step += 1;

    yield {
        stepNumber: step,
        entities: makeRows(rows.map((row) => [row[0]!, row[1]!, row[2]!, 0])),
        edges: [],
        description: `A phase difference of zero favors port zero; a difference of pi favors port one.`,
        codeLineNumber: 1,
        layout: "grid",
        meta: { ...metaBase, phase: "interfere" },
    };
    step += 1;

    const highlighted = rows.map((row, i) => [row[0]!, row[1]!, row[2]!, bobBits[i]!]);
    yield {
        stepNumber: step,
        entities: makeRows(highlighted),
        edges: [],
        description: `Bob's interferometer reported ${rounds} detection ports with an error rate of ${(qber * 100).toFixed(1)} percent.`,
        codeLineNumber: 2,
        layout: "grid",
        meta: { ...metaBase, phase: "detect" },
    };
    step += 1;

    yield {
        stepNumber: step,
        entities: makeRows(highlighted),
        edges: [],
        description: `Raw key ready: ${matches} of ${rounds} bits agree; no sifting is needed in DPS-QKD.`,
        codeLineNumber: 3,
        layout: "grid",
        meta: { ...metaBase, phase: "done", rawKey: [...bobBits] },
    };
}

/** The differential phase shift QKD module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "Instead of choosing a basis for every photon, Alice hides each bit in the change of phase from one pulse to the next. Bob delays one pulse and interferes it with its neighbor, so the bright output port directly tells him whether the phase changed. Because the information lives in differences, a global phase drift on the whole train cancels out.",
        invariants: [
            "Each key bit is the phase difference between two consecutive pulses, either zero or pi.",
            "For a difference of zero the ideal interference probability of port zero is one; for pi it is zero.",
            "The quantum bit error rate is the fraction of detected bits that differ from Alice's bits.",
        ],
        correctness:
            "For two equal-amplitude optical paths the probability of the constructive port is (1 plus the cosine of the phase difference) over two. A phase difference of zero gives probability one at port zero and a difference of pi gives probability zero, so an ideal single-photon detection reads the bit exactly. With the seeded noise model a bit is flipped only when the drawn random value falls below the noise rate, making the observed error rate converge to that rate over many rounds.",
        complexityRationale:
            "There is one detection decision per adjacent pulse pair, so the simulation is O(r) time and stores O(r) phase values and results. The idealized port probability is a single cosine evaluation per round.",
        uses: [
            "Fiber-based quantum key distribution without basis sifting",
            "High-rate coherent-state communication experiments",
            "A teaching contrast with prepare-and-measure protocols such as BB84",
        ],
        references: [
            "Inoue, Waks, and Yamamoto, Differential Phase Shift Quantum Key Distribution, 2002",
            "Gisin et al., Quantum Cryptography, 2002",
        ],
        workedExample:
            "For pulse phases encoding the bit sequence 0, 1, 1, the phase differences are zero then pi. The first pair fires port zero and the second fires port one, so Bob reads the bits 0 and 1. With zero noise every bit matches and the error rate is zero.",
    },
    id: "differential-phase-shift-qkd",
    name: "Differential Phase Shift QKD",
    category: "quantum",
    complexity: { time: "O(r)", space: "O(r)" },
    defaultInput: { bits: [0, 1, 1, 0, 1, 0, 0, 1], seed: 7, noise: 0 },
    visualType: "grid",
    run,
    pseudocode: [
        "Alice chooses a phase for every pulse in the train",
        "for each adjacent pair compute the phase difference",
        "map the difference to a key bit of zero or one",
        "Bob interferes the pair in an unbalanced interferometer",
        "read the bit from the port that detects a photon",
        "compare a sample to estimate the error rate",
        "done: report the raw key and quantum bit error rate",
    ],
};

export default module;
