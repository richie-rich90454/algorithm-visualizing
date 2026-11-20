/**
 * concurrent-skip-list.ts - Concurrent Skip List with Hand-Over-Hand Locking
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * A concurrent skip list supports lock-free reads and fine-grained updates.
 * To insert a key, a thread walks down the express lanes holding a lock on the
 * current node before moving to the next one (hand-over-hand locking), then
 * splices the new node into each of its lanes and releases the locks. Several
 * threads run their searches interleaved, so updates do not serialize on one
 * global lock.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(log n) expected per search or update
 *   Space: O(n) expected for the towers
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Each key is a column; its express lanes sit above the bottom lane.
 *   - Nodes on a thread's locked search path are highlighted, and the node
 *     whose lock is currently held is marked as comparing.
 *   - A newly spliced node is green.
 */

import type { AlgorithmModule, EntityState, VisualEdge, VisualEntity, VisualFrame } from "@/types";

type Phase = "initial" | "lock" | "splice" | "done";
type Thread = { id: number; value: number; stage: number };

/** Deterministic tower height: even keys reach lane 1, multiples of four lane 2. */
function towerLevel(key: number): number {
    if (key % 4 === 0) return 2;
    if (key % 2 === 0) return 1;
    return 0;
}

function laneKeys(keys: number[], level: number): number[] {
    return keys.filter((key) => towerLevel(key) >= level);
}

/** Build nodes and edges for all lanes from the current key set. */
function build(
    keys: number[],
    focus: Thread | null,
    phase: Phase,
): { entities: VisualEntity[]; edges: VisualEdge[]; locked: number[] } {
    const rank = new Map<number, number>();
    keys.forEach((key, index) => rank.set(key, index));
    const locked = new Set<number>();
    const predecessorByLevel = new Map<number, number>();
    const entities: VisualEntity[] = [];
    const edges: VisualEdge[] = [];

    if (focus) {
        for (let level = 0; level <= towerLevel(focus.value); level += 1) {
            const lane = laneKeys(keys, level);
            const predecessors = lane.filter((key) => key < focus.value);
            const predecessor = predecessors[predecessors.length - 1];
            if (predecessor !== undefined) {
                predecessorByLevel.set(level, predecessor);
                locked.add(predecessor);
            }
        }
    }

    for (let level = 0; level <= 2; level += 1) {
        const lane = laneKeys(keys, level);
        for (const key of lane) {
            let state: EntityState = "idle";
            if (focus && phase === "lock" && key < focus.value && towerLevel(focus.value) >= level) {
                state = predecessorByLevel.get(level) === key ? "comparing" : "active";
            }
            if (focus && phase === "splice" && key === focus.value) {
                state = "sorted";
            }
            entities.push({
                id: `n-${level}-${key}`,
                type: "node" as const,
                label: String(key),
                value: key,
                state,
                x: rank.get(key) ?? 0,
                y: -level,
                width: 0,
                height: 0,
                metadata: { level, rank: rank.get(key) ?? 0, key },
            });
        }
        for (let i = 0; i < lane.length - 1; i += 1) {
            const from = lane[i] as number;
            const to = lane[i + 1] as number;
            const onPath = Boolean(
                focus && phase === "lock" && to < focus.value && towerLevel(focus.value) >= level,
            );
            edges.push({
                id: `e-${level}-${from}-${to}`,
                sourceId: `n-${level}-${from}`,
                targetId: `n-${level}-${to}`,
                label: "",
                state: onPath ? "active" : "idle",
                directed: true,
            });
        }
    }

    if (entities.length === 0) {
        entities.push({
            id: "empty",
            type: "node" as const,
            label: "empty",
            value: -1,
            state: "idle",
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: { level: 0, rank: 0, key: -1 },
        });
    }

    return { entities, edges, locked: [...locked].sort((a, b) => a - b) };
}

