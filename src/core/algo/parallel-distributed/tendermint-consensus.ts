/**
 * tendermint-consensus.ts - Tendermint BFT Consensus (one height, one round)
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Tendermint orders blocks in rounds of propose, prevote, and precommit. A
 * validator locks onto a proposed block after collecting more than two thirds
 * of prevotes, and commits it after more than two thirds of precommits. Because
 * any two sets of more than two thirds overlap in at least one honest validator,
 * two different blocks cannot both be committed at the same height.
 *
 * ---------------------------------------------------------------------------
 * Scope of the model
 * ---------------------------------------------------------------------------
 * This is a SMALL DETERMINISTIC SIMULATION of a single height and round, not a
 * Tendermint node. It models the quorum arithmetic, locking, and commit rule
 * with an honest proposer and faulty validators that withhold messages. It
 * omits round changes, valid AND/OR locking rules, gossip, and signatures. The
 * quorum math shown is exact: more than two thirds means floor(2n/3)+1 votes.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(n^2) messages (each validator broadcasts two vote rounds)
 *   Space: O(n) for per-validator vote state
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Validators are grid cells; the proposer starts active, faulty ones red.
 *   - Prevoted validators are purple, precommitted ones blue, committed green.
 *   - meta carries quorum, honest count, locked block, and final decision.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface Input {
    validators?: number;
    faulty?: number;
    block?: string;
}

/** More than two thirds of n validators: floor(2n/3) + 1. */
export function tendermintQuorum(n: number): number {
    return Math.floor((2 * n) / 3) + 1;
}

function makeCells(
    validators: number,
    proposer: number,
    faulty: Set<number>,
    states: Map<number, EntityState> = new Map(),
): VisualEntity[] {
    return Array.from({ length: validators }, (_, i) => ({
        id: `validator-${i}`,
        type: "cell" as const,
        label: i === proposer ? `${i} (proposer)` : String(i),
        value: i,
        state: states.get(i) ?? (faulty.has(i) ? "error" : "unvisited"),
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { row: 0, col: i, validator: i, faulty: faulty.has(i), proposer: i === proposer },
    }));
}

