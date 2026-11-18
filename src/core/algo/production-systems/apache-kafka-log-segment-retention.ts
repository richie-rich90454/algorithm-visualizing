/**
 * apache-kafka-log-segment-retention.ts - Kafka Log Segment Retention
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Apache Kafka keeps a log as a sequence of immutable segments. Retention
 * reclaims disk space in two ways: time-based retention deletes whole segments
 * whose newest record is older than a configured age, and size-based retention
 * deletes the oldest segments until the log fits a byte budget. Both policies
 * remove whole segments in offset order, so the log stays a contiguous suffix.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(s) for s segments after sorting by base offset
 *   Space: O(s) for the kept and deleted decisions
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - One cell per segment shows its base offset, size, and age.
 *   - A deleted segment is red; a kept segment is green.
 *   - meta carries every deletion decision and its reason.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface Segment {
    baseOffset: number;
    sizeBytes: number;
    maxTimestamp: number;
}

/** Build segment cells. */
function makeCells(
    segments: Segment[],
    now: number,
    deleted: Set<number>,
    current: number,
    done: boolean,
): VisualEntity[] {
    return segments.map((segment, index) => {
        let state: EntityState = "idle";
        if (deleted.has(index)) {
            state = "error";
        } else if (done) {
            state = "sorted";
        } else if (index === current) {
            state = "comparing";
        }
        return {
            id: `cell-${index}`,
            type: "cell" as const,
            label: `[${segment.baseOffset}] ${segment.sizeBytes}B age=${now - segment.maxTimestamp}`,
            value: segment.baseOffset,
            state,
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: { row: 0, col: index, baseOffset: segment.baseOffset, sizeBytes: segment.sizeBytes, age: now - segment.maxTimestamp },
        };
    });
}

