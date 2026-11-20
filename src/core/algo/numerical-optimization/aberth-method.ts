/**
 * aberth-method.ts - Aberth-Ehrlich Simultaneous Polynomial Root Finder
 *
 * The Aberth method improves every root estimate at once. Each correction is
 * the Newton step p(z)/p'(z) divided by one minus that step times the sum of
 * reciprocals of the distances to the other estimates. The extra denominator
 * term repels estimates from one another, which keeps them from collapsing
 * onto the same root and gives cubic local convergence.
 *
 * This is an idealized exact-arithmetic simulation on small monic polynomials
 * with simple roots. It uses complex arithmetic throughout so conjugate pairs
 * are represented faithfully. It does not implement the root selection,
 * deflation, or rounding safeguards of production polynomial solvers.
 *
 * Time:  O(iterations * n^2) complex operations for degree n
 * Space: O(n) for the estimates and their derivative values
 */

import type { AlgorithmModule, VisualEntity, VisualFrame } from "@/types";

type Complex = [number, number];

interface AberthInput {
    coefficients?: number[];
    iterations?: number;
}

function cAdd(a: Complex, b: Complex): Complex {
    return [a[0] + b[0], a[1] + b[1]];
}

function cSub(a: Complex, b: Complex): Complex {
    return [a[0] - b[0], a[1] - b[1]];
}

function cMul(a: Complex, b: Complex): Complex {
    return [a[0] * b[0] - a[1] * b[1], a[0] * b[1] + a[1] * b[0]];
}

function cDiv(a: Complex, b: Complex): Complex {
    const d = b[0] * b[0] + b[1] * b[1];
    if (d === 0) {
        return [0, 0];
    }
    return [(a[0] * b[0] + a[1] * b[1]) / d, (a[1] * b[0] - a[0] * b[1]) / d];
}

function cScale(a: Complex, s: number): Complex {
    return [a[0] * s, a[1] * s];
}

function cAbs(a: Complex): number {
    return Math.hypot(a[0], a[1]);
}

/** Horner evaluation of a polynomial whose first coefficient is the leading term. */
function evaluate(coeff: number[], z: Complex): Complex {
    let p: Complex = [coeff[0] ?? 1, 0];
    for (let i = 1; i < coeff.length; i += 1) {
        p = cAdd(cMul(p, z), [coeff[i] ?? 0, 0]);
    }
    return p;
}

/** Derivative coefficients of the polynomial. */
function derivative(coeff: number[]): number[] {
    const n = coeff.length - 1;
    return coeff.slice(0, -1).map((c, i) => c * (n - i));
}

