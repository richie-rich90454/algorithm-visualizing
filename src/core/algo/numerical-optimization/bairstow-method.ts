/**
 * bairstow-method.ts - Bairstow's Quadratic Factor Method
 *
 * Bairstow's method extracts a quadratic factor x^2 - R x - S from a real
 * polynomial by applying Newton's method to the two remainder coefficients
 * left by synthetic division. Once a factor converges it is divided out and
 * the process repeats on the reduced polynomial, so a real polynomial of any
 * degree is peeled into quadratic factors and their roots, including complex
 * conjugate pairs that a real linear solver cannot see.
 *
 * This is an idealized exact-arithmetic simulation on small monic polynomials
 * with well separated roots. It assumes convergence from the supplied initial
 * R and S; it does not implement perturbed restarts, root polishing, or the
 * scaling heuristics used in production solvers.
 *
 * Time:  O(iterations * degree^2) for a full factorization
 * Space: O(degree) for the coefficient arrays and root list
 */

import type { AlgorithmModule, VisualEntity, VisualFrame } from "@/types";

interface BairstowInput {
    coefficients?: number[];
    r?: number;
    s?: number;
    iterations?: number;
}

interface Root {
    re: number;
    im: number;
}

interface Division {
    quotient: number[];
    r1: number;
    r0: number;
    cN2: number;
    cN3: number;
}

/** Synthetic division of coeff by x^2 - R x - S, plus the derivative table. */
function divide(coeff: number[], R: number, S: number): Division {
    const n = coeff.length - 1;
    const b = new Array<number>(n + 1).fill(0);
    for (let k = 0; k <= n - 2; k += 1) {
        b[k] =
            (coeff[k] ?? 0) +
            (k >= 1 ? R * (b[k - 1] ?? 0) : 0) +
            (k >= 2 ? S * (b[k - 2] ?? 0) : 0);
    }
    const r1 = (coeff[n - 1] ?? 0) + R * (b[n - 2] ?? 0) + (n >= 3 ? S * (b[n - 3] ?? 0) : 0);
    const r0 = (coeff[n] ?? 0) + S * (b[n - 2] ?? 0);

    const c = new Array<number>(n + 1).fill(0);
    c[0] = b[0] ?? 0;
    for (let k = 1; k <= n - 2; k += 1) {
        c[k] = (b[k] ?? 0) + R * (c[k - 1] ?? 0) + (k >= 2 ? S * (c[k - 2] ?? 0) : 0);
    }
    return {
        quotient: b.slice(0, n - 1),
        r1,
        r0,
        cN2: c[n - 2] ?? 0,
        cN3: n - 3 >= 0 ? (c[n - 3] ?? 0) : 0,
    };
}

/** Roots of the quadratic factor x^2 - R x - S. */
function quadraticRoots(R: number, S: number): [Root, Root] {
    const disc = R * R + 4 * S;
    if (disc >= 0) {
        const d = Math.sqrt(disc) / 2;
        return [
            { re: R / 2 + d, im: 0 },
            { re: R / 2 - d, im: 0 },
        ];
    }
    const im = Math.sqrt(-disc) / 2;
    return [
        { re: R / 2, im },
        { re: R / 2, im: -im },
    ];
}

function makeBars(R: number, S: number, residual: number, final: boolean): VisualEntity[] {
    const values = [R, S, residual];
    const labels = ["R", "S", "residual"];
    return values.map((value, index) => ({
        id: `bar-${index}`,
        type: "bar" as const,
        label: `${labels[index]}: ${value.toExponential(3)}`,
        value,
        state: final ? "sorted" : index === 2 ? "comparing" : "active",
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { index, role: labels[index] ?? "", indexValue: index },
    }));
}

