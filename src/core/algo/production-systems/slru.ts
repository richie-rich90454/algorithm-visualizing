/**
 * slru.ts - Segmented Least Recently Used Cache
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * SLRU splits the cache into a small protected segment and a larger
 * probationary segment. New pages enter probationary; a second use promotes a
 * page to protected, where it is less likely to be evicted. When protected is
 * full its least recently used page is demoted back to probationary. This is
 * the admission policy used by systems such as the adaptive replacement cache.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(m * capacity) for m accesses
 *   Space: O(capacity) for the two resident segments
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Row 0: protected segment, ordered from least to most recently used.
 *   - Row 1: probationary segment, same ordering.
 *   - Row 2: the reference string with the current access highlighted.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface CacheInput {
    capacity?: number;
    accesses?: number[];
    protectedFraction?: number;
}

/** Build the three rows of cells for one step. */
function makeCells(
    accesses: number[],
    protectedSeg: number[],
    probationarySeg: number[],
    protCap: number,
    probCap: number,
    cols: number,
    current: number,
    hot: number | null,
): VisualEntity[] {
    const entities: VisualEntity[] = [];
    const rows: Array<{ label: string; values: number[]; cap: number; row: number }> = [
        { label: "p", values: protectedSeg, cap: protCap, row: 0 },
        { label: "t", values: probationarySeg, cap: probCap, row: 1 },
    ];
    for (const segment of rows) {
        for (let slot = 0; slot < segment.cap; slot += 1) {
            const page = segment.values[slot];
            const state: EntityState =
                page === undefined ? "idle" : page === hot ? "active" : "visited";
            entities.push({
                id: `${segment.label}-${slot}`,
                type: "cell" as const,
                label: page === undefined ? "-" : String(page),
                value: page ?? -1,
                state,
                x: 0,
                y: 0,
                width: 0,
                height: 0,
                metadata: { row: segment.row, col: slot, page: page ?? -1, segment: segment.label },
            });
        }
    }
    for (let index = 0; index < accesses.length; index += 1) {
        const page = accesses[index] ?? 0;
        const state: EntityState =
            index === current ? "comparing" : index < current ? "visited" : "unvisited";
        entities.push({
            id: `ref-${index}`,
            type: "cell" as const,
            label: String(page),
            value: page,
            state,
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: { row: 2, col: index, page },
        });
    }
    void cols;
    return entities;
}

