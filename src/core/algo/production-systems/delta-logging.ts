/**
 * delta-logging.ts - Delta Logging with Redo and Undo Replay
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * A delta log records, for every write, the old and new value of the affected
 * page instead of copying the whole page. Replaying the new values forward
 * reconstructs the committed state (redo); replaying the old values backward
 * restores the starting state (undo). This is the record structure behind
 * write-ahead logging and replication log shipping, shown here on tiny pages.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(m) for m writes, plus O(m) for each replay pass
 *   Space: O(m + p) for the log records and p pages
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Row zero holds the live page values; row one holds the delta records.
 *   - A write highlights its page; replay highlights the record being applied.
 *   - meta carries the forward and backward reconstructed states.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface DeltaInput {
    pages?: Record<string, number>;
    writes?: Array<{ page: string; value: number }>;
}

interface Delta {
    page: string;
    before: number;
    after: number;
}

const DEFAULT_PAGES: Record<string, number> = { A: 10, B: 20, C: 30, D: 40 };
const DEFAULT_WRITES = [
    { page: "B", value: 25 },
    { page: "A", value: 12 },
    { page: "B", value: 30 },
    { page: "D", value: 44 },
    { page: "C", value: 33 },
];

function cell(id: string, row: number, col: number, label: string, value: string | number, state: EntityState): VisualEntity {
    return { id, type: "cell", label, value, state, x: 0, y: 0, width: 0, height: 0, metadata: { row, col } };
}

const snapshot = (pages: Map<string, number>): string[] =>
    [...pages.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([key, value]) => `${key}:${value}`);

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as DeltaInput | null) ?? {};
    const base = new Map<string, number>(
        Object.entries(task.pages && Object.keys(task.pages).length > 0 ? task.pages : DEFAULT_PAGES).map(([k, v]) => [k, Number(v)]),
    );
    const writes: Delta[] = (Array.isArray(task.writes) && task.writes.length > 0 ? task.writes : DEFAULT_WRITES).map((w) => ({
        page: w.page,
        before: base.get(w.page) ?? 0,
        after: Number(w.value),
    }));
    const live = new Map(base);
    const log: Delta[] = [];
    let step = 0;
    const cols = Math.max(base.size, writes.length, 1);
    const emit = (entities: VisualEntity[], description: string, line: number, meta: VisualFrame["meta"]): VisualFrame => ({
        stepNumber: step++,
        entities,
        edges: [],
        description,
        codeLineNumber: line,
        layout: "grid",
        meta: { rows: 3, cols, ...meta },
    });
    const liveCells = (highlight: string | null): VisualEntity[] =>
        snapshot(live).map((entry, i) => cell(`page-${i}`, 0, i, entry, entry, entry.startsWith(`${highlight}:`) ? "active" : "visited"));
    const logCells = (active: number): VisualEntity[] =>
        log.map((d, i) => cell(`log-${i}`, 1, i, `${d.page}:${d.before}->${d.after}`, `${d.page}:${d.before}->${d.after}`, i === active - 1 ? "active" : "idle"));

    yield emit(liveCells(null), `Starting with ${base.size} page(s); an empty delta log.`, 0, {
        stage: "init",
        base: snapshot(base),
        log: [],
    });

    for (let i = 0; i < writes.length; i += 1) {
        const delta = writes[i] as Delta;
        delta.before = live.get(delta.page) ?? 0;
        live.set(delta.page, delta.after);
        log.push(delta);
        yield emit([...liveCells(delta.page), ...logCells(log.length)], `Wrote page ${delta.page}: ${delta.before} -> ${delta.after}; appended one delta record.`, 1, {
            stage: "write",
            live: snapshot(live),
            log: log.map((d) => `${d.page}:${d.before}->${d.after}`),
        });
    }

    const redo = new Map(base);
    for (let i = 0; i < log.length; i += 1) {
        const delta = log[i] as Delta;
        redo.set(delta.page, delta.after);
        yield emit(
            [...snapshot(redo).map((entry, k) => cell(`redo-${k}`, 0, k, entry, entry, entry.startsWith(`${delta.page}:`) ? "active" : "idle")), ...logCells(i + 1)],
            `Redo ${i + 1}/${log.length}: applied new value ${delta.after} to page ${delta.page}.`,
            2,
            { stage: "redo", state: snapshot(redo) },
        );
    }

    const undo = new Map(redo);
    for (let i = log.length - 1; i >= 0; i -= 1) {
        const delta = log[i] as Delta;
        undo.set(delta.page, delta.before);
        yield emit(
            [...snapshot(undo).map((entry, k) => cell(`undo-${k}`, 0, k, entry, entry, entry.startsWith(`${delta.page}:`) ? "active" : "idle")), ...logCells(i + 1)],
            `Undo ${log.length - i}/${log.length}: restored old value ${delta.before} to page ${delta.page}.`,
            3,
            { stage: "undo", state: snapshot(undo) },
        );
    }

    yield emit(
        [
            ...snapshot(redo).map((entry, k) => cell(`final-${k}`, 0, k, entry, entry, "sorted")),
            ...snapshot(undo).map((entry, k) => cell(`restored-${k}`, 2, k, entry, entry, "sorted")),
        ],
        `Done: ${log.length} delta record(s); redo matches committed state and undo matches the original.`,
        4,
        { stage: "done", base: snapshot(base), committed: snapshot(redo), restored: snapshot(undo), log: log.map((d) => `${d.page}:${d.before}->${d.after}`) },
    );
}

/** The delta logging module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "Copying an entire page for every change is expensive. A delta log writes only the difference: which page changed and what its old and new values were. Reading the new values in order rebuilds the latest state; reading the old values in reverse rewinds to the beginning. The same log therefore supports both recovery and rollback.",
        invariants: [
            "Each log record captures the page value immediately before and after one write.",
            "Applying all new values to the base yields the committed state.",
            "Applying all old values in reverse yields the original state.",
        ],
        correctness:
            "By induction over the write sequence, after record i the live store equals the base with the first i writes applied, because each step overwrites exactly one page with the recorded new value. The redo pass repeats those same substitutions and ends at the committed state. The undo pass walks the records backward, restoring each page to the value it held before that write; since later writes to the same page are undone first, the final restored value is the original one.",
        complexityRationale:
            "Each of the m writes appends one record and updates one page, so writing costs O(m) time and O(m) space for the log. Each replay pass scans the m records once, for O(m) time and O(p) space for p pages.",
        uses: [
            "Write-ahead logs in database recovery",
            "Change data capture streams that replicate row deltas",
            "Undo and redo stacks in editors and transactional memory",
        ],
        references: [
            "Gray and Reuter, Transaction Processing: Concepts and Techniques, 1993",
            "Ramakrishnan and Gehrke, Database Management Systems, Chapter on recovery",
        ],
        workedExample:
            "Starting from A:10, B:20, a write of B=25 appends B:20->25 and a second write of B=30 appends B:25->30. Redo applies 25 then 30 to reach B:30. Undo restores 25 then 20, returning B to its original 20.",
    },
    id: "delta-logging",
    name: "Delta Logging",
    category: "production-systems",
    complexity: { time: "O(m)", space: "O(m + p)" },
    defaultInput: { pages: DEFAULT_PAGES, writes: DEFAULT_WRITES },
    visualType: "grid",
    run,
    pseudocode: [
        "capture the initial values of all pages",
        "for each write record the old and new page value",
        "append the delta record and update the live page",
        "redo: replay each new value from the base",
        "undo: replay each old value in reverse from the committed state",
        "done: report the committed and restored states",
    ],
};

export default module;
