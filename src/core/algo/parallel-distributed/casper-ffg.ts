/**
 * casper-ffg.ts - Casper the Friendly Finality Gadget (Checkpoint Votes)
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Casper FFG overlays a proof-of-stake chain with epochs and checkpoints.
 * Validators cast votes linking a source checkpoint to a target checkpoint. A
 * checkpoint becomes justified when a supermajority links to it, and a
 * checkpoint is finalized when a justified checkpoint has a supermajority link
 * to its direct child. Fork choice then follows the chain with the highest
 * justified checkpoint, so finalized checkpoints are never abandoned.
 *
 * This deterministic teaching simulation computes justified and finalized
 * checkpoints from a multiset of validator votes.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(C * V) for C checkpoints and V validator votes per pass
 *   Space: O(C + V) for tallies and vote storage
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - One grid cell per checkpoint, from genesis to the last epoch.
 *   - Justified checkpoints are amber; finalized ones are green.
 *   - The final frame lists both sets in order.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

export interface CasperData {
    checkpoints: number;
    validators: number;
    threshold: number;
    justified: number[];
    finalized: number[];
    voteCounts: number[];
}

/** Deterministic Casper FFG justification and finalization. */
export function simulateCasper(
    epochs: number,
    votes: Array<[number, number]>,
    validators: number,
): CasperData {
    const checkpoints = Math.max(1, Math.floor(epochs) + 1);
    const threshold = Math.floor(Math.max(1, validators) * 2 / 3) + 1;
    const voteCounts = Array<number>(checkpoints).fill(0);
    for (const [source, target] of votes) {
        if (target >= 0 && target < checkpoints && source >= 0 && source < checkpoints) {
            voteCounts[target] = (voteCounts[target] ?? 0) + 1;
        }
    }
    const justified = new Set<number>([0]);
    for (let pass = 0; pass < checkpoints; pass += 1) {
        for (const [source, target] of votes) {
            if (target >= 0 && target < checkpoints && source >= 0 && source < checkpoints &&
                (voteCounts[target] ?? 0) >= threshold && justified.has(source)) {
                justified.add(target);
            }
        }
    }
    const finalized = new Set<number>();
    for (const [source, target] of votes) {
        if (target === source + 1 && (voteCounts[target] ?? 0) >= threshold &&
            justified.has(source) && justified.has(target)) {
            finalized.add(target);
        }
    }
    return {
        checkpoints,
        validators,
        threshold,
        justified: [...justified].sort((a, b) => a - b),
        finalized: [...finalized].sort((a, b) => a - b),
        voteCounts,
    };
}

/** Grid cells, one per checkpoint. */
function makeCells(data: CasperData, states: EntityState[]): VisualEntity[] {
    return states.map((state, index) => ({
        id: `checkpoint-${index}`,
        type: "cell" as const,
        label: index === 0 ? "genesis" : `cp${index}`,
        value: index,
        state,
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { index, votes: data.voteCounts[index] ?? 0, row: Math.floor(index / 6), col: index % 6 },
    }));
}

