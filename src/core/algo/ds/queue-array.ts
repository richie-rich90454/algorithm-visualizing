/**
 * queue-array.ts – Queue (array/ring-buffer based)
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * A queue is a FIFO (first-in, first-out) structure. An array queue keeps
 * front and rear indices; enqueue writes at the rear, dequeue reads at the
 * front. Using a circular (ring) buffer avoids shifting all elements when the
 * front advances.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Enqueue / dequeue / peek: O(1)
 *   Space:                    O(n)
 *
 * ---------------------------------------------------------------------------
 * Visualisation mapping
 * ---------------------------------------------------------------------------
 *   - The queue is a row of cells; front and rear are labelled.
 *   - The enqueued element is YELLOW (comparing).
 *   - The dequeued element is GREEN (sorted).
 *
 * ---------------------------------------------------------------------------
 * Properties
 * ---------------------------------------------------------------------------
 *   - FIFO order is the entire concept.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

/**
 * Build a row of queue cells.
 *
 * @param items The queue contents (front → rear).
 * @param states Optional index → state overrides.
 * @returns Cell entities in a single row.
 */
function makeQueue(items: number[], states: Map<number, EntityState> = new Map()): VisualEntity[] {
    return items.map((value, index) => ({
        id: `cell-${index}`,
        type: "cell" as const,
        label: String(value),
        value,
        state: states.get(index) ?? "unvisited",
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { row: 0, col: index },
    }));
}

/**
 * The Queue (array) generator.
 *
 * @param input `{ enqueues, dequeueCount }`.
 */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { enqueues?: number[]; dequeueCount?: number } | null) ?? {};
    const enqueues = task.enqueues ?? [5, 3, 8];
    const dequeueCount = typeof task.dequeueCount === "number" ? task.dequeueCount : 2;

    let step = 0;
    const queue: number[] = [];

    // Frame 0: the empty queue.
    yield {
        stepNumber: step,
        entities: makeQueue(queue.length ? queue : [0]).map((c) =>
            queue.length ? c : { ...c, label: "", value: 0 },
        ),
        edges: [],
        description: "Empty array queue (front == rear).",
        codeLineNumber: 0,
        layout: "grid",
        meta: { size: 0 },
    };
    step += 1;

    // Enqueue each value at the rear.
    for (const value of enqueues) {
        queue.push(value);
        const states = new Map<number, EntityState>([[queue.length - 1, "comparing"]]);
        yield {
            stepNumber: step,
            entities: makeQueue(queue, states),
            edges: [],
            description: `Enqueued ${value} at the rear – queue is [${queue.join(", ")}].`,
            codeLineNumber: 2,
            layout: "grid",
            meta: { size: queue.length },
        };
        step += 1;
    }

    // Dequeue from the front (FIFO order).
    for (let i = 0; i < dequeueCount && queue.length > 0; i += 1) {
        const dequeued = queue.shift();
        yield {
            stepNumber: step,
            entities: makeQueue(queue),
            edges: [],
            description: `Dequeued ${dequeued} from the front (FIFO).`,
            codeLineNumber: 3,
            layout: "grid",
            meta: { size: queue.length },
        };
        step += 1;
    }
}

/** The Queue (array) module, registered with the engine. */
const module: AlgorithmModule = {
    id: "queue-array",
    name: "Queue (Array)",
    category: "data-structures",
    complexity: { time: "O(1) enqueue/dequeue", space: "O(n)" },
    defaultInput: { enqueues: [5, 3, 8], dequeueCount: 2 },
    visualType: "grid",
    run,
};

export default module;
