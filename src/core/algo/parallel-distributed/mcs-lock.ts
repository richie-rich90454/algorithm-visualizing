/**
 * mcs-lock.ts - MCS Queue-Based Spin Lock
 *
 * The MCS lock gives each waiting processor its own node in a linked queue.
 * Enqueueing swaps the tail pointer and links the predecessor to the new node,
 * so contenders spin on a local flag instead of a shared cache line. The holder
 * hands the lock directly to its successor by clearing that successor's flag.
 * The result is first-come-first-served mutual exclusion with low contention.
 *
 * Limits of the demo: a deterministic trace where processes enqueue in a given
 * order and release in the same order, a fixed set of at most five processors,
 * an abstract atomic swap and store model, and no preemption, cache timing, or
 * crash recovery. The release path assumes the tail still points at the holder
 * when there is no successor.
 *
 * Time: O(1) local work per acquire and release. Space: O(n) for the queue nodes.
 */

import type { AlgorithmModule, VisualEntity, VisualFrame } from "@/types";

interface QNode {
    locked: boolean;
    next: number | null;
}

export interface MCSEvent {
    kind: "enqueue" | "grant" | "release" | "handoff";
    process: number;
    tail: number | null;
    holder: number | null;
}

/** Simulate enqueue and FIFO release for a given acquisition order. */
export function mcsTrace(order: number[]): {
    events: MCSEvent[];
    grants: number[];
    mutualExclusion: boolean;
    fifo: boolean;
} {
    const nodes = new Map<number, QNode>();
    for (const process of order) {
        nodes.set(process, { locked: true, next: null });
    }
    let tail: number | null = null;
    let holder: number | null = null;
    const events: MCSEvent[] = [];
    const grants: number[] = [];
    let mutualExclusion = true;
    const grant = (process: number, kind: "grant" | "handoff") => {
        if (holder !== null) {
            mutualExclusion = false;
        }
        holder = process;
        grants.push(process);
        events.push({ kind, process, tail, holder });
    };
    for (const process of order) {
        const predecessor = tail;
        tail = process;
        if (predecessor === null) {
            grant(process, "grant");
        } else {
            (nodes.get(predecessor) as QNode).next = process;
            events.push({ kind: "enqueue", process, tail, holder });
        }
    }
    for (const process of order) {
        if (holder === process) {
            holder = null;
        }
        const successor = (nodes.get(process) as QNode).next;
        events.push({ kind: "release", process, tail, holder });
        if (successor !== null) {
            (nodes.get(successor) as QNode).locked = false;
            grant(successor, "handoff");
        } else if (tail === process) {
            tail = null;
        }
    }
    const fifo = grants.length === order.length && grants.every((process, i) => process === order[i]);
    return { events, grants, mutualExclusion, fifo };
}

/** Enumerate all acquisition orders for a given process count. */
export function allAcquisitionOrders(n: number): number[][] {
    const result: number[][] = [];
    const visit = (prefix: number[], remaining: number[]) => {
        if (remaining.length === 0) {
            result.push(prefix);
            return;
        }
        for (let i = 0; i < remaining.length; i += 1) {
            visit([...prefix, remaining[i] as number], remaining.filter((_, k) => k !== i));
        }
    };
    visit([], Array.from({ length: n }, (_, i) => i));
    return result;
}

