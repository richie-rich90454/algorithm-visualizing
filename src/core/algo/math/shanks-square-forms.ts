/**
 * shanks-square-forms.ts - Shanks' Square Forms Factorization (SQUFOF)
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * SQUFOF factors an odd integer by walking the continued-fraction expansion of
 * the square root of k*n. Once a denominator in the expansion is a perfect
 * square, the algorithm moves to the "antiderivative" form and walks forward
 * again until a symmetric form appears. That symmetry yields x^2 congruent to
 * y^2 modulo n, so gcd(x-y, n) is a nontrivial factor. A small list of square
 * multipliers k is tried until one succeeds. This is distinct from continued
 * fraction factorization, Fermat, and the quadratic sieve already cataloged.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(n^(1/4)) continued-fraction steps per multiplier
 *   Space: O(n^(1/4)) for the form sequence (kept for the visualization)
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

/** Integer square root via floating point, corrected by rounding. */
function isqrt(value: number): number {
    let root = Math.floor(Math.sqrt(value));
    while ((root + 1) * (root + 1) <= value) {
        root += 1;
    }
    while (root * root > value) {
        root -= 1;
    }
    return root;
}

/** Euclid's gcd on nonnegative integers. */
function gcd(a: number, b: number): number {
    let x = Math.abs(a);
    let y = Math.abs(b);
    while (y !== 0) {
        const t = x % y;
        x = y;
        y = t;
    }
    return x;
}

/** True when value is a positive perfect square. */
function isSquare(value: number): boolean {
    if (value < 1 || !Number.isSafeInteger(value)) {
        return false;
    }
    const r = isqrt(value);
    return r * r === value;
}

/** Build bar entities from a sequence of continued-fraction denominators. */
function makeBars(values: number[], highlight: number): VisualEntity[] {
    return values.map((value, index) => ({
        id: `bar-${index}`,
        type: "bar" as const,
        label: String(value),
        value,
        state: (index === highlight ? "active" : index === values.length - 1 ? "sorted" : "idle") as EntityState,
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { index, value },
    }));
}

