/**
 * hellinger-distance.ts - Hellinger Distance Between Distributions
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * The Hellinger distance measures how different two probability distributions
 * are. It is the Euclidean distance between the vectors of square roots of
 * their probabilities, scaled by one over the square root of two. Identical
 * distributions score zero and distributions with disjoint support score one.
 * The module normalizes both input vectors so they are valid distributions.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(m) for m bins
 *   Space: O(m) for the displayed cells
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - A two-row grid shows distribution P above distribution Q.
 *   - The bin under consideration is YELLOW in both rows.
 *   - The final frame is GREEN and reports the distance.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

function makeCells(p: number[], q: number[], active: number | null, done: boolean): VisualEntity[] {
    const cells: VisualEntity[] = [];
    for (let row = 0; row < 2; row += 1) {
        const values = row === 0 ? p : q;
        for (let col = 0; col < values.length; col += 1) {
            let state: EntityState = "idle";
            if (done) {
                state = "sorted";
            } else if (active === col) {
                state = "comparing";
            }
            cells.push({
                id: `cell-${row}-${col}`,
                type: "cell" as const,
                label: (values[col] ?? 0).toFixed(3),
                value: values[col] ?? 0,
                state,
                x: 0,
                y: 0,
                width: 0,
                height: 0,
                metadata: { row, col, value: values[col] ?? 0 },
            });
        }
    }
    return cells;
}

function normalize(values: number[]): number[] {
    const raw = values.map((v) => Math.max(0, Number(v) || 0));
    const sum = raw.reduce((a, b) => a + b, 0);
    if (sum <= 0) return raw.map(() => (raw.length === 0 ? 0 : 1 / raw.length));
    return raw.map((v) => v / sum);
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { p?: number[]; q?: number[] } | null) ?? {};
    const rawP: number[] = Array.isArray(task.p) ? task.p : [0.5, 0.25, 0.25, 0];
    const rawQ: number[] = Array.isArray(task.q) ? task.q : [0.1, 0.2, 0.3, 0.4];
    const m = Math.max(rawP.length, rawQ.length);
    const p = normalize(Array.from({ length: m }, (_, i) => rawP[i] ?? 0));
    const q = normalize(Array.from({ length: m }, (_, i) => rawQ[i] ?? 0));
    let step = 0;

    const frame = (
        active: number | null,
        done: boolean,
        description: string,
        codeLineNumber: number,
        extra: Record<string, number | string | boolean | number[]> = {},
    ): VisualFrame => ({
        stepNumber: step,
        entities: makeCells(p, q, active, done),
        edges: [],
        description,
        codeLineNumber,
        layout: "grid",
        meta: { bins: m, sumSquared: 0, distance: 0, p, q, ...extra },
    });

    yield frame(null, false, `Comparing two distributions over ${m} bin(s) with Hellinger distance.`, 0);
    step += 1;

    let sumSquared = 0;
    for (let i = 0; i < m; i += 1) {
        const rootP = Math.sqrt(p[i] ?? 0);
        const rootQ = Math.sqrt(q[i] ?? 0);
        sumSquared += (rootP - rootQ) ** 2;
        yield frame(i, false, `Bin ${i}: square roots ${rootP.toFixed(3)} and ${rootQ.toFixed(3)}; squared gap sum ${sumSquared.toFixed(4)}.`, 3, { sumSquared });
        step += 1;
    }

    const distance = Math.sqrt(sumSquared / 2);
    yield frame(null, true, `Hellinger distance is sqrt(${sumSquared.toFixed(4)} / 2) = ${distance.toFixed(4)}.`, 5, { sumSquared, distance });
}

/** The Hellinger distance module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "To compare two histograms, compare their square-rooted bars rather than the bars themselves. Square roots pull small probabilities apart and keep the result on a fixed scale from zero to one. The Hellinger distance is the Euclidean length between those square-root vectors, scaled so completely disjoint distributions are exactly one apart.",
        invariants: [
            "Both displayed distributions are nonnegative and sum to one.",
            "The accumulated squared root difference is always nonnegative.",
            "The distance is symmetric: swapping P and Q leaves it unchanged.",
        ],
        correctness:
            "Normalizing makes the two vectors valid probability distributions. The Hellinger distance is defined as one over the square root of two times the L2 norm of the vector of differences of square roots; squaring those differences, summing, and taking the square root of half the total is exactly that definition. Identical vectors give zero, and vectors with no shared support give one.",
        complexityRationale:
            "The module normalizes both vectors and then makes one pass over the m bins accumulating squared differences, so time is O(m) and the two displayed rows use O(m) space.",
        uses: [
            "Comparing observed and expected frequency spectra",
            "Measuring distribution shift in machine-learning monitoring",
            "Quantifying genetic population differentiation",
        ],
        references: [
            "Beran, Minimum Hellinger Distance Estimates for Parametric Models, 1977",
            "van de Geer, Applications of Empirical Process Theory, Chapter 1",
        ],
        workedExample:
            "For P = (0.5, 0.5) and Q = (0, 1), the square roots are (0.707, 0.707) and (0, 1). The squared gaps are 0.5 and about 0.086, totaling about 0.586; half of that is about 0.293 and its square root is about 0.541.",
    },
    id: "hellinger-distance",
    name: "Hellinger Distance",
    category: "statistics-probability",
    complexity: { time: "O(m)", space: "O(m)" },
    defaultInput: { p: [0.5, 0.25, 0.25, 0], q: [0.1, 0.2, 0.3, 0.4] },
    visualType: "grid",
    run,
    pseudocode: [
        "read two nonnegative vectors and normalize each to sum to one",
        "set the squared root difference sum to zero",
        "for each bin compute the square roots of both probabilities",
        "square their difference and add it to the running sum",
        "set the distance to the square root of half the running sum",
        "done: report the Hellinger distance",
    ],
};

export default module;
