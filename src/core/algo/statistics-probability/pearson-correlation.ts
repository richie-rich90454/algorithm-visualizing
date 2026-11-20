/**
 * pearson-correlation.ts - Pearson Product-Moment Correlation
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Pearson's r measures the strength and direction of a linear relationship
 * between paired samples. It divides the covariance of x and y by the product
 * of their standard deviations. The module accumulates the five raw sums in
 * one pass and reports the centered form, which is numerically more stable.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(n) for one pass over the paired samples
 *   Space: O(n) for the displayed scatter points
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Each (x, y) pair is a point in the plane.
 *   - Points are highlighted as their contributions enter the running sums.
 *   - The final frame is green and reports the correlation coefficient.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface CorrelationInput {
    points?: Array<[number, number]>;
}

type Point = [number, number];

/** Build scatter points, highlighting those already accumulated. */
function makePoints(points: Point[], current: number, done: boolean): VisualEntity[] {
    return points.map(([x, y], index) => {
        let state: EntityState = "idle";
        if (done) {
            state = "sorted";
        } else if (index === current) {
            state = "comparing";
        } else if (index < current) {
            state = "visited";
        }
        return {
            id: `point-${index}`,
            type: "node" as const,
            label: `(${x}, ${y})`,
            value: [x, y],
            state,
            x,
            y,
            width: 0,
            height: 0,
            metadata: { index, x, y },
        };
    });
}

/** The Pearson correlation generator. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as CorrelationInput | null) ?? {};
    const points: Point[] = Array.isArray(task.points)
        ? task.points.map((p) => [p[0], p[1]] as Point)
        : [
              [1, 2],
              [2, 4],
              [3, 5],
              [4, 4],
              [5, 6],
          ];
    const n = points.length;
    let sumX = 0;
    let sumY = 0;
    let sumXY = 0;
    let sumX2 = 0;
    let sumY2 = 0;

    yield {
        stepNumber: 0,
        entities: makePoints(points, -1, false),
        edges: [],
        description: `Computing Pearson correlation over ${n} paired point(s).`,
        codeLineNumber: 0,
        layout: "point",
        meta: { n, r: 0, meanX: 0, meanY: 0, covariance: 0, varX: 0, varY: 0 },
    };
    let step = 1;

    for (let i = 0; i < n; i += 1) {
        const point = points[i] ?? [0, 0];
        const x = point[0];
        const y = point[1];
        sumX += x;
        sumY += y;
        sumXY += x * y;
        sumX2 += x * x;
        sumY2 += y * y;
        yield {
            stepNumber: step,
            entities: makePoints(points, i, false),
            edges: [],
            description: `Point ${i}: (${x}, ${y}); raw sums xy=${sumXY}, x^2=${sumX2}, y^2=${sumY2}.`,
            codeLineNumber: 1,
            layout: "point",
            meta: { n, r: 0, meanX: sumX / (i + 1), meanY: sumY / (i + 1), covariance: 0, varX: 0, varY: 0 },
        };
        step += 1;
    }

    const meanX = n === 0 ? 0 : sumX / n;
    const meanY = n === 0 ? 0 : sumY / n;
    const covariance = n === 0 ? 0 : (sumXY - (sumX * sumY) / n) / n;
    const varX = n === 0 ? 0 : (sumX2 - (sumX * sumX) / n) / n;
    const varY = n === 0 ? 0 : (sumY2 - (sumY * sumY) / n) / n;
    const denominator = Math.sqrt(varX * varY);
    let r = denominator === 0 ? 0 : covariance / denominator;
    r = Math.max(-1, Math.min(1, r));

    yield {
        stepNumber: step,
        entities: makePoints(points, -1, true),
        edges: [],
        description: `r = ${r.toFixed(6)}; covariance ${covariance.toFixed(4)}, spread (${Math.sqrt(varX).toFixed(4)}, ${Math.sqrt(varY).toFixed(4)}).`,
        codeLineNumber: 4,
        layout: "point",
        meta: { n, r, meanX, meanY, covariance, varX, varY, sumX, sumY, sumXY, sumX2, sumY2 },
    };
}

/** The Pearson correlation module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "Correlation asks whether two variables move together. It centers each variable at its mean, multiplies the paired deviations, and scales the result so the answer always lies between minus one and one. Positive means they rise together, negative means one rises as the other falls, and zero means no linear trend.",
        invariants: [
            "The correlation coefficient always lies in the closed interval from minus one to one.",
            "The coefficient is unchanged if either variable is shifted or scaled by a positive constant.",
            "Perfect positive linear data give plus one and perfect negative linear data give minus one.",
        ],
        correctness:
            "The centered numerator is the sum of products of deviations, which equals the raw sum sumXY minus sumX times sumY over n. The denominator is the square root of the two similarly centered sums of squares. Their quotient is exactly the product-moment correlation, and the Cauchy-Schwarz inequality guarantees its magnitude never exceeds one, with equality only for points on a straight line.",
        complexityRationale:
            "Accumulating the five raw sums is a single pass over n pairs, so time is O(n). Only the scatter points are kept for the visualization, giving O(n) space; the running sums themselves use O(1).",
        uses: [
            "Checking linear association before fitting a regression",
            "Feature screening in statistics and machine learning",
            "Summarizing the strength of a measured relationship",
        ],
        references: [
            "Pearson, Notes on Regression and Inheritance, 1895",
            "Wackerly, Mendenhall, and Scheaffer, Mathematical Statistics with Applications, Chapter 11",
        ],
        workedExample:
            "For points (1,2), (2,4), (3,5), (4,4), (5,6) the means are 3 and 4.2. The centered cross products and spreads give r about 0.82, showing a fairly strong positive linear trend that is not perfect because the fourth point drops below the line.",
    },
    id: "pearson-correlation",
    name: "Pearson Correlation",
    category: "statistics-probability",
    complexity: { time: "O(n)", space: "O(n)" },
    defaultInput: {
        points: [
            [1, 2],
            [2, 4],
            [3, 5],
            [4, 4],
            [5, 6],
        ],
    },
    visualType: "point",
    run,
    pseudocode: [
        "read the paired samples and initialize the five running sums",
        "for each pair add x, y, xy, x squared, and y squared",
        "compute the means of x and y from the sums",
        "form the centered covariance and the two centered variances",
        "divide the covariance by the square root of the variance product",
        "clamp the result to the interval from minus one to one",
        "done: report the correlation coefficient",
    ],
};

export default module;
