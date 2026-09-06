/**
 * simulated-annealing.ts – Simulated Annealing
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Simulated annealing is a probabilistic optimization technique inspired by
 * metal cooling. Starting from a candidate solution, it repeatedly proposes a
 * neighbor; a worse neighbor is accepted with probability exp(−Δ/T), where
 * T is a "temperature" that decreases over time. Early, hot iterations jump
 * around freely; later, cold iterations refine the best found so far. This
 * lets the search escape local optima.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(iterations × cost of a neighbor)
 *   Space: O(1)
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - The current solution is a bar/cell.
 *   - Accepted moves are GREEN (sorted); rejected moves RED (swapped).
 *
 * ---------------------------------------------------------------------------
 * Properties
 * ---------------------------------------------------------------------------
 *   - "Accept worse moves when hot" is the entire idea.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

/**
 * Build a row of cells showing the energy curve.
 *
 * @param values The energy at each iteration.
 * @param active The current iteration.
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
 * The Simulated Annealing generator.
 *
 * @param input `{ iterations }`.
 */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { iterations?: number } | null) ?? {};
    const iterations = typeof task.iterations === "number" ? task.iterations : 15;

    let step = 0;
    const energies: number[] = [];

    // Deterministic pseudo-random for reproducibility.
    let seed = 7;
    const rand = (): number => {
        seed = (seed * 9301 + 49297) % 233280;
        return seed / 233280;
    };

    // The "energy landscape" is a simple quadratic-ish curve with a local
    // minimum so the search must escape it. Energy of position x.
    const energy = (x: number): number => (x - 5) ** 2 + 3 * Math.sin(x * 2);

    // Frame 0: start.
    let x = rand() * 10;
    let bestX = x;
    let bestE = energy(x);

    yield {
        stepNumber: step,
        entities: makeCells([bestE]),
        edges: [],
        description: "Simulated annealing – starting at a random point.",
        codeLineNumber: 0,
        layout: "grid",
        meta: { best: bestE },
    };
    step += 1;

    // Anneal.
    let T = 10;
    for (let iter = 0; iter < iterations; iter += 1) {
        // Propose a neighboring point.
        const nextX = x + (rand() * 2 - 1);
        const currentE = energy(x);
        const nextE = energy(nextX);
        const delta = nextE - currentE;

        // Accept if better, or probabilistically if worse (hot = likely).
        const accepted = delta < 0 || rand() < Math.exp(-delta / Math.max(T, 0.1));
        if (accepted) {
            x = nextX;
        }
        if (energy(x) < bestE) {
            bestE = energy(x);
            bestX = x;
        }
        energies.push(currentE);

        yield {
            stepNumber: step,
            entities: makeCells(energies, iter).map((c, index) =>
                index === energies.length - 1
                    ? { ...c, state: (accepted ? "sorted" : "swapped") as EntityState }
                    : c,
            ),
            edges: [],
            description: `T=${T.toFixed(1)}: proposed Δ=${delta.toFixed(2)} → ${accepted ? "accepted" : "rejected"}. Best=${bestE.toFixed(2)}.`,
            codeLineNumber: 2,
            layout: "grid",
            meta: { best: bestE, T, iter },
        };
        step += 1;

        T *= 0.9; // cool down
    }

    yield {
        stepNumber: step,
        entities: makeCells(energies),
        edges: [],
        description: `Best energy found = ${bestE.toFixed(2)} at x=${bestX.toFixed(2)}.`,
        codeLineNumber: 3,
        layout: "grid",
        meta: { best: bestE, bestX },
    };
}

/** The Simulated Annealing module, registered with the engine. */
const module: AlgorithmModule = {
    id: "simulated-annealing",
    name: "Simulated Annealing",
    category: "math",
    complexity: { time: "O(iterations)", space: "O(1)" },
    defaultInput: { iterations: 15 },
    visualType: "grid",
    run,
};

export default module;
