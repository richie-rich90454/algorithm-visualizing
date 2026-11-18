/**
 * three-phase-commit.ts - Three-Phase Commit (toy simulation)
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Three-phase commit extends two-phase commit with a pre-commit phase so that
 * participants can infer the likely global decision if the coordinator fails.
 * A coordinator drives canCommit, preCommit, and doCommit phases; every phase
 * collects votes from all participants before the next phase begins.
 *
 * This is a deterministic, failure-free simulation of the message flow, not a
 * production transaction coordinator.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(participants) phases of three message rounds
 *   Space: O(participants) for votes and decisions
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - The coordinator and participants are grid cells.
 *   - A voting participant is yellow; a yes vote is green, a no vote is red.
 *   - The final decision is reported in the metadata.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

/** Build coordinator and participant cells. */
function makeCells(
    votes: boolean[],
    voteStates: Map<number, EntityState>,
    decision: "pending" | "commit" | "abort",
): VisualEntity[] {
    const coordinator: VisualEntity = {
        id: "coordinator",
        type: "cell" as const,
        label: "C",
        value: "coordinator",
        state: decision === "pending" ? "active" : "sorted",
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { row: 0, col: 0, role: "coordinator" },
    };
    const participants = votes.map((vote, index) => ({
        id: `participant-${index}`,
        type: "cell" as const,
        label: vote ? "Y" : "N",
        value: vote ? 1 : 0,
        state:
            decision === "commit"
                ? ("sorted" as EntityState)
                : decision === "abort"
                  ? ("error" as EntityState)
                  : (voteStates.get(index) ?? "idle"),
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { row: 0, col: index + 1, role: "participant", vote: vote ? 1 : 0 },
    }));
    return [coordinator, ...participants];
}

