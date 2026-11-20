/**
 * message-logging-recovery.ts - Message-Logging Recovery by Deterministic Replay
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Message-logging recovery records every message a process receives in a
 * stable log. After a crash the process restores its most recent checkpoint
 * and replays the logged messages in the same order, reconstructing exactly the
 * state it had before the failure. This module simulates that replay for a
 * small system where each message carries an integer state change.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(M log M) to order the logs, O(M) to replay
 *   Space: O(M + P)
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Grid rows are processes and columns are positions in their message log.
 *   - A replayed message cell turns green; the one being replayed is yellow.
 *   - Idle cells are messages that have not been replayed yet.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

type LogMessage = { id: number; from: number; to: number; seq: number; delta: number };
type RecoveryInput = {
    processes?: number;
    checkpointState?: number[];
    messages?: LogMessage[];
    failed?: number;
};

function makeGrid(
    logs: LogMessage[][],
    states: Map<string, EntityState>,
): VisualEntity[] {
    const entities: VisualEntity[] = [];
    logs.forEach((log, process) => {
        log.forEach((message, slot) => {
            const id = `cell-${process}-${slot}`;
            entities.push({
                id,
                type: "cell" as const,
                label: `${message.delta >= 0 ? "+" : ""}${message.delta}`,
                value: message.delta,
                state: states.get(id) ?? "idle",
                x: 0,
                y: 0,
                width: 0,
                height: 0,
                metadata: { row: process, col: slot, messageId: message.id, delta: message.delta },
            });
        });
    });
    return entities;
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as RecoveryInput | null) ?? {};
    const processes = typeof task.processes === "number" ? Math.max(1, Math.min(6, task.processes)) : 3;
    const checkpointState: number[] = Array.isArray(task.checkpointState)
        ? [...task.checkpointState]
        : [10, 20, 30];
    const messages: LogMessage[] = Array.isArray(task.messages)
        ? task.messages.map((m) => ({ ...m }))
        : [
              { id: 1, from: 0, to: 1, seq: 1, delta: 3 },
              { id: 2, from: 2, to: 1, seq: 2, delta: -2 },
              { id: 3, from: 1, to: 0, seq: 1, delta: 5 },
              { id: 4, from: 0, to: 2, seq: 1, delta: 4 },
              { id: 5, from: 1, to: 2, seq: 2, delta: -1 },
          ];
    const failed = typeof task.failed === "number" ? Math.max(0, Math.min(processes - 1, task.failed)) : 1;

    const logs: LogMessage[][] = Array.from({ length: processes }, () => []);
    for (const message of messages) {
        if (message.to >= 0 && message.to < processes) {
            logs[message.to]?.push(message);
        }
    }
    logs.forEach((log) => log.sort((a, b) => a.seq - b.seq || a.id - b.id));

    const states: number[] = Array.from({ length: processes }, (_, p) => checkpointState[p] ?? 0);
    const visualStates = new Map<string, EntityState>();
    let step = 0;

    yield {
        stepNumber: step,
        entities: makeGrid(logs, visualStates),
        edges: [],
        description: `Process ${failed} crashed; restoring checkpoint value ${states[failed]} and replaying ${logs[failed]?.length ?? 0} logged message(s).`,
        codeLineNumber: 0,
        layout: "grid",
        meta: { failed, states: [...states], replayed: 0, total: logs.reduce((sum, log) => sum + log.length, 0) },
    };
    step += 1;

    for (let p = 0; p < processes; p += 1) {
        const log = logs[p] ?? [];
        for (let slot = 0; slot < log.length; slot += 1) {
            const message = log[slot] as LogMessage;
            const id = `cell-${p}-${slot}`;
            visualStates.set(id, "comparing");
            states[p] = (states[p] ?? 0) + message.delta;
            const replayed = logs.slice(0, p + 1).reduce((sum, l) => sum + l.length, 0) + slot + 1;

            yield {
                stepNumber: step,
                entities: makeGrid(logs, visualStates),
                edges: [],
                description: `Process ${p} replays message ${message.id} (sequence ${message.seq}, delta ${message.delta}); state becomes ${states[p]}.`,
                codeLineNumber: p === failed ? 3 : 5,
                layout: "grid",
                meta: { failed, states: [...states], replayed, current: id, delta: message.delta },
            };
            step += 1;
            visualStates.set(id, p === failed ? "sorted" : "visited");
        }
    }

    yield {
        stepNumber: step,
        entities: makeGrid(logs, visualStates),
        edges: [],
        description: `Recovery complete: process ${failed} reconstructed state ${states[failed]} from its checkpoint and log.`,
        codeLineNumber: 6,
        layout: "grid",
        meta: { failed, states: [...states], replayed: logs.reduce((sum, log) => sum + log.length, 0), recovered: states[failed] },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "A checkpoint is a saved snapshot and a message log is the list of events since that snapshot. Replaying the log in the original order is deterministic, so a crashed process can rebuild its old state exactly instead of asking other processes to resend their state.",
        invariants: [
            "Messages for each process are replayed in increasing sequence order.",
            "Each logged message is applied exactly once during recovery.",
            "The reconstructed state equals the checkpoint value plus the sum of logged deltas.",
        ],
        correctness:
            "Because the log records every received message in order and replay applies the same deterministic state transitions in that order, the replay reaches the same state the process held before the crash. Summing the deltas gives the same value, which the final frame reports.",
        complexityRationale:
            "Sorting each process's log costs O(M log M) in total across M messages, and replay applies each message once, O(M). The logs and the P process states require O(M + P) space.",
        uses: [
            "Crash recovery in message-passing runtimes",
            "Deterministic replay for debugging distributed failures",
            "Fault-tolerant stream processing with persistent logs",
        ],
        references: [
            "Elnozahy, Alvisi, Wang, and Johnson, A Survey of Rollback-Recovery Protocols, 2002",
            "Birman and van Renesse, Reliable Distributed Systems, Chapter 4",
        ],
        workedExample:
            "Process 1 checkpointed at value 20 and logged messages with deltas plus 3 then minus 2. After a crash it restores 20, replays plus 3 to reach 23, then minus 2 to reach 21, which is exactly the state it held before failing.",
    },
    id: "message-logging-recovery",
    name: "Message-Logging Recovery (Deterministic Replay)",
    category: "parallel-distributed",
    complexity: { time: "O(M log M)", space: "O(M + P)" },
    defaultInput: {
        processes: 3,
        checkpointState: [10, 20, 30],
        failed: 1,
        messages: [
            { id: 1, from: 0, to: 1, seq: 1, delta: 3 },
            { id: 2, from: 2, to: 1, seq: 2, delta: -2 },
            { id: 3, from: 1, to: 0, seq: 1, delta: 5 },
            { id: 4, from: 0, to: 2, seq: 1, delta: 4 },
            { id: 5, from: 1, to: 2, seq: 2, delta: -1 },
        ],
    },
    visualType: "grid",
    run,
    pseudocode: [
        "restore each process's most recent checkpoint value",
        "group logged messages by receiving process",
        "sort each process's log by sequence number",
        "for every message in the failed process's log",
        "apply the message delta to the restored state",
        "mark the message as replayed",
        "verify the reconstructed state against the log sum",
        "done: report the recovered state",
    ],
};

export default module;
