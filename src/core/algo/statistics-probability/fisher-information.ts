/**
 * fisher-information.ts - Fisher Information by Direct Summation
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Fisher information measures how much a sample reveals about an unknown
 * parameter. For a discrete family it is the probability-weighted mean of the
 * squared derivative of the log probability, I(theta) = sum_x p(x) (d log
 * p(x)/dtheta)^2. This module evaluates that sum directly for a Bernoulli or
 * Poisson family and compares it with the analytic closed form.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(t * m) for t parameter values and m support points
 *   Space: O(t) for the reported information values
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - One grid row per candidate parameter value.
 *   - Columns show theta, the summed information, the closed form, and error.
 *   - The final frame marks the row with the smallest closed-form value.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface Task {
    family?: string;
    thetas?: number[];
    supportMax?: number;
}

type Family = "bernoulli" | "poisson";

/** Clamp a Bernoulli parameter strictly inside (0, 1). */
function clampP(value: number): number {
    const p = Number.isFinite(value) ? value : 0.5;
    return Math.min(1 - 1e-9, Math.max(1e-9, p));
}

/** Support size used to truncate the infinite Poisson sum. */
function poissonSupport(lambda: number, supportMax: number): number {
    const needed = Math.ceil(lambda + 12 * Math.sqrt(lambda) + 20);
    return Math.min(supportMax, Math.max(60, needed));
}

/** Evaluate Fisher information by summing over the discrete support. */
function sumInformation(family: Family, theta: number, supportMax: number): number {
    if (family === "bernoulli") {
        const p = clampP(theta);
        const atOne = p * (1 / p) ** 2;
        const atZero = (1 - p) * (1 / (1 - p)) ** 2;
        return atOne + atZero;
    }
    const lambda = Math.max(1e-9, theta);
    const maxX = poissonSupport(lambda, supportMax);
    let pmf = Math.exp(-lambda);
    let total = 0;
    for (let x = 0; x <= maxX; x += 1) {
        const score = x / lambda - 1;
        total += score * score * pmf;
        pmf = (pmf * lambda) / (x + 1);
    }
    return total;
}

/** The textbook closed form, used only as a cross-check. */
function closedForm(family: Family, theta: number): number {
    if (family === "bernoulli") {
        const p = clampP(theta);
        return 1 / (p * (1 - p));
    }
    return 1 / Math.max(1e-9, theta);
}