/** The three-phase commit generator. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { votes?: boolean[] } | null) ?? {};
    const votes: boolean[] =
        Array.isArray(task.votes) && task.votes.length > 0
            ? task.votes.map((vote) => vote === true)
            : [true, true, true, true];
    const total = votes.length;
    const yesVotes = votes.filter(Boolean).length;
    const allYes = yesVotes === total;
    const decision: "commit" | "abort" = allYes ? "commit" : "abort";

    let step = 0;
    yield {
        stepNumber: step,
        entities: makeCells(votes, new Map(), "pending"),
        edges: [],
        description: `Starting three-phase commit with ${total} participant(s) and their prepared votes.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: { rows: 1, cols: total + 1, phase: "start", yesVotes, total, decision: "pending", committed: false },
    };
    step += 1;

    yield {
        stepNumber: step,
        entities: makeCells(votes, new Map(), "pending"),
        edges: [],
        description: "Phase 1: the coordinator sends CANCOMMIT to every participant.",
        codeLineNumber: 1,
        layout: "grid",
        meta: { rows: 1, cols: total + 1, phase: "canCommit", yesVotes, total, decision: "pending", committed: false },
    };
    step += 1;

    for (let index = 0; index < total; index += 1) {
        const states = new Map<number, EntityState>([[index, votes[index] ? "comparing" : "error"]]);
        yield {
            stepNumber: step,
            entities: makeCells(votes, states, "pending"),
            edges: [],
            description: `Phase 1: participant ${index} votes ${votes[index] ? "yes" : "no"}.`,
            codeLineNumber: 2,
            layout: "grid",
            meta: { rows: 1, cols: total + 1, phase: "canCommit", yesVotes, total, decision: "pending", committed: false },
        };
        step += 1;
    }

    if (!allYes) {
        yield {
            stepNumber: step,
            entities: makeCells(votes, new Map(), "abort"),
            edges: [],
            description: `Only ${yesVotes} of ${total} voted yes, so the coordinator globally aborts.`,
            codeLineNumber: 3,
            layout: "grid",
            meta: { rows: 1, cols: total + 1, phase: "abort", yesVotes, total, decision: "abort", committed: false },
        };
        return;
    }

    yield {
        stepNumber: step,
        entities: makeCells(votes, new Map(), "pending"),
        edges: [],
        description: "Phase 2: all voted yes, so the coordinator sends PRECOMMIT.",
        codeLineNumber: 4,
        layout: "grid",
        meta: { rows: 1, cols: total + 1, phase: "preCommit", yesVotes, total, decision: "pending", committed: false },
    };
    step += 1;

    for (let index = 0; index < total; index += 1) {
        const states = new Map<number, EntityState>([[index, "visited"]]);
        yield {
            stepNumber: step,
            entities: makeCells(votes, states, "pending"),
            edges: [],
            description: `Phase 2: participant ${index} acknowledges the precommit.`,
            codeLineNumber: 5,
            layout: "grid",
            meta: { rows: 1, cols: total + 1, phase: "preCommit", yesVotes, total, decision: "pending", committed: false },
        };
        step += 1;
    }

    yield {
        stepNumber: step,
        entities: makeCells(votes, new Map(), "pending"),
        edges: [],
        description: "Phase 3: all precommits acknowledged, so the coordinator sends DOCOMMIT.",
        codeLineNumber: 6,
        layout: "grid",
        meta: { rows: 1, cols: total + 1, phase: "doCommit", yesVotes, total, decision: "pending", committed: false },
    };
    step += 1;

    yield {
        stepNumber: step,
        entities: makeCells(votes, new Map(), "commit"),
        edges: [],
        description: `All ${total} participant(s) committed; the transaction is complete.`,
        codeLineNumber: 7,
        layout: "grid",
        meta: { rows: 1, cols: total + 1, phase: "done", yesVotes, total, decision: "commit", committed: true },
    };
}

/** The three-phase commit module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "Two-phase commit can leave participants stuck if the coordinator dies after they vote yes. Three-phase commit inserts a precommit phase: once everyone has precommitted, a participant knows the global decision must be commit, even if the coordinator later fails.",
        invariants: [
            "No phase advances until every participant has responded to the current phase.",
            "A single no vote forces a global abort in the first phase.",
            "All participants that finish reach the same global decision.",
        ],
        correctness:
            "The coordinator only issues PRECOMMIT when every participant voted yes, and only issues DOCOMMIT when every participant acknowledged the precommit. If any vote is no, it aborts immediately. Therefore all participants that reach a decision see the same value: commit only when all voted yes, abort otherwise.",
        complexityRationale:
            "Each of the three phases exchanges one request and one response per participant, so message and time cost is O(participants) per phase, with O(participants) space to hold the votes and decisions.",
        uses: [
            "Distributed transaction coordination in databases",
            "Atomic commitment across replicated services",
            "A teaching step between two-phase commit and consensus",
        ],
        references: [
            "Skeen, A Formal Model of Crash Recovery in a Distributed System, 1983",
            "Bernstein and Newcomer, Principles of Distributed Transaction Processing, Chapter 8",
        ],
        workedExample:
            "With four participants all voting yes, the coordinator sends CANCOMMIT, receives four yes votes, sends PRECOMMIT, receives four acknowledgments, then sends DOCOMMIT and every participant commits. If even one votes no, the coordinator aborts after phase 1.",
    },
    id: "three-phase-commit",
    name: "Three-Phase Commit",
    category: "parallel-distributed",
    complexity: { time: "O(participants)", space: "O(participants)" },
    defaultInput: { votes: [true, true, true, true] },
    visualType: "grid",
    run,
    pseudocode: [
        "collect a prepared vote from each participant",
        "phase one: coordinator sends canCommit",
        "each participant replies with a yes or no vote",
        "if any vote is no, globally abort and finish",
        "phase two: coordinator sends preCommit",
        "each participant acknowledges the precommit",
        "phase three: coordinator sends doCommit",
        "each participant commits the transaction",
        "done: report the global decision",
    ],
};

export default module;
