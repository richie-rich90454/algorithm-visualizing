/**
 * cas-paxos.ts - CAS Paxos (Compare-and-Swap Register)
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * CAS Paxos implements a single compare-and-swap register with a Paxos-like
 * protocol. A proposer runs a prepare round to recover the highest-ballot value
 * already accepted by a quorum, compares it with the expected value, and only
 * then drives an accept round that installs the replacement value.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(operations * N) messages for N acceptors
 *   Space: O(N) for the per-acceptor promise and accepted state
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - One bar shows the value each acceptor has accepted (-1 means none).
 *   - A prepare round is yellow, an accept round is green, a failed CAS is red.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface CasOp {
    expected: number;
    next: number;
}

interface Acceptor {
    promised: number;
    acceptedBallot: number;
    acceptedValue: number;
}

/** Build one bar per acceptor showing what value it has accepted. */
function makeAcceptorBars(acceptors: Acceptor[], state: EntityState): VisualEntity[] {
    return acceptors.map((acceptor, index) => ({
        id: `acceptor-${index}`,
        type: "bar" as const,
        label: acceptor.acceptedBallot === 0 ? "none" : String(acceptor.acceptedValue),
        value: acceptor.acceptedValue,
        state,
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { index, promised: acceptor.promised, ballot: acceptor.acceptedBallot },
    }));
}

