/**
 * gauss-hermite.ts - Gauss-Hermite Quadrature
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Gauss-Hermite quadrature approximates integrals of f(x) exp(-x^2) over the
 * whole real line by a weighted sum of function values at n carefully chosen
 * nodes. The nodes are the roots of the physicists' Hermite polynomial H_n and
 * the weights come from the derivative there. An n point rule integrates every
 * polynomial of degree at most 2n-1 exactly, so it is the natural choice for
 * Gaussian expectation values.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 *   Time:  O(n^2) for the bracketed root search and O(n) for the sum
 *   Space: O(n) for the nodes and weights
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 *   - One bar per node shows its quadrature weight.
 *   - The node currently contributing to the running integral is yellow.
 *   - The final frame is green and carries the moment exactness error.
 *
 * This module uses a bracketed bisection on a tiny Hermite polynomial, so it
 * is an exact small computation for at most six nodes; it is not an asymptotic
 * large-n implementation.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface Input {
    nodes?: number;
    samplePower?: number;
}

const DEFAULT_NODES = 3;
const DEFAULT_POWER = 4;

/** Evaluate the physicists' Hermite polynomial H_degree at x. */
function hermite(degree: number, x: number): number {
    let previous = 1;
    let current = 2 * x;
    if (degree === 0) {
        return previous;
    }
    for (let k = 1; k < degree; k += 1) {
        const next = 2 * x * current - 2 * k * previous;
        previous = current;
        current = next;
    }
    return current;
}

/** Find all n roots of H_n by scanning a bracket and bisecting each sign change. */
function hermiteRoots(n: number): number[] {
    const bound = Math.sqrt(2 * n + 1) + 1;
    const steps = 4000;
    const roots: number[] = [];
    let left = -bound;
    let leftValue = hermite(n, left);
    for (let s = 1; s <= steps && roots.length < n; s += 1) {
        const right = -bound + (2 * bound * s) / steps;
        const rightValue = hermite(n, right);
        if (leftValue === 0) {
            roots.push(left);
        } else if (leftValue * rightValue < 0) {
            let a = left;
            let b = right;
            let fa = leftValue;
            for (let k = 0; k < 100; k += 1) {
                const mid = (a + b) / 2;
                const fm = hermite(n, mid);
                if (fa * fm <= 0) {
                    b = mid;
                } else {
                    a = mid;
                    fa = fm;
                }
            }
            roots.push((a + b) / 2);
        }
        left = right;
        leftValue = rightValue;
    }
    return roots.sort((a, b) => a - b).slice(0, n);
}

/** Exact integral of x^power exp(-x^2) on the real line. */
function exactMoment(power: number): number {
    if (power % 2 !== 0) {
        return 0;
    }
    const m = power / 2;
    let oddDoubleFactorial = 1;
    for (let j = 1; j <= m; j += 1) {
        oddDoubleFactorial *= 2 * j - 1;
    }
    return (Math.sqrt(Math.PI) * oddDoubleFactorial) / Math.pow(2, m);
}

