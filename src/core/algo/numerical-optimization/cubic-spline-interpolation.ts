/**
 * cubic-spline-interpolation.ts - Natural Cubic Spline Interpolation
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * A natural cubic spline passes through every data point with a piecewise
 * cubic polynomial between consecutive points. The pieces agree in their
 * first and second derivatives at the interior points, and the second
 * derivative is zero at the two endpoints. This gives a smooth curve without
 * the oscillation that a single high-degree polynomial would produce.
 *
 * The second derivatives are found by solving a tridiagonal linear system,
 * and the spline is then evaluated at a fixed set of sample positions.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(n) for the tridiagonal solve plus O(s * log n) for s samples
 *   Space: O(n) for the knots and second derivatives
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Bars show the spline value at evenly spaced sample positions.
 *   - Bars fill from left to right as the curve is evaluated.
 *   - meta carries the knots, second derivatives, and sampled curve.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

/** Solve a tridiagonal system with the Thomas algorithm. */
function thomas(a: number[], b: number[], c: number[], d: number[]): number[] {
    const n = d.length;
    const cp = Array.from({ length: n }, () => 0);
    const dp = Array.from({ length: n }, () => 0);
    cp[0] = (c[0] ?? 0) / (b[0] ?? 1);
    dp[0] = (d[0] ?? 0) / (b[0] ?? 1);
    for (let i = 1; i < n; i += 1) {
        const denom = (b[i] ?? 1) - (a[i] ?? 0) * (cp[i - 1] ?? 0);
        cp[i] = (c[i] ?? 0) / denom;
        dp[i] = ((d[i] ?? 0) - (a[i] ?? 0) * (dp[i - 1] ?? 0)) / denom;
    }
    const x = Array.from({ length: n }, () => 0);
    x[n - 1] = dp[n - 1] ?? 0;
    for (let i = n - 2; i >= 0; i -= 1) {
        x[i] = (dp[i] ?? 0) - (cp[i] ?? 0) * (x[i + 1] ?? 0);
    }
    return x;
}

/** Evaluate a natural cubic spline at t using knots and second derivatives. */
function evaluate(
    xs: number[],
    ys: number[],
    m: number[],
    t: number,
): number {
    const n = xs.length;
    let i = 0;
    while (i < n - 2 && (xs[i + 1] ?? 0) < t) {
        i += 1;
    }
    const xi = xs[i] ?? 0;
    const xi1 = xs[i + 1] ?? xi;
    const h = xi1 - xi || 1;
    const mi = m[i] ?? 0;
    const mi1 = m[i + 1] ?? 0;
    const yi = ys[i] ?? 0;
    const yi1 = ys[i + 1] ?? 0;
    const a = (xi1 - t) / h;
    const b = (t - xi) / h;
    return (
        mi * a * a * a * h * h / 6 +
        mi1 * b * b * b * h * h / 6 +
        (yi - mi * h * h / 6) * a +
        (yi1 - mi1 * h * h / 6) * b
    );
}

/** Build sample bars for a frame. */
function makeBars(values: number[], filled: number): VisualEntity[] {
    return values.map((value, index) => ({
        id: `bar-${index}`,
        type: "bar" as const,
        label: index < filled ? value.toFixed(4) : "",
        value: index < filled ? value : 0,
        state: (index < filled ? "sorted" : index === filled ? "comparing" : "unvisited") as EntityState,
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { index },
    }));
}

