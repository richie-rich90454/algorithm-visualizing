/**
 * gaussian-integer-gcd.ts - Greatest common divisor in the Gaussian integers.
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * A Gaussian integer is a complex number a + bi with integer parts. The norm
 * N(z) = a^2 + b^2 is multiplicative, which makes Z[i] a Euclidean domain.
 * The Euclidean algorithm repeatedly divides and takes the nearest Gaussian
 * integer quotient; the last nonzero remainder generates the gcd. The result
 * is unique only up to multiplication by a unit (1, -1, i, -i), so the module
 * canonicalizes it to the associate with a positive real part and nonnegative
 * imaginary part.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(log N(a + bi)) division steps
 *   Space: O(1) working storage
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - The two inputs, current dividend/divisor, quotient and remainder are
 *     plotted as points in the complex plane.
 *   - The active divisor is highlighted while the next quotient is computed.
 *   - The final frame plots the canonical gcd.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

type Gaussian = [number, number];

const add = (a: Gaussian, b: Gaussian): Gaussian => [a[0] + b[0], a[1] + b[1]];
const mul = (a: Gaussian, b: Gaussian): Gaussian => [
    a[0] * b[0] - a[1] * b[1],
    a[0] * b[1] + a[1] * b[0],
];
const conjugate = (a: Gaussian): Gaussian => [a[0], -a[1]];
const norm = (a: Gaussian): number => a[0] * a[0] + a[1] * a[1];
const isZero = (a: Gaussian): boolean => a[0] === 0 && a[1] === 0;

/** Nearest Gaussian integer to the exact quotient a/b. */
function gaussianQuotient(a: Gaussian, b: Gaussian): Gaussian {
    const nb = norm(b);
    const real = (a[0] * b[0] + a[1] * b[1]) / nb;
    const imag = (a[1] * b[0] - a[0] * b[1]) / nb;
    return [Math.round(real), Math.round(imag)];
}

const remainder = (a: Gaussian, b: Gaussian): Gaussian => add(a, mul(gaussianQuotient(a, b), [-b[0], -b[1]]));

/** Canonical associate: positive real part, or zero real with positive imaginary. */
function canonical(a: Gaussian): Gaussian {
    const candidates: Gaussian[] = [
        a,
        [-a[0], -a[1]],
        [-a[1], a[0]],
        [a[1], -a[0]],
    ];
    candidates.sort((x, y) => y[0] - x[0] || y[1] - x[1]);
    return candidates[0] ?? a;
}

const format = (z: Gaussian): string => {
    const [a, b] = z;
    if (b === 0) return `${a}`;
    if (a === 0) return `${b}i`;
    return b > 0 ? `${a} + ${b}i` : `${a} - ${-b}i`;
};

