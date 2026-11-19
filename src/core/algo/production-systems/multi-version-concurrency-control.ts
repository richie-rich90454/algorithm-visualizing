/**
 * multi-version-concurrency-control.ts - Multi-Version Concurrency Control
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * MVCC keeps a chain of versions for every key instead of overwriting in place.
 * A transaction reads the newest version whose commit timestamp is at most its
 * snapshot timestamp, so readers never block writers. A writer is rejected
 * under first-committer-wins when a newer version of the same key already
 * exists relative to its snapshot. This module simulates both behaviors.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(T * (R * V + W * V)) where V is the longest version chain
 *   Space: O(total versions) for all chains
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Grid cells show version chains, one row per key and one column per version.
 *   - The version a transaction sees is yellow; a new version is green.
 *   - A first-committer-wins conflict marks the conflicting row red.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface TxSpec {
    id: number;
    readTs: number;
    reads?: string[];
    writes?: Record<string, number>;
}

interface MVCCInput {
    transactions?: TxSpec[];
}

interface Version {
    ts: number;
    value: number;
    tx: number;
}

function makeCells(
    keys: string[],
    chains: Map<string, Version[]>,
    highlight: { key: string; index: number; state: EntityState } | null,
    conflictKey: string | null,
): VisualEntity[] {
    const entities: VisualEntity[] = [];
    keys.forEach((key, row) => {
        const versions = chains.get(key) ?? [];
        const width = Math.max(versions.length, 1);
        for (let col = 0; col < width; col += 1) {
            const version = versions[col];
            let state: EntityState = "idle";
            if (key === conflictKey) state = "error";
            else if (highlight && highlight.key === key && highlight.index === col) state = highlight.state;
            else if (version) state = "sorted";
            entities.push({
                id: `cell-${row}-${col}`,
                type: "cell" as const,
                label: version ? `t${version.ts}:${version.value}` : ".",
                value: version ? version.value : 0,
                state,
                x: 0,
                y: 0,
                width: 0,
                height: 0,
                metadata: { row, col, key, ts: version ? version.ts : -1 },
            });
        }
    });
    return entities;
}

/** The MVCC generator. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as MVCCInput | null) ?? {};
    const transactions: TxSpec[] = Array.isArray(task.transactions) && task.transactions.length > 0
        ? task.transactions.map((tx) => ({
            id: typeof tx?.id === "number" ? tx.id : 0,
            readTs: typeof tx?.readTs === "number" ? Math.max(0, Math.floor(tx.readTs)) : 0,
            reads: Array.isArray(tx?.reads) ? tx.reads.filter((key): key is string => typeof key === "string") : [],
            writes: tx?.writes && typeof tx.writes === "object" ? tx.writes : {},
        }))
        : [
            { id: 1, readTs: 1, reads: ["A"], writes: { A: 10 } },
            { id: 2, readTs: 1, reads: ["A"], writes: {} },
            { id: 3, readTs: 2, reads: ["A"], writes: { A: 20 } },
            { id: 4, readTs: 1, reads: [], writes: { A: 30 } },
            { id: 5, readTs: 3, reads: ["A"], writes: {} },
        ];

    const chains = new Map<string, Version[]>();
    const keys: string[] = [];
    for (const tx of transactions) {
        for (const key of tx.reads ?? []) if (!keys.includes(key)) keys.push(key);
        for (const key of Object.keys(tx.writes ?? {})) if (!keys.includes(key)) keys.push(key);
    }

    const readKeys: string[] = [];
    const readTx: number[] = [];
    const readTs: number[] = [];
    const readValues: number[] = [];
    const decisions: string[] = [];
    let committed = 0;
    let aborted = 0;
    let step = 0;

    yield {
        stepNumber: step,
        entities: makeCells(keys, chains, null, null),
        edges: [],
        description: `MVCC started with ${transactions.length} transactions over ${keys.length} key(s); all version chains are empty.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: { keys, decisions, readKeys, readTx, readTs, readValues, committed, aborted, chainText: [], complete: false },
    };
    step += 1;

    for (let order = 0; order < transactions.length; order += 1) {
        const tx = transactions[order] as TxSpec;
        const commitTs = order + 1;
        const localReads = tx.reads ?? [];
        for (const key of localReads) {
            const versions = chains.get(key) ?? [];
            let visible: Version | null = null;
            for (const version of versions) {
                if (version.ts <= tx.readTs && (!visible || version.ts > visible.ts)) visible = version;
            }
            const value = visible ? visible.value : 0;
            readKeys.push(key);
            readTx.push(tx.id);
            readTs.push(tx.readTs);
            readValues.push(value);
            const index = visible ? versions.indexOf(visible) : -1;
            yield {
                stepNumber: step,
                entities: makeCells(keys, chains, index >= 0 ? { key, index, state: "comparing" } : null, null),
                edges: [],
                description: `Transaction ${tx.id} snapshot ${tx.readTs} reads ${key}: newest visible version is ${visible ? `t${visible.ts} = ${visible.value}` : "none, value 0"}.`,
                codeLineNumber: 2,
                layout: "grid",
                meta: { keys, decisions: [...decisions], readKeys: [...readKeys], readTx: [...readTx], readTs: [...readTs], readValues: [...readValues], committed, aborted, chainText: [], complete: false },
            };
            step += 1;
        }

        const writeEntries = Object.entries(tx.writes ?? {});
        let conflictKey: string | null = null;
        for (const [key] of writeEntries) {
            const versions = chains.get(key) ?? [];
            if (versions.some((version) => version.ts > tx.readTs)) {
                conflictKey = key;
                break;
            }
        }
        if (conflictKey !== null) {
            decisions.push(`tx${tx.id}:${conflictKey}:abort`);
            aborted += 1;
            yield {
                stepNumber: step,
                entities: makeCells(keys, chains, null, conflictKey),
                edges: [],
                description: `Transaction ${tx.id} aborts on ${conflictKey}: a version newer than snapshot ${tx.readTs} already committed (first-committer-wins).`,
                codeLineNumber: 4,
                layout: "grid",
                meta: { keys, decisions: [...decisions], readKeys: [...readKeys], readTx: [...readTx], readTs: [...readTs], readValues: [...readValues], committed, aborted, chainText: [], complete: false },
            };
            step += 1;
            continue;
        }

        for (const [key, value] of writeEntries) {
            const versions = chains.get(key) ?? [];
            versions.push({ ts: commitTs, value, tx: tx.id });
            chains.set(key, versions);
            decisions.push(`tx${tx.id}:${key}:commit`);
            committed += 1;
            yield {
                stepNumber: step,
                entities: makeCells(keys, chains, { key, index: versions.length - 1, state: "sorted" }, null),
                edges: [],
                description: `Transaction ${tx.id} commits ${key} = ${value} at timestamp ${commitTs}.`,
                codeLineNumber: 6,
                layout: "grid",
                meta: { keys, decisions: [...decisions], readKeys: [...readKeys], readTx: [...readTx], readTs: [...readTs], readValues: [...readValues], committed, aborted, chainText: [], complete: false },
            };
            step += 1;
        }
    }

    const chainText = keys.map((key) => `${key}:${(chains.get(key) ?? []).map((version) => `t${version.ts}=${version.value}`).join("|")}`);
    yield {
        stepNumber: step,
        entities: makeCells(keys, chains, null, null),
        edges: [],
        description: `MVCC finished: ${committed} commit(s), ${aborted} abort(s); readers used snapshots without blocking writers.`,
        codeLineNumber: 6,
        layout: "grid",
        meta: { keys, decisions, readKeys, readTx, readTs, readValues, committed, aborted, chainText, complete: true },
    };
}

/** The MVCC module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "Instead of keeping one value per row, MVCC stores a chain of versions tagged with the transaction that wrote them and when. A reader picks the newest version that was already committed when its snapshot began, so it never waits for a writer. A writer checks whether someone else committed a newer version after its snapshot and aborts if so.",
        invariants: [
            "A read sees the version with the largest commit timestamp not exceeding its snapshot timestamp.",
            "Committed versions on a key have strictly increasing commit timestamps.",
            "An aborted transaction contributes no versions to any chain.",
            "A first-committer-wins conflict discards the entire transaction, not just one key.",
        ],
        correctness:
            "Because every committed version carries its commit timestamp, a snapshot read has a unique newest eligible version and is repeatable: reading the same key twice in one snapshot finds the same maximum. The first-committer-wins rule rejects a writer exactly when another committed version of a key appeared after its snapshot, so two overlapping writers cannot both commit the same key. Aborting before applying any write keeps the version chains conflict-free.",
        complexityRationale:
            "Each read scans a version chain and each write scans one before appending, so with at most V versions per key the work is O(T times (R plus W) times V). Storage is the sum of all committed versions, O(total versions).",
        uses: [
            "Snapshot isolation in PostgreSQL and other relational databases",
            "Read-optimized storage engines with concurrent analytics",
            "Optimistic transaction processing in distributed databases",
        ],
        references: [
            "Bernstein and Newcomer, Principles of Distributed Database Systems, Chapter 4",
            "MySQL InnoDB MVCC documentation, 2024",
        ],
        workedExample:
            "Transaction 1 writes A = 10 at time 1. Transaction 2 with snapshot 1 reads A and sees 10. Transaction 3 with snapshot 2 writes A = 20 at time 3. Transaction 4 still holding snapshot 1 tries to write A, finds version time 3 newer than its snapshot, and aborts. Transaction 5 with snapshot 3 reads A and sees 20.",
    },
    id: "multi-version-concurrency-control",
    name: "Multi-Version Concurrency Control",
    category: "production-systems",
    complexity: { time: "O(T * (R + W) * V)", space: "O(total versions)" },
    defaultInput: {
        transactions: [
            { id: 1, readTs: 1, reads: ["A"], writes: { A: 10 } },
            { id: 2, readTs: 1, reads: ["A"], writes: {} },
            { id: 3, readTs: 2, reads: ["A"], writes: { A: 20 } },
            { id: 4, readTs: 1, reads: [], writes: { A: 30 } },
            { id: 5, readTs: 3, reads: ["A"], writes: {} },
        ],
    },
    visualType: "grid",
    run,
    pseudocode: [
        "list the keys touched by all transactions",
        "for each transaction in commit order",
        "for each read key pick the newest version at or before the snapshot",
        "for each write key test for a version newer than the snapshot",
        "if such a version exists abort the whole transaction",
        "otherwise append a new version with the commit timestamp",
        "after the last transaction report chains and outcomes",
    ],
};

export default module;
