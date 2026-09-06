/**
 * monte-carlo.ts – Monte Carlo Method (π estimation)
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Monte Carlo methods estimate answers by random sampling. The classic
 * example estimates π: throw N random points into the unit square, count how
 * many land inside the quarter circle (x² + y² ≤ 1), and use
 * π ≈ 4 · (inside / total). The estimate converges as N grows.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(N) samples
 *   Space: O(1)
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Points are drawn in a grid; inside points are GREEN (sorted).
 *   - The running π estimate is narrated.
 *
 * ---------------------------------------------------------------------------
 * Properties
 * ---------------------------------------------------------------------------
 *   - "Random sampling instead of exact computation" is the idea.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

/** Grid size for visualizing sampled points. */
const GRID = 10;

/**
 * The Monte Carlo generator.
 *
 * @param input `{ samples }`.
 */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { samples?: number } | null) ?? {};
    // Only non-negative integers make sense as a sample count (a float would
    // desync the "from N samples" caption; NaN would poison the estimate).
    const raw = typeof task.samples === "number" ? task.samples : 60;
    const samples = Number.isInteger(raw) && raw >= 0 ? raw : 60;

    let step = 0;

    // Deterministic pseudo-random.
    let seed = 12345;
    const rand = (): number => {
        seed = (seed * 9301 + 49297) % 233280;
        return seed / 233280;
    };

    const inside = new Set<string>();
    let count = 0;

    const makeCells = (): VisualEntity[] => {
        const cells: VisualEntity[] = [];
        for (let row = 0; row < GRID; row += 1) {
            for (let col = 0; col < GRID; col += 1) {
                const key = `${row},${col}`;
                cells.push({
                    id: `cell-${row}-${col}`,
                    type: "cell" as const,
                    label: inside.has(key) ? "•" : "",
                    value: inside.has(key) ? 1 : 0,
                    state: (inside.has(key) ? "sorted" : "unvisited") as EntityState,
                    x: 0,
                    y: 0,
                    width: 0,
                    height: 0,
                    metadata: { row, col },
                });
            }
        }
        return cells;
    };

    // Edge case: no samples means no estimate.
    if (samples <= 0) {
        yield {
            stepNumber: step,
            entities: makeCells(),
            edges: [],
            description: "No samples – nothing to estimate π from.",
            codeLineNumber: 0,
            layout: "grid",
            meta: { inside: 0, estimate: 0 },
        };
        return;
    }

    // Frame 0: the empty square.
    yield {
        stepNumber: step,
        entities: makeCells(),
        edges: [],
        description: "Monte Carlo π estimation – throwing random points.",
        codeLineNumber: 0,
        layout: "grid",
        meta: { inside: 0, estimate: 0 },
    };
    step += 1;

    // Throw points.
    for (let i = 0; i < samples; i += 1) {
        const x = rand();
        const y = rand();
        const isInside = x * x + y * y <= 1;
        if (isInside) {
            inside.add(`${Math.floor(y * GRID)},${Math.floor(x * GRID)}`);
            count += 1;
        }
        const estimate = (4 * count) / (i + 1);

        yield {
            stepNumber: step,
            entities: makeCells(),
            edges: [],
            description: `Point ${i + 1}: (${x.toFixed(2)}, ${y.toFixed(2)}) ${isInside ? "inside" : "outside"} – π ≈ ${estimate.toFixed(3)}.`,
            codeLineNumber: 2,
            layout: "grid",
            meta: { inside: count, estimate },
        };
        step += 1;
    }

    const finalEstimate = (4 * count) / samples;
    yield {
        stepNumber: step,
        entities: makeCells(),
        edges: [],
        description: `Final π estimate = ${finalEstimate.toFixed(3)} from ${samples} samples.`,
        codeLineNumber: 3,
        layout: "grid",
        meta: { inside: count, estimate: finalEstimate },
    };
}

/** The Monte Carlo module, registered with the engine. */
const module: AlgorithmModule = {
    id: "monte-carlo",
    name: "Monte Carlo (π)",
    category: "math",
    complexity: { time: "O(N)", space: "O(1)" },
    defaultInput: { samples: 60 },
    visualType: "grid",
    run,
};

export default module;