function makeEntities(roots: Complex[], highlight: number, final: boolean): VisualEntity[] {
    return roots.map((z, index) => ({
        id: `root-${index}`,
        type: "node" as const,
        label: `${z[0].toFixed(3)}${z[1] >= 0 ? "+" : ""}${z[1].toFixed(3)}i`,
        value: [z[0], z[1]],
        state: final ? "sorted" : index === highlight ? "comparing" : "idle",
        x: z[0],
        y: z[1],
        width: 0,
        height: 0,
        metadata: { index, re: z[0], im: z[1] },
    }));
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as AberthInput | null) ?? {};
    const raw = Array.isArray(task.coefficients) && task.coefficients.length >= 2
        ? task.coefficients.map((c) => Number(c) || 0)
        : [1, -6, 11, -6];
    const coeff = raw[0] === 0 ? [1, ...raw.slice(1)] : raw;
    const iterations = Math.min(200, Math.max(1, Math.floor(Number(task.iterations ?? 60)) || 60));
    const n = coeff.length - 1;
    const dcoeff = derivative(coeff);

    const seeds: Complex[] = [];
    let seed: Complex = [0.4, 0.9];
    for (let i = 0; i < n; i += 1) {
        seeds.push(i === 0 ? [1, 0] : seed);
        seed = cMul(seed, [0.4, 0.9]);
    }
    let roots = seeds.map((z) => [...z] as Complex);

    const residual = () => roots.reduce((max, z) => Math.max(max, cAbs(evaluate(coeff, z))), 0);
    const metaFor = (iteration: number, highlight: number, final: boolean) => ({
        degree: n,
        iteration,
        roots: roots.map((z) => [z[0], z[1]]),
        maxResidual: residual(),
        highlight,
        done: final,
    });
    let step = 0;

    yield {
        stepNumber: step,
        entities: makeEntities(roots, -1, false),
        edges: [],
        description: `Find all ${n} roots of the degree-${n} polynomial using Aberth-Ehrlich simultaneous updates.`,
        codeLineNumber: 0,
        layout: "point",
        meta: metaFor(0, -1, false),
    };
    step += 1;

    for (let iter = 0; iter < iterations; iter += 1) {
        const next = roots.map((z, i) => {
            const p = evaluate(coeff, z);
            const dp = evaluate(dcoeff, z);
            if (cAbs(dp) < 1e-14) {
                return z;
            }
            const newton = cDiv(p, dp);
            let sum: Complex = [0, 0];
            for (let j = 0; j < n; j += 1) {
                if (j === i) {
                    continue;
                }
                const diff = cSub(z, roots[j] as Complex);
                if (cAbs(diff) < 1e-14) {
                    continue;
                }
                sum = cAdd(sum, cDiv([1, 0], diff));
            }
            const denominator = cSub([1, 0], cMul(newton, sum));
            if (cAbs(denominator) < 1e-14) {
                return z;
            }
            return cSub(z, cDiv(newton, denominator));
        });
        const changed = roots.reduce(
            (max, z, i) => Math.max(max, cAbs(cSub(z, next[i] as Complex))),
            0,
        );
        roots = next;
        yield {
            stepNumber: step,
            entities: makeEntities(roots, iter % n, false),
            edges: [],
            description: `Iteration ${iter + 1}: repel estimates apart and apply the corrected Newton step; largest residual ${residual().toExponential(2)}.`,
            codeLineNumber: iter === 0 ? 3 : 5,
            layout: "point",
            meta: metaFor(iter + 1, iter % n, false),
        };
        step += 1;
        if (residual() < 1e-12 && changed < 1e-9) {
            break;
        }
    }

    yield {
        stepNumber: step,
        entities: makeEntities(roots, -1, true),
        edges: [],
        description: `Final estimates: ${roots.map((z) => `(${z[0].toFixed(4)}, ${z[1].toFixed(4)})`).join(", ")}; largest residual ${residual().toExponential(2)}.`,
        codeLineNumber: 7,
        layout: "point",
        meta: metaFor(iterations, -1, true),
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Newton's method chases one root at a time and can be pulled back onto a root another estimate already found. Aberth's idea is to run a Newton step for every estimate simultaneously, then divide that step by a repulsion term built from the distances to all other estimates. Estimates that drift toward each other get a large correction pushing them apart, so different seeds settle on different roots, including complex conjugate pairs.",
        invariants: [
            "There is exactly one running estimate for each degree of the polynomial.",
            "The correction depends on all other estimates, so updates are applied simultaneously.",
            "When the iteration settles, every estimate makes the polynomial evaluate to nearly zero.",
        ],
        correctness:
            "Near a simple root the map is Newton's method multiplied by a factor that is one at a distinct root and grows as estimates approach each other. The fixed points are therefore the n distinct roots of the polynomial, and the Jacobian vanishes there, giving local cubic convergence for the simultaneous scheme. Distinct initial seeds converge to distinct simple roots, so the final set is the complete root set.",
        complexityRationale:
            "Each iteration evaluates the polynomial and its derivative at n estimates and forms, for each estimate, a sum over the n minus one other estimates, so the work is O(iterations * n^2) complex operations. Storing the estimates and derivative coefficients uses O(n) space.",
        uses: [
            "Finding all roots of small polynomials in control theory and filter design",
            "Initializing eigenvalue computations through characteristic polynomials",
            "Solving polynomial systems in computer-aided geometric design",
        ],
        references: [
            "Aberth, Iteration Methods for Finding All Zeros of a Polynomial, 1973",
            "Ehrlich, A Modified Newton Method for Polynomials, 1967",
        ],
        workedExample:
            "For p(x) = x cubed minus 6 x squared plus 11 x minus 6, the estimates settle on 1, 2, and 3; substituting each makes p vanish. For p(x) = x squared plus 1, the two estimates settle on plus i and minus i, the conjugate pair, with the repulsion term keeping them apart.",
    },
    id: "aberth-method",
    name: "Aberth-Ehrlich Root Finder",
    category: "numerical-optimization",
    complexity: { time: "O(iterations * n^2)", space: "O(n)" },
    defaultInput: { coefficients: [1, -6, 11, -6], iterations: 60 },
    visualType: "point",
    run,
    pseudocode: [
        "read the monic polynomial coefficients of degree n",
        "form the derivative coefficients",
        "seed n distinct complex starting estimates",
        "for each iteration and each estimate",
        "compute the Newton step p over p prime",
        "sum the reciprocals of distances to all other estimates",
        "divide the Newton step by one minus that step times the sum",
        "subtract the corrected step from the estimate simultaneously",
        "stop when every residual is below tolerance",
        "done: report all n complex roots",
    ],
};

export default module;
