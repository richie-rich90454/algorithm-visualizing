/**
 * cyclic-buffer.ts – Cyclic Buffer (ring buffer)
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
 * @param input `{ capacity, writes }` – buffer capacity and values to write.
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
            description: `Wrote ${value} at slot ${(head - 1 + capacity) % capacity} – head wraps to ${head}.`,
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
        codeLineNumber: 6,
        layout: "grid",
        meta: { capacity, count },
    };
}

/** The Cyclic Buffer module, registered with the engine. */
const module: AlgorithmModule = {

    education: {
        "intuition": "A cyclic buffer, or ring buffer, is a fixed-size array whose read and write positions wrap around modulo the capacity. Writing past the end reuses slots that have been read, so elements never shift. This gives O(1) enqueue and dequeue with no allocation, making it the standard FIFO for streams.",
        "invariants": [
            "head points to the oldest unread element and tail to the next write slot.",
            "Indices are taken modulo capacity.",
            "A count or reserved slot distinguishes full from empty."
        ],
        "correctness": "Writing at tail and advancing modulo capacity overwrites only freed slots, so live FIFO data is preserved. Reading at head and advancing returns elements in insertion order. Distinguishing full from empty by a count or reserved slot guarantees correct state reporting.",
        "complexityRationale": "Both ends are updated by one index increment and a modulo, O(1) time. The backing array is fixed at capacity slots, O(capacity) space, with no per-element allocation.",
        "uses": [
            "Audio and video streaming buffers",
            "Kernel pipes and serial I/O queues",
            "Lock-free producer-consumer rings"
        ],
        "references": [
            "Robert Sedgewick and Kevin Wayne, Algorithms, Section 1.3 queue exercises",
            "Donald Knuth, The Art of Computer Programming, Vol. 1, Section 2.2"
        ],
        "workedExample": "With capacity 5 and writes 1 through 7, slots fill then wrap: after 1,2,3,4,5, writing 6 uses slot 0 and 7 uses slot 1 once those are freed. After dequeuing 1 and 2, head advances to slot 2; tail wraps to the same slot when the ring is empty again, illustrating the modulo arithmetic."
    },
    id: "cyclic-buffer",
    name: "Cyclic Buffer",
    category: "data-structures",
    complexity: { time: "O(1) ops", space: "O(capacity)" },
    defaultInput: { capacity: 5, writes: [1, 2, 3, 4, 5, 6, 7] },
    visualType: "grid",
    run,
    pseudocode: [
        "initialize ring buffer with fixed capacity and head at 0",
        "write value at tail and advance tail modulo capacity",
        "compare tail against head to detect full buffer",
        "read value from head and advance head modulo capacity",
        "wrap indices around end back to start",
        "count stored items from head to tail distance",
        "done: ring holds values in FIFO order with head and tail",
    ],
};

export default module;
