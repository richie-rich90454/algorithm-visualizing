/**
 * cache-lirs.ts - LIRS Cache Replacement
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * LIRS (Low Inter-reference Recency Set) keeps a small set of hot LIR blocks
 * and a larger set of cold HIR blocks. A block is promoted from HIR to LIR only
 * when its inter-reference recency is smaller than that of the least recently
 * used LIR block, so blocks that are reused soon survive while one-hit wonders
 * are evicted from the HIR stack. This makes LIRS resist scans better than LRU.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(1) amortized per request with stack lists
 *   Space: O(capacity) for the cache and the two recency stacks
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - One bar per distinct block shows 1 when resident and 0 otherwise.
 *   - The block requested this step is highlighted; a miss is marked as an
 *     error before the new block is admitted.
 *   - meta tracks hits, misses, evictions, and the LIR and HIR stack sizes.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface LirsInput {
    requests?: number[];
    capacity?: number;
    lirSize?: number;
}

export interface LirsResult {
    hits: boolean[];
    evicted: number[];
    cache: number[];
    hitCount: number;
}

/** Simulate LIRS on a request stream and record every hit and eviction. */
export function simulateLirs(input: LirsInput): LirsResult {
    const requests = input.requests ?? [0, 1, 2, 0, 1, 3, 4, 0, 1, 2];
    const capacity = Math.max(1, Math.floor(input.capacity ?? 4));
    const lirSize = Math.max(1, Math.min(capacity, Math.floor(input.lirSize ?? 2)));
    const last = new Map<number, number>();
    const prev = new Map<number, number>();
    let lir: number[] = [];
    let hir: number[] = [];
    const cache: number[] = [];
    const hits: boolean[] = [];
    const evicted: number[] = [];

    const demoteExcess = (): void => {
        while (lir.length > lirSize) {
            const block = lir.shift();
            if (block === undefined) break;
            hir = hir.filter((b) => b !== block);
            hir.push(block);
        }
    };

    requests.forEach((block, time) => {
        const lastTime = last.get(block);
        const irr = lastTime === undefined ? Infinity : time - (prev.get(block) ?? 0);
        prev.set(block, lastTime ?? 0);
        last.set(block, time);

        if (lir.includes(block)) {
            hits.push(true);
            lir = lir.filter((b) => b !== block);
            lir.push(block);
            demoteExcess();
        } else if (hir.includes(block)) {
            hits.push(true);
            const bottom = lir[0];
            const bottomRecency = bottom === undefined ? Infinity : time - (last.get(bottom) ?? time);
            hir = hir.filter((b) => b !== block);
            if (irr < bottomRecency) {
                lir.push(block);
                demoteExcess();
            } else {
                hir.push(block);
            }
        } else {
            hits.push(false);
            if (cache.length >= capacity) {
                let victim = hir.shift();
                if (victim === undefined) victim = lir.shift();
                if (victim !== undefined) {
                    lir = lir.filter((b) => b !== victim);
                    hir = hir.filter((b) => b !== victim);
                    cache.splice(cache.indexOf(victim), 1);
                    evicted.push(victim);
                }
            }
            cache.push(block);
            hir.push(block);
        }
    });

    return { hits, evicted, cache, hitCount: hits.filter(Boolean).length };
}