function pt(id: string, z: Gaussian, label: string, state: EntityState): VisualEntity {
    return {
        id,
        type: "node",
        label,
        value: z,
        state,
        x: z[0],
        y: z[1],
        width: 0,
        height: 0,
        metadata: { re: z[0], im: z[1] },
    };
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { a?: Gaussian; b?: Gaussian } | null) ?? {};
    const a: Gaussian = task.a ?? [7, 4];
    const b: Gaussian = task.b ?? [3, 2];
    let step = 0;
    let dividend: Gaussian = [a[0], a[1]];
    let divisor: Gaussian = [b[0], b[1]];

    yield {
        stepNumber: step++,
        entities: [
            pt("input-a", a, `a = ${format(a)}`, "idle"),
            pt("input-b", b, `b = ${format(b)}`, "idle"),
        ],
        edges: [],
        description: `Computing gcd(${format(a)}, ${format(b)}) in the Gaussian integers.`,
        codeLineNumber: 0,
        layout: "point",
        meta: { normA: norm(a), normB: norm(b), steps: 0 },
    };

    let iterations = 0;
    while (!isZero(divisor) && iterations < 64) {
        const quotient = gaussianQuotient(dividend, divisor);
        const next = remainder(dividend, divisor);
        yield {
            stepNumber: step++,
            entities: [
                pt("input-a", a, `a = ${format(a)}`, "visited"),
                pt("input-b", b, `b = ${format(b)}`, "visited"),
                pt("dividend", dividend, `dividend ${format(dividend)}`, "active"),
                pt("divisor", divisor, `divisor ${format(divisor)}`, "comparing"),
                pt("quotient", quotient, `q = ${format(quotient)}`, "pivot"),
                pt("remainder", next, `r = ${format(next)}`, next[0] === 0 && next[1] === 0 ? "sorted" : "swapped"),
            ],
            edges: [],
            description: `Divide ${format(dividend)} by ${format(divisor)}: quotient ${format(quotient)}, remainder ${format(next)}.`,
            codeLineNumber: 2,
            layout: "point",
            meta: {
                iterations,
                quotient: format(quotient),
                remainder: format(next),
                normRemainder: norm(next),
            },
        };
        dividend = divisor;
        divisor = next;
        iterations += 1;
    }

    const gcd = canonical(dividend);
    yield {
        stepNumber: step++,
        entities: [
            pt("input-a", a, `a = ${format(a)}`, "idle"),
            pt("input-b", b, `b = ${format(b)}`, "idle"),
            pt("gcd", gcd, `gcd = ${format(gcd)}`, "sorted"),
        ],
        edges: [],
        description: `The gcd is ${format(gcd)} with norm ${norm(gcd)}, after ${iterations} division step(s).`,
        codeLineNumber: 5,
        layout: "point",
        meta: { gcd: format(gcd), gcdRe: gcd[0], gcdIm: gcd[1], norm: norm(gcd), steps: iterations },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "The complex numbers with integer coordinates form a Euclidean domain because the squared distance acts as a size measure. Repeated remainder taking shrinks that size, so the last nonzero remainder is a generator of the common divisors.",
        invariants: [
            "The norm of each remainder is strictly smaller than the norm of the divisor that produced it.",
            "Every gcd of the current pair is also a gcd of the original pair.",
            "Division rounds the exact complex quotient to the nearest lattice point.",
        ],
        correctness:
            "At each step gcd(dividend, divisor) equals gcd(divisor, remainder) because the remainder differs from the dividend by an integer multiple of the divisor. Norms strictly decrease, so the loop terminates at a zero remainder, whose predecessor divides both original inputs and is therefore a gcd. Canonicalizing picks one representative of the unit multiples.",
        complexityRationale:
            "Each Euclidean step performs a constant number of integer multiplications and a rounding, and the norm drops by a constant factor, giving O(log N) steps and O(1) working space.",
        uses: [
            "Factoring Gaussian integers and rational primes as sums of two squares",
            "Computing coprime factorizations in quadratic integer rings",
            "Teaching Euclidean domains beyond the ordinary integers",
        ],
        references: [
            "Knuth, The Art of Computer Programming Vol. 2, section 4.5.2",
            "Ireland and Rosen, A Classical Introduction to Modern Number Theory, chapter 3",
        ],
        workedExample:
            "For a = 7 + 4i and b = 3 + 2i the exact quotient is about 2.46 - 0.15i, which rounds to 2. The remainder is (7+4i) - 2(3+2i) = 1, so the next division is (3+2i) by 1 with remainder 0. The gcd is the unit 1, confirming the two inputs are coprime in Z[i].",
    },
    id: "gaussian-integer-gcd",
    name: "Gaussian Integer GCD",
    category: "math",
    complexity: { time: "O(log N) divisions", space: "O(1)" },
    defaultInput: { a: [7, 4], b: [3, 2] },
    visualType: "point",
    run,
    pseudocode: [
        "given Gaussian integers a and b",
        "while b is not zero",
        "q := nearest Gaussian integer to a divided by b",
        "r := a minus q times b",
        "set a := b and b := r",
        "canonicalize a by multiplying by a suitable unit",
        "report a as the gcd",
    ],
};

export default module;
