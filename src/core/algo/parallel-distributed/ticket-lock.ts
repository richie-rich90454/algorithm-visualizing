/**
 * ticket-lock.ts - Ticket Lock Mutual Exclusion
 *
 * A FIFO mutual-exclusion lock built from two shared integers. On acquisition a
 * thread atomically takes a ticket from nextTicket and spins until nowServing
 * equals its ticket. On release the server counter advances, handing the lock
 * to the next ticket in line. This is distinct from test-and-set, spinlock, and
 * queue-based MCS/CLH locks.
 *
 * The simulation is deterministic: threads arrive in a supplied order, each
 * receives a ticket, and the lock is granted strictly in ticket order. It does
 * not model real preemption, cache contention, or timeouts.
 *
 * Time:  O(n) for n requests
 * Space: O(n) for the waiting queue
 */

import type { AlgorithmModule, VisualEntity, VisualFrame } from "@/types";

interface Task {
    threads?: number[];
}

interface Holder {
    thread: number;
    ticket: number;
}

function makeBars(queue: Holder[], nowServing: number, owner: number | null): VisualEntity[] {
    return queue.map((h) => ({
        id: `ticket-${h.ticket}`,
        type: "bar" as const,
        label: `T${h.thread}#${h.ticket}`,
        value: h.ticket + 1,
        state: owner === h.ticket ? "active" : h.ticket === nowServing ? "comparing" : "idle",
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { thread: h.thread, ticket: h.ticket, serving: owner === h.ticket },
    }));
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as Task | null) ?? {};
    const arrivals = Array.isArray(task.threads) && task.threads.length > 0
        ? task.threads.map((t) => Number(t))
        : [3, 1, 4, 1, 5, 9, 2, 6];
    let nextTicket = 0;
    let nowServing = 0;
    const queue: Holder[] = [];
    const grantOrder: number[] = [];
    let owner: number | null = null;
    let step = 0;

    const metaFor = (phase: string, current: number | null) => ({
        phase,
        nextTicket,
        nowServing,
        queue: queue.map((h) => [h.thread, h.ticket]),
        grantOrder: [...grantOrder],
        criticalOwner: current === null ? null : current,
        waiting: queue.length,
    });

    yield {
        stepNumber: step,
        entities: [],
        edges: [],
        description: `Ticket lock starts with nextTicket=0 and nowServing=0 for ${arrivals.length} arriving threads.`,
        codeLineNumber: 0,
        layout: "array",
        meta: metaFor("init", null),
    };
    step += 1;

    for (const thread of arrivals) {
        const ticket = nextTicket;
        nextTicket += 1;
        queue.push({ thread, ticket });
        yield {
            stepNumber: step,
            entities: makeBars(queue, nowServing, owner),
            edges: [],
            description: `Thread ${thread} calls fetch-and-increment and receives ticket ${ticket}; it will spin until nowServing reaches ${ticket}.`,
            codeLineNumber: 2,
            layout: "array",
            meta: metaFor("arrive", owner),
        };
        step += 1;
    }

    while (queue.length > 0) {
        const next = queue[0] as Holder;
        owner = next.ticket;
        nowServing = next.ticket;
        grantOrder.push(next.thread);
        yield {
            stepNumber: step,
            entities: makeBars(queue, nowServing, owner),
            edges: [],
            description: `nowServing=${nowServing}: thread ${next.thread} observes its ticket and enters the critical section.`,
            codeLineNumber: 4,
            layout: "array",
            meta: metaFor("enter", owner),
        };
        step += 1;

        queue.shift();
        owner = null;
        yield {
            stepNumber: step,
            entities: makeBars(queue, nowServing, owner),
            edges: [],
            description: `Thread ${next.thread} releases the lock; nowServing advances to ${nowServing + 1} and the next ticket holder may proceed.`,
            codeLineNumber: 5,
            layout: "array",
            meta: metaFor("release", null),
        };
        step += 1;
        nowServing += 1;
    }

    yield {
        stepNumber: step,
        entities: [],
        edges: [],
        description: `All ${grantOrder.length} requests served in ticket order; grant sequence ${grantOrder.join(", ")}.`,
        codeLineNumber: 7,
        layout: "array",
        meta: metaFor("done", null),
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "A ticket lock behaves like a deli counter. Taking a number is one atomic fetch-and-increment, and a display board says which number is being served. A thread waits until its number appears on the board, so service follows arrival order automatically and nobody can cut in line.",
        invariants: [
            "Tickets are unique and assigned consecutively from zero.",
            "The nowServing counter never exceeds the smallest ticket still waiting.",
            "At most one thread holds the critical section at any moment.",
        ],
        correctness:
            "Fetch-and-increment gives each acquisition a distinct ticket, so no two threads can hold the same ticket. A thread enters only when nowServing equals its ticket, and nowServing advances only on a release, so exactly one ticket holder is served at a time and tickets are served in increasing order. Because a later arrival always gets a larger ticket, grant order equals arrival order, which is FIFO fairness.",
        complexityRationale:
            "Each acquisition performs one atomic increment and possibly spinning, while each release is one increment; the deterministic simulation emits O(n) frames for n requests. The waiting queue stores at most n ticket records, giving O(n) space.",
        uses: [
            "Fair locking in kernels and runtime libraries",
            "Protecting short critical sections where FIFO fairness matters",
            "A teaching model for atomic fetch-and-add and spin waiting",
        ],
        references: [
            "Mellor-Crummey and Scott, Algorithms for Scalable Synchronization, 1991",
            "Herlihy and Shavit, The Art of Multiprocessor Programming, Chapter 7",
        ],
        workedExample:
            "Threads arriving as 3, 1, 4 receive tickets 0, 1, 2. The lock serves ticket 0 first, so thread 3 enters before thread 1 even though 1 arrives earlier in numeric label; the grant order follows ticket order, which is the arrival order of the requests.",
    },
    id: "ticket-lock",
    name: "Ticket Lock",
    category: "parallel-distributed",
    complexity: { time: "O(n) acquisitions", space: "O(n)" },
    defaultInput: { threads: [3, 1, 4, 1, 5, 9, 2, 6] },
    visualType: "array",
    run,
    pseudocode: [
        "initialize nextTicket and nowServing to zero",
        "on acquisition atomically take myTicket from nextTicket",
        "wait while nowServing does not equal myTicket",
        "enter the critical section with exclusive access",
        "on release add one to nowServing",
        "the next ticket holder observes the new value and proceeds",
        "repeat for every arriving thread",
        "done: report the grant order",
    ],
};

export default module;
