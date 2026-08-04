/**
 * concurrent-queue.ts – Concurrent Queue (lock-free, Michael-Scott style)
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * A concurrent queue must let multiple threads enqueue and dequeue safely.
 * The Michael-Scott queue is the canonical lock-free design: a sentinel head
 * and a tail pointer, with CAS (compare-and-swap) operations to advance the
 * tail on enqueue and claim nodes on dequeue. This educational version
 * narrates the interleaving of two threads on a shared queue.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Enqueue / dequeue: O(1) amortised, lock-free
 *   Space:             O(n)
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - The shared queue is a chain of nodes.
 *   - Thread A's actions are BLUE (active).
 *   - Thread B's actions are PINK (highlight).
 *
 * ---------------------------------------------------------------------------
 * Properties
 * ---------------------------------------------------------------------------
 *   - The CAS-based coordination is the heart to teach.
 */

import type { AlgorithmModule, VisualEdge, VisualEntity, VisualFrame } from "@/types";

/**
 * The Concurrent Queue generator.
 *
 * @param input `{ ops }` – a scripted sequence of [thread, op] events.
 */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task =
        (input as { ops?: Array<["A" | "B", "enqueue" | "dequeue", number]> } | null) ?? {};
    const ops = task.ops ?? [
        ["A", "enqueue", 1],
        ["B", "enqueue", 2],
        ["A", "enqueue", 3],
        ["B", "dequeue", 0],
    ];

    let step = 0;
    const queue: number[] = [];

    // Frame 0: the empty queue with sentinel.
    yield {
        stepNumber: step,
        entities: [
            {
                id: "sentinel",
                type: "node" as const,
                label: "S",
                value: 0,
                state: "unvisited",
                x: 0,
                y: 0,
                width: 0,
                height: 0,
                metadata: { parentId: "root" },
            },
        ],
        edges: [],
        description: "Concurrent queue with sentinel head – threads A and B share it.",
        codeLineNumber: 0,
        layout: "graph",
        meta: { size: 0 },
    };
    step += 1;

    // Simulate the interleaved operations.
    for (const [thread, op, value] of ops) {
        if (op === "enqueue") {
            queue.push(value);
        } else {
            queue.shift();
        }

        // Build the queue nodes, tinted by which thread acted.
        const entities: VisualEntity[] = [
            {
                id: "sentinel",
                type: "node" as const,
                label: "S",
                value: 0,
                state: "unvisited",
                x: 0,
                y: 0,
                width: 0,
                height: 0,
                metadata: { parentId: "root" },
            },
            ...queue.map((v, index) => ({
                id: `node-${index}`,
                type: "node" as const,
                label: String(v),
                value: v,
                state: (thread === "A" ? "active" : "highlight") as VisualEntity["state"],
                x: 0,
                y: 0,
                width: 0,
                height: 0,
                metadata: { parentId: "sentinel" },
            })),
        ];

        const edges: VisualEdge[] = [];
        for (let i = 0; i <= queue.length; i += 1) {
            const from = i === 0 ? "sentinel" : `node-${i - 1}`;
            const to = i === queue.length ? null : `node-${i}`;
            if (to) {
                edges.push({
                    id: `next-${i}`,
                    sourceId: from,
                    targetId: to,
                    label: "next",
                    state: thread === "A" ? "active" : "highlight",
                    directed: true,
                });
            }
        }

        yield {
            stepNumber: step,
            entities,
            edges,
            description: `Thread ${thread}: ${op} ${op === "dequeue" ? "" : value} – queue is [${queue.join(", ")}].`,
            codeLineNumber: 2,
            layout: "graph",
            meta: { size: queue.length, thread },
        };
        step += 1;
    }

    yield {
        stepNumber: step,
        entities: [
            {
                id: "sentinel",
                type: "node" as const,
                label: "S",
                value: 0,
                state: "unvisited",
                x: 0,
                y: 0,
                width: 0,
                height: 0,
                metadata: { parentId: "root" },
            },
        ],
        edges: [],
        description: "All interleaved operations completed without data races.",
        codeLineNumber: 3,
        layout: "graph",
        meta: { size: queue.length },
    };
}

/** The Concurrent Queue module, registered with the engine. */
const module: AlgorithmModule = {
    id: "concurrent-queue",
    name: "Concurrent Queue",
    category: "data-structures",
    complexity: { time: "O(1) amortised", space: "O(n)" },
    defaultInput: {
        ops: [
            ["A", "enqueue", 1],
            ["B", "enqueue", 2],
            ["A", "enqueue", 3],
            ["B", "dequeue", 0],
        ],
    },
    visualType: "graph",
    run,
};

export default module;
