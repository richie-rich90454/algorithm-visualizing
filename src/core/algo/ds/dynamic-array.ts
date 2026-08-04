/**
 * dynamic-array.ts – Dynamic Array (amortized vector)
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * A dynamic array (a.k.a. vector / ArrayList) is a resizable array. It keeps
 * a larger backing buffer than its logical size and grows it geometrically
 * (usually doubling) whenever appending would overflow. Doubling makes the
 * amortized cost of appends O(1), because the expensive copies are spread
 * across many cheap appends.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Append:    O(1) amortized (O(n) worst when resizing)
 *   Access:    O(1)
 *   Insert at arbitrary position: O(n)
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - The backing buffer is shown with used cells marked.
 *   - The appended element is YELLOW (comparing).
 *   - A resize (doubling) event is narrated prominently.
 *
 * ---------------------------------------------------------------------------
 * Properties
 * ---------------------------------------------------------------------------
 *   - The amortized-analysis argument is the key teaching point.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

/**
 * Build cells showing the backing buffer.
 *
 * @param buffer The backing buffer (undefined = unused capacity).
 * @param used The logical size.
 * @param states Optional index → state overrides.
 * @returns Cell entities in a single row.
 */
function makeCells(
    buffer: Array<number | undefined>,
    used: number,
    states: Map<number, EntityState> = new Map(),
): VisualEntity[] {
    return buffer.map((value, index) => ({
        id: `cell-${index}`,
        type: "cell" as const,
        label: value === undefined ? "" : String(value),
        value: value ?? 0,
        state: states.get(index) ?? (index < used ? "sorted" : "unvisited"),
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { row: 0, col: index },
    }));
}

/**
 * The Dynamic Array generator.
 *
 * @param input `{ appends }` – the values to append.
 */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { appends?: number[] } | null) ?? {};
    const appends = task.appends ?? [1, 2, 3, 4, 5, 6, 7];

    let step = 0;
    let capacity = 2;
    const buffer: Array<number | undefined> = [undefined, undefined];
    let used = 0;

    // Frame 0: the empty backing buffer.
    yield {
        stepNumber: step,
        entities: makeCells(buffer, used),
        edges: [],
        description: `Dynamic array with initial capacity ${capacity}.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: { capacity, used },
    };
    step += 1;

    // Append each value.
    for (const value of appends) {
        // Resize when full.
        if (used === capacity) {
            const oldCapacity = capacity;
            capacity *= 2;
            const newBuffer: Array<number | undefined> = new Array(capacity).fill(undefined);
            for (let i = 0; i < used; i += 1) {
                newBuffer[i] = buffer[i];
            }
            buffer.length = 0;
            buffer.push(...newBuffer);

            yield {
                stepNumber: step,
                entities: makeCells(buffer, used),
                edges: [],
                description: `Full! Doubling capacity from ${oldCapacity} to ${capacity} (copying ${used} elements).`,
                codeLineNumber: 2,
                layout: "grid",
                meta: { capacity, used },
            };
            step += 1;
        }

        // Append the value.
        buffer[used] = value;
        used += 1;

        const states = new Map<number, EntityState>([[used - 1, "comparing"]]);
        yield {
            stepNumber: step,
            entities: makeCells(buffer, used, states),
            edges: [],
            description: `Appended ${value} – size ${used}, capacity ${capacity}.`,
            codeLineNumber: 3,
            layout: "grid",
            meta: { capacity, used },
        };
        step += 1;
    }

    yield {
        stepNumber: step,
        entities: makeCells(buffer, used),
        edges: [],
        description: `Final: ${used} elements in a capacity-${capacity} buffer.`,
        codeLineNumber: 4,
        layout: "grid",
        meta: { capacity, used },
    };
}

/** The Dynamic Array module, registered with the engine. */
const module: AlgorithmModule = {
    id: "dynamic-array",
    name: "Dynamic Array",
    category: "data-structures",
    complexity: { time: "O(1) amortized append", space: "O(n)" },
    // 7 appends force two doublings (2→4→8).
    defaultInput: { appends: [1, 2, 3, 4, 5, 6, 7] },
    visualType: "grid",
    run,
};

export default module;
