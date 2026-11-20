/**
 * coordinated-checkpointing.ts - Coordinated Global Checkpointing
 *
 * All processes stop at the same logical round boundary and record a local
 * checkpoint. Because every message sent in an earlier round was delivered
 * within that round, no message crosses the global cut, so the recorded state
 * is consistent. The module contrasts that coordinated cut with a skewed cut
 * in which one process has advanced further than its neighbor.
 *
 * The simulation uses synchronous rounds with one message per process per
 * round. It does not model asynchronous channels, marker propagation delays,
 * or the cascade of dependent checkpoints needed in uncoordinated protocols.
 *
 * Time:  O(processes * rounds)
 * Space: O(processes + messages)
 */

import type { AlgorithmModule, VisualEntity, VisualFrame } from "@/types";

interface Task {
    processes?: number;
    rounds?: number;
    checkpointRound?: number;
}

interface Message {
    round: number;
    from: number;
    to: number;
}

function makeBars(completed: number[], label: string): VisualEntity[] {
    return completed.map((value, i) => ({
        id: `proc-${i}`,
        type: "bar" as const,
        label: `P${i}: ${label} ${value}`,
        value,
        state: "idle",
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { index: i, completed: value, label },
    }));
}

/** Count messages sent before the sender's cut but received after the receiver's. */
function inTransit(messages: Message[], cut: number[]): Message[] {
    return messages.filter((m) => m.round <= (cut[m.from] ?? 0) && m.round > (cut[m.to] ?? 0));
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as Task | null) ?? {};
    const processes = Math.min(8, Math.max(2, Math.floor(Number(task.processes ?? 4)) || 4));
    const rounds = Math.min(10, Math.max(1, Math.floor(Number(task.rounds ?? 4)) || 4));
    const ckpt = Math.min(rounds, Math.max(1, Math.floor(Number(task.checkpointRound ?? Math.ceil(rounds / 2)) || 1)));
    const messages: Message[] = [];
    for (let r = 1; r <= rounds; r += 1) {
        for (let i = 0; i < processes; i += 1) {
            messages.push({ round: r, from: i, to: (i + 1) % processes });
        }
    }

    let step = 0;
    yield {
        stepNumber: step,
        entities: makeBars(new Array<number>(processes).fill(0), "round"),
        edges: [],
        description: `${processes} processes exchange one message per round for ${rounds} rounds; checkpoint at round ${ckpt}.`,
        codeLineNumber: 0,
        layout: "array",
        meta: { processes, rounds, checkpointRound: ckpt, messageCount: messages.length, round: 0 },
    };
    step += 1;

    for (let r = 1; r <= rounds; r += 1) {
        yield {
            stepNumber: step,
            entities: makeBars(new Array<number>(processes).fill(r), "round"),
            edges: [],
            description: `Round ${r}: every process sends to its successor and all ${processes} messages are delivered synchronously.`,
            codeLineNumber: r === ckpt ? 3 : 2,
            layout: "array",
            meta: { processes, rounds, checkpointRound: ckpt, round: r, delivered: processes, checkpointTaken: r === ckpt },
        };
        step += 1;
    }

    const coordinated = new Array<number>(processes).fill(ckpt);
    const skewed = coordinated.slice();
    skewed[0] = ckpt;
    for (let i = 1; i < processes; i += 1) skewed[i] = ckpt - 1;
    const good = inTransit(messages, coordinated);
    const bad = inTransit(messages, skewed);

    yield {
        stepNumber: step,
        entities: makeBars(coordinated, "checkpoint"),
        edges: [],
        description: `Coordinated cut at round ${ckpt}: ${good.length} message(s) cross the cut, so the global state is consistent.`,
        codeLineNumber: 4,
        layout: "array",
        meta: { processes, checkpointRound: ckpt, cut: [...coordinated], inTransit: good.length, consistent: good.length === 0 },
    };
    step += 1;

    yield {
        stepNumber: step,
        entities: makeBars(skewed, "checkpoint"),
        edges: [],
        description: `Skewed cut: process 0 advanced but its successor did not, leaving ${bad.length} message(s) in transit.`,
        codeLineNumber: 5,
        layout: "array",
        meta: { processes, checkpointRound: ckpt, cut: [...skewed], inTransit: bad.length, consistent: bad.length === 0 },
    };
    step += 1;

    yield {
        stepNumber: step,
        entities: makeBars(coordinated, "checkpoint"),
        edges: [],
        description: `Coordinated checkpointing yields a consistent cut with ${good.length} in-transit messages; the skewed cut has ${bad.length}.`,
        codeLineNumber: 6,
        layout: "array",
        meta: { processes, rounds, checkpointRound: ckpt, coordinatedInTransit: good.length, skewedInTransit: bad.length, consistent: good.length === 0 },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "A global checkpoint is a stack of local checkpoints, one per process. It is useful only if no message was sent before the sender's checkpoint and received after the receiver's. Coordinated checkpointing avoids that problem by having everyone stop at the same round boundary, so every in-flight message from an earlier round has already been delivered everywhere.",
        invariants: [
            "Each process sends exactly one message per round.",
            "A coordinated cut records the same round at every process.",
            "The coordinated cut has zero messages in transit by construction.",
        ],
        correctness:
            "Messages in round r are delivered synchronously within round r. For the coordinated cut every process has completed exactly rounds up to the checkpoint round, so any message with round at most the checkpoint has been received by a process whose cut is also at least that round; hence the in-transit set is empty. For the skewed cut the successor's cut is one round behind, so the message from the advanced process to that successor is in transit. The test recomputes both sets independently.",
        complexityRationale:
            "The schedule contains one message per process per round, so building it and scanning a cut take O(processes times rounds) time and space. The frames hold only the small per-process cut vectors.",
        uses: [
            "Fault-tolerant rollback recovery in distributed systems",
            "Consistent snapshots for debugging long-running computations",
            "A teaching contrast with uncoordinated and communication-induced checkpointing",
        ],
        references: [
            "Chandy and Lamport, Distributed Snapshots, 1985",
            "Elnozahy, Alvisi, Wang, and Johnson, A Survey of Rollback-Recovery Protocols, 2002",
        ],
        workedExample:
            "With four processes and a checkpoint after round 2, every process records completed round 2 and no message crosses the cut. If process 0 alone records round 2 while process 1 records round 1, the message process 0 sent to process 1 during round 2 is in transit, so that cut is inconsistent.",
    },
    id: "coordinated-checkpointing",
    name: "Coordinated Checkpointing",
    category: "parallel-distributed",
    complexity: { time: "O(processes * rounds)", space: "O(processes * rounds)" },
    defaultInput: { processes: 4, rounds: 4, checkpointRound: 2 },
    visualType: "array",
    run,
    pseudocode: [
        "read the process count, round count, and checkpoint round",
        "build the list of messages sent in each round",
        "advance all processes round by round until the checkpoint",
        "form a coordinated cut with the same round at every process",
        "count messages crossing that cut",
        "form a skewed cut and count its crossing messages",
        "report which cut is consistent",
    ],
};

export default module;
