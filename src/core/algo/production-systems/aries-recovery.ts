/**
 * aries-recovery.ts - ARIES Database Recovery
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * ARIES (Algorithm for Recovery and Isolation Exploiting Semantics) restores a
 * database after a crash using a write-ahead log with log sequence numbers.
 * It has three phases. Analysis classifies transactions as winners (committed)
 * or losers (still active at the crash). Redo repeats history: every update,
 * even those of losers, is reapplied so the log reflects the exact state at
 * the crash. Undo then rolls losers back in reverse log order, writing a
 * compensation log record (CLR) for each undone update so the undo itself is
 * never repeated after a second crash.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(L) for L log records
 *   Space: O(L + P) for the log, CLRs, and P pages
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - One cell per data page shows its current value.
 *   - The page touched in the current phase is highlighted.
 *   - meta carries the phase, transaction sets, and CLR count.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface LogRecord {
    lsn: number;
    type: "BEGIN" | "UPDATE" | "COMMIT" | "ABORT";
    tx: string;
    page?: string;
    old?: number;
    value?: number;
}

interface Input {
    pages?: Record<string, number>;
    log?: LogRecord[];
}

const DEFAULT_PAGES: Record<string, number> = { A: 5, B: 10, C: 0 };
const DEFAULT_LOG: LogRecord[] = [
    { lsn: 1, type: "BEGIN", tx: "T1" },
    { lsn: 2, type: "UPDATE", tx: "T1", page: "A", old: 5, value: 8 },
    { lsn: 3, type: "BEGIN", tx: "T2" },
    { lsn: 4, type: "UPDATE", tx: "T2", page: "B", old: 10, value: 20 },
    { lsn: 5, type: "COMMIT", tx: "T1" },
    { lsn: 6, type: "UPDATE", tx: "T2", page: "C", old: 0, value: 3 },
];

function makeCells(
    names: string[],
    values: Record<string, number>,
    highlight: string | null,
    state: EntityState,
): VisualEntity[] {
    return names.map((name, index) => ({
        id: `page-${index}`,
        type: "cell" as const,
        label: `${name}:${values[name] ?? 0}`,
        value: values[name] ?? 0,
        state: name === highlight ? state : "idle",
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { row: 0, col: index, name },
    }));
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as Input | null) ?? {};
    const pages: Record<string, number> = { ...(task.pages ?? DEFAULT_PAGES) };
    const log: LogRecord[] = task.log ?? DEFAULT_LOG;
    const names = Object.keys(pages);
    const working: Record<string, number> = { ...pages };
    let step = 0;

    const snap = (
        description: string,
        line: number,
        phase: string,
        highlight: string | null,
        state: EntityState,
        committed: string[],
        losers: string[],
        clrs: number,
    ): VisualFrame => ({
        stepNumber: step,
        entities: makeCells(names, working, highlight, state),
        edges: [],
        description,
        codeLineNumber: line,
        layout: "grid",
        meta: {
            pages: [...names],
            pageValues: names.map((name) => working[name] ?? 0),
            phase,
            committed,
            losers,
            clrs,
            logLength: log.length,
        },
    });

    yield snap(
        `Starting ARIES recovery on ${log.length} log records for ${names.length} page(s).`,
        0,
        "analysis",
        null,
        "idle",
        [],
        [],
        0,
    );
    step += 1;

    // Analysis: committed winners and active losers.
    const committedSet = new Set<string>();
    const seen = new Set<string>();
    for (const record of log) {
        if (record.type === "COMMIT") {
            committedSet.add(record.tx);
        }
        if (record.type === "BEGIN" || record.type === "UPDATE") {
            seen.add(record.tx);
        }
    }
    const loserSet = new Set<string>([...seen].filter((tx) => !committedSet.has(tx)));
    const committed = [...committedSet];
    const losers = [...loserSet];
    yield snap(
        `Analysis: winners ${committed.join(",") || "none"}; losers ${losers.join(",") || "none"}.`,
        0,
        "analysis",
        null,
        "idle",
        committed,
        losers,
        0,
    );
    step += 1;

    // Redo: repeat history - reapply every update in log order, including losers.
    for (const record of log) {
        if (record.type !== "UPDATE" || !record.page || record.value === undefined) {
            continue;
        }
        working[record.page] = record.value;
        yield snap(
            `Redo LSN ${record.lsn}: repeat history, set page ${record.page} to ${record.value}.`,
            2,
            "redo",
            record.page,
            "comparing",
            committed,
            losers,
            0,
        );
        step += 1;
    }

    // Undo: roll losers back in reverse log order, emitting a CLR per update.
    let clrCount = 0;
    const updates = log.filter((record) => record.type === "UPDATE" && loserSet.has(record.tx));
    updates.sort((a, b) => b.lsn - a.lsn);
    for (const record of updates) {
        if (!record.page || record.old === undefined) {
            continue;
        }
        working[record.page] = record.old;
        clrCount += 1;
        yield snap(
            `Undo LSN ${record.lsn} (${record.tx}): restore page ${record.page} to ${record.old}; write CLR ${clrCount}.`,
            5,
            "undo",
            record.page,
            "swapped",
            committed,
            losers,
            clrCount,
        );
        step += 1;
    }

    yield snap(
        `Recovery complete: ${committed.length} winner(s) kept, ${losers.length} loser(s) rolled back with ${clrCount} CLR(s).`,
        7,
        "done",
        null,
        "sorted",
        committed,
        losers,
        clrCount,
    );
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Crash recovery is easier when the log records exactly what happened and the system can replay that history before deciding what to keep. ARIES first repeats every logged action so the database matches the instant of the crash, then undoes only the work of transactions that never committed. Compensation log records make each undo step permanent so a second crash cannot resurrect rolled-back data.",
        invariants: [
            "A log record is written before the corresponding page change reaches disk.",
            "During redo every update in the log is reapplied, regardless of transaction outcome.",
            "Undo processes loser updates in strictly decreasing log sequence number order.",
            "Each undone update produces one compensation log record.",
        ],
        correctness:
            "Redo brings every page to its crash-time value because it replays updates in log order. Undo then visits each loser update in reverse order, restoring the before-image recorded for that update; reversing the order is essential when a transaction updated the same page more than once. Winners are never undone, so their committed values survive. Compensation log records record that an undo was performed, making undo idempotent across repeated crashes.",
        complexityRationale:
            "Analysis, redo, and undo each scan at most a constant number of passes over the L log records, giving O(L) time. Storing the log, the transaction sets, and the compensation records uses O(L + P) space for P pages.",
        uses: [
            "ARIES-style recovery in transactional database engines such as DB2 and SQL Server descendants",
            "Crash recovery in systems that allow steal/no-force buffer management",
            "Teaching the distinction between repeating history and undoing losers",
        ],
        references: [
            "Mohan et al., ARIES: A Transaction Recovery Method Supporting Fine-Granularity Locking, ACM TODS 1992",
            "Ramakrishnan and Gehrke, Database Management Systems, recovery chapter",
        ],
        workedExample:
            "With pages A=5, B=10, C=0 and a log where T1 commits an update A=8 while T2 writes B=20 and C=3 without committing, redo sets A=8, B=20, C=3. Analysis finds T2 a loser, so undo restores C=0 then B=10, writing two CLRs. The final recovered state is A=8, B=10, C=0.",
    },
    id: "aries-recovery",
    name: "ARIES Recovery",
    category: "production-systems",
    complexity: { time: "O(L)", space: "O(L + P)" },
    defaultInput: { pages: DEFAULT_PAGES, log: DEFAULT_LOG },
    visualType: "grid",
    run,
    pseudocode: [
        "collect committed winners and active losers from the log",
        "set the redo point to the earliest logged update",
        "repeat history: reapply every update in log order",
        "keep the before-image of each loser update",
        "undo loser updates in reverse log sequence order",
        "write a compensation log record for each undone update",
        "leave all committed winner changes in place",
        "done: report recovered page values and CLR count",
    ],
};

export default module;