function makeRootNodes(roots: Root[]): VisualEntity[] {
    return roots.map((root, index) => ({
        id: `root-${index}`,
        type: "node" as const,
        label: `${root.re.toFixed(3)}${root.im >= 0 ? "+" : ""}${root.im.toFixed(3)}i`,
        value: [root.re, root.im],
        state: "sorted" as const,
        x: root.re,
        y: root.im,
        width: 0,
        height: 0,
        metadata: { index, re: root.re, im: root.im },
    }));
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as BairstowInput | null) ?? {};
    const raw = Array.isArray(task.coefficients) && task.coefficients.length >= 3
        ? task.coefficients.map((c) => Number(c) || 0)
        : [1, -3, 3, -3, 2];
    let coeff = raw[0] === 0 ? [1, ...raw.slice(1)] : raw;
    const iterations = Math.min(100, Math.max(1, Math.floor(Number(task.iterations ?? 40)) || 40));
    let R = typeof task.r === "number" && Number.isFinite(task.r) ? task.r : 0.1;
    let S = typeof task.s === "number" && Number.isFinite(task.s) ? task.s : -0.9;

    const roots: Root[] = [];
    let step = 0;

    yield {
        stepNumber: step,
        entities: makeBars(R, S, 0, false),
        edges: [],
        description: `Factor the degree-${coeff.length - 1} polynomial into quadratics with Bairstow's method.`,
        codeLineNumber: 0,
        layout: "array",
        meta: { degree: coeff.length - 1, r: R, s: S, residual: 0, iteration: 0 },
    };
    step += 1;

    let guard = 0;
    while (coeff.length - 1 > 2 && guard < 20) {
        guard += 1;
        let division = divide(coeff, R, S);
        let iteration = 0;
        let residual = Math.abs(division.r1) + Math.abs(division.r0);
        for (; iteration < iterations && residual > 1e-12; iteration += 1) {
            const det = division.cN2 * division.cN2 - S * division.cN3 * division.cN3;
            if (Math.abs(det) < 1e-14) {
                break;
            }
            const dR = (division.r1 * division.cN2 - division.r0 * division.cN3) / det;
            const dS = (division.cN2 * division.r0 - S * division.cN3 * division.r1) / det;
            R -= dR;
            S -= dS;
            division = divide(coeff, R, S);
            residual = Math.abs(division.r1) + Math.abs(division.r0);
            yield {
                stepNumber: step,
                entities: makeBars(R, S, residual, false),
                edges: [],
                description: `Factor iteration ${iteration + 1}: R = ${R.toFixed(7)}, S = ${S.toFixed(7)}, remainder ${residual.toExponential(2)}.`,
                codeLineNumber: iteration === 0 ? 3 : 4,
                layout: "array",
                meta: {
                    degree: coeff.length - 1,
                    r: R,
                    s: S,
                    residual,
                    iteration: iteration + 1,
                    factor: guard,
                },
            };
            step += 1;
        }
        const pair = quadraticRoots(R, S);
        roots.push(pair[0], pair[1]);
        coeff = division.quotient;
        R = 0;
        S = 0;
    }

    if (coeff.length === 3) {
        const [a, b, c] = coeff as [number, number, number];
        const disc = b * b - 4 * a * c;
        if (disc >= 0) {
            roots.push({ re: (-b + Math.sqrt(disc)) / (2 * a), im: 0 });
            roots.push({ re: (-b - Math.sqrt(disc)) / (2 * a), im: 0 });
        } else {
            const im = Math.sqrt(-disc) / (2 * a);
            roots.push({ re: -b / (2 * a), im });
            roots.push({ re: -b / (2 * a), im: -im });
        }
    }

    yield {
        stepNumber: step,
        entities: makeRootNodes(roots),
        edges: [],
        description: `Recovered ${roots.length} roots by successive quadratic deflation: ${roots.map((root) => `${root.re.toFixed(3)}${root.im >= 0 ? "+" : ""}${root.im.toFixed(3)}i`).join(", ")}.`,
        codeLineNumber: 7,
        layout: "point",
        meta: {
            roots: roots.map((root) => [root.re, root.im]),
            count: roots.length,
            degree: raw.length - 1,
            done: true,
        },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "A real polynomial can hide complex roots, so peeling off one linear factor at a time stalls at a negative discriminant. Bairstow instead fits a quadratic factor at a time. Synthetic division by a candidate quadratic leaves a small linear remainder; Newton's method adjusts the two coefficients of that quadratic until the remainder vanishes. Divide it out and repeat until only a final quadratic remains, then solve it directly.",
        invariants: [
            "Synthetic division leaves a remainder of degree less than two.",
            "A converged factor divides the current polynomial with remainder near zero.",
            "Deflation lowers the degree by exactly two at each accepted factor.",
        ],
        correctness:
            "The remainder coefficients are polynomial functions of R and S, and the auxiliary c table is their Jacobian divided by the leading coefficient. Newton's method therefore drives both remainders to zero, at which point the divisor is an exact quadratic factor. Dividing it out leaves a polynomial with the remaining roots, and induction over the degree shows that the collected factors multiply back to the original polynomial.",
        complexityRationale:
            "Each Newton step builds the b and c tables in time proportional to the current degree and applies a deflation once per factor, so a full factorization costs O(iterations * degree^2). The coefficient arrays and the growing root list use O(degree) space.",
        uses: [
            "Extracting complex conjugate root pairs in control and signal processing",
            "Polynomial factorization in computer algebra systems",
            "Finding filter poles when only a real coefficient array is available",
        ],
        references: [
            "Bairstow, Method of Finding Roots of Polynomials by Successive Division, 1920",
            "Press et al., Numerical Recipes, Chapter 9",
        ],
        workedExample:
            "For p(x) = x^4 - 3x^3 + 3x^2 - 3x + 2, the first quadratic factor converges near x^2 + 1, giving roots plus i and minus i. Deflating leaves x^2 - 3x + 2, whose roots are 1 and 2; multiplying the four roots reproduces the original polynomial.",
    },
    id: "bairstow-method",
    name: "Bairstow's Method",
    category: "numerical-optimization",
    complexity: { time: "O(iterations * degree^2)", space: "O(degree)" },
    defaultInput: { coefficients: [1, -3, 3, -3, 2], r: 0.1, s: -0.9, iterations: 40 },
    visualType: "array",
    run,
    pseudocode: [
        "read the real polynomial coefficients and initial factor coefficients",
        "while the reduced degree exceeds two",
        "divide by the candidate quadratic and read the linear remainder",
        "form the derivative table and take a Newton step in both coefficients",
        "repeat until the remainder is negligible",
        "record the two roots and divide the polynomial by the factor",
        "solve the final quadratic directly",
        "done: report all real and complex roots",
    ],
};

export default module;
