/**
 * dynamic-perfect-hashing.ts - Dynamic Perfect Hashing (Two-Level Scheme)
 *
 * A dynamic perfect hash table uses a top-level hash to distribute keys into
 * buckets and a separate second-level hash table inside each bucket. Whenever an
 * insertion would create a collision, that bucket alone is rebuilt with a new
 * second-level hash function until every key lands in its own slot. Lookups need
 * at most two probes and never collide.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

function makeCells(cells: Array<[string, string]>, highlight: number): VisualEntity[] {
    return cells.map(([label, value], index) => ({
        id: `cell-${index}`,
        type: "cell" as const,
        label: value ? `${label}: ${value}` : label,
        value,
        state: (index === highlight ? "active" : value ? "sorted" : "idle") as EntityState,
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { row: Math.floor(index / 4), col: index % 4, index },
    }));
}

function frac(x: number): number {
    return x - Math.floor(x);
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { keys?: number[]; buckets?: number } | null) ?? {};
    const keys: number[] = Array.isArray(task.keys) ? [...task.keys] : [5, 3, 8, 1, 9, 2, 7, 4, 6];
    const bucketCount = Math.max(1, typeof task.buckets === "number" ? Math.floor(task.buckets) : 5);
    const topSeed = 0.6180339887498949;
    const bucketOf = (key: number): number => Math.floor(frac(key * topSeed) * bucketCount) % bucketCount;

    let seed = 2246822519 >>> 0;
    const rand = (): number => {
        seed = (Math.imul(seed, 3266489917) + 374761393) >>> 0;
        return seed / 4294967296;
    };

    const buckets: Array<{ keys: number[]; slots: number[]; seed: number }> = Array.from(
        { length: bucketCount },
        () => ({ keys: [], slots: [], seed: 0 }),
    );
    let rebuilds = 0;
    let collisions = 0;
    const frames: VisualFrame[] = [];

    const rebuild = (index: number): void => {
        const bucket = buckets[index]!;
        const k = bucket.keys.length;
        const size = Math.max(2, k * k);
        let placed: number[] | null = null;
        for (let attempt = 0; attempt < 80 && placed === null; attempt += 1) {
            const b = 0.001 + rand() * 0.998;
            const slots = new Array<number>(size).fill(-1);
            let ok = true;
            for (const key of bucket.keys) {
                const slot = Math.floor(frac(key * b) * size) % size;
                if (slots[slot] !== -1) {
                    ok = false;
                    collisions += 1;
                    break;
                }
                slots[slot] = key;
            }
            if (ok) {
                placed = slots;
                bucket.seed = b;
            }
        }
        if (placed === null) {
            const slots = new Array<number>(bucket.keys.length).fill(-1);
            bucket.keys.forEach((key, i) => {
                slots[i] = key;
            });
            placed = slots;
            bucket.seed = 0;
        }
        bucket.slots = placed;
        rebuilds += 1;
    };

    const push = (highlight: number, desc: string, line: number): void => {
        const cells: Array<[string, string]> = buckets.map((b, i) => [`bucket ${i}`, b.keys.join(",") || "-"]);
        frames.push({
            stepNumber: frames.length,
            entities: makeCells(cells, highlight),
            edges: [],
            description: desc,
            codeLineNumber: line,
            layout: "grid",
            meta: {
                keys: [...keys],
                buckets: bucketCount,
                rebuilds,
                collisions,
                slots: buckets.map((b) => [...b.slots]),
                bucketKeys: buckets.map((b) => [...b.keys]),
                rows: Math.ceil(bucketCount / 4),
                cols: 4,
            },
        });
    };

    push(-1, `Inserting ${keys.length} key(s) into ${bucketCount} top-level bucket(s).`, 0);
    for (const key of keys) {
        const b = bucketOf(key);
        buckets[b]!.keys.push(key);
        rebuild(b);
        push(b, `Inserted ${key} into bucket ${b}; rebuilt its second-level table.`, 3);
    }

    const lookups: Array<[number, boolean]> = [];
    for (const key of keys) {
        const b = bucketOf(key);
        const slots = buckets[b]!.slots;
        let ok = false;
        if (buckets[b]!.seed !== 0) {
            const size = slots.length;
            const slot = Math.floor(frac(key * buckets[b]!.seed) * size) % size;
            ok = slots[slot] === key;
        } else {
            ok = slots.includes(key);
        }
        lookups.push([key, ok]);
    }

    for (const frame of frames) yield frame;
    yield {
        stepNumber: frames.length,
        entities: makeCells(
            buckets.map((b, i) => [`bucket ${i}`, b.keys.join(",") || "-"]),
            -1,
        ).map((e) => ({ ...e, state: "sorted" as EntityState })),
        edges: [],
        description: `Done: ${keys.length} key(s) stored with ${rebuilds} rebuild(s) and ${collisions} trial collision(s).`,
        codeLineNumber: 5,
        layout: "grid",
        meta: {
            keys: [...keys],
            buckets: bucketCount,
            rebuilds,
            collisions,
            slots: buckets.map((b) => [...b.slots]),
            bucketKeys: buckets.map((b) => [...b.keys]),
            lookups,
            rows: Math.ceil(bucketCount / 4),
            cols: 4,
        },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "A single hash function eventually collides, so split the work in two. A top-level hash chooses a small bucket, and that bucket gets its own private hash table whose size is the square of the number of keys it holds. A collision only forces a rebuild of one small bucket, not the whole table.",
        invariants: [
            "Every key lives in exactly one second-level slot of its top-level bucket.",
            "After a successful rebuild, no two keys in a bucket share a slot.",
            "Lookups inspect only the key's top-level bucket and one second-level slot.",
        ],
        correctness:
            "The top-level hash deterministically assigns each key to a bucket. Rebuilding tries second-level multipliers until a collision-free injection into the k-squared slots exists; such a multiplier exists with high probability and is verified before acceptance, so stored keys never collide. A lookup recomputes the same bucket and the same second-level slot, finding the key if and only if it was inserted.",
        complexityRationale:
            "Expected insertion time is constant because a bucket of size k is rebuilt O(k) times with k-squared slots, giving amortized O(1). Lookups take two hash evaluations, and total space is O(n) because bucket sizes grow quadratically only within small buckets.",
        uses: [
            "Static and dynamic dictionaries with worst-case constant lookups",
            "Router forwarding tables and fast IP lookups",
            "Bloom-filter alternatives where deletions are required",
        ],
        references: [
            "Dietzfelbinger, Karlin, Meyer auf der Heide, Meyer and Rohnert, Dynamic Perfect Hashing, 1994",
            "Fredman, Komlos and Szemeredi, Storing a Sparse Table with O(1) Worst Case Access Time, 1984",
        ],
        workedExample:
            "Inserting keys 5, 3 and 8 into three buckets may put 5 and 8 together. Their bucket is rebuilt with k = 2 and four slots until a multiplier separates them, after which both are found with a single probe each.",
    },
    id: "dynamic-perfect-hashing",
    name: "Dynamic Perfect Hashing",
    category: "data-structures",
    complexity: { time: "O(1) expected insert and lookup", space: "O(n)" },
    defaultInput: { keys: [5, 3, 8, 1, 9, 2, 7, 4, 6], buckets: 5 },
    visualType: "grid",
    run,
    pseudocode: [
        "choose a top-level hash and create empty buckets",
        "for each key, hash it to a top-level bucket",
        "add the key to that bucket and try a second-level hash",
        "size the second-level table to the square of the bucket size",
        "rebuild the bucket until no two keys share a slot",
        "answer lookups with one top-level and one second-level probe",
        "done: report the resulting tables and lookup results",
    ],
};

export default module;
