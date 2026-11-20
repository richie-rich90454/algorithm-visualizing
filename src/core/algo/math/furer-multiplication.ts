/**
 * furer-multiplication.ts - Furer-Style FFT Integer Multiplication
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Furer's multiplication splits each operand into small base-B limbs, views
 * the limb lists as polynomials, evaluates them at the powers of a complex
 * root of unity with a fast Fourier transform, multiplies the values
 * pointwise, and interpolates the product polynomial. Carrying the resulting
 * convolution coefficients in base B reconstructs the integer product. Using
 * roots of unity is what reduces the convolution from quadratic to nearly
 * linear time.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(n log n log log n) asymptotically; O(N log N) for the FFT core
 *   Space: O(N) for the complex spectra, with N the padded limb count
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Each limb of an operand is a bar; operands and the result are shown in turn.
 *   - The limb currently being extracted is YELLOW (comparing).
 *   - The final frame reports the exact integer product and the chosen base.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

type C = [number, number];
const BASE = 1000;

function cAdd(a: C, b: C): C {
    return [a[0] + b[0], a[1] + b[1]];
}
function cScale(a: C, k: number): C {
    return [a[0] * k, a[1] * k];
}
function cMul(a: C, b: C): C {
    return [a[0] * b[0] - a[1] * b[1], a[0] * b[1] + a[1] * b[0]];
}
function cis(theta: number): C {
    return [Math.cos(theta), Math.sin(theta)];
}

function fft(input: C[], inverse: boolean): C[] {
    const n = input.length;
    const out = input.slice();
    for (let i = 1, j = 0; i < n; i += 1) {
        let bit = n >> 1;
        for (; j & bit; bit >>= 1) j ^= bit;
        j ^= bit;
        if (i < j) {
            const t = out[i]!;
            out[i] = out[j]!;
            out[j] = t;
        }
    }
    for (let len = 2; len <= n; len <<= 1) {
        const wlen = cis(((inverse ? 2 : -2) * Math.PI) / len);
        for (let i = 0; i < n; i += len) {
            let w: C = [1, 0];
            for (let j = 0; j < len / 2; j += 1) {
                const u = out[i + j]!;
                const v = cMul(out[i + j + len / 2]!, w);
                out[i + j] = cAdd(u, v);
                out[i + j + len / 2] = cAdd(u, cScale(v, -1));
                w = cMul(w, wlen);
            }
        }
    }
    if (inverse) return out.map((v) => cScale(v, 1 / n));
    return out;
}

function toLimbs(value: number): number[] {
    if (value === 0) return [0];
    const limbs: number[] = [];
    let rest = Math.abs(value);
    while (rest > 0) {
        limbs.push(rest % BASE);
        rest = Math.floor(rest / BASE);
    }
    return limbs;
}

function makeBars(limbs: number[], states: Map<number, EntityState>, active: number): VisualEntity[] {
    return limbs.map((value, i) => ({
        id: `bar-${i}`,
        type: "bar" as const,
        label: String(value),
        value,
        state: states.get(i) ?? (i === active ? "comparing" : "idle"),
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { index: i, limb: value, base: BASE },
    }));
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { a?: number; b?: number } | null) ?? {};
    const a = Math.floor(typeof task.a === "number" ? task.a : 12345);
    const b = Math.floor(typeof task.b === "number" ? task.b : 6789);
    const limbsA = toLimbs(a);
    const limbsB = toLimbs(b);
    let N = 1;
    while (N < limbsA.length + limbsB.length) N *= 2;

    let step = 0;
    yield {
        stepNumber: step,
        entities: makeBars(limbsA, new Map(), -1),
        edges: [],
        description: `Splitting ${a} into base-${BASE} limbs for Furer-style multiplication.`,
        codeLineNumber: 0,
        layout: "array",
        meta: { a, b, product: "0", base: BASE, limbsA: [...limbsA], transformSize: N },
    };
    step += 1;
    yield {
        stepNumber: step,
        entities: makeBars(limbsB, new Map(), -1),
        edges: [],
        description: `Splitting ${b} into base-${BASE} limbs; padding the transform to length ${N}.`,
        codeLineNumber: 1,
        layout: "array",
        meta: { a, b, product: "0", base: BASE, limbsB: [...limbsB], transformSize: N },
    };
    step += 1;

    const fa = new Array<C>(N).fill([0, 0]);
    const fb = new Array<C>(N).fill([0, 0]);
    limbsA.forEach((v, i) => { fa[i] = [v, 0]; });
    limbsB.forEach((v, i) => { fb[i] = [v, 0]; });
    const Fa = fft(fa, false);
    const Fb = fft(fb, false);
    const Fc = Fa.map((v, i) => cMul(v, Fb[i]!));
    yield {
        stepNumber: step,
        entities: makeBars(limbsA, new Map(limbsA.map((_, i) => [i, "path" as EntityState])), -1),
        edges: [],
        description: `Evaluated both limb polynomials at the ${N}-th roots of unity and multiplied pointwise.`,
        codeLineNumber: 2,
        layout: "array",
        meta: { a, b, product: "0", base: BASE, transformSize: N },
    };
    step += 1;

    const convComplex = fft(Fc, true);
    const conv = new Array<number>(limbsA.length + limbsB.length).fill(0);
    let carry = 0;
    for (let i = 0; i < conv.length; i += 1) {
        const raw = Math.round((convComplex[i]?.[0] ?? 0)) + carry;
        conv[i] = ((raw % BASE) + BASE) % BASE;
        carry = Math.floor(raw / BASE);
        if (step < 120) {
            yield {
                stepNumber: step,
                entities: makeBars(conv, new Map([[i, "comparing" as EntityState]]), i),
                edges: [],
                description: `Interpolate coefficient ${i} and carry ${carry} in base ${BASE}.`,
                codeLineNumber: 3,
                layout: "array",
                meta: { a, b, product: "0", base: BASE, index: i, coefficient: conv[i], carry },
            };
            step += 1;
        }
    }
    while (carry > 0) {
        conv.push(carry % BASE);
        carry = Math.floor(carry / BASE);
    }

    let product = 0n;
    for (let i = conv.length - 1; i >= 0; i -= 1) product = product * BigInt(BASE) + BigInt(conv[i]!);
    const expected = BigInt(Math.abs(a)) * BigInt(Math.abs(b));
    yield {
        stepNumber: step,
        entities: makeBars(conv, new Map(conv.map((_, i) => [i, "sorted" as EntityState])), -1),
        edges: [],
        description: `Furer-style FFT multiplication gives ${a} * ${b} = ${product.toString()}.`,
        codeLineNumber: 4,
        layout: "array",
        meta: {
            a,
            b,
            product: product.toString(),
            expected: expected.toString(),
            matches: product === expected,
            base: BASE,
            transformSize: N,
            limbs: conv.length,
        },
    };
}

/** The Furer-style FFT multiplication module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "Multiplying two long integers is the same as multiplying two polynomials whose coefficients are base-B digits. Evaluating both polynomials at many roots of unity converts polynomial multiplication into pointwise multiplication, which is cheap, and interpolation recovers the product. The FFT performs those evaluations and the inverse transform in nearly linear time, while a final carry pass turns the polynomial coefficients back into an integer.",
        invariants: [
            "Each limb is smaller than the base B, so the limb lists are a faithful representation of the operands.",
            "The transform length N is a power of two at least the sum of the limb counts, avoiding circular convolution.",
            "Pointwise products of evaluations equal the evaluations of the product polynomial.",
            "After carrying, the reconstructed integer equals the exact product of the operands.",
        ],
        correctness:
            "Polynomial evaluation is a ring homomorphism, so multiplying the transformed values and interpolating returns the exact convolution of the limb lists. Padding to a power of two at least the convolution length prevents wraparound. Each convolution coefficient is rounded and reduced in base B, and the carry pass propagates overflow to the next limb, which is precisely how positional notation reconstructs an integer from digits. The final comparison with ordinary multiplication confirms the result.",
        complexityRationale:
            "Splitting a number into limbs uses a constant base, so there are O(log n) limbs. The FFT and inverse FFT cost O(N log N) with N proportional to the limb count, and Furer's root-of-unity selection improves the asymptotic bound to O(n log n log log n). Storage is O(N) for the spectra.",
        uses: [
            "Multiplying very large integers in arbitrary-precision libraries",
            "Fast polynomial convolution in computer algebra",
            "A teaching example of roots of unity and the Fast Fourier Transform",
        ],
        references: [
            "Furer, Faster Integer Multiplication, SIAM Journal on Computing, 2009",
            "Schonhage and Strassen, Schnelle Multiplikation grosser Zahlen, 1971",
        ],
        workedExample:
            "For a = 12345 and b = 6789 with base 1000, the limb lists are [345, 12] and [789, 6]. Padding to four points, evaluating at the fourth roots of unity, multiplying pointwise, and interpolating gives the convolution [... carry ...]. After carrying in base 1000 the digits reconstruct 83810205, which is exactly 12345 times 6789.",
    },
    id: "furer-multiplication",
    name: "Furer-Style FFT Multiplication",
    category: "math",
    complexity: { time: "O(N log N)", space: "O(N)" },
    defaultInput: { a: 12345, b: 6789 },
    visualType: "array",
    run,
    pseudocode: [
        "choose a base B and split each operand into base-B limbs",
        "pad both limb lists to a power of two at least their combined length",
        "evaluate each limb polynomial at the roots of unity with an FFT",
        "multiply the two evaluation vectors pointwise",
        "apply the inverse FFT and round to obtain convolution coefficients",
        "propagate carries in base B and rebuild the integer",
        "done: return the exact product",
    ],
};

export default module;
