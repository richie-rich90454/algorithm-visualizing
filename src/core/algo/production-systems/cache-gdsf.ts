/**
 * cache-gdsf.ts - GDSF Cache Replacement
 *
 * GreedyDual-Size Frequency assigns each cached object a priority that grows
 * with its access frequency and cost and shrinks with its size. A global
 * inflation value carries the priority of the last evicted object forward so
 * that recently useful objects are not immediately discarded. On eviction the
 * object with the smallest priority leaves the cache.
 *
 * Time O(m * c) for m requests over a cache of c objects, space O(c).
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface GdsfInput {
    capacity?: number;
    requests?: Array<{ key: string; size: number; cost?: number }>;
}

interface Entry {
    size: number;
    freq: number;
    priority: number;
    order: number;
}

export interface GdsfStep {
    key: string;
    size: number;
    freq: number;
    priority: number;
    action: string;
    used: number;
}

/** Simulate GDSF over a request stream. */
export function gdsfTrace(
    capacity: number, requests: Array<{ key: string; size: number; cost?: number }>,
): { steps: GdsfStep[]; finalKeys: string[]; hits: number; misses: number; evictions: number; used: number } {
    const cache = new Map<string, Entry>();
    let used = 0;
    let inflation = 0;
    let order = 0;
    let hits = 0;
    let misses = 0;
    let evictions = 0;
    const steps = requests.map((req) => {
        const size = Math.max(1, Math.floor(req.size));
        const cost = req.cost ?? 1;
        let freq = 0;
        let priority = 0;
        let action: string;
        const hit = cache.get(req.key);
        if (hit) {
            hits += 1;
            inflation = hit.priority;
            hit.freq += 1;
            hit.priority = inflation + (cost * hit.freq) / size;
            freq = hit.freq;
            priority = hit.priority;
            action = "hit";
        } else {
            misses += 1;
            let evicted = false;
            while (used + size > capacity && cache.size > 0) {
                let victimKey = "";
                let victim: Entry | null = null;
                for (const [key, entry] of cache) {
                    if (!victim || entry.priority < victim.priority ||
                        (entry.priority === victim.priority && entry.order < victim.order)) {
                        victimKey = key;
                        victim = entry;
                    }
                }
                if (!victim) break;
                inflation = victim.priority;
                used -= victim.size;
                cache.delete(victimKey);
                evictions += 1;
                evicted = true;
            }
            if (size <= capacity) {
                cache.set(req.key, { size, freq: 1, priority: inflation + cost / size, order: order++ });
                used += size;
                freq = 1;
                priority = cache.get(req.key)!.priority;
                action = evicted ? "miss+evict" : "miss";
            } else {
                action = "skip";
            }
        }
        return { key: req.key, size, freq, priority, action, used };
    });
    return {
        steps,
        finalKeys: [...cache.keys()].sort(),
        hits,
        misses,
        evictions,
        used,
    };
}

const COLUMNS = ["key", "size", "freq", "priority", "action"];

