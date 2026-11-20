/**
 * read-through-cache.ts - Read-Through Cache with LRU Eviction
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * A read-through cache sits in front of a backing store and loads a value on
 * the first miss. Hits are served from the cache and refresh the least
 * recently used order; misses fetch from the store, occupy a cache line, and
 * evict the least recently used line when the cache is full. Writes go to the
 * store and refresh an existing cached line, but a line that is not cached is
 * not allocated, which keeps write-only keys from polluting the cache.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(1) amortized per access with a hash map plus an LRU order list
 *   Space: O(c + s) for c cache lines and s store keys
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - The upper row shows cache lines from least to most recently used.
 *   - The lower row shows the backing store keys.
 *   - A hit is green, a miss amber, an evicted line red in meta.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface CacheRequest {
    op?: string;
    key?: string | number;
    value?: number;
}

interface CacheInput {
    capacity?: number;
    initial?: Record<string, number>;
    requests?: CacheRequest[];
}

/** Render the cache line row and the store row as grid cells. */
function makeCells(
    order: Array<string | number>,
    cache: Map<string | number, number>,
    storeKeys: Array<string | number>,
    store: Map<string | number, number>,
    focus: string | number | null,
    focusState: EntityState,
): VisualEntity[] {
    const entities: VisualEntity[] = [];
    order.forEach((key, col) => {
        entities.push({
            id: `cache-${String(key)}`,
            type: "cell" as const,
            label: `${String(key)}:${cache.get(key) ?? 0}`,
            value: cache.get(key) ?? 0,
            state: (key === focus ? focusState : "sorted") as EntityState,
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: { row: 0, col, kind: "cache", position: col },
        });
    });
    storeKeys.forEach((key, col) => {
        entities.push({
            id: `store-${String(key)}`,
            type: "cell" as const,
            label: `${String(key)}:${store.get(key) ?? 0}`,
            value: store.get(key) ?? 0,
            state: (key === focus ? focusState : "idle") as EntityState,
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: { row: 1, col, kind: "store" },
        });
    });
    return entities;
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as CacheInput | null) ?? {};
    const capacity = Math.max(1, Math.floor(Number(task.capacity ?? 3)) || 3);
    const initial = task.initial && typeof task.initial === "object" ? task.initial : { a: 1, b: 2, c: 3, d: 4, e: 5 };
    const store = new Map<string | number, number>();
    for (const [key, value] of Object.entries(initial)) store.set(key, Number(value) || 0);
    const requests: CacheRequest[] = Array.isArray(task.requests)
        ? task.requests
        : [
            { op: "read", key: "a" },
            { op: "read", key: "b" },
            { op: "read", key: "c" },
            { op: "read", key: "a" },
            { op: "read", key: "d" },
            { op: "write", key: "b", value: 20 },
            { op: "read", key: "b" },
            { op: "read", key: "e" },
        ];

    const cache = new Map<string | number, number>();
    const order: Array<string | number> = [];
    const storeKeys = [...store.keys()];
    const values: Array<number | null> = [];
    const verdicts: string[] = [];
    let hits = 0;
    let misses = 0;
    let loads = 0;
    let evictions = 0;
    let step = 0;
    const emit = (description: string, codeLine: number, focus: string | number | null, focusState: EntityState) => ({
        stepNumber: step++,
        entities: makeCells(order, cache, storeKeys, store, focus, focusState),
        edges: [],
        description,
        codeLineNumber: codeLine,
        layout: "grid" as const,
        meta: {
            capacity,
            hits,
            misses,
            loads,
            evictions,
            order: order.map(String),
            cache: [...cache.entries()].map(([key, value]) => [String(key), value]),
            store: storeKeys.map((key) => [String(key), store.get(key) ?? 0]),
            values: values.slice(),
            verdicts: verdicts.slice(),
        },
    });

    yield emit(`Read-through cache with capacity ${capacity} in front of ${storeKeys.length} store key(s).`, 0, null, "idle");

    for (let i = 0; i < requests.length; i += 1) {
        const request = requests[i] ?? {};
        const key = request.key ?? "";
        const isWrite = request.op === "write";
        if (!store.has(key)) store.set(key, 0);
        if (!storeKeys.includes(key)) storeKeys.push(key);

        if (isWrite) {
            const value = Number(request.value) || 0;
            store.set(key, value);
            if (cache.has(key)) {
                cache.set(key, value);
                verdicts.push("write-hit");
                values.push(null);
                yield emit(`Write to "${String(key)}" updated the store and the cached line to ${value}.`, 6, key, "active");
            } else {
                verdicts.push("write-around");
                values.push(null);
                yield emit(`Write to "${String(key)}" updated the store to ${value} without allocating a line.`, 8, key, "active");
            }
            continue;
        }

        if (cache.has(key)) {
            const value = cache.get(key)!;
            hits += 1;
            values.push(value);
            verdicts.push("hit");
            const at = order.indexOf(key);
            if (at >= 0) order.splice(at, 1);
            order.push(key);
            yield emit(`Read "${String(key)}" hit the cache with value ${value}; moved to most recent.`, 2, key, "sorted");
        } else {
            misses += 1;
            loads += 1;
            const value = store.get(key) ?? 0;
            values.push(value);
            verdicts.push("miss");
            if (order.length >= capacity) {
                const victim = order.shift()!;
                cache.delete(victim);
                evictions += 1;
                yield emit(`Read "${String(key)}" missed; evicting least recently used line "${String(victim)}".`, 4, victim, "error");
            }
            cache.set(key, value);
            order.push(key);
            yield emit(`Read "${String(key)}" missed; loaded ${value} from the store into the cache.`, 4, key, "comparing");
        }
    }

    yield emit(
        `Finished with ${hits} hit(s), ${misses} miss(es), ${loads} load(s) and ${evictions} eviction(s).`,
        8,
        null,
        "idle",
    );
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Put a small fast cache in front of a larger slow store. On a read miss, fetch the value from the store and remember it; on a hit, return it immediately. Because the cache is smaller than the working set, a full cache must choose a victim. Least recently used evicts the line that has gone the longest without a hit, which works well when recent access predicts near-future access.",
        invariants: [
            "A cached value always equals the backing store value for that key.",
            "The order list runs from least to most recently used cache line.",
            "A read miss performs exactly one store load before returning.",
        ],
        correctness:
            "On a hit the cached value was installed by a prior load or write of the same key, both of which copied the store value, so returning it is correct. On a miss the module reads the store first and only then installs the line, so the returned value is current. Writing updates the store and any cached copy together, preserving equality. Eviction removes only the least recently used key and never changes the store, so no data is lost and the cache never holds more than capacity lines.",
        complexityRationale:
            "A hash map gives constant-time value lookup and a small order array supports move-to-end and front removal in time proportional to capacity, which is a constant for a fixed cache. Each access is therefore amortized O(1) and the two maps use O(c + s) space.",
        uses: [
            "Web object caches in front of a database",
            "CPU and operating system page caches using LRU-like policies",
            "Content delivery networks caching hot artifacts near users",
        ],
        references: [
            "Hennessy and Patterson, Computer Architecture: A Quantitative Approach, Chapter 5",
            "Silberschatz, Galvin, and Gagne, Operating System Concepts, chapter on cache and page replacement",
        ],
        workedExample:
            "With capacity three and store a=1, b=2, c=3, d=4, reads of a, b and c fill the cache with order a,b,c. Reading a again is a hit and moves a to the end, giving b,c,a. Reading d misses and evicts b, the least recently used, leaving c,a,d. A later write to b updates only the store because b is no longer cached, so a subsequent read of b would be a miss that loads the new value.",
    },
    id: "read-through-cache",
    name: "Read-Through Cache",
    category: "production-systems",
    complexity: { time: "O(1) amortized", space: "O(c + s)" },
    defaultInput: {
        capacity: 3,
        initial: { a: 1, b: 2, c: 3, d: 4, e: 5 },
        requests: [
            { op: "read", key: "a" },
            { op: "read", key: "b" },
            { op: "read", key: "c" },
            { op: "read", key: "a" },
            { op: "read", key: "d" },
            { op: "write", key: "b", value: 20 },
            { op: "read", key: "b" },
            { op: "read", key: "e" },
        ],
    },
    visualType: "grid",
    run,
    pseudocode: [
        "initialize the store and an empty cache with an LRU order list",
        "for each request identify the key and whether it is a write",
        "on a read hit return the cached value and mark the line most recent",
        "on a read miss load the value from the store",
        "if the cache is full evict the least recently used line",
        "insert the loaded value as the most recent line",
        "on a write update the store and any cached copy of the key",
        "record the verdict, value and eviction for this request",
        "done: report hits, misses, loads and evictions",
    ],
};

export default module;
