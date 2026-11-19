/**
 * snapshot-isolation.ts - Snapshot Isolation with First-Committer-Wins
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Snapshot isolation gives every transaction a consistent view of the database
 * as of its start timestamp. Reads never see another transaction's uncommitted
 * changes, and writes are validated at commit time. Under first-committer-wins,
 * a transaction is aborted if a transaction that committed after it started
 * wrote any key it also intends to write. This prevents lost updates while
 * allowing non-conflicting transactions to commit concurrently.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(T^2 * W) for T transactions each writing W keys
 *   Space: O(T * W) for the write sets and validation records
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - One cell per database key shows its committed value.
 *   - The transaction being validated is highlighted in the caption and meta.
 *   - meta reports committed and aborted transaction ids.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface Transaction {
    id: string;
    start: number;
    commit: number;
    writes: Record<string, number>;
    reads?: string[];
}

interface Input {
    transactions?: Transaction[];
    initial?: Record<string, number>;
}

const DEFAULT_TXNS: Transaction[] = [
    { id: "T1", start: 1, commit: 2, writes: { X: 10 } },
    { id: "T2", start: 1, commit: 3, writes: { X: 20 } },
    { id: "T3", start: 4, commit: 5, writes: { Y: 5 } },
];

function makeCells(
    keys: string[],
    values: Record<string, number>,
    highlight: string | null,
    state: EntityState,
): VisualEntity[] {
    return keys.map((key, index) => ({
        id: `key-${index}`,
        type: "cell" as const,
        label: `${key}:${values[key] ?? 0}`,
        value: values[key] ?? 0,
        state: key === highlight ? state : "idle",
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { row: 0, col: index, key },
    }));
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as Input | null) ?? {};
    const txns: Transaction[] = [...(task.transactions ?? DEFAULT_TXNS)].sort(
        (a, b) => a.commit - b.commit,
    );
    const state: Record<string, number> = { ...(task.initial ?? { X: 0, Y: 0 }) };
    const keys = Object.keys(state);
    const committed: string[] = [];
    const aborted: string[] = [];
    let step = 0;

    const snap = (
        description: string,
        line: number,
        highlight: string | null,
        entityState: EntityState,
    ): VisualFrame => ({
        stepNumber: step,
        entities: makeCells(keys, state, highlight, entityState),
        edges: [],
        description,
        codeLineNumber: line,
        layout: "grid",
        meta: {
            keys: [...keys],
            values: keys.map((key) => state[key] ?? 0),
            committed: [...committed],
            aborted: [...aborted],
            transactionCount: txns.length,
        },
    });

    yield snap(
        `Validating ${txns.length} transaction(s) under snapshot isolation with first-committer-wins.`,
        0,
        null,
        "idle",
    );
    step += 1;

    for (const txn of txns) {
        const writtenKeys = Object.keys(txn.writes);
        let conflictWith: string | null = null;
        for (const other of committed) {
            const prior = txns.find((t) => t.id === other);
            if (!prior) {
                continue;
            }
            const overlaps = writtenKeys.some((k) => Object.prototype.hasOwnProperty.call(prior.writes, k));
            if (prior.commit > txn.start && prior.commit < txn.commit && overlaps) {
                conflictWith = other;
                break;
            }
        }
        if (conflictWith !== null) {
            aborted.push(txn.id);
            yield snap(
                `Transaction ${txn.id} aborts: ${conflictWith} committed an overlapping write after ${txn.id} started.`,
                4,
                writtenKeys[0] ?? null,
                "error",
            );
            step += 1;
            continue;
        }
        for (const key of writtenKeys) {
            state[key] = txn.writes[key]!;
        }
        committed.push(txn.id);
        yield snap(
            `Transaction ${txn.id} commits its snapshot writes to ${writtenKeys.join(", ") || "no keys"}.`,
            6,
            writtenKeys[0] ?? null,
            "sorted",
        );
        step += 1;
    }

    yield snap(
        `Snapshot isolation done: ${committed.length} committed, ${aborted.length} aborted; final values reflect winners only.`,
        7,
        null,
        "sorted",
    );
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "A transaction under snapshot isolation reads from a photograph of the database taken when it began, so it never sees half-finished work from others. At commit time the system checks whether any overlapping write landed in the meantime. If so, the later committer loses and aborts, which keeps two writers from silently overwriting each other.",
        invariants: [
            "Every read observes values as of the transaction's start snapshot.",
            "A committed transaction's write set never overlaps a later commit from a transaction that started earlier.",
            "Aborted transactions leave no trace in the committed state.",
            "Transactions are validated in commit timestamp order.",
        ],
        correctness:
            "First-committer-wins rejects a transaction whenever an already-committed transaction wrote the same key after the candidate's snapshot was taken. Consequently any two transactions that both write a key and overlap in time cannot both commit: the one committing second must abort. Because only winning write sets are applied and they are applied in commit order, the final state equals the serial application of committed transactions, and no lost update occurs.",
        complexityRationale:
            "For each of T transactions the validation loop scans the previously committed transactions and compares their write sets of size up to W, costing O(T^2 * W) time in the worst case. Storing the transaction write sets and the committed and aborted lists uses O(T * W) space.",
        uses: [
            "PostgreSQL repeatable-read isolation and similar MVCC databases",
            "Oracle and MySQL InnoDB snapshot-based transaction processing",
            "Long-running analytical transactions that must see a stable view",
        ],
        references: [
            "Berenson et al., A Critique of ANSI SQL Isolation Levels, SIGMOD 1995",
            "Bernstein and Newcomer, Principles of Distributed Database Systems, isolation chapter",
        ],
        workedExample:
            "Suppose T1 starts at 1 and commits X=10 at 2, while T2 also starts at 1 but tries to commit X=20 at 3. Because T1 committed after T2's snapshot and wrote the same key, T2 aborts under first-committer-wins. A later T3 writing Y=5 commits, leaving final values X=10 and Y=5.",
    },
    id: "snapshot-isolation",
    name: "Snapshot Isolation",
    category: "production-systems",
    complexity: { time: "O(T^2 * W)", space: "O(T * W)" },
    defaultInput: { transactions: DEFAULT_TXNS, initial: { X: 0, Y: 0 } },
    visualType: "grid",
    run,
    pseudocode: [
        "order transactions by their commit timestamps",
        "give each transaction a snapshot at its start time",
        "for each transaction in commit order",
        "collect the keys in its write set",
        "if a committed overlapping write followed its start then abort",
        "otherwise apply its writes to the committed state",
        "record the transaction as a winner",
        "done: report final values and aborted transactions",
    ],
};

export default module;
