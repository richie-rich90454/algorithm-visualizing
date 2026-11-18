/**
 * exactly-once-processing.ts - Exactly-Once Stream Processing with Idempotent Sink
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * A stream processor can read the same record more than once after a restart or
 * a retry, yet its output must contain each event exactly once. This module
 * models the standard reciprocal solution: the sink writes are idempotent and
 * keyed by a stable event id, the processor keeps a set of ids it has already
 * committed, and the source checkpoint advances only after a successful sink
 * write. A duplicate id is skipped, so it can never create a second output.
 * A failed sink write leaves both the processed set and the checkpoint
 * unchanged, so a later redelivery retries the same id safely. This is a
 * deterministic teaching simulation, not a real streaming engine.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(r) for r incoming records (each check is constant time)
 *   Space: O(u) for u unique event ids in the processed set and sink log
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - One bar per unique event id; green means committed to the sink.
 *   - A duplicate record is shown in yellow, a failed sink write in red.
 *   - The metadata carries the sink log, checkpoint, and duplicate count.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface ExactlyOnceInput {
    records?: Array<string | number>;
    failSinks?: number[];
}

/** Build one bar per unique event id. */
function makeBars(
    unique: Array<string | number>,
    processed: Set<string | number>,
    focusId: string | number | null,
    focusState: EntityState,
): VisualEntity[] {
    return unique.map((id) => {
        let state: EntityState = processed.has(id) ? "sorted" : "idle";
        if (focusId === id) {
            state = focusState;
        }
        return {
            id: `bar-${String(id)}`,
            type: "bar" as const,
            label: String(id),
            value: processed.has(id) ? 1 : 0,
            state,
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: { eventId: String(id) },
        };
    });
}