/** The SLRU generator. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as CacheInput | null) ?? {};
    const capacity = typeof task.capacity === "number" ? Math.max(1, Math.floor(task.capacity)) : 4;
    const fraction = typeof task.protectedFraction === "number" ? task.protectedFraction : 0.4;
    const protCap = capacity >= 2 ? Math.max(1, Math.floor(capacity * fraction)) : 0;
    const probCap = capacity - protCap;
    const accesses = Array.isArray(task.accesses)
        ? [...task.accesses]
        : [1, 2, 1, 3, 1, 4, 5, 1, 2, 1, 6, 3];
    const cols = Math.max(accesses.length, protCap, probCap);
    const protectedSeg: number[] = [];
    const probationarySeg: number[] = [];
    const faultLog: number[] = [];
    let hits = 0;
    let faults = 0;
    let promotions = 0;
    let demotions = 0;
    let evictions = 0;

    yield {
        stepNumber: 0,
        entities: makeCells(accesses, protectedSeg, probationarySeg, protCap, probCap, cols, -1, null),
        edges: [],
        description: `Starting SLRU with ${capacity} frame(s): protected ${protCap}, probationary ${probCap}.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: {
            rows: 3,
            cols,
            capacity,
            protCap,
            probCap,
            hits,
            faults,
            promotions,
            demotions,
            evictions,
            protected: [],
            probationary: [],
            faultLog: [],
        },
    };
    let step = 1;

    for (let i = 0; i < accesses.length; i += 1) {
        const page = accesses[i] ?? 0;
        let hot: number | null = page;
        const inProt = protectedSeg.indexOf(page);
        const inProb = probationarySeg.indexOf(page);
        if (inProt >= 0) {
            hits += 1;
            faultLog.push(0);
            protectedSeg.splice(inProt, 1);
            protectedSeg.push(page);
        } else if (inProb >= 0) {
            hits += 1;
            faultLog.push(0);
            probationarySeg.splice(inProb, 1);
            protectedSeg.push(page);
            promotions += 1;
        } else {
            faults += 1;
            faultLog.push(1);
            probationarySeg.push(page);
        }
        while (protectedSeg.length > protCap) {
            const demoted = protectedSeg.shift();
            if (demoted === undefined) {
                break;
            }
            probationarySeg.push(demoted);
            demotions += 1;
        }
        while (probationarySeg.length > probCap) {
            probationarySeg.shift();
            evictions += 1;
        }
        if (inProt < 0 && inProb < 0) {
            hot = null;
        }
        yield {
            stepNumber: step,
            entities: makeCells(accesses, protectedSeg, probationarySeg, protCap, probCap, cols, i, hot),
            edges: [],
            description: faultLog[i] === 0
                ? `Access ${page}: hit${inProb >= 0 ? " promotes to protected" : " in protected"}.`
                : `Access ${page}: fault, admitted to probationary${evictions > 0 ? " after an eviction" : ""}.`,
            codeLineNumber: faultLog[i] === 0 ? (inProb >= 0 ? 4 : 2) : 6,
            layout: "grid",
            meta: {
                rows: 3,
                cols,
                capacity,
                protCap,
                probCap,
                hits,
                faults,
                promotions,
                demotions,
                evictions,
                protected: [...protectedSeg],
                probationary: [...probationarySeg],
                faultLog: [...faultLog],
            },
        };
        step += 1;
    }
}

/** The SLRU module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "Give frequently used pages a safe home. Newcomers start in a probationary area where they can be evicted quickly. If a newcomer is used again, promote it to a protected area that is only evicted after probationary is scanned. This filters out one-hit wonders without punishing genuinely hot pages.",
        invariants: [
            "Protected holds at most protCap pages and probationary at most probCap.",
            "Total resident pages never exceed the cache capacity.",
            "Within each segment, the leftmost page is the least recently used.",
        ],
        correctness:
            "Every access updates exactly one segment in place. Promotion removes a page from probationary and appends it to protected, and the demotion loop moves any overflow from protected back to probationary before the eviction loop trims probationary. Because the two capacity loops run after each access, both segment bounds always hold and eviction always removes the least recently used page of probationary, which is the SLRU rule.",
        complexityRationale:
            "Each access performs index searches and array splices on segments of size at most capacity, and the two rebalance loops are bounded by capacity, giving O(capacity) per access and O(m * capacity) total. Only the two resident segments are stored, so space is O(capacity).",
        uses: [
            "Adaptive replacement cache algorithms in storage systems",
            "Web proxy and content delivery caches",
            "Two-level buffer pools that separate scan resistance from recency",
        ],
        references: [
            "Megiddo and Modha, ARC: A Self-Tuning Low Overhead Replacement Cache, 2003",
            "Silberschatz, Galvin, and Gagne, Operating System Concepts, Chapter 9",
        ],
        workedExample:
            "With capacity four and 40 percent protected, protCap is one and probCap three. Accessing 1, 2, 1 puts 1 and 2 in probationary, then the second 1 promotes 1 to protected. A later access to a new page can evict 2 from probationary while 1 stays safe in protected.",
    },
    id: "slru",
    name: "Segmented LRU Cache",
    category: "production-systems",
    complexity: { time: "O(m * capacity)", space: "O(capacity)" },
    defaultInput: {
        capacity: 4,
        protectedFraction: 0.4,
        accesses: [1, 2, 1, 3, 1, 4, 5, 1, 2, 1, 6, 3],
    },
    visualType: "grid",
    run,
    pseudocode: [
        "split capacity into protected and probationary segment sizes",
        "for each page in the reference string",
        "if found in protected, move it to the protected most-recent end",
        "if found in probationary, promote it to protected",
        "if not resident, insert it at the probationary most-recent end",
        "while protected is too large, demote its least-recent page",
        "while probationary is too large, evict its least-recent page",
        "done: report hits, faults, promotions, and evictions",
    ],
};

export default module;
