/**
 * concurrent-hash-map.ts - Concurrent Hash Map with Lock Striping
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * A striped hash map protects its buckets with a small array of locks instead
 * of one lock for the whole table. A thread that wants to touch a key hashes
 * the key to a bucket, maps the bucket to a stripe, and acquires only that
 * stripe's lock. Operations on different stripes can therefore proceed in
 * parallel, while operations that share a stripe serialize. The visualization
 * uses a fixed round-robin schedule so the interleaving is deterministic and
 * replayable.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(1) expected per operation plus O(1) lock bookkeeping
 *   Space: O(n + s) for n entries and s locks
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Each bucket is a grid row; each lock is shown in a final lock row.
 *   - A requested stripe is YELLOW (comparing); its entries turn GREEN after
 *     a successful update; a blocked request is RED (error).
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

type Op = { op: "put" | "get" | "remove"; key: number; value?: number };
type ThreadSpec = { ops?: Op[] };

function hashKey(key: number): number {
    let h = (Math.imul(key ^ 0x5bd1e995, 0x27d4eb2d) ^ (key >>> 3)) >>> 0;
    h ^= h >>> 15;
    return h >>> 0;
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { buckets?: number; stripes?: number; threads?: ThreadSpec[] } | null) ?? {};
    const buckets = Math.max(2, Math.min(8, Math.round(task.buckets ?? 4)));
    const stripes = Math.max(1, Math.min(buckets, Math.round(task.stripes ?? 2)));
    const fallbackThreads: ThreadSpec[] = [
        { ops: [{ op: "put", key: 1, value: 10 }, { op: "get", key: 1 }, { op: "put", key: 3, value: 30 }] },
        { ops: [{ op: "put", key: 2, value: 20 }, { op: "get", key: 2 }] },
    ];
    const threads: Op[][] = (task.threads ?? fallbackThreads).map((t) => t.ops ?? []);

    const table: Array<Array<[number, number]>> = Array.from({ length: buckets }, () => []);
    const locks: Array<number | null> = Array.from({ length: stripes }, () => null);
    const cursor = threads.map(() => 0);
    let step = 0;
    let acquisitions = 0;
    let blocks = 0;
    let lastMessage = "Initial striped hash map.";
    let activeBucket = -1;
    let activeStripe = -1;
    let activeKey = -1;
    let state: EntityState = "idle";

    const stripeOf = (key: number): number => hashKey(key) % stripes;
    const bucketOf = (key: number): number => hashKey(key) % buckets;

    const frame = (description: string, line: number, meta: VisualFrame["meta"]): VisualFrame => {
        const maxEntries = Math.max(1, ...table.map((row) => row.length));
        const entities: VisualEntity[] = [];
        for (let b = 0; b < buckets; b += 1) {
            const row = table[b] ?? [];
            for (let c = 0; c < maxEntries; c += 1) {
                const entry = row[c];
                const entityState: EntityState =
                    b === activeBucket && entry?.[0] === activeKey
                        ? state
                        : b === activeStripe
                          ? "comparing"
                          : "idle";
                entities.push({
                    id: `hm-${b}-${c}`,
                    type: "cell" as const,
                    label: entry ? `${entry[0]}=${entry[1]}` : "(empty)",
                    value: entry ? entry[1] : "",
                    state: entityState,
                    x: 0,
                    y: 0,
                    width: 0,
                    height: 0,
                    metadata: { row: b, col: c },
                });
            }
        }
        for (let s = 0; s < stripes; s += 1) {
            entities.push({
                id: `lock-${s}`,
                type: "cell" as const,
                label: `L${s}:${locks[s] === null ? "free" : `T${locks[s]}`}`,
                value: locks[s] === null ? -1 : (locks[s] as number),
                state: s === activeStripe ? state : locks[s] === null ? "sorted" : "comparing",
                x: 0,
                y: 0,
                width: 0,
                height: 0,
                metadata: { row: buckets, col: s },
            });
        }
        return {
            stepNumber: step,
            entities,
            edges: [],
            description,
            codeLineNumber: line,
            layout: "grid",
            meta: { rows: buckets + 1, cols: maxEntries, ...meta },
        };
    };

    yield frame(lastMessage, 0, {
        phase: "start",
        buckets,
        stripes,
        acquisitions,
        blocks,
        size: 0,
        content: [],
    });
    step += 1;

    let rounds = 0;
    while (cursor.some((c, i) => c < (threads[i]?.length ?? 0)) && rounds < 1000) {
        rounds += 1;
        for (let t = 0; t < threads.length; t += 1) {
            const ops = threads[t] ?? [];
            const index = cursor[t] ?? 0;
            if (index >= ops.length) {
                continue;
            }
            const op = ops[index] as Op;
            const stripe = stripeOf(op.key);
            const bucket = bucketOf(op.key);
            activeBucket = bucket;
            activeStripe = stripe;
            activeKey = op.key;
            const owner = locks[stripe] ?? null;

            if (owner !== null && owner !== t) {
                blocks += 1;
                state = "error";
                yield frame(
                    `Thread T${t} waits for stripe L${stripe} (held by T${owner}) to ${op.op} key ${op.key}.`,
                    2,
                    {
                        phase: "blocked",
                        thread: t,
                        op: op.op,
                        key: op.key,
                        stripe,
                        blocked: true,
                        acquisitions,
                        blocks,
                        size: table.reduce((sum, row) => sum + row.length, 0),
                        content: table.flat().map(([k, v]) => `${k}=${v}`),
                    },
                );
                step += 1;
                state = "idle";
                continue;
            }

            const acquired = owner === null;
            if (acquired) {
                locks[stripe] = t;
                acquisitions += 1;
            }
            const row = table[bucket] ?? [];
            let outcome = "";
            if (op.op === "put") {
                const found = row.find(([k]) => k === op.key);
                if (found) {
                    found[1] = op.value ?? 0;
                } else {
                    row.push([op.key, op.value ?? 0]);
                }
                table[bucket] = row;
                state = "sorted";
                outcome = `stored ${op.key}=${op.value ?? 0}`;
            } else if (op.op === "get") {
                const found = row.find(([k]) => k === op.key);
                state = found ? "active" : "error";
                outcome = found ? `read ${op.key}=${found[1]}` : `key ${op.key} not found`;
            } else {
                const at = row.findIndex(([k]) => k === op.key);
                if (at >= 0) {
                    row.splice(at, 1);
                }
                table[bucket] = row;
                state = "swapped";
                outcome = at >= 0 ? `removed ${op.key}` : `key ${op.key} absent`;
            }
            lastMessage = `T${t} ${op.op} on key ${op.key} in bucket ${bucket} via L${stripe}: ${outcome}.`;
            yield frame(lastMessage, 3, {
                phase: "executed",
                thread: t,
                op: op.op,
                key: op.key,
                stripe,
                bucket,
                blocked: false,
                acquired,
                acquisitions,
                blocks,
                size: table.reduce((sum, r) => sum + r.length, 0),
                content: table.flat().map(([k, v]) => `${k}=${v}`),
            });
            step += 1;

            if (acquired) {
                locks[stripe] = null;
            }
            activeBucket = -1;
            activeStripe = -1;
            activeKey = -1;
            state = "idle";
            cursor[t] = index + 1;
        }
    }

    lastMessage = `Done: ${acquisitions} lock acquisitions, ${blocks} blocked attempts, ${table.reduce((sum, row) => sum + row.length, 0)} entries.`;
    yield frame(lastMessage, 4, {
        phase: "done",
        acquisitions,
        blocks,
        size: table.reduce((sum, row) => sum + row.length, 0),
        content: table.flat().map(([k, v]) => `${k}=${v}`).sort(),
    });

    return;
}

/** The striped-lock concurrent hash map module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "One lock around an entire hash table turns every operation into a queue. Lock striping splits the locks into a small array and assigns each bucket to one lock, so threads working on unrelated stripes never wait for each other. A request that finds its stripe held simply waits; the fixed schedule in this visualization makes those waits visible instead of leaving them to chance.",
        invariants: [
            "A bucket always maps to the same stripe, so a key's lock is deterministic.",
            "At most one thread owns a stripe lock at any moment.",
            "A blocked operation does not change the table and does not advance its thread.",
        ],
        correctness:
            "Every operation acquires exactly the lock of its bucket's stripe before reading or writing, and releases it afterward. Any two operations on the same bucket therefore use the same lock and cannot interleave their reads and writes, while operations on distinct buckets either use distinct locks or are serialized conservatively. Because each successful put or remove is applied while holding the correct lock, the resulting map is identical to applying all operations in their scheduled execution order.",
        complexityRationale:
            "Hashing and the stripe lookup are constant time, as are the map operations, so each op costs O(1) expected time plus a constant number of lock checks. The table holds O(n) entries and the lock array O(s) locks, giving O(n + s) space.",
        uses: [
            "Concurrent caches and in-memory session stores",
            "Shared symbol tables in language runtimes and compilers",
            "High-throughput key-value servers that need coarse but cheap synchronization",
        ],
        references: [
            "Herlihy and Shavit, The Art of Multiprocessor Programming, Chapter 7",
            "Java java.util.concurrent.ConcurrentHashMap striped-locking design notes",
            "Cormen, Leiserson, Rivest and Stein, Introduction to Algorithms, Chapter 11",
        ],
        workedExample:
            "With four buckets and two stripes, keys 1 and 3 may hash to stripe 0 while key 2 hashes to stripe 1. If thread T0 is writing key 1 and thread T1 wants key 3, T1 blocks on stripe 0; if T1 instead wants key 2 it proceeds immediately on stripe 1, showing the parallelism that striping buys.",
    },
    id: "concurrent-hash-map",
    name: "Concurrent Hash Map (Lock Striping)",
    category: "data-structures",
    complexity: { time: "O(1) expected", space: "O(n + s)" },
    defaultInput: {
        buckets: 4,
        stripes: 2,
        threads: [
            {
                ops: [
                    { op: "put", key: 1, value: 10 },
                    { op: "get", key: 1 },
                    { op: "put", key: 3, value: 30 },
                ],
            },
            {
                ops: [
                    { op: "put", key: 2, value: 20 },
                    { op: "get", key: 2 },
                ],
            },
        ],
    },
    visualType: "grid",
    run,
    pseudocode: [
        "hash the key to a bucket and map the bucket to a stripe",
        "if the stripe lock is held by another thread, wait",
        "otherwise acquire the stripe lock",
        "perform put, get or remove on the bucket chain",
        "release the stripe lock after the operation completes",
        "advance the thread to its next operation",
        "done: report the final table and lock statistics",
    ],
};

export default module;
