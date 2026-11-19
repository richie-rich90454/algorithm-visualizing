/**
 * okasaki-real-time-queue.ts - Real-Time Queue with a Scheduled Rotation.
 *
 * A real-time queue keeps two lists: a front list ready for output and a rear
 * list holding the most recent insertions in reverse order. A schedule tracks
 * how many front items remain before the rear must be rotated into a new front.
 * Rebuilding the front is paid for across the preceding operations, so no
 * single enqueue or dequeue ever does a large amount of work.
 *
 * Time:  O(1) amortized per enqueue and dequeue
 * Space: O(n) for the two lists
 */

import type { AlgorithmModule, VisualEntity, VisualFrame } from "@/types";

type Command = { op: "enqueue"; value: number } | { op: "dequeue" };

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
    ];

    let front: number[] = [];
    let rear: number[] = [];
    let schedule = 0;
    let rotations = 0;
    const emitted: number[] = [];
    let step = 0;

    const snapshot = (): VisualEntity[] => {
        const entities: VisualEntity[] = [];
        front.forEach((value, index) => {
            entities.push({
                id: `front-${index}`,
                type: "bar" as const,
                label: `F:${value}`,
                value,
                state: "sorted",
                x: 0,
                y: 0,
                width: 0,
                height: 0,
                metadata: { role: "front", index },
            });
        });
        rear.forEach((value, index) => {
            entities.push({
                id: `rear-${index}`,
                type: "bar" as const,
                label: `R:${value}`,
                value,
                state: "active",
                x: 0,
                y: 0,
                width: 0,
                height: 0,
                metadata: { role: "rear", index },
            });
        });
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
    };

    const emit = (
        description: string,
        codeLine: number,
        meta: Record<string, number | string | boolean | Array<number | string>>,
    ): VisualFrame => {
        const frame: VisualFrame = {
            stepNumber: step,
            entities: snapshot(),
            edges: [],
            description,
            codeLineNumber: codeLine,
            layout: "array",
            meta,
        };
        step += 1;
        return frame;
    };

    yield emit(
        `Empty real-time queue with a front list, a rear list, and a rotation schedule.`,
        0,
        { front: [], rear: [], schedule, rotations },
    );

    for (let i = 0; i < commands.length; i += 1) {
        const command = commands[i];
        if (command?.op === "enqueue") {
            rear.unshift(command.value);
            schedule += 1;
            yield emit(
                `Enqueued ${command.value} into the rear; the schedule now expects ${schedule} front item(s).`,
                2,
                { front: [...front], rear: [...rear], schedule, rotations, op: "enqueue" },
            );
        } else {
            if (front.length === 0 && rear.length > 0) {
                front = rear.slice().reverse();
                rear = [];
                schedule = front.length;
                rotations += 1;
                yield emit(
                    `Scheduled rotation moved ${front.length} rear item(s) into the new front.`,
                    4,
                    { front: [...front], rear: [...rear], schedule, rotations, op: "rotate" },
                );
            }
            if (front.length === 0) {
                yield emit("Dequeue on an empty queue returns nothing.", 3, {
                    front: [],
                    rear: [...rear],
                    schedule,
                    rotations,
                    op: "empty-dequeue",
                });
                continue;
            }
            const value = front.shift() as number;
            emitted.push(value);
            schedule = Math.max(0, schedule - 1);
            yield emit(
                `Dequeued ${value} from the front; ${schedule} scheduled item(s) remain.`,
                3,
                { front: [...front], rear: [...rear], schedule, rotations, op: "dequeue", value },
            );
        }
    }

    yield emit(
        `Done: dequeued ${emitted.length} value(s) in first-in-first-out order: ${emitted.join(", ")}.`,
        6,
        { front: [...front], rear: [...rear], schedule, rotations, output: emitted },
    );
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Think of a checkout line with a serving counter and a waiting room. Customers at the counter (the front) are served immediately; new arrivals wait in the back (the rear). Rather than stop everyone to reshuffle the room into the counter line, the queue schedules the reshuffle a little at a time across earlier operations, so no single step is slow.",
        invariants: [
            "The logical queue contents equal the front list followed by the reverse of the rear list.",
            "The schedule counts the front items still available before another rotation is required.",
            "Enqueue never touches the front list; dequeue never inserts into the rear list.",
        ],
        correctness:
            "Enqueue appends to the logical tail by prepending into the rear, which reverses back when rotated. Dequeue removes the head of the front; when the front is exhausted, reversing the rear produces exactly the items that were enqueued after the current front, in their original order. Therefore the full dequeued sequence equals the enqueue sequence in first-in-first-out order.",
        complexityRationale:
            "Enqueue is a constant-time prepend and dequeue is a constant-time removal. A rotation reverses at most n items but occurs only after n preceding operations, so each item is moved a constant number of times, giving O(1) amortized time and O(n) space.",
        uses: [
            "Breadth-first search worklists needing steady per-step cost",
            "Printer and message queues with predictable latency",
            "Streaming pipelines where a long rebuild would cause a stall",
        ],
        references: [
            "C. Okasaki, Simple and Efficient Purely Functional Queues and Deques, Journal of Functional Programming, 1995",
            "C. Okasaki, Purely Functional Data Structures, Chapter 8",
        ],
        workedExample:
            "Enqueue 5, 3, 9 so the rear holds [9, 3, 5] with schedule 3 and an empty front. The first dequeue rotates the rear into front [5, 3, 9] and returns 5. Enqueue 7 into rear [7]. The next two dequeues return 3 and 9, and the final dequeue rotates 7 into the front and returns it, giving [5, 3, 9, 7].",
    },
    id: "okasaki-real-time-queue",
    name: "Real-Time Queue",
    category: "data-structures",
    complexity: { time: "O(1) amortized", space: "O(n)" },
    defaultInput: {
        commands: [
            { op: "enqueue", value: 5 },
            { op: "enqueue", value: 3 },
            { op: "enqueue", value: 9 },
            { op: "dequeue" },
            { op: "enqueue", value: 7 },
            { op: "dequeue" },
            { op: "dequeue" },
        ],
    },
    visualType: "array",
    run,
    pseudocode: [
        "initialize front, rear, and schedule as empty",
        "on enqueue prepend the value to rear and increment the schedule",
        "on dequeue if front is empty then rotate the reversed rear into front",
        "remove and return the front element and decrement the schedule",
        "a rotation resets the schedule to the new front length",
        "on an empty dequeue report no value",
        "done: the dequeued values follow the enqueue order",
    ],
};

export default module;
