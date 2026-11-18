/**
 * b92-protocol.ts - B92 Quantum Key Distribution (Small Toy Model)
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * B92 is a quantum key distribution protocol that uses only two nonorthogonal
 * states. Alice encodes bit 0 as the state |0> and bit 1 as |+>, which is
 * (|0> + |1>) divided by the square root of two. Bob measures each qubit in a
 * randomly chosen basis, either the computational basis Z or the Hadamard
 * basis X. Some outcomes are impossible for one of the two states, so when Bob
 * sees such an outcome he knows the bit with certainty. All other outcomes are
 * inconclusive and are discarded. Alice and Bob publicly reveal which rounds
 * were conclusive and keep those bits as a shared key.
 *
 * This is a deterministic teaching simulation of the state discrimination and
 * sifting rules, with an optional intercept-and-resend eavesdropper. It is NOT
 * a real QKD implementation: there is no quantum channel, authentication,
 * privacy amplification, or full security proof. Only the measurement
 * statistics and the conclusive-inference rule are faithful.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(r) for r transmitted qubits
 *   Space: O(r) for the per-round records
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Each round is a grid cell showing Alice's bit, Bob's basis, and outcome.
 *   - A conclusive round is green, an inconclusive round gray, an error red.
 *   - meta carries the records, conclusive indices, errors, and final key.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

type Basis = "Z" | "X";
type State = "0" | "1" | "+" | "-";

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

export interface B92Round {
    index: number;
    aliceBit: 0 | 1;
    aliceState: State;
    bobBasis: Basis;
    bobOutcome: State | "0" | "1";
    conclusive: boolean;
    inferredBit: 0 | 1 | null;
    correct: boolean;
}

/** Measure a qubit state in a basis, returning the outcome and collapsed state. */
function measure(state: State, basis: Basis, random: () => number): { outcome: "0" | "1" | "+" | "-"; collapsed: State } {
    if (basis === "Z") {
        if (state === "0") {
            return { outcome: "0", collapsed: "0" };
        }
        if (state === "1") {
            return { outcome: "1", collapsed: "1" };
        }
        const bit = random() < 0.5 ? "0" : "1";
        return { outcome: bit, collapsed: bit };
    }
    if (state === "+") {
        return { outcome: "+", collapsed: "+" };
    }
    if (state === "-") {
        return { outcome: "-", collapsed: "-" };
    }
    const sign = random() < 0.5 ? "+" : "-";
    return { outcome: sign, collapsed: sign };
}

/** Simulate B92 for a fixed bit string; optionally insert an intercept-resend eavesdropper. */
export function simulateB92(bits: Array<0 | 1>, seed: number, eavesdropper: boolean): B92Round[] {
    const random = rng(seed);
    return bits.map((bit, index) => {
        const aliceState: State = bit === 0 ? "0" : "+";
        const bobBasis: Basis = random() < 0.5 ? "Z" : "X";
        let arriving: State = aliceState;
        if (eavesdropper) {
            const eveBasis: Basis = random() < 0.5 ? "Z" : "X";
            arriving = measure(arriving, eveBasis, random).collapsed;
        }
        const measurement = measure(arriving, bobBasis, random);
        const bobOutcome = measurement.outcome;
        let inferredBit: 0 | 1 | null = null;
        if (bobBasis === "Z" && bobOutcome === "1") {
            inferredBit = 1;
        } else if (bobBasis === "X" && bobOutcome === "-") {
            inferredBit = 0;
        }
        return {
            index,
            aliceBit: bit,
            aliceState,
            bobBasis,
            bobOutcome,
            conclusive: inferredBit !== null,
            inferredBit,
            correct: inferredBit === null ? true : inferredBit === bit,
        };
    });
}

/** Build cells for one frame. */
function makeCells(rounds: B92Round[], visible: number): VisualEntity[] {
    return rounds.map((round) => {
        const shown = round.index <= visible;
        let state: EntityState = "unvisited";
        if (shown) {
            state = !round.conclusive ? "idle" : round.correct ? "sorted" : "error";
        }
        const label = shown
            ? `r${round.index}: A=${round.aliceBit}(${round.aliceState}) B=${round.bobBasis}/${round.bobOutcome} ${round.conclusive ? (round.correct ? "key" : "ERR") : "inconclusive"}`
            : `r${round.index}: ?`;
        return {
            id: `round-${round.index}`,
            type: "cell" as const,
            label,
            value: round.index,
            state,
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: {
                row: 0,
                col: round.index,
                index: round.index,
                aliceBit: round.aliceBit,
                bobBasis: round.bobBasis,
                bobOutcome: round.bobOutcome,
                conclusive: round.conclusive,
                inferredBit: round.inferredBit ?? -1,
                correct: round.correct,
            },
        };
    });
}

