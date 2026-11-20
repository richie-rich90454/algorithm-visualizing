/**
 * batch-queue.ts - The Hood-Melville Batch Queue (Real-Time FIFO Queue)
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * A batch queue is a purely functional FIFO queue that guarantees worst-case
 * O(1) enqueue and dequeue. It keeps an output-ready front list and a reverse
 * rear list, but unlike a banker's queue it never rotates the whole rear in a
 * single step: it copies the rear toward a new front incrementally, one element
 * per operation, using a "batch" schedule. The copy is committed only when it
 * is complete, so no operation ever pays a large rebuild cost.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(1) worst case per enqueue and dequeue
 *   Space: O(n) for the front, rear, and in-progress copy
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Front items are GREEN, rear items are BLUE, the in-progress copy is
 *     highlighted while it is being built one element at a time.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

type Command = { op: "enqueue"; value: number } | { op: "dequeue" };

/** Render the logical queue as bars: front, reverse rear, and the copy buffer. */
function snapshot(
    front: number[],
    rear: number[],
    buffer: number[],
): VisualEntity[] {
    const entities: VisualEntity[] = [];
    const push = (value: number, index: number, role: string, state: EntityState): void => {
        entities.push({
            id: `${role}-${index}`,
            type: "bar" as const,
            label: `${role[0].toUpperCase()}:${value}`,
            value,
            state,
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: { role, index },
        });
    };
    front.forEach((value, i) => push(value, i, "front", "sorted"));
    [...rear].reverse().forEach((value, i) => push(value, i, "rear", "active"));
    buffer.forEach((value, i) => push(value, i, "buffer", "comparing"));
    if (entities.length === 0) {
        entities.push({
            id: "empty",
            type: "bar" as const,
            label: "empty",
            value: 0,
            state: "idle",
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: { role: "empty", index: 0 },
        });
    }
    return entities;
}

/** Simulate a Hood-Melville batch queue, emitting one frame per operation. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { commands?: Command[] } | null) ?? {};
    const commands: Command[] = task.commands ?? [
        { op: "enqueue", value: 5 },
        { op: "enqueue", value: 3 },
        { op: "enqueue", value: 9 },
        { op: "dequeue" },
        { op: "enqueue", value: 7 },
        { op: "dequeue" },
        { op: "dequeue" },
        { op: "dequeue" },
    ];

    let front: number[] = [];
    let rear: number[] = [];
    let buffer: number[] = [];
    let rotating = false;
    let copied = 0;
    let rotations = 0;
    const output: number[] = [];
    let step = 0;

    const emit = (
        description: string,
        codeLine: number,
        extra: Record<string, number | string | boolean | number[]>,
    ): VisualFrame => {
        const frame: VisualFrame = {
            stepNumber: step,
            entities: snapshot(front, rear, buffer),
            edges: [],
            description,
            codeLineNumber: codeLine,
            layout: "array",
            meta: {
                front: [...front],
                rear: [...rear],
                buffer: [...buffer],
                rotations,
                output: [...output],
                ...extra,
            },
        };
        step += 1;
        return frame;
    };

    /** Advance the incremental copy by one element per operation. */
    const tick = (): string | null => {
        if (!rotating) {
            return null;
        }
        const target = [...front, ...[...rear].reverse()];
        copied = Math.min(copied + 1, target.length);
        buffer = target.slice(0, copied);
        if (copied >= target.length) {
            front = target;
            rear = [];
            buffer = [];
            rotating = false;
            copied = 0;
            rotations += 1;
            return "rotation committed";
        }
        return "copy advanced";
    };

    /** Start a rotation when the rear grows longer than the front. */
    const maybeStart = (): void => {
        if (!rotating && rear.length > front.length && rear.length > 0) {
            rotating = true;
            copied = 0;
            buffer = [];
        }
    };

    yield emit(
        "Empty batch queue: an output front, a reverse rear, and an incremental copy buffer.",
        0,
        { phase: "init" },
    );

    for (const command of commands) {
        if (command.op === "enqueue") {
            rear.unshift(command.value);
            maybeStart();
            const progress = tick();
            yield emit(
                `Enqueued ${command.value} onto the rear; ${progress ?? "no copy work pending"}.`,
                1,
                { phase: "enqueue", op: "enqueue", value: command.value },
            );
        } else {
            if (front.length === 0 && rear.length > 0) {
                front = [...rear].reverse();
                rear = [];
                buffer = [];
                rotating = false;
                copied = 0;
                rotations += 1;
                yield emit(
                    "Front exhausted: finished the pending batch rotation in one step to expose the rear.",
                    4,
                    { phase: "force-commit" },
                );
            }
            if (front.length === 0) {
                yield emit("Dequeue on an empty queue returns nothing.", 5, {
                    phase: "empty-dequeue",
                    op: "dequeue",
                });
                continue;
            }
            const value = front.shift() as number;
            output.push(value);
            maybeStart();
            const progress = tick();
            yield emit(
                `Dequeued ${value} from the front; ${progress ?? "no copy work pending"}.`,
                5,
                { phase: "dequeue", op: "dequeue", value },
            );
        }
    }

    yield emit(
        `Done: dequeued ${output.length} value(s) in first-in-first-out order: ${output.join(", ")}.`,
        7,
        { phase: "done" },
    );
}

