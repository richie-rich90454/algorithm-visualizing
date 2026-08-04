/**
 * cyclic-buffer.ts â€?Cyclic Buffer (ring buffer)
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * A cyclic (ring) buffer is a fixed-size array where the read and write
 * positions wrap around to the front. Writing past the end reuses the freed
 * slots, so it never needs to shift elements. It is the standard structure
 * for FIFO streaming (audio buffers, communication queues) because it offers
 * O(1) enqueue/dequeue with no memory allocation.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Enqueue / dequeue: O(1)
 *   Space:             O(capacity)
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - The circular storage is shown as a ring of cells.
 *   - The write pointer is YELLOW (comparing); the read pointer GREEN (sorted).
 *
 * ---------------------------------------------------------------------------
 * Properties
 * ---------------------------------------------------------------------------
 *   - The wrap-around modulo arithmetic is the entire concept.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

/**
 * The Cyclic Buffer generator.
 *
 * @param input `{ capacity, writes }` â€?buffer capacity and values to write.
 */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { capacity?: number; writes?: number[] } | null) ?? {};
    const capacity = typeof task.capacity === "number" ? task.capacity : 5;
    const writes = task.writes ?? [1, 2, 3, 4, 5, 6, 7];

    let step = 0;
    let head = 0; // write position
    let count = 0;
    const buffer = new Array<number | undefined>(capacity).fill(undefined);

    const makeCells = (highlightWrite = -1, highlightRead = -1): VisualEntity[] =>
        buffer.map((value, index) => ({
            id: `cell-${index}`,
            type: "cell" as const,
            label: value === undefined ? "" : String(value),
            value: value ?? 0,
            state: (index === highlightWrite
                ? "comparing"
                : index === highlightRead
                  ? "sorted"
                  : "unvisited") as EntityState,
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: { row: 0, col: index },
        }));

    // Frame 0: the empty ring.
    yield {
        stepNumber: step,
        entities: makeCells(),
        edges: [],
        description: `Cyclic buffer of capacity ${capacity}.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: { capacity, count },
    };
    step += 1;

    for (const value of writes) {
        buffer[head] = value;
        head = (head + 1) % capacity;
        count = Math.min(count + 1, capacity);

        // The read pointer is the oldest element: head - count (wrapped).
        const read = (head - count + capacity * 2) % capacity;

        yield {
            stepNumber: step,
            entities: makeCells((head - 1 + capacity) % capacity, read),
            edges: [],
            description: `Wrote ${value} at slot ${(head - 1 + capacity) % capacity} â€?head wraps to ${head}.`,
            codeLineNumber: 2,
            layout: "grid",
            meta: { capacity, count, head },
        };
        step += 1;
    }

    yield {
        stepNumber: step,
        entities: makeCells(),
        edges: [],
        description: "Cyclic buffer wrapped around without shifting a single element.",
        codeLineNumber: 3,
        layout: "grid",
        meta: { capacity, count },
    };
}

/** The Cyclic Buffer module, registered with the engine. */
const module: AlgorithmModule = {
    id: "cyclic-buffer",
    name: "Cyclic Buffer",
    category: "data-structures",
    complexity: { time: "O(1) ops", space: "O(capacity)" },
    defaultInput: { capacity: 5, writes: [1, 2, 3, 4, 5, 6, 7] },
    visualType: "grid",
    run,
};

export default module;
