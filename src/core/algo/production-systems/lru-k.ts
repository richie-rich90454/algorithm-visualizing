/**
 * lru-k.ts - LRU-K Page Replacement
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * LRU-K extends least-recently-used by basing eviction on the time of the k-th
 * most recent access rather than the last access. A page seen fewer than k
 * times is considered cold and is evicted before well-used pages. With k = 1
 * the policy is ordinary LRU; larger k resists one-time scans.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(m * capacity * k) for m accesses
 *   Space: O(capacity * k) for the access histories
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Top row: the reference string with the current access highlighted.
 *   - Bottom row: resident pages labeled with their k-th access time.
 *   - A cold page (fewer than k accesses) is marked as the eviction victim first.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface CacheInput {
    capacity?: number;
    accesses?: number[];
    k?: number;
}

function kthTime(history: number[] | undefined, k: number): number {
    if (history === undefined || history.length < k) {
        return Number.NEGATIVE_INFINITY;
    }
    return history[history.length - k] ?? Number.NEGATIVE_INFINITY;
}

/** Build the reference and frame cells for one step. */
function makeCells(
    accesses: number[],
    resident: number[],
    capacity: number,
    k: number,
    history: Map<number, number[]>,
    current: number,
    victim: number | null,
): VisualEntity[] {
    const entities: VisualEntity[] = accesses.map((page, index) => {
        const state: EntityState =
            index === current ? "comparing" : index < current ? "visited" : "unvisited";
        return {
            id: `ref-${index}`,
            type: "cell" as const,
            label: String(page),
            value: page,
            state,
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: { row: 0, col: index, page },
        };
    });
    for (let slot = 0; slot < capacity; slot += 1) {
        const page = resident[slot];
        const kt = kthTime(history.get(page ?? -1), k);
        const state: EntityState =
            page === undefined
                ? "idle"
                : page === victim
                    ? "error"
                    : page === accesses[current]
                        ? "active"
                        : "visited";
        entities.push({
            id: `frame-${slot}`,
            type: "cell" as const,
            label: page === undefined ? "-" : `${page}:${Number.isFinite(kt) ? kt : "cold"}`,
            value: page ?? -1,
            state,
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: {
                row: 1,
                col: slot,
                page: page ?? -1,
                kth: Number.isFinite(kt) ? kt : -1,
            },
        });
    }
    return entities;
}

/** The LRU-K generator. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as CacheInput | null) ?? {};
    const capacity = typeof task.capacity === "number" ? Math.max(1, Math.floor(task.capacity)) : 3;
    const k = typeof task.k === "number" ? Math.max(1, Math.floor(task.k)) : 2;
    const accesses = Array.isArray(task.accesses)
        ? [...task.accesses]
        : [1, 2, 3, 1, 2, 4, 1, 2, 5, 1, 2, 3];
    const cols = Math.max(accesses.length, capacity);
    const resident: number[] = [];
    const history = new Map<number, number[]>();
    const faultLog: number[] = [];
    let hits = 0;
    let faults = 0;
    let evictions = 0;

    yield {
        stepNumber: 0,
        entities: makeCells(accesses, resident, capacity, k, history, -1, null),
        edges: [],
        description: `Starting LRU-${k} with ${capacity} frame(s) over ${accesses.length} accesses.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: { rows: 2, cols, capacity, k, hits, faults, evictions, frames: [], faultLog: [] },
    };
    let step = 1;

    for (let t = 0; t < accesses.length; t += 1) {
        const page = accesses[t] ?? 0;
        let victim: number | null = null;
        const hit = resident.includes(page);
        if (hit) {
            hits += 1;
            faultLog.push(0);
        } else {
            faults += 1;
            faultLog.push(1);
            if (resident.length >= capacity) {
                let worst = Number.POSITIVE_INFINITY;
                let worstRecent = Number.POSITIVE_INFINITY;
                for (const candidate of resident) {
                    const hist = history.get(candidate) ?? [];
                    const kt = kthTime(hist, k);
                    const recent = hist.length > 0 ? (hist[hist.length - 1] ?? 0) : -1;
                    if (kt < worst || (kt === worst && recent < worstRecent)) {
                        worst = kt;
                        worstRecent = recent;
                        victim = candidate;
                    }
                }
                if (victim !== null) {
                    const at = resident.indexOf(victim);
                    if (at >= 0) {
                        resident.splice(at, 1);
                    }
                    history.delete(victim);
                    evictions += 1;
                }
            }
            resident.push(page);
        }
        const times = history.get(page) ?? [];
        times.push(t);
        history.set(page, times.slice(-k));

        yield {
            stepNumber: step,
            entities: makeCells(accesses, resident, capacity, k, history, t, victim),
            edges: [],
            description: hit
                ? `Access ${page} at time ${t}: hit, ${times.length} recorded use(s).`
                : `Access ${page} at time ${t}: fault${victim === null ? ", free frame used" : `, evicted cold or oldest page ${victim}`}.`,
            codeLineNumber: hit ? 2 : 5,
            layout: "grid",
            meta: {
                rows: 2,
                cols,
                capacity,
                k,
                hits,
                faults,
                evictions,
                frames: [...resident],
                faultLog: [...faultLog],
            },
        };
        step += 1;
    }
}

/** The LRU-K module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "A single access might be a fluke, so LRU-K waits for a page to be used k times before treating it as important. When it must evict, it compares the time of each page's k-th most recent use. Pages that never reached k uses look oldest and go first.",
        invariants: [
            "The resident set never exceeds capacity.",
            "Each history stores at most the k most recent access times of a page.",
            "For k = 1 the victim is the least recently used page.",
        ],
        correctness:
            "The eviction key is the time of the k-th most recent reference, with minus infinity for pages that have not reached k uses. Choosing the smallest key by definition removes the page whose k-th last use is oldest, which is the LRU-K rule. Because k = 1 makes that key the last access time, LRU-K degenerates to LRU, and the stored histories are sufficient to compute every victim choice exactly.",
        complexityRationale:
            "For each of the m accesses the victim scan examines capacity pages and reads at most k history entries, giving O(m * capacity * k) time. Keeping k timestamps for up to capacity pages uses O(capacity * k) space.",
        uses: [
            "Database buffer pools that must resist one-time table scans",
            "File system caches with mixed sequential and random workloads",
            "A generalization studied in the original LRU-K paper",
        ],
        references: [
            "O'Neil, O'Neil, and Weikum, The LRU-K Page Replacement Algorithm, 1993",
            "Silberschatz, Galvin, and Gagne, Operating System Concepts, Chapter 9",
        ],
        workedExample:
            "With capacity two, k = 2, and accesses 1, 2, 1, 3: page 2 has only one use while page 1 has two. On the fault for 3, page 2 is cold, so it is evicted and the frames become [1, 3], with page 1 retained because it reached the second use.",
    },
    id: "lru-k",
    name: "LRU-K Page Replacement",
    category: "production-systems",
    complexity: { time: "O(m * capacity * k)", space: "O(capacity * k)" },
    defaultInput: {
        capacity: 3,
        k: 2,
        accesses: [1, 2, 3, 1, 2, 4, 1, 2, 5, 1, 2, 3],
    },
    visualType: "grid",
    run,
    pseudocode: [
        "initialize empty frames and an access-history log per page",
        "for each access at time t",
        "if the page is resident, record a hit and append t to its history",
        "otherwise record a fault",
        "if frames are full, find the resident page with the oldest k-th use",
        "pages with fewer than k uses are treated as oldest",
        "evict that page and clear its history",
        "load the requested page and append t to its history",
        "done: report hits, faults, and evictions",
    ],
};

export default module;