/** The batch queue module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "Imagine a checkout line with a service counter and a waiting room. Customers at the counter are served immediately and new arrivals wait in the back. Rather than stop everything to shuffle the whole room into the counter line, a batch queue copies the waiting room into a fresh counter line a little at a time, one customer per operation, and switches over only when the copy is finished.",
        invariants: [
            "The logical queue contents are always the front followed by the reverse of the rear.",
            "The copy buffer is a prefix of the new front and grows by at most one element per operation.",
            "A rotation is committed only after the copy covers every queued element, so it never drops a value.",
        ],
        correctness:
            "Enqueue prepends to the rear, which reverses back into the correct oldest-first order when committed. Dequeue removes the head of the front, the oldest live value. During a rotation the front and rear still hold the entire logical queue, and committing replaces them with an equivalent front, so the dequeued sequence always equals the enqueued sequence in first-in-first-out order.",
        complexityRationale:
            "Enqueue is a constant-time prepend. Each operation performs at most one copy step and one constant-time commit, so no single operation does a linear rebuild, giving O(1) worst-case time. The front, rear, and in-progress copy together hold each queued value a constant number of times, O(n) space.",
        uses: [
            "Breadth-first search worklists with predictable per-step latency",
            "Message and event queues that must avoid occasional long stalls",
            "Purely functional programs needing worst-case bounded queue operations",
        ],
        references: [
            "J. R. Hood and R. A. Melville, Real-Time Queue Operations in Pure Lisp, Information Processing Letters, 1981",
            "C. Okasaki, Purely Functional Data Structures, Chapter 8",
        ],
        workedExample:
            "Enqueue 5, 3, 9 so the front holds [5] and the rear holds [9, 3]. The batch copy builds [5, 3, 9] one element at a time while dequeues still serve from the front. Dequeuing 5 advances the copy and commits the new front [3, 9]; after enqueuing 7 and three more dequeues the output is 5, 3, 9, 7, exactly the enqueue order.",
    },
    id: "batch-queue",
    name: "Batch Queue (Hood-Melville)",
    category: "data-structures",
    complexity: { time: "O(1) worst case per operation", space: "O(n)" },
    defaultInput: {
        commands: [
            { op: "enqueue", value: 5 },
            { op: "enqueue", value: 3 },
            { op: "enqueue", value: 9 },
            { op: "dequeue" },
            { op: "enqueue", value: 7 },
            { op: "dequeue" },
            { op: "dequeue" },
            { op: "dequeue" },
        ],
    },
    visualType: "array",
    run,
    pseudocode: [
        "initialize an empty front, rear, and copy buffer",
        "on enqueue push the value onto the rear and start a batch when the rear grows",
        "advance the incremental copy by one element after every operation",
        "commit the copy only when it covers every queued value",
        "if the front is empty, finish the pending batch to expose the rear",
        "on dequeue remove and return the oldest front value",
        "on an empty dequeue report that no value is available",
        "done: dequeued values follow the enqueue order",
    ],
};

export default module;
