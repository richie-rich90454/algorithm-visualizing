/**
 * cache-2q.ts - 2Q Cache Replacement
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * 2Q is a cache admission policy that protects the cache from one-time items.
 * It keeps a short recent queue A1in, a ghost queue A1out of recently evicted
 * one-time items, and a main queue Am of frequently used items. A first access
 * enters A1in; a second hit on an item in A1in or A1out promotes it to Am.
 * Because an item must be seen twice before it occupies the main cache, scan
 * traffic cannot flush the popular working set.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(n * c) for n accesses and capacity c (linear scans of the queues)
 *   Space: O(c) for the three bounded queues
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - One grid cell per access shows the item and its hit or miss verdict.
 *   - A hit is GREEN, a miss RED, the current access CYAN.
 *   - meta carries the verdict log, hit count, and the final Am contents.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface TwoQInput {
    accesses?: number[];
    kin?: number;
    km?: number;
}

interface CacheState {
    a1in: number[];
    a1out: number[];
    am: number[];
}

function makeCells(accesses: number[], verdicts: number[], current: number): VisualEntity[] {
    return accesses.map((item, index) => {
        let state: EntityState = "idle";
        if (index === current) {
            state = "active";
        } else if (verdicts[index] === 1) {
            state = "sorted";
        } else if (verdicts[index] === 0) {
            state = "error";
        }
        return {
            id: `cell-${index}`,
            type: "cell" as const,
            label: `${item}${verdicts[index] === 1 ? " hit" : verdicts[index] === 0 ? " miss" : ""}`,
            value: item,
            state,
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: { row: 0, col: index, item, verdict: verdicts[index] ?? -1 },
        };
    });
}

/** Apply one access to a 2Q cache; queues use front as most recently used. */
function access(state: CacheState, item: number, kin: number, km: number): number {
    const amIndex = state.am.indexOf(item);
    if (amIndex >= 0) {
        state.am.splice(amIndex, 1);
        state.am.unshift(item);
        return 1;
    }
    const inIndex = state.a1in.indexOf(item);
    if (inIndex >= 0) {
        state.a1in.splice(inIndex, 1);
        state.am.unshift(item);
        if (state.am.length > km) {
            state.am.pop();
        }
        return 1;
    }
    const outIndex = state.a1out.indexOf(item);
    if (outIndex >= 0) {
        state.a1out.splice(outIndex, 1);
        state.am.unshift(item);
        if (state.am.length > km) {
            state.am.pop();
        }
        return 1;
    }
    state.a1in.unshift(item);
    if (state.a1in.length > kin) {
        const evicted = state.a1in.pop();
        if (evicted !== undefined) {
            state.a1out.unshift(evicted);
            if (state.a1out.length > kin) {
                state.a1out.pop();
            }
        }
    }
    return 0;
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as TwoQInput | null) ?? {};
    const accesses = Array.isArray(task.accesses) && task.accesses.length > 0
        ? task.accesses.map((value) => Math.floor(Number(value) || 0))
        : [1, 2, 3, 1, 4, 2, 5, 1, 3, 2];
    const kin = Math.max(1, Math.floor(Number(task.kin) || 2));
    const km = Math.max(1, Math.floor(Number(task.km) || 3));
    const state: CacheState = { a1in: [], a1out: [], am: [] };
    const verdicts: number[] = [];
    let hits = 0;

    yield {
        stepNumber: 0,
        entities: makeCells(accesses, verdicts, -1),
        edges: [],
        description: `2Q cache with A1in ${kin}, A1out ${kin}, and Am ${km} entries, replaying ${accesses.length} access(es).`,
        codeLineNumber: 0,
        layout: "grid",
        meta: {
            rows: 1,
            cols: accesses.length,
            kin,
            km,
            hits,
            misses: 0,
            verdicts,
            am: state.am,
            a1in: state.a1in,
            a1out: state.a1out,
        },
    };
    let step = 1;

    for (let i = 0; i < accesses.length; i += 1) {
        const item = accesses[i] ?? 0;
        const verdict = access(state, item, kin, km);
        verdicts.push(verdict);
        hits += verdict;
        yield {
            stepNumber: step,
            entities: makeCells(accesses, verdicts, i),
            edges: [],
            description: `Access ${i}: item ${item} was a ${verdict ? "hit" : "miss"}; Am is [${state.am.join(", ")}].`,
            codeLineNumber: verdict ? 1 : 4,
            layout: "grid",
            meta: {
                rows: 1,
                cols: accesses.length,
                kin,
                km,
                hits,
                misses: i + 1 - hits,
                verdicts: [...verdicts],
                am: [...state.am],
                a1in: [...state.a1in],
                a1out: [...state.a1out],
            },
        };
        step += 1;
    }

    yield {
        stepNumber: step,
        entities: makeCells(accesses, verdicts, -1),
        edges: [],
        description: `Finished with ${hits} hit(s) and ${accesses.length - hits} miss(es); Am holds [${state.am.join(", ")}].`,
        codeLineNumber: 7,
        layout: "grid",
        meta: {
            rows: 1,
            cols: accesses.length,
            kin,
            km,
            hits,
            misses: accesses.length - hits,
            verdicts,
            am: state.am,
            a1in: state.a1in,
            a1out: state.a1out,
            hitRate: hits / accesses.length,
            done: true,
        },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "A plain least-recently-used cache can be ruined by a scan that touches every file once. 2Q adds a probation area: an item must appear twice before it earns a place in the main cache. The ghost list remembers recently seen one-time items so a genuine second access promotes them immediately, while one-hit wonders are forgotten without displacing popular data.",
        invariants: [
            "Am and A1in never hold more than their configured capacities.",
            "A1out is a ghost list of keys, not cached data.",
            "An item is promoted to Am only after it is seen a second time within the recent or ghost queues.",
        ],
        correctness:
            "Each case of the access routine (Am hit, A1in promotion, A1out promotion, or miss) handles exactly one location for an item, and the three queues are disjoint, so the verdict is unambiguous. Every unshift is paired with a capacity check and a pop from the least recently used end, keeping queues bounded. The companion test implements the same policy independently and compares the entire verdict sequence over many random access traces, and it checks that a first access is always a miss while a quick repeat is always a hit.",
        complexityRationale:
            "Each access scans and splices queues of length at most c, so n accesses take O(n * c). The three bounded queues occupy O(c) space regardless of the trace length.",
        uses: [
            "File-system and database buffer caches resistant to scans",
            "Web object caches facing one-time requests",
            "A practical replacement policy between LRU and two-level LRU",
        ],
        references: [
            "Johnson and Shasha, 2Q: A Low Overhead High Performance Buffer Management Replacement Algorithm, 1994",
            "Silberschatz, Galvin, and Gagne, Operating System Concepts, Memory Management chapter",
        ],
        workedExample:
            "With A1in size 2 and Am size 2, accessing 1, 2, 3 fills A1in and evicts 1 into A1out. Accessing 1 again finds it in the ghost list and promotes it to Am, so the second occurrence is a hit even though 1 was not in the real cache.",
    },
    id: "cache-2q",
    name: "2Q Cache Replacement",
    category: "production-systems",
    complexity: { time: "O(n * c)", space: "O(c)" },
    defaultInput: {
        accesses: [1, 2, 3, 1, 4, 2, 5, 1, 3, 2],
        kin: 2,
        km: 3,
    },
    visualType: "grid",
    run,
    pseudocode: [
        "keep a recent queue A1in, a ghost queue A1out, and a frequent queue Am",
        "on an access found in Am, move it to the front of Am",
        "on an access found in A1in, promote it to the front of Am",
        "on an access found in A1out, move it to the front of Am and forget the ghost",
        "on an access found nowhere, insert it at the front of A1in",
        "evict the least recently used entry when A1in or Am is full",
        "move evicted A1in entries to A1out and trim A1out to its limit",
        "done: report the hit or miss verdict for every access",
    ],
};

export default module;
