/**
 * practical-byzantine-fault-tolerance.ts - Practical Byzantine Fault Tolerance (small model)
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * PBFT keeps a replicated service correct even when some replicas behave
 * arbitrarily. A primary assigns a sequence number to a request, backups run
 * a PRE-PREPARE / PREPARE / COMMIT protocol, and a replica accepts a request
 * only after collecting 2f+1 matching messages in both the prepare and commit
 * phases. Because at most f of any 2f+1 set can be faulty, at least f+1 honest
 * replicas agree, which makes the decision safe.
 *
 * ---------------------------------------------------------------------------
 * Scope of the model
 * ---------------------------------------------------------------------------
 * This is a SMALL DETERMINISTIC SIMULATION, not a production PBFT stack. It
 * models the message-count and quorum logic in a single view with an honest
 * primary; Byzantine replicas simply withhold their messages, the weakest
 * useful fault model. It omits view changes, checkpoints, authenticated
 * message digests, and network asynchrony. The quorum arithmetic shown is
 * exact: with n replicas and at most f faulty, safety requires n >= 3f+1.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(n^2) messages (each of n replicas talks to all others twice)
 *   Space: O(n) for per-replica message logs
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Replicas are cells; the primary starts yellow and faulty replicas are red.
 *   - Replicas that gathered a prepare quorum are purple, committed ones green.
 *   - The final frame reports the agreed value or "no decision".
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

/** Toy digest of a request string, deterministic and easy to inspect. */
function digest(text: string): string {
    let hash = 2166136261;
    for (let i = 0; i < text.length; i += 1) {
        hash ^= text.charCodeAt(i);
        hash = Math.imul(hash, 16777619) >>> 0;
    }
    return (hash >>> 0).toString(16).padStart(8, "0");
}

function makeCells(
    replicas: number,
    faulty: Set<number>,
    states: Map<number, EntityState> = new Map(),
): VisualEntity[] {
    const cells: VisualEntity[] = [];
    for (let i = 0; i < replicas; i += 1) {
        const state = states.get(i) ?? (faulty.has(i) ? "error" : "unvisited");
        cells.push({
            id: `replica-${i}`,
            type: "cell",
            label: i === 0 ? `0 (primary)` : String(i),
            value: i,
            state,
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: { row: 0, col: i, replica: i, faulty: faulty.has(i) },
        });
    }
    return cells;
}

