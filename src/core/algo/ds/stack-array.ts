/**
 * stack-array.ts – Stack (array-based)
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * A stack is a LIFO (last-in, first-out) structure supporting push, pop, and
 * peek. An array-based stack keeps a `top` index pointing at the next free
 * slot; push writes at `top` then increments, pop decrements then reads. All
 * operations touch only the top, so they are O(1).
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Push / pop / peek: O(1)
 *   Space:             O(n)
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - The stack is a column of cells growing upward.
 *   - The pushed element is YELLOW (comparing).
 *   - The popped element is GREEN (sorted) then removed.
 *
 * ---------------------------------------------------------------------------
 * Properties
 * ---------------------------------------------------------------------------
 *   - LIFO order is the entire concept.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

/**
 * Build a column of stack cells.
 *
 * @param items The stack contents (bottom → top).
 * @param states Optional index → state overrides.
 * @returns Cell entities in a single column (row = position).
 */
function makeStack(items: number[], states: Map<number, EntityState> = new Map()): VisualEntity[] {
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
        metadata: { row: index, col: 0 },
    }));
}

/**
 * The Stack (array) generator.
 *
 * @param input `{ pushes, popCount }`.
 */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { pushes?: number[]; popCount?: number } | null) ?? {};
    const pushes = task.pushes ?? [5, 3, 8];
    const popCount = typeof task.popCount === "number" ? task.popCount : 2;

    let step = 0;
    const stack: number[] = [];

    // Frame 0: the empty stack (shown with one placeholder slot).
    yield {
        stepNumber: step,
        entities: makeStack(stack.length ? stack : [0]).map((c) =>
            stack.length ? c : { ...c, label: "", value: 0 },
        ),
        edges: [],
        description: "Empty array-based stack (top at index 0).",
        codeLineNumber: 0,
        layout: "grid",
        meta: { size: 0 },
    };
    step += 1;

    // Push each value.
    for (const value of pushes) {
        stack.push(value);
        const states = new Map<number, EntityState>([[stack.length - 1, "comparing"]]);
        yield {
            stepNumber: step,
            entities: makeStack(stack, states),
            edges: [],
            description: `Pushed ${value} – stack is now [${stack.join(", ")}].`,
            codeLineNumber: 2,
            layout: "grid",
            meta: { size: stack.length },
        };
        step += 1;
    }

    // Pop some values (LIFO order).
    for (let i = 0; i < popCount && stack.length > 0; i += 1) {
        const popped = stack.pop();
        const states = new Map<number, EntityState>([[stack.length, "sorted"]]);
        yield {
            stepNumber: step,
            entities: makeStack([...stack, popped ?? 0], states),
            edges: [],
            description: `Popped ${popped} (LIFO – the most recently pushed).`,
            codeLineNumber: 3,
            layout: "grid",
            meta: { size: stack.length },
        };
        step += 1;

        yield {
            stepNumber: step,
            entities: makeStack(stack),
            edges: [],
            description: `Stack is now [${stack.join(", ")}].`,
            codeLineNumber: 4,
            layout: "grid",
            meta: { size: stack.length },
        };
        step += 1;
    }
}

/** The Stack (array) module, registered with the engine. */
const module: AlgorithmModule = {
    id: "stack-array",
    name: "Stack (Array)",
    category: "data-structures",
    complexity: { time: "O(1) push/pop", space: "O(n)" },
    defaultInput: { pushes: [5, 3, 8], popCount: 2 },
    visualType: "grid",
    run,
};

export default module;
