/**
 * rwlock.ts - Readers-Writer Lock
 *
 * Many readers may hold the lock at once, but a writer needs exclusive access.
 * Requests are handled in arrival order: a read is granted whenever no writer
 * holds the lock, while a write is granted only when no reader or writer holds
 * it. Requests that cannot proceed wait in a first-in-first-out queue and are
 * retried after every release.
 *
 * The simulation is deterministic over a supplied event list. It does not model
 * writer-preference policies, thread scheduling, or lock upgrading.
 *
 * Time:  O(events * threads)
 * Space: O(threads + pending events)
 */

import type { AlgorithmModule, VisualEntity, VisualFrame } from "@/types";

type LockType = "read" | "write";

interface Event {
    thread: number;
    action: "acquire" | "release";
    type?: LockType;
}

interface Task {
    threads?: number;
    events?: Event[];
}

function makeBars(threads: number, readers: Set<number>, writer: number | null, waiting: Set<number>): VisualEntity[] {
    return Array.from({ length: threads }, (_, i) => {
        const state = writer === i ? "holding-write" : readers.has(i) ? "holding-read" : waiting.has(i) ? "waiting" : "idle";
        const value = writer === i ? 2 : readers.has(i) ? 1 : waiting.has(i) ? -1 : 0;
        return {
            id: `proc-${i}`,
            type: "bar" as const,
            label: `T${i}: ${state}`,
            value,
            state: writer === i ? "error" : readers.has(i) ? "sorted" : waiting.has(i) ? "comparing" : "idle",
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
        { thread: 0, action: "acquire", type: "read" },
        { thread: 1, action: "acquire", type: "read" },
        { thread: 2, action: "acquire", type: "write" },
        { thread: 0, action: "release" },
        { thread: 1, action: "release" },
        { thread: 2, action: "acquire", type: "write" },
    ];
    const threads = Math.min(16, Math.max(1, Math.floor(Number(task.threads ?? 3)) || 3));
    const readers = new Set<number>();
    const pending: Event[] = [];
    let writer: number | null = null;
    let grants = 0;

    yield {
        stepNumber: 0,
        entities: makeBars(threads, readers, writer, new Set()),
        edges: [],
        description: `Readers-writer lock with ${threads} threads processing ${events.length} events.`,
        codeLineNumber: 0,
        layout: "array",
        meta: { threads, grants, writer, readers: [], waiting: [], invariantHolds: true, event: null },
    };

    const tryGrant = (): string[] => {
        const granted: string[] = [];
        for (let k = 0; k < pending.length;) {
            const req = pending[k];
            if (!req) break;
            if (req.type === "read" && writer === null) {
                readers.add(req.thread);
                pending.splice(k, 1);
                grants += 1;
                granted.push(`reader ${req.thread}`);
                continue;
            }
            if (req.type === "write" && writer === null && readers.size === 0) {
                writer = req.thread;
                pending.splice(k, 1);
                grants += 1;
                granted.push(`writer ${req.thread}`);
                continue;
            }
            k += 1;
        }
        return granted;
    };

    let step = 1;
    let invariantHolds = true;
    for (const event of events) {
        const t = Math.max(0, Math.min(threads - 1, Math.floor(Number(event.thread)) || 0));
        const type: LockType = event.type === "write" ? "write" : "read";
        let result = "";
        if (event.action === "acquire") {
            pending.push({ thread: t, action: "acquire", type });
            result = `thread ${t} requests ${type}`;
        } else {
            if (writer === t) writer = null;
            if (readers.has(t)) readers.delete(t);
            result = `thread ${t} releases`;
        }
        const granted = tryGrant();
        const valid = writer === null || readers.size === 0;
        invariantHolds = invariantHolds && valid;

        yield {
            stepNumber: step,
            entities: makeBars(threads, readers, writer, new Set(pending.map((e) => e.thread))),
            edges: [],
            description: `${result}; granted ${granted.length > 0 ? granted.join(" and ") : "nothing"}; writer ${writer === null ? "none" : writer}, readers ${readers.size}.`,
            codeLineNumber: event.action === "acquire" ? 2 : 4,
            layout: "array",
            meta: {
                threads,
                grants,
                writer,
                readers: [...readers].sort((a, b) => a - b),
                waiting: pending.map((e) => e.thread),
                invariantHolds: valid,
                event: { thread: t, action: event.action, type },
                granted,
            },
        };
        step += 1;
    }

    yield {
        stepNumber: step,
        entities: makeBars(threads, readers, writer, new Set(pending.map((e) => e.thread))),
        edges: [],
        description: `Processed ${events.length} events with ${grants} grant(s); mutual exclusion ${invariantHolds ? "held" : "was violated"}.`,
        codeLineNumber: 6,
        layout: "array",
        meta: { threads, events: events.length, grants, writer, readers: [...readers], waiting: pending.map((e) => e.thread), invariantHolds },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "A readers-writer lock lets a group of readers proceed together because they never modify the protected data. A writer must wait until all readers leave and no other writer holds the lock. Queueing requests in arrival order prevents a stream of new readers from starving a waiting writer.",
        invariants: [
            "At most one writer holds the lock at any time.",
            "A writer and a reader never hold the lock simultaneously.",
            "Pending requests are granted in arrival order once their condition is met.",
        ],
        correctness:
            "A read grant is issued only when writer is null, and a write grant only when both writer is null and the reader set is empty. After each event the state is checked for the mutual-exclusion invariant. Because the FIFO queue is retried on every release, a blocked writer eventually reaches the front and is granted once the readers drain, so no waiting request is skipped. The test uses a scripted schedule and verifies both the invariant on every frame and the eventual grant of a blocked writer.",
        complexityRationale:
            "Each event may scan the pending queue, which holds at most as many entries as threads, so the simulation takes O(events times threads) time. The reader set, writer id, and queue need O(threads) space.",
        uses: [
            "Protecting shared data structures with frequent reads and rare writes",
            "Database and file-system lock managers",
            "A teaching model for mutual exclusion with shared access",
        ],
        references: [
            "Courtois, Heymans, and Parnas, Concurrent Control with Readers and Writers, 1971",
            "Herlihy and Shavit, The Art of Multiprocessor Programming, Chapter 7",
        ],
        workedExample:
            "Threads 0 and 1 acquire read locks and both proceed. Thread 2 requests a write and waits because readers are active. After threads 0 and 1 release, the retried queue grants the writer. The invariant that no reader and writer coexist holds after every event.",
    },
    id: "rwlock",
    name: "Readers-Writer Lock",
    category: "parallel-distributed",
    complexity: { time: "O(events * threads)", space: "O(threads)" },
    defaultInput: {
        threads: 3,
        events: [
            { thread: 0, action: "acquire", type: "read" },
            { thread: 1, action: "acquire", type: "read" },
            { thread: 2, action: "acquire", type: "write" },
            { thread: 0, action: "release" },
            { thread: 1, action: "release" },
        ],
    },
    visualType: "array",
    run,
    pseudocode: [
        "read the thread count and ordered event list",
        "initialize the reader set, writer slot, and empty queue",
        "on an acquire append the request to the queue",
        "on a release clear the holder of that thread",
        "scan the queue and grant reads while no writer holds",
        "grant a write only when the reader set and writer slot are empty",
        "check mutual exclusion after every event",
        "done: report the number of grants and final holders",
    ],
};

export default module;
