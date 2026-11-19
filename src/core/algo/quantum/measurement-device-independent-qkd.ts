/**
 * measurement-device-independent-qkd.ts - Measurement-Device-Independent QKD
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * In measurement-device-independent QKD, Alice and Bob never measure their own
 * qubits. They each send a single photon to an untrusted relay, Charlie, who
 * performs a Bell-state measurement and announces which Bell state he saw.
 * Because the measurement result only reveals the parity of the two bits, the
 * relay learns no key, and detector side channels are irrelevant.
 *
 * This is an exact small simulation. It prepares real-amplitude single-qubit
 * states, computes the amplitudes of the two Bell outcomes that a linear
 * Bell-state analyzer can distinguish, and samples outcomes from a seeded
 * generator. The model assumes ideal single-photon sources, lossless channels,
 * and perfect detectors; it has no dark counts, multiphoton pulses, or finite
 * key analysis, and the round count is capped at 16.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(r) for r rounds
 *   Space: O(r) for the announced and sifted results
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - A grid row per round records both bases, bits, Bell outcome, and key bit.
 *   - Charlie's success probability is announced in the metadata.
 *   - The final frame reports the sifted key and its error rate.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface MdiInput {
    rounds?: number;
    seed?: number;
    noise?: number;
}

const INV_SQRT2 = Math.SQRT1_2;

/** Deterministic linear-congruential generator in [0, 1). */
function makeRandom(seed: number): () => number {
    let state = seed >>> 0;
    return () => {
        state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
        return state / 4294967296;
    };
}

/** State vector of a single qubit in the Z basis. */
function qubit(basis: number, bit: number): [number, number] {
    if (basis === 0) return bit === 0 ? [1, 0] : [0, 1];
    return bit === 0 ? [INV_SQRT2, INV_SQRT2] : [INV_SQRT2, -INV_SQRT2];
}

