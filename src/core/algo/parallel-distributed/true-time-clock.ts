/**
 * true-time-clock.ts - TrueTime and Commit Wait
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * TrueTime exposes clock uncertainty explicitly as an interval [earliest,
 * latest] rather than a single reading. A transaction assigns its commit
 * timestamp from the interval's latest bound and then waits until its local
 * earliest bound passes that timestamp. Because every later reading on any
 * node has an earliest bound beyond the committed timestamp, external
 * consistency follows without messages between the transactions.
 *
 * ---------------------------------------------------------------------------
 * Model limits
 * ---------------------------------------------------------------------------
 *   - Physical clocks are assumed synchronized within the stated uncertainty.
 *   - Transaction starts are sequential: each begins when the previous one acknowledges.
 *   - Integer time units; no clock drift during a single transaction.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(1) per transaction
 *   Space: O(1) per transaction for the emitted row
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface TransactionSpec {
    node?: string;
    offset?: number;
    uncertainty?: number;
}

interface TrueTimeInput {
    transactions?: TransactionSpec[];
}

interface TraceRow {
    node: string;
    start: number;
    earliest: number;
    latest: number;
    assigned: number;
    wait: number;
    ack: number;
}

function makeCells(rows: TraceRow[], active: number, done: boolean): VisualEntity[] {
    const entities: VisualEntity[] = [];
    for (let r = 0; r < rows.length; r += 1) {
        const row = rows[r]!;
        const values = [row.node, row.start, row.earliest, row.latest, row.assigned, row.wait, row.ack];
        for (let c = 0; c < values.length; c += 1) {
            entities.push({
                id: `cell-${r}-${c}`,
                type: "cell" as const,
                label: String(values[c]),
                value: values[c]!,
                state: done ? "sorted" : r === active ? "comparing" : "idle",
                x: 0,
                y: 0,
                width: 0,
                height: 0,
                metadata: { row: r, col: c, field: c },
            });
        }
    }
    return entities;
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as TrueTimeInput | null) ?? {};
    const specs: TransactionSpec[] = Array.isArray(task.transactions) && task.transactions.length > 0
        ? task.transactions
        : [
            { node: "A", offset: 0, uncertainty: 1 },
            { node: "B", offset: 0.2, uncertainty: 1 },
            { node: "C", offset: -0.2, uncertainty: 1 },
            { node: "A", offset: 0.1, uncertainty: 1 },
        ];
    const rows: TraceRow[] = [];
    let real = 0;

    yield {
        stepNumber: 0,
        entities: makeCells(rows, -1, false),
        edges: [],
        description: `Tracing ${specs.length} transactions through TrueTime intervals and commit wait.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: { rows: 0, cols: 7, transactions: specs.length, ordered: true, converged: false },
    };

    let step = 1;
    for (let i = 0; i < specs.length; i += 1) {
        const spec = specs[i]!;
        const uncertainty = typeof spec.uncertainty === "number" && spec.uncertainty > 0
            ? spec.uncertainty
            : 1;
        const offset = typeof spec.offset === "number" && Number.isFinite(spec.offset)
            ? Math.max(-uncertainty / 2, Math.min(uncertainty / 2, spec.offset))
            : 0;
        const earliest = real + offset - uncertainty;
        const latest = real + offset + uncertainty;
        const assigned = latest;
        const wait = 2 * uncertainty;
        const ack = real + wait;
        rows.push({ node: spec.node ?? `N${i}`, start: real, earliest, latest, assigned, wait, ack });
        const previous = rows[i - 1];
        const ordered = previous === undefined || assigned > previous.assigned;
        real = ack;
        yield {
            stepNumber: step,
            entities: makeCells(rows, i, false),
            edges: [],
            description: `Transaction ${i + 1} on ${rows[i]!.node}: interval [${earliest.toFixed(2)}, ${latest.toFixed(2)}], assign ${assigned.toFixed(2)}, wait ${wait.toFixed(2)}.`,
            codeLineNumber: ordered ? 4 : 5,
            layout: "grid",
            meta: {
                rows: rows.length,
                cols: 7,
                transactions: specs.length,
                ordered,
                maxWait: wait,
                converged: false,
            },
        };
        step += 1;
    }

    const ordered = rows.every((row, i) => i === 0 || row.assigned > rows[i - 1]!.assigned);
    yield {
        stepNumber: step,
        entities: makeCells(rows, -1, true),
        edges: [],
        description: `All ${rows.length} commits are externally consistent: ${ordered ? "timestamps strictly increase" : "ordering violated"}.`,
        codeLineNumber: 7,
        layout: "grid",
        meta: { rows: rows.length, cols: 7, transactions: specs.length, ordered, converged: true },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "A normal clock returns one time and hides how wrong it might be. TrueTime returns a range that is guaranteed to contain the real time. A transaction timestamps itself at the range's upper end, then waits until its own range's lower end passes that timestamp. After the wait, every future reading on any well-synchronized node starts above the committed timestamp, so ordering follows from local clocks alone.",
        invariants: [
            "The interval always contains the real time: earliest is at most real time, which is at most latest.",
            "A commit wait lasts exactly twice the clock uncertainty.",
            "A later transaction on any synchronized node receives a strictly larger timestamp.",
        ],
        correctness:
            "Let a transaction start at real time t with clock offset d and uncertainty e, giving interval [t plus d minus e, t plus d plus e]. It assigns s equal to the latest bound and waits until real time t plus two e, at which point its earliest bound equals s. Any subsequent event at real time at least t plus two e on a node whose offset differs by at most e has an earliest bound of at least t plus two e plus d' minus e, which exceeds s; therefore its latest bound and assigned timestamp exceed s. Since every causal step strictly increases the assigned timestamp, external consistency holds without cross-node messages at commit time.",
        complexityRationale:
            "Each transaction reads one interval, assigns one timestamp, and waits for a duration derived by constant arithmetic, so time is O(1) per transaction. The trace keeps one seven-field row per transaction, giving O(n) space for the visualization.",
        uses: [
            "Externally consistent distributed transactions in Spanner",
            "Globally ordered commit timestamps across data centers",
            "Read-only snapshots that are safe at a wall-clock instant",
        ],
        references: [
            "Corbett et al., Spanner: Google's Globally-Distributed Database, 2012",
            "Google Cloud Spanner documentation, TrueTime API",
        ],
        workedExample:
            "With uncertainty one and offset zero, a transaction starting at real time zero sees interval [-1, 1], assigns timestamp 1, and waits two units. It acknowledges at real time two. A second transaction starting then sees an interval whose latest bound is 3, strictly greater than 1, so the two commits are correctly ordered.",
    },
    id: "true-time-clock",
    name: "TrueTime Clock",
    category: "parallel-distributed",
    complexity: { time: "O(1)", space: "O(1)" },
    defaultInput: {
        transactions: [
            { node: "A", offset: 0, uncertainty: 1 },
            { node: "B", offset: 0.2, uncertainty: 1 },
            { node: "C", offset: -0.2, uncertainty: 1 },
            { node: "A", offset: 0.1, uncertainty: 1 },
        ],
    },
    visualType: "grid",
    run,
    pseudocode: [
        "start each transaction when the previous one has acknowledged",
        "read the local TrueTime interval earliest and latest",
        "assign the commit timestamp equal to latest",
        "wait until the local earliest passes the assigned timestamp",
        "acknowledge the commit after waiting twice the uncertainty",
        "begin the next transaction at the acknowledgement time",
        "check that assigned timestamps strictly increase",
        "done: report the trace and the external-consistency verdict",
    ],
};

export default module;
