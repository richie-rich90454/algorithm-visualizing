/**
 * regression-discontinuity.ts - Sharp Regression Discontinuity Estimate
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * A sharp regression discontinuity assigns a treatment exactly when a running
 * variable crosses a cutoff. Units just above and just below the cutoff are
 * comparable, so the jump in the conditional mean outcome at the cutoff is a
 * causal treatment effect. This module fits a separate local linear regression
 * on each side using triangular kernel weights inside a bandwidth, and reports
 * the difference between the two fitted values at the cutoff.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(n) for n observations (two weighted linear fits)
 *   Space: O(n) for the observation arrays and bars
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - One bar per observation shows its outcome, highlighted when in bandwidth.
 *   - The final frame reports the left and right intercepts and their gap.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface RdInput {
    points?: Array<[number, number]>;
    cutoff?: number;
    bandwidth?: number;
}

/** Build one bar per observation showing the outcome. */
function makeBars(points: Array<[number, number]>, cutoff: number, bandwidth: number, current: number, done: boolean): VisualEntity[] {
    return points.map((point, index) => {
        const inside = Math.abs(point[0] - cutoff) <= bandwidth;
        let state: EntityState = "idle";
        if (done) {
            state = inside ? "sorted" : "unvisited";
        } else if (inside && index < current) {
            state = "sorted";
        } else if (inside && index === current) {
            state = "comparing";
        }
        return {
            id: `bar-${index}`,
            type: "bar" as const,
            label: `x ${point[0].toFixed(2)}: y ${point[1].toFixed(2)}`,
            value: point[1],
            state,
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: { index, x: point[0], y: point[1], inside },
        };
    });
}

/** Fit a weighted line of y on (x minus cutoff) and return the value at zero. */
function localIntercept(points: Array<[number, number]>, cutoff: number, bandwidth: number, side: -1 | 1): number | null {
    let s0 = 0;
    let s1 = 0;
    let s2 = 0;
    let t0 = 0;
    let t1 = 0;
    for (const point of points) {
        const u = point[0] - cutoff;
        if (side === 1 ? u < 0 : u > 0) {
            continue;
        }
        const distance = Math.abs(u);
        if (distance > bandwidth) {
            continue;
        }
        const weight = bandwidth > 0 ? 1 - distance / bandwidth : 1;
        s0 += weight;
        s1 += weight * u;
        s2 += weight * u * u;
        t0 += weight * point[1];
        t1 += weight * u * point[1];
    }
    const determinant = s0 * s2 - s1 * s1;
    if (Math.abs(determinant) < 1e-12) {
        return null;
    }
    return (s2 * t0 - s1 * t1) / determinant;
}

