/**
 * redo-log.ts - Redo Logging (Immediate Database Recovery)
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * A redo log records the after-image of every value a transaction changes.
 * The log is forced to stable storage before pages are written. If a crash
 * happens after the commit record reaches the log but before the dirty pages
 * reach disk, recovery replays the redo records and reconstructs the committed
 * state. Records for transactions that never committed are ignored.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(u) for u redo records written and replayed
 *   Space: O(u) for the redo log
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Database pages are cells in the top row; the in-memory value is shown.
 *   - Redo (after-image) records are cells in the bottom row.
 *   - A simulated crash resets pages to before-images, then replay repaints them.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

type Update = { page: string; value: number };

/** Build the page row and the redo-log row. */
function buildEntities(
    pageKeys: string[],
    db: Record<string, number>,
    log: Update[],
    activeLog: number,
    activePage: string | null,
): VisualEntity[] {
    const entities: VisualEntity[] = pageKeys.map((key, col) => ({
        id: `page-${key}`,
        type: "cell" as const,
        label: `${key}:${db[key] ?? 0}`,
        value: db[key] ?? 0,
        state: (activePage === key ? "path" : "idle") as EntityState,
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
            label: `${item.page}=${item.value}`,
            value: item.value,
            state: (activeLog === col ? "path" : "visited") as EntityState,
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: { row: 1, col, kind: "log" },
        });
    });
    return entities;
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { pages?: Record<string, number>; updates?: Update[] } | null) ?? {};
    const before: Record<string, number> = { ...(task.pages ?? { A: 5, B: 10, C: 0 }) };
    const updates: Update[] = Array.isArray(task.updates)
        ? task.updates
        : [
              { page: "A", value: 8 },
              { page: "B", value: 20 },
              { page: "C", value: 3 },
          ];
    const pageKeys = Object.keys(before);
    for (const update of updates) {
        if (!(update.page in before)) before[update.page] = 0;
        if (!pageKeys.includes(update.page)) pageKeys.push(update.page);
    }
    const db: Record<string, number> = { ...before };
    const log: Update[] = [];
    let step = 0;
    let activeLog = -1;
    let activePage: string | null = null;

    yield {
        stepNumber: step++,
        entities: buildEntities(pageKeys, db, log, activeLog, activePage),
        edges: [],
        description: `Starting redo logging with ${pageKeys.length} page(s) and ${updates.length} update(s).`,
        codeLineNumber: 0,
        layout: "grid",
        meta: { rows: 2, cols: Math.max(pageKeys.length, 1), db: { ...db }, logSize: 0, phase: "start" },
    };

    for (let i = 0; i < updates.length; i += 1) {
        const update = updates[i];
        if (!update) continue;
        log.push({ page: update.page, value: update.value });
        activeLog = log.length - 1;
        activePage = update.page;
        yield {
            stepNumber: step++,
            entities: buildEntities(pageKeys, db, log, activeLog, activePage),
            edges: [],
            description: `Forced redo record ${i + 1}: ${update.page} will become ${update.value} after commit.`,
            codeLineNumber: 2,
            layout: "grid",
            meta: {
                rows: 2,
                cols: Math.max(pageKeys.length, log.length, 1),
                db: { ...db },
                logSize: log.length,
                phase: "logging",
                index: i,
            },
        };
    }

    activeLog = -1;
    activePage = null;
    yield {
        stepNumber: step++,
        entities: buildEntities(pageKeys, db, log, activeLog, activePage),
        edges: [],
        description: `Commit record is forced to the log; ${log.length} redo record(s) are now durable.`,
        codeLineNumber: 3,
        layout: "grid",
        meta: { rows: 2, cols: Math.max(pageKeys.length, log.length, 1), db: { ...db }, logSize: log.length, phase: "commit" },
    };

    for (let i = 0; i < pageKeys.length; i += 1) {
        const key = pageKeys[i];
        if (key) db[key] = before[key] ?? 0;
    }
    yield {
        stepNumber: step++,
        entities: buildEntities(pageKeys, db, log, activeLog, activePage),
        edges: [],
        description: "Simulated crash: dirty pages were lost, so the on-disk values are the before-images.",
        codeLineNumber: 4,
        layout: "grid",
        meta: { rows: 2, cols: Math.max(pageKeys.length, log.length, 1), db: { ...db }, logSize: log.length, phase: "crash" },
    };

    for (let i = 0; i < log.length; i += 1) {
        const item = log[i];
        if (!item) continue;
        db[item.page] = item.value;
        activeLog = i;
        activePage = item.page;
        yield {
            stepNumber: step++,
            entities: buildEntities(pageKeys, db, log, activeLog, activePage),
            edges: [],
            description: `Redo record ${i}: wrote after-image ${item.value} back to page ${item.page}.`,
            codeLineNumber: 5,
            layout: "grid",
            meta: {
                rows: 2,
                cols: Math.max(pageKeys.length, log.length, 1),
                db: { ...db },
                logSize: log.length,
                phase: "replay",
                index: i,
            },
        };
    }

    const expected: Record<string, number> = { ...before };
    for (const update of updates) expected[update.page] = update.value;
    const recovered = pageKeys.every((key) => db[key] === expected[key]);
    yield {
        stepNumber: step++,
        entities: buildEntities(pageKeys, db, log, -1, null),
        edges: [],
        description: `Redo complete: recovery ${recovered ? "reconstructed" : "failed to reconstruct"} the committed state.`,
        codeLineNumber: 6,
        layout: "grid",
        meta: { rows: 2, cols: Math.max(pageKeys.length, log.length, 1), db: { ...db }, logSize: log.length, phase: "done", recovered },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Write down the value each change will produce, and make sure that record is durable before telling anyone the transaction committed. If a crash erases the changed pages, recovery simply reads those after-images and writes them again. Replaying the same after-image twice is harmless, which makes redo idempotent.",
        invariants: [
            "A redo record holds the after-image of one page update.",
            "The commit record is forced to storage before any page is trusted.",
            "Replaying every committed redo record yields the committed database state.",
        ],
        correctness:
            "Each redo record stores the exact value a page should hold after its committed update. Recovery starts from the crashed on-disk state and applies each committed after-image in log order. Because the last write to a page in the log is its final committed value, replaying the whole log sets every page to that final value. Applying an after-image more than once leaves the page unchanged, so recovery is idempotent even if it restarts.",
        complexityRationale:
            "Writing the log touches one record per update and recovery replays each record once, so time is O(u). The log stores one after-image per update, giving O(u) space.",
        uses: [
            "Crash recovery for committed transactions in database engines",
            "Write-ahead logging implementations with force-at-commit policies",
            "ARIES-style restart replay of durable log records",
        ],
        references: [
            "Ramakrishnan and Gehrke, Database Management Systems, recovery chapter",
            "Mohan et al., ARIES: A Transaction Recovery Method, ACM TODS 1992",
        ],
        workedExample:
            "Pages A=5, B=10. Redo records (A=8) and (B=20) are forced, then commit. A crash restores A=5 and B=10. Replay writes A=8 then B=20, reconstructing the committed state.",
    },
    id: "redo-log",
    name: "Redo Log (Immediate Recovery)",
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
        "read the original page values",
        "for each update in the transaction",
        "force a redo record with the page's new value",
        "force the commit record to stable storage",
        "on restart, reload the lost on-disk pages",
        "for each committed redo record, rewrite its after-image",
        "done: pages hold the committed values",
    ],
};

export default module;
