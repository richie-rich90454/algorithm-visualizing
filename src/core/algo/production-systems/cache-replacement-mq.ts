/**
 * cache-replacement-mq.ts - MQ (Multi-Queue) Cache Replacement
 *
 * A multi-queue admission and replacement policy. Pages live in one of three
 * priority queues: high, middle, or low. A hit promotes a page one level, a
 * miss inserts a new page at low priority, and a page recently evicted from
 * high priority gets a second chance in the high queue. Eviction always takes
 * the least recently used page from the lowest nonempty queue. This reduces
 * cache pollution from one-time scans while keeping popular pages resident.
 *
 * Complexity:
 *   Time:  O(capacity) per access for a linear queue scan
 *   Space: O(capacity) for the queues and second-chance history
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

type Queue = "high" | "middle" | "low";

interface CacheState {
    queues: Record<Queue, string[]>;
    history: string[];
}

function inQueues(state: CacheState, key: string): Queue | null {
    for (const name of ["high", "middle", "low"] as Queue[]) {
        if (state.queues[name].includes(key)) {
            return name;
        }
    }
    return null;
}

function touch(state: CacheState, key: string, from: Queue, to: Queue): void {
    state.queues[from] = state.queues[from].filter((item) => item !== key);
    state.queues[to] = [key, ...state.queues[to]];
}

function totalSize(state: CacheState): number {
    return state.queues.high.length + state.queues.middle.length + state.queues.low.length;
}

function evictOne(state: CacheState): void {
    for (const name of ["low", "middle", "high"] as Queue[]) {
        const queue = state.queues[name];
        if (queue.length > 0) {
            const victim = queue.pop();
            if (victim !== undefined && name === "high") {
                state.history = [victim, ...state.history.filter((item) => item !== victim)].slice(0, 4);
            }
            return;
        }
    }
}

function access(state: CacheState, key: string, capacity: number, historyLimit: number): boolean {
    const location = inQueues(state, key);
    if (location === "high") {
        touch(state, key, "high", "high");
        return true;
    }
    if (location === "middle") {
        touch(state, key, "middle", "high");
        return true;
    }
    if (location === "low") {
        touch(state, key, "low", "middle");
        return true;
    }
    const remembered = state.history.includes(key);
    state.history = state.history.filter((item) => item !== key).slice(0, historyLimit);
    if (remembered) {
        state.queues.high = [key, ...state.queues.high];
    } else {
        state.queues.low = [key, ...state.queues.low];
    }
    while (totalSize(state) > capacity) {
        evictOne(state);
    }
    return false;
}

function makeCells(state: CacheState, capacity: number, current: string | null): VisualEntity[] {
    const entities: VisualEntity[] = [];
    const rows: Array<[Queue, number]> = [
        ["high", 0],
        ["middle", 1],
        ["low", 2],
    ];
    for (const [name, row] of rows) {
        const queue = state.queues[name];
        for (let col = 0; col < capacity; col += 1) {
            const key = queue[col];
            const stateName: EntityState = key === current ? "active" : key === undefined ? "idle" : "sorted";
            entities.push({
                id: `cell-${row}-${col}`,
                type: "cell",
                label: key ?? "-",
                value: key ?? "",
                state: stateName,
                x: 0,
                y: 0,
                width: 0,
                height: 0,
                metadata: { row, col, queue: name },
            });
        }
    }
    return entities;
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { trace?: string[]; capacity?: number; historyLimit?: number } | null) ?? {};
    const trace = Array.isArray(task.trace) ? task.trace.map(String) : ["a", "b", "a", "c", "b", "d", "a"];
    const capacity = Math.max(1, typeof task.capacity === "number" ? task.capacity : 3);
    const historyLimit = Math.max(0, typeof task.historyLimit === "number" ? task.historyLimit : 4);
    const state: CacheState = { queues: { high: [], middle: [], low: [] }, history: [] };
    let hits = 0;
    const base = { capacity, trace: trace.length };

    yield {
        stepNumber: 0,
        entities: makeCells(state, capacity, null),
        edges: [],
        description: "Three priority queues start empty; recent high-priority victims get a second chance.",
        codeLineNumber: 0,
        layout: "grid",
        meta: { ...base, phase: "init", hits, history: state.history },
    };
    for (let i = 0; i < trace.length; i += 1) {
        const key = trace[i] ?? "";
        const hit = access(state, key, capacity, historyLimit);
        if (hit) {
            hits += 1;
        }
        yield {
            stepNumber: i + 1,
            entities: makeCells(state, capacity, key),
            edges: [],
            description: `Access ${i}: ${key} is a ${hit ? "hit" : "miss"}; queues are high=[${state.queues.high}], middle=[${state.queues.middle}], low=[${state.queues.low}].`,
            codeLineNumber: hit ? 2 : 4,
            layout: "grid",
            meta: {
                ...base,
                phase: hit ? "hit" : "miss",
                hits,
                misses: i + 1 - hits,
                history: state.history,
                high: state.queues.high,
                middle: state.queues.middle,
                low: state.queues.low,
            },
        };
    }
    yield {
        stepNumber: trace.length + 1,
        entities: makeCells(state, capacity, null),
        edges: [],
        description: `${hits} hit(s) and ${trace.length - hits} miss(es); the cache holds ${totalSize(state)} of ${capacity} slots.`,
        codeLineNumber: 7,
        layout: "grid",
        meta: { ...base, phase: "done", hits, misses: trace.length - hits, high: state.queues.high, middle: state.queues.middle, low: state.queues.low },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "A single recency list lets a one-time scan push useful pages out of a cache. MQ splits the cache into high, middle, and low priority queues. A page that earns repeated hits climbs toward the high queue, while a new or rarely used page stays low and is the first to go. Pages evicted from high priority are remembered briefly so they can return without starting over.",
        invariants: [
            "Every cached page belongs to exactly one of the three queues.",
            "A hit promotes a page by one level, and a miss inserts it at low priority unless it is remembered.",
            "The total number of cached pages never exceeds the capacity.",
        ],
        correctness:
            "Each access either finds the page in one queue and moves it to the correct new queue, or inserts it at low or high priority according to the second-chance history. After every insertion the eviction loop removes least recently used pages from the lowest nonempty queue until the size is within capacity, so the size bound is maintained. Because the policy is a deterministic function of the trace, replaying the same trace yields the same hit and miss sequence and the same final cache contents.",
        complexityRationale:
            "Finding a key scans at most three queues of length at most the capacity, and eviction removes one page per step, so each access costs O(capacity) time. Storing the three queues and the bounded second-chance history uses O(capacity) space.",
        uses: [
            "Database buffer pools that must resist scan pollution",
            "File system page caches with mixed workloads",
            "Teaching admission control and priority-based replacement",
        ],
        references: [
            "Zhou, Chen, and Li, The Multi-Queue Replacement Algorithm for Second Level Buffer Caches, USENIX ATC 2001",
            "O'Neil, O'Neil, and Weikum, The LRU-K Page Replacement Algorithm, SIGMOD 1993",
        ],
        workedExample:
            "With capacity three, accessing a, b, a, c fills the queues and promotes a to high on its second access. A scan of d and e inserts each at low priority, so the next eviction removes a low-priority scan page rather than the popular a.",
    },
    id: "cache-replacement-mq",
    name: "MQ Cache Replacement",
    category: "production-systems",
    complexity: { time: "O(capacity)", space: "O(capacity)" },
    defaultInput: { trace: ["a", "b", "a", "c", "b", "d", "a"], capacity: 3, historyLimit: 4 },
    visualType: "grid",
    run,
    pseudocode: [
        "start with empty high, middle, and low queues",
        "on a hit in high keep the page at the front of high",
        "on a hit in middle promote the page to high",
        "on a hit in low promote the page to middle",
        "on a miss insert at low, or at high if recently evicted from high",
        "while over capacity evict a page from the lowest nonempty queue",
        "record high-priority victims in the second-chance history",
        "done: report hit count and final queue contents",
    ],
};

export default module;
