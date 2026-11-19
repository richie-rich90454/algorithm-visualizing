/**
 * primary-backup-replication.ts - Primary-Backup Replication
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * In primary-backup replication one replica is the primary and serializes every
 * client operation into a log. It forwards each operation to the backups and
 * only acknowledges after they have appended it. If the primary crashes, a
 * backup is promoted to the new primary using the log it already holds, and it
 * continues serving the remaining operations. Once the old primary recovers it
 * catches up from the new primary, so every replica converges to the same log.
 * The log order is fixed by the primary, so all replicas agree on state.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(1) per operation at the primary plus O(R) forwarding messages
 *   Space: O(m) per replica for a log of m operations
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Grid rows are replicas; columns are operation slots.
 *   - GREEN marks an appended entry, RED a crashed replica, amber the primary.
 *   - meta carries the primary index, logs, and a consistency verdict.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface Input {
    operations?: number[];
    backups?: number;
    failAt?: number;
}

const defaultOperations = [10, 20, 30, 40, 50, 60];

function makeCells(logs: number[][], primary: number, alive: boolean[], activeRow: number, opCount: number): VisualEntity[] {
    const entities: VisualEntity[] = [];
    for (let r = 0; r < logs.length; r += 1) {
        for (let c = 0; c < opCount; c += 1) {
            const value = logs[r]![c] ?? 0;
            const filled = c < logs[r]!.length;
            const state: EntityState = !alive[r] ? "error" : filled ? "sorted" : r === activeRow ? "active" : "idle";
            entities.push({
                id: `cell-${r}-${c}`,
                type: "cell",
                label: filled ? String(value) : "-",
                value,
                state,
                x: 0,
                y: 0,
                width: 0,
                height: 0,
                metadata: { row: r, col: c, filled, value, primary: r === primary, alive: alive[r] },
            });
        }
    }
    return entities;
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as Input | null) ?? {};
    const operations: number[] = Array.isArray(task.operations) ? [...task.operations] : [...defaultOperations];
    const replicas = Math.max(2, Math.min(5, Math.floor((task.backups ?? 2) + 1)));
    const failAt = Math.max(0, Math.min(operations.length, Math.floor(task.failAt ?? 2)));
    const logs: number[][] = Array.from({ length: replicas }, () => []);
    const alive = Array.from({ length: replicas }, () => true);
    let primary = 0;
    let failed = false;
    let step = 0;
    const opCount = Math.max(1, operations.length);

    const consistent = () => {
        const liveLogs = logs.filter((_, i) => alive[i]);
        return liveLogs.every((l) => l.every((v, i) => l[i] === operations[i]));
    };
    const meta = (last: string, activeRow: number) => ({
        replicas,
        operations: operations.length,
        primary,
        failed,
        alive: alive.map((v) => (v ? 1 : 0)),
        logs: logs.map((l) => l.join(",")),
        consistent: consistent(),
        activeRow,
        last,
    });

    yield {
        stepNumber: step++,
        entities: makeCells(logs, primary, alive, -1, opCount),
        edges: [],
        description: `Primary-backup replication with ${replicas} replicas and ${operations.length} operations; replica ${primary} is primary.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: meta("initialized", -1),
    };

    for (let i = 0; i < operations.length; i += 1) {
        if (i === failAt && primary === 0) {
            alive[0] = false;
            failed = true;
            const crash = `Operation ${i}: primary replica 0 crashes; its log holds ${logs[0]!.length} entry(s).`;
            yield {
                stepNumber: step++,
                entities: makeCells(logs, primary, alive, 0, opCount),
                edges: [],
                description: crash,
                codeLineNumber: 3,
                layout: "grid",
                meta: meta(crash, 0),
            };
            primary = 1;
            const promote = `Backup replica 1 is promoted using its existing log and becomes the new primary.`;
            yield {
                stepNumber: step++,
                entities: makeCells(logs, primary, alive, 1, opCount),
                edges: [],
                description: promote,
                codeLineNumber: 4,
                layout: "grid",
                meta: meta(promote, 1),
            };
        }
        const op = operations[i]!;
        logs[primary]!.push(op);
        for (let r = 0; r < replicas; r += 1) {
            if (r !== primary && alive[r]) logs[r]!.push(op);
        }
        const desc = `Operation ${op} appended at primary ${primary} and forwarded to ${replicas - 1} live backup(s).`;
        yield {
            stepNumber: step++,
            entities: makeCells(logs, primary, alive, primary, opCount),
            edges: [],
            description: desc,
            codeLineNumber: 2,
            layout: "grid",
            meta: meta(desc, primary),
        };
    }

    for (let r = 0; r < replicas; r += 1) logs[r] = [...operations];
    alive.fill(true);
    failed = false;
    const done = `Old primary recovered and caught up; all ${replicas} replicas now hold the identical log [${operations.join(", ")}].`;
    yield {
        stepNumber: step,
        entities: makeCells(logs, primary, alive, -1, opCount),
        edges: [],
        description: done,
        codeLineNumber: 6,
        layout: "grid",
        meta: meta(done, -1),
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Pick one copy as the leader and make it write down every change in order, copying each entry to the followers. If the leader dies, promote a follower that already has the written history, so no committed change is lost. When the old leader returns, bring it up to date from the new one. Because one leader chooses the order and everyone copies that order, all copies end up identical.",
        invariants: [
            "Only the current primary assigns positions in the log.",
            "A backup appends an operation only after the primary has assigned it.",
            "Every live replica's log is a prefix of the primary's committed log.",
        ],
        correctness:
            "The primary appends each operation once and forwards it unchanged, so every backup that acknowledges stores the same value at the same log index; a live replica's log is therefore a prefix of the operation sequence in primary order. On failure a backup is promoted from its own log, which contains all previously committed entries because the primary delayed acknowledgement until backups appended them; hence no committed operation is lost. The new primary continues from that prefix, preserving a single total order. Recovery copies the full log to the old primary, so all replicas converge and no state diverges.",
        complexityRationale:
            "Each operation costs constant work at the primary and one message to each of the R-1 backups, O(R) messages per operation. Each replica stores one entry per operation, O(m) space for a log of length m.",
        uses: [
            "Replicated databases and storage systems with a single leader",
            "Coordinating state across servers in a primary-backup cluster",
            "Failover design in traditional enterprise middleware",
        ],
        references: [
            "Budhiraja, Marzullo, Schneider, and Toueg, The Primary-Backup Approach, 1993",
            "Lamport, The Part-Time Parliament, 1998",
        ],
        workedExample:
            "Three replicas start with an empty log and primary P0. Operations 10 and 20 are appended everywhere. P0 crashes before operation 30, so P1 is promoted from its log [10, 20] and appends 30, 40, 50, 60. When P0 returns it copies the full log, leaving all three replicas with [10, 20, 30, 40, 50, 60].",
    },
    id: "primary-backup-replication",
    name: "Primary-Backup Replication",
    category: "parallel-distributed",
    complexity: { time: "O(R) messages per operation", space: "O(m)" },
    defaultInput: { operations: defaultOperations, backups: 2, failAt: 2 },
    visualType: "grid",
    run,
    pseudocode: [
        "elect one replica as the primary",
        "for each client operation in order do",
        "append it to the primary log and forward to backups",
        "backups append and acknowledge the entry",
        "if the primary crashes, promote a backup with the longest log",
        "the new primary continues appending remaining operations",
        "on recovery, copy the full log to the old primary",
        "done: all replicas hold the identical log",
    ],
};

export default module;