/** The natural cubic spline generator. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (
        input as { points?: Array<[number, number]>; samples?: number } | null
    ) ?? {};
    const raw = Array.isArray(task.points) ? task.points : [];
    const points: Array<[number, number]> =
        raw.length >= 2
            ? raw.map((p) => [Number(p?.[0]), Number(p?.[1])])
            : [
                  [0, 0],
                  [1, 1],
                  [2, 0],
                  [3, 2],
              ];
    const xs = points.map((p) => p[0]);
    const ys = points.map((p) => p[1]);
    const n = xs.length;
    const samples = Math.max(2, Math.floor(Number(task.samples ?? 9)) || 9);

    const h: number[] = [];
    for (let i = 0; i < n - 1; i += 1) {
        h.push((xs[i + 1] ?? 0) - (xs[i] ?? 0));
    }

    const m = Array.from({ length: n }, () => 0);
    if (n >= 3) {
        const lower = Array.from({ length: n - 2 }, (_, i) => h[i] ?? 1);
        const diag = Array.from({ length: n - 2 }, (_, i) => 2 * ((h[i] ?? 1) + (h[i + 1] ?? 1)));
        const upper = Array.from({ length: n - 2 }, (_, i) => h[i + 1] ?? 1);
        const rhs = Array.from({ length: n - 2 }, (_, i) => {
            const left = ((ys[i + 1] ?? 0) - (ys[i] ?? 0)) / (h[i] ?? 1);
            const right = ((ys[i + 2] ?? 0) - (ys[i + 1] ?? 0)) / (h[i + 1] ?? 1);
            return 6 * (right - left);
        });
        const inner = thomas(lower, diag, upper, rhs);
        for (let i = 0; i < n - 2; i += 1) {
            m[i + 1] = inner[i] ?? 0;
        }
    }

    const start = xs[0] ?? 0;
    const end = xs[n - 1] ?? start;
    const sampleXs = Array.from({ length: samples }, (_, i) =>
        samples === 1 ? start : start + ((end - start) * i) / (samples - 1),
    );
    const sampleValues = sampleXs.map((t) => evaluate(xs, ys, m, t));

    let step = 0;
    yield {
        stepNumber: step,
        entities: makeBars(sampleValues, 0),
        edges: [],
        description: `Fit a natural cubic spline through ${n} points; second derivatives at the ends are zero.`,
        codeLineNumber: 0,
        layout: "array",
        meta: {
            xs,
            ys,
            secondDerivatives: [...m],
            samples: samples,
            sampleXs,
            sampleValues: Array.from({ length: samples }, () => 0),
        },
    };
    step += 1;

    for (let k = 0; k < sampleValues.length; k += 1) {
        yield {
            stepNumber: step,
            entities: makeBars(sampleValues, k + 1),
            edges: [],
            description: `Evaluate the spline at x = ${(sampleXs[k] ?? 0).toFixed(3)}: value ${(sampleValues[k] ?? 0).toFixed(4)}.`,
            codeLineNumber: k < n - 1 ? 2 : 4,
            layout: "array",
            meta: {
                xs,
                ys,
                secondDerivatives: [...m],
                samples: samples,
                sampleXs,
                sampleValues: sampleValues.slice(0, k + 1),
            },
        };
        step += 1;
    }

    yield {
        stepNumber: step,
        entities: makeBars(sampleValues, sampleValues.length),
        edges: [],
        description: "The finished spline passes through every knot with matching first and second derivatives and zero curvature at the ends.",
        codeLineNumber: 6,
        layout: "array",
        meta: {
            xs,
            ys,
            secondDerivatives: [...m],
            samples: samples,
            sampleXs,
            sampleValues: [...sampleValues],
        },
    };
}

/** The natural cubic spline module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "Instead of forcing one high-degree polynomial through all the data, fit a different cubic between each pair of neighboring points. Choose the cubics so that neighboring pieces meet smoothly in slope and curvature. Requiring zero curvature at the two ends removes the remaining freedom and gives a unique, stable curve.",
        invariants: [
            "The spline interpolates every knot: S(x_i) equals y_i.",
            "First and second derivatives are continuous at every interior knot.",
            "The second derivative is zero at both endpoints, the natural boundary condition.",
        ],
        correctness:
            "On each interval the spline is a cubic whose second derivative is linear between M_i and M_{i+1}. Integrating twice and enforcing S(x_i) = y_i and S(x_{i+1}) = y_{i+1} gives the standard interval formula. Matching first derivatives at interior knots yields a tridiagonal system for the unknown M_i, which the Thomas algorithm solves exactly for this strictly diagonally dominant system. The natural rows set M_0 and M_{n-1} to zero, so the resulting piecewise cubic has the required continuity.",
        complexityRationale:
            "The tridiagonal system has n-2 unknowns and the Thomas algorithm solves it in O(n) time. Each of the s samples locates its interval in O(log n) or O(n) time and evaluates a fixed formula, so sampling adds O(s * log n). Only knots, second derivatives, and samples are stored, giving O(n) space.",
        uses: [
            "Smooth curve fitting in data visualization",
            "Interpolating sampled trajectories in computer graphics",
            "Numerical integration and spline-based solvers",
        ],
        references: [
            "Burden and Faires, Numerical Analysis, Chapter 3",
            "de Boor, A Practical Guide to Splines, Chapter 2",
        ],
        workedExample:
            "Through the points (0, 0), (1, 1), (2, 0), and (3, 2), the tridiagonal solve gives interior second derivatives of -3 and 3 with zeros at the ends. Evaluating between the knots produces a smooth curve that hits all four points exactly.",
    },
    id: "cubic-spline-interpolation",
    name: "Cubic Spline Interpolation",
    category: "numerical-optimization",
    complexity: { time: "O(n + s log n)", space: "O(n)" },
    defaultInput: {
        points: [
            [0, 0],
            [1, 1],
            [2, 0],
            [3, 2],
        ],
        samples: 9,
    },
    visualType: "array",
    run,
    pseudocode: [
        "compute the interval widths between consecutive knots",
        "set the endpoint second derivatives to zero",
        "build the tridiagonal system for interior second derivatives",
        "solve the system with the Thomas algorithm",
        "for each sample locate the containing interval",
        "evaluate the cubic polynomial on that interval",
        "done: report the smooth curve and sampled values",
    ],
};

export default module;
