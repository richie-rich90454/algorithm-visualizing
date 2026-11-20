/**
 * proof-of-history.ts - Proof of History (Verifiable Sequential Timing)
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Proof of History builds a chain of hashes where each output is the hash of
 * the previous one. Because the computation is sequential, a verifier can
 * check that a certain number of ticks really elapsed and place events at a
 * trustworthy position in time without consulting every participant's clock.
 * Messages are stamped with the current hash, giving a global, verifiable order.
 *
 * This deterministic teaching simulation computes a bounded 32-bit hash chain
 * from a seed and verifies every link of the resulting sequence.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(T) to compute T hashes, O(T) to verify the chain
 *   Space: O(T) for the stored hash sequence
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - One grid cell per hash, including the seed at index zero.
 *   - Cells turn amber as links are computed and green when verified.
 *   - The final frame reports the number of ticks and chain validity.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

/** A deterministic, reversible-looking 32-bit avalanche mix used as the tick hash. */
export function pohHash(value: number): number {
    let h = value >>> 0;
    h = Math.imul(h ^ (h >>> 16), 0x45d9f3b) >>> 0;
    h = Math.imul(h ^ (h >>> 16), 0x45d9f3b) >>> 0;
    return (h ^ (h >>> 16)) >>> 0;
}

export interface PoHData {
    seed: number;
    ticks: number;
    chain: number[];
    verified: boolean;
}

/** Verify that every hash after the seed is the hash of its predecessor. */
export function verifyProofOfHistory(chain: number[]): boolean {
    return chain.every((hash, index) => index === 0 || hash === pohHash(chain[index - 1] ?? 0));
}

/** Compute a bounded Proof-of-History hash chain. */
export function simulateProofOfHistory(seed: number, ticks: number): PoHData {
    const count = Math.min(200, Math.max(0, Math.floor(ticks)));
    const chain: number[] = [(seed | 0) >>> 0];
    for (let i = 1; i <= count; i += 1) chain.push(pohHash(chain[i - 1] ?? 0));
    return { seed: (seed | 0) >>> 0, ticks: count, chain, verified: verifyProofOfHistory(chain) };
}

/** Grid cells, one per hash in the chain. */
function makeCells(chain: number[], states: EntityState[]): VisualEntity[] {
    return chain.map((hash, index) => ({
        id: `tick-${index}`,
        type: "cell" as const,
        label: hash.toString(16).padStart(8, "0"),
        value: hash,
        state: states[index] ?? "idle",
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { index, hash, row: Math.floor(index / 6), col: index % 6 },
    }));
}

/** The Proof of History generator. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { seed?: number; ticks?: number } | null) ?? {};
    const data = simulateProofOfHistory(task.seed ?? 12345, task.ticks ?? 8);

    yield {
        stepNumber: 0,
        entities: makeCells(data.chain, Array<EntityState>(data.chain.length).fill("idle")),
        edges: [],
        description: `Proof of History seed ${data.seed}: each subsequent hash is computed from the previous one, creating ${data.ticks} sequential tick(s).`,
        codeLineNumber: 0,
        layout: "grid",
        meta: { ticks: data.ticks, seed: data.seed, verified: 0, phase: "setup" },
    };

    const computing: EntityState[] = data.chain.map((_, i) => (i === 0 ? "active" : "comparing"));
    yield {
        stepNumber: 1,
        entities: makeCells(data.chain, computing),
        edges: [],
        description: `Compute the chain forward: tick i is the hash of tick i-1, so the work cannot be parallelized away.`,
        codeLineNumber: 1,
        layout: "grid",
        meta: { ticks: data.ticks, seed: data.seed, verified: 0, phase: "compute", chain: data.chain },
    };

    const verifying: EntityState[] = data.chain.map((_, i) => (i === 0 ? "comparing" : "active"));
    yield {
        stepNumber: 2,
        entities: makeCells(data.chain, verifying),
        edges: [],
        description: `Verify each link by hashing the predecessor and comparing with the recorded value.`,
        codeLineNumber: 2,
        layout: "grid",
        meta: { ticks: data.ticks, seed: data.seed, verified: 0, phase: "verify", chain: data.chain },
    };

    const final: EntityState[] = data.chain.map(() => (data.verified ? "sorted" : "error"));
    yield {
        stepNumber: 3,
        entities: makeCells(data.chain, final),
        edges: [],
        description: data.verified
            ? `All ${data.ticks} tick(s) verify; the chain fixes a trustworthy order for timestamped events.`
            : "A link in the hash chain failed verification; the claimed elapsed time is invalid.",
        codeLineNumber: 4,
        layout: "grid",
        meta: { ticks: data.ticks, seed: data.seed, verified: data.verified ? 1 : 0, chain: data.chain, phase: "done" },
    };
}

/** The Proof of History module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "Hash a value, then hash the result, over and over. Each step depends on the one before it, so producing a million ticks takes a million sequential hash operations, but checking the result is just as cheap as computing it. Stamping messages with a tick gives everyone a verifiable position in time without relying on any single clock.",
        invariants: [
            "Tick zero is exactly the seed value.",
            "Every later tick equals the hash of the tick before it.",
            "The chain verifies only when every link is intact.",
        ],
        correctness:
            "Verification recomputes each hash from its predecessor and compares it with the recorded value, so any altered or skipped tick fails at the first mismatch. Because each hash requires the previous one, an adversary cannot jump ahead without doing the sequential work, which bounds how much time the chain certifies. Identical seeds and tick counts give identical chains, so all verifiers agree on the same timeline.",
        complexityRationale:
            "Producing T hashes takes O(T) sequential time, and verifying compares T links, also O(T). Storing the chain uses O(T) space.",
        uses: [
            "High-throughput ledgers such as Solana that need a verifiable clock",
            "Timestamping events with a trusted ordering without centralized time",
            "Teaching verifiable delay functions and sequential computation",
        ],
        references: [
            "Yakovenko, Solana: A New Architecture for a High Performance Blockchain, 2017",
            "Lenstra and Wesels, Verifiable Delay Functions, 2018",
        ],
        workedExample:
            "Starting from seed 1 with three ticks, the chain is [1, h(1), h(h(1)), h(h(h(1)))]. Replacing the middle hash with a wrong value makes verification fail at the very next link, showing the claimed elapsed time was forged.",
    },
    id: "proof-of-history",
    name: "Proof of History",
    category: "parallel-distributed",
    complexity: { time: "O(T)", space: "O(T)" },
    defaultInput: { seed: 12345, ticks: 8 },
    visualType: "grid",
    run,
    pseudocode: [
        "choose a seed and the number of ticks T",
        "set the first hash to the seed",
        "for each tick compute the hash of the previous tick",
        "store the full sequence of hashes",
        "recompute each link during verification",
        "compare the recomputed hash with the stored hash",
        "reject the timeline on the first mismatch",
        "done: report the tick count and verification result",
    ],
};

export default module;
