/**
 * monotonic-stack.ts – Monotonic Stack (next smaller element)
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * A monotonic stack keeps its elements in sorted order by popping everything
 * that is "beaten" by the incoming element. It is the standard tool for
 * "next greater/smaller element" problems. As we scan left to right, each
 * element pops all larger elements from the stack; when an element is popped,
 * the incoming element is its next smaller element.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(n) – each element pushed/popped once
 *   Space: O(n)
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - The stack contents are highlighted.
 *   - The incoming element is YELLOW (comparing).
 *   - Popped elements are RED (swapped).
 *
 * ---------------------------------------------------------------------------
 * Properties
 * ---------------------------------------------------------------------------
 *   - "Next greater/smaller" is the canonical application.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

/**
 * Build a row of cells for the values.
 *
 * @param values The array values.
 * @param states Optional index → state overrides.
 * @returns Cell entities in a single row.
 */
function makeCells(values: number[], states: Map<number, EntityState> = new Map()): VisualEntity[] {
    return values.map((value, index) => ({
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
 * The Monotonic Stack generator.
 *
 * @param input `{ values }`.
 */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { values?: number[] } | null) ?? {};
    const values = task.values ?? [4, 5, 2, 10, 8];

    let step = 0;
    const stack: number[] = [];

    // Frame 0: the array.
    yield {
        stepNumber: step,
        entities: makeCells(values),
        edges: [],
        description: "Monotonic stack – finding the next smaller element for each value.",
        codeLineNumber: 0,
        layout: "grid",
        meta: {},
    };
    step += 1;

    for (let i = 0; i < values.length; i += 1) {
        // Pop while the stack top is larger than the incoming value.
        while (stack.length > 0 && (values[stack[stack.length - 1] ?? 0] ?? 0) > (values[i] ?? 0)) {
            const popped = stack.pop();
            const states = new Map<number, EntityState>([
                [popped ?? 0, "swapped"],
                [i, "comparing"],
            ]);
            yield {
                stepNumber: step,
                entities: makeCells(values, states),
                edges: [],
                description: `Popped ${values[popped ?? 0]} – its next smaller element is ${values[i]}.`,
                codeLineNumber: 2,
                layout: "grid",
                meta: { stack: [...stack] },
            };
            step += 1;
        }

        stack.push(i);

        const states = new Map<number, EntityState>([[i, "comparing"]]);
        for (const idx of stack) {
            states.set(idx, "highlight");
        }
        yield {
            stepNumber: step,
            entities: makeCells(values, states),
            edges: [],
            description: `Pushed index ${i}. Stack: [${stack.join(", ")}].`,
            codeLineNumber: 3,
            layout: "grid",
            meta: { stack: [...stack] },
        };
        step += 1;
    }

    yield {
        stepNumber: step,
        entities: makeCells(values),
        edges: [],
        description: "Monotonic stack processed all elements in O(n).",
        codeLineNumber: 4,
        layout: "grid",
        meta: {},
    };
}

/** The Monotonic Stack module, registered with the engine. */
const module: AlgorithmModule = {
    id: "monotonic-stack",
    name: "Monotonic Stack",
    category: "data-structures",
    complexity: { time: "O(n)", space: "O(n)" },
    defaultInput: { values: [4, 5, 2, 10, 8] },
    visualType: "grid",
    run,
};

export default module;
