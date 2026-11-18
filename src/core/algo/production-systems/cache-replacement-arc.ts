/**
 * cache-replacement-arc.ts - Adaptive Replacement Cache (ARC)
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * ARC keeps two cache lists: T1 holds recently seen pages and T2 holds pages
 * seen more than once. Two ghost lists, B1 and B2, remember recently evicted
 * pages from each list, and an adaptive target p biases how much of the cache
 * is reserved for T1. A ghost hit shifts p toward the list that is earning
 * hits, so the cache self-tunes between recency and frequency.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(c) per access for list scans, c being the capacity
 *   Space: O(c) for the two cache lists and two ghost lists
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - One cell per distinct key shows its current region.
 *   - T2 pages are green, T1 pages are yellow, ghost pages are blue gray, and
 *     absent pages are idle.
 *   - Metadata records all four lists, the adaptive target, and hit counts.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface ArcInput {
    references?: string[];
    capacity?: number;
}

interface ArcState {
    t1: string[];
    t2: string[];
    b1: string[];
    b2: string[];
    p: number;
}

function removeKey(list: string[], key: string): void {
    const index = list.indexOf(key);
    if (index >= 0) {
        list.splice(index, 1);
    }
}

function pushFront(list: string[], key: string): void {
    list.unshift(key);
}

/** Process one reference, updating the four lists and the adaptive target. */
function accessArc(state: ArcState, capacity: number, key: string): { hit: boolean; region: string } {
    if (state.t1.includes(key)) {
        removeKey(state.t1, key);
        pushFront(state.t2, key);
        return { hit: true, region: "T1 hit, promoted to T2" };
    }
    if (state.t2.includes(key)) {
        removeKey(state.t2, key);
        pushFront(state.t2, key);
        return { hit: true, region: "T2 hit" };
    }

    if (state.b1.includes(key)) {
        removeKey(state.b1, key);
        const ratio = Math.max(1, Math.round(state.b1.length / Math.max(1, state.b2.length)));
        state.p = Math.min(capacity, state.p + ratio);
        pushFront(state.t2, key);
    } else if (state.b2.includes(key)) {
        removeKey(state.b2, key);
        const ratio = Math.max(1, Math.round(state.b2.length / Math.max(1, state.b1.length)));
        state.p = Math.max(0, state.p - ratio);
        pushFront(state.t2, key);
    } else {
        if (state.t1.length + state.b1.length >= capacity) {
            if (state.t1.length < capacity) {
                state.b1.pop();
            } else {
                pushFront(state.b1, state.t1.pop()!);
            }
        } else if (state.t1.length + state.t2.length + state.b1.length + state.b2.length >= capacity) {
            if (state.t1.length + state.t2.length >= capacity) {
                if (state.t1.length > 0) {
                    pushFront(state.b1, state.t1.pop()!);
                } else {
                    pushFront(state.b2, state.t2.pop()!);
                }
            }
            if (state.b2.length > 0) {
                state.b2.pop();
            }
        }
        pushFront(state.t1, key);
    }

    while (state.t1.length + state.t2.length > capacity) {
        if (state.t1.length > state.p) {
            pushFront(state.b1, state.t1.pop()!);
        } else {
            pushFront(state.b2, state.t2.pop()!);
        }
    }
    while (state.b1.length > capacity) {
        state.b1.pop();
    }
    while (state.b2.length > capacity) {
        state.b2.pop();
    }
    return { hit: false, region: "miss" };
}

/** Build one cell per key, colored by its current region. */
function makeCells(keys: string[], state: ArcState): VisualEntity[] {
    return keys.map((key, index) => {
        let state_: EntityState = "idle";
        let region = "absent";
        if (state.t2.includes(key)) {
            state_ = "sorted";
            region = "T2";
        } else if (state.t1.includes(key)) {
            state_ = "comparing";
            region = "T1";
        } else if (state.b1.includes(key)) {
            state_ = "visited";
            region = "B1";
        } else if (state.b2.includes(key)) {
            state_ = "visited";
            region = "B2";
        }
        return {
            id: `cell-${index}`,
            type: "cell" as const,
            label: key,
            value: key,
            state: state_,
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: { row: 0, col: index, key, region },
        };
    });
}

