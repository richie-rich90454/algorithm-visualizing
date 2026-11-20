/**
 * percolator.ts - Percolator Distributed Transaction (Teaching Core)
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Percolator layers optimistic transactions over a versioned key-value store.
 * A transaction reads a consistent snapshot at a start timestamp, then in a
 * prewrite phase installs tentative values and locks with one row chosen as
 * the primary. Commit writes the primary's commit record first and then the
 * secondaries, so all writes become visible at a single commit timestamp. A
 * conflicting prewrite on an already locked row aborts the whole transaction
 * and leaves no partial writes behind.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 *   Time:  O(w) prewrite writes plus O(w) commit records for w written rows
 *   Space: O(w) for locks and tentative versions, plus the version store
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 *   - Each grid row is a data row; its cell shows the visible value and stamp.
 *   - A prewritten row is yellow, a committed row is green, a conflict is red.
 *   - meta carries start and commit stamps, locks, versions, and snapshot reads.
 *
 * This is a deterministic in-memory teaching core with a fixed timestamp
 * oracle and one transaction. It does not model distributed commits across
 * tablets, thread scheduling, or crash recovery from the primary lock.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface Input {
    rows?: string[];
    initial?: number[];
    writes?: Array<number | null>;
    startTs?: number;
    commitTs?: number;
    conflictRow?: number | null;
}

interface Version {
    value: number;
    ts: number;
    committed: boolean;
}

const DEFAULT_ROWS = ["A", "B", "C"];
const DEFAULT_INITIAL = [5, 7, 9];
const DEFAULT_WRITES: Array<number | null> = [null, 20, 30];

/** Read the newest committed version at or before the snapshot stamp. */
function visibleValue(versions: Version[], initial: number, ts: number): { value: number; ts: number } {
    let best: Version | null = null;
    for (const version of versions) {
        if (version.committed && version.ts <= ts && (best === null || version.ts > best.ts)) {
            best = version;
        }
    }
    return best === null ? { value: initial, ts: 0 } : { value: best.value, ts: best.ts };
}

