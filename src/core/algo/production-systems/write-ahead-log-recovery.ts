/**
 * write-ahead-log-recovery.ts - Write-Ahead Log Recovery
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * A database writes a log record before changing a data page, so a crash can be
 * repaired by replaying the log. This teaching model performs the three classic
 * recovery phases: analysis identifies committed and uncommitted transactions,
 * redo reapplies the updates of committed transactions in log order, and undo
 * reverts the updates of transactions that never committed in reverse order.
 * The result keeps committed changes and rolls back partial ones.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(L) for L log records
 *   Space: O(L + P) for the log analysis and P data pages
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - One cell per data page shows its current value.
 *   - The page touched by the current redo or undo step is highlighted.
 *   - meta carries the log, the transaction sets, and all page values.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface LogRecord {
    type: "BEGIN" | "UPDATE" | "COMMIT" | "ABORT";
    tx: string;
    page?: string;
    old?: number;
    value?: number;
}

/** Build page-value cells. */
function makeCells(
    names: string[],
    values: number[],
    changedPage: string | null,
    phase: string,
): VisualEntity[] {
    return names.map((name, index) => {
        let state: EntityState = "idle";
        if (phase === "done") {
            state = "sorted";
        } else if (name === changedPage) {
            state = phase === "undo" ? "swapped" : "comparing";
        }
        return {
            id: `cell-${index}`,
            type: "cell" as const,
            label: `${name}=${values[index] ?? 0}`,
            value: values[index] ?? 0,
            state,
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: { row: 0, col: index, page: name, value: values[index] ?? 0 },
        };
    });
}

