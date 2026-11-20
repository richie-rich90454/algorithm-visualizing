/**
 * sliding-window-aggregation.ts - Sliding Window Aggregation
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * A sliding window aggregation maintains a summary over the most recent w
 * values of a stream. As each new value arrives, the oldest value leaves the
 * window and the aggregate is recomputed for the current window. This module
 * demonstrates sum, minimum and maximum aggregates with a fixed window size.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(n * w) with a direct recomputation for each window
 *   Space: O(n) for the results and the displayed stream
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Each stream value is a cell; the active window is highlighted.
 *   - Values outside the current window stay idle.
 *   - The current aggregate is reported in the caption and in frame meta.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

type Aggregate = "sum" | "min" | "max";

/** Compute the aggregate of a slice directly. */
function aggregate(slice: number[], kind: Aggregate): number {
    if (kind === "sum") return slice.reduce((total, value) => total + value, 0);
    if (kind === "min") return Math.min(...slice);
    return Math.max(...slice);
}

/** Build the stream cells with the current window highlighted. */
function buildEntities(values: number[], start: number, end: number): VisualEntity[] {
    return values.map((value, col) => {
        const inWindow = col >= start && col <= end;
        const state: EntityState = inWindow ? "active" : col < start ? "visited" : "idle";
        return {
            id: `v-${col}`,
            type: "cell" as const,
            label: String(value),
            value,
            state,
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: { row: 0, col, inWindow },
        };
    });
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { values?: number[]; window?: number; aggregate?: Aggregate } | null) ?? {};
    const values: number[] = Array.isArray(task.values) ? task.values : [1, 3, 2, 5, 4, 6, 1, 2, 7, 3];
    const width = Math.max(1, Math.min(values.length || 1, Math.floor(task.window ?? 3)));
    const kind: Aggregate = task.aggregate === "min" || task.aggregate === "max" ? task.aggregate : "sum";
    const results: Array<{ end: number; value: number }> = [];
    let step = 0;

    yield {
        stepNumber: step++,
        entities: buildEntities(values, -1, -1),
        edges: [],
        description: `Sliding ${kind} over ${values.length} value(s) with window size ${width}.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: { rows: 1, cols: values.length, window: width, aggregate: kind, results: [], phase: "start" },
    };

    for (let end = width - 1; end < values.length; end += 1) {
        const start = end - width + 1;
        const slice = values.slice(start, end + 1);
        const value = aggregate(slice, kind);
        results.push({ end, value });
        yield {
            stepNumber: step++,
            entities: buildEntities(values, start, end),
            edges: [],
            description: `Window [${start}, ${end}] holds ${slice.join(", ")}; ${kind} = ${value}.`,
            codeLineNumber: 2,
            layout: "grid",
            meta: {
                rows: 1,
                cols: values.length,
                window: width,
                aggregate: kind,
                results: results.slice(),
                phase: "slide",
                start,
                end,
                value,
            },
        };
    }

    yield {
        stepNumber: step++,
        entities: buildEntities(values, -1, -1),
        edges: [],
        description: `Computed ${results.length} sliding-window ${kind} value(s).`,
        codeLineNumber: 5,
        layout: "grid",
        meta: { rows: 1, cols: values.length, window: width, aggregate: kind, results, values: results.map((r) => r.value), phase: "done" },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Imagine a frame of fixed width sliding across a row of numbers. At each position the frame covers the most recent values, and you compute a summary such as their sum or maximum. Moving one step forward drops the leftmost value and admits a new one on the right.",
        invariants: [
            "The active window always contains exactly window values (once the stream is long enough).",
            "The reported aggregate is computed only from values inside the active window.",
            "Each window start position advances by one on every step.",
        ],
        correctness:
            "For every ending index at least window minus one, the window boundaries are start = end - width + 1 and end, so the slice is precisely the most recent width values. Computing the aggregate directly from that slice gives the correct summary by definition. Iterating end from width minus one to the last index produces every full window exactly once, with no partial windows.",
        complexityRationale:
            "There are n minus width plus one full windows and each direct recomputation scans width values, so time is O(n * width). The stream cells and the result list use O(n) space.",
        uses: [
            "Moving averages and rolling statistics in time-series analysis",
            "Real-time monitoring of the last few seconds of metrics",
            "Signal processing and sensor data smoothing",
        ],
        references: [
            "Wikipedia, Moving average",
            "Knuth, The Art of Computer Programming Vol. 1, sums and recurrences",
        ],
        workedExample:
            "Values 1, 3, 2, 5 with window 3 and sum: the first window [1,3,2] sums to 6, then [3,2,5] sums to 10. Each step drops the oldest value and adds the newest.",
    },
    id: "sliding-window-aggregation",
    name: "Sliding Window Aggregation",
    category: "production-systems",
    complexity: { time: "O(n * w)", space: "O(n)" },
    defaultInput: { values: [1, 3, 2, 5, 4, 6, 1, 2, 7, 3], window: 3, aggregate: "sum" },
    visualType: "grid",
    run,
    pseudocode: [
        "read the stream values, the window size and the aggregate kind",
        "for each ending index from window minus one to the last value",
        "let the window start at the ending index minus window plus one",
        "collect the values between the window start and end",
        "compute the requested aggregate over those values",
        "record the aggregate for this window position",
        "done: return the full list of window aggregates",
    ],
};

export default module;