/** Build one cell per data row. */
function makeCells(
    names: string[],
    versions: Version[][],
    initial: number[],
    locks: Set<number>,
    committed: Set<number>,
    conflict: number,
    readTs: number,
): VisualEntity[] {
    return names.map((name, index) => {
        const state: EntityState = index === conflict
            ? "error"
            : committed.has(index)
                ? "sorted"
                : locks.has(index)
                    ? "comparing"
                    : "idle";
        const visible = visibleValue(versions[index] ?? [], initial[index] ?? 0, readTs);
        return {
            id: `cell-${index}`,
            type: "cell" as const,
            label: `${name}:${visible.value}@${visible.ts}`,
            value: visible.value,
            state,
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: { row: index, col: 0, name, visible: visible.value, versionTs: visible.ts, locked: locks.has(index) },
        };
    });
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as Input | null) ?? {};
    const names = Array.isArray(task.rows) && task.rows.length > 0
        ? task.rows.filter((name): name is string => typeof name === "string").slice(0, 6)
        : DEFAULT_ROWS;
    const n = Math.max(1, names.length);
    const initial = Array.from({ length: n }, (_, i) => {
        const value = task.initial?.[i];
        return typeof value === "number" && Number.isFinite(value) ? value : (DEFAULT_INITIAL[i] ?? 0);
    });
    const writes = Array.from({ length: n }, (_, i) => {
        const value = task.writes?.[i];
        if (value === null) {
            return null;
        }
        return typeof value === "number" && Number.isFinite(value) ? value : (DEFAULT_WRITES[i] ?? null);
    });
    const targets = writes.map((value, i) => (value === null ? -1 : i)).filter((i) => i >= 0);
    const startTs = typeof task.startTs === "number" && Number.isFinite(task.startTs) ? Math.floor(task.startTs) : 10;
    const commitTs = typeof task.commitTs === "number" && Number.isFinite(task.commitTs) && task.commitTs > startTs
        ? Math.floor(task.commitTs)
        : startTs + 1;
    const conflict = typeof task.conflictRow === "number" && Number.isFinite(task.conflictRow)
        ? Math.max(-1, Math.min(n - 1, Math.floor(task.conflictRow)))
        : -1;

    const versions: Version[][] = Array.from({ length: n }, () => []);
    const locks = new Set<number>();
    const committed = new Set<number>();
    const primary = targets[0] ?? -1;
    let errorRow = -1;
    let aborted = false;
    let readTs = startTs;
    const snapshotReads: string[] = [];

    const meta = (last: string, done: boolean) => ({
        rows: n,
        cols: 1,
        rowNames: [...names],
        initial: [...initial],
        writes: writes.map((value) => (value === null ? "-" : String(value))),
        startTs,
        commitTs,
        primary: primary >= 0 ? (names[primary] ?? "") : "",
        locks: [...locks].sort((a, b) => a - b).map((i) => names[i] ?? ""),
        committed: [...committed].sort((a, b) => a - b).map((i) => names[i] ?? ""),
        versions: versions.map((list) =>
            list.map((v) => `${v.value}@${v.ts}${v.committed ? "c" : "t"}`).join(";")),
        snapshotReads: [...snapshotReads],
        conflict: errorRow >= 0 ? (names[errorRow] ?? "") : "",
        aborted,
        readTs,
        last,
        done,
    });

    yield {
        stepNumber: 0,
        entities: makeCells(names, versions, initial, locks, committed, errorRow, readTs),
        edges: [],
        description: `Percolator transaction over ${n} rows: prewrite tentative values, then commit them at one stamp.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: meta("configured", false),
    };

    const readRow = primary >= 0 ? primary : 0;
    snapshotReads.push(`${names[readRow]}@${startTs} = ${visibleValue(versions[readRow] ?? [], initial[readRow] ?? 0, startTs).value}`);
    yield {
        stepNumber: 1,
        entities: makeCells(names, versions, initial, locks, committed, errorRow, readTs),
        edges: [],
        description: `The timestamp oracle returns start stamp ${startTs}; the snapshot read sees the pre-transaction value.`,
        codeLineNumber: 1,
        layout: "grid",
        meta: meta("snapshot read", false),
    };

    let step = 2;
    for (const index of targets) {
        if (index === conflict) {
            errorRow = index;
            aborted = true;
            yield {
                stepNumber: step++,
                entities: makeCells(names, versions, initial, locks, committed, errorRow, readTs),
                edges: [],
                description: `Row ${names[index]} already carries another transaction's lock, so the whole transaction aborts.`,
                codeLineNumber: 3,
                layout: "grid",
                meta: meta("aborted on conflict", false),
            };
            for (const locked of locks) {
                (versions[locked] ?? []).pop();
            }
            locks.clear();
            break;
        }
        const value = writes[index] ?? 0;
        (versions[index] ?? []).push({ value, ts: startTs, committed: false });
        locks.add(index);
        yield {
            stepNumber: step++,
            entities: makeCells(names, versions, initial, locks, committed, errorRow, readTs),
            edges: [],
            description: `Prewrite ${names[index]} = ${value} with a ${index === primary ? "primary" : "secondary"} lock at stamp ${startTs}.`,
            codeLineNumber: 2,
            layout: "grid",
            meta: meta(`prewrote ${names[index]}`, false),
        };
    }

    if (!aborted) {
        const commitOrder = [primary, ...targets.filter((i) => i !== primary)];
        for (const index of commitOrder) {
            locks.delete(index);
            committed.add(index);
            const version = (versions[index] ?? []).find((v) => !v.committed && v.ts === startTs);
            if (version) {
                version.committed = true;
                version.ts = commitTs;
            }
            yield {
                stepNumber: step++,
                entities: makeCells(names, versions, initial, locks, committed, errorRow, readTs),
                edges: [],
                description: `Commit record for ${names[index]} written at stamp ${commitTs}; ${index === primary ? "primary first" : "secondary follows"}.`,
                codeLineNumber: 4,
                layout: "grid",
                meta: meta(`committed ${names[index]}`, false),
            };
        }

        readTs = commitTs - 1;
        const before = visibleValue(versions[readRow] ?? [], initial[readRow] ?? 0, readTs);
        snapshotReads.push(`${names[readRow]}@${readTs} = ${before.value}`);
        yield {
            stepNumber: step++,
            entities: makeCells(names, versions, initial, locks, committed, errorRow, readTs),
            edges: [],
            description: `A snapshot just before commit still reads ${names[readRow]} = ${before.value} from the old version.`,
            codeLineNumber: 5,
            layout: "grid",
            meta: meta("before commit snapshot", false),
        };

        readTs = commitTs;
        const after = visibleValue(versions[readRow] ?? [], initial[readRow] ?? 0, readTs);
        snapshotReads.push(`${names[readRow]}@${readTs} = ${after.value}`);
        yield {
            stepNumber: step++,
            entities: makeCells(names, versions, initial, locks, committed, errorRow, readTs),
            edges: [],
            description: `At stamp ${commitTs} the snapshot reads the newly committed value ${after.value}.`,
            codeLineNumber: 6,
            layout: "grid",
            meta: meta("after commit snapshot", false),
        };
    } else {
        readTs = commitTs;
    }

    yield {
        stepNumber: step,
        entities: makeCells(names, versions, initial, locks, committed, errorRow, readTs),
        edges: [],
        description: aborted
            ? `Transaction aborted with no committed versions; every written row keeps its original value.`
            : `All ${targets.length} written rows became visible atomically at stamp ${commitTs}.`,
        codeLineNumber: 7,
        layout: "grid",
        meta: meta("done", true),
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Percolator does not lock rows before doing work. It reads a snapshot, writes tentative values with locks, and then flips a commit switch. The trick is one primary row: once its commit record is written, every other row can be inferred to be committed at the same stamp. If another transaction already holds a lock, the whole attempt is abandoned rather than leaving half a change behind.",
        invariants: [
            "Every tentative version carries the start stamp until it is committed.",
            "The primary row commits first and all secondaries share its commit stamp.",
            "A snapshot read returns the newest committed version at or before its stamp.",
        ],
        correctness:
            "Prewrite installs a lock on every written row before any commit, so a conflicting writer sees the lock and aborts instead of overwriting. Once all locks are held, writing the primary commit record makes the transaction decidable; each secondary version is then marked committed at the same stamp, giving atomic visibility. A snapshot read selects the maximum committed stamp not exceeding its own, so a read before the commit stamp sees the old version and a read at or after it sees the new one. Aborting removes all tentative versions, so no partial state remains.",
        complexityRationale:
            "Prewrite touches each of the w written rows once and commit writes one record per row, so time is O(w). Locks and tentative versions occupy O(w) extra space beyond the version store.",
        uses: [
            "Cross-row transactions on a versioned key-value store",
            "Optimistic concurrency control with snapshot reads",
            "Teaching the primary-lock commit protocol used in large-scale data systems",
        ],
        references: [
            "Peng and Dabek, Large-Scale Incremental Processing Using Distributed Transactions and Notifications, 2010",
            "Bernstein and Newcomer, Principles of Distributed Database Systems, chapter on concurrency control",
        ],
        workedExample:
            "Rows A, B, C start at 5, 7, 9 and the transaction writes B = 20 and C = 30 with start stamp 10. Prewrite adds locked tentative versions at stamp 10 with B primary. Commit flips both to committed at stamp 11. A read at stamp 10 sees 7 for B, while a read at stamp 11 sees 20; if B had been locked by another writer, prewrite would abort and both rows would stay at their original values.",
    },
    id: "percolator",
    name: "Percolator Distributed Transaction",
    category: "parallel-distributed",
    complexity: { time: "O(w)", space: "O(w)" },
    defaultInput: {
        rows: DEFAULT_ROWS,
        initial: DEFAULT_INITIAL,
        writes: DEFAULT_WRITES,
        startTs: 10,
        commitTs: 11,
        conflictRow: null,
    },
    visualType: "grid",
    run,
    pseudocode: [
        "ask the oracle for a start timestamp",
        "read the snapshot at the start timestamp",
        "prewrite each written row with a lock and tentative value",
        "abort if any row already holds a conflicting lock",
        "write the primary commit record at the commit timestamp",
        "write the secondary commit records at the same timestamp",
        "verify reads before and after the commit timestamp",
        "done: report atomic visibility or a clean abort",
    ],
};

export default module;
