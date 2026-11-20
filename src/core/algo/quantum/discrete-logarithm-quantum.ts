/**
 * discrete-logarithm-quantum.ts - Shor's Discrete Logarithm (exact small model)
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Given a prime p, a generator g of the multiplicative group mod p, and h =
 * g^x mod p, Shor's discrete-log algorithm recovers the secret exponent x. Two
 * counting registers hold uniform superpositions over a and b. Controlled
 * multiplications by g and h write g^(a + x b) into a work register. A pair of
 * quantum Fourier transforms maps the superpositions to outcomes c and d with
 * c proportional to j and d proportional to j x, so a modular division recovers
 * x when gcd(j, p-1) is one.
 *
 * This is an exact analytic simulation of the measurement distribution for the
 * special case where p-1 divides the Fourier size 2^t. It computes every
 * outcome and its probability directly; it does not run on quantum hardware.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(q) to list outcomes, where q = p-1
 *   Space: O(q) for the outcome distribution
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - One bar shows the probability of each Fourier outcome index j.
 *   - The usable outcome with gcd(j, q) = 1 is highlighted, then marked green.
 *   - meta carries p, g, h, q, the chosen c and d, and the recovered exponent.
 */

import type { AlgorithmModule, VisualEntity, VisualFrame } from "@/types";

interface DiscreteLogInput {
    p?: number;
    g?: number;
    x?: number;
    t?: number;
}

/** Modular exponentiation by repeated squaring. */
function powMod(base: number, exponent: number, modulus: number): number {
    let result = 1;
    let current = ((base % modulus) + modulus) % modulus;
    let power = exponent;
    while (power > 0) {
        if (power % 2 === 1) result = (result * current) % modulus;
        current = (current * current) % modulus;
        power = Math.floor(power / 2);
    }
    return result;
}

/** Greatest common divisor of two nonnegative integers. */
function gcd(a: number, b: number): number {
    let x = a;
    let y = b;
    while (y !== 0) {
        const next = x % y;
        x = y;
        y = next;
    }
    return x;
}

/** Modular inverse from the extended Euclidean algorithm. */
function inverseMod(value: number, modulus: number): number {
    let oldR = value;
    let r = modulus;
    let oldS = 1;
    let s = 0;
    while (r !== 0) {
        const quotient = Math.floor(oldR / r);
        const nextR = oldR - quotient * r;
        oldR = r;
        r = nextR;
        const nextS = oldS - quotient * s;
        oldS = s;
        s = nextS;
    }
    return ((oldS % modulus) + modulus) % modulus;
}

function makeBars(count: number, highlighted: number, done: boolean): VisualEntity[] {
    return Array.from({ length: count }, (_, index) => ({
        id: `bar-${index}`,
        type: "bar" as const,
        label: `j=${index}`,
        value: count > 0 ? 1 / count : 0,
        state: index === highlighted ? (done ? "sorted" : "comparing") : "idle",
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { index, j: index, probability: count > 0 ? 1 / count : 0 },
    }));
}

