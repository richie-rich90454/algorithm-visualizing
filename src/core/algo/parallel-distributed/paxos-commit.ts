/**
 * paxos-commit.ts - Paxos Commit (atomic commitment with Paxos instances)
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Paxos Commit replaces the blocking coordinator of two-phase commit with one
 * Paxos consensus instance per resource manager. Each manager runs a single
 * decree Paxos vote on "prepared"; a decree is chosen only when a majority of
 * its acceptors respond. The transaction commits exactly when every manager's
 * instance chooses "prepared", and aborts otherwise. No participant can be
 * left blocking on a failed coordinator.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(participants * acceptors) message rounds in one instance
 *   Space: O(participants * acceptors) for the acceptor tables
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Each cell is a resource manager's Paxos instance.
 *   - A cell is yellow while voting, green when it chooses prepared, red on abort.
 *   - The final frame reports the transaction-wide decision.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface PaxosCommitInput {
    participants?: boolean[];
    nodes?: number;
    failed?: number[];
}

/** Build one cell per resource-manager consensus instance. */
function makeCells(
    states: number[],
    active: number,
    phase: "idle" | "vote" | "decided",
): VisualEntity[] {
    return states.map((decision, index) => ({
        id: `rm-${index}`,
        type: "cell" as const,
        label: decision < 0 ? "-" : decision === 1 ? "YES" : "NO",
        value: decision,
        state: (
            phase === "vote" && index === active
                ? "comparing"
                : phase === "idle"
                  ? "idle"
                  : decision === 1
                    ? "sorted"
                    : "error"
        ) as EntityState,
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { row: 0, col: index, decision },
    }));
}

/** The Paxos Commit generator. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as PaxosCommitInput | null) ?? {};
    const participants: boolean[] =
        Array.isArray(task.participants) && task.participants.length > 0
            ? task.participants.map(Boolean)
            : [true, true, true];
    const nodes = typeof task.nodes === "number" && task.nodes >= 1 ? Math.floor(task.nodes) : 5;
    const failed = Array.isArray(task.failed)
        ? task.failed.filter((n) => typeof n === "number" && n >= 0 && n < nodes)
        : [];
    const quorum = Math.floor(nodes / 2) + 1;
    const available = nodes - failed.length;
    const canDecide = available >= quorum;
    const decisions = participants.map(() => -1);
    let step = 0;

    yield {
        stepNumber: step++,
        entities: makeCells(decisions, -1, "idle"),
        edges: [],
        description: `Starting Paxos Commit for ${participants.length} manager(s), ${nodes} acceptors, quorum ${quorum}.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: { rows: 1, cols: participants.length, quorum, available, canDecide, commit: false },
    };

    for (let i = 0; i < participants.length; i += 1) {
        decisions[i] = -1;
        yield {
            stepNumber: step++,
            entities: makeCells(decisions, i, "vote"),
            edges: [],
            description: `Manager ${i} runs a prepare vote over ${available} live acceptor(s).`,
            codeLineNumber: 2,
            layout: "grid",
            meta: { rows: 1, cols: participants.length, quorum, available, canDecide, commit: false, active: i },
        };
        decisions[i] = canDecide && (participants[i] ?? false) ? 1 : 0;
        yield {
            stepNumber: step++,
            entities: makeCells(decisions, i, "decided"),
            edges: [],
            description: canDecide
                ? `Manager ${i} chose ${decisions[i] === 1 ? "prepared" : "abort"}.`
                : `Manager ${i} cannot reach quorum; its instance defaults to abort.`,
            codeLineNumber: 4,
            layout: "grid",
            meta: { rows: 1, cols: participants.length, quorum, available, canDecide, commit: false, active: i },
        };
    }

    const commit = decisions.every((d) => d === 1);
    yield {
        stepNumber: step,
        entities: makeCells(decisions, -1, "decided"),
        edges: [],
        description: commit
            ? "Every manager chose prepared; the transaction commits."
            : "At least one manager chose abort; the transaction aborts.",
        codeLineNumber: 6,
        layout: "grid",
        meta: { rows: 1, cols: participants.length, quorum, available, canDecide, commit, decisions: [...decisions] },
    };
}

/** The Paxos Commit module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "Two-phase commit can block forever if the coordinator dies after participants have voted. Paxos Commit gives every resource manager its own little Paxos election on the single question 'can I prepare?'. Each election only needs a majority, so losing a few acceptors cannot stall it. The transaction commits only when all of those elections answer yes.",
        invariants: [
            "A manager's decree is chosen only after a majority of its acceptors respond.",
            "A manager that cannot reach quorum contributes an abort, never a block.",
            "The global decision is the logical AND of all manager decrees.",
        ],
        correctness:
            "Each manager runs a single-decree Paxos instance, which is safe because Paxos chooses at most one value and only a value that was proposed. Because the proposal is forced to 'abort' whenever a manager votes no or a quorum is unavailable, every chosen yes implies that manager was prepared; the AND of all yes votes therefore implies every manager is prepared, which is exactly the atomic-commitment safety condition. Liveness follows from each instance needing only a majority, independent of any single coordinator.",
        complexityRationale:
            "Each of the m managers runs one consensus instance over a acceptors, so the prepare and accept rounds exchange O(m * a) messages overall. Storing an acceptor table for each instance uses O(m * a) space.",
        uses: [
            "Distributed transactions that must not block on a failed coordinator",
            "Google's Spanner style globally consistent transactions",
            "Replicated state machines needing an atomic commit decision",
        ],
        references: [
            "Lamport, Paxos Commit, 2006",
            "Lamport, The Part-Time Parliament, 1998",
        ],
        workedExample:
            "With three managers, five acceptors, and one failed acceptor, quorum is three and four acceptors remain. If all managers can prepare, all three instances choose yes and the transaction commits. Mark one manager as unable to prepare and its instance chooses no, so the whole transaction aborts.",
    },
    id: "paxos-commit",
    name: "Paxos Commit",
    category: "parallel-distributed",
    complexity: { time: "O(m * a)", space: "O(m * a)" },
    defaultInput: { participants: [true, true, true], nodes: 5, failed: [2] },
    visualType: "grid",
    run,
    pseudocode: [
        "choose a quorum of a majority of acceptors per manager",
        "for each resource manager run a single-decree prepare vote",
        "collect promises from a majority of its acceptors",
        "choose prepared only if the manager voted yes and quorum held",
        "otherwise choose abort for that manager",
        "wait for every manager's decree to be chosen",
        "commit if all decrees are prepared, otherwise abort",
        "done: report the transaction decision",
    ],
};

export default module;
