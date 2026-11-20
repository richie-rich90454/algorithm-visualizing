/**
 * phase-type-distribution.ts - Phase-Type Distribution (Uniformization)
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * A phase-type distribution is the time to absorption of a finite continuous-
 * time Markov chain with one absorbing state. Given an initial distribution
 * alpha over transient phases and a transient generator T, its survival
 * function is alpha exp(Tx) 1. This module evaluates that matrix exponential by
 * uniformization: rewrite exp(Tx) as a Poisson-weighted sum of powers of the
 * stochastic matrix P = I + T/theta with theta at least the largest exit rate.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(points * terms * m^2) for curves plus O(m^3) for the mean
 *   Space: O(points + m^2) for the curves and transition matrix
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - One bar per grid point shows the absorption cumulative probability.
 *   - The current grid point is highlighted during evaluation.
 *   - The final frame reports the mean absorption time and phase count.
 */

import type { AlgorithmModule, VisualEntity, VisualFrame } from "@/types";

type Matrix = number[][];

/** Multiply a row vector by a matrix. */
function timesMatrix(vector: number[], matrix: Matrix): number[] {
    const m = matrix.length;
    const result = new Array<number>(m).fill(0);
    for (let j = 0; j < m; j += 1) {
        let sum = 0;
        for (let i = 0; i < m; i += 1) sum += (vector[i] as number) * (matrix[i]?.[j] as number);
        result[j] = sum;
    }
    return result;
}

/** Absorption cumulative via uniformization of the transient generator. */
function cdfAt(x: number, alpha: number[], transition: Matrix, theta: number): number {
    if (x <= 0) return 0;
    const lambda = theta * x;
    const m = alpha.length;
    let weight = Math.exp(-lambda);
    let vector = [...alpha];
    let survival = 0;
    for (let n = 0; n <= 20000; n += 1) {
        let rowSum = 0;
        for (let i = 0; i < m; i += 1) rowSum += vector[i] as number;
        survival += weight * rowSum;
        if (n > lambda && weight < 1e-16) break;
        vector = timesMatrix(vector, transition);
        weight *= lambda / (n + 1);
    }
    return Math.min(1, Math.max(0, 1 - survival));
}

/** Solve A z = b by Gauss-Jordan with partial pivoting. */
function solve(A: Matrix, b: number[]): number[] {
    const n = b.length;
    const aug = A.map((row, i) => [...row, b[i] as number]);
    for (let col = 0; col < n; col += 1) {
        let pivot = col;
        for (let r = col + 1; r < n; r += 1) {
            if (Math.abs(aug[r]?.[col] as number) > Math.abs(aug[pivot]?.[col] as number)) pivot = r;
        }
        const temp = aug[col];
        aug[col] = aug[pivot] as number[];
        aug[pivot] = temp as number[];
        const div = aug[col]?.[col] as number;
        for (let c = col; c <= n; c += 1) aug[col]![c] = (aug[col]![c] as number) / div;
        for (let r = 0; r < n; r += 1) {
            if (r === col) continue;
            const factor = aug[r]?.[col] as number;
            if (factor === 0) continue;
            for (let c = col; c <= n; c += 1) aug[r]![c] = (aug[r]![c] as number) - factor * (aug[col]![c] as number);
        }
    }
    return aug.map((row) => row[n] as number);
}