/** Find a nontrivial factor, collecting continued-fraction denominators for display. */
function factor(n: number): { factor: number; steps: number[]; multiplier: number; squareQ: number } | null {
    if (n % 2 === 0) {
        return { factor: 2, steps: [], multiplier: 1, squareQ: 0 };
    }
    if (isSquare(n)) {
        return { factor: isqrt(n), steps: [], multiplier: 1, squareQ: 0 };
    }
    const multipliers = [1, 3, 5, 7, 11, 15, 21, 33, 35, 55, 77, 105, 165, 231, 385, 1155];
    const bound = 8 * isqrt(isqrt(n)) + 20;
    for (const k of multipliers) {
        const D = k * n;
        if (!Number.isSafeInteger(D)) {
            continue;
        }
        const Pinit = isqrt(D);
        if (Pinit * Pinit === D) {
            continue;
        }
        let P0 = Pinit;
        let Q0 = 1;
        let Q1 = D - P0 * P0;
        let P1 = 0;
        let Q2 = 0;
        const steps: number[] = [Q1];
        let foundSquare = false;
        for (let i = 2; i < bound; i += 1) {
            const b = Math.floor((Pinit + P0) / Q1);
            P1 = b * Q1 - P0;
            Q2 = Q0 + b * (P0 - P1);
            steps.push(Q2);
            if (i % 2 === 0 && isSquare(Q2)) {
                foundSquare = true;
                break;
            }
            P0 = P1;
            Q0 = Q1;
            Q1 = Q2;
        }
        if (!foundSquare) {
            continue;
        }
        const q = isqrt(Q2);
        const b0 = Math.floor((Pinit - P1) / q);
        P0 = b0 * q + P1;
        Q0 = q;
        Q1 = Math.floor((D - P0 * P0) / Q0);
        for (let guard = 0; guard < bound; guard += 1) {
            const b = Math.floor((Pinit + P0) / Q1);
            P1 = b * Q1 - P0;
            Q2 = Q0 + b * (P0 - P1);
            steps.push(Q2);
            if (P0 === P1) {
                break;
            }
            P0 = P1;
            Q0 = Q1;
            Q1 = Q2;
        }
        const d = gcd(n, P1);
        if (d > 1 && d < n) {
            return { factor: d, steps, multiplier: k, squareQ: q * q };
        }
    }
    return null;
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { n?: number } | null) ?? {};
    const n = typeof task.n === "number" ? Math.trunc(task.n) : 11111;
    let step = 0;

    yield {
        stepNumber: step,
        entities: makeBars([n], 0),
        edges: [],
        description: `Factoring ${n} with Shanks' square forms factorization.`,
        codeLineNumber: 0,
        layout: "array",
        meta: { n, phase: "start" },
    };
    step += 1;

    if (!(n > 0) || !Number.isSafeInteger(n)) {
        yield {
            stepNumber: step,
            entities: makeBars([], -1),
            edges: [],
            description: "Input must be a positive safe integer.",
            codeLineNumber: 0,
            layout: "array",
            meta: { n, error: true },
        };
        return;
    }

    const result = factor(n);
    if (!result) {
        yield {
            stepNumber: step,
            entities: makeBars([], -1),
            edges: [],
            description: `No nontrivial factor was found for ${n}.`,
            codeLineNumber: 8,
            layout: "array",
            meta: { n, factor: 0, complete: true },
        };
        return;
    }

    const visible = result.steps.slice(0, 18);
    yield {
        stepNumber: step,
        entities: makeBars(visible, -1),
        edges: [],
        description: `Multiplier ${result.multiplier}: expanded ${result.steps.length} continued-fraction forms; square denominator ${result.squareQ} found.`,
        codeLineNumber: 3,
        layout: "array",
        meta: { n, multiplier: result.multiplier, squareQ: result.squareQ, forms: result.steps.length },
    };
    step += 1;

    const other = n / result.factor;
    yield {
        stepNumber: step,
        entities: makeBars(visible, visible.length - 1),
        edges: [],
        description: `Symmetric form reached; gcd gives factor ${result.factor}, so ${n} = ${result.factor} times ${other}.`,
        codeLineNumber: 7,
        layout: "array",
        meta: { n, factor: result.factor, other, product: result.factor * other, multiplier: result.multiplier, complete: true },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "The continued-fraction expansion of the square root of k times n produces a sequence of quadratic forms with small coefficients. When one of those forms has a square denominator, it can be reversed into a symmetric form. Walking forward again reaches a form that is its own reverse, which encodes two different square roots of the same value modulo n. Their difference shares a factor with n, and a gcd exposes it.",
        invariants: [
            "Every form satisfies P squared congruent to k*n modulo Q.",
            "The denominators Q are positive and stay smaller than twice the square root of k*n.",
            "The symmetric form has identical forward and backward partial quotients, giving a square congruence.",
        ],
        correctness:
            "Continued-fraction theory guarantees that the sequence of forms is reduced and eventually periodic. A square denominator on an even index yields an ambiguous form; continuing from its inverse reaches a form where P_i equals P_{i+1}. At that point P_i squared is congruent to k*n, which is congruent to a square modulo n, so P_i squared minus that square is a multiple of n. The gcd with n is therefore a proper divisor for composite n.",
        complexityRationale:
            "The reduced forms have size about the square root of k*n and the period length is O(n^(1/4)) on average, so each multiplier takes O(n^(1/4)) arithmetic steps. Only a constant number of multipliers are tried. The stored form sequence uses O(n^(1/4)) space.",
        uses: [
            "Factoring 64-bit integers where Pollard rho is too slow",
            "A subroutine in-cache sized stage of larger factoring algorithms",
            "A teaching example of quadratic forms and infrastructure in number theory",
        ],
        references: [
            "Shanks, On Gauss's Composition of Classes of Binary Quadratic Forms, 1968",
            "Crandall and Pomerance, Prime Numbers: A Computational Perspective, Chapter 7",
        ],
        workedExample:
            "For n = 11111 the multiplier k = 1 gives the continued-fraction expansion of sqrt(11111). An even-index denominator is the square 81, so q = 9. Continuing from the inverse form reaches a symmetric form whose P value has gcd 41 with 11111, leaving the factorization 41 times 271.",
    },
    id: "shanks-square-forms",
    name: "Shanks Square Forms (SQUFOF)",
    category: "math",
    complexity: { time: "O(n^(1/4))", space: "O(n^(1/4))" },
    defaultInput: { n: 11111 },
    visualType: "array",
    run,
    pseudocode: [
        "if n is even or a square, return that easy factor",
        "for each square multiplier k in a small fixed list",
        "expand the continued fraction of sqrt(k*n), recording denominators Q",
        "stop when an even-index denominator Q is a perfect square",
        "build the inverse square form from q = sqrt(Q)",
        "iterate forward until the form is symmetric",
        "compute the gcd of n with the symmetric P value",
        "if the gcd is proper, report the factorization",
    ],
};

export default module;