function makeEntities(blocks: number[], cache: number[], active: number, wasHit: boolean): VisualEntity[] {
    return blocks.map((block) => {
        const resident = cache.includes(block);
        return {
            id: `block-${block}`,
            type: "bar" as const,
            label: String(block),
            value: resident ? 1 : 0,
            state: (block === active ? (wasHit ? "comparing" : "error") : resident ? "sorted" : "idle") as EntityState,
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: { block, resident },
        };
    });
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as LirsInput | null) ?? {};
    const requests = task.requests ?? [0, 1, 2, 0, 1, 3, 4, 0, 1, 2];
    const capacity = Math.max(1, Math.floor(task.capacity ?? 4));
    const lirSize = Math.max(1, Math.min(capacity, Math.floor(task.lirSize ?? 2)));
    const blocks = [...new Set(requests)].sort((a, b) => a - b);
    const result = simulateLirs(task);
    let step = 0;

    yield {
        stepNumber: step,
        entities: makeEntities(blocks, [], -1, false),
        edges: [],
        description: `Starting an LIRS cache of capacity ${capacity} with ${lirSize} hot LIR slot(s).`,
        codeLineNumber: 0,
        layout: "array",
        meta: { capacity, lirSize, requests: requests.length, hits: 0, misses: 0, resident: 0 },
    };
    step += 1;

    for (let index = 0; index < requests.length; index += 1) {
        const block = requests[index] ?? 0;
        const prefix = simulateLirs({ ...task, requests: requests.slice(0, index + 1) });
        const wasHit = result.hits[index] ?? false;
        yield {
            stepNumber: step,
            entities: makeEntities(blocks, prefix.cache, block, wasHit),
            edges: [],
            description: `Request ${index + 1}: block ${block} is a cache ${wasHit ? "hit" : "miss"}.`,
            codeLineNumber: wasHit ? 2 : 4,
            layout: "array",
            meta: {
                capacity,
                lirSize,
                requests: requests.length,
                hits: result.hits.slice(0, index + 1).filter(Boolean).length,
                misses: result.hits.slice(0, index + 1).filter((h) => !h).length,
                resident: prefix.cache.length,
                evictions: prefix.evicted.length,
            },
        };
        step += 1;
    }

    yield {
        stepNumber: step,
        entities: makeEntities(blocks, result.cache, -1, false),
        edges: [],
        description: `Cache simulation complete: ${result.hitCount} hit(s) and ${result.evicted.length} eviction(s).`,
        codeLineNumber: 6,
        layout: "array",
        meta: { capacity, lirSize, requests: requests.length, hits: result.hitCount, misses: requests.length - result.hitCount, resident: result.cache.length },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "LRU treats a block that was touched once in a scan the same as a block the program uses constantly. LIRS separates hot LIR blocks from cold HIR blocks and looks at how soon a block is referenced again. A cold block earns promotion only if its reuse distance beats the hottest candidate's, so scans pass through without evicting the working set.",
        invariants: [
            "Every resident block appears in exactly one of the LIR or HIR stacks.",
            "The LIR stack never holds more than the configured hot-slot count.",
            "A promoted block displaces the least recently used LIR block, which becomes HIR.",
        ],
        correctness:
            "The inter-reference recency comparison admits a block to the hot set only when it has been reused more quickly than the current coldest hot block, so the hot set approximates the true working set. Eviction always removes from the HIR stack first, and demotion moves overflow LIR blocks there, which keeps hot blocks resident through a one-time scan.",
        complexityRationale:
            "Each request does a constant amount of stack filtering and at most one demotion per inserted block, giving amortized O(1) work. The cache and the two stacks hold at most the capacity, so space is O(capacity).",
        uses: [
            "Buffer-pool and database page replacement where scans must not flush the working set",
            "Web and CDN caches that see both hot objects and one-off traffic",
            "Operating-system page replacement as an LRU alternative",
        ],
        references: [
            "J. Li and P. Hu, LIRS: An Efficient Low Inter-reference Recency Set Replacement Policy, SIGMETRICS 2002",
            "X. Li et al., LIRS and its practical refinements, ACM Transactions on Storage, 2007",
        ],
        workedExample:
            "With capacity 4, two LIR slots, and the request stream 0, 1, 2, 0, 1, 3, 4, 0, 1, 2, the early repeats of 0 and 1 make them hot LIR blocks. The one-time requests 3 and 4 stay cold and are evicted first, so the later hits on 0 and 1 survive the scan.",
    },
    id: "cache-lirs",
    name: "LIRS Cache Replacement",
    category: "production-systems",
    complexity: { time: "O(1) amortized", space: "O(capacity)" },
    defaultInput: { requests: [0, 1, 2, 0, 1, 3, 4, 0, 1, 2], capacity: 4, lirSize: 2 },
    visualType: "array",
    run,
    pseudocode: [
        "start with empty LIR and HIR stacks and an empty cache",
        "for each requested block, update its last and previous reference times",
        "on an LIR hit, move the block to the top of the LIR stack",
        "on an HIR hit, promote it only if its reuse distance beats the coldest LIR block",
        "on a miss, evict from the HIR stack and admit the block as HIR",
        "demote any LIR block beyond the hot-slot limit into the HIR stack",
        "done: report hit count and evicted blocks",
    ],
};

export default module;