function makeBars(values: number[], current: number, done: boolean): VisualEntity[] {
    return values.map((value, index) => ({
        id: `bar-${index}`,
        type: "bar" as const,
        label: value.toFixed(5),
        value,
        state: done || index < current ? "sorted" : index === current ? "comparing" : "idle",
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { index, cumulative: value },
    }));
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { alpha?: number[]; T?: number[][]; points?: number } | null) ?? {};
    const rawAlpha = task.alpha ?? [1, 0];
    const T = task.T ?? [
        [-1, 1],
        [0, -2],
    ];
    const alphaSum = rawAlpha.reduce((a, b) => a + Math.max(0, b), 0) || 1;
    const alpha = rawAlpha.map((a) => Math.max(0, a) / alphaSum);
    const m = T.length;
    const theta = Math.max(...T.map((row) => -Math.min(...row))) * (1 + 1e-9);
    const transition: Matrix = T.map((row, i) => row.map((value, j) => (i === j ? 1 : 0) + value / theta));

    const negT: Matrix = T.map((row) => row.map((value) => -value));
    const ones = new Array<number>(m).fill(1);
    const solved = solve(negT, ones);
    let meanAbsorption = 0;
    for (let i = 0; i < m; i += 1) meanAbsorption += (alpha[i] as number) * (solved[i] as number);

    const points = typeof task.points === "number" ? Math.max(5, Math.min(200, Math.floor(task.points))) : 60;
    const xMax = meanAbsorption * 6 + 1;
    const xs = Array.from({ length: points + 1 }, (_, i) => (xMax * i) / points);

    yield {
        stepNumber: 0,
        entities: makeBars(new Array<number>(points + 1).fill(0), -1, false),
        edges: [],
        description: `Uniformizing a ${m}-phase Markov chain to build its absorption curve.`,
        codeLineNumber: 0,
        layout: "array",
        meta: { m, alpha, theta, points, xs, cdf: [], meanAbsorption, complete: false },
    };
    let step = 1;
    const cdf: number[] = [];
    for (let i = 0; i < xs.length; i += 1) {
        const value = cdfAt(xs[i] as number, alpha, transition, theta);
        cdf.push(value);
        yield {
            stepNumber: step,
            entities: makeBars([...cdf, ...new Array<number>(points - i).fill(0)], i, false),
            edges: [],
            description: `At t = ${(xs[i] as number).toFixed(3)}: absorption probability ${value.toFixed(6)}.`,
            codeLineNumber: 2,
            layout: "array",
            meta: { m, alpha, theta, points, xs, cdf: [...cdf], meanAbsorption, complete: false },
        };
        step += 1;
    }

    yield {
        stepNumber: step,
        entities: makeBars(cdf, points + 1, true),
        edges: [],
        description: `Absorption curve complete: mean time ${meanAbsorption.toFixed(4)} across ${m} transient phase(s).`,
        codeLineNumber: 5,
        layout: "array",
        meta: { m, alpha, theta, points, xs, cdf, meanAbsorption, complete: true },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Many waiting times can be described as the time a Markov chain takes to reach an absorbing state. Starting in an initial phase, the chain jumps between transient phases at rates given by a generator until it finally exits. Uniformization turns the continuous-time matrix exponential into a discrete Poisson mixture of matrix powers, which is straightforward to sum numerically.",
        invariants: [
            "The uniformization rate theta is at least every transient exit rate.",
            "The matrix P = I + T/theta has nonnegative entries and rows summing to at most one.",
            "The survival probability starts at one and decreases to zero as time grows.",
        ],
        correctness:
            "Uniformization rewrites exp(Tx) as the infinite sum over n of exp(-theta x)(theta x)^n/n! times P^n, which holds because T = theta(P - I). Multiplying by the initial vector and summing the row totals gives the survival probability alpha exp(Tx) 1. The mean absorption time solves the linear system (-T) z = 1 and equals alpha z, since each visit to a phase contributes its expected holding time.",
        complexityRationale:
            "Each grid point sums Poisson-weighted vector-matrix products until the weight is negligible, costing O(terms * m^2) per point with O(points) points. Solving the m by m linear system for the mean costs O(m^3), and space is O(points + m^2).",
        uses: [
            "Modeling time to failure in reliability engineering",
            "Representing service-time distributions in queueing networks",
            "Computing absorption probabilities in biochemical reaction networks",
        ],
        references: [
            "Neuts, Matrix-Geometric Solutions in Stochastic Models, Chapter 2",
            "Gross and Harris, Fundamentals of Queueing Theory, Chapter 3",
        ],
        workedExample:
            "For one phase with T = [-2] and alpha = [1], absorption is exponential with rate 2, so the cumulative value is 1 - exp(-2t) and the mean is 0.5. For two phases in series with T = [[-1,1],[0,-2]] and alpha = [1,0], the absorption time is the sum of exponentials with rates 1 and 2, so the cumulative value is 1 - 2exp(-t) + exp(-2t) and the mean is 1.5.",
    },
    id: "phase-type-distribution",
    name: "Phase-Type Distribution (Uniformization)",
    category: "statistics-probability",
    complexity: { time: "O(points * terms * m^2 + m^3)", space: "O(points + m^2)" },
    defaultInput: { alpha: [1, 0], T: [[-1, 1], [0, -2]], points: 60 },
    visualType: "array",
    run,
    pseudocode: [
        "read initial phase probabilities alpha and transient generator T",
        "set theta to the largest exit rate and form P = I + T/theta",
        "solve (-T) z = 1 and set the mean absorption time to alpha z",
        "for each time x set Poisson weight exp(-theta x) and row vector alpha",
        "repeat: add weight times the row sum to survival",
        "multiply the row vector by P and update the Poisson weight until negligible",
        "set the cumulative value to one minus survival",
        "done: report the absorption curve and mean absorption time",
    ],
};

export default module;
