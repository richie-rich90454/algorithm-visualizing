/**
 * tumbling-window.ts - Tumbling Window Aggregation
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * A tumbling window partitions a stream into fixed-size, non-overlapping,
 * contiguous buckets. Each value belongs to exactly one bucket, determined by
 * floor(position / windowSize). This module groups values into those buckets
 * and computes a per-bucket total, which is the basis of fixed-interval
 * reporting in stream processing.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(n) for n stream values
 *   Space: O(n) for the buckets and their displayed cells
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Each stream value is a cell tinted by the bucket it falls into.
 *   - The currently filling bucket is highlighted.
 *   - Bucket boundaries and totals are reported in the frame meta.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

/** Build value cells colored by bucket membership. */
function buildEntities(values: number[], width: number, activeBucket: number): VisualEntity[] {
    return values.map((value, col) => {
        const bucket = Math.floor(col / width);
        const state: EntityState = bucket === activeBucket ? "active" : bucket < activeBucket ? "visited" : "idle";
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
            metadata: { row: 0, col, bucket },
        };
    });
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { values?: number[]; window?: number } | null) ?? {};
    const values: number[] = Array.isArray(task.values) ? task.values : [2, 4, 1, 3, 5, 2, 6, 1, 4, 3, 2, 5];
    const width = Math.max(1, Math.floor(task.window ?? 4));
    const bucketCount = Math.ceil(values.length / width);
    const buckets: number[][] = Array.from({ length: bucketCount }, () => []);
    const totals: number[] = [];
    let step = 0;

    yield {
        stepNumber: step++,
        entities: buildEntities(values, width, -1),
        edges: [],
        description: `Partitioning ${values.length} value(s) into tumbling buckets of size ${width}.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: { rows: 1, cols: values.length, window: width, buckets: [], totals: [], phase: "start" },
    };

    for (let col = 0; col < values.length; col += 1) {
        const bucketIndex = Math.floor(col / width);
        const bucket = buckets[bucketIndex];
        if (bucket) bucket.push(values[col] ?? 0);
        const boundary = (col + 1) % width === 0 || col === values.length - 1;
        if (boundary && bucket) totals.push(bucket.reduce((sum, value) => sum + value, 0));
        yield {
            stepNumber: step++,
            entities: buildEntities(values, width, bucketIndex),
            edges: [],
            description: boundary
                ? `Bucket ${bucketIndex} closed with ${bucket?.length ?? 0} value(s), total ${totals[totals.length - 1] ?? 0}.`
                : `Value ${values[col]} enters bucket ${bucketIndex}.`,
            codeLineNumber: boundary ? 4 : 2,
            layout: "grid",
            meta: {
                rows: 1,
                cols: values.length,
                window: width,
                buckets: buckets.map((b) => b.slice()),
                totals: totals.slice(),
                phase: "fill",
                index: col,
                bucket: bucketIndex,
            },
        };
    }

    yield {
        stepNumber: step++,
        entities: buildEntities(values, width, -1),
        edges: [],
        description: `Formed ${bucketCount} tumbling bucket(s); totals: ${totals.join(", ")}.`,
        codeLineNumber: 6,
        layout: "grid",
        meta: { rows: 1, cols: values.length, window: width, buckets, totals, phase: "done" },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Cut the stream into equal, non-overlapping blocks like tiles in a row. Every value lands in one tile, based on its position divided by the tile width. When a tile fills, publish its total and move on to the next tile; no value ever appears in two tiles.",
        invariants: [
            "Bucket membership is floor(position / windowSize).",
            "Buckets are disjoint, contiguous and cover every value exactly once.",
            "A bucket total is the sum of exactly the values assigned to that bucket.",
        ],
        correctness:
            "For position i, the bucket index floor(i / width) changes only when i crosses a multiple of width, so consecutive runs of indices form contiguous buckets of size width (except a possibly shorter final bucket). Every index maps to exactly one bucket, and the total is computed from precisely the values appended to that bucket. Therefore the buckets partition the stream and each total is correct.",
        complexityRationale:
            "Each value is assigned to a bucket once and added to one running total, so time is O(n). Storing the bucket lists and the displayed cells uses O(n) space.",
        uses: [
            "Fixed-interval rollups such as per-minute counters",
            "Batch windows in stream processors like Flink and Spark",
            "Histogram and time-bucket aggregation in monitoring systems",
        ],
        references: [
            "Apache Flink documentation, tumbling windows",
            "Akidau et al., The Dataflow Model, VLDB 2015",
        ],
        workedExample:
            "Values 2, 4, 1, 3, 5, 2 with window 4 split into buckets [2,4,1,3] and [5,2]. Their totals are 10 and 7, and no value belongs to both buckets.",
    },
    id: "tumbling-window",
    name: "Tumbling Window Aggregation",
    category: "production-systems",
    complexity: { time: "O(n)", space: "O(n)" },
    defaultInput: { values: [2, 4, 1, 3, 5, 2, 6, 1, 4, 3, 2, 5], window: 4 },
    visualType: "grid",
    run,
    pseudocode: [
        "read the values and the tumbling window size",
        "create an empty bucket for each group of window positions",
        "for each value at position i",
        "place it in bucket floor(i divided by window size)",
        "when a bucket fills, compute and publish its total",
        "close the final partial bucket at the end",
        "done: return every bucket and its total",
    ],
};

export default module;
