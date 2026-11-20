/**
 * wasserstein-distance.ts - One-Dimensional Wasserstein-1 Distance
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * The Wasserstein-1 distance, also called the earth mover's distance, measures
 * the cost of turning one distribution into another by moving mass along the
 * real line. For empirical samples the cumulative distribution functions are
 * step functions, so the distance is the total area between them: sum over
 * consecutive combined breakpoints of the CDF gap times the interval width.
 * When both samples have the same size it also equals the mean absolute
 * difference between the two sorted samples paired by rank.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O((n + m) log(n + m)) to sort and sweep the breakpoints
 *   Space: O(n + m) for the sorted samples and breakpoint tables
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Row zero holds the sorted first sample; row one holds the second.
 *   - Each frame highlights the interval being swept and shows both CDFs.
 *   - The final frame reports the total integrated absolute CDF gap.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

export interface WassersteinResult {
    distance: number;
    sortedX: number[];
    sortedY: number[];
    breakpoints: number[];
    cdfX: number[];
    cdfY: number[];
    contributions: number[];
    equalCountValue: number;
}

/** Compute W1 between two empirical samples by sweeping combined breakpoints. */
export function wasserstein1(xs: number[], ys: number[]): WassersteinResult {
    const sortedX = [...xs].sort((a, b) => a - b);
    const sortedY = [...ys].sort((a, b) => a - b);
    const breakpoints = [...new Set([...sortedX, ...sortedY])].sort((a, b) => a - b);
    const n = sortedX.length;
    const m = sortedY.length;

    const cdfX: number[] = [];
    const cdfY: number[] = [];
    let ix = 0;
    let iy = 0;
    for (const t of breakpoints) {
        while (ix < n && (sortedX[ix] ?? Infinity) <= t) {
            ix += 1;
        }
        while (iy < m && (sortedY[iy] ?? Infinity) <= t) {
            iy += 1;
        }
        cdfX.push(n === 0 ? 0 : ix / n);
        cdfY.push(m === 0 ? 0 : iy / m);
    }

    const contributions: number[] = [];
    let distance = 0;
    for (let i = 0; i + 1 < breakpoints.length; i += 1) {
        const gap = Math.abs((cdfX[i] ?? 0) - (cdfY[i] ?? 0));
        const width = (breakpoints[i + 1] ?? 0) - (breakpoints[i] ?? 0);
        const piece = gap * width;
        contributions.push(piece);
        distance += piece;
    }

    let equalCountValue = 0;
    if (n === m) {
        for (let i = 0; i < n; i += 1) {
            equalCountValue += Math.abs((sortedX[i] ?? 0) - (sortedY[i] ?? 0));
        }
        equalCountValue /= Math.max(1, n);
    }

    return { distance, sortedX, sortedY, breakpoints, cdfX, cdfY, contributions, equalCountValue };
}

/** Two-row grid of sorted samples with the current breakpoint highlighted. */
function makeCells(result: WassersteinResult, active: number, phase: string): VisualEntity[] {
    const cols = Math.max(1, result.sortedX.length, result.sortedY.length);
    const cells: VisualEntity[] = [];
    for (let row = 0; row < 2; row += 1) {
        const sample = row === 0 ? result.sortedX : result.sortedY;
        for (let col = 0; col < cols; col += 1) {
            let state: EntityState = "idle";
            if (phase === "done") {
                state = "sorted";
            } else if (col === active) {
                state = "comparing";
            }
            const value = sample[col] ?? 0;
            cells.push({
                id: `cell-${row}-${col}`,
                type: "cell",
                label: `x${row === 0 ? "" : "y"}=${value.toFixed(2)}`,
                value,
                state,
                x: 0,
                y: 0,
                width: 0,
                height: 0,
                metadata: { row, col, sample: row === 0 ? "x" : "y" },
            });
        }
    }
    return cells;
}

