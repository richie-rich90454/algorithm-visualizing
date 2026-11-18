/**
 * min-stack.ts – Min Stack (O(1) getMin)
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * A min stack supports the usual push/pop plus getMin() in O(1). It keeps a
 * parallel "min" stack: whenever a value is pushed, the min stack records
 * min(current value, current top of min stack). The top of the min stack is
 * always the current stack minimum, so getMin is a single read.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   All operations: O(1)
 *   Space:          O(n) – the auxiliary min stack
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - The main stack is one row; the min stack is a second row.
 *   - The pushed value is YELLOW (comparing).
 *   - The current minimum is GREEN (sorted).
 *
 * ---------------------------------------------------------------------------
 * Properties
 * ---------------------------------------------------------------------------
 *   - "Trade space for O(1) queries" is the entire point.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

/**
 * Build a two-row grid: main stack and min stack.
 *
 * @param stack The main stack.
 * @param mins The min stack.
 * @param highlight Index in the main stack to highlight.
 * @returns Cell entities with row/col metadata.
 */
function makeGrid(stack: number[], mins: number[], highlight = -1): VisualEntity[] {
    const cells: VisualEntity[] = [];
    stack.forEach((value, index) => {
        cells.push({
            id: `s-${index}`,
            type: "cell" as const,
            label: String(value),
            value,
            state: (index === highlight ? "comparing" : "unvisited") as EntityState,
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: { row: 0, col: index },
        });
    });
    mins.forEach((value, index) => {
        cells.push({
            id: `m-${index}`,
            type: "cell" as const,
            label: String(value),
            value,
            state: index === mins.length - 1 ? ("sorted" as EntityState) : "unvisited",
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: { row: 1, col: index },
        });
    });
    return cells;
}

/**
 * The Min Stack generator.
 *
 * @param input `{ pushes }`.
 */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { pushes?: number[] } | null) ?? {};
    const pushes = task.pushes ?? [5, 3, 8, 2];

    let step = 0;
    const stack: number[] = [];
    const mins: number[] = [];

    // Frame 0: both stacks empty.
    yield {
        stepNumber: step,
        entities: [
            { id: "s-0", row: 0, label: "" },
            { id: "m-0", row: 1, label: "" },
        ].map((p) => ({
            id: p.id,
            type: "cell" as const,
            label: p.label,
            value: 0,
            state: "unvisited",
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: { row: p.row, col: 0 },
        })),
        edges: [],
        description: "Empty min stack (bottom row = stack, top row = running minimum).",
        codeLineNumber: 0,
        layout: "grid",
        meta: { operations: step },
    };
    step += 1;

    for (const value of pushes) {
        stack.push(value);
        const newMin = Math.min(value, mins.length > 0 ? (mins[mins.length - 1] ?? value) : value);
        mins.push(newMin);

        yield {
            stepNumber: step,
            entities: makeGrid(stack, mins, stack.length - 1),
            edges: [],
            description: `Pushed ${value} – min stack top is ${newMin} (getMin = ${newMin}).`,
            codeLineNumber: 2,
            layout: "grid",
            meta: { min: newMin },
        };
        step += 1;
    }

    // Pop one value and show the min updates.
    if (stack.length > 0) {
        stack.pop();
        mins.pop();
        yield {
            stepNumber: step,
            entities: makeGrid(stack, mins),
            edges: [],
            description: `Popped – getMin is now ${mins.length > 0 ? mins[mins.length - 1] : "undefined"}.`,
            codeLineNumber: 6,
            layout: "grid",
            meta: {
                stack: [...stack],
                mins: [...mins],
                min: mins.length > 0 ? (mins[mins.length - 1] as number) : "empty",
            },
        };
        step += 1;
    }
}

/** The Min Stack module, registered with the engine. */
const module: AlgorithmModule = {

    education: {
        "intuition": "A min stack adds O(1) getMin to a normal stack by keeping a parallel min stack. On every push, record the minimum of the new value and the current minimum; on every pop, pop both stacks. The top of the min stack is then always the current minimum.",
        "invariants": [
            "The min stack has the same length as the main stack.",
            "The min stack top equals the minimum of all main stack values.",
            "Popping restores the previous minimum in one step."
        ],
        "correctness": "By induction, the i-th min stack entry is the minimum of the bottom i main stack values. Pushing extends the recurrence with min(new value, old minimum), which is exactly the new minimum. Popping removes the last entry and reveals the correct minimum for the shortened stack, so getMin is a single read.",
        "complexityRationale": "Push, pop, and getMin each do a constant number of stack operations, so all are O(1) worst case. The auxiliary min stack stores one number per element, O(n) space.",
        "uses": [
            "Undo and redo stacks that need the smallest pending value",
            "Expression evaluation with a running minimum",
            "Streaming windows that track the current minimum"
        ],
        "references": [
            "CLRS, Introduction to Algorithms, Chapter 10",
            "LeetCode problem 155, Min Stack (canonical formulation)"
        ],
        "workedExample": "Push 5, 3, 8, 2. The main stack is [5,3,8,2] and the min stack is [5,3,3,2]. getMin returns 2; after popping 2 the min stack top is 3, so getMin returns 3."
    },
    id: "min-stack",
    name: "Min Stack",
    category: "data-structures",
    complexity: { time: "O(1) all ops", space: "O(n)" },
    defaultInput: { pushes: [5, 3, 8, 2] },
    visualType: "grid",
    run,
    pseudocode: [
        "initialize empty stack with auxiliary minimum stack",
        "push value and compare against current minimum",
        "push onto min stack when new minimum found",
        "pop value and pop min stack if tops match",
        "read minimum from top of min stack in O(1)",
        "count elements in both stacks",
        "done: stack holds values with minimum answer",
    ],
};

export default module;
