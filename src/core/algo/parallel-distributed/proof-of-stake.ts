/**
 * proof-of-stake.ts - Stake-Weighted Validator Selection (Teachable Core)
 *
 * Proof of stake chooses the next block proposer with probability proportional
 * to each validator's stake. This module implements that teachable core: a
 * deterministic hash maps a round seed to a uniform number, and weighted
 * roulette over the stake distribution selects a validator. It is the selection
 * rule only, not a full consensus or slashing protocol.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

/** Deterministically map a seed and round to a value in [0, 1). */
export function hashToUnit(seed: number, round: number): number {
    let state = (Math.imul(seed + round * 7919, 1664525) + 1013904223) >>> 0;
    state = (Math.imul(state ^ (state >>> 16), 2246822507) + 3266489909) >>> 0;
    return (state >>> 0) / 4294967296;
}

/** Select the validator whose cumulative stake interval contains u. */
export function selectByStake(stakes: number[], u: number): number {
    const total = stakes.reduce((sum, value) => sum + value, 0);
    if (total <= 0) {
        return 0;
    }
    const target = u * total;
    let cumulative = 0;
    for (let i = 0; i < stakes.length; i += 1) {
        cumulative += stakes[i] ?? 0;
        if (target < cumulative) {
            return i;
        }
    }
    return Math.max(0, stakes.length - 1);
}

/** Build stake bars with the chosen validator highlighted. */
function makeBars(stakes: number[], selected: number): VisualEntity[] {
    return stakes.map((stake, i) => ({
        id: `validator-${i}`,
        type: "bar" as const,
        label: `V${i}: ${stake}`,
        value: stake,
        state: (i === selected ? "sorted" : "idle") as EntityState,
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { index: i, stake, selected: i === selected },
    }));
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { stakes?: number[]; seed?: number; rounds?: number } | null) ?? {};
    const stakes: number[] = Array.isArray(task.stakes) && task.stakes.length > 0
        ? task.stakes.map((value) => Math.max(0, value))
        : [5, 3, 2, 1];
    const seed = typeof task.seed === "number" ? Math.floor(task.seed) : 20261118;
    const rounds = typeof task.rounds === "number" ? Math.max(1, Math.min(40, Math.floor(task.rounds))) : 8;
    const total = stakes.reduce((sum, value) => sum + value, 0);
    const metaBase = { n: stakes.length, stakes, seed, rounds, total };

    let step = 0;
    yield {
        stepNumber: step,
        entities: makeBars(stakes, -1),
        edges: [],
        description: `${stakes.length} validators with total stake ${total}: proposer is chosen with probability proportional to stake (selection core of proof of stake).`,
        codeLineNumber: 0,
        layout: "array",
        meta: { ...metaBase },
    };
    step += 1;

    const results: number[] = [];
    for (let round = 0; round < rounds; round += 1) {
        const u = hashToUnit(seed, round);
        const selected = selectByStake(stakes, u);
        results.push(selected);
        yield {
            stepNumber: step,
            entities: makeBars(stakes, selected),
            edges: [],
            description: `Round ${round}: hash gives u=${u.toFixed(4)}; cumulative stake interval selects validator ${selected} with stake ${stakes[selected] ?? 0}.`,
            codeLineNumber: round === 0 ? 1 : 2,
            layout: "array",
            meta: { ...metaBase, round, u, selected, cumulative: stakes.slice(0, selected + 1).reduce((a, b) => a + b, 0) },
        };
        step += 1;
    }

    yield {
        stepNumber: step,
        entities: makeBars(stakes, results[results.length - 1] ?? -1),
        edges: [],
        description: `Done: ${rounds} stake-weighted draws produced proposer sequence [${results.join(", ")}].`,
        codeLineNumber: 4,
        layout: "array",
        meta: { ...metaBase, results, done: true },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Proof of stake replaces computational work with economic commitment: a validator's chance of proposing a block is proportional to the stake it has locked up. The selection can be viewed as a weighted lottery, where each validator owns an interval of the unit line whose length matches its share of total stake. A verifiable hash picks a point on that line.",
        invariants: [
            "Selection probabilities are proportional to stake shares.",
            "A validator with zero stake owns an empty interval and is never selected.",
            "A fixed seed and round always produce the same uniform draw and thus the same proposer.",
        ],
        correctness:
            "Weighted roulette places validator i on the interval [cumulative before i, cumulative through i) scaled by total stake. A uniform u falls in each interval with probability equal to its length divided by the total, which is exactly that validator's stake share; intervals partition the unit line, so exactly one validator is chosen. Zero-stake intervals are empty, and the hash is a deterministic function of seed and round, so replaying a round reproduces its proposer.",
        complexityRationale:
            "Each round hashes once and scans the n validators' cumulative stakes, giving O(n) time per round and O(n) space for the stake bars. Real systems use efficient weighted sampling trees so selection costs O(log n) per validator set.",
        uses: [
            "Block proposer selection in proof-of-stake blockchains",
            "Committee sampling weighted by stake or reputation",
            "A teaching model for weighted random selection",
        ],
        references: [
            "Nakamoto, Bitcoin: A Peer-to-Peer Electronic Cash System, 2008",
            "Gilad et al., Algorand: Scaling Byzantine Agreements for Cryptocurrencies, OSDI 2017",
        ],
        workedExample:
            "With stakes [5, 3, 2, 1] the total is 11, so validator 0 owns about 45 percent of the unit line, validator 1 about 27 percent, and so on. A hash value u of 0.4 falls in validator 0's interval [0, 0.455), so validator 0 is selected; over many draws its share of selections approaches 5/11.",
    },
    id: "proof-of-stake",
    name: "Proof of Stake",
    category: "parallel-distributed",
    complexity: { time: "O(n) per round", space: "O(n)" },
    defaultInput: { stakes: [5, 3, 2, 1], seed: 20261118, rounds: 8 },
    visualType: "array",
    run,
    pseudocode: [
        "list validators with their locked stake and compute the total",
        "for each round derive a uniform value from the seed and round",
        "walk the cumulative stake intervals in validator order",
        "select the first validator whose interval contains the value",
        "record the chosen proposer for this round",
        "done: report the proposer sequence over all rounds",
    ],
};

export default module;
