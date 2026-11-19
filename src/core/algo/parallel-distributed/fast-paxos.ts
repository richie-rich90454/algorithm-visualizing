/**
 * fast-paxos.ts - Fast Paxos (One Round Trip Decision)
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Fast Paxos lets a client propose a value directly to acceptors in a single
 * fast round. A value is chosen immediately if enough acceptors report the same
 * value (a fast quorum, larger than a majority). If conflicting values appear
 * or too few matching replies arrive, a coordinator falls back to a classic
 * Paxos recovery round that selects the highest accepted value.
 *
 * This deterministic teaching simulation models both outcomes and the values
 * each acceptor holds.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(N) messages in the fast round, O(N) more on recovery
 *   Space: O(N) for acceptor state
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - One grid cell per acceptor shows the value it accepted.
 *   - Matching accepts are green, conflicting accepts amber, silence gray.
 *   - The final cell state shows whether the fast path or recovery decided.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

export interface FastPaxosData {
    acceptors: number;
    fastQuorum: number;
    value: number;
    accepts: number;
    conflicts: number;
    silent: number;
    fastChosen: boolean;
    recoveryValue: number;
    finalValue: number;
    held: number[];
}

/** Deterministic Fast Paxos fast round with optional classic recovery. */
export function simulateFastPaxos(
    acceptors: number,
    fastQuorum: number,
    value: number,
    accepts: number,
    conflictValues: number[],
): FastPaxosData {
    const n = Math.max(1, Math.floor(acceptors));
    const conflicts = Math.min(n, Math.max(0, conflictValues.length));
    const fq = Math.min(n, Math.max(1, Math.floor(fastQuorum)));
    const matching = Math.min(Math.max(0, Math.floor(accepts)), n - conflicts);
    const silent = n - matching - conflicts;
    const fastChosen = matching >= fq;
    const candidates = [...conflictValues.slice(0, conflicts)];
    if (matching > 0) candidates.push(value);
    const recoveryValue = candidates.length > 0 ? Math.max(...candidates) : -1;
    const held = [
        ...Array<number>(matching).fill(value),
        ...conflictValues.slice(0, conflicts),
        ...Array<number>(silent).fill(-1),
    ];
    return {
        acceptors: n,
        fastQuorum: fq,
        value,
        accepts: matching,
        conflicts,
        silent,
        fastChosen,
        recoveryValue,
        finalValue: fastChosen ? value : recoveryValue,
        held,
    };
}

/** Grid cells, one per acceptor. */
function makeCells(data: FastPaxosData, states: EntityState[]): VisualEntity[] {
    return data.held.map((value, index) => ({
        id: `acceptor-${index}`,
        type: "cell" as const,
        label: value === -1 ? "silent" : String(value),
        value,
        state: states[index] ?? "idle",
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { index, row: Math.floor(index / 5), col: index % 5, held: value },
    }));
}

