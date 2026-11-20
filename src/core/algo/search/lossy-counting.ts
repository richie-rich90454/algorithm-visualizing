/**
 * lossy-counting.ts - Lossy Counting for Frequent Items
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Lossy Counting finds items whose frequency exceeds a fraction epsilon of a
 * long stream using only O(1/epsilon log(epsilon N)) counters. The stream is
 * split into buckets of width 1/epsilon. Each entry stores an approximate count
 * and an error bound; at bucket boundaries entries whose upper frequency bound
 * can no longer reach the threshold are discarded.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(N) amortized over a stream of length N
 *   Space: O((1/epsilon) log(epsilon N)) counters
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Grid cells hold item, approximate count, and error bound.
 *   - The incoming item is GOLD; pruned entries disappear at bucket edges.
 *   - Surviving candidates in the final frame are GREEN.
 */
import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface Entry {
    count: number;
    error: number;
}

/** Pure reference step: returns the final candidate items. */
export function lossyCountingCandidates(stream: string[], epsilon: number): string[] {
    const width = Math.max(1, Math.ceil(1 / epsilon));
    const table = new Map<string, Entry>();
    let bucket = 1;
    for (let i = 0; i < stream.length; i += 1) {
        const item = stream[i] as string;
        const e = table.get(item);
        if (e) e.count += 1;
        else table.set(item, { count: 1, error: bucket - 1 });
        if ((i + 1) % width === 0) {
            for (const [key, v] of [...table.entries()]) {
                if (v.count + v.error <= bucket) table.delete(key);
            }
            bucket += 1;
        }
    }
    const threshold = epsilon * stream.length;
    return [...table.entries()].filter(([, v]) => v.count > threshold).map(([k]) => k);
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { stream?: string[]; epsilon?: number } | null) ?? {};
    const stream: string[] = Array.isArray(task.stream)
        ? [...(task.stream as string[])]
        : ["a", "b", "a", "c", "a", "b", "a", "d", "a", "b", "a", "e", "a", "b", "a", "c", "a", "b", "a", "d"];
    const epsilon = typeof task.epsilon === "number" && task.epsilon > 0 ? task.epsilon : 0.1;
    const width = Math.max(1, Math.ceil(1 / epsilon));
    const table = new Map<string, Entry>();
    let bucket = 1;
    let step = 0;

    const emit = (
        index: number,
        description: string,
        codeLineNumber: number,
        final = false,
        pruned: string[] = [],
        extra: Record<string, number | string | boolean | Array<number | string>> = {},
    ): VisualFrame => {
        const entities: VisualEntity[] = [...table.entries()].map(([key, v], col) => ({
            id: `cell-${col}`,
            type: "cell" as const,
            label: `${key}=${v.count}/${v.error}`,
            value: key,
            state: final ? "sorted" as EntityState : pruned.includes(key) ? "error" as EntityState : "idle" as EntityState,
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: { row: 0, col, item: key, count: v.count, error: v.error },
        }));
        const cur = index >= 0 && index < stream.length ? stream[index] : undefined;
        if (cur !== undefined) {
            entities.push({
                id: "current",
                type: "cell" as const,
                label: `now: ${cur}`,
                value: cur,
                state: "comparing" as EntityState,
                x: 0,
                y: 0,
                width: 0,
                height: 0,
                metadata: { row: 1, col: index },
            });
        }
        if (entities.length === 0) {
            entities.push({
                id: "empty",
                type: "cell" as const,
                label: "empty table",
                value: "empty",
                state: "idle" as EntityState,
                x: 0,
                y: 0,
                width: 0,
                height: 0,
                metadata: { row: 0, col: 0 },
            });
        }
        const s = step;
        step += 1;
        return {
            stepNumber: s,
            entities,
            edges: [],
            description,
            codeLineNumber,
            layout: "grid",
            meta: { epsilon, width, bucket, N: stream.length, index, entries: table.size, ...extra },
        };
    };

    yield emit(-1, `Lossy counting with epsilon=${epsilon} and bucket width ${width}.`, 0);
    for (let i = 0; i < stream.length; i += 1) {
        const item = stream[i] as string;
        const e = table.get(item);
        if (e) {
            e.count += 1;
            yield emit(i, `Saw "${item}" again: count ${e.count}, error ${e.error}.`, 2);
        } else {
            table.set(item, { count: 1, error: bucket - 1 });
            yield emit(i, `New item "${item}" starts at count 1 with error ${bucket - 1}.`, 3);
        }
        if ((i + 1) % width === 0) {
            const pruned: string[] = [];
            for (const [key, v] of [...table.entries()]) {
                if (v.count + v.error <= bucket) {
                    table.delete(key);
                    pruned.push(key);
                }
            }
            bucket += 1;
            yield emit(i, `Bucket boundary: pruned ${pruned.length} entry(ies); now bucket ${bucket}.`, 4, false, pruned);
        }
    }
    const threshold = epsilon * stream.length;
    const candidates = lossyCountingCandidates(stream, epsilon);
    yield emit(
        stream.length,
        `Candidates above the ${threshold.toFixed(2)} threshold: ${candidates.join(", ") || "none"}.`,
        5,
        true,
        [],
        { candidates },
    );
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Lossy counting tracks possible frequent items with a small table. Each counter records an approximate count and the maximum number of times the item could have been undercounted. At the end of every bucket of 1/epsilon items, entries whose count plus error cannot possibly pass the frequency threshold are thrown away, so only plausible heavy hitters survive.",
        invariants: [
            "For every stream item, its true frequency is at most count plus error and at least its count in the table.",
            "A pruned entry has count plus error at most the current bucket number, so it cannot exceed the epsilon threshold.",
            "The error bound of an entry is the bucket index when the entry was first created.",
        ],
        correctness:
            "When an item is missing from the table, at most one occurrence per bucket can be missed, so the stored error increases by one per bucket. The pruning rule removes an entry only when its count plus error cannot exceed the current bucket number, which is roughly epsilon times the items seen so far; a truly frequent item therefore survives once enough full buckets have passed. On very short streams the bucket granularity is coarse, so borderline items can be lost, and false positives are confirmable in a second pass.",
        complexityRationale:
            "Each stream item updates at most one counter, and pruning removes entries that cannot return, giving O(1) amortized time per item. The number of live counters is bounded by O((1/epsilon) log(epsilon N)), which is the space used.",
        uses: [
            "Finding heavy network flows and popular search terms",
            "Streaming analytics where a small false-positive rate is acceptable",
            "Approximate query answering over very large logs",
        ],
        references: [
            "Manku and Motwani, Approximate Frequency Counts over Data Streams, VLDB 2002",
            "Muthukrishnan, Data Streams: Algorithms and Applications, 2005",
        ],
        workedExample:
            "On a twenty-item stream with epsilon 0.1, buckets hold ten items. Item a appears eleven times and is counted throughout; a rare item such as e is inserted with a small count and is removed at the next bucket boundary because count plus error cannot reach two.",
    },
    id: "lossy-counting",
    name: "Lossy Counting",
    category: "searching",
    complexity: { time: "O(N) amortized", space: "O((1/epsilon) log(epsilon N))" },
    defaultInput: {
        stream: ["a", "b", "a", "c", "a", "b", "a", "d", "a", "b", "a", "e", "a", "b", "a", "c", "a", "b", "a", "d"],
        epsilon: 0.1,
    },
    visualType: "grid",
    run,
    pseudocode: [
        "width = ceil(1/epsilon), bucket = 1, table empty",
        "for each item at position i in the stream",
        "if item is in the table: increment its count",
        "else insert (count=1, error=bucket-1)",
        "if (i+1) is a multiple of width: prune count+error <= bucket, bucket++",
        "after the stream, set threshold = epsilon * N",
        "report entries whose count exceeds the threshold",
        "done: candidates include every truly frequent item",
    ],
};

export default module;
