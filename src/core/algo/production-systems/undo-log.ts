/**
 * undo-log.ts - Undo Logging (Deferred Database Recovery)
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * An undo log records the before-image of every value a transaction changes.
 * Updates are applied to the in-memory database immediately, but the log is
 * forced to stable storage first. If the transaction aborts, the log is read
 * backward and each before-image is restored, returning the database to the
 * state it had before the transaction started.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(u) for u logged updates (forward pass plus one backward pass)
 *   Space: O(u) for the undo records
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Database pages are cells in the top row; their current value is shown.
 *   - Undo records are cells in the bottom row in the order they were written.
 *   - During abort the active log record and restored page are highlighted.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

type Update = { page: string; value: number };
type RecordItem = { page: string; oldValue: number };

/** Build the two-row grid of database pages and undo records. */
function buildEntities(
    pageKeys: string[],
    db: Record<string, number>,
    log: RecordItem[],
    changed: Set<string>,
    activeLog: number,
    activePage: string | null,
): VisualEntity[] {
    const cols = Math.max(pageKeys.length, log.length, 1);
    const entities: VisualEntity[] = pageKeys.map((key, col) => ({
        id: `page-${key}`,
        type: "cell" as const,
        label: `${key}:${db[key] ?? 0}`,
        value: db[key] ?? 0,
        state: (activePage === key ? "path" : changed.has(key) ? "active" : "idle") as EntityState,
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { row: 0, col, kind: "page" },
    }));
    log.forEach((item, col) => {
        entities.push({
            id: `log-${col}`,
            type: "cell" as const,
            label: `${item.page}=${item.oldValue}`,
            value: item.oldValue,
            state: (activeLog === col ? "path" : "visited") as EntityState,
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: { row: 1, col, kind: "log" },
        });
    });
    void cols;
    return entities;
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { pages?: Record<string, number>; updates?: Update[] } | null) ?? {};
    const original: Record<string, number> = { ...(task.pages ?? { A: 5, B: 10, C: 0 }) };
    const updates: Update[] = Array.isArray(task.updates)
        ? task.updates
        : [
              { page: "A", value: 8 },
              { page: "B", value: 20 },
              { page: "C", value: 3 },
          ];
    const pageKeys = Object.keys(original);
    const db: Record<string, number> = { ...original };
    const log: RecordItem[] = [];
    const changed = new Set<string>();
    let step = 0;
    let activeLog = -1;
    let activePage: string | null = null;

    yield {
        stepNumber: step++,
        entities: buildEntities(pageKeys, db, log, changed, activeLog, activePage),
        edges: [],
        description: `Starting undo logging with ${pageKeys.length} page(s) and ${updates.length} update(s).`,
        codeLineNumber: 0,
        layout: "grid",
        meta: { rows: 2, cols: Math.max(pageKeys.length, 1), db: { ...db }, logSize: 0, phase: "start" },
    };

    for (let i = 0; i < updates.length; i += 1) {
        const update = updates[i];
        if (!update) continue;
        if (!(update.page in db)) db[update.page] = 0;
        if (!pageKeys.includes(update.page)) pageKeys.push(update.page);
        const oldValue = db[update.page] ?? 0;
        log.push({ page: update.page, oldValue });
        db[update.page] = update.value;
        changed.add(update.page);
        activeLog = log.length - 1;
        activePage = update.page;
        yield {
            stepNumber: step++,
            entities: buildEntities(pageKeys, db, log, changed, activeLog, activePage),
            edges: [],
            description: `Update ${i + 1}: forced undo record for ${update.page} (old ${oldValue}), then wrote ${update.value}.`,
            codeLineNumber: 2,
            layout: "grid",
            meta: {
                rows: 2,
                cols: Math.max(pageKeys.length, log.length, 1),
                db: { ...db },
                logSize: log.length,
                phase: "forward",
                index: i,
            },
        };
    }

    activePage = null;
    activeLog = -1;
    yield {
        stepNumber: step++,
        entities: buildEntities(pageKeys, db, log, changed, activeLog, activePage),
        edges: [],
        description: `Transaction aborts. Replaying ${log.length} undo record(s) in reverse order.`,
        codeLineNumber: 4,
        layout: "grid",
        meta: { rows: 2, cols: Math.max(pageKeys.length, log.length, 1), db: { ...db }, logSize: log.length, phase: "abort" },
    };

    for (let i = log.length - 1; i >= 0; i -= 1) {
        const item = log[i];
        if (!item) continue;
        db[item.page] = item.oldValue;
        changed.delete(item.page);
        activeLog = i;
        activePage = item.page;
        yield {
            stepNumber: step++,
            entities: buildEntities(pageKeys, db, log, changed, activeLog, activePage),
            edges: [],
            description: `Undo record ${i}: restored ${item.page} to its before-image ${item.oldValue}.`,
            codeLineNumber: 5,
            layout: "grid",
            meta: {
                rows: 2,
                cols: Math.max(pageKeys.length, log.length, 1),
                db: { ...db },
                logSize: log.length,
                phase: "undo",
                index: i,
            },
        };
    }

    const restored = pageKeys.every((key) => db[key] === original[key]);
    yield {
        stepNumber: step++,
        entities: buildEntities(pageKeys, db, log, changed, -1, null),
        edges: [],
        description: `Undo complete: database ${restored ? "matches" : "does not match"} its original state.`,
        codeLineNumber: 6,
        layout: "grid",
        meta: { rows: 2, cols: Math.max(pageKeys.length, log.length, 1), db: { ...db }, original: { ...original }, logSize: log.length, phase: "done", restored },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Before changing a value, write down what it used to be. If the transaction fails, read those notes in reverse order and put the old values back. Because the last change is undone first, the database ends up exactly where it started.",
        invariants: [
            "Every applied update has a matching undo record holding its before-image.",
            "Undo records are replayed in the reverse of the order they were written.",
            "After a full undo each page equals its original value.",
        ],
        correctness:
            "Each undo record stores the value a page held immediately before its update. Reversing the update sequence means the last update is undone first, so when a record is replayed the page holds exactly the value that was captured in that record. Restoring it therefore returns the page to its state one step earlier; by induction over the reversed log, after all records are replayed every page equals its pre-transaction value.",
        complexityRationale:
            "The forward pass performs one log write and one page write per update, and the abort pass reads each record once in reverse, so time is O(u). The log holds one before-image per update, giving O(u) space.",
        uses: [
            "Abort handling in transactional database systems",
            "Crash recovery for transactions that have not committed",
            "Teaching the difference between undo and redo recovery",
        ],
        references: [
            "Ramakrishnan and Gehrke, Database Management Systems, recovery chapter",
            "Bernstein, Hadzilacos and Goodman, Concurrency Control and Recovery in Database Systems",
        ],
        workedExample:
            "Pages A=5, B=10. An update sets A=8 (undo record A=5) then B=20 (undo record B=10). On abort, undo B first back to 10, then A back to 5, restoring the original state.",
    },
    id: "undo-log",
    name: "Undo Log (Deferred Recovery)",
    category: "production-systems",
    complexity: { time: "O(u)", space: "O(u)" },
    defaultInput: {
        pages: { A: 5, B: 10, C: 0 },
        updates: [
            { page: "A", value: 8 },
            { page: "B", value: 20 },
            { page: "C", value: 3 },
        ],
    },
    visualType: "grid",
    run,
    pseudocode: [
        "copy the database pages into working memory",
        "for each update in the transaction",
        "append a log record holding the page's old value",
        "apply the new value to the page",
        "on abort, scan the log from the last record to the first",
        "restore each page to the old value in its record",
        "done: every page equals its pre-transaction value",
    ],
};

export default module;
