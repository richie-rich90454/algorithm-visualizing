/**
 * maximum-a-posteriori-estimation.ts - Beta-Bernoulli MAP Estimate
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Maximum a posteriori estimation picks the parameter value where the
 * posterior density is largest. For Bernoulli data with a Beta prior the
 * posterior is again Beta, so the mode has a closed form. The module also
 * scans a grid of candidate values and reports where the density peaks,
 * letting the analytic answer be checked against a direct search.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(n + g) for n trials and g grid points
 *   Space: O(g) for the displayed grid
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - One grid row per candidate parameter value.
 *   - Columns show theta, likelihood, prior, and unnormalized posterior.
 *   - The final frame marks the grid maximum.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface Task {
    successes?: number;
    trials?: number;
    alpha?: number;
    beta?: number;
    grid?: number[];
}

/** Unnormalized Beta posterior density evaluated with logarithms. */
function posteriorDensity(theta: number, k: number, n: number, alpha: number, beta: number): number {
    if (theta <= 0 || theta >= 1) return 0;
    const a = k + alpha - 1;
    const b = n - k + beta - 1;
    const logDensity = a * Math.log(theta) + b * Math.log(1 - theta);
    return Math.exp(logDensity);
}

function makeCells(
    grid: number[],
    likelihoods: number[],
    priors: number[],
    posteriors: number[],
    current: number,
    done: boolean,
    bestIndex: number,
): VisualEntity[] {
    const entities: VisualEntity[] = [];
    for (let row = 0; row < grid.length; row += 1) {
        const columns = [grid[row] ?? 0, likelihoods[row] ?? 0, priors[row] ?? 0, posteriors[row] ?? 0];
        for (let col = 0; col < columns.length; col += 1) {
            let state: EntityState = "idle";
            if (done) state = row === bestIndex ? "highlight" : "sorted";
            else if (row === current) state = "comparing";
            entities.push({
                id: `cell-${row}-${col}`,
                type: "cell" as const,
                label: (columns[col] ?? 0).toFixed(4),
                value: columns[col] ?? 0,
                state,
                x: 0,
                y: 0,
                width: 0,
                height: 0,
                metadata: { row, col },
            });
        }
    }
    return entities;
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as Task | null) ?? {};
    const trials = typeof task.trials === "number" ? Math.max(1, Math.floor(task.trials)) : 10;
    const successes = typeof task.successes === "number"
        ? Math.min(trials, Math.max(0, Math.floor(task.successes)))
        : 6;
    const alpha = typeof task.alpha === "number" && task.alpha > 0 ? task.alpha : 2;
    const beta = typeof task.beta === "number" && task.beta > 0 ? task.beta : 2;
    const grid = Array.isArray(task.grid) && task.grid.length > 1
        ? task.grid.map(Number).filter((v) => v > 0 && v < 1)
        : Array.from({ length: 101 }, (_, i) => (i + 1) / 102);

    const postA = successes + alpha;
    const postB = trials - successes + beta;
    let analyticMode: number;
    if (postA > 1 && postB > 1) analyticMode = (postA - 1) / (postA + postB - 2);
    else if (postA <= 1 && postB > 1) analyticMode = 0;
    else if (postA > 1 && postB <= 1) analyticMode = 1;
    else analyticMode = 0.5;

    const likelihoods = grid.map((theta) => Math.exp(successes * Math.log(theta) + (trials - successes) * Math.log(1 - theta)));
    const priors = grid.map((theta) => Math.exp((alpha - 1) * Math.log(theta) + (beta - 1) * Math.log(1 - theta)));
    const posteriors = grid.map((theta) => posteriorDensity(theta, successes, trials, alpha, beta));

    let bestIndex = 0;
    for (let i = 1; i < posteriors.length; i += 1) {
        if ((posteriors[i] ?? 0) > (posteriors[bestIndex] ?? 0)) bestIndex = i;
    }
    const bestValue = posteriors[bestIndex] ?? 0;
    const matches = Math.abs((grid[bestIndex] ?? 0) - analyticMode) <= 1 / (grid.length + 1) + 1e-9;

    const metaAll = {
        family: "map-estimation",
        rows: grid.length,
        cols: 4,
        trials,
        successes,
        alpha,
        beta,
        posteriorA: postA,
        posteriorB: postB,
        analyticMode: Number(analyticMode.toFixed(6)),
        gridMode: Number((grid[bestIndex] ?? 0).toFixed(6)),
        bestValue: Number(bestValue.toFixed(8)),
        matches,
        thetaGrid: grid.map((v) => Number(v.toFixed(6))),
        posteriors: posteriors.map((v) => Number(v.toFixed(8))),
    };

    yield {
        stepNumber: 0,
        entities: makeCells(grid, likelihoods, priors, posteriors, -1, false, bestIndex),
        edges: [],
        description: `Beta-Bernoulli MAP with Beta(${alpha}, ${beta}) prior after ${successes} successes in ${trials} trials.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: metaAll,
    };

    let step = 1;
    for (let i = 0; i < grid.length; i += 1) {
        yield {
            stepNumber: step,
            entities: makeCells(grid, likelihoods, priors, posteriors, i, false, bestIndex),
            edges: [],
            description: `theta=${(grid[i] ?? 0).toFixed(3)}: posterior density ${(posteriors[i] ?? 0).toFixed(4)}; best so far ${(Math.max(...posteriors.slice(0, i + 1))).toFixed(4)}.`,
            codeLineNumber: 4,
            layout: "grid",
            meta: { ...metaAll, current: i, currentTheta: grid[i] ?? 0, currentDensity: posteriors[i] ?? 0 },
        };
        step += 1;
    }

    yield {
        stepNumber: step,
        entities: makeCells(grid, likelihoods, priors, posteriors, -1, true, bestIndex),
        edges: [],
        description: `MAP mode ${analyticMode.toFixed(4)}; grid search peaked at ${(grid[bestIndex] ?? 0).toFixed(4)}, agreement ${matches ? "yes" : "no"}.`,
        codeLineNumber: 6,
        layout: "grid",
        meta: { ...metaAll, done: true },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "A posterior distribution says which parameter values are plausible after seeing the data. The MAP estimate is simply the most plausible single value: the peak of that distribution. With Bernoulli data and a Beta prior the posterior is also Beta, so the peak can be read off directly, but scanning a grid makes the idea visible.",
        invariants: [
            "The posterior parameters are successes plus alpha and failures plus beta.",
            "The posterior density is the likelihood times the prior at each theta.",
            "The grid maximum lies within one grid spacing of the analytic mode.",
        ],
        correctness:
            "For a Beta(a, b) distribution with a greater than one and b greater than one, the density derivative vanishes at (a-1)/(a+b-2), which is the unique interior maximum because the log density is concave. The module computes that closed form and independently locates the largest grid value. Since the grid covers (0, 1) uniformly, the grid maximum must be within one spacing of the true mode, and the reported agreement flag verifies this.",
        complexityRationale:
            "Evaluating likelihood, prior, and posterior at each of g grid points is constant work per point, so the scan is O(g). The likelihood and posterior arrays plus the summary statistics use O(g) space.",
        uses: [
            "Point estimation when a full posterior is too costly to communicate",
            "Initializing variational approximations at the posterior mode",
            "Regularized classification through a prior over model weights",
        ],
        references: [
            "Berger, Statistical Decision Theory and Bayesian Analysis, Chapter 4",
            "Gelman et al., Bayesian Data Analysis, Chapter 2",
        ],
        workedExample:
            "With six successes in ten trials and a Beta(2, 2) prior, the posterior is Beta(8, 6). Its mode is (8-1)/(8+6-2) = 7/12, about 0.583. The maximum likelihood estimate alone would be 0.6, so the prior pulls the estimate slightly toward the center.",
    },
    id: "maximum-a-posteriori-estimation",
    name: "Maximum A Posteriori Estimation",
    category: "statistics-probability",
    complexity: { time: "O(g)", space: "O(g)" },
    defaultInput: { trials: 10, successes: 6, alpha: 2, beta: 2 },
    visualType: "grid",
    run,
    pseudocode: [
        "read successes, trials, and the Beta prior parameters",
        "form the posterior parameters by adding counts to the prior",
        "compute the closed-form mode when both parameters exceed one",
        "for each grid value evaluate likelihood and prior",
        "multiply them to obtain the unnormalized posterior density",
        "track the grid value with the largest density",
        "done: report the analytic mode, grid mode, and agreement",
    ],
};

export default module;
