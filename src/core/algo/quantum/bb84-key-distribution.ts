/**
 * bb84-key-distribution.ts - BB84 Quantum Key Distribution (Small Toy Model)
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * In BB84, Alice sends random bits encoded in randomly chosen bases, and Bob
 * measures each qubit in a randomly chosen basis. They publicly compare only
 * the bases, discard rounds where the bases differ, and keep the matching
 * bits as a shared key. A sample of the kept bits is revealed to estimate the
 * error rate; an intercept-and-resend eavesdropper introduces errors because
 * it guesses the wrong basis half the time.
 *
 * This teaching model simulates the exact sifting and error-estimation steps
 * with a deterministic pseudo-random number generator. It is NOT a real QKD
 * implementation: there is no quantum channel, no authentication, no privacy
 * amplification, and no full security proof. Only the sampling statistics are
 * faithful.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(r) for r transmitted rounds
 *   Space: O(r) for the per-round basis and bit records
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - One grid row of cells shows each round's bases, bits, and sifting result.
 *   - Kept key cells are green, sampled cells yellow, discarded cells gray.
 *   - meta carries the raw arrays, sifted indices, error rate, and final key.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

/** Deterministic pseudo-random generator (mulberry32). */
function rng(seed: number): () => number {
    let s = seed >>> 0;
    return () => {
        s = (s + 0x6d2b79f5) >>> 0;
        let t = s;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

type RoundPhase = "before" | "revealed" | "kept" | "sampled" | "discarded" | "mismatch";

/** Build the per-round cells. */
function makeCells(
    aliceBits: number[],
    aliceBases: number[],
    bobBases: number[],
    bobBits: number[],
    phases: RoundPhase[],
    visible: number,
): VisualEntity[] {
    return aliceBits.map((_, index) => {
        const phase = phases[index] ?? "before";
        const shown = index <= visible;
        let state: EntityState = "unvisited";
        if (shown) {
            if (phase === "kept") {
                state = "sorted";
            } else if (phase === "sampled") {
                state = "comparing";
            } else if (phase === "mismatch") {
                state = "error";
            }
        }
        const baseName = (b: number) => (b === 0 ? "+" : "x");
        const label = shown
            ? `r${index}: A ${aliceBits[index]}/${baseName(aliceBases[index] ?? 0)} B ${bobBits[index]}/${baseName(bobBases[index] ?? 0)}${phase === "kept" ? " keep" : phase === "sampled" ? " sample" : phase === "mismatch" ? " err" : " drop"}`
            : `r${index}: ?`;
        return {
            id: `round-${index}`,
            type: "cell" as const,
            label,
            value: label,
            state,
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: {
                row: 0,
                col: index,
                phase,
                aliceBit: aliceBits[index] ?? 0,
                aliceBase: aliceBases[index] ?? 0,
                bobBase: bobBases[index] ?? 0,
                bobBit: bobBits[index] ?? 0,
            },
        };
    });
}

/** The BB84 generator. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (
        input as { rounds?: number; seed?: number; eavesdropper?: boolean; sampleFraction?: number } | null
    ) ?? {};
    const rounds = Math.min(64, Math.max(1, Math.floor(Number(task.rounds ?? 12)) || 12));
    const seed = Math.floor(Number(task.seed ?? 7)) || 7;
    const eavesdropper = task.eavesdropper === true;
    const sampleFraction = Math.min(0.5, Math.max(0, Number(task.sampleFraction ?? 0.25)));
    const random = rng(seed);
    const bit = () => (random() < 0.5 ? 0 : 1);

    const aliceBits: number[] = [];
    const aliceBases: number[] = [];
    const bobBases: number[] = [];
    const bobBits: number[] = [];

    for (let i = 0; i < rounds; i += 1) {
        const ab = bit();
        const ba = bit();
        const bb = bit();
        aliceBits.push(ab);
        aliceBases.push(ba);
        bobBases.push(bb);
        if (eavesdropper) {
            const be = bit();
            const eveBit = be === ba ? ab : bit();
            bobBits.push(be === bb ? eveBit : bit());
        } else {
            bobBits.push(bb === ba ? ab : bit());
        }
    }

    const kept: number[] = [];
    for (let i = 0; i < rounds; i += 1) {
        if (aliceBases[i] === bobBases[i]) {
            kept.push(i);
        }
    }
    const sampleCount = kept.length > 0
        ? Math.min(kept.length, Math.max(1, Math.floor(kept.length * sampleFraction)))
        : 0;
    const sampleIndices = kept.slice(0, sampleCount);
    const keyIndices = kept.slice(sampleCount);

    let mismatches = 0;
    for (const index of sampleIndices) {
        if (aliceBits[index] !== bobBits[index]) {
            mismatches += 1;
        }
    }
    const errorRate = sampleCount > 0 ? mismatches / sampleCount : 0;
    const key = keyIndices.map((index) => aliceBits[index]).join("");
    const bobKey = keyIndices.map((index) => bobBits[index]).join("");
    const keysMatch = key === bobKey;

    let step = 0;
    yield {
        stepNumber: step,
        entities: makeCells(aliceBits, aliceBases, bobBases, bobBits, [], -1),
        edges: [],
        description: `BB84 with ${rounds} rounds, seed ${seed}, eavesdropper ${eavesdropper ? "present" : "absent"}. Alice chooses random bits and bases.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: { rows: 1, cols: rounds, rounds, seed, eavesdropper, aliceBits, aliceBases, bobBases, bobBits, key: "", keyLength: 0, errorRate: 0, keysMatch: true },
    };
    step += 1;

    const phases: RoundPhase[] = Array.from({ length: rounds }, () => "before");
    for (let i = 0; i < rounds; i += 1) {
        const keptRound = aliceBases[i] === bobBases[i];
        if (!keptRound) {
            phases[i] = "discarded";
        } else if (sampleIndices.includes(i)) {
            phases[i] = aliceBits[i] === bobBits[i] ? "sampled" : "mismatch";
        } else {
            phases[i] = aliceBits[i] === bobBits[i] ? "kept" : "mismatch";
        }
        yield {
            stepNumber: step,
            entities: makeCells(aliceBits, aliceBases, bobBases, bobBits, phases, i),
            edges: [],
            description: `Round ${i}: bases ${aliceBases[i] === 0 ? "rectilinear" : "diagonal"} at Alice and ${bobBases[i] === 0 ? "rectilinear" : "diagonal"} at Bob ${keptRound ? "match, bit kept" : "differ, bit discarded"}.`,
            codeLineNumber: keptRound ? 3 : 2,
            layout: "grid",
            meta: { rows: 1, cols: rounds, rounds, seed, eavesdropper, aliceBits, aliceBases, bobBases, bobBits, key: "", keyLength: 0, errorRate: 0, keysMatch: true },
        };
        step += 1;
    }

    yield {
        stepNumber: step,
        entities: makeCells(aliceBits, aliceBases, bobBases, bobBits, phases, rounds - 1),
        edges: [],
        description: `Sifted ${kept.length} of ${rounds} rounds. Revealed ${sampleCount} sample bit(s) with error rate ${(errorRate * 100).toFixed(1)} percent. Final key has ${key.length} bit(s).`,
        codeLineNumber: 6,
        layout: "grid",
        meta: {
            rows: 1,
            cols: rounds,
            rounds,
            seed,
            eavesdropper,
            aliceBits,
            aliceBases,
            bobBases,
            bobBits,
            keptIndices: kept,
            sampleIndices,
            keyIndices,
            key,
            bobKey,
            keyLength: key.length,
            sampleCount,
            mismatches,
            errorRate,
            keysMatch,
            note: "toy model: no authentication or privacy amplification, not a security proof",
        },
    };
}

/** The BB84 teaching module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "Alice sends each bit in one of two randomly chosen bases. Bob does not know the basis, so he guesses; when his guess matches Alice's, their bits agree, and when it does not, they throw the round away. By comparing only the bases publicly, they turn a noisy quantum channel into a shared secret string. A sample of that string reveals whether someone was listening.",
        invariants: [
            "A round is kept exactly when Alice and Bob chose the same basis.",
            "Without an eavesdropper, every kept bit is identical for Alice and Bob.",
            "The revealed sample is removed from the final key.",
        ],
        correctness:
            "A qubit prepared in a basis and measured in the same basis returns the prepared bit with certainty, so matching-basis rounds agree. Measuring in the wrong basis yields a random bit, which is why mismatched rounds are discarded. An intercept-and-resend attacker must guess the basis; when it guesses wrong, which happens half the time, it resends in the wrong basis and Bob's later matching-basis measurement disagrees with Alice about a quarter of the time. Observing that elevated sample error flags the intrusion; the final key is the unrevealed kept bits, identical on both sides in the absence of errors.",
        complexityRationale:
            "Each of the r rounds generates a few random bits and one comparison, so the work is O(r). Storing the four per-round arrays and the sifted indices uses O(r) space.",
        uses: [
            "A teaching model for quantum key distribution",
            "Explaining basis sifting and error-rate estimation",
            "Understanding why intercept-and-resend eavesdropping is detectable",
        ],
        references: [
            "Bennett and Brassard, Quantum Cryptography: Public Key Distribution and Coin Tossing, 1984",
            "Nielsen and Chuang, Quantum Computation and Quantum Information, Chapter 12",
        ],
        workedExample:
            "With twelve rounds and no eavesdropper, about six bases match and become the sifted key. Revealing three of them shows zero errors, so the remaining three bits form a shared secret. With an intercept-and-resend attacker, roughly one of the three sampled bits disagrees, signaling that the key should be discarded.",
    },
    id: "bb84-key-distribution",
    name: "BB84 Key Distribution (Small Toy Model)",
    category: "quantum",
    complexity: { time: "O(r)", space: "O(r)" },
    defaultInput: { rounds: 12, seed: 7, eavesdropper: false, sampleFraction: 0.25 },
    visualType: "grid",
    run,
    pseudocode: [
        "for each round Alice picks a random bit and a random basis",
        "Alice encodes the bit and sends it to Bob",
        "Bob picks a random basis and measures the qubit",
        "publicly compare bases and keep only matching rounds",
        "reveal a sample of kept bits to estimate the error rate",
        "remove the revealed bits from the key",
        "discard the key if the error rate is too high",
        "done: report the shared sifted key and error rate",
    ],
};

export default module;