/** The discrete logarithm generator. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as DiscreteLogInput | null) ?? {};
    const p = typeof task.p === "number" && task.p > 2 ? Math.floor(task.p) : 17;
    const q = p - 1;
    const g = typeof task.g === "number" && task.g > 1 && task.g < p ? Math.floor(task.g) : 3;
    const secret = typeof task.x === "number" ? ((Math.floor(task.x) % q) + q) % q : 6;
    const minimumT = Math.ceil(Math.log2(q));
    const t = Math.max(minimumT, typeof task.t === "number" ? Math.floor(task.t) : minimumT + 2);
    const fourierSize = 1 << Math.min(20, t);
    const usableQ = q > 0 && fourierSize % q === 0;
    const stride = usableQ ? fourierSize / q : 0;
    const h = powMod(g, secret, p);

    const outcomes = usableQ
        ? Array.from({ length: q }, (_, j) => ({
              j,
              c: j * stride,
              d: ((j * secret) % q) * stride,
              probability: 1 / q,
          }))
        : [];
    const chosen = usableQ ? outcomes.find((outcome) => outcome.j > 0 && gcd(outcome.j, q) === 1) : undefined;
    const recovered = chosen
        ? (((chosen.d / stride) * inverseMod(chosen.j, q)) % q + q) % q
        : -1;
    const verified = recovered >= 0 && powMod(g, recovered, p) === h;
    const highlighted = chosen?.j ?? -1;

    let step = 0;
    yield {
        stepNumber: step++,
        entities: makeBars(outcomes.length, -1, false),
        edges: [],
        description: usableQ
            ? `Solving g^x = h mod ${p} with generator ${g}, h = ${h}, using a ${t}-bit Fourier register.`
            : `The group order ${q} does not divide the Fourier size; use a prime p with p-1 a power of two.`,
        codeLineNumber: 0,
        layout: "array",
        meta: { p, g, h, q, t, fourierSize, usable: usableQ, chosenJ: -1, c: -1, d: -1, recovered: -1, verified: false, distribution: outcomes.map((o) => o.probability), secret },
    };

    yield {
        stepNumber: step++,
        entities: makeBars(outcomes.length, -1, false),
        edges: [],
        description: `Controlled powers write g^(a + x b) into the work register for all a and b below ${fourierSize}.`,
        codeLineNumber: 1,
        layout: "array",
        meta: { p, g, h, q, t, fourierSize, usable: usableQ, chosenJ: -1, c: -1, d: -1, recovered: -1, verified: false, distribution: outcomes.map((o) => o.probability), secret },
    };

    yield {
        stepNumber: step++,
        entities: makeBars(outcomes.length, highlighted, false),
        edges: [],
        description: `The Fourier transforms give ${q} equally likely outcomes; each j has probability ${usableQ ? (1 / q).toFixed(4) : "undefined"}.`,
        codeLineNumber: 3,
        layout: "array",
        meta: { p, g, h, q, t, fourierSize, usable: usableQ, chosenJ: highlighted, c: chosen?.c ?? -1, d: chosen?.d ?? -1, recovered: -1, verified: false, distribution: outcomes.map((o) => o.probability), secret },
    };

    yield {
        stepNumber: step++,
        entities: makeBars(outcomes.length, highlighted, false),
        edges: [],
        description: chosen
            ? `Outcome j = ${chosen.j} gives c = ${chosen.c} and d = ${chosen.d}, so d/s = ${chosen.d / stride} = (j x) mod ${q}.`
            : "No invertible Fourier outcome is available for this group order.",
        codeLineNumber: 5,
        layout: "array",
        meta: { p, g, h, q, t, fourierSize, usable: usableQ, chosenJ: highlighted, c: chosen?.c ?? -1, d: chosen?.d ?? -1, recovered: -1, verified: false, distribution: outcomes.map((o) => o.probability), secret },
    };

    yield {
        stepNumber: step,
        entities: makeBars(outcomes.length, highlighted, verified),
        edges: [],
        description: verified
            ? `Recovered x = ${recovered}, and g^${recovered} mod ${p} = ${h}, so the exponent is correct.`
            : `Could not verify an exponent for p = ${p} with this Fourier size.`,
        codeLineNumber: 7,
        layout: "array",
        meta: { p, g, h, q, t, fourierSize, usable: usableQ, chosenJ: highlighted, c: chosen?.c ?? -1, d: chosen?.d ?? -1, recovered, verified, distribution: outcomes.map((o) => o.probability), secret },
    };
}

/** The discrete logarithm module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "If h equals g to the x, the exponent x is a discrete logarithm. Shor's method prepares a superposition of all exponents a and b and uses controlled multiplications so that the work register depends only on a plus x times b. A Fourier transform then turns that linear relationship into two measured integers whose ratio reveals x modulo the group order, provided the random multiplier is coprime to that order.",
        invariants: [
            "Every controlled multiplication is a permutation of the work register, so the joint state stays normalized.",
            "For the modeled case the Fourier outcomes are uniform, each with probability one over q.",
            "An outcome j with gcd(j, q) = 1 gives d over s equal to (j x) mod q.",
            "The recovered exponent always satisfies g to that exponent equals h mod p when verification succeeds.",
        ],
        correctness:
            "The work register depends on a + x b modulo q, so the uniform superposition over a and b gives each residue equally often. Writing a = r - x b modulo q and summing over b, the Fourier amplitudes vanish unless c is a multiple of 2^t over q and d equals c x modulo 2^t. There are exactly q surviving outcomes, each with probability one over q. For an outcome with j coprime to q, dividing d over s by j modulo q recovers x uniquely, and the final modular exponentiation checks that answer.",
        complexityRationale:
            "A real quantum run uses a polynomial number of gates in the number of bits of p. This exact teaching model lists the q Fourier outcomes directly, so it takes O(q) time and space. It is limited to primes where p minus one divides the Fourier size, so the formulas are exact without a lattice reduction step.",
        uses: [
            "Breaking discrete-log based cryptosystems on a large quantum computer",
            "Studying the structure of Shor's algorithm",
            "A teaching bridge between Fourier sampling and number theory",
        ],
        references: [
            "Shor, Polynomial-Time Algorithms for Prime Factorization and Discrete Logarithms, 1997",
            "Nielsen and Chuang, Quantum Computation and Quantum Information, Chapter 5",
        ],
        workedExample:
            "Take p = 17, g = 3, and x = 6, so h = 15. With t = 6 the Fourier size is 64 and q = 16, so the stride is 4. Choosing j = 3 gives c = 12 and d = 8. Then d over the stride is 2, the inverse of 3 modulo 16 is 11, and 2 times 11 modulo 16 is 6, which is the secret exponent.",
    },
    id: "discrete-logarithm-quantum",
    name: "Quantum Discrete Logarithm",
    category: "quantum",
    complexity: { time: "O(q) simulated", space: "O(q) simulated" },
    defaultInput: { p: 17, g: 3, x: 6, t: 6 },
    visualType: "array",
    run,
    pseudocode: [
        "read prime p, generator g, and h = g^x mod p",
        "set q = p-1 and choose a Fourier size divisible by q",
        "prepare uniform superpositions over exponents a and b",
        "apply controlled multiplication by g and h",
        "apply Fourier transforms to both exponent registers",
        "sample outcome j giving c and d with d = c x mod 2^t",
        "recover x as (d/s) times inverse(j) modulo q",
        "done: verify g^x mod p equals h",
    ],
};

export default module;
