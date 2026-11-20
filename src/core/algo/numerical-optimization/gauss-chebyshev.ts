/**
 * gauss-chebyshev.ts - Gauss-Chebyshev Quadrature (First Kind)
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Gauss-Chebyshev quadrature integrates a function against the weight
 * 1 / sqrt(1 - x^2) on the interval from -1 to 1. Unlike Gauss-Legendre, the
 * nodes and weights have closed forms: the nth rule uses the n roots of the
 * Chebyshev polynomial T_n, namely cos((2i-1)pi/(2n)), and every weight equals
 * pi/n. Substituting x = cos(theta) turns the weighted integral into an
 * ordinary integral of f(cos theta) over theta from 0 to pi, so the rule is the
 * trapezoid rule on equally spaced angles. It integrates every polynomial of
 * degree at most 2n-1 exactly.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 *   Time:  O(n) to form the nodes and evaluate the sum
 *   Space: O(n) for the nodes and weights
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 *   - One bar per node shows the quadrature weight pi/n.
 *   - The node currently contributing to the running integral is yellow.
 *   - The final frame is green and carries the exactness and sample errors.
 *
 * This is an exact closed-form rule for at most eight nodes; no adaptive or
 * asymptotic approximation is used.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface Input {
    nodes?: number;
    samplePower?: number;
}

const DEFAULT_NODES = 4;
const DEFAULT_POWER = 4;

/** The root of T_n corresponding to index i, one-based. */
function nodeAt(i: number, n: number): number {
    return Math.cos((Math.PI * (2 * i - 1)) / (2 * n));
}

/** Exact integral of x^power / sqrt(1 - x^2) on [-1, 1]. */
function exactMoment(power: number): number {
    if (power % 2 !== 0) {
        return 0;
    }
    const m = power / 2;
    let center = 1;
    for (let k = 0; k < m; k += 1) {
        center = (center * (2 * m - k)) / (k + 1);
    }
    return (Math.PI * center) / Math.pow(4, m);
}

/** Build weight bars for the rule. */
function makeBars(weights: number[], active: number, done: boolean): VisualEntity[] {
    return weights.map((weight, index) => ({
        id: `bar-${index}`,
        type: "bar" as const,
        label: weight.toFixed(5),
        value: weight,
        state: done ? ("sorted" as EntityState) : index === active ? ("comparing" as EntityState) : ("idle" as EntityState),
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { index, weight, nodeIndex: index + 1 },
    }));
}