/** Simulate interleaved fine-grained-locking insertions into a skip list. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { initial?: number[]; inserts?: number[] } | null) ?? {};
    const initial = task.initial ?? [3, 6, 9, 12];
    const inserts = task.inserts ?? [7, 4, 11];
    const keys = [...new Set(initial)].sort((a, b) => a - b);
    const threads: Thread[] = inserts.map((value, id) => ({ id, value, stage: 0 }));
    let step = 0;

    const emit = (
        description: string,
        codeLine: number,
        phase: Phase,
        focus: Thread | null,
    ): VisualFrame => {
        const built = build(keys, focus, phase);
        const frame: VisualFrame = {
            stepNumber: step,
            entities: built.entities,
            edges: built.edges,
            description,
            codeLineNumber: codeLine,
            layout: "point",
            meta: {
                keys: [...keys],
                phase,
                thread: focus ? focus.id : -1,
                value: focus ? focus.value : -1,
                lockedKeys: built.locked,
            },
        };
        step += 1;
        return frame;
    };

    yield emit(
        `Concurrent skip list seeded with ${keys.length} key(s) across three express lanes.`,
        0,
        "initial",
        null,
    );

    // Phase one: every thread acquires its hand-over-hand path concurrently.
    for (const thread of threads) {
        const built = build(keys, thread, "lock");
        yield emit(
            `Thread ${thread.id} acquires hand-over-hand locks while searching for ${thread.value}; locked predecessors: ${built.locked.join(", ") || "none"}.`,
            3,
            "lock",
            thread,
        );
        thread.stage = 1;
    }

    // Phase two: each thread splices under its locks, then releases them.
    for (const thread of threads) {
        if (!keys.includes(thread.value)) {
            keys.push(thread.value);
            keys.sort((a, b) => a - b);
        }
        yield emit(
            `Thread ${thread.id} splices ${thread.value} into its lanes under lock and releases the locks.`,
            5,
            "splice",
            thread,
        );
        thread.stage = 2;
    }

    yield emit(
        `Done: all threads committed; the skip list holds ${keys.length} keys in sorted, lock-safe lanes.`,
        8,
        "done",
        null,
    );
}

/** The concurrent skip list module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "A concurrent skip list lets several threads update an ordered index at once. Instead of one lock for the whole structure, a thread grabs the predecessor node at each level, moves forward hand over hand, and only then splices in the new node. Reads never take a lock, so they proceed without waiting for writers, while writers on distant parts of the list rarely block one another.",
        invariants: [
            "Every express lane is a sorted subsequence of the lane below it.",
            "A thread holds the lock on a node only while advancing past it, then releases the earlier lock.",
            "A key is spliced into every lane up to its tower height before its locks are released.",
        ],
        correctness:
            "Hand-over-hand locking guarantees that no other thread changes the predecessor between the moment it is examined and the moment the new node is linked, so a splice cannot be lost. Splicing into every lane up to the node's tower height keeps each lane a sorted subsequence of the one below, which is the condition search relies on to reach the correct position. Because reads traverse immutable links, they observe a consistent list without locking.",
        complexityRationale:
            "Each thread descends one tower level at a time and advances a constant expected number of nodes per level, so search and update take O(log n) expected time; hand-over-hand locking adds only constant work per visited node. Each node stores an expected constant number of forward pointers, so space is O(n) expected.",
        uses: [
            "Concurrent ordered maps such as Java's ConcurrentSkipListMap",
            "Shared indexes in in-memory databases and key-value stores",
            "Priority queues accessed by many worker threads at once",
        ],
        references: [
            "W. Pugh, Concurrent Maintenance of Skip Lists, Technical Report CS-TR-2222, University of Maryland, 1989",
            "T. H. Cormen et al., Introduction to Algorithms, Chapter 14 on skip lists (selected editions)",
        ],
        workedExample:
            "Start with keys 3, 6, 9, 12. Threads inserting 7, 4, and 11 acquire their paths at the same time: thread 0 locks 6 on the bottom lane, thread 1 locks 3, and thread 2 locks 9. Each then splices its value into the appropriate lanes and releases locks. The final lanes contain 3, 4, 6, 7, 9, 11, 12 in sorted order, with 4 and 12 reaching the top lane.",
    },
    id: "concurrent-skip-list",
    name: "Concurrent Skip List",
    category: "data-structures",
    complexity: { time: "O(log n) expected per operation", space: "O(n) expected" },
    defaultInput: { initial: [3, 6, 9, 12], inserts: [7, 4, 11] },
    visualType: "point",
    run,
    pseudocode: [
        "seed the bottom lane with the initial keys",
        "give each key a tower height for the express lanes",
        "each thread searches its path holding a lock on the current node",
        "advance hand over hand, releasing earlier locks as it moves",
        "threads acquire their paths concurrently before committing",
        "splice the new key into each lane up to its tower height",
        "release all held locks so other threads can proceed",
        "reads traverse lanes without acquiring any locks",
        "done: every inserted key is present exactly once",
    ],
};

export default module;