function makeCells(n: number, event: MCSEvent | null): VisualEntity[] {
    return Array.from({ length: n }, (_, process) => ({
        id: `cell-${process}`,
        type: "cell" as const,
        label: process === event?.process ? `P${process}:${event.kind}` : `P${process}`,
        value: event?.holder === process ? 1 : 0,
        state: process === event?.process ? "comparing" : event?.holder === process ? "path" : "idle",
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { index: process, process, holder: event?.holder === process, tail: event?.tail === process },
    }));
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { order?: number[] } | null) ?? {};
    const order = Array.isArray(task.order) && task.order.length > 0
        ? task.order.map((value) => Math.floor(Number(value)))
        : [2, 0, 1];
    const trace = mcsTrace(order);
    let step = 0;

    yield {
        stepNumber: step,
        entities: makeCells(order.length, null),
        edges: [],
        description: `Enqueue ${order.length} contenders into an MCS lock queue in order ${order.join(",")}.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: { order: [...order], grants: [...trace.grants], mutualExclusion: trace.mutualExclusion, fifo: trace.fifo },
    };
    step += 1;

    for (let i = 0; i < trace.events.length; i += 1) {
        const event = trace.events[i] as MCSEvent;
        yield {
            stepNumber: step,
            entities: makeCells(order.length, event),
            edges: [],
            description: `${event.kind} by process ${event.process}; holder ${event.holder === null ? "none" : event.holder}, tail ${event.tail === null ? "none" : event.tail}.`,
            codeLineNumber: 3,
            layout: "grid",
            meta: {
                order: [...order], grants: [...trace.grants],
                event: { ...event }, stepIndex: i,
                mutualExclusion: trace.mutualExclusion, fifo: trace.fifo,
            },
        };
        step += 1;
    }

    yield {
        stepNumber: step,
        entities: makeCells(order.length, null),
        edges: [],
        description: `Grant order ${trace.grants.join(",")} is FIFO with mutual exclusion ${trace.mutualExclusion}.`,
        codeLineNumber: 6,
        layout: "grid",
        meta: {
            order: [...order], grants: [...trace.grants],
            mutualExclusion: trace.mutualExclusion, fifo: trace.fifo,
            correct: trace.mutualExclusion && trace.fifo,
        },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "A naive spin lock makes every waiter hammer the same memory word. MCS instead gives each waiter a private node in a queue. Enqueueing swaps the tail pointer, and each waiter spins on its own flag. When the holder leaves, it simply clears the successor's flag, handing the lock over directly. This keeps traffic local and grants the lock in arrival order.",
        invariants: [
            "The tail pointer always references the most recently enqueued node.",
            "A successor's flag is set until the predecessor explicitly clears it.",
            "At most one process holds the lock at any moment.",
        ],
        correctness:
            "The atomic swap on the tail pointer serializes enqueueing, and linking the predecessor to the new node produces a total queue order. A process only enters its critical section when its own flag is cleared, which happens either at first enqueue with no predecessor or by the predecessor's release. Since a holder clears only its immediate successor's flag and only after leaving the critical section, at most one process is ever inside, and the grant order equals the enqueue order. The test checks both properties for every permutation of contenders.",
        complexityRationale:
            "An acquire performs one atomic swap and a release performs one store to the successor, so both are constant time and space per node. Total space for the queue is O(n) for n contenders.",
        uses: [
            "Scalable locks in operating-system kernels",
            "Synchronization on many-core processors",
            "Replacing test-and-set loops under heavy contention",
        ],
        references: [
            "Mellor-Crummey and Scott, Algorithms for Scalable Synchronization on Shared-Memory Multiprocessors, 1991",
            "Herlihy and Shavit, The Art of Multiprocessor Programming, 2012",
        ],
        workedExample:
            "With contenders 2, 0 and 1, the queue is 2 then 0 then 1. Process 2 acquires first because it has no predecessor. On release it clears process 0's flag, which acquires next, and process 0 then hands off to process 1. The grant order 2, 0, 1 is exactly the enqueue order.",
    },
    id: "mcs-lock",
    name: "MCS Queue Lock",
    category: "parallel-distributed",
    complexity: { time: "O(1) per acquire", space: "O(n)" },
    defaultInput: { order: [2, 0, 1] },
    visualType: "grid",
    run,
    pseudocode: [
        "create a queue node for each contender",
        "for each process swap itself into the tail pointer",
        "link the predecessor to the new node when one exists",
        "acquire immediately when there is no predecessor",
        "otherwise spin until the predecessor clears the local flag",
        "on release clear the successor's flag to hand off the lock",
        "record the grant sequence and check mutual exclusion",
        "done: report the FIFO grant order",
    ],
};

export default module;