/** Largest exactness error over T_0 through T_(2n-1). */
function maxExactnessError(n: number): number {
    let worst = 0;
    for (let k = 0; k <= 2 * n - 1; k += 1) {
        let sum = 0;
        for (let i = 1; i <= n; i += 1) {
            sum += Math.cos(k * ((Math.PI * (2 * i - 1)) / (2 * n)));
        }
        const quadrature = (Math.PI / n) * sum;
        const exact = k === 0 ? Math.PI : 0;
        worst = Math.max(worst, Math.abs(quadrature - exact));
    }
    return worst;
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as Input | null) ?? {};
    const n = typeof task.nodes === "number" && Number.isFinite(task.nodes)
        ? Math.max(2, Math.min(8, Math.round(task.nodes)))
        : DEFAULT_NODES;
    const power = typeof task.samplePower === "number" && Number.isFinite(task.samplePower)
        ? Math.max(0, Math.min(2 * n - 1, Math.round(task.samplePower)))
        : Math.min(DEFAULT_POWER, 2 * n - 1);

    const weights = Array.from({ length: n }, () => Math.PI / n);
    const nodes = Array.from({ length: n }, (_, i) => nodeAt(i + 1, n));
    const exact = exactMoment(power);
    const errorBound = maxExactnessError(n);
    let running = 0;

    const meta = (active: number, done: boolean) => ({
        nodes,
        weights: [...weights],
        nodesCount: n,
        weight: Math.PI / n,
        samplePower: power,
        sampleExact: exact,
        sampleEstimate: running,
        sampleError: Math.abs(running - exact),
        maxExactnessError: errorBound,
        active,
        done,
    });

    yield {
        stepNumber: 0,
        entities: makeBars(weights, -1, false),
        edges: [],
        description: `Gauss-Chebyshev rule with ${n} nodes; every weight is pi/${n}.`,
        codeLineNumber: 0,
        layout: "array",
        meta: meta(-1, false),
    };

    let step = 1;
    for (let i = 0; i < n; i += 1) {
        const node = nodes[i] ?? 0;
        const contribution = (weights[i] ?? 0) * Math.pow(node, power);
        running += contribution;
        yield {
            stepNumber: step,
            entities: makeBars(weights, i, false),
            edges: [],
            description: `Node ${i + 1} at cos(${(Math.PI * (2 * (i + 1) - 1)) / (2 * n)}) = ${node.toFixed(5)} contributes weight times x^${power} = ${contribution.toFixed(6)}.`,
            codeLineNumber: i === n - 1 ? 4 : 3,
            layout: "array",
            meta: meta(i, false),
        };
        step += 1;
    }

    yield {
        stepNumber: step,
        entities: makeBars(weights, -1, true),
        edges: [],
        description: `Integral of x^${power} over the Chebyshev weight is ${running.toFixed(8)} versus exact ${exact.toFixed(8)}; all degrees up to ${2 * n - 1} are exact.`,
        codeLineNumber: 6,
        layout: "array",
        meta: meta(-1, true),
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Integrating against the Chebyshev weight is like averaging a function over angles instead of over x. Buy placing the sample angles evenly around a half circle, the trapezoid rule becomes extraordinarily accurate: an n point rule gets every polynomial up to degree two n minus one exactly right, and all the weights are identical.",
        invariants: [
            "The nodes are the roots of the Chebyshev polynomial of degree n.",
            "Every weight equals pi divided by n.",
            "A polynomial of degree at most two n minus one is integrated exactly.",
        ],
        correctness:
            "Substitute x equals cosine theta, so dx over the square root of one minus x squared becomes minus d theta and the integral becomes the integral of f(cos theta) from zero to pi. The nodes correspond to the midpoints of n equal angular subintervals, so the rule is the midpoint trapezoid sum for a trigonometric polynomial. Because T_k(cos theta) equals cos of k theta, the first two n Fourier modes are integrated exactly by the trapezoid sum; any polynomial of degree two n minus one is a combination of those modes, which proves exactness.",
        complexityRationale:
            "Each node needs one cosine evaluation and one function evaluation, so forming and applying the rule costs O(n) time. Storing the n nodes and n equal weights uses O(n) space.",
        uses: [
            "Computing integrals with endpoint singularities of the form one over the square root",
            "Spectral methods that expand solutions in Chebyshev polynomials",
            "Evaluating expectation values over the arcsine distribution",
        ],
        references: [
            "Trefethen, Approximation Theory and Approximation Practice, chapter on Chebyshev integration",
            "Abramowitz and Stegun, Handbook of Mathematical Functions, section on Gaussian quadrature",
        ],
        workedExample:
            "For n equals two the nodes are cosine of pi over four and cosine of three pi over four, namely plus and minus 0.7071, and both weights are pi over two. Integrating x squared gives pi over two times 0.5 twice, which is pi over four, matching the exact moment pi times one half divided by two.",
    },
    id: "gauss-chebyshev",
    name: "Gauss-Chebyshev Quadrature",
    category: "numerical-optimization",
    complexity: { time: "O(n)", space: "O(n)" },
    defaultInput: { nodes: 4, samplePower: 4 },
    visualType: "array",
    run,
    pseudocode: [
        "choose the number of nodes n",
        "for i from 1 to n set node i to cos((2i-1)pi/(2n))",
        "set every weight to pi/n",
        "initialize the quadrature sum to zero",
        "for each node add weight times f(node) to the sum",
        "compare the sum with the exact moment of a test monomial",
        "verify exactness on Chebyshev polynomials up to degree 2n-1",
        "done: report nodes, weights, and the exactness error",
    ],
};

export default module;