function makeCells(
    thetas: number[],
    summed: number[],
    closed: number[],
    current: number,
    done: boolean,
): VisualEntity[] {
    const entities: VisualEntity[] = [];
    for (let row = 0; row < thetas.length; row += 1) {
        const columns = [thetas[row] ?? 0, summed[row] ?? 0, closed[row] ?? 0, Math.abs((summed[row] ?? 0) - (closed[row] ?? 0))];
        for (let col = 0; col < columns.length; col += 1) {
            let state: EntityState = "idle";
            if (done) state = "sorted";
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
    const family: Family = task.family === "poisson" ? "poisson" : "bernoulli";
    const thetas = Array.isArray(task.thetas) && task.thetas.length > 0
        ? task.thetas.map(Number)
        : family === "bernoulli"
            ? [0.2, 0.35, 0.5, 0.65, 0.8]
            : [0.5, 1, 2, 4, 8];
    const supportMax = typeof task.supportMax === "number" ? Math.max(20, Math.floor(task.supportMax)) : 400;

    const summed = thetas.map((theta) => sumInformation(family, theta, supportMax));
    const closed = thetas.map((theta) => closedForm(family, theta));
    let bestIndex = 0;
    for (let i = 1; i < closed.length; i += 1) {
        if ((closed[i] ?? Infinity) < (closed[bestIndex] ?? Infinity)) bestIndex = i;
    }

    const maxError = summed.reduce((worst, value, i) => Math.max(worst, Math.abs(value - (closed[i] ?? 0))), 0);
    const metaAll = {
        family,
        rows: thetas.length,
        cols: 4,
        thetas: thetas.map((v) => Number(v.toFixed(6))),
        summed: summed.map((v) => Number(v.toFixed(6))),
        closed: closed.map((v) => Number(v.toFixed(6))),
        maxAbsError: Number(maxError.toFixed(8)),
        result: Number((summed[bestIndex] ?? 0).toFixed(6)),
        bestTheta: thetas[bestIndex] ?? 0,
        done: false,
    };

    yield {
        stepNumber: 0,
        entities: makeCells(thetas, summed, closed, -1, false),
        edges: [],
        description: `Fisher information for a ${family} family across ${thetas.length} parameter values.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: metaAll,
    };

    let step = 1;
    for (let i = 0; i < thetas.length; i += 1) {
        yield {
            stepNumber: step,
            entities: makeCells(thetas, summed, closed, i, false),
            edges: [],
            description: `theta=${(thetas[i] ?? 0).toFixed(3)}: summed information ${(summed[i] ?? 0).toFixed(4)}, closed form ${(closed[i] ?? 0).toFixed(4)}.`,
            codeLineNumber: 2,
            layout: "grid",
            meta: { ...metaAll, current: i, currentTheta: thetas[i] ?? 0, currentValue: summed[i] ?? 0 },
        };
        step += 1;
    }

    yield {
        stepNumber: step,
        entities: makeCells(thetas, summed, closed, bestIndex, true),
        edges: [],
        description: `Least information ${(closed[bestIndex] ?? 0).toFixed(4)} occurs at theta=${(thetas[bestIndex] ?? 0).toFixed(3)}; largest discrepancy ${maxError.toExponential(2)}.`,
        codeLineNumber: 5,
        layout: "grid",
        meta: { ...metaAll, done: true },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Fisher information asks how sharply a probability distribution changes when you nudge its parameter. If a tiny change in the parameter makes the observed data much more or less likely, that data carries a lot of information. Curvature of the log likelihood captures exactly this: steep log-likelihood slopes mean precise measurements.",
        invariants: [
            "For a discrete family the information is a probability-weighted sum of squared log-likelihood derivatives.",
            "The weights p(x) are nonnegative and sum to one over the support.",
            "The closed forms 1/(p(1-p)) and 1/lambda must match the direct sums up to truncation error.",
        ],
        correctness:
            "Each term p(x)*(d/dx log p(x;theta))^2 is nonnegative, so the sum is nonnegative. For Bernoulli the two outcomes give p*(1/p)^2 plus (1-p)*(1/(1-p))^2, which simplifies to 1/(p(1-p)). For Poisson, d/dlambda log p = x/lambda - 1, and summing x and x squared against the pmf yields 1/lambda. Truncating a converging series only lowers the computed value, and the reported maximum discrepancy confirms the truncation is negligible.",
        complexityRationale:
            "For each of t parameter values the direct summation walks m support points, giving O(t*m) time. Only the t reported information values and a few summary statistics are stored, so space is O(t).",
        uses: [
            "Determining the minimum variance of an unbiased estimator through the Cramer-Rao bound",
            "Designing experiments to maximize the information gained about a parameter",
            "Computing standard errors of maximum likelihood estimates",
        ],
        references: [
            "Fisher, On the Mathematical Foundations of Theoretical Statistics, 1922",
            "Casella and Berger, Statistical Inference, Chapter 7",
        ],
        workedExample:
            "For a Bernoulli parameter p=0.5 the outcome 1 has probability 0.5 and score 1/0.5=2, while the outcome 0 has the same probability and score -1/0.5=-2. The weighted sum is 0.5*4 + 0.5*4 = 8, agreeing with 1/(0.5*0.5)=8.",
    },
    id: "fisher-information",
    name: "Fisher Information",
    category: "statistics-probability",
    complexity: { time: "O(t * m)", space: "O(t)" },
    defaultInput: { family: "bernoulli", thetas: [0.2, 0.35, 0.5, 0.65, 0.8] },
    visualType: "grid",
    run,
    pseudocode: [
        "read the distribution family and the candidate parameter values",
        "for each parameter value enumerate the discrete support",
        "compute the log probability and its derivative at each outcome",
        "add the probability times the squared derivative to the total",
        "compare the total with the known closed-form value",
        "record the parameter with the smallest information",
        "done: report all information values and the maximum discrepancy",
    ],
};

export default module;