function makeCells(steps: GdsfStep[], revealed: number, active: number): VisualEntity[] {
    const entities: VisualEntity[] = [];
    steps.forEach((step, row) => {
        const values = [step.key, step.size, step.freq, step.priority, step.action];
        COLUMNS.forEach((column, col) => {
            const shown = row <= revealed;
            const state: EntityState = row === active
                ? "comparing"
                : shown ? (step.action === "skip" ? "error" : step.action === "hit" ? "sorted" : "active") : "idle";
            const value = values[col] ?? 0;
            entities.push({
                id: `cell-${row}-${col}`,
                type: "cell",
                label: shown ? `${column} ${typeof value === "string" ? value : value.toFixed(2)}` : "?",
                value: shown ? value : 0,
                state,
                x: 0,
                y: 0,
                width: 0,
                height: 0,
                metadata: { row, col },
            });
        });
    });
    return entities;
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as GdsfInput | null) ?? {};
    const capacity = Math.max(1, Math.floor(Number(task.capacity ?? 10)) || 10);
    const requests: Array<{ key: string; size: number; cost?: number }> = Array.isArray(task.requests) && task.requests.length > 0
        ? task.requests
        : [
            { key: "a", size: 2 }, { key: "b", size: 3 }, { key: "a", size: 2 }, { key: "c", size: 4 },
            { key: "b", size: 3 }, { key: "d", size: 5 }, { key: "a", size: 2 }, { key: "c", size: 4 },
        ];
    const result = gdsfTrace(capacity, requests);
    const base = { rows: result.steps.length, cols: COLUMNS.length, capacity, hits: result.hits, misses: result.misses, evictions: result.evictions };

    let step = 0;
    yield {
        stepNumber: step,
        entities: makeCells(result.steps, -1, -1),
        edges: [],
        description: `GDSF cache of capacity ${capacity} processes ${result.steps.length} requests by smallest priority first.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: { ...base, actions: [], finalKeys: [], used: 0, usedHistory: [] },
    };
    step += 1;

    for (let i = 0; i < result.steps.length; i += 1) {
        const s = result.steps[i]!;
        yield {
            stepNumber: step,
            entities: makeCells(result.steps, i, i),
            edges: [],
            description: `Request ${s.key} (size ${s.size}): ${s.action}, priority ${s.priority.toFixed(2)}, cache used ${s.used}/${capacity}.`,
            codeLineNumber: s.action === "hit" ? 2 : s.action === "skip" ? 7 : 5,
            layout: "grid",
            meta: {
                ...base,
                actions: result.steps.slice(0, i + 1).map((x) => x.action),
                finalKeys: [],
                used: s.used,
                usedHistory: result.steps.slice(0, i + 1).map((x) => x.used),
                active: i,
            },
        };
        step += 1;
    }

    yield {
        stepNumber: step,
        entities: makeCells(result.steps, result.steps.length - 1, -1),
        edges: [],
        description: `Done: ${result.hits} hit(s), ${result.misses} miss(es), ${result.evictions} eviction(s); cached keys ${result.finalKeys.join(", ") || "none"}.`,
        codeLineNumber: 8,
        layout: "grid",
        meta: {
            ...base,
            actions: result.steps.map((x) => x.action),
            finalKeys: result.finalKeys,
            used: result.used,
            usedHistory: result.steps.map((x) => x.used),
            done: true,
        },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "A cache should keep objects that are small, expensive to fetch, and frequently requested. GDSF scores each object by cost times frequency divided by size, so small hot objects win. When something is evicted, its score is stored as a global inflation value and added to every new score, which keeps a recently popular region of the working set from being flushed all at once.",
        invariants: [
            "An object's priority is the inflation value plus cost times frequency divided by size.",
            "After every request the total size of cached objects never exceeds capacity.",
            "Ties in priority are broken by insertion order so the oldest object is evicted first.",
        ],
        correctness:
            "On a hit the entry's frequency rises and its priority is recomputed with the previous priority as inflation, so recently accessed objects gain protection. On a miss the cache evicts the minimum-priority entry, repeatedly if needed, and carries that entry's priority into the new insertion; this is the GreedyDual invariant that keeps key values monotone across evictions. Objects larger than capacity are rejected. The tests recompute the whole trace independently, verify the hit and eviction counts and final key set, and check that the used capacity never exceeds the limit.",
        complexityRationale:
            "Each request may scan the cache to find a victim, costing O(c) per eviction with at most O(m) evictions, so the trace is O(m times c); the cache itself uses O(c) space.",
        uses: [
            "Web proxy and content delivery network cache replacement",
            "Database buffer pool management",
            "Storage and file-system page caching",
        ],
        references: [
            "Cao and Irani, Cost-Aware WWW Proxy Caching Algorithms, USENIX Symposium on Internet Technologies, 1997",
            "Cherkasova and Ciardo, GDSF: A Cost Sensitive Cache Replacement Algorithm, 1998",
        ],
        workedExample:
            "With capacity 5 and requests a(2), b(3), a(2), c(4), the first two fill the cache. Re-accessing a raises its frequency and priority. When c arrives with size 4, the least-priority object is evicted to make room, and its priority becomes the inflation value used to score c.",
    },
    id: "cache-gdsf",
    name: "GDSF Cache Replacement",
    category: "production-systems",
    complexity: { time: "O(m * c)", space: "O(c)" },
    defaultInput: { capacity: 10 },
    visualType: "grid",
    run,
    pseudocode: [
        "start with an empty cache and a zero inflation value",
        "for each request with key size and cost",
        "if the key is cached, raise its frequency and refresh its priority using the old priority as inflation",
        "otherwise count a miss and find the lowest priority cached object",
        "evict that object, set inflation to its priority, and repeat until the new object fits",
        "insert the new object with frequency one and priority inflation plus cost over size",
        "skip any object larger than the whole cache",
        "record the action and current cache usage",
        "done: report hits misses evictions and cached keys",
    ],
};

export default module;
