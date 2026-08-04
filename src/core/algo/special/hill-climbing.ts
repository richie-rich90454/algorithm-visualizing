/**
 * hill-climbing.ts – Hill Climbing
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Hill climbing is a local search: from a candidate solution it always moves
 * to the best neighbor, repeating until no neighbor improves. It is fast
 * and simple but greedy – it happily gets stuck in a local optimum, which is
 * exactly why stochastic methods (simulated annealing) were invented.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(iterations × neighbors per step)
 *   Space: O(1)
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - The current position is a bar/cell.
 *   - Each improvement step is highlighted.
 *
 * ---------------------------------------------------------------------------
 * Properties
 * ---------------------------------------------------------------------------
 *   - "Always move uphill" is the entire idea (and its weakness).
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

/**
 * Build a row of cells showing the objective values visited.
 *
 * @param values The objective values.
 * @param active The current step.
 * @returns Cell entities in a single row.
 */
function makeCells(values: number[], active = -1): VisualEntity[] {
    return values.map((value, index) => ({
        id: `cell-${index}`,
        type: "cell" as const,
        label: value.toFixed(1),
        value,
        state: (index === active ? "comparing" : "unvisited") as EntityState,
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { row: 0, col: index },
    }));
}

/**
 * The Hill Climbing generator.
 *
 * @param input `{ steps }`.
 */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { steps?: number } | null) ?? {};
    const steps = typeof task.steps === "number" ? task.steps : 10;

    let step = 0;
    const visited: number[] = [];

    // Objective: f(x) = -x² + 6x (a parabola with a peak at x = 3).
    const objective = (x: number): number => -x * x + 6 * x;

    // Frame 0: start at the left edge.
    let x = 0;
    let value = objective(x);
    visited.push(value);

    yield {
        stepNumber: step,
        entities: makeCells(visited, 0),
        edges: [],
        description: `Hill climbing from x=0 (f=${value.toFixed(1)}).`,
        codeLineNumber: 0,
        layout: "grid",
        meta: { x, value },
    };
    step += 1;

    for (let i = 0; i < steps; i += 1) {
        // Evaluate the two neighbors.
        const left = objective(x - 1);
        const right = objective(x + 1);
        const bestNeighbor = Math.max(left, right);
        const bestX = left >= right ? x - 1 : x + 1;

        // Move if the neighbor improves.
        if (bestNeighbor > value) {
            x = bestX;
            value = bestNeighbor;
        } else {
            // Stuck at a peak (local optimum).
            yield {
                stepNumber: step,
                entities: makeCells(visited, visited.length - 1),
                edges: [],
                description: `Stuck at x=${x} (f=${value.toFixed(1)}) – no neighbor improves.`,
                codeLineNumber: 3,
                layout: "grid",
                meta: { x, value, peak: true },
            };
            step += 1;
            break;
        }

        visited.push(value);
        yield {
            stepNumber: step,
            entities: makeCells(visited, visited.length - 1),
            edges: [],
            description: `Moved to x=${x} (f=${value.toFixed(1)}).`,
            codeLineNumber: 2,
            layout: "grid",
            meta: { x, value },
        };
        step += 1;
    }

    yield {
        stepNumber: step,
        entities: makeCells(visited),
        edges: [],
        description: `Hill climbing finished at x=${x} with f=${value.toFixed(1)}.`,
        codeLineNumber: 4,
        layout: "grid",
        meta: { x, value },
    };
}

/** The Hill Climbing module, registered with the engine. */
const module: AlgorithmModule = {
    id: "hill-climbing",
    name: "Hill Climbing",
    category: "math",
    complexity: { time: "O(steps·neighbors)", space: "O(1)" },
    defaultInput: { steps: 10 },
    visualType: "grid",
    run,
};

export default module;