/** The Kafka retention generator. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { segments?: Segment[]; retentionBytes?: number; retentionMs?: number; now?: number } | null) ?? {};
    const raw = Array.isArray(task.segments) ? task.segments : [
        { baseOffset: 0, sizeBytes: 300, maxTimestamp: 1000 },
        { baseOffset: 10, sizeBytes: 400, maxTimestamp: 4000 },
        { baseOffset: 20, sizeBytes: 350, maxTimestamp: 6000 },
        { baseOffset: 30, sizeBytes: 400, maxTimestamp: 9000 },
    ];
    const segments = raw
        .map((segment) => ({
            baseOffset: Math.floor(Number(segment.baseOffset)) || 0,
            sizeBytes: Math.max(0, Math.floor(Number(segment.sizeBytes)) || 0),
            maxTimestamp: Math.floor(Number(segment.maxTimestamp)) || 0,
        }))
        .sort((a, b) => a.baseOffset - b.baseOffset);
    const retentionBytes = Math.max(0, Math.floor(Number(task.retentionBytes ?? 600)) || 0);
    const retentionMs = Math.max(0, Math.floor(Number(task.retentionMs ?? 5000)) || 5000);
    const now = Math.floor(Number(task.now ?? 10000)) || 10000;
    const cutoff = now - retentionMs;

    const deleted = new Set<number>();
    const reasons: string[] = [];
    let totalSize = segments.reduce((sum, segment) => sum + segment.sizeBytes, 0);

    const buildMeta = (phase: string, current: number) => ({
        phase,
        rows: 1,
        cols: segments.length,
        now,
        retentionBytes,
        retentionMs,
        cutoff,
        baseOffsets: segments.map((segment) => segment.baseOffset),
        sizes: segments.map((segment) => segment.sizeBytes),
        ages: segments.map((segment) => now - segment.maxTimestamp),
        keptOffsets: segments.filter((_, index) => !deleted.has(index)).map((segment) => segment.baseOffset),
        deletedOffsets: segments.filter((_, index) => deleted.has(index)).map((segment) => segment.baseOffset),
        reasons: [...reasons],
        totalSizeBefore: segments.reduce((sum, segment) => sum + segment.sizeBytes, 0),
        totalSize,
        currentOffset: current >= 0 ? (segments[current]?.baseOffset ?? -1) : -1,
    });

    yield {
        stepNumber: 0,
        entities: makeCells(segments, now, deleted, -1, false),
        edges: [],
        description: `Retaining ${segments.length} segment(s): age cutoff ${cutoff}, size budget ${retentionBytes} byte(s), current size ${totalSize}.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: buildMeta("setup", -1),
    };
    let step = 1;

    for (let i = 0; i < segments.length; i += 1) {
        const segment = segments[i];
        if (!segment || segment.maxTimestamp >= cutoff) {
            continue;
        }
        deleted.add(i);
        totalSize -= segment.sizeBytes;
        reasons.push(`delete ${segment.baseOffset}: age ${now - segment.maxTimestamp} exceeds retention`);
        yield {
            stepNumber: step,
            entities: makeCells(segments, now, deleted, i, false),
            edges: [],
            description: `Time retention: segment ${segment.baseOffset} has newest record at ${segment.maxTimestamp}, older than cutoff ${cutoff}; delete it.`,
            codeLineNumber: 2,
            layout: "grid",
            meta: buildMeta("time-retention", i),
        };
        step += 1;
    }

    for (let i = 0; i < segments.length; i += 1) {
        if (deleted.has(i)) {
            continue;
        }
        if (totalSize <= retentionBytes) {
            break;
        }
        const segment = segments[i];
        if (!segment) {
            continue;
        }
        deleted.add(i);
        totalSize -= segment.sizeBytes;
        reasons.push(`delete ${segment.baseOffset}: log exceeds size budget`);
        yield {
            stepNumber: step,
            entities: makeCells(segments, now, deleted, i, false),
            edges: [],
            description: `Size retention: log uses ${totalSize + segment.sizeBytes} byte(s), above budget ${retentionBytes}; delete oldest remaining segment ${segment.baseOffset}.`,
            codeLineNumber: 4,
            layout: "grid",
            meta: buildMeta("size-retention", i),
        };
        step += 1;
    }

    yield {
        stepNumber: step,
        entities: makeCells(segments, now, deleted, -1, true),
        edges: [],
        description: `Retention complete: kept offsets [${segments.filter((_, i) => !deleted.has(i)).map((s) => s.baseOffset).join(", ")}], ${totalSize} byte(s) remaining.`,
        codeLineNumber: 5,
        layout: "grid",
        meta: buildMeta("done", -1),
    };
}

/** The Kafka log segment retention module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "A Kafka log is a suffix of history, so retention only ever removes whole segments from the front. First drop segments whose newest record is too old. Then, if the log is still larger than its byte budget, keep deleting the oldest remaining segments until it fits. The result is always a contiguous range of recent segments.",
        invariants: [
            "Only whole segments are removed, never individual records.",
            "Deletions proceed in increasing base-offset order.",
            "After size retention the total size is at most the byte budget.",
        ],
        correctness:
            "Time retention is safe because every record in a segment has a timestamp no newer than the segment's maximum timestamp, so an expired maximum means the whole segment is expired. Size retention removes the oldest remaining segment while the log is over budget, and each deletion reduces the total by that segment's size, so the loop terminates with total size at most the budget or with no segments left. Because deletions preserve the original order, the kept segments form a suffix of the log, which is the invariant Kafka needs for offset continuity.",
        complexityRationale:
            "Sorting s segments costs O(s log s), and each of the two retention sweeps visits each segment at most once, so total time is O(s log s). Storing the decisions and displayed cells uses O(s) space.",
        uses: [
            "Bounded disk usage in Kafka brokers",
            "Time-to-live policies for event logs",
            "Explaining the difference between log retention and compaction",
        ],
        references: [
            "Kreps et al., Kafka: a Distributed Messaging System for Log Processing, 2011",
            "Apache Kafka documentation, Configuration, log retention settings",
        ],
        workedExample:
            "With now 10000, a 5000 ms retention, and a 600 byte budget, segments at offsets 0 and 10 expire by age. The remaining segments total 750 bytes, so the oldest one at offset 20 is deleted by size, leaving only offset 30 and 400 bytes used.",
    },
    id: "apache-kafka-log-segment-retention",
    name: "Apache Kafka Log Segment Retention",
    category: "production-systems",
    complexity: { time: "O(s log s)", space: "O(s)" },
    defaultInput: {
        segments: [
            { baseOffset: 0, sizeBytes: 300, maxTimestamp: 1000 },
            { baseOffset: 10, sizeBytes: 400, maxTimestamp: 4000 },
            { baseOffset: 20, sizeBytes: 350, maxTimestamp: 6000 },
            { baseOffset: 30, sizeBytes: 400, maxTimestamp: 9000 },
        ],
        retentionBytes: 600,
        retentionMs: 5000,
        now: 10000,
    },
    visualType: "grid",
    run,
    pseudocode: [
        "sort segments by base offset and sum their sizes",
        "for each segment whose newest record is older than the cutoff",
        "delete the segment and subtract its size",
        "while the log exceeds the byte budget",
        "delete the oldest remaining segment and subtract its size",
        "done: report the kept segments and final total size",
    ],
};

export default module;
