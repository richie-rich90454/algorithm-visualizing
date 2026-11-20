/**
 * gaussian-quadrature.ts - Gauss-Legendre Quadrature
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Gauss-Legendre quadrature approximates an integral on the interval minus one
 * to one by a weighted sum of function values at carefully chosen nodes. The
 * nodes are roots of the Legendre polynomial of degree n and the weights come
 * from its derivative there. An n-point rule integrates every polynomial of
 * degree at most 2n - 1 exactly, which is twice the accuracy of Newton-Cotes
 * formulas with the same number of points.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(n^2) to find the n roots by Newton iteration
 *   Space: O(n) for the nodes and weights
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Nodes are plotted as points on the interval; height encodes the weight.
 *   - A point turns yellow while Newton iteration refines it, green when done.
 *   - Frame metadata carries the nodes, weights, and a sample integral.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

/** Evaluate the Legendre polynomial P_degree at x by the standard recurrence. */
function legendre(degree: number, x: number): number {
    let previous = 1;
    let current = x;
    if (degree === 0) {
        return previous;
    }
    for (let k = 2; k <= degree; k += 1) {
        const next = ((2 * k - 1) * x * current - (k - 1) * previous) / k;
        previous = current;
        current = next;
    }
    return current;
}

/** Derivative of P_degree at x using the Legendre differential relation. */
function legendreDerivative(degree: number, x: number): number {
    const denominator = 1 - x * x;
    if (Math.abs(denominator) < 1e-14) {
        return Number.NaN;
    }
    return (degree * (legendre(degree - 1, x) - x * legendre(degree, x))) / denominator;
}

/** Solve for the n Gauss-Legendre nodes and weights on minus one to one. */
function quadrature(n: number): { nodes: number[]; weights: number[]; traces: Array<{ root: number; guesses: number[] }> } {
    const nodes: number[] = [];
    const weights: number[] = [];
    const traces: Array<{ root: number; guesses: number[] }> = [];
    for (let i = 1; i <= n; i += 1) {
        let x = Math.cos((Math.PI * (i - 0.25)) / (n + 0.5));
        const guesses: number[] = [x];
        for (let step = 0; step < 20; step += 1) {
            const derivative = legendreDerivative(n, x);
            if (!Number.isFinite(derivative) || derivative === 0) {
                break;
            }
            const next = x - legendre(n, x) / derivative;
            guesses.push(next);
            if (Math.abs(next - x) < 1e-14) {
                x = next;
                break;
            }
            x = next;
        }
        const derivative = legendreDerivative(n, x);
        const weight = 2 / ((1 - x * x) * derivative * derivative);
        nodes.push(x);
        weights.push(weight);
        traces.push({ root: x, guesses });
    }
    return { nodes, weights, traces };
}

/** Build point entities for the quadrature nodes. */
function makeNodes(
    nodes: number[],
    weights: number[] | null,
    active: number | null,
    state: EntityState,
): VisualEntity[] {
    return nodes.map((node, index) => {
        const y = weights ? (weights[index] ?? 0) : 0;
        return {
            id: `node-${index}`,
            type: "node" as const,
            label: weights
                ? `${node.toFixed(3)} w=${(weights[index] ?? 0).toFixed(3)}`
                : node.toFixed(4),
            value: node,
            state: index === active ? state : weights ? "sorted" : "idle",
            x: node,
            y,
            width: 0,
            height: 0,
            metadata: { index, node, weight: y },
        };
    });
}

