/**
 * six-state-protocol.ts - Six-State Quantum Key Distribution Protocol
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * The six-state protocol extends BB84 by using three mutually unbiased bases,
 * giving six possible signal states instead of four. Alice sends a state chosen
 * uniformly from those six, Bob measures in a randomly chosen basis, and they
 * keep only rounds where the bases match. An intercept-resend eavesdropper must
 * guess among three bases, so she introduces a quantum bit error rate of one
 * third on the sifted key, higher than the one quarter of BB84.
 *
 * This is an exact small simulation of sifting and error estimation. It
 * enumerates the basis logic for the error rate and shows a fixed deterministic
 * sample of rounds for illustration. It assumes ideal devices, no detector
 * loss, and a simple intercept-resend attack rather than general coherent
 * attacks or finite-key statistical effects.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(r + 27) for r sample rounds and 27 basis-attack combinations
 *   Space: O(r) for the sample rounds
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - One bar per sample round shows its sifted bit or an error marker.
 *   - Correct sifted rounds are green, errors are red, discarded rounds idle.
 *   - The final frame reports the exact sifting and error probabilities.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface ProtocolInput {
    rounds?: number;
}

const BASES = ["X", "Y", "Z"];
const ROUNDS = 12;

interface Round {
    aliceBasis: number;
    aliceBit: number;
    bobBasis: number;
    evesBasis: number;
    sifted: boolean;
    error: boolean;
}

function nextRandom(state: number): [number, number] {
    const value = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return [value % 3, value];
}

function makeRounds(count: number): Round[] {
    let seed = 987654321;
    const result: Round[] = [];
    for (let i = 0; i < count; i += 1) {
        const [aliceBasis, s1] = nextRandom(seed);
        seed = s1;
        const [bobBasis, s2] = nextRandom(seed);
        seed = s2;
        const [evesBasis, s3] = nextRandom(seed);
        seed = s3;
        const [rawBit, s4] = nextRandom(seed);
        seed = s4;
        const aliceBit = rawBit % 2;
        const sifted = aliceBasis === bobBasis;
        const evesCorrectBasis = evesBasis === aliceBasis;
        const bobBit = evesCorrectBasis ? aliceBit : (aliceBit + (seed % 2)) % 2;
        result.push({ aliceBasis, aliceBit, bobBasis, evesBasis, sifted, error: sifted && bobBit !== aliceBit });
    }
    return result;
}

/** Exact sifting and intercept-resend error probabilities by enumeration. */
function exactRates(): { sift: number; error: number } {
    let matching = 0;
    let total = 0;
    let errors = 0;
    for (let alice = 0; alice < 3; alice += 1) {
        for (let bob = 0; bob < 3; bob += 1) {
            for (let eve = 0; eve < 3; eve += 1) {
                for (let bit = 0; bit < 2; bit += 1) {
                    total += 1;
                    if (alice !== bob) continue;
                    matching += 1;
                    if (eve !== alice) errors += 0.5;
                }
            }
        }
    }
    return { sift: matching / total, error: errors / matching };
}