/** The Fast Paxos generator. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as {
        acceptors?: number; fastQuorum?: number; value?: number;
        accepts?: number; conflictValues?: number[];
    } | null) ?? {};
    const data = simulateFastPaxos(
        task.acceptors ?? 5,
        task.fastQuorum ?? 4,
        task.value ?? 7,
        task.accepts ?? 4,
        Array.isArray(task.conflictValues) ? task.conflictValues : [9],
    );

    yield {
        stepNumber: 0,
        entities: makeCells(data, Array<EntityState>(data.acceptors).fill("idle")),
        edges: [],
        description: `Fast Paxos with ${data.acceptors} acceptors; a value needs ${data.fastQuorum} matching fast accepts to be chosen in one round trip.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: { acceptors: data.acceptors, fastQuorum: data.fastQuorum, phase: "setup", chosen: 0 },
    };

    const fastStates: EntityState[] = data.held.map((value) =>
        value === -1 ? "idle" : value === data.value ? "sorted" : "comparing",
    );
    yield {
        stepNumber: 1,
        entities: makeCells(data, fastStates),
        edges: [],
        description: `Fast round: ${data.accepts} accept(s) for ${data.value}, ${data.conflicts} conflicting value(s), and ${data.silent} silent acceptor(s).`,
        codeLineNumber: 1,
        layout: "grid",
        meta: {
            acceptors: data.acceptors,
            fastQuorum: data.fastQuorum,
            accepts: data.accepts,
            conflicts: data.conflicts,
            phase: "fast",
            chosen: 0,
        },
    };

    if (!data.fastChosen) {
        const recoveryStates: EntityState[] = data.held.map((value) => (value === -1 ? "unvisited" : "active"));
        yield {
            stepNumber: 2,
            entities: makeCells(data, recoveryStates),
            edges: [],
            description: `Fast quorum not reached; a coordinator collects the highest accepted value, ${data.recoveryValue}, in a classic recovery round.`,
            codeLineNumber: 3,
            layout: "grid",
            meta: { acceptors: data.acceptors, phase: "recovery", recoveryValue: data.recoveryValue, chosen: 0 },
        };
    }

    const finalStates: EntityState[] = data.held.map((value) => {
        if (value === data.finalValue) return "sorted";
        return value === -1 ? "unvisited" : "active";
    });
    yield {
        stepNumber: data.fastChosen ? 2 : 3,
        entities: makeCells(data, finalStates),
        edges: [],
        description: data.fastChosen
            ? `Fast path succeeded: value ${data.finalValue} is chosen with ${data.accepts} matching accepts.`
            : `Recovery decided: value ${data.finalValue} is chosen after the fallback round.`,
        codeLineNumber: 5,
        layout: "grid",
        meta: {
            acceptors: data.acceptors,
            phase: "done",
            fastChosen: data.fastChosen ? 1 : 0,
            finalValue: data.finalValue,
            chosen: 1,
        },
    };
}

/** The Fast Paxos module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "A normal Paxos decision needs a leader and two message rounds. Fast Paxos skips the leader: a client broadcasts its value and, if enough acceptors reply with that same value, the decision is already final. When replies disagree, a coordinator runs an ordinary round to pick the highest value that was accepted, which keeps Paxos safety.",
        invariants: [
            "A fast decision needs a quorum larger than a simple majority.",
            "Only values actually accepted by an acceptor enter the recovery candidates.",
            "Recovery always proposes the highest value seen among responding acceptors.",
        ],
        correctness:
            "If matching accepts reach the fast quorum, any two fast quorums intersect in at least one acceptor holding the same value, so two different values cannot both be chosen on the fast path. If the fast round fails, the classic recovery round inherits Paxos's quorum-intersection argument and picks the highest accepted value, which is the only safe choice. Both paths therefore preserve agreement and validity.",
        complexityRationale:
            "One broadcast to N acceptors and their replies cost O(N) messages on the fast path. A failed fast round adds one classic Paxos round, still O(N). Each acceptor stores a single accepted value, O(N) space.",
        uses: [
            "Reducing decision latency in wide-area replicated state machines",
            "High-throughput transaction ordering when conflicts are rare",
            "Teaching the latency versus quorum-size trade-off in consensus",
        ],
        references: [
            "Lamport, Fast Paxos, Distributed Computing 19, 2006",
            "Lamport, Paxos Made Simple, 2001",
        ],
        workedExample:
            "With five acceptors and a fast quorum of four, a client proposing 7 that receives four accepts for 7 decides immediately in one round trip. If only three accept 7 while two hold 9 and 2, the fast quorum is missed and recovery chooses the highest accepted value, 9.",
    },
    id: "fast-paxos",
    name: "Fast Paxos",
    category: "parallel-distributed",
    complexity: { time: "O(N) messages", space: "O(N)" },
    defaultInput: { acceptors: 5, fastQuorum: 4, value: 7, accepts: 4, conflictValues: [9] },
    visualType: "grid",
    run,
    pseudocode: [
        "client broadcasts value v to all acceptors in a fast round",
        "each acceptor accepts the first value it sees",
        "count matching accepts for v",
        "if the count reaches the fast quorum declare v chosen",
        "otherwise start a classic recovery round",
        "collect the highest value accepted by a majority",
        "propose and choose that highest value",
        "done: report the chosen value and which path decided it",
    ],
};

export default module;