/** Practical Byzantine Fault Tolerance generator (single-view simulation). */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (
        input as { replicas?: number; faulty?: number; request?: string } | null
    ) ?? {};
    const replicas =
        typeof task.replicas === "number" ? Math.max(1, Math.floor(task.replicas)) : 4;
    const faultyCount =
        typeof task.faulty === "number"
            ? Math.min(replicas - 1, Math.max(0, Math.floor(task.faulty)))
            : 1;
    const request = typeof task.request === "string" ? task.request : "SET x=7";
    const quorum = 2 * faultyCount + 1;
    const faulty = new Set<number>();
    for (let i = replicas - faultyCount; i < replicas; i += 1) faulty.add(i);
    const honest = replicas - faultyCount;
    const safe = replicas >= 3 * faultyCount + 1;
    const prepared = honest >= quorum;
    const requestDigest = digest(request);

    let step = 0;
    const baseMeta = {
        rows: 1,
        cols: replicas,
        replicas,
        faulty: faultyCount,
        quorum,
        honest,
        digest: requestDigest,
    };

    yield {
        stepNumber: step,
        entities: makeCells(replicas, faulty, new Map([[0, "active"]])),
        edges: [],
        description: `Starting with ${replicas} replicas, up to ${faultyCount} faulty; quorum is ${quorum} and ${honest} replicas are honest.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: { ...baseMeta, phase: "setup", decision: "" },
    };
    step += 1;

    yield {
        stepNumber: step,
        entities: makeCells(
            replicas,
            faulty,
            new Map(
                Array.from({ length: replicas }, (_, i) => [
                    i,
                    i === 0 ? "active" : faulty.has(i) ? "error" : "comparing",
                ]),
            ),
        ),
        edges: [],
        description: `Primary 0 broadcasts PRE-PREPARE with sequence number 1 and digest ${requestDigest}.`,
        codeLineNumber: 2,
        layout: "grid",
        meta: { ...baseMeta, phase: "pre-prepare", decision: "" },
    };
    step += 1;

    const prepareStates = new Map<number, EntityState>();
    for (let i = 0; i < replicas; i += 1) {
        if (faulty.has(i)) prepareStates.set(i, "error");
        else prepareStates.set(i, prepared ? "visited" : "comparing");
    }
    yield {
        stepNumber: step,
        entities: makeCells(replicas, faulty, prepareStates),
        edges: [],
        description: prepared
            ? `Each honest replica gathers ${honest} matching PREPARE messages, meeting the quorum of ${quorum}.`
            : `Only ${honest} honest PREPARE messages exist, below the quorum of ${quorum}; no replica is prepared.`,
        codeLineNumber: 4,
        layout: "grid",
        meta: {
            ...baseMeta,
            phase: "prepare",
            prepares: honest,
            decision: "",
        },
    };
    step += 1;

    const commitStates = new Map<number, EntityState>();
    for (let i = 0; i < replicas; i += 1) {
        if (faulty.has(i)) commitStates.set(i, "error");
        else commitStates.set(i, prepared ? "active" : "unvisited");
    }
    yield {
        stepNumber: step,
        entities: makeCells(replicas, faulty, commitStates),
        edges: [],
        description: prepared
            ? `Prepared replicas gather ${honest} matching COMMIT messages, meeting the quorum of ${quorum}.`
            : "Without a prepare quorum no correct replica sends COMMIT, so nothing can commit.",
        codeLineNumber: 5,
        layout: "grid",
        meta: {
            ...baseMeta,
            phase: "commit",
            commits: prepared ? honest : 0,
            decision: "",
        },
    };
    step += 1;

    const finalStates = new Map<number, EntityState>();
    for (let i = 0; i < replicas; i += 1) {
        finalStates.set(i, faulty.has(i) ? "error" : prepared ? "sorted" : "unvisited");
    }
    const decision = prepared && safe ? request : null;
    yield {
        stepNumber: step,
        entities: makeCells(replicas, faulty, finalStates),
        edges: [],
        description: decision
            ? `Decision reached: all ${honest} honest replicas execute "${request}".`
            : "No decision: the configuration cannot tolerate this many faulty replicas safely.",
        codeLineNumber: 6,
        layout: "grid",
        meta: { ...baseMeta, phase: "done", decision: decision ?? "", safe, executed: decision !== null },
    };
}

/** The PBFT module (small deterministic quorum model). */
const module: AlgorithmModule = {
    education: {
        intuition:
            "Ask every replica to report the request it saw in two separate rounds. If enough replicas - more than two thirds - report the same thing, every correct replica can be sure that at least one honest replica in that group saw the primary's genuine proposal. The second round stops a faulty primary from telling different replicas different stories.",
        invariants: [
            "Any set of 2f+1 replicas contains at least f+1 honest replicas.",
            "Two different values cannot both gather 2f+1 matching prepares when at most f replicas are faulty.",
            "A replica executes a request only after both a prepare and a commit quorum.",
        ],
        correctness:
            "Suppose two conflicting requests both prepared. Their prepare sets each have 2f+1 members out of n, and n is at most 3f+1 for the tight case, so the two sets overlap in at least f+1 replicas. At least one of those is honest, and an honest replica prepares only one value per sequence number, a contradiction. The commit phase repeats the argument for replicas that may have prepared at different times, so all honest replicas execute the same request.",
        complexityRationale:
            "Each honest replica sends a PREPARE and a COMMIT to every other replica, so the protocol exchanges O(n^2) messages per request. Each replica stores the messages it has received, which is O(n) space.",
        uses: [
            "Byzantine-tolerant ordering in permissioned blockchains",
            "Replication in permissioned distributed databases",
            "Replicated state machines that must survive arbitrary node faults",
        ],
        references: [
            "Castro and Liskov, Practical Byzantine Fault Tolerance, 1999",
            "Lamport, Shostak, and Pease, The Byzantine Generals Problem, 1982",
        ],
        workedExample:
            "With four replicas and one faulty, the quorum is three. Three honest replicas send matching PREPARE and COMMIT messages, so the value is executed. With only two replicas and one faulty the quorum of three is unreachable and the protocol correctly refuses to decide.",
    },
    id: "practical-byzantine-fault-tolerance",
    name: "Practical Byzantine Fault Tolerance",
    category: "parallel-distributed",
    complexity: { time: "O(n^2) messages", space: "O(n)" },
    defaultInput: { replicas: 4, faulty: 1, request: "SET x=7" },
    visualType: "grid",
    run,
    pseudocode: [
        "compute quorum as two f plus one and mark faulty replicas",
        "primary assigns a sequence number and broadcasts PRE-PREPARE",
        "each honest replica broadcasts PREPARE with the request digest",
        "a replica is prepared after quorum matching PREPARE messages",
        "prepared replicas broadcast COMMIT with the same digest",
        "a replica commits after quorum matching COMMIT messages",
        "done: execute the request if a decision was reached",
    ],
};

export default module;
