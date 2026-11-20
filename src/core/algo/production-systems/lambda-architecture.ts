/**
 * lambda-architecture.ts - Lambda Architecture Batch and Speed Layers
 *
 * The Lambda architecture answers queries by combining two views: a batch view
 * computed once over all historical data, and a real-time speed view over the
 * recent delta that arrived since the last batch run. The serving layer merges
 * both views, so a query sees the complete data set without waiting for the
 * next batch job.
 *
 * Time: O(batch + stream); Space: O(keys).
 */

import type { AlgorithmModule, VisualEntity, VisualFrame } from "@/types";

interface Datum { key: string; value: number }

function aggregate(records: Datum[]): Record<string, number> {
    const view: Record<string, number> = {};
    for (const record of records) {
        view[record.key] = (view[record.key] ?? 0) + record.value;
    }
    return view;
}

function makeEntities(view: Record<string, number>, activeKey: string | null): VisualEntity[] {
    return Object.keys(view).sort().map((key, index) => ({
        id: `key-${index}`,
        type: "bar" as const,
        label: `${key}:${view[key] ?? 0}`,
        value: view[key] ?? 0,
        state: key === activeKey ? "active" : "idle",
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { key },
    }));
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { batchData?: Datum[]; streamData?: Datum[]; queryKey?: string } | null) ?? {};
    const batchData = task.batchData ?? [
        { key: "a", value: 2 }, { key: "b", value: 3 }, { key: "a", value: 5 },
    ];
    const streamData = task.streamData ?? [
        { key: "a", value: 1 }, { key: "c", value: 4 }, { key: "b", value: 2 },
    ];
    const queryKey = task.queryKey ?? "a";

    const batchView = aggregate(batchData);
    let step = 0;
    yield {
        stepNumber: step,
        entities: makeEntities(batchView, null),
        edges: [],
        description: `Batch layer aggregated ${batchData.length} historical records into its view.`,
        codeLineNumber: 1,
        layout: "array",
        meta: { phase: "batch", batchView: { ...batchView }, speedView: {}, merged: {}, queryKey, answer: null as number | null },
    };
    step += 1;

    const speedView = aggregate(streamData);
    yield {
        stepNumber: step,
        entities: makeEntities(speedView, null),
        edges: [],
        description: `Speed layer aggregated ${streamData.length} recent records into its real-time view.`,
        codeLineNumber: 3,
        layout: "array",
        meta: { phase: "speed", batchView: { ...batchView }, speedView: { ...speedView }, merged: {}, queryKey, answer: null },
    };
    step += 1;

    const merged: Record<string, number> = { ...batchView };
    for (const key of Object.keys(speedView)) {
        merged[key] = (merged[key] ?? 0) + (speedView[key] ?? 0);
    }
    const answer = merged[queryKey] ?? 0;
    yield {
        stepNumber: step,
        entities: makeEntities(merged, queryKey),
        edges: [],
        description: `Serving layer merged both views; query ${queryKey} returns ${answer}.`,
        codeLineNumber: 5,
        layout: "array",
        meta: { phase: "merge", batchView: { ...batchView }, speedView: { ...speedView }, merged: { ...merged }, queryKey, answer },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Batch computation is accurate but slow; stream computation is fast but covers only recent events. The Lambda architecture keeps both. A query asks the serving layer, which adds the batch answer for old data to the speed answer for new data, producing a complete result without rerunning the whole batch job.",
        invariants: [
            "The batch view covers exactly the historical records.",
            "The speed view covers exactly the records since the last batch run.",
            "The merged view is the pointwise sum of the two views.",
        ],
        correctness:
            "Because the historical and stream record sets are disjoint and aggregation is associative, summing the two per-key views equals aggregating the union of all records. The test compares the merged answer to a brute-force aggregation over the combined input for every key.",
        complexityRationale:
            "Each layer scans its own records once to build a per-key view, and merging scans the keys, so the total time is O(batch plus stream) and the space is O(keys).",
        uses: [
            "Analytics dashboards that need both historical and live numbers",
            "Recomputing derived tables while a stream keeps arriving",
            "Teaching the tradeoff between batch latency and stream completeness",
        ],
        references: [
            "Marz and Warren, Big Data: Principles and Best Practices of Scalable Realtime Data Systems, 2015",
            "Kleppmann, Designing Data-Intensive Applications, chapter on batch and stream systems",
        ],
        workedExample:
            "A batch view over two a records and one b record gives a five and b three. A speed view over one a, one c, and one b gives a one, c four, b two. Merging yields a six, b five, c four, so a query for a returns six.",
    },
    id: "lambda-architecture",
    name: "Lambda Architecture Batch and Speed Layers",
    category: "production-systems",
    complexity: { time: "O(batch + stream)", space: "O(keys)" },
    defaultInput: {
        batchData: [{ key: "a", value: 2 }, { key: "b", value: 3 }, { key: "a", value: 5 }],
        streamData: [{ key: "a", value: 1 }, { key: "c", value: 4 }, { key: "b", value: 2 }],
        queryKey: "a",
    },
    visualType: "array",
    run,
    pseudocode: [
        "read historical batch records and recent stream records",
        "aggregate batch records by key into the batch view",
        "aggregate stream records by key into the speed view",
        "merge the two views by summing matching keys",
        "answer the query from the merged view",
        "report both views, the merged view, and the answer",
    ],
};

export default module;