/** The exactly-once processing generator. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as ExactlyOnceInput | null) ?? {};
    const records: Array<string | number> = Array.isArray(task.records) && task.records.length > 0
        ? task.records.slice(0, 24)
        : ["a", "b", "c", "b", "a", "d"];
    const failSinks = new Set<number>(
        Array.isArray(task.failSinks) ? task.failSinks.filter((i) => Number.isInteger(i)) : [],
    );

    const unique: Array<string | number> = [];
    for (const id of records) {
        if (!unique.some((u) => u === id)) {
            unique.push(id);
        }
    }

    const processed = new Set<string | number>();
    const sinkLog: Array<string | number> = [];
    let duplicates = 0;
    let attempts = 0;
    let checkpoint = -1;
    let step = 0;

    yield {
        stepNumber: step++,
        entities: makeBars(unique, processed, null, "idle"),
        edges: [],
        description: `${records.length} incoming records carry ${unique.length} unique event ids; the processed set starts empty.`,
        codeLineNumber: 0,
        layout: "array",
        meta: {
            unique: unique.map(String),
            sinkLog: sinkLog.map(String),
            checkpoint,
            duplicates,
            attempts,
            committed: 0,
        },
    };

    for (let i = 0; i < records.length; i += 1) {
        const id = records[i]!;
        if (processed.has(id)) {
            duplicates += 1;
            yield {
                stepNumber: step++,
                entities: makeBars(unique, processed, id, "comparing"),
                edges: [],
                description: `Record ${i} repeats id "${id}"; it is already committed, so this duplicate is skipped.`,
                codeLineNumber: 2,
                layout: "array",
                meta: {
                    unique: unique.map(String),
                    sinkLog: sinkLog.map(String),
                    checkpoint,
                    duplicates,
                    attempts,
                    committed: processed.size,
                },
            };
            continue;
        }

        attempts += 1;
        if (failSinks.has(attempts)) {
            yield {
                stepNumber: step++,
                entities: makeBars(unique, processed, id, "error"),
                edges: [],
                description: `Sink write attempt ${attempts} for "${id}" failed; the checkpoint stays at record ${checkpoint}.`,
                codeLineNumber: 4,
                layout: "array",
                meta: {
                    unique: unique.map(String),
                    sinkLog: sinkLog.map(String),
                    checkpoint,
                    duplicates,
                    attempts,
                    committed: processed.size,
                },
            };
            continue;
        }

        processed.add(id);
        sinkLog.push(id);
        checkpoint = i;
        yield {
            stepNumber: step++,
            entities: makeBars(unique, processed, id, "sorted"),
            edges: [],
            description: `Committed id "${id}" to the sink; the idempotent key prevents a second write and the checkpoint advances to record ${i}.`,
            codeLineNumber: 5,
            layout: "array",
            meta: {
                unique: unique.map(String),
                sinkLog: sinkLog.map(String),
                checkpoint,
                duplicates,
                attempts,
                committed: processed.size,
            },
        };
    }

    const exactlyOnce = sinkLog.length === unique.length && new Set(sinkLog).size === sinkLog.length;
    yield {
        stepNumber: step++,
        entities: makeBars(unique, processed, null, "idle"),
        edges: [],
        description: exactlyOnce
            ? `All ${unique.length} unique events were written exactly once; ${duplicates} duplicate(s) skipped.`
            : `${sinkLog.length} of ${unique.length} unique events reached the sink; the rest need redelivery.`,
        codeLineNumber: 7,
        layout: "array",
        meta: {
            unique: unique.map(String),
            sinkLog: sinkLog.map(String),
            checkpoint,
            duplicates,
            attempts,
            committed: processed.size,
            exactlyOnce,
        },
    };
}

/** The exactly-once processing module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "Streams redeliver records, so counting each arrival as a new output would double-count. Give every event a stable id and make the sink write idempotent on that id. Remember which ids have been committed and ignore any record whose id you have already seen. Only advance the source checkpoint after the sink confirms the write, so a crash cannot leave a gap between what was consumed and what was stored.",
        invariants: [
            "The sink log never contains the same event id twice.",
            "An event id enters the processed set only after a successful sink write.",
            "The checkpoint points at the most recent record that committed successfully.",
        ],
        correctness:
            "Each unique id is committed at most once because a record whose id is already in the processed set is skipped, and the sink key also rejects a repeat write. If a sink write fails, neither the processed set nor the checkpoint changes, so a later redelivery of that id is treated as a first attempt and eventually commits. Every unique id that appears at least once and has a successful attempt therefore appears exactly once in the sink log, which is exactly-once output despite at-least-once delivery.",
        complexityRationale:
            "Each of the r records performs a constant-time set membership test and at most one sink write, so time is O(r). The processed set and sink log hold one entry per unique id, giving O(u) space.",
        uses: [
            "Exactly-once aggregation in stream processors such as Flink and Kafka Streams",
            "Idempotent event ingestion with transactionally keyed writes",
            "Billing and telemetry pipelines that cannot tolerate duplicates",
        ],
        references: [
            "Kleppmann, Designing Data-Intensive Applications, Chapter 11",
            "Akidau et al., Streaming Systems, chapter on exactly-once processing",
        ],
        workedExample:
            "Records a, b, c, b, a, d arrive. The first three commit. The second b and second a are duplicates and are skipped. d commits, leaving the sink log a, b, c, d with each id exactly once and two duplicates skipped.",
    },
    id: "exactly-once-processing",
    name: "Exactly-Once Stream Processing",
    category: "parallel-distributed",
    complexity: { time: "O(r)", space: "O(u)" },
    defaultInput: { records: ["a", "b", "c", "b", "a", "d"], failSinks: [] },
    visualType: "array",
    run,
    pseudocode: [
        "collect the unique event ids from the record stream",
        "initialize an empty processed set and sink log",
        "for each incoming record in order",
        "if its id is already processed, skip this duplicate",
        "otherwise attempt the idempotent sink write keyed by the id",
        "on failure leave the processed set and checkpoint unchanged",
        "on success add the id, append to the log, and advance the checkpoint",
        "done: every unique id appears exactly once in the sink",
    ],
};

export default module;
