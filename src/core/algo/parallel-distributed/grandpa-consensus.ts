/**
 * grandpa-consensus.ts - GRANDPA Finality Gadget (Chain Votes)
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * GRANDPA finalizes blocks, not individual transactions. Validators vote with
 * a chain prefix: a precommit for height h counts as a vote for every block up
 * to h. A block is finalized when more than two thirds of the validator weight
 * has voted for a chain containing it. Because a finalized block is the common
 * ancestor of every vote in the supermajority, conflicting forks cannot both
 * be finalized.
 *
 * This deterministic teaching simulation finds the highest block supported by
 * a two-thirds precommit quorum.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(V * H) to tally V validators over H candidate heights
 *   Space: O(V) for validator vote state
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - One bar per validator encodes its highest voted block.
 *   - Bars are amber during prevote and green during precommit.
 *   - The final frame highlights every validator voting for the finalized height.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

export interface GrandpaData {
    validators: number;
    bestHeights: number[];
    threshold: number;
    finalized: number;
    maxHeight: number;
}

/** Deterministic GRANDPA finality computation from validator chain prefixes. */
export function simulateGrandpa(bestHeights: number[]): GrandpaData {
    const validators = bestHeights.length;
    const threshold = Math.floor(2 * validators / 3) + 1;
    const maxHeight = bestHeights.length > 0 ? Math.max(...bestHeights, 0) : 0;
    let finalized = -1;
    for (let h = 0; h <= maxHeight; h += 1) {
        const count = bestHeights.filter((height) => height >= h).length;
        if (count >= threshold) finalized = h;
    }
    return { validators, bestHeights: [...bestHeights], threshold, finalized, maxHeight };
}

/** Bars, one per validator. */
function makeBars(data: GrandpaData, states: EntityState[]): VisualEntity[] {
    return data.bestHeights.map((height, index) => ({
        id: `validator-${index}`,
        type: "bar" as const,
        label: `V${index}`,
        value: height,
        state: states[index] ?? "idle",
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { index, height },
    }));
}

/** The GRANDPA generator. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { bestHeights?: number[] } | null) ?? {};
    const bestHeights = Array.isArray(task.bestHeights) && task.bestHeights.length > 0
        ? task.bestHeights.map((h) => (typeof h === "number" ? h : 0))
        : [5, 4, 5, 5, 3, 5];
    const data = simulateGrandpa(bestHeights);

    yield {
        stepNumber: 0,
        entities: makeBars(data, Array<EntityState>(data.validators).fill("idle")),
        edges: [],
        description: `GRANDPA with ${data.validators} validators; a block finalizes when more than two thirds (${data.threshold}) vote for a chain containing it.`,
        codeLineNumber: 0,
        layout: "array",
        meta: { validators: data.validators, threshold: data.threshold, phase: "setup", finalized: -1 },
    };

    yield {
        stepNumber: 1,
        entities: makeBars(data, Array<EntityState>(data.validators).fill("comparing")),
        edges: [],
        description: `Prevote round: each validator broadcasts its best chain up to height ${data.bestHeights.join(", ")}.`,
        codeLineNumber: 1,
        layout: "array",
        meta: { validators: data.validators, threshold: data.threshold, phase: "prevote", finalized: -1 },
    };

    yield {
        stepNumber: 2,
        entities: makeBars(data, Array<EntityState>(data.validators).fill("active")),
        edges: [],
        description: `Precommit round: validators lock their highest chain; a height counts for every block at or below it.`,
        codeLineNumber: 2,
        layout: "array",
        meta: { validators: data.validators, threshold: data.threshold, phase: "precommit", finalized: -1 },
    };

    const finalStates: EntityState[] = data.bestHeights.map((height) =>
        data.finalized >= 0 && height >= data.finalized ? "sorted" : "unvisited",
    );
    yield {
        stepNumber: 3,
        entities: makeBars(data, finalStates),
        edges: [],
        description: data.finalized >= 0
            ? `Block ${data.finalized} is finalized: it lies in the chain prefix of at least ${data.threshold} validators.`
            : "No block reached a two-thirds precommit quorum, so nothing is finalized yet.",
        codeLineNumber: 4,
        layout: "array",
        meta: {
            validators: data.validators,
            threshold: data.threshold,
            phase: "done",
            finalized: data.finalized,
            bestHeights: data.bestHeights,
        },
    };
}

/** The GRANDPA module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "Instead of voting on one block at a time, validators vote for a whole chain prefix. A vote for height ten also votes for every block below ten. When enough validators vote for chains that share a common block, that block is final and can never be rolled back. This settles forks quickly even while block production continues.",
        invariants: [
            "A vote for height h counts for every block at or below h.",
            "Finality needs support from more than two thirds of validators.",
            "The finalized block is contained in every vote of the supporting quorum.",
        ],
        correctness:
            "Suppose block b is finalized by a quorum Q of more than two thirds of validators. Any conflicting finalized block b' would need another quorum Q' of the same size. Since Q and Q' intersect in at least one honest validator, that validator would have to precommit to two conflicting chains, which the voting rules forbid. Therefore no two conflicting blocks can be finalized, giving finality safety.",
        complexityRationale:
            "Each validator emits one prevote and one precommit, so the protocol uses O(V) votes per round. Scanning the candidate heights to find the highest supported block costs O(V * H) in this teaching simulation, and storing validator votes takes O(V) space.",
        uses: [
            "Block finality in polkadot-style proof-of-stake chains",
            "Layer-two rollups that need fast, irreversible checkpoints",
            "Teaching chain-vote finality gadgets separate from block production",
        ],
        references: [
            "Stewart, Al Arnaout, and Goodell, GRANDPA: A Provable Finality Gadget, 2020",
            "Wood, Polkadot: Vision for a Heterogeneous Multi-Chain Framework, 2016",
        ],
        workedExample:
            "Six validators with best heights 5, 4, 5, 5, 3, 5 have a two-thirds threshold of five. Height 5 has four votes, so it is not final. Height 4 has five votes and is the highest such block, so block 4 is finalized.",
    },
    id: "grandpa-consensus",
    name: "GRANDPA Consensus",
    category: "parallel-distributed",
    complexity: { time: "O(V*H) tally", space: "O(V)" },
    defaultInput: { bestHeights: [5, 4, 5, 5, 3, 5] },
    visualType: "array",
    run,
    pseudocode: [
        "each validator advertises its best chain height",
        "broadcast a prevote for that chain prefix",
        "lock the highest chain in a precommit vote",
        "count how many precommits include each height",
        "find the highest height with more than two thirds support",
        "declare that block finalized and immutable",
        "discard forks that do not extend the finalized block",
        "done: report the finalized block height",
    ],
};

export default module;