/** The B92 generator. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { bits?: Array<0 | 1>; rounds?: number; seed?: number; eavesdropper?: boolean } | null) ?? {};
    const bits: Array<0 | 1> = Array.isArray(task.bits) && task.bits.length > 0
        ? task.bits.map((bit) => (bit === 1 ? 1 : 0))
        : Array.from({ length: 16 }, (_, index) => (index % 3 === 0 ? 1 : 0) as 0 | 1);
    const seed = typeof task.seed === "number" ? Math.floor(task.seed) : 9;
    const eavesdropper = task.eavesdropper === true;
    const rounds = simulateB92(bits, seed, eavesdropper);
    const conclusiveIndices = rounds.filter((round) => round.conclusive).map((round) => round.index);
    const key = conclusiveIndices.map((index) => rounds[index]?.aliceBit).join("");
    const errors = conclusiveIndices.filter((index) => !rounds[index]?.correct);

    let step = 0;
    yield {
        stepNumber: step++,
        entities: makeCells(rounds, -1),
        edges: [],
        description: `B92 with ${bits.length} qubits, seed ${seed}, eavesdropper ${eavesdropper ? "present" : "absent"}. Alice sends |0> for 0 and |+> for 1.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: { rows: 1, cols: bits.length, rounds: bits.length, seed, eavesdropper, conclusive: 0, errors: 0, key: "", keyLength: 0 },
    };

    for (const round of rounds) {
        yield {
            stepNumber: step++,
            entities: makeCells(rounds, round.index),
            edges: [],
            description: `Round ${round.index}: Alice sends ${round.aliceState}, Bob measures in ${round.bobBasis} and gets ${round.bobOutcome}. ${round.conclusive ? `Conclusive: bit ${round.inferredBit}${round.correct ? "" : " (ERROR)"}.` : "Inconclusive outcome; discard."}`,
            codeLineNumber: round.conclusive ? (round.correct ? 3 : 6) : 2,
            layout: "grid",
            meta: {
                rows: 1,
                cols: bits.length,
                rounds: bits.length,
                seed,
                eavesdropper,
                conclusive: conclusiveIndices.length,
                errors: errors.length,
                key: "",
                keyLength: 0,
            },
        };
    }

    yield {
        stepNumber: step,
        entities: makeCells(rounds, bits.length - 1),
        edges: [],
        description: `Publicly revealed ${conclusiveIndices.length} conclusive round(s); ${errors.length} error(s). Final shared key has ${key.length} bit(s): ${key || "empty"}.`,
        codeLineNumber: 7,
        layout: "grid",
        meta: {
            rows: 1,
            cols: bits.length,
            rounds: bits.length,
            seed,
            eavesdropper,
            conclusiveIndices,
            errorIndices: errors,
            errorCount: errors.length,
            conclusive: conclusiveIndices.length,
            errors: errors.length,
            key,
            bobKey: conclusiveIndices.map((index) => rounds[index]?.inferredBit).join(""),
            keyLength: key.length,
            note: "toy model: two nonorthogonal states, no authentication or privacy amplification",
        },
    };
}

/** The B92 teaching module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "Alice sends one of two states that are not orthogonal, so no measurement can tell them apart perfectly every time. Bob measures in a random basis and only occasionally gets an outcome that is impossible for one of the two states. Those rare outcomes identify the bit with certainty; everything else is thrown away. The surviving conclusive rounds form a shared secret key without ever sending a classical description of the states.",
        invariants: [
            "A conclusive outcome is never wrong in the noiseless case: Z outcome 1 implies bit 1, X outcome minus implies bit 0.",
            "Inconclusive rounds are discarded and never enter the key.",
            "Bob's inferred bit is computed only from his measurement basis and outcome.",
        ],
        correctness:
            "The states |0> and |+> satisfy <0|+> = 1/sqrt(2), so they are nonorthogonal and cannot be distinguished with certainty in a single measurement. In the Z basis, outcome 1 can only come from |+>, since |0> never yields 1; in the X basis, outcome minus can only come from |0>, since |+> never yields minus. Bob therefore infers the correct bit whenever such an outcome occurs. About one quarter of rounds are conclusive in the ideal case. An intercept-and-resend attacker must measure in a random basis and disturb the state, which introduces errors into the conclusive subset and reveals its presence.",
        complexityRationale:
            "Each of the r qubits needs one basis choice and one measurement, and sifting scans the r records once, so the work is O(r). The per-round records occupy O(r) space.",
        uses: [
            "A teaching model for quantum key distribution with two states",
            "Explaining nonorthogonal state discrimination and inconclusive outcomes",
            "Comparing state efficiency with the four-state BB84 protocol",
        ],
        references: [
            "Bennett, Quantum Cryptography Using Any Two Nonorthogonal States, 1992",
            "Nielsen and Chuang, Quantum Computation and Quantum Information, Chapter 12",
        ],
        workedExample:
            "Alice sends bit 1 as |+>. If Bob measures in the Z basis he gets 0 or 1 with equal probability; only the outcome 1 is conclusive and means bit 1. If he measures in X he always gets +, which is inconclusive. Sending bit 0 as |0> is symmetric: only an X-basis outcome of minus is conclusive and means bit 0.",
    },
    id: "b92-protocol",
    name: "B92 Quantum Key Distribution (Small Toy Model)",
    category: "quantum",
    complexity: { time: "O(r)", space: "O(r)" },
    defaultInput: { bits: [0, 1, 0, 0, 1, 1, 0, 1, 0, 0, 1, 0, 1, 1, 0, 1], seed: 9, eavesdropper: false },
    visualType: "grid",
    run,
    pseudocode: [
        "Alice picks a random secret bit for each qubit",
        "encode zero as state zero and one as state plus",
        "Bob measures each qubit in a random Z or X basis",
        "Z outcome one implies bit one conclusively",
        "X outcome minus implies bit zero conclusively",
        "all other outcomes are inconclusive and discarded",
        "publicly reveal which rounds were conclusive",
        "use the conclusive bits as the shared key",
        "done: report the key and any observed errors",
    ],
};

export default module;
