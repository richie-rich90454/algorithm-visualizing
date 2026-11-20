/**
 * two-phase-commit.ts - Two-Phase Commit Protocol
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Two-phase commit lets a coordinator and a set of participants agree on a
 * single outcome for a distributed transaction. In the prepare phase every
 * participant votes yes or no; in the commit phase the coordinator tells
 * everyone to commit only if all votes were yes, otherwise everyone aborts.
 * The protocol guarantees that no participant commits while another aborts.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(n) messages in each of the two phases for n participants
 *   Space: O(n) to hold the votes at the coordinator
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - The coordinator and participants are graph nodes with directed edges.
 *   - A node being asked to vote is yellow; a yes vote is green, a no red.
 *   - The final frame is green for commit and red for abort.
 */

import type { AlgorithmModule, EntityState, VisualEdge, VisualEntity, VisualFrame } from "@/types";

/** Build the coordinator and participant nodes for a vote state. */
function makeNodes(votes: boolean[], states: Map<number, EntityState>): VisualEntity[] {
    const nodes: VisualEntity[] = [
        {
            id: "coordinator",
            type: "node" as const,
            label: "C",
            value: "coordinator",
            state: "active",
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: { role: "coordinator" },
        },
    ];
    for (let i = 0; i < votes.length; i += 1) {
        nodes.push({
            id: `participant-${i}`,
            type: "node" as const,
            label: `P${i}`,
            value: `participant-${i}`,
            state: states.get(i) ?? "unvisited",
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: { role: "participant", index: i, vote: votes[i] ? "yes" : "no" },
        });
    }
    return nodes;
}

/** Build the coordinator-to-participant edges, highlighting one if given. */
function makeEdges(n: number, active: number | null, state: EntityState): VisualEdge[] {
    const edges: VisualEdge[] = [];
    for (let i = 0; i < n; i += 1) {
        edges.push({
            id: `edge-${i}`,
            sourceId: "coordinator",
            targetId: `participant-${i}`,
            label: "",
            state: i === active ? state : "idle",
            directed: true,
        });
    }
    return edges;
}