/** The write-ahead log recovery generator. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { pages?: Record<string, number>; log?: LogRecord[] } | null) ?? {};
    const initialPages = task.pages && typeof task.pages === "object" ? task.pages : { A: 5, B: 10, C: 0 };
    const names = Object.keys(initialPages);
    if (names.length === 0) {
        names.push("A");
    }
    const log: LogRecord[] = Array.isArray(task.log)
        ? task.log.filter((record) => record && typeof record === "object" && typeof record.type === "string")
        : [
            { type: "BEGIN", tx: "T1" },
            { type: "UPDATE", tx: "T1", page: "A", old: 5, value: 8 },
            { type: "BEGIN", tx: "T2" },
            { type: "UPDATE", tx: "T2", page: "B", old: 10, value: 20 },
            { type: "COMMIT", tx: "T1" },
            { type: "UPDATE", tx: "T2", page: "C", old: 0, value: 3 },
        ];
    const values = names.map((name) => Number(initialPages[name] ?? 0));
    const indexOf = (name: string): number => Math.max(0, names.indexOf(name));

    const committed = new Set<string>();
    const ended = new Set<string>();
    const began = new Set<string>();
    for (const record of log) {
        if (record.type === "BEGIN") {
            began.add(record.tx);
        } else if (record.type === "COMMIT") {
            committed.add(record.tx);
            ended.add(record.tx);
        } else if (record.type === "ABORT") {
            ended.add(record.tx);
        }
    }
    const uncommitted = [...began].filter((tx) => !committed.has(tx));
    const logStrings = log.map((record) => record.type === "UPDATE"
        ? `${record.type} ${record.tx} ${record.page} ${record.old}->${record.value}`
        : `${record.type} ${record.tx}`);

    const buildMeta = (phase: string, changedPage: string | null) => ({
        phase,
        rows: 1,
        cols: names.length,
        pages: [...names],
        pageValues: [...values],
        committed: [...committed],
        uncommitted: [...uncommitted],
        log: [...logStrings],
        logLength: log.length,
        changedPage: changedPage ?? "",
    });

    let step = 0;
    yield {
        stepNumber: step,
        entities: makeCells(names, values, null, "crash"),
        edges: [],
        description: `Crash state with ${log.length} log record(s); values reflect whatever was written before the crash.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: buildMeta("crash", null),
    };
    step += 1;

    yield {
        stepNumber: step,
        entities: makeCells(names, values, null, "analysis"),
        edges: [],
        description: `Analysis: committed transactions [${[...committed].join(", ") || "none"}]; uncommitted [${uncommitted.join(", ") || "none"}].`,
        codeLineNumber: 1,
        layout: "grid",
        meta: buildMeta("analysis", null),
    };
    step += 1;

    for (const record of log) {
        if (record.type !== "UPDATE" || !committed.has(record.tx)) {
            continue;
        }
        const page = record.page ?? "";
        const idx = indexOf(page);
        values[idx] = record.value ?? values[idx] ?? 0;
        yield {
            stepNumber: step,
            entities: makeCells(names, values, page, "redo"),
            edges: [],
            description: `Redo ${record.tx} on page ${page}: set ${values[idx] ?? 0} from log value ${record.value ?? 0}.`,
            codeLineNumber: 2,
            layout: "grid",
            meta: buildMeta("redo", page),
        };
        step += 1;
    }

    for (let i = log.length - 1; i >= 0; i -= 1) {
        const record = log[i];
        if (!record || record.type !== "UPDATE" || committed.has(record.tx)) {
            continue;
        }
        const page = record.page ?? "";
        const idx = indexOf(page);
        values[idx] = record.old ?? values[idx] ?? 0;
        yield {
            stepNumber: step,
            entities: makeCells(names, values, page, "undo"),
            edges: [],
            description: `Undo ${record.tx} on page ${page}: restore before-image ${record.old ?? 0}.`,
            codeLineNumber: 3,
            layout: "grid",
            meta: buildMeta("undo", page),
        };
        step += 1;
    }

    yield {
        stepNumber: step,
        entities: makeCells(names, values, null, "done"),
        edges: [],
        description: `Recovery complete: committed updates kept, uncommitted ones rolled back. Final pages ${names.map((name, i) => `${name}=${values[i] ?? 0}`).join(", ")}.`,
        codeLineNumber: 5,
        layout: "grid",
        meta: buildMeta("done", null),
    };
}

/** The write-ahead log recovery module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "Before changing a page, a database promises to write a log record describing the change. If the machine crashes, the log is the source of truth: committed work is replayed forward, and half-finished work is rolled back using before-images. The data pages end up as if transactions were atomic.",
        invariants: [
            "A log record is written before the corresponding page change reaches durable storage.",
            "Redo touches only committed transactions and follows log order.",
            "Undo touches only uncommitted transactions and follows reverse log order.",
        ],
        correctness:
            "The write-ahead rule guarantees that every change which might have reached a data page has a durable log record. Repeating history in log order reconstructs the state that included all committed updates. Undoing uncommitted updates in reverse order restores each affected page to its before-image, and reversing the order is necessary when a transaction updated the same page more than once. Because committed and uncommitted transactions are disjoint, the two phases commute and the final pages equal a serial history containing exactly the committed transactions, which is the atomicity guarantee.",
        complexityRationale:
            "Analysis scans the log once, redo scans it forward, and undo scans it backward, so the total work is O(L) plus O(P) to initialize pages. Storing the analysis sets and page values takes O(L plus P) space.",
        uses: [
            "Crash recovery in transactional databases",
            "Restart logic after an abrupt process failure",
            "The ARIES family of recovery algorithms",
        ],
        references: [
            "Mohan et al., ARIES: A Transaction Recovery Method, 1992",
            "Ramakrishnan and Gehrke, Database Management Systems, Chapter 18",
        ],
        workedExample:
            "With pages A=5, B=10, C=0, log records commit T1's update of A from 5 to 8 but crash before T2 commits. Analysis commits T1 and leaves T2 open. Redo sets A to 8; undo restores B to 10 and C to 0, so the recovered pages are A=8, B=10, C=0.",
    },
    id: "write-ahead-log-recovery",
    name: "Write-Ahead Log Recovery",
    category: "production-systems",
    complexity: { time: "O(L)", space: "O(L + P)" },
    defaultInput: {
        pages: { A: 5, B: 10, C: 0 },
        log: [
            { type: "BEGIN", tx: "T1" },
            { type: "UPDATE", tx: "T1", page: "A", old: 5, value: 8 },
            { type: "BEGIN", tx: "T2" },
            { type: "UPDATE", tx: "T2", page: "B", old: 10, value: 20 },
            { type: "COMMIT", tx: "T1" },
            { type: "UPDATE", tx: "T2", page: "C", old: 0, value: 3 },
        ],
    },
    visualType: "grid",
    run,
    pseudocode: [
        "read the log and initialize the data pages",
        "analysis: mark committed and uncommitted transactions",
        "redo: replay committed updates in log order",
        "undo: revert uncommitted updates in reverse order",
        "restore each changed page to its before-image on undo",
        "done: report the recovered page values",
    ],
};

export default module;
