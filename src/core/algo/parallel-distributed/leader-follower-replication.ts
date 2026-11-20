/**
 * leader-follower-replication.ts - Leader/Follower Log Replication
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * A single leader accepts new entries, appends them to its log, and sends them
 * to followers. An entry becomes committed once a quorum of replicas has
 * stored it; the leader then tells the followers the commit index so they can
 * apply the entry to their state machines. Followers that acknowledged late
 * simply catch up on the next message. This module simulates that protocol
 * with a fixed acknowledgment order so every replay is deterministic.
 *
 * ---------------------------------------------------------------------------
 * Scope of the model
 * ---------------------------------------------------------------------------
 * The simulation records append and commit events but does not model elections,
 * terms, network partitions, or disk persistence. All listed followers are
 * assumed alive; the quorum parameter controls how many acknowledgments are
 * required before an entry is applied.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(f * e) messages for f followers and e entries
 *   Space: O((f+1) * e) for the replicated logs
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Rows are replicas (row 0 is the leader); columns are log positions.
 *   - Committed entries are green, appended but pending entries are yellow.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

type ReplicationInput = {
    followers?: number;
    entries?: number[];
    quorum?: number;
    ackOrder?: number[];
};

function makeCells(
    logs: number[][],
    commitIndex: number,
    highlight: string,
): VisualEntity[] {
    const entities: VisualEntity[] = [];
    for (let replica = 0; replica < logs.length; replica += 1) {
        for (let slot = 0; slot < (logs[replica] as number[]).length; slot += 1) {
            const id = `log-${replica}-${slot}`;
            const committed = slot < commitIndex;
            entities.push({
                id,
                type: "cell" as const,
                label: String((logs[replica] as number[])[slot]),
                value: (logs[replica] as number[])[slot],
                state: id === highlight ? "comparing" : committed ? "sorted" : "active",
                x: 0,
                y: 0,
                width: 0,
                height: 0,
                metadata: { row: replica, col: slot, replica, committed },
            });
        }
    }
    return entities;
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as ReplicationInput | null) ?? {};
    const entries: number[] = Array.isArray(task.entries) ? [...task.entries] : [10, 20, 30, 40];
    const followers = typeof task.followers === "number" ? Math.max(1, Math.min(5, task.followers)) : 2;
    const quorum = typeof task.quorum === "number" ? Math.max(1, Math.min(followers + 1, task.quorum)) : 2;
    const ackOrder: number[] = Array.isArray(task.ackOrder) && task.ackOrder.length > 0
        ? task.ackOrder
        : Array.from({ length: followers }, (_, i) => i + 1);

    const replicas = followers + 1;
    const logs: number[][] = Array.from({ length: replicas }, () => []);
    let commitIndex = 0;
    let step = 0;

    yield {
        stepNumber: step,
        entities: makeCells(logs, commitIndex, ""),
        edges: [],
        description: `One leader and ${followers} follower(s); ${entries.length} entries to replicate with quorum ${quorum}.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: { replicas, quorum, entries: entries.length, commitIndex, committed: 0 },
    };
    step += 1;

    for (let e = 0; e < entries.length; e += 1) {
        const entry = entries[e] as number;
        (logs[0] as number[]).push(entry);
        let acks = 1;

        yield {
            stepNumber: step,
            entities: makeCells(logs, commitIndex, `log-0-${e}`),
            edges: [],
            description: `Leader appends entry ${entry} at index ${e}; ${acks} acknowledgment(s) counted.`,
            codeLineNumber: 2,
            layout: "grid",
            meta: { replicas, quorum, entries: entries.length, commitIndex, committed: commitIndex, acks, entry },
        };
        step += 1;

        for (const follower of ackOrder) {
            const index = Math.max(1, Math.min(replicas - 1, follower));
            (logs[index] as number[]).push(entry);
            acks += 1;
            const justCommitted = acks >= quorum && commitIndex === e;
            if (justCommitted) {
                commitIndex = e + 1;
            }
            yield {
                stepNumber: step,
                entities: makeCells(logs, commitIndex, `log-${index}-${e}`),
                edges: [],
                description: `Follower ${index} appended entry ${entry}; ${acks} acknowledgment(s)${justCommitted ? ", quorum reached, entry committed" : ", waiting for quorum"}.`,
                codeLineNumber: justCommitted ? 5 : 4,
                layout: "grid",
                meta: { replicas, quorum, entries: entries.length, commitIndex, committed: commitIndex, acks, entry },
            };
            step += 1;
        }

        if (commitIndex !== e + 1) {
            yield {
                stepNumber: step,
                entities: makeCells(logs, commitIndex, ""),
                edges: [],
                description: `Entry ${entry} was not committed; quorum of ${quorum} was not reached.`,
                codeLineNumber: 6,
                layout: "grid",
                meta: { replicas, quorum, entries: entries.length, commitIndex, committed: commitIndex, acks, entry },
            };
            step += 1;
        }
    }

    yield {
        stepNumber: step,
        entities: makeCells(logs, commitIndex, ""),
        edges: [],
        description: `Replication finished: ${commitIndex} of ${entries.length} entries committed across ${replicas} replicas.`,
        codeLineNumber: 7,
        layout: "grid",
        meta: {
            replicas,
            quorum,
            entries: entries.length,
            commitIndex,
            committed: commitIndex,
            logs,
            complete: commitIndex === entries.length,
        },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Write to one leader so there is a single order of updates, then copy that order to followers. You do not need every replica to respond before applying an entry; a majority-sized quorum is enough to guarantee that any future leader also has the entry.",
        invariants: [
            "The leader appends entries in client order and never reorders its log.",
            "A follower's log is always a prefix of the leader's log.",
            "An entry is applied only after the acknowledgment count reaches the quorum.",
        ],
        correctness:
            "Every replica copies entries from the same leader in the same order, so all logs are prefixes of the leader log. Quorum intersection means any later leader chosen from a majority must contain every committed entry. Therefore committed entries are durable and identical across replicas.",
        complexityRationale:
            "Each of the e entries is sent to each of the f followers once, requiring O(f * e) messages. Storing a log of e entries at each of f+1 replicas uses O((f+1) * e) space.",
        uses: [
            "Replicating state machine commands in Raft and Paxos implementations",
            "Database primary-replica write propagation",
            "Configuration stores that need a durable ordered log",
        ],
        references: [
            "Ongaro and Ousterhout, In Search of an Understandable Consensus Algorithm, 2014",
            "Lamport, The Part-Time Parliament, 1998",
        ],
        workedExample:
            "With a leader, two followers, and quorum two, appending value 7 counts the leader's own ack plus the first follower's ack. The entry commits immediately and the second follower catches up on the next message, so all three logs end with 7 at index zero.",
    },
    id: "leader-follower-replication",
    name: "Leader/Follower Log Replication",
    category: "parallel-distributed",
    complexity: { time: "O(f*e)", space: "O((f+1)*e)" },
    defaultInput: { followers: 2, entries: [10, 20, 30, 40], quorum: 2, ackOrder: [1, 2] },
    visualType: "grid",
    run,
    pseudocode: [
        "leader waits for client commands",
        "append the new entry to the leader log",
        "send the entry to every follower",
        "each follower appends and acknowledges",
        "when acknowledgments reach the quorum commit the entry",
        "send the commit index to followers",
        "apply committed entries to the state machine",
        "done: all replicas share the committed log",
    ],
};

export default module;
