/**
 * change-data-capture.ts - Change Data Capture into a Materialized Replica
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Change data capture reads a database's write-ahead log and turns each row
 * change into an ordered change event. Replaying those events in log sequence
 * order builds a materialized replica of the table. Each event records the
 * before and after image of the affected key, and the last applied log
 * sequence number is the checkpoint from which streaming can resume.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(c log c + c) for c log records (sort by sequence, then apply each)
 *   Space: O(k) for the materialized table of k keys
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - The materialized table is drawn as a two-column grid of key/value cells.
 *   - The cells touched by the latest change are highlighted; a deleted row
 *     disappears from the grid.
 *   - Frame metadata carries the change event and the last applied sequence
 *     number so the replay can be checked step by step.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

type ChangeOp = "INSERT" | "UPDATE" | "DELETE";

interface Change {
    seq: number;
    op: ChangeOp;
    key: string;
    value: string;
}

const VALID_OPS: ChangeOp[] = ["INSERT", "UPDATE", "DELETE"];

function makeTable(table: Map<string, string>, highlightKey: string | null, state: EntityState): VisualEntity[] {
    const rows = [...table.entries()];
    const entities: VisualEntity[] = [];
    for (const [row, [key, value]] of rows.entries()) {
        const touched = key === highlightKey;
        entities.push({
            id: `cell-key-${row}`,
            type: "cell" as const,
            label: key,
            value: key,
            state: touched ? "comparing" : state,
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: { row, col: 0, key, field: "key" },
        });
        entities.push({
            id: `cell-value-${row}`,
            type: "cell" as const,
            label: value,
            value,
            state: touched ? "comparing" : state,
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: { row, col: 1, key, field: "value" },
        });
    }
    return entities;
}

function frameFor(
    step: number,
    table: Map<string, string>,
    highlightKey: string | null,
    state: EntityState,
    description: string,
    codeLine: number,
    extra: object,
): VisualFrame {
    return {
        stepNumber: step,
        entities: makeTable(table, highlightKey, state),
        edges: [],
        description,
        codeLineNumber: codeLine,
        layout: "grid",
        meta: {
            rows: Math.max(1, table.size),
            cols: 2,
            table: [...table.entries()].map(([k, v]) => `${k}=${v}`),
            ...extra,
        },
    };
}

/** The change data capture generator. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { changes?: Change[] } | null) ?? {};
    const raw: Change[] = Array.isArray(task.changes) ? task.changes : [];
    const changes = raw
        .filter((c) => c && typeof c.key === "string" && VALID_OPS.includes(c.op))
        .map((c) => ({
            seq: Math.max(0, Math.floor(Number(c.seq))),
            op: c.op,
            key: String(c.key),
            value: String(c.value ?? ""),
        }))
        .sort((a, b) => a.seq - b.seq);

    const table = new Map<string, string>();
    const events: string[] = [];
    let lastLsn = 0;
    let step = 0;

    yield frameFor(step, table, null, "idle", "Starting with an empty replica and an empty CDC stream.", 0, {
        applied: 0,
        lastLsn,
        events: [],
    });
    step += 1;

    for (const change of changes) {
        const before = table.get(change.key);
        let after = before;
        if (change.op === "DELETE") {
            table.delete(change.key);
            after = undefined;
        } else {
            table.set(change.key, change.value);
            after = change.value;
        }
        lastLsn = Math.max(lastLsn, change.seq);
        const event = `lsn=${change.seq} ${change.op} ${change.key} ${before ?? "null"}->${after ?? "null"}`;
        events.push(event);

        yield frameFor(
            step,
            table,
            change.op === "DELETE" ? null : change.key,
            "sorted",
            `Applied ${change.op} on ${change.key} at LSN ${change.seq}; ${before ?? "no prior value"} became ${after ?? "removed"}.`,
            change.op === "DELETE" ? 4 : 3,
            { applied: events.length, lastLsn, event, events: [...events] },
        );
        step += 1;
    }

    yield frameFor(
        step,
        table,
        null,
        "sorted",
        `Replay complete: ${events.length} change event(s) applied, checkpoint at LSN ${lastLsn}.`,
        6,
        { applied: events.length, lastLsn, events: [...events], done: true },
    );
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Instead of copying a whole database table, a capture process watches the write-ahead log and publishes a small event for every insert, update, or delete. A consumer replays those events in log order to build a replica. Because each event carries the row before and after the change, the consumer always knows exactly how to move the replica from one consistent state to the next, and the last log number tells it where to resume.",
        invariants: [
            "Changes are applied in nondecreasing log sequence number order.",
            "Each event's after image equals the replica value for that key after replay.",
            "The last applied sequence number is the maximum sequence processed so far.",
        ],
        correctness:
            "Sorting by log sequence number reconstructs the same order in which the source applied the transactions, and each event applies exactly one row operation. By induction over that order, after replaying the first i events the replica equals the source table at that point: a delete removes the key, and an insert or update writes the event's after image. The checkpoint is therefore a safe resume point, because every earlier event has already been reflected.",
        complexityRationale:
            "Sorting c captured records costs O(c log c) and replaying them costs O(c) map operations, giving O(c log c) time. The replica stores at most one value per key, so space is O(k).",
        uses: [
            "Replicating database tables into search indexes or caches",
            "Streaming row changes into analytics data warehouses",
            "Building audit trails of every modification to a table",
        ],
        references: [
            "Kleppmann, Designing Data-Intensive Applications, Chapter 11",
            "Debezium documentation, Change Data Capture connectors, 2026",
        ],
        workedExample:
            "A log with LSN 1 INSERT k1=a, LSN 2 UPDATE k1=b, and LSN 3 DELETE k2 yields events k1 null->a, k1 a->b, and k2 null->null. Replaying them leaves the replica with only k1=b and a checkpoint at LSN 3.",
    },
    id: "change-data-capture",
    name: "Change Data Capture",
    category: "parallel-distributed",
    complexity: { time: "O(c log c)", space: "O(k)" },
    defaultInput: {
        changes: [
            { seq: 1, op: "INSERT", key: "k1", value: "a" },
            { seq: 2, op: "INSERT", key: "k2", value: "b" },
            { seq: 3, op: "UPDATE", key: "k1", value: "c" },
            { seq: 4, op: "DELETE", key: "k2", value: "" },
        ],
    },
    visualType: "grid",
    run,
    pseudocode: [
        "read the captured log records from the source",
        "sort the records by log sequence number",
        "for each record in commit order",
        "if it is a delete, remove the key from the replica",
        "otherwise write the after image of the key",
        "emit a change event with before and after values",
        "advance the checkpoint to the record's sequence number",
        "done: the replica matches the source and the checkpoint is set",
    ],
};

export default module;