/** Largest moment error over degrees zero through 2n-1. */
function maxMomentError(nodes: number[], weights: number[], n: number): number {
    let worst = 0;
    for (let p = 0; p <= 2 * n - 1; p += 1) {
        let sum = 0;
        for (let i = 0; i < nodes.length; i += 1) {
            sum += (weights[i] ?? 0) * Math.pow(nodes[i] ?? 0, p);
        }
        worst = Math.max(worst, Math.abs(sum - exactMoment(p)));
    }
    return worst;
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
        metadata: { index, weight },
    }));
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as Input | null) ?? {};
    const n = typeof task.nodes === "number" && Number.isFinite(task.nodes)
        ? Math.max(2, Math.min(6, Math.round(task.nodes)))
        : DEFAULT_NODES;
    const power = typeof task.samplePower === "number" && Number.isFinite(task.samplePower)
        ? Math.max(0, Math.min(2 * n - 1, Math.round(task.samplePower)))
        : Math.min(DEFAULT_POWER, 2 * n - 1);

    const rootList = hermiteRoots(n);
    const nodes = Array.from({ length: n }, (_, i) => rootList[i] ?? 0);
    const factorial = Array.from({ length: n + 1 }, (_, k) => {
        let value = 1;
        for (let j = 2; j <= k; j += 1) {
            value *= j;
        }
        return value;
    });
    const weights = nodes.map((node) => {
        const previous = hermite(n - 1, node);
        const numerator = Math.pow(2, n - 1) * (factorial[n] ?? 1) * Math.sqrt(Math.PI);
        return numerator / (n * n * previous * previous);
    });
    const exact = exactMoment(power);
    const errorBound = maxMomentError(nodes, weights, n);
    let running = 0;

    const meta = (active: number, done: boolean) => ({
        nodes,
        weights: [...weights],
        nodesCount: n,
        samplePower: power,
        sampleExact: exact,
        sampleEstimate: running,
        sampleError: Math.abs(running - exact),
        maxMomentError: errorBound,
        active,
        done,
    });

    yield {
        stepNumber: 0,
        entities: makeBars(weights, -1, false),
        edges: [],
        description: `Gauss-Hermite rule with ${n} nodes found as roots of H_${n}.`,
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
            description: `Node ${i + 1} at ${node.toFixed(6)} with weight ${(weights[i] ?? 0).toFixed(6)} contributes x^${power} = ${contribution.toFixed(6)}.`,
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
        description: `Integral of x^${power} exp(-x^2) is ${running.toFixed(8)} versus exact ${exact.toFixed(8)}; all moments through degree ${2 * n - 1} are exact.`,
        codeLineNumber: 6,
        layout: "array",
        meta: meta(-1, true),
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "A Gaussian weight makes ordinary integration formulas waste effort near the tails, where the function is almost zero. Gauss-Hermite instead places nodes at the roots of a Hermite polynomial, clustering them where the Gaussian mass lives. With n nodes it reproduces every polynomial moment up to degree two n minus one, which is why it is the standard tool for Gaussian integrals.",
        invariants: [
            "The nodes are the roots of the physicists' Hermite polynomial of degree n.",
            "Each weight equals two to the n minus one times n factorial times the square root of pi, divided by n squared times the square of the derivative at the node.",
            "The weights sum to the square root of pi, the integral of the Gaussian weight.",
        ],
        correctness:
            "Orthogonal-polynomial theory states that the n point Gaussian rule for a positive weight has nodes at the roots of the degree n orthogonal polynomial and exactness degree two n minus one. For the Gaussian weight those polynomials are the Hermite polynomials, and the Christoffel number formula gives the weights used here. Bracketed bisection finds each simple real root because consecutive Hermite polynomials interlace, so the constructed rule is the unique exact rule of that degree.",
        complexityRationale:
            "Scanning a fixed bracket and bisecting each of the n roots costs O(n) evaluations times a constant number of iterations, and applying the rule is another O(n) function evaluations. Nodes and weights use O(n) space.",
        uses: [
            "Computing Gaussian expectation values in statistics and physics",
            "Evaluating integrals in computational quantum chemistry",
            "Unscented Kalman filters and Gaussian quadrature transforms",
        ],
        references: [
            "Abramowitz and Stegun, Handbook of Mathematical Functions, section on Gaussian quadrature",
            "Golub and Welsch, Calculation of Gaussian Quadrature Nodes and Weights, 1969",
        ],
        workedExample:
            "For n equals two the nodes are plus and minus 0.7071 and each weight is the square root of pi divided by two. The integral of x squared times exp(-x^2) is therefore twice that weight times one half, giving the square root of pi over two, which matches the exact second moment.",
    },
    id: "gauss-hermite",
    name: "Gauss-Hermite Quadrature",
    category: "numerical-optimization",
    complexity: { time: "O(n^2)", space: "O(n)" },
    defaultInput: { nodes: 3, samplePower: 4 },
    visualType: "array",
    run,
    pseudocode: [
        "choose the number of nodes n",
        "bracket the n roots of the Hermite polynomial H_n",
        "refine each root by bisection on its sign change",
        "set weight i from the derivative H_(n-1) at root i",
        "initialize the quadrature sum to zero",
        "for each node add weight times f(node) to the sum",
        "compare the sum with the exact moment of a test monomial",
        "done: report nodes, weights, and the moment error",
    ],
};

export default module;
