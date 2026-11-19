/**
 * queap.ts - Queap (Queue with Efficient Minimum)
 *
 * A queap supports FIFO enqueue and dequeue plus find-min in amortized O(1).
 * This implementation keeps two min-stacks: the front stack holds the older
 * half ready for dequeues and the rear stack holds newer values. Each stack
 * caches its running minimum, so the global minimum is the smaller of the two
 * cached minima. When the front empties, the rear is reversed in O(n) and the
 * cost is amortized over the enqueues since the last reversal.
 *
 * Time:  O(1) enqueue, find-min; amortized O(1) dequeue
 * Space: O(n)
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface Entry {
    value: number;
    min: number;
}

type Op = ["enqueue", number] | ["dequeue"] | ["min"];

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { ops?: Op[] } | null) ?? {};
    const ops: Op[] = task.ops ?? [
        ["enqueue", 5],
        ["enqueue", 2],
        ["min"],
        ["enqueue", 3],
        ["dequeue"],
        ["min"],
    ];

    let front: Entry[] = [];
    let rear: Entry[] = [];
    let step = 0;
    const minima: number[] = [];

    const logical = (): number[] => [
        ...front.slice().reverse().map((e) => e.value),
        ...rear.map((e) => e.value),
    ];
    const minOf = (stack: Entry[]): number => (stack.length ? stack[stack.length - 1]!.min : Number.POSITIVE_INFINITY);

    const frame = (message: string, line: number, hot: number): VisualFrame => {
        const data = logical();
        const entities: VisualEntity[] = data.map((value, i) => ({
            id: `q-${i}`,
            type: "bar" as const,
            label: String(value),
            value,
            state: (i === hot ? "comparing" : i === 0 ? "path" : "idle") as EntityState,
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: { index: i, stack: i < front.length ? "front" : "rear" },
        }));
        return {
            stepNumber: step,
            entities,
            edges: [],
            description: message,
            codeLineNumber: line,
            layout: "array",
            meta: {
                queue: data,
                minima: minima.slice(),
                frontMin: front.length ? minOf(front) : -1,
                rearMin: rear.length ? minOf(rear) : -1,
                frontSize: front.length,
                rearSize: rear.length,
            },
        };
    };

    yield frame("Empty queap with a front stack and a rear stack.", 0, -1);
    step += 1;

    for (const op of ops) {
        if (op[0] === "enqueue") {
            const m = Math.min(op[1], minOf(rear));
            rear.push({ value: op[1], min: m });
            yield frame(`enqueue(${op[1]}) pushes onto the rear with cached min ${m}.`, 1, logical().length - 1);
        } else if (op[0] === "dequeue") {
            if (front.length === 0) {
                const rebuilt: Entry[] = [];
                for (const e of rear.slice().reverse()) {
                    rebuilt.push({ value: e.value, min: Math.min(e.value, rebuilt[rebuilt.length - 1]?.min ?? Number.POSITIVE_INFINITY) });
                }
                front = rebuilt;
                rear = [];
                yield frame("Front empty: reverse the rear stack to rebuild the front.", 2, -1);
                step += 1;
            }
            const removed = front.pop();
            yield frame(`dequeue() removes ${removed?.value ?? "nothing"} from the front.`, 3, -1);
        } else {
            const m = Math.min(minOf(front), minOf(rear));
            minima.push(m);
            yield frame(`min() compares both cached minima and returns ${m}.`, 4, -1);
        }
        step += 1;
    }

    yield frame(`Final queap holds [${logical().join(", ")}].`, 5, -1);
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "A queap is a queue that also tells you its smallest element quickly. Keep two stacks, each remembering the minimum of everything in it. The older stack answers dequeues while the newer stack accepts pushes; the overall minimum is just the smaller of the two cached minima, and an occasional reversal refills the older stack.",
        invariants: [
            "The front stack holds a prefix of the FIFO order with its oldest value on top.",
            "Each stack entry caches the minimum from that entry down to the stack bottom.",
            "The global minimum is the smaller of the two stack minima.",
        ],
        correctness:
            "Dequeues always remove the top of the front stack, which is the oldest queued value, so FIFO order holds. Reversing the rear into the front preserves that order because the newest rear value sits on top and becomes the deepest front value. Each cached minimum is the true minimum of its stack by induction, so the smaller of the two is the minimum of the whole queap.",
        complexityRationale:
            "Enqueue is one push with a constant-time minimum update. Find-min compares two cached values. A reversal costs O(n) but happens only after at least n enqueues, so dequeue is O(1) amortized and total space is O(n).",
        uses: [
            "Event simulators needing the soonest timestamp",
            "Sliding-window minimum monitors",
            "Priority-aware job queues",
        ],
        references: [
            "Brodal, Lagogiannis, and Tarjan, the queap structure",
            "Okasaki, Purely Functional Data Structures, Chapter 8",
        ],
        workedExample:
            "Enqueue 5 then 2 makes the rear stack store values 5,2 with cached minimum 2, so min() returns 2. Enqueue 3 keeps the minimum 2. A dequeue with an empty front reverses the rear into front as 2,5,3 with the oldest value 2 on top, removes 2, and a following min() returns 3.",
    },
    id: "queap",
    name: "Queap",
    category: "data-structures",
    complexity: { time: "O(1) amortized", space: "O(n)" },
    defaultInput: {
        ops: [["enqueue", 5], ["enqueue", 2], ["min"], ["enqueue", 3], ["dequeue"], ["min"]],
    },
    visualType: "array",
    run,
    pseudocode: [
        "initialize empty front and rear min-stacks",
        "enqueue: push value on rear with cached minimum",
        "when front is empty reverse rear into front",
        "dequeue: pop the oldest value from front",
        "find-min: take smaller of the two cached minima",
        "rebuild cached minima during each reversal",
        "done: report remaining queue and minimum queries",
    ],
};

export default module;