/** The Gauss-Legendre quadrature generator. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { n?: number } | null) ?? {};
    const n = typeof task.n === "number" && task.n >= 2 && task.n <= 5 ? Math.floor(task.n) : 2;
    const { nodes, weights, traces } = quadrature(n);
    const sample = quadrature(n);
    const integral = sample.nodes.reduce(
        (sum, node, i) => sum + (sample.weights[i] ?? 0) * node * node,
        0,
    );
    let frame = 0;

    yield {
        stepNumber: frame,
        entities: makeNodes(traces.map((t) => t.guesses[0] ?? 0), null, null, "idle"),
        edges: [],
        description: `Building an ${n}-point Gauss-Legendre rule; initial root guesses are shown.`,
        codeLineNumber: 0,
        layout: "point",
        meta: { nodes: traces.map((t) => t.guesses[0] ?? 0), weights: [], integral: 0, iteration: 0 },
    };
    frame += 1;

    let iteration = 0;
    for (let i = 0; i < traces.length; i += 1) {
        const guesses = traces[i]?.guesses ?? [];
        for (let step = 1; step < guesses.length; step += 1) {
            const partial = traces.map((trace, j) => (j < i ? (trace.root ?? 0) : (guesses[step] ?? 0)));
            iteration += 1;
            yield {
                stepNumber: frame,
                entities: makeNodes(partial, null, i, "comparing"),
                edges: [],
                description: `Newton step ${step} refines root ${i} of the degree ${n} Legendre polynomial.`,
                codeLineNumber: 2,
                layout: "point",
                meta: { nodes: [...partial], weights: [], integral: 0, iteration },
            };
            frame += 1;
        }
    }

    yield {
        stepNumber: frame,
        entities: makeNodes(nodes, weights, null, "sorted"),
        edges: [],
        description: `Roots found; weights sum to ${weights.reduce((a, b) => a + b, 0).toFixed(6)}.`,
        codeLineNumber: 5,
        layout: "point",
        meta: { nodes: [...nodes], weights: [...weights], integral: 0, iteration },
    };
    frame += 1;

    yield {
        stepNumber: frame,
        entities: makeNodes(nodes, weights, null, "sorted"),
        edges: [],
        description: `Integrating x squared gives ${integral.toFixed(9)}, which is exactly 2/3 for n >= 2.`,
        codeLineNumber: 7,
        layout: "point",
        meta: { nodes: [...nodes], weights: [...weights], integral, iteration },
    };
}

/** The Gauss-Legendre quadrature module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "Pick the sample points and weights so the weighted sum is exact for polynomials up to as high a degree as possible. Those points are the roots of a Legendre polynomial. A two-point rule integrates all cubics exactly, which is why it beats equally spaced formulas with the same effort.",
        invariants: [
            "The nodes lie strictly inside the interval minus one to one.",
            "All weights are positive and their sum is two.",
            "An n-point rule is exact for every polynomial of degree at most 2n - 1.",
        ],
        correctness:
            "The Legendre polynomials are orthogonal on the interval, and the n-point Gaussian rule is the unique interpolatory rule whose nodes are the roots of P_n. For any polynomial p of degree at most 2n - 1, divide p by P_n to get p = q P_n + r with both remainders of degree below n. The rule integrates q P_n as zero because q is integrated exactly and P_n is orthogonal to all lower-degree polynomials, and it integrates r exactly by interpolation. Hence the rule is exact up to degree 2n - 1.",
        complexityRationale:
            "Each of the n roots needs a short Newton iteration, and each evaluation of the Legendre recurrence costs O(n), giving O(n^2) time. The nodes and weights occupy O(n) space.",
        uses: [
            "Numerical integration in finite element methods",
            "Gaussian cubature inside physics and engineering solvers",
            "High-order quadrature in scientific libraries",
        ],
        references: [
            "Gauss, Methodus nova integralium valores per approximationem inveniendi, 1815",
            "Abramowitz and Stegun, Handbook of Mathematical Functions, Chapter 25",
        ],
        workedExample:
            "The two-point rule uses nodes plus and minus 0.577350 and weights one and one. Integrating x squared gives 0.333333 + 0.333333 = 0.666667, which is exactly two thirds.",
    },
    id: "gaussian-quadrature",
    name: "Gaussian Quadrature",
    category: "numerical-optimization",
    complexity: { time: "O(n^2)", space: "O(n)" },
    defaultInput: { n: 2 },
    visualType: "point",
    run,
    pseudocode: [
        "choose the number of quadrature points n",
        "for each root start from a cosine guess",
        "refine the root by Newton iteration on P sub n",
        "compute the weight from the derivative at the root",
        "store the node and its weight",
        "sum weights times function values to integrate",
        "check that the weights sum to two",
        "done: report the nodes, weights, and integral",
    ],
};

export default module;
