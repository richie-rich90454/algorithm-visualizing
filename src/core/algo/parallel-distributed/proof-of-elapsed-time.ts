/**
 * proof-of-elapsed-time.ts - Proof of Elapsed Time (Trusted Wait Leader Election)
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Proof of Elapsed Time elects a leader by making each participant wait a
 * random amount of time inside a trusted execution environment. The wait is
 * produced by a verifiable delay function, so nobody can finish early, and the
 * participant with the shortest wait wins the right to produce a block. Anyone
 * can verify the reported wait and check that no smaller one was submitted.
 *
 * This deterministic teaching simulation takes explicit wait durations, finds
 * the unique minimum, and verifies that every reported duration is a finite
 * nonnegative number.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(P) to find and verify a winner among P participants
 *   Space: O(P) for the wait list and verification flags
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - One bar per participant encodes its wait duration.
 *   - Verified waits are amber; the winner is green.
 *   - A malformed wait is red and cannot win.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

export interface PoETData {
    participants: number;
    waits: number[];
    verified: boolean[];
    winner: number;
}

/** Deterministic Proof-of-Elapsed-Time winner selection and verification. */
export function simulateProofOfElapsedTime(waits: number[]): PoETData {
    const verified = waits.map((w) => Number.isFinite(w) && w >= 0);
    let winner = -1;
    for (let i = 0; i < waits.length; i += 1) {
        if (!verified[i]) continue;
        if (winner < 0 || (waits[i] ?? Infinity) < (waits[winner] ?? Infinity)) winner = i;
    }
    return { participants: waits.length, waits: [...waits], verified, winner };
}

/** Bars, one per participant. */
function makeBars(data: PoETData, states: EntityState[]): VisualEntity[] {
    return data.waits.map((wait, index) => ({
        id: `participant-${index}`,
        type: "bar" as const,
        label: `P${index}`,
        value: wait,
        state: states[index] ?? "idle",
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { index, wait },
    }));
}

/** The Proof of Elapsed Time generator. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { waits?: number[] } | null) ?? {};
    const waits = Array.isArray(task.waits) && task.waits.length > 0
        ? task.waits.map((w) => (typeof w === "number" ? w : 0))
        : [0.42, 0.17, 0.93, 0.61, 0.35];
    const data = simulateProofOfElapsedTime(waits);

    yield {
        stepNumber: 0,
        entities: makeBars(data, Array<EntityState>(data.participants).fill("idle")),
        edges: [],
        description: `Proof of Elapsed Time with ${data.participants} participants; each draws a random wait inside a trusted enclave and the shortest verified wait wins.`,
        codeLineNumber: 0,
        layout: "array",
        meta: { participants: data.participants, winner: -1, phase: "setup" },
    };

    const waitStates: EntityState[] = data.verified.map((ok) => (ok ? "comparing" : "error"));
    yield {
        stepNumber: 1,
        entities: makeBars(data, waitStates),
        edges: [],
        description: `Verify every wait proof: ${data.verified.filter(Boolean).length} of ${data.participants} waits are finite and nonnegative.`,
        codeLineNumber: 1,
        layout: "array",
        meta: { participants: data.participants, winner: -1, phase: "verify", verifiedFlags: data.verified.map((v) => (v ? 1 : 0)) },
    };

    const finalStates: EntityState[] = data.waits.map((_, index) =>
        index === data.winner ? "sorted" : data.verified[index] ? "active" : "error",
    );
    yield {
        stepNumber: 2,
        entities: makeBars(data, finalStates),
        edges: [],
        description: data.winner >= 0
            ? `Participant ${data.winner} had the shortest verified wait (${data.waits[data.winner]}) and is elected leader.`
            : "No participant submitted a valid wait, so no leader was elected.",
        codeLineNumber: 3,
        layout: "array",
        meta: { participants: data.participants, winner: data.winner, phase: "done", waits: data.waits },
    };
}

/** The Proof of Elapsed Time module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "Make everyone wait a random amount of time, but prove the wait really happened using trusted hardware and a sequential computation that cannot be sped up. The participant whose timer expires first gets to produce the next block. Verification is cheap, so the network avoids both mining races and large stake locks.",
        invariants: [
            "A wait proof is valid only when the duration is finite and nonnegative.",
            "Only participants with valid waits can win.",
            "The winner has the smallest valid wait, with ties broken by the earliest index.",
        ],
        correctness:
            "The trusted enclave guarantees each participant draws its wait from the same distribution and cannot shorten it, so the minimum wait is the first to expire. Requiring a verifiable delay proof prevents a participant from claiming a small wait without actually waiting. Because every node checks the same proofs and selects the unique minimum, all honest nodes agree on the same leader, giving a fair and verifiable election.",
        complexityRationale:
            "Verifying P wait proofs and scanning for the minimum takes O(P) time, and storing the waits and flags uses O(P) space. The slow sequential work happens once inside each enclave, outside the verifier's cost.",
        uses: [
            "Permissioned ledgers such as Hyperledger Sawtooth",
            "Lotteries and leader elections that need fair, verifiable randomness",
            "Teaching trusted hardware and verifiable delay functions",
        ],
        references: [
            "Cheng, Li, and Fedosova, Proof of Elapsed Time: A Consensus Protocol, 2016",
            "Lenstra and Wesels, Verifiable Delay Functions, 2018",
        ],
        workedExample:
            "Five participants report waits 0.42, 0.17, 0.93, 0.61, and 0.35. All proofs check out, so participant 1 with the shortest wait of 0.17 is elected leader for the next block.",
    },
    id: "proof-of-elapsed-time",
    name: "Proof of Elapsed Time",
    category: "parallel-distributed",
    complexity: { time: "O(P)", space: "O(P)" },
    defaultInput: { waits: [0.42, 0.17, 0.93, 0.61, 0.35] },
    visualType: "array",
    run,
    pseudocode: [
        "each participant requests a random wait from the enclave",
        "compute a verifiable delay proof for the wait",
        "broadcast the signed wait and its proof",
        "verify that every wait is finite and nonnegative",
        "discard participants whose proof fails",
        "select the participant with the smallest valid wait",
        "elect that participant as the block leader",
        "done: report the elected leader",
    ],
};

export default module;
