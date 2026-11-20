/**
 * d-left-hashing.ts - d-Left Hashing
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * The table is split into d subtables of equal size. A key hashes to one
 * bucket in every subtable using d independent hash functions. Insertion
 * scans those candidate buckets from left to right and places the key in the
 * first one with a free slot. The leftmost preference makes heavily loaded
 * buckets push keys to the right, producing a very uneven but shallow load
 * distribution with few collisions.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(d * slots) per insert or lookup
 *   Space: O(d * buckets * slots)
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - One row per subtable, one cell per bucket.
 *   - A cell label lists the keys currently stored in that bucket.
 *   - The bucket receiving the current key is YELLOW; full buckets are RED.
 */
import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

function hashKey(key: string, seed: number, buckets: number): number {
    let h = 2166136261;
    for (let i = 0; i < key.length; i += 1) {
        h ^= key.charCodeAt(i) + seed * 31;
        h = Math.imul(h, 16777619);
    }
    return (h >>> 0) % buckets;
}

function makeCells(
    d: number,
    buckets: number,
    slots: string[][][],
    active: [number, number] | null,
): VisualEntity[] {
    const cells: VisualEntity[] = [];
    for (let table = 0; table < d; table += 1) {
        for (let bucket = 0; bucket < buckets; bucket += 1) {
            const items = slots[table]?.[bucket] ?? [];
            let state: EntityState = "idle";
            if (active && active[0] === table && active[1] === bucket) {
                state = "comparing";
            } else if (items.length >= 2) {
                state = "error";
            } else if (items.length > 0) {
                state = "visited";
            }
            cells.push({
                id: `cell-${table}-${bucket}`,
                type: "cell" as const,
                label: items.length > 0 ? items.join(",") : "-",
                value: items.length,
                state,
                x: 0,
                y: 0,
                width: 0,
                height: 0,
                metadata: { row: table, col: bucket, keys: items.join(",") },
            });
        }
    }
    return cells;
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { keys?: (number | string)[]; d?: number; buckets?: number } | null) ?? {};
    const keys = (Array.isArray(task.keys) ? task.keys : ["cat", "dog", "bird", "fish", "cow", "pig"])
        .map((k) => String(k));
    const d = Math.min(4, Math.max(1, Math.floor(typeof task.d === "number" ? task.d : 2)));
    const buckets = Math.min(12, Math.max(2, Math.floor(typeof task.buckets === "number" ? task.buckets : 4)));
    const slots: string[][][] = Array.from({ length: d }, () =>
        Array.from({ length: buckets }, () => [] as string[]),
    );
    let step = 0;

    const frame = (active: [number, number] | null, description: string, line: number, placed: number): VisualFrame => ({
        stepNumber: step++,
        entities: makeCells(d, buckets, slots, active),
        edges: [],
        description,
        codeLineNumber: line,
        layout: "grid",
        meta: { rows: d, cols: buckets, placed, total: keys.length, d, buckets },
    });

    yield frame(null, `Inserting ${keys.length} key(s) into a ${d}-left table with ${buckets} buckets per subtable.`, 0, 0);

    let placed = 0;
    for (const key of keys) {
        let target: string[] | null = null;
        let targetTable = -1;
        let targetBucket = -1;
        for (let table = 0; table < d; table += 1) {
            const bucket = hashKey(key, table + 1, buckets);
            const cell = slots[table]?.[bucket];
            if (!cell) continue;
            if (cell.length < 2) {
                target = cell;
                targetTable = table;
                targetBucket = bucket;
                break;
            }
        }
        if (target) {
            target.push(key);
            placed += 1;
            yield frame(
                [targetTable, targetBucket],
                `Key "${key}" placed in subtable ${targetTable}, bucket ${targetBucket} (first with a free slot).`,
                3,
                placed,
            );
        } else {
            yield frame(
                null,
                `Key "${key}" found no free candidate slot and was rejected.`,
                5,
                placed,
            );
        }
    }

    const finalFrame = frame(null, `Placed ${placed} of ${keys.length} key(s) using ${d}-left hashing.`, 7, placed);
    yield finalFrame;
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Split the table into several subtables and give each key one candidate bucket in each. Instead of choosing the first position blindly, look at all candidates and drop the key into the leftmost subtable that still has room. Busy left buckets naturally push later keys rightward, so the load spreads out well.",
        invariants: [
            "Every key is examined in the same subtable order on insert and lookup.",
            "A bucket never holds more than two keys in this teaching model.",
            "Once a key is placed in a subtable, later subtables are not consulted for it.",
        ],
        correctness:
            "A lookup recomputes the same d candidate buckets in the same left-to-right order and stops at the first match, so it finds exactly the key that insertion stored. Because insertion only uses a bucket with a free slot, capacity is never exceeded. The leftmost-placement rule is deterministic, so replaying the same keys yields the same table.",
        complexityRationale:
            "Each operation probes up to d buckets and scans at most the constant number of slots in each, giving O(d * slots) time. The table stores d times buckets times slots cells, so space is O(d * buckets * slots).",
        uses: [
            "High-load hash tables in network routers and caches",
            "Cuckoo-style placement with few relocations",
            "Fingerprint tables for membership filters",
        ],
        references: [
            "Carter and Wegman, Universal Classes of Hash Functions, 1977",
            "Cormen et al., Introduction to Algorithms, Chapter 11",
        ],
        workedExample:
            "With two subtables of four two-slot buckets, the key cat may hash to bucket 1 in subtable 0 and bucket 3 in subtable 1. If subtable 0 bucket 1 is empty, cat goes there. A later key whose left candidate is full will be pushed to its right candidate.",
    },
    id: "d-left-hashing",
    name: "d-Left Hashing",
    category: "data-structures",
    complexity: { time: "O(d * slots)", space: "O(d * buckets * slots)" },
    defaultInput: { keys: ["cat", "dog", "bird", "fish", "cow", "pig"], d: 2, buckets: 4 },
    visualType: "grid",
    run,
    pseudocode: [
        "read the keys, the number of subtables d, and the bucket count",
        "create d subtables of buckets with two slots each",
        "for each key compute its bucket in every subtable",
        "scan the candidate buckets from left to right",
        "place the key in the first bucket with a free slot",
        "if no candidate has room report that the key was rejected",
        "lookup repeats the same scan and stops at the first match",
        "report the final placement of every key",
    ],
};

export default module;