/** Grid cells for the round table. */
function makeRows(rows: number[][]): VisualEntity[] {
    const entities: VisualEntity[] = [];
    for (let i = 0; i < rows.length; i += 1) {
        for (let j = 0; j < rows[i]!.length; j += 1) {
            const value = rows[i]![j]!;
            entities.push({
                id: `cell-${i}-${j}`,
                type: "cell",
                label: String(value),
                value,
                state: (j === 5 && value === 1 ? "error" : j === 5 ? "sorted" : "idle") as EntityState,
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

/** The MDI-QKD generator. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as MdiInput | null) ?? {};
    const rounds = Math.max(2, Math.min(16, Math.floor(Number(task.rounds) || 8)));
    const seed = Number.isFinite(task.seed) ? Math.floor(task.seed as number) : 5;
    const noise = Math.max(0, Math.min(1, Number.isFinite(task.noise) ? Number(task.noise) : 0));
    const random = makeRandom(seed);

    const aliceBases: number[] = [];
    const aliceBits: number[] = [];
    const bobBases: number[] = [];
    const bobBits: number[] = [];
    const bellOutcomes: number[] = [];
    const parities: number[] = [];
    const siftedAlice: number[] = [];
    const siftedBob: number[] = [];
    const flips: number[] = [];
    const seenPhi: number[] = [];
    const seenPsi: number[] = [];
    const keyAtRound = new Array<number>(rounds).fill(-1);

    for (let i = 0; i < rounds; i += 1) {
        const ab = random() < 0.5 ? 0 : 1;
        const bb = random() < 0.5 ? 0 : 1;
        const abit = random() < 0.5 ? 0 : 1;
        const bbit = random() < 0.5 ? 0 : 1;
        const sa = qubit(ab, abit);
        const sb = qubit(bb, bbit);
        const ampPhi = (sa[0] * sb[0] + sa[1] * sb[1]) * INV_SQRT2;
        const ampPsi = (sa[0] * sb[1] - sa[1] * sb[0]) * INV_SQRT2;
        const pPhi = ampPhi * ampPhi;
        const pPsi = ampPsi * ampPsi;
        seenPhi.push(pPhi);
        seenPsi.push(pPsi);
        const outcome = pPhi / (pPhi + pPsi) > random() ? 0 : 1;
        const parity = outcome;
        bellOutcomes.push(outcome);
        parities.push(parity);
        if (ab === bb) {
            let bKey = bbit ^ parity;
            const flip = random() < noise ? 1 : 0;
            bKey ^= flip;
            flips.push(flip);
            keyAtRound[i] = bKey;
            siftedAlice.push(abit);
            siftedBob.push(bKey);
        }
        aliceBases.push(ab);
        aliceBits.push(abit);
        bobBases.push(bb);
        bobBits.push(bbit);
    }

    const sifted = siftedAlice.length;
    let matches = 0;
    for (let i = 0; i < sifted; i += 1) if (siftedAlice[i] === siftedBob[i]) matches += 1;
    const qber = sifted === 0 ? 0 : (sifted - matches) / sifted;

    const table: number[][] = aliceBases.map((ab, i) => [
        i,
        ab,
        aliceBits[i]!,
        bobBases[i]!,
        bobBits[i]!,
        bellOutcomes[i]!,
        keyAtRound[i]!,
    ]);

    const metaBase = {
        rounds,
        aliceBases,
        aliceBits,
        bobBases,
        bobBits,
        bellOutcomes,
        parities,
        seenPhi,
        seenPsi,
        sifted,
        siftedAlice,
        siftedBob,
        qber,
        seed,
        noise,
    };

    let step = 0;
    yield {
        stepNumber: step,
        entities: makeRows(table.map((row) => [...row.slice(0, 5), -1])),
        edges: [],
        description: `Alice and Bob each prepared ${rounds} single-photon qubits in randomly chosen bases.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: { ...metaBase, phase: "prepare" },
    };
    step += 1;

    yield {
        stepNumber: step,
        entities: makeRows(table.map((row) => [...row.slice(0, 5), row[5]!])),
        edges: [],
        description: `Charlie announced a Bell-state result; only the parity of the two bits is public.`,
        codeLineNumber: 1,
        layout: "grid",
        meta: { ...metaBase, phase: "bell" },
    };
    step += 1;

    yield {
        stepNumber: step,
        entities: makeRows(table),
        edges: [],
        description: `${sifted} of ${rounds} rounds had matching bases and entered the sifted key.`,
        codeLineNumber: 2,
        layout: "grid",
        meta: { ...metaBase, phase: "sift" },
    };
    step += 1;

    yield {
        stepNumber: step,
        entities: makeRows(table),
        edges: [],
        description: `Sifted key ready: ${matches} of ${sifted} bits agree, giving an error rate of ${(qber * 100).toFixed(1)} percent.`,
        codeLineNumber: 3,
        layout: "grid",
        meta: { ...metaBase, phase: "done", matches },
    };
}

/** The measurement-device-independent QKD module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "Alice and Bob send photons to an untrusted middle station instead of measuring them themselves. The station can only announce which Bell state it saw, and that announcement reveals whether the two bits were equal or different, never their actual values. Bob flips his bit when the announced state has odd parity, and the relay learns nothing useful even if its detectors are faulty.",
        invariants: [
            "Each prepared qubit is a valid normalized single-qubit state.",
            "A distinguishable Bell outcome reveals only the parity of the two encoded bits.",
            "After a matching-basis round, Bob's corrected bit equals Alice's bit in the noiseless model.",
        ],
        correctness:
            "For two single-qubit states the amplitudes of the two Bell outcomes are (psi_A0 psi_B0 plus psi_A1 psi_B1) over the square root of two and (psi_A0 psi_B1 minus psi_A1 psi_B0) over the square root of two. In a common basis these reduce to the even and odd parity cases, so outcome zero means the bits agree and outcome one means they differ. Bob corrects by XORing the announced parity with his bit, which reconstructs Alice's bit exactly. The relay sees only a parity that is uniformly random when the bits are random, so it gains no key information.",
        complexityRationale:
            "Each round prepares two qubits, evaluates two Bell amplitudes, and performs a sifting test, all constant work, so the simulation runs in O(r) time and stores O(r) announced results. The amplitude formulas use only real arithmetic for the chosen bases.",
        uses: [
            "Quantum key distribution with untrusted detectors",
            "Quantum repeater and network architectures",
            "A teaching contrast with device-dependent BB84 and entanglement-based E91",
        ],
        references: [
            "Lo, Curty, and Qi, Measurement-Device-Independent Quantum Key Distribution, 2012",
            "Gisin et al., Quantum Cryptography, 2002",
        ],
        workedExample:
            "If Alice and Bob both use the Z basis and Alice sends zero while Bob sends one, the two-photon state has odd parity, so Charlie announces the antisymmetric Bell outcome. Bob flips his one to zero, matching Alice. If their bases differ, the round is discarded during sifting.",
    },
    id: "measurement-device-independent-qkd",
    name: "Measurement-Device-Independent QKD",
    category: "quantum",
    complexity: { time: "O(r)", space: "O(r)" },
    defaultInput: { rounds: 8, seed: 5, noise: 0 },
    visualType: "grid",
    run,
    pseudocode: [
        "Alice and Bob each pick a random basis and bit",
        "prepare a single-photon qubit in that state",
        "send both qubits to the untrusted relay",
        "perform a Bell-state measurement at the relay",
        "announce the parity of the successful outcome",
        "keep rounds where the bases matched",
        "Bob flips his bit for an odd-parity outcome",
        "done: report the sifted key and error rate",
    ],
};

export default module;
