/**
 * optimistic-concurrency-control.ts - Optimistic Concurrency Control
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Optimistic concurrency control lets transactions run without locks, then
 * validates them before commit. Each transaction reads a consistent snapshot,
 * keeps writes in a private workspace, and is accepted only if no transaction
 * that committed after its snapshot wrote anything it read. Accepted writes are
 * applied atomically; rejected transactions restart. This is Kung-Robinson
 * backward validation.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(T * (R * V + C * W)) over reads, version chains, and committed sets
 *   Space: O(total committed writes plus one workspace per active transaction)
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Grid cells show the database value and commit timestamp per key.
 *   - A frame marks each phase: read, validate, then write or abort.
 *   - Green cells are committed, yellow are read, red marks a failed validation.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface OccTx {
    id: number;
    startTs: number;
    reads?: string[];
    writes?: Record<string, number>;
}

interface OCCInput {
    transactions?: OccTx[];
}

interface DbVersion {
    value: number;
    ts: number;
}

interface Committed {
    id: number;
    commitTs: number;
    writeKeys: string[];
}

function makeCells(
    keys: string[],
    db: Map<string, DbVersion>,
    highlight: { key: string; state: EntityState } | null,
): VisualEntity[] {
    return keys.map((key, index) => {
        const version = db.get(key);
        return {
            id: `cell-${index}`,
            type: "cell" as const,
            label: version ? `t${version.ts}:${version.value}` : ".",
            value: version ? version.value : 0,
            state: highlight?.key === key ? highlight.state : version ? "sorted" as EntityState : "idle" as EntityState,
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: { row: 0, col: index, key, ts: version ? version.ts : -1 },
        };
    });
}

/** The optimistic concurrency control generator. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as OCCInput | null) ?? {};
    const transactions: OccTx[] = Array.isArray(task.transactions) && task.transactions.length > 0
        ? task.transactions.map((tx) => ({
            id: typeof tx?.id === "number" ? tx.id : 0,
            startTs: typeof tx?.startTs === "number" ? Math.max(0, Math.floor(tx.startTs)) : 0,
            reads: Array.isArray(tx?.reads) ? tx.reads.filter((key): key is string => typeof key === "string") : [],
            writes: tx?.writes && typeof tx.writes === "object" ? tx.writes : {},
        }))
        : [
            { id: 1, startTs: 0, reads: ["A"], writes: { A: 10 } },
            { id: 2, startTs: 0, reads: ["A"], writes: { A: 20 } },
            { id: 3, startTs: 1, reads: ["A"], writes: { B: 30 } },
        ];

    const keys: string[] = [];
    for (const tx of transactions) {
        for (const key of tx.reads ?? []) if (!keys.includes(key)) keys.push(key);
        for (const key of Object.keys(tx.writes ?? {})) if (!keys.includes(key)) keys.push(key);
    }

    const db = new Map<string, DbVersion>();
    const committed: Committed[] = [];
    const readKeys: string[] = [];
    const readTx: number[] = [];
    const readValues: number[] = [];
    const readTsList: number[] = [];
    const decisions: string[] = [];
    let commitCounter = 0;
    let committedCount = 0;
    let abortedCount = 0;
    let step = 0;

    yield {
        stepNumber: step,
        entities: makeCells(keys, db, null),
        edges: [],
        description: `Optimistic concurrency control with ${transactions.length} transaction(s) over ${keys.length} key(s); database starts empty.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: { keys, decisions, readKeys, readTx, readTs: readTsList, readValues, dbText: [], committed: 0, aborted: 0, complete: false },
    };
    step += 1;

    for (const tx of transactions) {
        const localReads = tx.reads ?? [];
        const localWrites = tx.writes ?? {};
        for (const key of localReads) {
            const version = db.get(key);
            const value = version && version.ts <= tx.startTs ? version.value : 0;
            readKeys.push(key);
            readTx.push(tx.id);
            readTsList.push(tx.startTs);
            readValues.push(value);
        }
        yield {
            stepNumber: step,
            entities: makeCells(keys, db, localReads.length > 0 ? { key: localReads[0] as string, state: "comparing" } : null),
            edges: [],
            description: `Transaction ${tx.id} read phase at snapshot ${tx.startTs}: ${localReads.length} key(s) read into its private workspace.`,
            codeLineNumber: 2,
            layout: "grid",
            meta: { keys, decisions: [...decisions], readKeys: [...readKeys], readTx: [...readTx], readTs: [...readTsList], readValues: [...readValues], dbText: [], committed: committedCount, aborted: abortedCount, complete: false },
        };
        step += 1;

        let conflictWith = -1;
        for (const previous of committed) {
            if (previous.commitTs <= tx.startTs) continue;
            if (previous.writeKeys.some((key) => localReads.includes(key))) {
                conflictWith = previous.id;
                break;
            }
        }
        yield {
            stepNumber: step,
            entities: makeCells(keys, db, conflictWith >= 0 && localReads.length > 0 ? { key: localReads[0] as string, state: "error" } : null),
            edges: [],
            description: conflictWith >= 0
                ? `Transaction ${tx.id} fails validation: transaction ${conflictWith} committed after snapshot ${tx.startTs} and wrote a key it read.`
                : `Transaction ${tx.id} validates successfully at snapshot ${tx.startTs}; no later commit touched its read set.`,
            codeLineNumber: conflictWith >= 0 ? 5 : 4,
            layout: "grid",
            meta: { keys, decisions: [...decisions], readKeys: [...readKeys], readTx: [...readTx], readTs: [...readTsList], readValues: [...readValues], dbText: [], committed: committedCount, aborted: abortedCount, complete: false },
        };
        step += 1;

        if (conflictWith >= 0) {
            decisions.push(`tx${tx.id}:abort`);
            abortedCount += 1;
            yield {
                stepNumber: step,
                entities: makeCells(keys, db, null),
                edges: [],
                description: `Transaction ${tx.id} aborts; its private writes are discarded and the database is unchanged.`,
                codeLineNumber: 6,
                layout: "grid",
                meta: { keys, decisions: [...decisions], readKeys: [...readKeys], readTx: [...readTx], readTs: [...readTsList], readValues: [...readValues], dbText: [], committed: committedCount, aborted: abortedCount, complete: false },
            };
            step += 1;
            continue;
        }

        commitCounter += 1;
        const writeKeys = Object.keys(localWrites);
        for (const key of writeKeys) {
            db.set(key, { value: localWrites[key] as number, ts: commitCounter });
        }
        committed.push({ id: tx.id, commitTs: commitCounter, writeKeys });
        committedCount += 1;
        decisions.push(`tx${tx.id}:commit`);
        yield {
            stepNumber: step,
            entities: makeCells(keys, db, writeKeys.length > 0 ? { key: writeKeys[0] as string, state: "sorted" } : null),
            edges: [],
            description: `Transaction ${tx.id} commits ${writeKeys.length} write(s) atomically at timestamp ${commitCounter}.`,
            codeLineNumber: 7,
            layout: "grid",
            meta: { keys, decisions: [...decisions], readKeys: [...readKeys], readTx: [...readTx], readTs: [...readTsList], readValues: [...readValues], dbText: [], committed: committedCount, aborted: abortedCount, complete: false },
        };
        step += 1;
    }

    const dbText = keys.map((key) => {
        const version = db.get(key);
        return version ? `${key}:t${version.ts}=${version.value}` : `${key}:empty`;
    });
    yield {
        stepNumber: step,
        entities: makeCells(keys, db, null),
        edges: [],
        description: `Validation finished: ${committedCount} commit(s), ${abortedCount} abort(s); final database reflects only committed writes.`,
        codeLineNumber: 7,
        layout: "grid",
        meta: { keys, decisions, readKeys, readTx, readTs: readTsList, readValues, dbText, committed: committedCount, aborted: abortedCount, complete: true },
    };
}

/** The optimistic concurrency control module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "Optimistic concurrency control assumes conflicts are rare, so transactions work in private without blocking anyone. At commit time each transaction checks whether any transaction that finished after its snapshot wrote a key it read. If not, its writes are applied all at once; if so, it throws away its work and retries.",
        invariants: [
            "A read observes the newest database version at or before the transaction's snapshot.",
            "Writes stay private until validation succeeds.",
            "A committed transaction conflicts only with earlier commits after its snapshot touching its read set.",
            "Aborted transactions leave the database untouched.",
        ],
        correctness:
            "Backward validation compares each transaction's read set against the write sets of all transactions that committed after its snapshot. If any intersects, the transaction's view could have differed from a serial order, so it is rejected. If none intersects, the transaction can be placed in the serial order just before the first conflicting committer and after all earlier ones, so committed transactions are serializable in commit order. Atomic application of writes ensures no partial effects are visible.",
        complexityRationale:
            "Each read searches the current version, and validation scans every committed transaction's write set against the read set, so the total is O(T times (R times V plus C times W)). Storage is the committed write history plus one private workspace per transaction.",
        uses: [
            "Optimistic transaction processing in in-memory databases",
            "Software transactional memory systems",
            "Conflict detection in distributed replicated stores",
        ],
        references: [
            "Kung and Robinson, On Optimistic Methods for Concurrency Control, 1981",
            "Bernstein and Newcomer, Principles of Distributed Database Systems, Chapter 4",
        ],
        workedExample:
            "Transaction 1 reads A and commits A = 10 at time 1. Transaction 2 also read A at snapshot 0 and tries to write A = 20. Because transaction 1 committed after snapshot 0 and wrote A, transaction 2 fails validation and aborts. Transaction 3 starting at snapshot 1 reads A as 10 and commits a write to B successfully.",
    },
    id: "optimistic-concurrency-control",
    name: "Optimistic Concurrency Control",
    category: "production-systems",
    complexity: { time: "O(T * (R * V + C * W))", space: "O(committed writes + workspaces)" },
    defaultInput: {
        transactions: [
            { id: 1, startTs: 0, reads: ["A"], writes: { A: 10 } },
            { id: 2, startTs: 0, reads: ["A"], writes: { A: 20 } },
            { id: 3, startTs: 1, reads: ["A"], writes: { B: 30 } },
        ],
    },
    visualType: "grid",
    run,
    pseudocode: [
        "start with an empty database and no committed transactions",
        "for each transaction in validation order",
        "read each key from the newest version at its snapshot",
        "check earlier commits after the snapshot against the read set",
        "if any write set intersects the read set then abort",
        "otherwise apply all private writes atomically and assign a commit timestamp",
        "record the commit for later validations",
        "done: report the final committed database",
    ],
};

export default module;
