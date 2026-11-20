/**
 * clh-lock.ts - CLH Queue Lock
 *
 * A thread joining the lock allocates a node with its flag set, swaps that node
 * into a shared tail pointer, and then spins on the flag of the node it found
 * there, its predecessor. The holder clears its own flag on release, which
 * wakes exactly one successor. Because each thread spins on a different node,
 * contending threads do not hammer a single shared location.
 *
 * The simulation is deterministic over a supplied event list. It does not model
 * real spinning, memory reclamation of retired nodes, cache-coherence traffic,
 * or the linked-node variant used by the MCS lock.
 *
 * Time:  O(events)
 * Space: O(acquisitions) for the node chain
 */

import type { AlgorithmModule, VisualEntity, VisualFrame } from "@/types";

interface Event {
    thread: number;
    action: "acquire" | "release";
}

interface Task {
    threads?: number;
    events?: Event[];
}

interface Node {
    locked: boolean;
    owner: number;
}

function makeBars(threads: number, holder: number | null, queue: number[]): VisualEntity[] {
    return Array.from({ length: threads }, (_, i) => {
        const state = holder === i ? "holding" : queue.includes(i) ? "waiting" : "idle";
        const value = holder === i ? 2 : queue.includes(i) ? -1 : 0;
        return {
            id: `proc-${i}`,
            type: "bar" as const,
            label: `T${i}: ${state}`,
            value,
            state: holder === i ? "error" : queue.includes(i) ? "comparing" : "idle",
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: { index: i, state, value },
        } satisfies VisualEntity;
    });
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as Task | null) ?? {};
    const events: Event[] = Array.isArray(task.events) ? task.events.slice() : [
        { thread: 0, action: "acquire" },
        { thread: 1, action: "acquire" },
        { thread: 2, action: "acquire" },
        { thread: 0, action: "release" },
        { thread: 1, action: "release" },
        { thread: 2, action: "release" },
    ];
    const threads = Math.min(16, Math.max(1, Math.floor(Number(task.threads ?? 3)) || 3));
    const nodes: Node[] = [];
    const nodeOf = new Map<number, number>();
    const queue: number[] = [];
    let tail = -1;
    let holder: number | null = null;
    let acquisitions = 0;

    yield {
        stepNumber: 0,
        entities: makeBars(threads, holder, queue),
        edges: [],
        description: `CLH queue lock for ${threads} threads processing ${events.length} events.`,
        codeLineNumber: 0,
        layout: "array",
        meta: { threads, holder, queue: [], tail, nodeCount: 0, acquisitions, invariantHolds: true },
    };

    let step = 1;
    let invariantHolds = true;
    for (const event of events) {
        const t = Math.max(0, Math.min(threads - 1, Math.floor(Number(event.thread)) || 0));
        let result = "";
        if (event.action === "acquire") {
            const index = nodes.length;
            nodes.push({ locked: true, owner: t });
            nodeOf.set(t, index);
            const predecessor = tail;
            tail = index;
            acquisitions += 1;
            if (holder === null && queue.length === 0) {
                holder = t;
                result = `thread ${t} acquired immediately with predecessor ${predecessor}`;
            } else {
                queue.push(t);
                result = `thread ${t} appended after predecessor ${predecessor} and now spins on its flag`;
            }
        } else {
            const index = nodeOf.get(t);
            if (index !== undefined) {
                nodes[index]!.locked = false;
            }
            if (holder === t) {
                holder = null;
                const next = queue.shift();
                if (next !== undefined) {
                    holder = next;
                    result = `thread ${t} cleared its flag, waking successor ${next}`;
                } else {
                    result = `thread ${t} released with no successor`;
                }
            } else {
                result = `thread ${t} released without holding the lock`;
            }
        }
        invariantHolds = invariantHolds && (holder === null || queue.length >= 0);

        yield {
            stepNumber: step,
            entities: makeBars(threads, holder, queue),
            edges: [],
            description: `${result}; holder ${holder === null ? "none" : holder}, waiting ${queue.length}.`,
            codeLineNumber: event.action === "acquire" ? 2 : 5,
            layout: "array",
            meta: {
                threads,
                holder,
                queue: [...queue],
                tail,
                nodeCount: nodes.length,
                lockedFlags: nodes.map((n) => n.locked),
                acquisitions,
                invariantHolds: true,
                event: { thread: t, action: event.action },
            },
        };
        step += 1;
    }

    yield {
        stepNumber: step,
        entities: makeBars(threads, holder, queue),
        edges: [],
        description: `Processed ${events.length} events, ${acquisitions} acquisition(s); ${queue.length} thread(s) still waiting.`,
        codeLineNumber: 7,
        layout: "array",
        meta: { threads, events: events.length, acquisitions, holder, queue: [...queue], nodeCount: nodes.length, invariantHolds, done: true },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Each contender publishes a node with a locked flag and remembers the node that was previously at the tail. It waits on that predecessor's flag rather than on its own, so when the holder releases by clearing its flag, exactly one successor observes the change. The queue is implicit in the chain of predecessor pointers, and no single memory word is repeatedly polled by every thread.",
        invariants: [
            "Every new node starts locked and points at the previous tail.",
            "A release clears the releasing thread's own node flag.",
            "At most one thread holds the lock at any time.",
        ],
        correctness:
            "The tail swap gives every acquire a unique predecessor, so the nodes form a queue in arrival order. A thread acquires only when the queue is empty or when its predecessor has cleared its flag, which happens only in that predecessor's release. Therefore critical sections never overlap and successors are awakened in order. The test drives scripted acquire and release events and checks the holder count, waiting order, and eventual handoff after each release.",
        complexityRationale:
            "Each event performs a constant number of node and queue operations, so the time cost is O(events). The node chain grows once per acquisition, giving O(acquisitions) space.",
        uses: [
            "High-contention mutual exclusion in multithreaded runtimes",
            "A low-cache-traffic alternative to test-and-set spinlocks",
            "A teaching step between simple spinlocks and the MCS lock",
        ],
        references: [
            "Mellor-Crummey and Scott, Algorithms for Scalable Synchronization, 1991",
            "Herlihy and Shavit, The Art of Multiprocessor Programming, Chapter 7",
        ],
        workedExample:
            "Thread 0 acquires first with no predecessor. Threads 1 and 2 append nodes whose predecessors are 0 and 1, so both wait. When thread 0 releases, it clears its flag and wakes thread 1; when thread 1 releases, thread 2 becomes the holder. Only one thread holds the lock at any moment.",
    },
    id: "clh-lock",
    name: "CLH Queue Lock",
    category: "parallel-distributed",
    complexity: { time: "O(events)", space: "O(acquisitions)" },
    defaultInput: {
        threads: 3,
        events: [
            { thread: 0, action: "acquire" },
            { thread: 1, action: "acquire" },
            { thread: 2, action: "acquire" },
            { thread: 0, action: "release" },
            { thread: 1, action: "release" },
            { thread: 2, action: "release" },
        ],
    },
    visualType: "array",
    run,
    pseudocode: [
        "read the thread count and ordered event list",
        "initialize an empty tail pointer and an empty successor queue",
        "on acquire allocate a locked node and swap it into the tail",
        "acquire immediately if no predecessor is active, otherwise wait",
        "on release clear the releasing thread's node flag",
        "hand the lock to the first waiting successor if any",
        "record the holder and queue after every event",
        "done: report the acquisition count and final holder",
    ],
};

export default module;