/** The two-phase commit generator. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { votes?: boolean[] } | null) ?? {};
    const votes = Array.isArray(task.votes) && task.votes.length > 0
        ? task.votes.map(Boolean)
        : [true, true, true];
    const n = votes.length;
    const decision = votes.every(Boolean) ? "commit" : "abort";
    let frame = 0;

    yield {
        stepNumber: frame,
        entities: makeNodes(votes, new Map()),
        edges: makeEdges(n, null, "idle"),
        description: `Two-phase commit with ${n} participant(s); the coordinator waits for every vote.`,
        codeLineNumber: 0,
        layout: "graph",
        meta: { phase: "start", votes: votes.map((v) => (v ? "yes" : "no")), decision: "pending", committed: 0 },
    };
    frame += 1;

    for (let i = 0; i < n; i += 1) {
        const states = new Map<number, EntityState>();
        for (let j = 0; j < i; j += 1) {
            states.set(j, votes[j] ? "sorted" : "error");
        }
        states.set(i, "comparing");
        yield {
            stepNumber: frame,
            entities: makeNodes(votes, states),
            edges: makeEdges(n, i, "active"),
            description: `Prepare phase: participant ${i} votes "${votes[i] ? "yes" : "no"}".`,
            codeLineNumber: 1,
            layout: "graph",
            meta: {
                phase: "prepare",
                votes: votes.map((v) => (v ? "yes" : "no")),
                decision: "pending",
                committed: 0,
            },
        };
        frame += 1;
    }

    const allStates = new Map<number, EntityState>();
    for (let i = 0; i < n; i += 1) {
        allStates.set(i, votes[i] ? "sorted" : "error");
    }
    yield {
        stepNumber: frame,
        entities: makeNodes(votes, allStates),
        edges: makeEdges(n, null, "idle"),
        description: `Coordinator decides ${decision}: ${decision === "commit" ? "all votes were yes" : "at least one vote was no"}.`,
        codeLineNumber: 3,
        layout: "graph",
        meta: {
            phase: "decision",
            votes: votes.map((v) => (v ? "yes" : "no")),
            decision,
            committed: 0,
        },
    };
    frame += 1;

    const committedCount = decision === "commit" ? n : 0;
    for (let i = 0; i < n; i += 1) {
        const states = new Map<number, EntityState>();
        for (let j = 0; j < n; j += 1) {
            if (decision === "commit") {
                states.set(j, j <= i ? "sorted" : "unvisited");
            } else {
                states.set(j, j <= i ? "error" : "unvisited");
            }
        }
        yield {
            stepNumber: frame,
            entities: makeNodes(votes, states),
            edges: makeEdges(n, i, decision === "commit" ? "sorted" : "error"),
            description: `Commit phase: participant ${i} is told to ${decision}.`,
            codeLineNumber: 5,
            layout: "graph",
            meta: {
                phase: "commit",
                votes: votes.map((v) => (v ? "yes" : "no")),
                decision,
                committed: decision === "commit" ? i + 1 : 0,
            },
        };
        frame += 1;
    }

    const finalStates = new Map<number, EntityState>();
    for (let i = 0; i < n; i += 1) {
        finalStates.set(i, decision === "commit" ? "sorted" : "error");
    }
    yield {
        stepNumber: frame,
        entities: makeNodes(votes, finalStates),
        edges: makeEdges(n, null, decision === "commit" ? "sorted" : "error"),
        description: `Transaction finished: ${decision} at all ${n} participant(s).`,
        codeLineNumber: 7,
        layout: "graph",
        meta: {
            phase: "done",
            votes: votes.map((v) => (v ? "yes" : "no")),
            decision,
            committed: committedCount,
        },
    };
}

/** The two-phase commit module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "Ask everyone whether they can commit before anyone actually does. If all participants vote yes the coordinator broadcasts commit; if even one votes no it broadcasts abort. The two phases separate the decision from the action so a participant never commits on its own.",
        invariants: [
            "A commit message is sent only when every prepare vote was yes.",
            "Every participant that votes no forces a global abort.",
            "All reachable participants apply the same final decision.",
        ],
        correctness:
            "The coordinator chooses commit exactly when all votes are yes and abort otherwise, so the decision is a function of the full vote set. Every participant that completed the prepare phase applies that single decision. Therefore no participant commits while another aborts, which is the atomicity property the protocol is designed to guarantee under its stated failure assumptions.",
        complexityRationale:
            "The coordinator sends one prepare and one decision message to each of the n participants, so O(n) messages in each phase and O(n) messages overall. It stores one vote per participant, which is O(n) space.",
        uses: [
            "Distributed database transactions across multiple shards",
            "Coordinated updates in distributed file systems",
            "Atomic deployment decisions in transaction monitors",
        ],
        references: [
            "Gray, Notes on Database Operating Systems, 1978",
            "Bernstein and Newcomer, Principles of Distributed Database Systems, Chapter 8",
        ],
        workedExample:
            "With three participants voting yes, yes, yes the coordinator commits and all three store the new value. If the second participant votes no, the coordinator aborts and none of the three stores it.",
    },
    id: "two-phase-commit",
    name: "Two-Phase Commit",
    category: "parallel-distributed",
    complexity: { time: "O(n)", space: "O(n)" },
    defaultInput: { votes: [true, true, true] },
    visualType: "graph",
    run,
    pseudocode: [
        "coordinator sends prepare to all participants",
        "for each participant collect its yes or no vote",
        "if any participant votes no remember that fact",
        "if all votes are yes decide commit, otherwise abort",
        "send the decision to all participants",
        "each participant applies commit or abort locally",
        "coordinator records the completed outcome",
        "done: all participants share the same decision",
    ],
};

export default module;