/** Replay a sequence of compare-and-swap operations through a Paxos register. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { acceptors?: number; initial?: number; operations?: CasOp[] } | null) ?? {};
    const count =
        typeof task.acceptors === "number" ? Math.max(1, Math.floor(task.acceptors)) : 3;
    const initial = typeof task.initial === "number" ? task.initial : 0;
    const operations: CasOp[] = Array.isArray(task.operations)
        ? task.operations.map((op) => ({
              expected: Number(op?.expected) || 0,
              next: Number(op?.next) || 0,
          }))
        : [
              { expected: 0, next: 1 },
              { expected: 0, next: 9 },
              { expected: 1, next: 5 },
              { expected: 5, next: 7 },
          ];

    const acceptors: Acceptor[] = Array.from({ length: count }, () => ({
        promised: 0,
        acceptedBallot: 0,
        acceptedValue: initial,
    }));
    let current = initial;
    let successes = 0;
    const chosen: number[] = [];

    yield {
        stepNumber: 0,
        entities: makeAcceptorBars(acceptors, "idle"),
        edges: [],
        description: `CAS register initialized to ${initial} across ${count} acceptor(s).`,
        codeLineNumber: 0,
        layout: "array",
        meta: { current, successes, operation: 0, accepted: chosen.slice() },
    };

    let step = 1;
    for (let opIndex = 0; opIndex < operations.length; opIndex += 1) {
        const op = operations[opIndex];
        if (!op) {
            continue;
        }
        const ballot = opIndex + 1;

        // Prepare round: every acceptor promises not to accept older ballots.
        for (const acceptor of acceptors) {
            if (ballot > acceptor.promised) {
                acceptor.promised = ballot;
            }
        }
        let bestBallot = -1;
        let recovered = current;
        for (const acceptor of acceptors) {
            if (acceptor.acceptedBallot > bestBallot) {
                bestBallot = acceptor.acceptedBallot;
                recovered = acceptor.acceptedValue;
            }
        }
        if (bestBallot < 0) {
            recovered = current;
        }
        current = recovered;

        yield {
            stepNumber: step,
            entities: makeAcceptorBars(acceptors, "comparing"),
            edges: [],
            description: `Operation ${opIndex + 1}: prepare at ballot ${ballot} recovers value ${current} from the acceptors.`,
            codeLineNumber: 2,
            layout: "array",
            meta: { current, successes, operation: opIndex + 1, accepted: chosen.slice() },
        };
        step += 1;

        if (current !== op.expected) {
            yield {
                stepNumber: step,
                entities: makeAcceptorBars(acceptors, "error"),
                edges: [],
                description: `Compare failed: expected ${op.expected} but found ${current}, so the register is unchanged.`,
                codeLineNumber: 4,
                layout: "array",
                meta: { current, successes, operation: opIndex + 1, accepted: chosen.slice() },
            };
            step += 1;
            continue;
        }

        // Accept round: a quorum installs the replacement value.
        for (const acceptor of acceptors) {
            acceptor.acceptedBallot = ballot;
            acceptor.acceptedValue = op.next;
        }
        current = op.next;
        successes += 1;
        chosen.push(op.next);
        yield {
            stepNumber: step,
            entities: makeAcceptorBars(acceptors, "sorted"),
            edges: [],
            description: `Compare succeeded: a quorum accepts ${op.next} at ballot ${ballot}, replacing ${op.expected}.`,
            codeLineNumber: 6,
            layout: "array",
            meta: { current, successes, operation: opIndex + 1, accepted: chosen.slice() },
        };
        step += 1;
    }

    yield {
        stepNumber: step,
        entities: makeAcceptorBars(acceptors, "sorted"),
        edges: [],
        description: `Final register value ${current} after ${successes} successful compare-and-swap(s).`,
        codeLineNumber: 6,
        layout: "array",
        meta: { current, successes, operation: operations.length, accepted: chosen.slice() },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Treat a distributed register like a compare-and-swap instruction: replace the stored value only if it still equals what the caller expects. Prepare rounds recover the last chosen value from a quorum, and accept rounds install a new one under a fresh ballot. A stale expected value causes the operation to fail without changing the register.",
        invariants: [
            "Each acceptor promises ballots no smaller than the one it has already promised.",
            "The prepare round recovers the value with the highest accepted ballot in the quorum.",
            "The register changes only when the recovered value equals the expected value.",
        ],
        correctness:
            "Paxos safety guarantees that at most one value can be chosen for a given ballot, so a prepare round always reveals the current chosen value. The proposer therefore compares against the true state, and a successful accept installs the replacement atomically from the perspective of later rounds. Failed compares leave every acceptor's accepted value untouched, so the abstract register behaves exactly like a single-process compare-and-swap.",
        complexityRationale:
            "Each operation uses one prepare round and at most one accept round, each touching N acceptors, so the message cost is O(N) per operation. State is O(N) for the promises and accepted values stored at the acceptors.",
        uses: [
            "Distributed locks and leader election backed by a compare-and-swap register",
            "Consistent key-value stores exposing conditional updates",
            "Coordination primitives such as fences and unique claim records",
        ],
        references: [
            "Herlihy, CAS Paxos: Replicated State Machines without Logs, 2018",
            "Lamport, Paxos Made Simple, 2001",
        ],
        workedExample:
            "Start at 0. The operation CAS(0,1) prepares, recovers 0, and installs 1. CAS(0,9) recovers 1, so it fails and leaves 1 in place. CAS(1,5) then succeeds, and CAS(5,7) succeeds, ending at 7 after three successes.",
    },
    id: "cas-paxos",
    name: "CAS Paxos",
    category: "parallel-distributed",
    complexity: { time: "O(operations * N)", space: "O(N)" },
    defaultInput: {
        acceptors: 3,
        initial: 0,
        operations: [
            { expected: 0, next: 1 },
            { expected: 0, next: 9 },
            { expected: 1, next: 5 },
            { expected: 5, next: 7 },
        ],
    },
    visualType: "array",
    run,
    pseudocode: [
        "initialize every acceptor with the starting value",
        "for each compare-and-swap operation with a fresh ballot",
        "send prepare and recover the highest-ballot accepted value",
        "if the recovered value differs from the expected value, reject",
        "otherwise send accept with the replacement value",
        "collect a quorum of accepts and commit the replacement",
        "done: report the final register value and success count",
    ],
};

export default module;
