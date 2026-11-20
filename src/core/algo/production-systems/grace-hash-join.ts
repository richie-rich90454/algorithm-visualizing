/**
 * grace-hash-join.ts - Grace Hash Join
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Grace hash join handles equi-joins that are too large for an in-memory hash
 * table. It first partitions both relations into the same number of buckets
 * by hashing the join key, so matching keys can only meet inside one bucket.
 * Each bucket pair is then joined independently by building a small hash table
 * on one side and probing it with the other side.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(n + m) expected for n left and m right rows
 *   Space: O(n + m / buckets) for the largest in-memory bucket pair
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - A grid shows one row per bucket: left count and right count columns.
 *   - Partitioning highlights the bucket receiving the current row.
 *   - Probing marks the bucket green and lists the pairs it produced.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

type Row = { key: number; label: string };

/** Read a row tuple in either object or array form. */
function asRow(value: unknown): Row {
    if (Array.isArray(value)) {
        return { key: Number(value[0]), label: String(value[1]) };
    }
    const row = (value ?? {}) as { key?: number; label?: string };
    return { key: Number(row.key ?? 0), label: String(row.label ?? "") };
}

/** The Grace hash join module. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { left?: unknown[]; right?: unknown[]; buckets?: number } | null) ?? {};
    const left: Row[] = Array.isArray(task.left) ? task.left.map(asRow) : [
        { key: 1, label: "a" },
        { key: 2, label: "b" },
        { key: 3, label: "c" },
        { key: 4, label: "d" },
        { key: 5, label: "e" },
    ];
    const right: Row[] = Array.isArray(task.right) ? task.right.map(asRow) : [
        { key: 2, label: "u" },
        { key: 3, label: "v" },
        { key: 3, label: "w" },
        { key: 5, label: "x" },
        { key: 7, label: "y" },
    ];
    const buckets = Math.max(2, Math.floor(task.buckets ?? 4));

    const leftBuckets: Row[][] = Array.from({ length: buckets }, () => []);
    const rightBuckets: Row[][] = Array.from({ length: buckets }, () => []);
    const results: string[][] = [];
    const bucketOf = (key: number): number => ((key % buckets) + buckets) % buckets;

    const cells = (highlight: number | null, probing: Set<number>): VisualEntity[] => {
        const entities: VisualEntity[] = [];
        for (let b = 0; b < buckets; b += 1) {
            for (let col = 0; col < 2; col += 1) {
                const count = (col === 0 ? leftBuckets : rightBuckets)[b]?.length ?? 0;
                let state: EntityState = "idle";
                if (probing.has(b)) state = "sorted";
                else if (highlight === b) state = "active";
                entities.push({
                    id: `cell-${b}-${col}`,
                    type: "cell" as const,
                    label: String(count),
                    value: count,
                    state,
                    x: 0,
                    y: 0,
                    width: 0,
                    height: 0,
                    metadata: { row: b, col, bucket: b, side: col === 0 ? "left" : "right" },
                });
            }
        }
        return entities;
    };

    const counts = (): number[][] => [
        leftBuckets.map((bucket) => bucket.length),
        rightBuckets.map((bucket) => bucket.length),
    ];

    yield {
        stepNumber: 0,
        entities: cells(null, new Set()),
        edges: [],
        description: `Starting a Grace hash join of ${left.length} left and ${right.length} right rows into ${buckets} buckets.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: { rows: buckets, cols: 2, counts: counts(), results: [], probing: -1 },
    };
    let step = 1;

    for (let i = 0; i < left.length; i += 1) {
        const row = left[i] as Row;
        const b = bucketOf(row.key);
        leftBuckets[b]?.push(row);
        yield {
            stepNumber: step,
            entities: cells(b, new Set()),
            edges: [],
            description: `Partitioned left row (${row.key}, ${row.label}) into bucket ${b}; that bucket now has ${leftBuckets[b]?.length} left row(s).`,
            codeLineNumber: 1,
            layout: "grid",
            meta: { rows: buckets, cols: 2, counts: counts(), results: [], probing: -1 },
        };
        step += 1;
    }
    for (let i = 0; i < right.length; i += 1) {
        const row = right[i] as Row;
        const b = bucketOf(row.key);
        rightBuckets[b]?.push(row);
        yield {
            stepNumber: step,
            entities: cells(b, new Set()),
            edges: [],
            description: `Partitioned right row (${row.key}, ${row.label}) into bucket ${b}; that bucket now has ${rightBuckets[b]?.length} right row(s).`,
            codeLineNumber: 2,
            layout: "grid",
            meta: { rows: buckets, cols: 2, counts: counts(), results: [], probing: -1 },
        };
        step += 1;
    }

    for (let b = 0; b < buckets; b += 1) {
        const table = new Map<number, string[]>();
        for (const row of leftBuckets[b] ?? []) {
            if (!table.has(row.key)) table.set(row.key, []);
            table.get(row.key)?.push(row.label);
        }
        let produced = 0;
        for (const row of rightBuckets[b] ?? []) {
            for (const label of table.get(row.key) ?? []) {
                results.push([label, row.label]);
                produced += 1;
            }
        }
        yield {
            stepNumber: step,
            entities: cells(null, new Set([b])),
            edges: [],
            description: `Joined bucket ${b}: ${leftBuckets[b]?.length} left row(s) probed by ${rightBuckets[b]?.length} right row(s) produced ${produced} pair(s).`,
            codeLineNumber: 5,
            layout: "grid",
            meta: { rows: buckets, cols: 2, counts: counts(), results: results.slice(), probing: b },
        };
        step += 1;
    }

    yield {
        stepNumber: step,
        entities: cells(null, new Set(Array.from({ length: buckets }, (_, i) => i))),
        edges: [],
        description: `Join complete: ${results.length} matching pair(s) found across ${buckets} bucket(s).`,
        codeLineNumber: 7,
        layout: "grid",
        meta: { rows: buckets, cols: 2, counts: counts(), results: results.slice(), probing: -1 },
    };
}

/** The Grace hash join module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "A plain hash join needs to hold one whole relation in memory. Grace hash join first spreads both relations into buckets using the same hash of the join key, which guarantees that any matching pair ends up in the same bucket. It then joins one bucket pair at a time, so each in-memory hash table is only a fraction of the full relation.",
        invariants: [
            "A row is placed in bucket (key modulo bucketCount) on both sides.",
            "Rows with different buckets can never satisfy the equality predicate.",
            "Every pair produced has equal join keys.",
        ],
        correctness:
            "Equal keys have the same hash and therefore the same bucket, so no valid pair is ever separated. Conversely, a pair from different buckets has unequal hashes and cannot have equal keys. Within one bucket, building a map from key to all matching left labels and probing with every right row emits exactly the cross product of equal-key rows, which is the equi-join restricted to that bucket. Unioning the disjoint buckets gives the full join result.",
        complexityRationale:
            "Partitioning scans each row once, and probing scans each bucket row once, giving expected O(n + m) time under a uniform hash. The largest resident structure is one bucket pair, so peak space is O(n / buckets + m / buckets) plus the output.",
        uses: [
            "Large equi-joins in analytic databases",
            "Join operators that must spill to disk when memory is limited",
            "Parallel join execution where buckets map to different workers",
        ],
        references: [
            "Kitsuregawa, Tanaka, and Mogi, Application of Hash to Data Base Machine, 1983",
            "Garcia-Molina, Ullman, and Widom, Database Systems: The Complete Book, Chapter 14",
        ],
        workedExample:
            "With two buckets, left rows (1,a) and (2,b) go to buckets 1 and 0, while right rows (2,u) and (4,v) go to bucket 0. Only bucket 0 is joined, and probing its left map with (2,u) yields the single pair (b, u).",
    },
    id: "grace-hash-join",
    name: "Grace Hash Join",
    category: "production-systems",
    complexity: { time: "O(n + m) expected", space: "O((n + m) / buckets)" },
    defaultInput: {
        left: [
            { key: 1, label: "a" },
            { key: 2, label: "b" },
            { key: 3, label: "c" },
            { key: 4, label: "d" },
            { key: 5, label: "e" },
        ],
        right: [
            { key: 2, label: "u" },
            { key: 3, label: "v" },
            { key: 3, label: "w" },
            { key: 5, label: "x" },
            { key: 7, label: "y" },
        ],
        buckets: 4,
    },
    visualType: "grid",
    run,
    pseudocode: [
        "choose the number of hash buckets",
        "hash-partition the left relation into buckets",
        "hash-partition the right relation into the same buckets",
        "for each bucket",
        "build a hash table on the left rows of that bucket",
        "probe it with every right row of the bucket",
        "emit each equal-key pair as an output row",
        "done: report all joined pairs",
    ],
};

export default module;