function makeBars(rounds: Round[], shown: number): VisualEntity[] {
    return rounds.map((round, index) => {
        const visible = index < shown;
        const state: EntityState = !visible ? "idle" : round.error ? "error" : round.sifted ? "sorted" : "comparing";
        return {
            id: `bar-${index}`,
            type: "bar" as const,
            label: visible
                ? `${index + 1}: ${BASES[round.aliceBasis]}-${BASES[round.bobBasis]}${round.sifted ? (round.error ? " ERR" : " OK") : " drop"}`
                : `${index + 1}: pending`,
            value: visible && round.sifted ? (round.error ? 1 : 0.5) : 0,
            state,
            x: index,
            y: 0,
            width: 0,
            height: 0,
            metadata: { index, aliceBasis: BASES[round.aliceBasis] ?? "", bobBasis: BASES[round.bobBasis] ?? "", sifted: round.sifted, error: round.error },
        };
    });
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as ProtocolInput | null) ?? {};
    const count = Math.min(24, Math.max(4, Math.floor(Number(task.rounds ?? ROUNDS)) || ROUNDS));
    const rounds = makeRounds(count);
    const rates = exactRates();

    const metaOf = (shown: number) => {
        const kept = rounds.slice(0, shown).filter((round) => round.sifted);
        const errors = kept.filter((round) => round.error).length;
        return {
            siftProbability: rates.sift,
            errorProbability: rates.error,
            roundsShown: shown,
            siftedCount: kept.length,
            errorCount: errors,
        };
    };

    yield {
        stepNumber: 0,
        entities: makeBars(rounds, 0),
        edges: [],
        description: `Running ${count} rounds of the six-state protocol with bases X, Y, and Z.`,
        codeLineNumber: 0,
        layout: "array",
        meta: metaOf(0),
    };

    for (let i = 0; i < count; i += 1) {
        yield {
            stepNumber: i + 1,
            entities: makeBars(rounds, i + 1),
            edges: [],
            description: `Round ${i + 1}: Alice used ${BASES[rounds[i]?.aliceBasis ?? 0]}, Bob used ${BASES[rounds[i]?.bobBasis ?? 0]}; ${rounds[i]?.sifted ? (rounds[i]?.error ? "an error was introduced" : "the round is kept") : "the round is discarded"}.`,
            codeLineNumber: 1,
            layout: "array",
            meta: metaOf(i + 1),
        };
    }

    yield {
        stepNumber: count + 1,
        entities: makeBars(rounds, count),
        edges: [],
        description: `Exact rates: bases match with probability ${rates.sift.toFixed(4)} and an intercept-resend attack errors ${(rates.error * 100).toFixed(2)} percent of sifted bits.`,
        codeLineNumber: 2,
        layout: "array",
        meta: { ...metaOf(count), done: true },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "BB84 hides a key in two bases. Adding a third basis means an eavesdropper who guesses a basis has only a one in three chance of guessing right, and a wrong guess perturbs the state. Comparing a sample of the sifted key then exposes her with a higher error rate than BB84 would show.",
        invariants: [
            "Alice and Bob keep a round only when their bases match.",
            "Matching bases occur with probability one third for uniformly random choices.",
            "An intercept-resend attack errors a sifted bit exactly when the eavesdropper chose a different basis.",
        ],
        correctness:
            "There are nine equally likely ordered basis pairs for Alice and Bob, of which three match, so the sifting probability is one third. For each retained round the eavesdropper picks one of three bases; with probability two thirds she picks wrongly and prepares a state in a different basis, so Bob's measurement in Alice's basis is uniform and disagrees with Alice's bit half the time. The error rate is therefore two thirds times one half, namely one third. The module enumerates all twenty-seven basis-attack combinations to obtain the same numbers.",
        complexityRationale:
            "The exact rates come from enumerating three bases for each party and two bit values, a constant twenty-seven cases. The displayed sample uses r deterministic rounds, so time and space are O(r).",
        uses: [
            "Quantum key distribution with a higher eavesdropping detection rate",
            "Comparing basis choices against BB84 in a security course",
            "A teaching model of sifting and quantum bit error estimation",
        ],
        references: [
            "Bruss, Optimal Eavesdropping in Quantum Cryptography with Six States, 1998",
            "Bennett and Brassard, Quantum Cryptography: Public Key Distribution and Coin Tossing, 1984",
        ],
        workedExample:
            "If Alice sends in the Z basis and Bob measures in Z, the round is kept. If Eve measured in X instead, her prepared state gives Bob a random Z result, so half of such rounds disagree with Alice. Averaging over the two wrong bases gives a one third error rate.",
    },
    id: "six-state-protocol",
    name: "Six-State Quantum Key Distribution",
    category: "quantum",
    complexity: { time: "O(r + 27)", space: "O(r)" },
    defaultInput: { rounds: 12 },
    visualType: "array",
    run,
    pseudocode: [
        "choose the three signal bases X, Y, and Z",
        "for each round pick a random signal and basis",
        "let Bob measure in a random basis",
        "keep only rounds with matching bases",
        "model an intercept-resend eavesdropper",
        "estimate the sifted error rate",
        "done: report sifting and error probabilities",
    ],
};

export default module;