/** The ARC generator. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as ArcInput | null) ?? {};
    const references: string[] = Array.isArray(task.references)
        ? task.references.map((key) => String(key))
        : ["A", "B", "C", "A", "D", "B", "E", "C", "A", "B", "C", "D"];
    const capacity = Math.max(1, Math.floor(task.capacity ?? 3));
    const keys = [...new Set(references)];
    const state: ArcState = { t1: [], t2: [], b1: [], b2: [], p: 0 };
    let hits = 0;
    let misses = 0;

    yield {
        stepNumber: 0,
        entities: makeCells(keys, state),
        edges: [],
        description: `ARC cache of capacity ${capacity} over ${keys.length} distinct key(s).`,
        codeLineNumber: 0,
        layout: "grid",
        meta: { rows: 1, cols: keys.length, t1: [], t2: [], b1: [], b2: [], p: 0, hits: 0, misses: 0, region: "start" },
    };
    let step = 1;

    for (let i = 0; i < references.length; i += 1) {
        const key = references[i]!;
        const result = accessArc(state, capacity, key);
        if (result.hit) {
            hits += 1;
        } else {
            misses += 1;
        }
        yield {
            stepNumber: step,
            entities: makeCells(keys, state),
            edges: [],
            description: `Access ${i} to ${key}: ${result.region}; T1=[${state.t1.join(",")}], T2=[${state.t2.join(",")}], p=${state.p}.`,
            codeLineNumber: 1,
            layout: "grid",
            meta: {
                rows: 1,
                cols: keys.length,
                t1: [...state.t1],
                t2: [...state.t2],
                b1: [...state.b1],
                b2: [...state.b2],
                p: state.p,
                hits,
                misses,
                region: result.region,
            },
        };
        step += 1;
    }

    yield {
        stepNumber: step,
        entities: makeCells(keys, state),
        edges: [],
        description: `Final: ${hits} hit(s), ${misses} miss(es), target p=${state.p}.`,
        codeLineNumber: 6,
        layout: "grid",
        meta: { rows: 1, cols: keys.length, t1: [...state.t1], t2: [...state.t2], b1: [...state.b1], b2: [...state.b2], p: state.p, hits, misses, region: "done", done: true },
    };
}

/** The Adaptive Replacement Cache module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "A cache cannot keep everything, so it must guess what will be reused. LRU keeps only recent pages; LFU keeps only frequent pages. ARC keeps both kinds at once and uses ghost lists of recently evicted pages to see which strategy is paying off, shifting its target p toward the list that is producing more hits.",
        invariants: [
            "The number of cached pages in T1 and T2 never exceeds the capacity.",
            "The four lists T1, T2, B1, and B2 are pairwise disjoint.",
            "A page reached twice ends in T2, while a page seen once stays in T1.",
            "A hit in B1 raises the target p and a hit in B2 lowers it.",
        ],
        correctness:
            "Each access follows the ARC rules exactly: a T1 hit promotes to T2, a T2 hit refreshes recency, ghost hits reinsert into T2 and adapt p, and a true miss inserts into T1 after making room. The final rebalance evicts from T1 when it exceeds the target and from T2 otherwise, while ghost lists are capped at the capacity. These steps preserve the disjointness and capacity invariants and implement the self-tuning recency versus frequency policy described by Megiddo and Modha.",
        complexityRationale:
            "Each access scans at most the two cache lists and two ghost lists to locate a key and rebalance, all bounded by the capacity c, so the time per access is O(c). The four bounded lists use O(c) space.",
        uses: [
            "Adaptive page and buffer caching in storage systems",
            "Database buffer pools that face mixed workloads",
            "Content delivery caches balancing recent and popular items",
        ],
        references: [
            "Megiddo and Modha, ARC: A Self-Tuning, Low Overhead Replacement Cache, 2003",
            "O'Neil et al., The LRU-K Page Replacement Algorithm, 1993",
        ],
        workedExample:
            "With capacity three, repeated scans of the same small working set first fill T1 and evict pages into B1. When those pages are requested again they hit in B1, move to T2, and push the target p upward, so the cache gradually reserves more room for the frequently reused pages and the hit rate rises.",
    },
    id: "cache-replacement-arc",
    name: "Cache Replacement ARC",
    category: "production-systems",
    complexity: { time: "O(c)", space: "O(c)" },
    defaultInput: {
        references: ["A", "B", "C", "A", "D", "B", "E", "C", "A", "B", "C", "D"],
        capacity: 3,
    },
    visualType: "grid",
    run,
    pseudocode: [
        "start with empty T1, T2, ghost lists B1 and B2, and target p zero",
        "for each referenced key",
        "if it is in T1 promote it to T2, else if it is in T2 refresh it",
        "if it is in a ghost list, adapt p and move it to T2",
        "on a true miss make room and insert the key at the front of T1",
        "evict from T1 or T2 until the cache fits the capacity",
        "cap the ghost lists and record the hit or miss",
        "done: report the four lists, the target, and the hit counts",
    ],
};

export default module;
