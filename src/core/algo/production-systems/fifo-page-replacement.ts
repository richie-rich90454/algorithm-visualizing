/**
 * fifo-page-replacement.ts - FIFO Page Replacement
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * A fixed number of memory frames are managed as a queue. On a page fault the
 * page that has been resident the longest is removed, even if it is being used
 * heavily. FIFO is simple and fair but suffers from Belady's anomaly: more
 * frames can sometimes cause more faults.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(m) for a reference string of length m
 *   Space: O(capacity) for the resident frames
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Top row: the reference string; the current access is highlighted.
 *   - Bottom row: the memory frames; the evicted page turns red on a fault.
 *   - Metadata records hits, faults, evictions, and the resident set.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface CacheInput {
    capacity?: number;
    accesses?: number[];
}

/** Build the reference-string and frame cells for one frame. */
function makeCells(
    accesses: number[],
    frames: number[],
    capacity: number,
    current: number,
    evicted: number | null,
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
        const state: EntityState =
            page === undefined ? "idle" : page === evicted ? "error" : page === accesses[current] ? "active" : "visited";
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
            metadata: { row: 1, col: slot, page: page ?? -1 },
        });
    }
    return entities;
}

/** The FIFO page replacement generator. */
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
        entities: makeCells(accesses, frames, capacity, -1, null),
        edges: [],
        description: `Starting with ${capacity} empty memory frame(s) and ${accesses.length} page access(es).`,
        codeLineNumber: 0,
        layout: "grid",
        meta: { rows: 2, cols, capacity, hits, faults, evictions, frames: [], faultLog: [] },
    };
    let step = 1;

    for (let i = 0; i < accesses.length; i += 1) {
        const page = accesses[i] ?? 0;
        let evicted: number | null = null;
        const hit = frames.includes(page);
        if (hit) {
            hits += 1;
            faultLog.push(0);
        } else {
            faults += 1;
            faultLog.push(1);
            if (frames.length >= capacity) {
                evicted = frames.shift() ?? null;
                evictions += 1;
            }
            frames.push(page);
        }
        yield {
            stepNumber: step,
            entities: makeCells(accesses, frames, capacity, i, evicted),
            edges: [],
            description: hit
                ? `Access ${page}: hit, page is already resident.`
                : `Access ${page}: fault${evicted === null ? ", free frame used" : `, evicted oldest page ${evicted}`}.`,
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

/** The FIFO page replacement module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "Treat the memory frames as a line that keeps pages in the order they arrived. A page already in memory is a hit. On a fault, remove the page at the front because it has waited the longest, then put the new page at the back.",
        invariants: [
            "Frames hold at most capacity pages at every step.",
            "The oldest resident page always sits at the front of the queue.",
            "A hit never changes the contents or order of the frames.",
        ],
        correctness:
            "The queue stores pages in arrival order. Because a page is appended only when it is loaded and removed only from the front, the front element on a full-cache fault is exactly the page that has been resident the longest. Evicting it implements the first-in-first-out rule exactly, so faults and hits match the definition of FIFO replacement.",
        complexityRationale:
            "Each access checks membership and may shift and push a queue of length capacity, both O(capacity), so the total is O(m * capacity) for m accesses. The resident queue uses O(capacity) space; the displayed cells are only for the viewer.",
        uses: [
            "A simple baseline in operating-system paging simulations",
            "Teaching page-fault behavior and Belady's anomaly",
            "Comparing replacement policies in cache research",
        ],
        references: [
            "Silberschatz, Galvin, and Gagne, Operating System Concepts, Chapter 9",
            "Belady, A Study of Replacement Algorithms for a Virtual-Storage Computer, 1966",
        ],
        workedExample:
            "With three frames and accesses 1, 2, 3, 4, 1: the first three are faults that fill the frames. Access 4 faults and evicts 1, leaving [2, 3, 4]. Access 1 faults again and evicts 2, leaving [3, 4, 1]. Five accesses produce five faults.",
    },
    id: "fifo-page-replacement",
    name: "FIFO Page Replacement",
    category: "production-systems",
    complexity: { time: "O(m * capacity)", space: "O(capacity)" },
    defaultInput: {
        capacity: 3,
        accesses: [1, 2, 3, 4, 1, 2, 5, 1, 2, 3, 4, 5],
    },
    visualType: "grid",
    run,
    pseudocode: [
        "initialize an empty queue of frames with the given capacity",
        "for each page in the reference string",
        "if the page is already in the queue it is a hit",
        "record the hit and leave the queue unchanged",
        "otherwise record a fault and, if the queue is full,",
        "remove the page at the front as the victim",
        "append the requested page to the back of the queue",
        "done: report total hits, faults, and evictions",
    ],
};

export default module;
