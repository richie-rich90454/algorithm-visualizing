/**
 * durand-kerner.ts - Durand-Kerner Simultaneous Polynomial Root Finder
 *
 * Finds every root of a monic real polynomial at once by iterating
 * z_i <- z_i - p(z_i) / product_{j != i} (z_i - z_j). Complex arithmetic is
 * used throughout because nonreal roots appear in conjugate pairs. This is the
 * Weierstrass method; it is distinct from single-root solvers such as Newton or
 * Halley and from deflation-based quadratic factoring.
 *
 * This is an idealized exact-arithmetic simulation on small polynomials. It
 * does not model floating-point selection rules used in production packages,
 * and it assumes a monic polynomial with simple roots.
 *
 * Time:  O(iterations * n^2) complex operations for degree n
 * Space: O(n) for the root estimates
 */

import type { AlgorithmModule, VisualEntity, VisualFrame } from "@/types";

type Complex = [number, number];

interface RootInput {
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
    if (d === 0) return [0, 0];
    return [(a[0] * b[0] + a[1] * b[1]) / d, (a[1] * b[0] - a[0] * b[1]) / d];
}

function cAbs(a: Complex): number {
    return Math.hypot(a[0], a[1]);
}

/** Horner evaluation with complex z; coefficients[0] is the leading term. */
function evaluate(coeff: number[], z: Complex): Complex {
    let p: Complex = [coeff[0] ?? 1, 0];
    for (let i = 1; i < coeff.length; i += 1) {
        p = cAdd(cMul(p, z), [coeff[i] ?? 0, 0]);
    }
    return p;
}

function makeEntities(roots: Complex[], highlight: number, final: boolean): VisualEntity[] {
    return roots.map((z, i) => ({
        id: `root-${i}`,
        type: "node" as const,
        label: `${z[0].toFixed(3)}${z[1] >= 0 ? "+" : ""}${z[1].toFixed(3)}i`,
        value: [z[0], z[1]],
        state: final ? "sorted" : i === highlight ? "comparing" : "idle",
        x: z[0],
        y: z[1],
        width: 0,
        height: 0,
        metadata: { index: i, re: z[0], im: z[1] },
    }));
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as RootInput | null) ?? {};
    const raw = Array.isArray(task.coefficients) && task.coefficients.length >= 2
        ? task.coefficients.map((c) => Number(c) || 0)
        : [1, -6, 11, -6];
    const coeff = raw[0] === 0 ? [1, ...raw.slice(1)] : raw;
    const iterations = Math.min(200, Math.max(1, Math.floor(Number(task.iterations ?? 60)) || 60));
    const n = coeff.length - 1;

    const seeds: Complex[] = [];
    let seed: Complex = [0.4, 0.9];
    for (let i = 0; i < n; i += 1) {
        seeds.push(i === 0 ? [1, 0] : seed);
        seed = cMul(seed, [0.4, 0.9]);
    }
    let roots = seeds.map((z) => [...z] as Complex);

    const residual = () => roots.reduce((m, z) => Math.max(m, cAbs(evaluate(coeff, z))), 0);
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
        description: `Find all ${n} roots of the degree-${n} polynomial with the Durand-Kerner simultaneous iteration.`,
        codeLineNumber: 0,
        layout: "point",
        meta: metaFor(0, -1, false),
    };
    step += 1;

    for (let iter = 0; iter < iterations; iter += 1) {
        const next: Complex[] = roots.map((z, i) => {
            let denom: Complex = [1, 0];
            for (let j = 0; j < n; j += 1) {
                if (j === i) continue;
                denom = cMul(denom, cSub(z, roots[j] as Complex));
            }
            if (cAbs(denom) < 1e-14) return z;
            return cSub(z, cDiv(evaluate(coeff, z), denom));
        });
        const changed = roots.reduce((m, z, i) => Math.max(m, cAbs(cSub(z, next[i] as Complex))), 0);
        roots = next;
        yield {
            stepNumber: step,
            entities: makeEntities(roots, iter % n, false),
            edges: [],
            description: `Iteration ${iter + 1}: updating every root estimate at once; largest polynomial residual ${residual().toExponential(2)}.`,
            codeLineNumber: iter === 0 ? 2 : 3,
            layout: "point",
            meta: metaFor(iter + 1, iter % n, false),
        };
        step += 1;
        if (residual() < 1e-12 && changed < 1e-9) break;
    }

    yield {
        stepNumber: step,
        entities: makeEntities(roots, -1, true),
        edges: [],
        description: `Final estimates: ${roots.map((z) => `(${z[0].toFixed(4)}, ${z[1].toFixed(4)})`).join(", ")}; largest residual ${residual().toExponential(2)}.`,
        codeLineNumber: 5,
        layout: "point",
        meta: metaFor(iterations, -1, true),
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Instead of chasing one root at a time, keep an estimate for every root and improve them all together. Each estimate is pushed by Newton's correction divided by the product of its distances to the other estimates. Different starting guesses spread out and settle onto different roots, including complex conjugate pairs.",
        invariants: [
            "There is exactly one running estimate for each degree of the polynomial.",
            "A root estimate is only moved by its own Newton-like correction, so the estimates stay distinct.",
            "When the estimates settle, each one makes the polynomial evaluate to nearly zero.",
        ],
        correctness:
            "For a monic polynomial p with simple roots r_i, the simultaneous update is Newton's method applied to the Vieta system whose equations match the elementary symmetric functions of the roots. The Jacobian of that system is the product of pairwise differences, giving the update z_i - p(z_i) / prod_{j != i}(z_i - z_j). Near simple roots this iteration is quadratically convergent, and distinct seed points converge to distinct roots, so the final estimates are the full root set.",
        complexityRationale:
            "Each iteration evaluates the degree-n polynomial for each of the n estimates and forms n products of n-1 factors, so the work is O(iterations * n^2) complex operations. Only the n estimates and the coefficient array are stored, giving O(n) space.",
        uses: [
            "Finding all roots of a characteristic polynomial in control theory",
            "Initializing eigenvalue algorithms for small companion matrices",
            "Solving polynomial equations in computer-aided design and signal processing",
        ],
        references: [
            "Weierstrass, Sur la determination des racines d'une equation, 1891",
            "Press et al., Numerical Recipes, Chapter 9, 2007",
        ],
        workedExample:
            "For p(x) = x cubed minus 6 x squared plus 11 x minus 6, the distinct seeds spread to the estimates 1, 2, and 3. Substituting each value makes p vanish, so the three real roots are recovered. For p(x) = x squared plus 1 the estimates settle on plus i and minus i.",
    },
    id: "durand-kerner",
    name: "Durand-Kerner Root Finder",
    category: "numerical-optimization",
    complexity: { time: "O(iterations * n^2)", space: "O(n)" },
    defaultInput: { coefficients: [1, -6, 11, -6], iterations: 60 },
    visualType: "point",
    run,
    pseudocode: [
        "read the monic polynomial coefficients of degree n",
        "seed n distinct complex starting points",
        "for each iteration and each root estimate",
        "evaluate the polynomial at the estimate",
        "divide by the product of differences to the other estimates",
        "subtract that correction from the estimate",
        "replace all estimates simultaneously",
        "stop when every residual is below tolerance",
        "done: report all n complex roots",
    ],
};

export default module;