/** The Wasserstein-1 generator. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { xs?: number[]; ys?: number[] } | null) ?? {};
    const xs = Array.isArray(task.xs) && task.xs.length > 0
        ? task.xs.map((v) => Number(v) || 0)
        : [0, 1, 2, 3, 4];
    const ys = Array.isArray(task.ys) && task.ys.length > 0
        ? task.ys.map((v) => Number(v) || 0)
        : [2, 3, 4, 5, 6];
    const result = wasserstein1(xs, ys);
    const cols = Math.max(1, xs.length, ys.length);
    const base = {
        n: xs.length,
        m: ys.length,
        distance: result.distance,
        equalCountValue: result.equalCountValue,
        breakpoints: result.breakpoints,
        cdfX: result.cdfX,
        cdfY: result.cdfY,
        contributions: result.contributions,
        sortedX: result.sortedX,
        sortedY: result.sortedY,
    };

    yield {
        stepNumber: 0,
        entities: makeCells(result, -1, "setup"),
        edges: [],
        description: `Sorting ${xs.length} first-sample and ${ys.length} second-sample values to sweep the empirical CDFs.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: { ...base, rows: 2, cols, phase: "setup" },
    };

    let accumulated = 0;
    for (let i = 0; i + 1 < result.breakpoints.length; i += 1) {
        const gap = Math.abs((result.cdfX[i] ?? 0) - (result.cdfY[i] ?? 0));
        const width = (result.breakpoints[i + 1] ?? 0) - (result.breakpoints[i] ?? 0);
        const piece = result.contributions[i] ?? 0;
        accumulated += piece;
        yield {
            stepNumber: 1 + i,
            entities: makeCells(result, i, "sweep"),
            edges: [],
            description: `Interval ${(result.breakpoints[i] ?? 0).toFixed(2)} to ${(result.breakpoints[i + 1] ?? 0).toFixed(2)}: CDF gap ${gap.toFixed(3)} times width ${width.toFixed(3)} adds ${piece.toFixed(4)}.`,
            codeLineNumber: 2,
            layout: "grid",
            meta: {
                ...base,
                rows: 2,
                cols,
                phase: "sweep",
                index: i,
                gap,
                width,
                piece,
                accumulated,
            },
        };
    }

    yield {
        stepNumber: 1 + Math.max(0, result.breakpoints.length - 1),
        entities: makeCells(result, -1, "done"),
        edges: [],
        description: `Wasserstein-1 distance is ${result.distance.toFixed(6)}${result.equalCountValue > 0 || result.distance > 0 ? `; rank-paired mean absolute difference is ${result.equalCountValue.toFixed(6)}` : ""}.`,
        codeLineNumber: 5,
        layout: "grid",
        meta: { ...base, rows: 2, cols, phase: "done", done: true },
    };
}

/** The Wasserstein-1 distance module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "Think of each distribution as a pile of unit masses on a line. The earth mover's distance is the cheapest way to shovel one pile into the other, where cost is mass times distance moved. On a line the optimal plan never crosses itself, so the cost is simply the area between the two cumulative distribution functions.",
        invariants: [
            "The CDF at a breakpoint is the fraction of samples no greater than it.",
            "Between breakpoints both CDFs are constant, so each contribution is gap times interval width.",
            "The distance is zero exactly when the two empirical distributions are identical.",
        ],
        correctness:
            "In one dimension the optimal transport plan is monotone: the k-th sorted mass of one sample moves to the k-th sorted mass of the other. Consequently W1 equals the integral of the absolute CDF difference over the real line. The empirical CDFs only change at sample points, so the integral reduces to the finite sum over consecutive combined breakpoints computed here. For equal sample sizes the monotone plan pairs ranks directly, yielding the mean absolute difference of sorted samples, which matches the CDF sweep.",
        complexityRationale:
            "Sorting both samples costs O((n + m) log(n + m)). A two-pointer sweep advances each sample index at most once across the at most n + m breakpoints, so evaluating both CDFs and accumulating the area is linear in n + m; the breakpoint and gap tables use O(n + m) space.",
        uses: [
            "Comparing probability distributions in machine learning evaluation",
            "Measuring distribution shift and generative model fidelity",
            "Computing optimal transport costs in logistics and imaging",
        ],
        references: [
            "Villani, Optimal Transport: Old and New, Wasserstein distances chapter",
            "Peyre and Cuturi, Computational Optimal Transport, one-dimensional case",
        ],
        workedExample:
            "For x = [0, 1, 2] and y = [2, 3, 4], both sorted, the CDF gap is 1/3 on [0, 2), 0 on [2, 2] and then shifts, and the rank-paired differences are 2, 2, 2, giving W1 = 2. Sweeping the breakpoints 0, 1, 2, 3, 4 accumulates the same total area.",
    },
    id: "wasserstein-distance",
    name: "Wasserstein Distance (1D)",
    category: "statistics-probability",
    complexity: { time: "O((n + m) log(n + m))", space: "O(n + m)" },
    defaultInput: { xs: [0, 1, 2, 3, 4], ys: [2, 3, 4, 5, 6] },
    visualType: "grid",
    run,
    pseudocode: [
        "sort both samples in ascending order",
        "form the sorted list of all distinct sample values as breakpoints",
        "at each breakpoint evaluate both empirical cumulative distribution functions",
        "between consecutive breakpoints add the CDF gap times the interval width",
        "accumulate the total area to obtain the Wasserstein-1 distance",
        "when sample sizes agree also compute the mean absolute rank difference",
        "done: report the distance and the per-interval contributions",
    ],
};

export default module;
