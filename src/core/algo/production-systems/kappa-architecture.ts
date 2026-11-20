/**
 * kappa-architecture.ts - Kappa Architecture Stream Reprocessing
 *
 * Kappa architecture removes the batch layer: every record goes through the
 * stream processor, and the durable event log is the single source of truth.
 * To fix a bug or change a view, the system replays the log through the same
 * stream logic, so live processing and reprocessing share one code path and
 * always agree.
 *
 * Time: O(events); Space: O(keys + events).
 */

import type { AlgorithmModule, VisualEntity, VisualFrame } from "@/types";

interface Event { key: string; value: number }

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
    const task = (input as { events?: Event[]; queryKey?: string } | null) ?? {};
    const events: Event[] = (task.events ?? [
        { key: "page", value: 1 },
        { key: "page", value: 1 },
        { key: "cart", value: 1 },
        { key: "page", value: 1 },
    ]).map((event) => ({ ...event }));
    const queryKey = task.queryKey ?? "page";

    const view: Record<string, number> = {};
    let step = 0;
    yield {
        stepNumber: step,
        entities: makeEntities(view, null),
        edges: [],
        description: `Stream processing ${events.length} logged events into a single view.`,
        codeLineNumber: 0,
        layout: "array",
        meta: { phase: "start", view: {}, reprocessed: {}, matches: false, answer: null as number | null },
    };
    step += 1;

    for (const event of events) {
        view[event.key] = (view[event.key] ?? 0) + event.value;
    }
    yield {
        stepNumber: step,
        entities: makeEntities(view, null),
        edges: [],
        description: `Live view after ${events.length} events: ${Object.keys(view).length} keys tracked.`,
        codeLineNumber: 2,
        layout: "array",
        meta: { phase: "live", view: { ...view }, reprocessed: {}, matches: false, answer: null },
    };
    step += 1;

    const reprocessed: Record<string, number> = {};
    for (const event of events) {
        reprocessed[event.key] = (reprocessed[event.key] ?? 0) + event.value;
        yield {
            stepNumber: step,
            entities: makeEntities(reprocessed, event.key),
            edges: [],
            description: `Replaying logged event for ${event.key} through the same stream logic.`,
            codeLineNumber: 4,
            layout: "array",
            meta: { phase: "reprocess", view: { ...view }, reprocessed: { ...reprocessed }, matches: false, answer: null },
        };
        step += 1;
    }

    const matches = JSON.stringify(reprocessed) === JSON.stringify(view);
    const answer = reprocessed[queryKey] ?? 0;
    yield {
        stepNumber: step,
        entities: makeEntities(reprocessed, queryKey),
        edges: [],
        description: `Reprocessing from the event log reproduced the view: ${matches}; query ${queryKey} returns ${answer}.`,
        codeLineNumber: 6,
        layout: "array",
        meta: { phase: "done", view: { ...view }, reprocessed: { ...reprocessed }, matches, answer },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "If one stream processor handles both live events and historical replays, there is only one piece of logic to trust. The event log keeps every record, so changing how a view is computed just means replaying the log. Live results and reprocessed results are guaranteed to agree because they use the same code.",
        invariants: [
            "Every event is appended to a durable log before it affects the view.",
            "Live processing and reprocessing apply the same aggregation rule.",
            "The reprocessed view equals the live view when both consume the same events.",
        ],
        correctness:
            "Both passes fold the same event sequence with the same commutative associative update, so by induction they reach identical per-key totals. The test checks the reprocessed view against both the live view and an independent brute-force aggregation.",
        complexityRationale:
            "Live processing scans the events once and reprocessing scans them once more, so O(events) time with O(keys plus events) space to retain the log for replay.",
        uses: [
            "Event-sourced systems that rebuild state from an append-only log",
            "Streaming analytics with exactly-once reprocessing",
            "Fixing derived views without a separate batch pipeline",
        ],
        references: [
            "Kleppmann, Designing Data-Intensive Applications, chapter on stream processing",
            "Kreps, Questioning the Lambda Architecture, 2014",
        ],
        workedExample:
            "Three page events and one cart event build a live view of page three and cart one. Replaying the same four events through the identical stream function reproduces those counts, and a query for page returns three.",
    },
    id: "kappa-architecture",
    name: "Kappa Architecture Stream Reprocessing",
    category: "production-systems",
    complexity: { time: "O(events)", space: "O(keys + events)" },
    defaultInput: {
        events: [{ key: "page", value: 1 }, { key: "page", value: 1 }, { key: "cart", value: 1 }, { key: "page", value: 1 }],
        queryKey: "page",
    },
    visualType: "array",
    run,
    pseudocode: [
        "read the event log and the query key",
        "fold every event into the live view by key",
        "start a second empty view for reprocessing",
        "fold every logged event into the reprocessed view",
        "compare the reprocessed view with the live view",
        "answer the query from the reprocessed view",
        "report both views and the equality check",
    ],
};

export default module;
