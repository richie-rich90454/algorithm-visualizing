/**
 * log-cabin.ts - LogCabin Replication and Failover (teaching simulation)
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * LogCabin replicates a log with a strong leader: the leader appends an entry,
 * waits for a majority of replicas, then reports the entry committed. When the
 * leader fails, a new election chooses the replica with the longest log, and
 * that leader first brings every other replica up to its log before accepting
 * new entries. Because a committed entry was stored on a majority, at least one
 * majority member survives and carries the committed prefix into the new term.
 *
 * This is a deterministic teaching simulation of the replication and failover
 * rules. It does not model real time, randomized election timeouts, heartbeats,
 * or persistent storage failures.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(entries * replicas) simulated message steps
 *   Space: O(replicas * entries) for the replica logs
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Grid cells (replica, log slot) show the stored entry, zero when empty.
 *   - The active leader row is yellow, committed cells are green.
 *   - meta carries the term, leader, commit index, and all replica logs.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

function makeCells(logs: number[][], cols: number, leader: number, committed: number, phase: string): VisualEntity[] {
    const entities: VisualEntity[] = [];
    for (let row = 0; row < logs.length; row += 1) {
        for (let col = 0; col < cols; col += 1) {
            const value = logs[row]?.[col] ?? 0;
            let state: EntityState = "unvisited";
            if (value !== 0) state = row === leader && phase !== "failed" ? "comparing" : "idle";
            if (col < committed && value !== 0) state = "sorted";
            if (phase === "failed" && row === leader) state = "error";
            entities.push({
                id: `cell-${row}-${col}`,
                type: "cell" as const,
                label: value === 0 ? "-" : String(value),
                value,
                state,
                x: 0,
                y: 0,
                width: 0,
                height: 0,
                metadata: { row, col, replica: row, slot: col },
            });
        }
    }
    return entities;
}

/** Simulate leader replication, a crash, and recovery in a replicated log. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { replicas?: number; entries?: number[]; failAfter?: number } | null) ?? {};
    const replicas = typeof task.replicas === "number" ? Math.max(3, Math.floor(task.replicas)) : 5;
    const entries: number[] = Array.isArray(task.entries) && task.entries.length > 0
        ? task.entries.map((value) => Number(value) || 0)
        : [1, 2, 3, 4, 5];
    const failAfter = typeof task.failAfter === "number"
        ? Math.max(1, Math.min(entries.length - 1, Math.floor(task.failAfter)))
        : 3;
    const quorum = Math.floor(replicas / 2) + 1;
    const cols = entries.length;

    const logs: number[][] = Array.from({ length: replicas }, () => []);
    let term = 1;
    let leader = 0;
    let committed = 0;
    let step = 0;

    const frame = (phase: string, description: string, codeLine: number): VisualFrame => ({
        stepNumber: step,
        entities: makeCells(logs, cols, leader, committed, phase),
        edges: [],
        description,
        codeLineNumber: codeLine,
        layout: "grid",
        meta: {
            rows: replicas,
            cols,
            phase,
            term,
            leader,
            committed,
            quorum,
            logs: logs.map((log) => log.join(",")),
        },
    });

    yield frame("init", `Starting with ${replicas} replicas and ${entries.length} log entries.`, 0);
    step += 1;

    for (let index = 0; index < failAfter; index += 1) {
        const entry = entries[index] ?? 0;
        for (let id = 0; id < quorum; id += 1) {
            if ((logs[id]?.length ?? 0) <= index) logs[id]!.push(entry);
        }
        committed = index + 1;
        yield frame("replicate", `Term ${term}: leader ${leader} committed entry ${entry} on a quorum of ${quorum}.`, 2);
        step += 1;
    }

    yield frame("failed", `Leader ${leader} fails after ${committed} committed entr${committed === 1 ? "y" : "ies"}.`, 3);
    step += 1;

    let longest = -1;
    for (let id = 0; id < replicas; id += 1) {
        if (id === leader) continue;
        if ((logs[id]?.length ?? 0) > longest) {
            longest = logs[id]?.length ?? 0;
            leader = id;
        }
    }
    term += 1;
    yield frame("elected", `Term ${term}: replica ${leader} wins the election with the longest log of ${longest} entries.`, 4);
    step += 1;

    for (let id = 0; id < replicas; id += 1) {
        while ((logs[id]?.length ?? 0) < longest) logs[id]!.push(entries[logs[id]!.length] ?? 0);
    }
    yield frame("catchup", `The new leader brings every replica up to the ${longest}-entry committed prefix.`, 5);
    step += 1;

    for (let index = longest; index < entries.length; index += 1) {
        const entry = entries[index] ?? 0;
        for (let id = 0; id < replicas; id += 1) {
            if ((logs[id]?.length ?? 0) < index + 1) logs[id]!.push(entry);
        }
        committed = index + 1;
        yield frame("append", `Term ${term}: leader ${leader} appended entry ${entry}, committed through slot ${committed - 1}, and lagging replicas caught up.`, 6);
        step += 1;
    }

    yield frame("done", `All ${replicas} replicas hold the ${entries.length}-entry committed log.`, 6);
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "A replicated log is only useful if every surviving replica agrees on the committed prefix. The leader writes to a majority before calling an entry committed, which guarantees that any future majority overlaps the one that stored it. After a crash the replica with the longest log wins, because it must contain every committed entry, and it first copies its prefix to the others before accepting new writes.",
        invariants: [
            "An entry is counted as committed only after a majority of replicas store it.",
            "Any two majorities intersect, so a committed entry survives in at least one replica.",
            "The leader always holds the longest log during a failover.",
        ],
        correctness:
            "Suppose an entry at slot k was committed in term t. The majority that acknowledged it shares at least one replica with the majority consulted by any later election, so that replica still stores the entry. A candidate missing the entry has a shorter log than that replica and cannot win the longest-log election. Thus the new leader contains every committed entry, and copying its log to all replicas restores agreement before new appends begin.",
        complexityRationale:
            "Each entry is appended to a majority of replicas, so one round costs O(replicas) message steps and the whole stream costs O(entries times replicas). Storing all logs takes O(replicas times entries) space.",
        uses: [
            "Replicated state machines and configuration services",
            "Durable write-ahead logs in distributed databases",
            "A teaching model for leader-based consensus failover",
        ],
        references: [
            "Ongaro and Ousterhout, In Search of an Understandable Consensus Algorithm, 2014",
            "LogCabin project documentation, logcabin.io",
        ],
        workedExample:
            "With five replicas and entries one through five, leader zero commits one, two and three on replicas zero, one and two, then fails. Replica one has the longest log and wins term two, copies the three-entry prefix to everyone, and then commits four and five. All replicas end with the same five-entry log.",
    },
    id: "log-cabin",
    name: "LogCabin Replication",
    category: "parallel-distributed",
    complexity: { time: "O(entries * replicas)", space: "O(replicas * entries)" },
    defaultInput: { replicas: 5, entries: [1, 2, 3, 4, 5], failAfter: 3 },
    visualType: "grid",
    run,
    pseudocode: [
        "initialize empty logs on every replica and elect the first leader",
        "for each new entry append it on a majority and mark it committed",
        "if the leader fails, start a new term and an election",
        "choose the candidate with the longest log as the new leader",
        "copy the leader prefix to every lagging replica",
        "append the remaining entries through a new majority",
        "done: report the agreed committed log on all replicas",
    ],
};

export default module;
