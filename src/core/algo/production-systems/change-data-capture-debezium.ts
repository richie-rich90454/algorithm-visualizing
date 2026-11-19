/**
 * change-data-capture-debezium.ts - Log-Based Change Data Capture
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Change data capture reads a database transaction log and turns row-level
 * writes into a stream of insert, update, and delete events. Each event carries
 * the table, key, and before and after images. Replaying the stream rebuilds
 * the exact current contents of the source tables, which is how replicas and
 * search indexes stay in sync.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(c) for c captured change records
 *   Space: O(c + k) for the emitted stream and k tracked rows
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - One grid row per log entry with key, operation, value, and state.
 *   - Insert is code 0, update is code 1, and delete is code 2.
 *   - The final frame reports the rebuilt table state after replay.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface Change {
    table: string;
    op: number;
    key: number;
    value: number;
}

interface Task {
    changes?: Change[];
}

function makeCells(changes: Change[], applied: number[], current: number, done: boolean): VisualEntity[] {
    const entities: VisualEntity[] = [];
    for (let row = 0; row < changes.length; row += 1) {
        const change = changes[row];
        const columns = [change?.key ?? 0, change?.op ?? 0, change?.value ?? 0, applied[row] ?? 0];
        for (let col = 0; col < columns.length; col += 1) {
            let state: EntityState = "idle";
            if (done) state = "sorted";
            else if (row === current) state = "comparing";
            else if (applied[row] === 1) state = "visited";
            entities.push({
                id: `cell-${row}-${col}`,
                type: "cell" as const,
                label: String(columns[col] ?? 0),
                value: columns[col] ?? 0,
                state,
                x: 0,
                y: 0,
                width: 0,
                height: 0,
                metadata: { row, col, table: change?.table ?? "" },
            });
        }
    }
    return entities;
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as Task | null) ?? {};
    const changes: Change[] = Array.isArray(task.changes) && task.changes.length > 0
        ? task.changes.map((change) => ({
            table: String(change?.table ?? "orders"),
            op: ((Math.floor(Number(change?.op)) % 3) + 3) % 3,
            key: Math.floor(Number(change?.key)),
            value: Math.floor(Number(change?.value)),
        }))
        : [
            { table: "orders", op: 0, key: 1, value: 10 },
            { table: "orders", op: 0, key: 2, value: 20 },
            { table: "orders", op: 1, key: 1, value: 15 },
            { table: "orders", op: 2, key: 2, value: 0 },
            { table: "orders", op: 0, key: 3, value: 30 },
            { table: "orders", op: 1, key: 3, value: 35 },
        ];

    const state = new Map<string, Map<number, number>>();
    const applied: number[] = [];
    const keys: number[] = [];
    const ops: number[] = [];
    const values: number[] = [];
    const befores: number[] = [];
    const afters: number[] = [];

    const metaBase = { family: "change-data-capture", rows: changes.length, cols: 4, changeCount: changes.length };
    const finalState = () => {
        const allKeys: number[] = [];
        const allValues: number[] = [];
        for (const table of [...state.keys()].sort()) {
            for (const [key, value] of [...(state.get(table)?.entries() ?? [])].sort((a, b) => a[0] - b[0])) {
                allKeys.push(key);
                allValues.push(value);
            }
        }
        return { finalKeys: allKeys, finalValues: allValues };
    };

    yield {
        stepNumber: 0,
        entities: makeCells(changes, applied, -1, false),
        edges: [],
        description: `Capturing ${changes.length} row change records from the transaction log.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: { ...metaBase, keys: [], ops: [], values: [], applied: [] },
    };

    let step = 1;
    for (let i = 0; i < changes.length; i += 1) {
        const change = changes[i];
        if (!change) continue;
        const tableState = state.get(change.table) ?? new Map<number, number>();
        state.set(change.table, tableState);
        const before = tableState.has(change.key) ? (tableState.get(change.key) as number) : -1;
        if (change.op === 2) tableState.delete(change.key);
        else tableState.set(change.key, change.value);
        const after = tableState.has(change.key) ? (tableState.get(change.key) as number) : -1;

        applied.push(1);
        keys.push(change.key);
        ops.push(change.op);
        values.push(change.value);
        befores.push(before);
        afters.push(after);
        const verb = change.op === 0 ? "INSERT" : change.op === 1 ? "UPDATE" : "DELETE";
        yield {
            stepNumber: step,
            entities: makeCells(changes, applied, i, false),
            edges: [],
            description: `Log entry ${i}: ${verb} on ${change.table} key ${change.key}, before ${before}, after ${after}.`,
            codeLineNumber: 3,
            layout: "grid",
            meta: {
                ...metaBase,
                keys: [...keys],
                ops: [...ops],
                values: [...values],
                applied: [...applied],
                befores: [...befores],
                afters: [...afters],
                current: i,
                ...finalState(),
            },
        };
        step += 1;
    }

    const rebuilt = finalState();
    yield {
        stepNumber: step,
        entities: makeCells(changes, applied, -1, true),
        edges: [],
        description: `Replayed ${changes.length} changes; rebuilt state holds ${rebuilt.finalKeys.length} row(s).`,
        codeLineNumber: 6,
        layout: "grid",
        meta: {
            ...metaBase,
            keys,
            ops,
            values,
            applied,
            befores,
            afters,
            ...rebuilt,
            done: true,
        },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Rather than asking the database what changed, a CDC connector reads the same log the database uses to commit transactions. Every row write becomes an event describing the old and new values. Feeding those events into another system in order makes that system a faithful copy without repeatedly scanning the source tables.",
        invariants: [
            "Each captured row write emits exactly one change record.",
            "An update carries both the before and after images of the row.",
            "Replaying the records in log order rebuilds the source state.",
        ],
        correctness:
            "The connector applies each change record to a local copy of the table state using the operation code: inserts and updates set the key to the after value, deletes remove it. Because the log is processed in commit order and each operation is a deterministic state transition, the resulting map equals the state obtained by applying the same writes directly to the source. The before and after images are read from the map around each transition, so they are consistent with the replay.",
        complexityRationale:
            "Each change record is decoded and applied with constant work, so capture is O(c) time. The emitted stream arrays and the rebuilt row map use O(c + k) space.",
        uses: [
            "Streaming database changes into search indexes and caches",
            "Replicating tables to analytics warehouses",
            "Auditing every row-level modification for compliance",
        ],
        references: [
            "Debezium documentation, Architecture and Change Event Structure",
            "Kleppmann, Designing Data-Intensive Applications, Chapter 5",
        ],
        workedExample:
            "An insert of key 1 with value 10 emits an INSERT event with before empty and after 10. A later update of key 1 to 15 emits an UPDATE with before 10 and after 15. A delete of key 2 emits a DELETE whose after image is empty, and replaying all three leaves only key 1 at value 15.",
    },
    id: "change-data-capture-debezium",
    name: "Change Data Capture",
    category: "production-systems",
    complexity: { time: "O(c)", space: "O(c + k)" },
    defaultInput: {
        changes: [
            { table: "orders", op: 0, key: 1, value: 10 },
            { table: "orders", op: 0, key: 2, value: 20 },
            { table: "orders", op: 1, key: 1, value: 15 },
            { table: "orders", op: 2, key: 2, value: 0 },
            { table: "orders", op: 0, key: 3, value: 30 },
            { table: "orders", op: 1, key: 3, value: 35 },
        ],
    },
    visualType: "grid",
    run,
    pseudocode: [
        "read the ordered row change records from the log",
        "initialize an empty replica of each source table",
        "for each record decode the operation and key",
        "capture the before image from the local table",
        "apply insert, update, or delete to the local row",
        "capture the after image and emit the change event",
        "continue until the log is exhausted",
        "done: report the rebuilt table state",
    ],
};

export default module;
