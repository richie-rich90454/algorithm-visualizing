/**
 * count-min-sketch.ts – Count-Min Sketch
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * A count-min sketch estimates how many times a key has been seen using far
 * less memory than exact counting. It keeps a matrix of w×d counters, one row
 * per hash function. Each sighting increments one counter per row; an estimate
 * is the minimum counter value across the rows (which bounds the over-count).
 * The estimate never under-counts.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Update / estimate: O(d)
 *   Space:             O(w·d)
 *
 * ---------------------------------------------------------------------------
 * Visualisation mapping
 * ---------------------------------------------------------------------------
 *   - The counter matrix is shown.
 *   - The d cells consulted for an estimate are highlighted.
 *
 * ---------------------------------------------------------------------------
 * Properties
 * ---------------------------------------------------------------------------
 *   - "Estimate from the minimum of d counters" is the idea.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

/** Sketch dimensions. */
const W = 5;
const D = 3;

/** Simple hashes for the d rows. */
function hashRow(key: string, row: number): number {
    let h = 0;
    for (const char of key) {
        h = (h * 31 + char.charCodeAt(0) + row * 97) >>> 0;
    }
    return h;
}

/**
 * The Count-Min Sketch generator.
 *
 * @param input `{ keys, probe }` – keys to count and a key to estimate.
 */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { keys?: string[]; probe?: string } | null) ?? {};
    const keys = task.keys ?? ["a", "b", "a", "c", "a", "b"];
    const probe = task.probe ?? "a";

    let step = 0;
    const counters = Array.from({ length: D }, () => new Array<number>(W).fill(0));

    const makeCells = (active: Array<[number, number]> = []): VisualEntity[] => {
        const cells: VisualEntity[] = [];
        counters.forEach((row, r) => {
            row.forEach((value, c) => {
                cells.push({
                    id: `cell-${r}-${c}`,
                    type: "cell" as const,
                    label: String(value),
                    value,
                    state: active.some(([ar, ac]) => ar === r && ac === c)
                        ? "comparing"
                        : ((value ? "sorted" : "unvisited") as EntityState),
                    x: 0,
                    y: 0,
                    width: 0,
                    height: 0,
                    metadata: { row: r, col: c },
                });
            });
        });
        return cells;
    };

    // Frame 0: the empty counter matrix.
    yield {
        stepNumber: step,
        entities: makeCells(),
        edges: [],
        description: `Count-min sketch (${D} rows × ${W} columns) – counting [${keys.join(", ")}].`,
        codeLineNumber: 0,
        layout: "grid",
        meta: { w: W, d: D },
    };
    step += 1;

    // Count each key.
    for (const key of keys) {
        for (let r = 0; r < D; r += 1) {
            const c = hashRow(key, r) % W;
            counters[r][c] = (counters[r][c] ?? 0) + 1;
        }
        yield {
            stepNumber: step,
            entities: makeCells(),
            edges: [],
            description: `Incremented one counter per row for "${key}".`,
            codeLineNumber: 2,
            layout: "grid",
            meta: { w: W, d: D },
        };
        step += 1;
    }

    // Estimate the probe key.
    const active: Array<[number, number]> = [];
    const estimates: number[] = [];
    for (let r = 0; r < D; r += 1) {
        const c = hashRow(probe, r) % W;
        active.push([r, c]);
        estimates.push(counters[r][c] ?? 0);
    }
    const estimate = Math.min(...estimates);

    yield {
        stepNumber: step,
        entities: makeCells(active),
        edges: [],
        description: `Estimate for "${probe}": min([${estimates.join(", ")}]) = ${estimate} (exact count was ${keys.filter((k) => k === probe).length}).`,
        codeLineNumber: 3,
        layout: "grid",
        meta: { w: W, d: D, estimate },
    };
}

/** The Count-Min Sketch module, registered with the engine. */
const module: AlgorithmModule = {
    id: "count-min-sketch",
    name: "Count-Min Sketch",
    category: "data-structures",
    complexity: { time: "O(d)", space: "O(w·d)" },
    defaultInput: { keys: ["a", "b", "a", "c", "a", "b"], probe: "a" },
    visualType: "grid",
    run,
};

export default module;
