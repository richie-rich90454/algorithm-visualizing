/**
 * kafka-log-compaction.ts - Kafka Log Compaction
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * An append-only event log grows without bound, but many topics only need the
 * latest value for each key. Log compaction scans the log in offset order and
 * keeps only the most recent record for every key. A record with a null value
 * is a tombstone: it removes the key entirely, including any older records for
 * it. The surviving records retain their original relative order, producing a
 * compacted log that still replays to the correct final state.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(N) for N log records
 *   Space: O(K) for K distinct keys in the offset index
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - One cell per original log record, labeled by key and value.
 *   - The record currently being scanned is highlighted.
 *   - Surviving records turn green in the final frame; obsolete ones go idle.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface RecordEntry {
    offset: number;
    key: string;
    value: number | null;
}

interface Input {
    records?: RecordEntry[];
}

const DEFAULT_RECORDS: RecordEntry[] = [
    { offset: 1, key: "k1", value: 10 },
    { offset: 2, key: "k2", value: 20 },
    { offset: 3, key: "k1", value: 30 },
    { offset: 4, key: "k3", value: 5 },
    { offset: 5, key: "k2", value: null },
];

function makeCells(
    records: RecordEntry[],
    keep: Set<number>,
    current: number | null,
    finalized: boolean,
): VisualEntity[] {
    return records.map((record, index) => {
        let state: EntityState = "idle";
        if (finalized) {
            state = keep.has(index) ? "sorted" : "idle";
        } else if (index === current) {
            state = "active";
        } else if (keep.has(index)) {
            state = "sorted";
        }
        return {
            id: `slot-${index}`,
            type: "cell" as const,
            label: `${record.key}:${record.value === null ? "TOMB" : record.value}`,
            value: record.value === null ? "TOMB" : record.value,
            state,
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: { row: 0, col: index, offset: record.offset, key: record.key },
        };
    });
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as Input | null) ?? {};
    const records: RecordEntry[] = [...(task.records ?? DEFAULT_RECORDS)].sort(
        (a, b) => a.offset - b.offset,
    );
    let step = 0;

    const snapshot = (
        keep: Set<number>,
        current: number | null,
        finalized: boolean,
        latest: Map<string, number>,
        description: string,
        line: number,
    ): VisualFrame => {
        const keptOffsets = [...keep].sort((a, b) => a - b).map((i) => records[i]!.offset);
        const keys = [...keep].sort((a, b) => a - b).map((i) => records[i]!.key);
        const values = [...keep]
            .sort((a, b) => a - b)
            .map((i) => records[i]!.value ?? 0);
        return {
            stepNumber: step,
            entities: makeCells(records, keep, current, finalized),
            edges: [],
            description,
            codeLineNumber: line,
            layout: "grid",
            meta: {
                compactedKeys: keys,
                compactedValues: values,
                keptOffsets,
                latestKeys: [...latest.keys()],
                recordCount: records.length,
            },
        };
    };

    const latest = new Map<string, number>();
    const keep = new Set<number>();
    yield snapshot(
        keep,
        null,
        false,
        latest,
        `Scanning ${records.length} log record(s) in offset order to build the latest-key index.`,
        0,
    );
    step += 1;

    for (let i = 0; i < records.length; i += 1) {
        const record = records[i]!;
        if (record.value === null) {
            latest.delete(record.key);
        } else {
            latest.set(record.key, record.value);
        }
        yield snapshot(
            keep,
            i,
            false,
            latest,
            `Offset ${record.offset}: ${record.key} = ${record.value === null ? "tombstone" : record.value}; latest index now has ${latest.size} key(s).`,
            2,
        );
        step += 1;
    }

    // Emit the surviving record for each key: the last record whose value is
    // not superseded and whose key was not later tombstoned.
    for (let i = 0; i < records.length; i += 1) {
        const record = records[i]!;
        if (record.value === null) {
            continue;
        }
        if (latest.get(record.key) === record.value && !records.some((r) => r.offset > record.offset && r.key === record.key)) {
            keep.add(i);
        }
    }

    yield snapshot(
        keep,
        null,
        true,
        latest,
        `Compaction complete: kept ${keep.size} of ${records.length} record(s); tombstones and superseded values removed.`,
        6,
    );
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "A log is a history, but a key-value topic often only needs the present. Compaction walks the log once and builds an index of the newest value for each key. Records that are no longer newest are dropped, and a null-value tombstone erases the key altogether. The remaining records keep their original order, so replaying the compacted log reaches the same state as replaying the full one.",
        invariants: [
            "For every key, the latest non-tombstone value in the log is the value kept.",
            "A tombstone removes its key and cannot itself appear in the compacted log.",
            "Surviving records preserve their original offset order.",
            "Replaying the compacted log yields the same final key values as replaying the full log.",
        ],
        correctness:
            "The scan sets each key's latest value to the value of its highest-offset record, or removes the key at a tombstone. A record survives exactly when it is the final record for a key that still exists and is not a tombstone. Since no earlier record for that key can affect the final state, discarding it is safe, and keeping the last record preserves the value that a full replay would end with. Original offset order is retained because survivors are selected in place.",
        complexityRationale:
            "The algorithm makes one pass to build the latest-key index and one pass to select survivors, so it runs in O(N) time for N records. The index stores at most one entry per distinct key, requiring O(K) space.",
        uses: [
            "Apache Kafka compacted topics for changelogs and keyed state stores",
            "Maintaining the latest configuration or profile value per entity",
            "Bounded replay logs in stream-processing systems such as Kafka Streams",
        ],
        references: [
            "Apache Kafka documentation, Log Compaction design section",
            "Kleppmann, Designing Data-Intensive Applications, log-structured storage chapter",
        ],
        workedExample:
            "Records k1=10, k2=20, k1=30, k3=5, k2=tombstone are scanned in offset order. The latest index ends as k1=30, k3=5 because the k2 tombstone removes it. Compaction keeps offset 3 (k1=30) and offset 4 (k3=5), dropping the earlier k1, the earlier k2, and the tombstone.",
    },
    id: "kafka-log-compaction",
    name: "Kafka Log Compaction",
    category: "production-systems",
    complexity: { time: "O(N)", space: "O(K)" },
    defaultInput: { records: DEFAULT_RECORDS },
    visualType: "grid",
    run,
    pseudocode: [
        "initialize an empty latest-value index by key",
        "for each record in ascending offset order",
        "if the value is a tombstone then delete the key",
        "otherwise set the key to this record's value",
        "for each record in offset order again",
        "keep it when it is the last non-tombstone for its key",
        "emit the kept records in their original order",
        "done: report the compacted log",
    ],
};

export default module;
