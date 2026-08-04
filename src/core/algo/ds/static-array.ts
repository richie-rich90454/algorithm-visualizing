/**
 * static-array.ts – Static Array
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * A static array is a fixed-size, contiguous block of memory. Its defining
 * property is O(1) random access: any element can be read or written directly
 * by index because the layout is contiguous and the base address is known.
 * The cost is that the size is fixed at allocation time – you cannot grow or
 * shrink it.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Access: O(1)   Lookup by index: O(1)
 *   Insert/delete at arbitrary position: O(n) (elements must shift)
 *   Append to a full array: impossible (fixed size)
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - The array is shown as a row of cells.
 *   - The accessed element is YELLOW (comparing).
 *   - Written elements are GREEN (sorted).
 *
 * ---------------------------------------------------------------------------
 * Properties
 * ---------------------------------------------------------------------------
 *   - The foundation on which nearly every other structure is built.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";
import { makeArrayCells } from "./ds-util";

/**
 * The Static Array generator.
 *
 * @param input `{ values }` – the array contents.
 */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { values?: number[] } | null) ?? {};
    const values = task.values ?? [5, 3, 8, 1, 9];

    let step = 0;

    // Frame 0: the array.
    yield {
        stepNumber: step,
        entities: makeArrayCells(values),
        edges: [],
        description: `Static array of size ${values.length} – O(1) random access.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: { size: values.length },
    };
    step += 1;

    // Access elements in order to show O(1) indexing.
    for (let i = 0; i < values.length; i += 1) {
        const states = new Map<number, EntityState>([[i, "comparing"]]);
        yield {
            stepNumber: step,
            entities: makeArrayCells(values, states),
            edges: [],
            description: `Access arr[${i}] = ${values[i]} in O(1).`,
            codeLineNumber: 2,
            layout: "grid",
            meta: { size: values.length },
        };
        step += 1;
    }

    // Show a write operation.
    const written = [...values];
    written[2] = 42;
    const writeStates = new Map<number, EntityState>([[2, "sorted"]]);
    yield {
        stepNumber: step,
        entities: makeArrayCells(written, writeStates),
        edges: [],
        description: `Write arr[2] = 42 in O(1).`,
        codeLineNumber: 3,
        layout: "grid",
        meta: { size: values.length },
    };
}

/** The Static Array module, registered with the engine. */
const module: AlgorithmModule = {
    id: "static-array",
    name: "Static Array",
    category: "data-structures",
    complexity: { time: "O(1) access", space: "O(n)" },
    defaultInput: { values: [5, 3, 8, 1, 9] },
    visualType: "grid",
    run,
};

export default module;
