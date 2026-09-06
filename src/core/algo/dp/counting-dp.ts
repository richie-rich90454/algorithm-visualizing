/**
 * counting-dp.ts – Counting DP (number of ways)
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Counting DPs count the number of ways to reach a state rather than optimize
 * a value. The classic example: the number of ways to climb n stairs by
 * taking 1 or 2 steps at a time,
 *
 *   ways[i] = ways[i-1] + ways[i-2],
 *
 * which is Fibonacci. This visualization counts the ways and shows the DP
 * array filling.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(n)
 *   Space: O(n)
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - The cell being computed is YELLOW (comparing).
 *   - Its two contributors are PINK (highlight).
 *   - The answer is GREEN (sorted).
 *
 * ---------------------------------------------------------------------------
 * Properties
 * ---------------------------------------------------------------------------
 *   - The "+" recurrence (vs. the "max" of optimization DPs).
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

/**
 * Build a row of cell entities for the ways array.
 *
 * @param ways The DP values.
 * @param states Optional index → state overrides.
 * @returns Cell entities in a single row.
 */
function makeCells(ways: number[], states: Map<number, EntityState> = new Map()): VisualEntity[] {
    return ways.map((value, index) => ({
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
 * The Counting DP generator.
 *
 * @param input `{ steps }` – the number of stairs.
 */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { steps?: number } | null) ?? {};
    const steps = typeof task.steps === "number" ? task.steps : 10;

    let step = 0;

    // ways[i] = number of ways to climb i stairs with 1- and 2-steps.
    const ways = new Array<number>(Math.max(1, steps + 1)).fill(0);
    ways[0] = 1; // one way to stand at the bottom

    // Frame 0: the initialized array.
    yield {
        stepNumber: step,
        entities: makeCells(ways),
        edges: [],
        description: `Counting ways to climb ${steps} stairs with steps of 1 or 2.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: { steps },
    };
    step += 1;

    // Fill the DP.
    for (let i = 1; i <= steps; i += 1) {
        const from1 = ways[i - 1] ?? 0;
        const from2 = i >= 2 ? (ways[i - 2] ?? 0) : 0;
        ways[i] = from1 + from2;

        const states = new Map<number, EntityState>([
            [i, "comparing"],
            [i - 1, "highlight"],
        ]);
        if (i >= 2) {
            states.set(i - 2, "highlight");
        }
        yield {
            stepNumber: step,
            entities: makeCells(ways, states),
            edges: [],
            description:
                i >= 2
                    ? `ways[${i}] = ways[${i - 1}] + ways[${i - 2}] = ${from1} + ${from2} = ${ways[i]}.`
                    : `ways[${i}] = ways[${i - 1}] = ${from1}.`,
            codeLineNumber: 2,
            layout: "grid",
            meta: { steps },
        };
        step += 1;
    }

    const finalStates = new Map<number, EntityState>([[Math.max(0, steps), "sorted"]]);
    yield {
        stepNumber: step,
        entities: makeCells(ways, finalStates),
        edges: [],
        description: `There are ${ways[steps] ?? 0} ways to climb ${steps} stairs.`,
        codeLineNumber: 4,
        layout: "grid",
        meta: { steps, answer: ways[steps] ?? 0 },
    };
}

/** The Counting DP module, registered with the engine. */
const module: AlgorithmModule = {
    id: "counting-dp",
    name: "Counting DP",
    category: "dynamic-programming",
    complexity: { time: "O(n)", space: "O(n)" },
    // Climbing 10 stairs with 1/2 steps → 89 ways.
    defaultInput: { steps: 10 },
    visualType: "grid",
    run,
};

export default module;