/** The Tendermint single-height voting generator. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as Input | null) ?? {};
    const validators = typeof task.validators === "number" ? Math.max(1, Math.floor(task.validators)) : 4;
    const faultyCount =
        typeof task.faulty === "number"
            ? Math.min(validators - 1, Math.max(0, Math.floor(task.faulty)))
            : 1;
    const block = typeof task.block === "string" ? task.block : "BLK-42";
    const quorum = tendermintQuorum(validators);
    const honest = validators - faultyCount;
    const safe = validators >= 3 * faultyCount + 1;
    const locked = honest >= quorum;
    const committed = locked && safe;
    const decision = committed ? block : "";
    const faulty = new Set<number>();
    for (let i = validators - faultyCount; i < validators; i += 1) faulty.add(i);
    const base = { rows: 1, cols: validators, validators, faulty: faultyCount, quorum, honest, safe, block };

    let step = 0;
    yield {
        stepNumber: step,
        entities: makeCells(validators, 0, faulty, new Map([[0, "active"]])),
        edges: [],
        description: `Height 1 with ${validators} validators, up to ${faultyCount} faulty; the quorum is ${quorum} (> 2/3).`,
        codeLineNumber: 0,
        layout: "grid",
        meta: { ...base, phase: "setup", locked: "", decision: "" },
    };
    step += 1;

    yield {
        stepNumber: step,
        entities: makeCells(
            validators,
            0,
            faulty,
            new Map(Array.from({ length: validators }, (_, i) => [i, i === 0 ? "active" : faulty.has(i) ? "error" : "comparing"])),
        ),
        edges: [],
        description: `Honest proposer 0 proposes block "${block}" to all validators.`,
        codeLineNumber: 1,
        layout: "grid",
        meta: { ...base, phase: "propose", locked: "", decision: "" },
    };
    step += 1;

    const prevoteStates = new Map<number, EntityState>();
    for (let i = 0; i < validators; i += 1) {
        prevoteStates.set(i, faulty.has(i) ? "error" : locked ? "pivot" : "comparing");
    }
    yield {
        stepNumber: step,
        entities: makeCells(validators, 0, faulty, prevoteStates),
        edges: [],
        description: locked
            ? `${honest} prevotes meet the quorum of ${quorum}; validators lock onto "${block}".`
            : `Only ${honest} prevotes exist, below the quorum of ${quorum}; no block is locked.`,
        codeLineNumber: 2,
        layout: "grid",
        meta: { ...base, phase: "prevote", prevotes: honest, locked: locked ? block : "", decision: "" },
    };
    step += 1;

    const precommitStates = new Map<number, EntityState>();
    for (let i = 0; i < validators; i += 1) {
        precommitStates.set(i, faulty.has(i) ? "error" : locked ? "active" : "unvisited");
    }
    yield {
        stepNumber: step,
        entities: makeCells(validators, 0, faulty, precommitStates),
        edges: [],
        description: locked
            ? `Locked validators send ${honest} precommits, meeting the quorum of ${quorum}.`
            : "Without a prevote lock no validator precommits, so nothing can commit.",
        codeLineNumber: 4,
        layout: "grid",
        meta: { ...base, phase: "precommit", precommits: locked ? honest : 0, locked: locked ? block : "", decision: "" },
    };
    step += 1;

    const commitStates = new Map<number, EntityState>();
    for (let i = 0; i < validators; i += 1) {
        commitStates.set(i, faulty.has(i) ? "error" : committed ? "sorted" : "unvisited");
    }
    yield {
        stepNumber: step,
        entities: makeCells(validators, 0, faulty, commitStates),
        edges: [],
        description: committed
            ? `Decision reached: block "${block}" is committed by all ${honest} honest validators.`
            : "No decision: this configuration cannot safely commit with more than two thirds required.",
        codeLineNumber: 6,
        layout: "grid",
        meta: { ...base, phase: "commit", locked: locked ? block : "", decision, committed },
    };
}

/** The Tendermint single-height module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "Tendermint asks validators to vote twice on a proposed block. A prevote says the block is valid; a precommit says the validator has seen enough prevotes to be willing to commit. Requiring more than two thirds at each stage means any two successful quorums share an honest validator, and an honest validator never votes for two blocks at one height. That overlap is what prevents conflicting commits.",
        invariants: [
            "A commit needs a quorum of prevotes followed by a quorum of precommits.",
            "The quorum is floor(2n/3)+1, which is strictly more than two thirds.",
            "Any two quorums of that size intersect in at least f+1 validators when n is at most 3f+1.",
        ],
        correctness:
            "Suppose two different blocks were committed at the same height. Each has a precommit quorum of more than two thirds of n. Two such sets overlap in at least 2*floor(2n/3)+2-n validators, which is at least f+1 for n >= 3f+1. Since at most f validators are faulty, the overlap contains an honest validator, but an honest validator precommits to only one block per height, a contradiction. The earlier prevote quorum applies the same argument to the lock, so the committed block is the one that gathered the lock.",
        complexityRationale:
            "Each honest validator broadcasts one prevote and one precommit to every other validator, so the protocol sends O(n^2) messages per decision. Each validator stores the votes it received, O(n) space.",
        uses: [
            "Consensus in proof-of-stake blockchains",
            "Replicated state machines in permissioned networks",
            "Teaching BFT safety with more than two thirds quorums",
        ],
        references: [
            "Buchman, Tendermint: Byzantine Fault Tolerance in the Age of Blockchains, 2016",
            "Lamport, Shostak, and Pease, The Byzantine Generals Problem, 1982",
        ],
        workedExample:
            "With four validators and one faulty, the quorum is three. Three honest validators prevote and precommit block BLK-42, so it commits. With three validators and one faulty, the quorum is three but only two are honest, so no lock forms and the round correctly decides nothing.",
    },
    id: "tendermint-consensus",
    name: "Tendermint Consensus (one height)",
    category: "parallel-distributed",
    complexity: { time: "O(n^2) messages", space: "O(n)" },
    defaultInput: { validators: 4, faulty: 1, block: "BLK-42" },
    visualType: "grid",
    run,
    pseudocode: [
        "compute quorum as floor of two n over three plus one",
        "mark faulty validators and select an honest proposer",
        "proposer broadcasts the proposed block",
        "validators prevote after checking the proposal",
        "a validator locks after a prevote quorum",
        "locked validators broadcast precommits",
        "commit the block after a precommit quorum",
        "done: report the committed block or no decision",
    ],
};

export default module;
