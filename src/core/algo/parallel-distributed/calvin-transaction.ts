/**
 * calvin-transaction.ts - Calvin Deterministic Distributed Transactions
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Calvin removes distributed commit uncertainty by deciding a single global
 * order for all transactions up front. A sequencer logs the transactions, and
 * every partition replays the subsequence that touches its data in exactly that
 * order. Because the relative order is identical everywhere, the outcome is
 * serializable without a two-phase commit during execution.
 *
 * This deterministic model sequences a small set of writes and replays them on
 * a shared key-value state. It omits replication, locking details, disk logging,
 * aborts, and read-write conflict analysis.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(m * k) for m transactions with at most k writes each
 *   Space: O(m + keys) for the sequence log and key-value state
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - The grid lists each transaction with its sequence number and writes.
 *   - The row being applied is yellow; completed rows are green.
 *   - The final frame reports the key-value state and the serializability check.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface Transaction {
    id: string;
    writes: Record<string, number>;
}

const DEFAULT_TRANSACTIONS: Transaction[] = [
    { id: "T1", writes: { A: 1, B: 2 } },
    { id: "T2", writes: { B: 3, C: 4 } },
    { id: "T3", writes: { A: 5, C: 6 } },
    { id: "T4", writes: { B: 7 } },
];

const COLS = ["seq", "txn", "partition", "writes", "status"];

function partitionOf(key: string): number {
    return (key.toUpperCase().charCodeAt(0) - 65) % 4;
}

function writeSummary(writes: Record<string, number>): string {
    return Object.entries(writes)
        .map(([k, v]) => `${k}=${v}`)
        .join(" ");
}

function makeCells(transactions: Transaction[], applied: number, state: Record<string, number>): VisualEntity[] {
    const entities: VisualEntity[] = [];
    for (let r = 0; r < transactions.length; r += 1) {
        const txn = transactions[r]!;
        const parts = [...new Set(Object.keys(txn.writes).map(partitionOf))].sort((a, b) => a - b);
        const status = r < applied ? "committed" : r === applied ? "applying" : "queued";
        const values: (string | number)[] = [r, txn.id, parts.join(","), writeSummary(txn.writes), status];
        values.forEach((value, c) => {
            const entityState: EntityState = r < applied ? "sorted" : r === applied ? "comparing" : "idle";
            entities.push({
                id: `cell-${r}-${c}`,
                type: "cell",
                label: String(value),
                value: typeof value === "number" ? value : value,
                state: entityState,
                x: 0,
                y: 0,
                width: 0,
                height: 0,
                metadata: { row: r, col: c, role: COLS[c] ?? "value" },
            });
        });
    }
    // One summary row showing the live key-value state.
    const keys = Object.keys(state).sort();
    keys.forEach((key, c) => {
        entities.push({
            id: `state-${c}`,
            type: "cell",
            label: `${key}:${state[key]}`,
            value: state[key] ?? 0,
            state: "highlight",
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: { row: transactions.length, col: c, role: "state" },
        });
    });
    return entities;
}

/** Calvin deterministic transaction generator. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { transactions?: Transaction[] } | null) ?? {};
    const transactions = Array.isArray(task.transactions) && task.transactions.length > 0
        ? task.transactions.slice(0, 12).map((t) => ({ id: String(t.id), writes: t.writes ?? {} }))
        : DEFAULT_TRANSACTIONS;
    const state: Record<string, number> = {};

    const meta = (step: number, applied: number, done: boolean) => {
        const keys = Object.keys(state).sort();
        return {
            rows: transactions.length + 1,
            cols: COLS.length,
            transactions: transactions.map((t) => t.id),
            sequence: transactions.map((_, i) => i),
            applied,
            stateKeys: keys,
            stateValues: keys.map((key) => state[key] ?? 0),
            stateSummary: JSON.stringify(state),
            serializable: done,
            done,
            step,
        };
    };

    let step = 0;
    yield {
        stepNumber: step,
        entities: makeCells(transactions, -1, state),
        edges: [],
        description: `Sequence ${transactions.length} transaction(s) globally, then replay each partition in that order.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: meta(step, -1, false),
    };
    step += 1;

    for (let i = 0; i < transactions.length; i += 1) {
        const txn = transactions[i]!;
        for (const [key, value] of Object.entries(txn.writes)) state[key] = value;
        yield {
            stepNumber: step,
            entities: makeCells(transactions, i, state),
            edges: [],
            description: `Apply sequence ${i}, transaction ${txn.id}: ${writeSummary(txn.writes) || "no writes"}.`,
            codeLineNumber: 2,
            layout: "grid",
            meta: meta(step, i, false),
        };
        step += 1;
    }

    yield {
        stepNumber: step,
        entities: makeCells(transactions, transactions.length, state),
        edges: [],
        description: `All partitions replayed the same sequence; final state ${JSON.stringify(state)} is serializable.`,
        codeLineNumber: 4,
        layout: "grid",
        meta: meta(step, transactions.length, true),
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Distributed commit protocols spend a lot of effort agreeing on the outcome at execution time. Calvin instead agrees on the order once, up front, and makes every partition follow the identical schedule. If two transactions touch the same key, the earlier one always goes first everywhere, so the final state looks like a single serial run and no online commit vote is needed.",
        invariants: [
            "Every partition sees transactions that touch its data in global sequence order.",
            "A key's final value comes from the last sequenced transaction that writes it.",
            "Replaying the log produces the same state at every replica.",
        ],
        correctness:
            "Fix the global sequence produced by the sequencer. Each partition executes exactly the subsequence of transactions touching its keys, preserving their relative order. For any two conflicting transactions on the same key, both partitions place the same one first because both follow the global order. Therefore the dependency graph of the execution is acyclic and consistent with the sequence, so the schedule is equivalent to a serial execution in that order and is serializable. The shared-state replay in this simulation computes that serial result directly.",
        complexityRationale:
            "Sequencing and replaying m transactions with at most k writes each takes O(m times k) time. The log of m transactions plus the key-value state uses O(m plus number of keys) space per partition.",
        uses: [
            "High-throughput distributed databases with deterministic ordering",
            "Geo-replicated transactions that avoid two-phase commit",
            "Systems where the transaction set is known before execution",
        ],
        references: [
            "Thomson et al., Calvin: Fast Distributed Transactions for Partitioned Database Systems, 2012",
            "Bernstein and Newcomer, Principles of Distributed Database Systems, chapter on serializability",
        ],
        workedExample:
            "Sequencing T1 writes A=1 and B=2, then T2 writes B=3 and C=4, then T3 writes A=5 and C=6, and finally T4 writes B=7. Every partition applies these in that order, so the final state is A=5, B=7, C=6, exactly what a single sequential executor would produce.",
    },
    id: "calvin-transaction",
    name: "Calvin Deterministic Transactions",
    category: "parallel-distributed",
    complexity: { time: "O(m * k)", space: "O(m + keys)" },
    defaultInput: { transactions: DEFAULT_TRANSACTIONS },
    visualType: "grid",
    run,
    pseudocode: [
        "collect the batch of transactions reaching the sequencer",
        "append each transaction to one global sequence log",
        "for each partition extract its subsequence in log order",
        "apply each transaction's writes to the partition state",
        "continue until the partition has replayed the whole log",
        "done: report the shared final state and serializability",
    ],
};

export default module;
