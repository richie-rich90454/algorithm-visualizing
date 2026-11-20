/**
 * optimal-page-replacement.ts - Optimal (Belady MIN) Page Replacement
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Given the whole reference string in advance, the optimal policy evicts the
 * page whose next access is farthest in the future, or a page that is never
 * used again. No online policy can have fewer faults, so MIN is the benchmark
 * against which every practical replacement policy is measured.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(m * capacity) for a reference string of length m
 *   Space: O(capacity) for the resident frames
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Top row: the reference string with the current access highlighted.
 *   - Bottom row: memory frames; the chosen victim is shown with its next use.
 *   - Metadata records faults and the frame contents after each access.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface CacheInput {
    capacity?: number;
    accesses?: number[];
}

/** Index of the next use of a page at or after position start, or Infinity. */
function nextUse(accesses: number[], page: number, start: number): number {
    for (let j = start; j < accesses.length; j += 1) {
        if (accesses[j] === page) {
            return j;
        }
    }
    return Number.POSITIVE_INFINITY;
}

/** Build the reference and frame cells for one step. */
function makeCells(
    accesses: number[],
    frames: number[],
    capacity: number,
    current: number,
    victim: number | null,
    nextOfVictim: number,
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
        const page = frames[slot];
        let state: EntityState = "idle";
        if (page !== undefined) {
            state = page === victim ? "error" : "visited";
        }
        const extra: Record<string, number | string | boolean> = {
            row: 1,
            col: slot,
            page: page ?? -1,
        };
        if (page === victim) {
            extra["nextUse"] = Number.isFinite(nextOfVictim) ? nextOfVictim : -1;
        }
        entities.push({
            id: `frame-${slot}`,
            type: "cell" as const,
            label: page === undefined ? "-" : String(page),
            value: page ?? -1,
            state,
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: extra,
        });
    }
    return entities;
}

/** The optimal page replacement generator. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as CacheInput | null) ?? {};
    const capacity = typeof task.capacity === "number" ? Math.max(1, Math.floor(task.capacity)) : 3;
    const accesses = Array.isArray(task.accesses)
        ? [...task.accesses]
        : [1, 2, 3, 4, 1, 2, 5, 1, 2, 3, 4, 5];
    const cols = Math.max(accesses.length, capacity);
    const frames: number[] = [];
    const faultLog: number[] = [];
    let hits = 0;
    let faults = 0;
    let evictions = 0;

    yield {
        stepNumber: 0,
        entities: makeCells(accesses, frames, capacity, -1, null, -1),
        edges: [],
        description: `Starting MIN replacement with ${capacity} frame(s) and ${accesses.length} future accesses known.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: { rows: 2, cols, capacity, hits, faults, evictions, frames: [], faultLog: [] },
    };
    let step = 1;

    for (let i = 0; i < accesses.length; i += 1) {
        const page = accesses[i] ?? 0;
        let victim: number | null = null;
        let victimNext = -1;
        const hit = frames.includes(page);
        if (hit) {
            hits += 1;
            faultLog.push(0);
        } else {
            faults += 1;
            faultLog.push(1);
            if (frames.length >= capacity) {
                let farthest = -1;
                for (const resident of frames) {
                    const nu = nextUse(accesses, resident, i + 1);
                    if (nu > farthest) {
                        farthest = nu;
                        victim = resident;
                        victimNext = Number.isFinite(nu) ? nu : -1;
                    }
                }
                if (victim !== null) {
                    const at = frames.indexOf(victim);
                    if (at >= 0) {
                        frames.splice(at, 1);
                    }
                    evictions += 1;
                }
            }
            frames.push(page);
        }
        const suffix = victim === null
            ? ""
            : victimNext === -1
                ? " (never used again)"
                : ` (next use at ${victimNext})`;
        yield {
            stepNumber: step,
            entities: makeCells(accesses, frames, capacity, i, victim, victimNext),
            edges: [],
            description: hit
                ? `Access ${page}: hit, page is already resident.`
                : `Access ${page}: fault, evicted ${victim}${suffix}.`,
            codeLineNumber: hit ? 2 : 4,
            layout: "grid",
            meta: {
                rows: 2,
                cols,
                capacity,
                hits,
                faults,
                evictions,
                frames: [...frames],
                faultLog: [...faultLog],
            },
        };
        step += 1;
    }
}

/** The optimal page replacement module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "If you know the entire sequence of requests ahead of time, you can make the best possible eviction choice. When memory is full, throw out the page that will not be needed for the longest time. A page that is never requested again is the perfect victim.",
        invariants: [
            "Frames hold at most capacity pages at every step.",
            "A hit leaves the resident set unchanged.",
            "The victim has the farthest next use among all resident pages.",
        ],
        correctness:
            "Consider the first point where MIN differs from any other policy. MIN removes the page used farthest in the future. Swapping that choice to the other policy's victim cannot increase faults before that victim's next use, and the other page is still present when needed. Repeating this exchange argument shows no policy can fault fewer times than MIN, so the rule is optimal.",
        complexityRationale:
            "On each fault the algorithm scans the remaining reference string once for every resident page, giving O(m * capacity) time for m accesses. Only the resident frames and the future reference string are stored, so space is O(m + capacity).",
        uses: [
            "An offline lower bound for evaluating online cache policies",
            "Compiler analysis of loop locality and cache behavior",
            "Teaching optimal scheduling and exchange arguments",
        ],
        references: [
            "Silberschatz, Galvin, and Gagne, Operating System Concepts, Chapter 9",
            "Belady, A Study of Replacement Algorithms for a Virtual-Storage Computer, 1966",
        ],
        workedExample:
            "With two frames and accesses 1, 2, 1, 3: after loading 1 and 2, access 1 hits. Access 3 faults with both pages resident; page 2 is never used again while page 1 is used later, so MIN evicts 2, leaving [1, 3] and two faults total.",
    },
    id: "optimal-page-replacement",
    name: "Optimal Page Replacement (MIN)",
    category: "production-systems",
    complexity: { time: "O(m * capacity)", space: "O(m + capacity)" },
    defaultInput: {
        capacity: 3,
        accesses: [1, 2, 3, 4, 1, 2, 5, 1, 2, 3, 4, 5],
    },
    visualType: "grid",
    run,
    pseudocode: [
        "initialize an empty set of resident frames",
        "for each page in the reference string",
        "if the page is resident, record a hit",
        "otherwise record a fault",
        "if the frames are full, find each resident page's next use",
        "evict the page whose next use is farthest away",
        "insert the requested page into the frames",
        "done: report the minimum number of faults",
    ],
};

export default module;