/** The Casper FFG generator. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { epochs?: number; validators?: number; votes?: Array<[number, number]> } | null) ?? {};
    const votes: Array<[number, number]> = Array.isArray(task.votes)
        ? task.votes.filter((v) => Array.isArray(v) && v.length === 2).map((v) => [v[0] ?? 0, v[1] ?? 0])
        : [[0, 1], [0, 1], [0, 1], [1, 2], [1, 2]];
    const data = simulateCasper(task.epochs ?? 2, votes, task.validators ?? 3);

    yield {
        stepNumber: 0,
        entities: makeCells(data, Array<EntityState>(data.checkpoints).fill("idle")),
        edges: [],
        description: `Casper FFG with ${data.checkpoints} checkpoints and ${data.validators} validators; a supermajority means ${data.threshold} votes.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: { checkpoints: data.checkpoints, threshold: data.threshold, phase: "setup", justified: [], finalized: [] },
    };

    const voteStates: EntityState[] = Array.from({ length: data.checkpoints }, (_, i) =>
        (data.voteCounts[i] ?? 0) >= data.threshold ? "comparing" : "idle",
    );
    yield {
        stepNumber: 1,
        entities: makeCells(data, voteStates),
        edges: [],
        description: `Validator votes tallied per target checkpoint: [${data.voteCounts.join(", ")}]; ${data.threshold} votes form a supermajority link.`,
        codeLineNumber: 1,
        layout: "grid",
        meta: { checkpoints: data.checkpoints, threshold: data.threshold, phase: "votes", voteCounts: data.voteCounts },
    };

    const justifiedStates: EntityState[] = Array.from({ length: data.checkpoints }, (_, i) =>
        data.justified.includes(i) ? "active" : "idle",
    );
    yield {
        stepNumber: 2,
        entities: makeCells(data, justifiedStates),
        edges: [],
        description: `Justification propagates from genesis: checkpoints [${data.justified.join(", ")}] have supermajority links from justified sources.`,
        codeLineNumber: 2,
        layout: "grid",
        meta: { checkpoints: data.checkpoints, threshold: data.threshold, phase: "justify", justified: data.justified },
    };

    const finalStates: EntityState[] = Array.from({ length: data.checkpoints }, (_, i) => {
        if (data.finalized.includes(i)) return "sorted";
        return data.justified.includes(i) ? "active" : "idle";
    });
    yield {
        stepNumber: 3,
        entities: makeCells(data, finalStates),
        edges: [],
        description: `Finalized checkpoints [${data.finalized.join(", ")}] each have a direct supermajority link from a justified parent.`,
        codeLineNumber: 4,
        layout: "grid",
        meta: { checkpoints: data.checkpoints, threshold: data.threshold, phase: "done", justified: data.justified, finalized: data.finalized },
    };
}

/** The Casper FFG module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "Group blocks into epochs and pick the first block of each as a checkpoint. Validators vote for links between checkpoints. Once two thirds agree on a link, the target is justified; once a justified checkpoint has a two-thirds link to its immediate child, the parent is finalized. Fork choice always follows the most recently justified checkpoint, so a finalized checkpoint is never left behind.",
        invariants: [
            "Genesis is always justified.",
            "A checkpoint is justified only via a supermajority link from a justified source.",
            "Finalization requires a direct parent-child supermajority link.",
        ],
        correctness:
            "Suppose checkpoint c is finalized by a supermajority link to its child, and a conflicting checkpoint c' were also finalized. Both supermajorities intersect in at least one validator, which would have to cast two conflicting links from a justified source. Casper's slashing conditions forbid that, so conflicting checkpoints cannot both finalize. Because fork choice follows the highest justified checkpoint, finalized checkpoints remain on the canonical chain, giving accountable safety.",
        complexityRationale:
            "With C checkpoints and V votes, tallying target counts costs O(V) and the justification fixpoint takes at most O(C) passes, each scanning V votes, for O(C * V). Storing tallies and votes uses O(C + V) space.",
        uses: [
            "Proof-of-stake finality in Ethereum-style consensus layers",
            "Cross-chain bridges that wait for finalized checkpoints",
            "Teaching accountable safety and slashing conditions",
        ],
        references: [
            "Buterin and Griffith, Casper the Friendly Finality Gadget, 2017",
            "Buterin, A Minimum Viable Merge and Specification for EIP-1011, 2018",
        ],
        workedExample:
            "With three validators and epochs 1 and 2, votes (0,1) cast three times justify and finalize checkpoint 1, because 0 is genesis and the link is direct. Votes (1,2) cast twice fall short of the threshold of three, so checkpoint 2 is neither justified nor finalized.",
    },
    id: "casper-ffg",
    name: "Casper FFG",
    category: "parallel-distributed",
    complexity: { time: "O(C*V)", space: "O(C+V)" },
    defaultInput: { epochs: 2, validators: 3, votes: [[0, 1], [0, 1], [0, 1], [1, 2], [1, 2]] },
    visualType: "grid",
    run,
    pseudocode: [
        "mark genesis as the first justified checkpoint",
        "tally validator votes for each target checkpoint",
        "a target is justified when a supermajority links from a justified source",
        "repeat justification until no new checkpoint qualifies",
        "finalize a checkpoint with a direct supermajority link from its parent",
        "choose the chain headed by the highest justified checkpoint",
        "slash any validator voting for conflicting links",
        "done: report justified and finalized checkpoints",
    ],
};

export default module;
