/**
 * tortoise-and-hare-cycle-detection.ts - Floyd Cycle Detection
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Given a functional graph (each vertex has exactly one outgoing pointer),
 * this module finds the cycle reachable from a start vertex using Floyd's
 * two-pointer method. A slow pointer advances one step and a fast pointer
 * advances two; once they meet inside the cycle, a pointer from the start and
 * one from the meeting point walk in lockstep to locate the cycle entry, and a
 * final lap measures the cycle length.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(mu + lambda) pointer steps, where mu is the tail length and
 *          lambda is the cycle length
 *   Space: O(1) auxiliary pointers
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Each vertex is a node; its outgoing pointer is a directed edge.
 *   - The slow pointer is GREEN (active), the fast pointer is YELLOW
 *     (comparing), and the cycle entry is a BLUE path node.
 */

import type { AlgorithmModule, EntityState, VisualEdge, VisualEntity, VisualFrame } from "@/types";

interface Task {
    next?: number[];
    start?: number;
}

/** Build the pointer-graph entities for one frame. */
function snapshot(
    next: number[],
    slow: number | null,
    fast: number | null,
    entry: number | null,
): { entities: VisualEntity[]; edges: VisualEdge[] } {
    const entities: VisualEntity[] = next.map((to, index) => {
        let state: EntityState = "unvisited";
        if (index === slow) state = "active";
        else if (index === fast) state = "comparing";
        else if (index === entry) state = "path";
        return {
            id: `node-${index}`,
            type: "node" as const,
            label: String(index),
            value: index,
            state,
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: { index, next: to },
        };
    });
    const edges: VisualEdge[] = next.map((to, index) => ({
        id: `edge-${index}-${to}`,
        sourceId: `node-${index}`,
        targetId: `node-${to}`,
        label: "",
        state: index === slow ? "active" : index === fast ? "comparing" : "idle",
        directed: true,
    }));
    return { entities, edges };
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as Task | null) ?? {};
    const raw = Array.isArray(task.next) && task.next.length > 0 ? task.next : [1, 2, 3, 4, 5, 2];
    const next = raw.map((value, index) =>
        Number.isInteger(value) && value >= 0 && value < raw.length ? value : index,
    );
    const startRaw = task.start;
    const start = typeof startRaw === "number" && Number.isInteger(startRaw) && startRaw >= 0 && startRaw < next.length
        ? startRaw
        : 0;

    let step = 0;
    const emit = (slow: number | null, fast: number | null, entry: number | null, phase: string, detail: string): void => {
        // Frames are collected by the caller; the generator yields below via a queue.
        pending.push({ slow, fast, entry, phase, detail });
    };
    const pending: Array<{ slow: number | null; fast: number | null; entry: number | null; phase: string; detail: string }> = [];
    const flush = function* (): Generator<VisualFrame, void, unknown> {
        while (pending.length > 0) {
            const item = pending.shift() as (typeof pending)[number];
            const visual = snapshot(next, item.slow, item.fast, item.entry);
            yield {
                stepNumber: step,
                entities: visual.entities,
                edges: visual.edges,
                description: `${item.phase}: ${item.detail}`,
                codeLineNumber: item.phase === "phase one" ? 1 : item.phase === "phase two" ? 3 : item.phase === "phase three" ? 5 : 7,
                layout: "graph",
                meta: { phase: item.phase, slow: item.slow ?? -1, fast: item.fast ?? -1, entry: item.entry ?? -1 },
            };
            step += 1;
        }
    };

    emit(start, start, null, "setup", `start at vertex ${start}; each vertex points to one successor.`);
    yield* flush();

    // Phase one: advance both pointers until they meet inside the cycle.
    let slow = start;
    let fast = start;
    let guard = 0;
    do {
        slow = next[slow] as number;
        fast = next[next[fast] as number] as number;
        emit(slow, fast, null, "phase one", `slow=${slow}, fast=${fast}; move one and two steps.`);
        guard += 1;
    } while (slow !== fast && guard <= next.length * 4);
    const meeting = slow;

    // Phase two: locate the cycle entry.
    slow = start;
    while (slow !== fast && guard <= next.length * 8) {
        slow = next[slow] as number;
        fast = next[fast] as number;
        emit(slow, fast, null, "phase two", `walk both to the entry: ${slow} vs ${fast}.`);
        guard += 1;
    }
    const entry = slow;

    // Phase three: measure the cycle length with one lap.
    let length = 1;
    fast = next[slow] as number;
    while (fast !== slow && guard <= next.length * 12) {
        fast = next[fast] as number;
        length += 1;
        emit(slow, fast, entry, "phase three", `count the cycle: length so far ${length}.`);
        guard += 1;
    }
    yield* flush();

    emit(entry, null, entry, "done", `cycle entry ${entry}, length ${length}.`);
    yield* flush();

    const visual = snapshot(next, null, null, entry);
    yield {
        stepNumber: step,
        entities: visual.entities,
        edges: visual.edges,
        description: `Cycle found: entry vertex ${entry}, length ${length}.`,
        codeLineNumber: 7,
        layout: "graph",
        meta: { phase: "done", entry, cycleLength: length, meeting, start, vertexCount: next.length },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Imagine two runners on a track where one runs twice as fast. If the path eventually loops, the fast runner must eventually lap the slow one inside the loop. From that meeting point, walking one runner back to the start and advancing both at the same speed makes them meet exactly where the loop begins, and one more lap reveals its length.",
        invariants: [
            "The slow pointer is always exactly k steps from the start after k iterations.",
            "The fast pointer is always exactly 2k steps from the start after k iterations.",
            "Once both pointers are inside the cycle, their separation changes by one each round, so they must meet.",
        ],
        correctness:
            "Let mu be the tail length and lambda the cycle length. After t iterations with t at least mu, both pointers lie on the cycle and their positions differ by t modulo lambda, so they coincide at some t divisible by lambda. At that meeting point, moving one pointer to the start and keeping both speeds equal gives positions mu and mu + (t - mu) modulo lambda; these are equal exactly at the cycle entry by the standard cycle-entry theorem. A final lap counts lambda steps.",
        complexityRationale:
            "The first meeting occurs within mu + lambda steps, the entry search within mu steps, and the length lap within lambda steps, so the time is O(mu + lambda). Only a constant number of pointer variables are stored, giving O(1) extra space beyond the graph itself.",
        uses: [
            "Detecting loops in linked lists and functional graphs",
            "Finding the repeated integer in an array of values 1 through n",
            "Cycle detection in pseudo-random number generators and state machines",
        ],
        references: [
            "Knuth, The Art of Computer Programming, Volume 2, Floyd's cycle-finding algorithm",
            "CLRS, Introduction to Algorithms, exercises on linked-list cycles",
        ],
        workedExample:
            "For pointers 0->1->2->3->4->5->2 starting at 0, the slow and fast pointers meet at vertex 4 after four rounds. A pointer from 0 and one from 4 then advance together and meet at vertex 2, the cycle entry. Walking from 2 back to 2 counts four steps, so the cycle length is 4.",
    },
    id: "tortoise-and-hare-cycle-detection",
    name: "Tortoise and Hare Cycle Detection",
    category: "searching",
    complexity: { time: "O(mu + lambda)", space: "O(1)" },
    defaultInput: { next: [1, 2, 3, 4, 5, 2], start: 0 },
    visualType: "graph",
    run,
    pseudocode: [
        "set slow and fast pointers to the start vertex",
        "advance slow one step and fast two steps until they meet",
        "reset slow to the start, keep fast at the meeting point",
        "advance both one step until they meet at the cycle entry",
        "report the entry vertex",
        "advance fast one step at a time back to the entry",
        "count the steps to obtain the cycle length",
        "done: report the entry and the cycle length",
    ],
};

export default module;