/** Estimate a sharp discontinuity using two local linear fits. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as RdInput | null) ?? {};
    const points: Array<[number, number]> = (task.points ?? []).filter(
        (p) => Array.isArray(p) && typeof p[0] === "number" && typeof p[1] === "number",
    );
    const cutoff = typeof task.cutoff === "number" ? task.cutoff : 0;
    const bandwidth = typeof task.bandwidth === "number" && task.bandwidth > 0 ? task.bandwidth : 1;
    const n = points.length;

    const left = localIntercept(points, cutoff, bandwidth, -1);
    const right = localIntercept(points, cutoff, bandwidth, 1);
    const leftValue = left ?? 0;
    const rightValue = right ?? 0;
    const effect = left !== null && right !== null ? right - left : 0;
    const inBandwidth = points.filter((p) => Math.abs(p[0] - cutoff) <= bandwidth).length;

    if (n === 0) {
        yield {
            stepNumber: 0,
            entities: [],
            edges: [],
            description: "No observations were supplied; the discontinuity is undefined.",
            codeLineNumber: 0,
            layout: "array",
            meta: { effect: 0, left: 0, right: 0, inBandwidth: 0, count: 0 },
        };
        return;
    }

    yield {
        stepNumber: 0,
        entities: makeBars(points, cutoff, bandwidth, -1, false),
        edges: [],
        description: `Estimating a discontinuity at ${cutoff.toFixed(2)} with bandwidth ${bandwidth.toFixed(2)} over ${n} points.`,
        codeLineNumber: 0,
        layout: "array",
        meta: { effect, left: leftValue, right: rightValue, cutoff, bandwidth, inBandwidth, count: n },
    };
    let step = 1;

    for (let i = 0; i < n; i += 1) {
        const inside = Math.abs(points[i]![0] - cutoff) <= bandwidth;
        yield {
            stepNumber: step,
            entities: makeBars(points, cutoff, bandwidth, i, false),
            edges: [],
            description: `Point ${i}: x ${points[i]![0].toFixed(2)}, y ${points[i]![1].toFixed(2)}${inside ? " inside the bandwidth" : " outside the bandwidth"}.`,
            codeLineNumber: inside ? 3 : 2,
            layout: "array",
            meta: { effect, left: leftValue, right: rightValue, cutoff, bandwidth, inBandwidth, count: n, revealed: i + 1 },
        };
        step += 1;
    }

    yield {
        stepNumber: step,
        entities: makeBars(points, cutoff, bandwidth, -1, true),
        edges: [],
        description: left === null || right === null
            ? "One side has too few points for a local linear fit; the effect is undefined."
            : `Left intercept ${left.toFixed(3)}, right intercept ${right.toFixed(3)}, discontinuity ${effect.toFixed(3)}.`,
        codeLineNumber: 6,
        layout: "array",
        meta: { effect, left: leftValue, right: rightValue, cutoff, bandwidth, inBandwidth, count: n },
    };
}

/** The regression discontinuity module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "When a rule assigns treatment by a hard cutoff, such as a scholarship for scores above a threshold, students just above and just below are almost identical apart from the treatment. Comparing outcomes at the cutoff therefore isolates the treatment's effect. The method fits a line to nearby points on each side and measures the jump where those lines meet the cutoff.",
        invariants: [
            "The left fit uses only observations at or below the cutoff; the right fit only those above.",
            "Triangular weights decrease linearly to zero at the bandwidth edge.",
            "The estimated effect is the right fitted value minus the left fitted value at the cutoff.",
        ],
        correctness:
            "Within the bandwidth, continuity of the untreated potential outcome means the left intercept estimates the outcome at the cutoff without treatment and the right intercept estimates it with treatment. Local linear fitting removes bias from a smooth trend through the cutoff, and triangular kernel weights give nearby observations more influence. Their difference is the average causal effect for units at the threshold",
        complexityRationale:
            "Each side accumulates five weighted sums in one pass over its observations, so both fits together are O(n). The observation array and bars take O(n) space.",
        uses: [
            "Estimating scholarship or program effects at eligibility thresholds",
            "Measuring the impact of exam cutoffs on later outcomes",
            "Policy evaluation where treatment follows a score cutoff",
        ],
        references: [
            "Thistlethwaite and Campbell, Regression-Discontinuity Analysis, Journal of Experimental Education, 1960",
            "Imbens and Lemieux, Regression Discontinuity Designs, Journal of Econometrics, 2008",
        ],
        workedExample:
            "Scores from 48 to 52 surround a cutoff at 50. Points below average near 70 and points above near 78 with linear trends on each side. Fitting a line to each side with bandwidth 2 and reading both at 50 might give a left intercept of 70.2 and a right intercept of 77.8, implying an estimated jump of about 7.6.",
    },
    id: "regression-discontinuity",
    name: "Regression Discontinuity",
    category: "statistics-probability",
    complexity: { time: "O(n)", space: "O(n)" },
    defaultInput: {
        points: [
            [48, 68], [49, 70], [50, 71], [51, 79], [52, 81],
            [48.5, 69], [49.5, 70.5], [50.5, 78], [51.5, 80],
        ],
        cutoff: 50,
        bandwidth: 2,
    },
    visualType: "array",
    run,
    pseudocode: [
        "read observations, cutoff, and bandwidth",
        "mark units within the bandwidth on either side",
        "fit a weighted line to the left-side observations",
        "fit a weighted line to the right-side observations",
        "read each fitted line's value at the cutoff",
        "take the right value minus the left value",
        "done: report the discontinuity estimate",
    ],
};

export default module;
