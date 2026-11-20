/**
 * space-saving.ts - SpaceSaving Frequent-Item Summary
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * SpaceSaving keeps k counters sorted by estimated frequency. A monitored key
 * increments its counter; a new key either fills an empty slot or replaces the
 * least-frequent tracked key, inheriting its count plus one. The replacement
 * rule guarantees the reported estimate for any key is never below its true
 * count and overshoots by at most n/k.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(m * k) for m stream items using a linear minimum scan
 *   Space: O(k) counters plus O(m) visualized stream cells
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Row zero is the stream; row one is the descending counter table.
 *   - The replaced slot or incremented key is highlighted.
 *   - meta carries final estimates, exact counts, and the maximum error.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface SpaceSavingInput {
    stream?: number[];
    k?: number;
}

const DEFAULT_STREAM = [3, 1, 2, 3, 1, 3, 4, 3, 2, 1, 5, 3, 1, 3, 2, 3];

interface Counter {
    key: number;
    count: number;
}

function cell(id: string, row: number, col: number, label: string, value: string | number, state: EntityState): VisualEntity {
    return { id, type: "cell", label, value, state, x: 0, y: 0, width: 0, height: 0, metadata: { row, col } };
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as SpaceSavingInput | null) ?? {};
    const stream = Array.isArray(task.stream) && task.stream.length > 0 ? task.stream.map(Number) : DEFAULT_STREAM;
    const k = Math.max(1, typeof task.k === "number" ? Math.floor(task.k) : 4);
    const counters: Counter[] = [];
    const exact = new Map<number, number>();
    for (const item of stream) exact.set(item, (exact.get(item) ?? 0) + 1);
    let step = 0;
    const cols = Math.max(stream.length, k);
    const emit = (entities: VisualEntity[], description: string, line: number, meta: VisualFrame["meta"]): VisualFrame => ({
        stepNumber: step++,
        entities,
        edges: [],
        description,
        codeLineNumber: line,
        layout: "grid",
        meta: { rows: 2, cols, k, ...meta },
    });
    const entitiesFor = (current: number, highlight: number | null): VisualEntity[] => [
        ...stream.map((item, i) => cell(`s-${i}`, 0, i, String(item), item, i === current ? "active" : i < current ? "visited" : "idle")),
        ...Array.from({ length: k }, (_, slot) => {
            const c = counters[slot];
            return cell(`c-${slot}`, 1, slot, c ? `${c.key}:${c.count}` : "-", c ? `${c.key}:${c.count}` : "-", c && c.key === highlight ? "sorted" : "idle");
        }),
    ];

    yield emit(entitiesFor(-1, null), `SpaceSaving tracks ${k} counters over ${stream.length} stream items.`, 0, {
        stage: "init",
        stream: [...stream],
        exact: [...exact].map(([key, count]) => `${key}:${count}`),
    });

    for (let i = 0; i < stream.length; i += 1) {
        const item = stream[i] as number;
        const existing = counters.find((c) => c.key === item);
        let action: string;
        if (existing) {
            existing.count += 1;
            action = "increment";
        } else if (counters.length < k) {
            counters.push({ key: item, count: 1 });
            action = "insert";
        } else {
            let minSlot = 0;
            for (let slot = 1; slot < counters.length; slot += 1) {
                if ((counters[slot] as Counter).count < (counters[minSlot] as Counter).count) minSlot = slot;
            }
            const minimum = (counters[minSlot] as Counter).count;
            counters[minSlot] = { key: item, count: minimum + 1 };
            action = "replace";
        }
        counters.sort((a, b) => b.count - a.count || a.key - b.key);
        yield emit(entitiesFor(i, item), `Item ${i + 1}: ${item} -> ${action}; estimates ${counters.map((c) => `${c.key}:${c.count}`).join(", ")}.`, action === "increment" ? 1 : action === "insert" ? 2 : 3, {
            stage: "stream",
            action,
            counters: counters.map((c) => `${c.key}:${c.count}`),
        });
    }

    const threshold = stream.length / k;
    let maxError = 0;
    for (const counter of counters) {
        maxError = Math.max(maxError, counter.count - (exact.get(counter.key) ?? 0));
    }
    const reported = counters.map((c) => c.key).sort((a, b) => a - b);
    const missing = [...exact.keys()].filter((key) => (exact.get(key) as number) > threshold && !reported.includes(key));
    yield emit(
        [
            ...counters.map((c, i) => cell(`f-${i}`, 0, i, `${c.key}:${c.count}`, `${c.key}:${c.count}`, "sorted")),
            ...[...exact].map(([key, count], i) => cell(`e-${i}`, 1, i, `${key}:${count}`, `${key}:${count}`, "visited")),
        ],
        `Done: ${counters.length} estimate(s); maximum overestimate ${maxError}, bound ${Math.floor(threshold)}.`,
        4,
        {
            stage: "done",
            threshold,
            maxError,
            reported,
            estimates: counters.map((c) => `${c.key}:${c.count}`),
            exact: [...exact].map(([key, count]) => `${key}:${count}`),
            missing,
        },
    );
}

/** The SpaceSaving module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "If a key is rare, it is cheap to sacrifice it for a newer key that might be common. SpaceSaving keeps k slots ordered by estimated count. A new key evicts the current minimum and inherits its count plus one, so the counter is a conservative upper estimate that can only help catch keys that keep reappearing.",
        invariants: [
            "Estimates are sorted in nonincreasing order after every item.",
            "A key's estimate is always at least its true frequency.",
            "The estimate error for any key is at most n over k.",
        ],
        correctness:
            "Incrementing a tracked key keeps its estimate exact until a replacement. When a new key replaces the minimum counter with value c, the evicted key's estimate was at least its true count and the new key starts at c+1; charging the extra one to this replacement event, the total number of replacements affecting any key is at most n/k because each replacement consumes one stream item and there are only k counters. Hence every estimate is within n/k above the true count, and any key with frequency above n/k must occupy a slot.",
        complexityRationale:
            "Each item searches k counters for a match or a minimum and re-sorts the small table, costing O(k) per item and O(m*k) total time. Only the k counters are needed beyond the stream itself, so the working space is O(k).",
        uses: [
            "Top-k heavy hitter detection in stream processing",
            "Finding the most frequent IP addresses for anomaly detection",
            "Frequency sketches in database query optimizers",
        ],
        references: [
            "Metwally, Agrawal, and El Abbadi, Efficient Computation of Frequent and Top-k Elements in Data Streams, 2005",
            "Cormode and Hadjieleftheriou, Finding Frequent Items in Data Streams, 2008",
        ],
        workedExample:
            "With k=2 and the stream 1, 2, 3, 1, 1, the table fills with {1:1, 2:1}; item 3 replaces key 2 as {3:2, 1:1}; the two 1s raise key 1 to 3. Key 1's estimate 3 matches its true count, while key 3 is overestimated by one, within the n/k bound.",
    },
    id: "space-saving",
    name: "SpaceSaving",
    category: "production-systems",
    complexity: { time: "O(m * k)", space: "O(k)" },
    defaultInput: { stream: DEFAULT_STREAM, k: 4 },
    visualType: "grid",
    run,
    pseudocode: [
        "initialize k empty counters",
        "for each item in the stream",
        "if the item is tracked, increment its estimate",
        "else if a slot is free, insert it with estimate one",
        "else replace the minimum key with estimate min plus one",
        "reorder counters from largest estimate to smallest",
        "done: report estimates and the maximum error bound",
    ],
};

export default module;
