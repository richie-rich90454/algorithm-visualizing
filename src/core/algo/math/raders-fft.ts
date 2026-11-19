/**
 * raders-fft.ts - Rader's Algorithm for Prime-Length DFT
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Cooley-Tukey factories a DFT length into coprime factors, so a prime length
 * needs a different trick. Rader's algorithm uses a primitive root modulo the
 * prime p to reorder the nonzero indices into a cyclic group of length p-1.
 * In that order the DFT becomes a cyclic convolution, which can be evaluated
 * directly in O(p^2) steps for teaching (or with a fast convolution in
 * practice). This module uses complex-number pairs of reals so the transform
 * is visible without a full complex library.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 *   Time:  O(p^2) with a naive convolution, O(p log p) with an inner FFT
 *   Space: O(p)
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 *   - Array bars show the input samples and the magnitude of each frequency.
 *   - meta carries the prime length and the primitive root used.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

type Complex = { r: number; i: number };

const cadd = (a: Complex, b: Complex): Complex => ({ r: a.r + b.r, i: a.i + b.i });
const cmul = (a: Complex, b: Complex): Complex => ({
    r: a.r * b.r - a.i * b.i,
    i: a.r * b.i + a.i * b.r,
});

/** Exact integer modular exponentiation for the small primes used here. */
export function powMod(base: number, exponent: number, modulus: number): number {
    let result = 1;
    let b = base % modulus;
    let e = exponent;
    while (e > 0) {
        if (e % 2 === 1) result = (result * b) % modulus;
        b = (b * b) % modulus;
        e = Math.floor(e / 2);
    }
    return result;
}

/** Find a primitive root modulo a small prime p. */
export function primitiveRoot(p: number): number {
    for (let g = 2; g < p; g += 1) {
        const seen = new Set<number>();
        let value = 1;
        for (let i = 0; i < p - 1; i += 1) {
            seen.add(value);
            value = (value * g) % p;
        }
        if (seen.size === p - 1) return g;
    }
    throw new Error("No primitive root found for the supplied value.");
}

/**
 * Rader DFT of a real sequence of prime length p.
 * Returns the real and imaginary parts of every frequency sample.
 */
export function radersDft(values: number[], p: number): { re: number[]; im: number[] } {
    const m = p - 1;
    const g = primitiveRoot(p);
    const totalReal = values.reduce((sum, value) => sum + value, 0);
    const x0 = values[0] ?? 0;

    const gPower = new Array<number>(m);
    const a: Complex[] = new Array(m);
    const twiddle: Complex[] = new Array(m);
    for (let i = 0; i < m; i += 1) {
        const exponent = powMod(g, i, p);
        gPower[i] = exponent;
        a[i] = { r: values[exponent] ?? 0, i: 0 };
        const angle = (-2 * Math.PI * exponent) / p;
        twiddle[i] = { r: Math.cos(angle), i: Math.sin(angle) };
    }

    const conv: Complex[] = new Array(m);
    for (let j = 0; j < m; j += 1) {
        let acc: Complex = { r: 0, i: 0 };
        for (let i = 0; i < m; i += 1) {
            const shift = (i - j + m) % m;
            acc = cadd(acc, cmul(a[i] ?? { r: 0, i: 0 }, twiddle[shift] ?? { r: 0, i: 0 }));
        }
        conv[j] = acc;
    }

    const re = new Array<number>(p).fill(0);
    const im = new Array<number>(p).fill(0);
    re[0] = totalReal;
    for (let j = 0; j < m; j += 1) {
        const shift = (m - j) % m;
        const frequency = powMod(g, shift, p);
        const sample = conv[j] ?? { r: 0, i: 0 };
        re[frequency] = x0 + sample.r;
        im[frequency] = sample.i;
    }
    return { re, im };
}

function makeBars(values: number[], active: number): VisualEntity[] {
    return values.map((value, index) => ({
        id: `bar-${index}`,
        type: "bar" as const,
        label: value.toFixed(2),
        value,
        state: (index === active ? "active" : "sorted") as EntityState,
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { index },
    }));
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { values?: number[]; p?: number } | null) ?? {};
    const values = task.values ?? [1, 2, 3, 4, 5];
    let p = typeof task.p === "number" ? task.p : values.length;
    while (!primitiveRootSafe(p)) p += 1;
    const serial = values.slice(0, p);
    while (serial.length < p) serial.push(0);

    const g = primitiveRoot(p);
    let step = 0;
    yield {
        stepNumber: step,
        entities: makeBars(serial, -1),
        edges: [],
        description: `Rader's algorithm for a prime DFT of length ${p} using primitive root ${g}.`,
        codeLineNumber: 0,
        layout: "array",
        meta: { p, g },
    };
    step += 1;

    const m = p - 1;
    const permuted: number[] = new Array(m);
    for (let i = 0; i < m; i += 1) {
        permuted[i] = serial[powMod(g, i, p)] ?? 0;
    }
    yield {
        stepNumber: step,
        entities: makeBars(permuted, -1),
        edges: [],
        description: `Reorder the nonzero samples by powers of ${g} into a cyclic sequence.`,
        codeLineNumber: 1,
        layout: "array",
        meta: { p, g },
    };
    step += 1;

    const transform = radersDft(serial, p);
    const magnitudes = transform.re.map((real, i) => Math.hypot(real, transform.im[i] ?? 0));
    yield {
        stepNumber: step,
        entities: makeBars(magnitudes, -1),
        edges: [],
        description: "Cyclic convolution assembled and unmapped to the frequency samples.",
        codeLineNumber: 2,
        layout: "array",
        meta: { p, g, magnitudes },
    };
    step += 1;

    yield {
        stepNumber: step,
        entities: makeBars(magnitudes, -1),
        edges: [],
        description: "Done: the bars show the magnitude of every DFT frequency component.",
        codeLineNumber: 3,
        layout: "array",
        meta: { p, g, real: transform.re, imag: transform.im },
    };
}

function primitiveRootSafe(p: number): boolean {
    if (p < 3) return false;
    for (let d = 2; d * d <= p; d += 1) {
        if (p % d === 0) return false;
    }
    return true;
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "When the DFT length is prime there is no smaller transform to factor into. Rader noticed that the nonzero indices form a cyclic group under multiplication modulo p, generated by a primitive root. Writing both sample and frequency indices as powers of that root turns the transform into a cyclic convolution of length p-1, which is the same kind of object a fast convolution routine already knows how to compute.",
        invariants: [
            "The powers of the primitive root visit every nonzero residue modulo p exactly once.",
            "The convolution index tracks the difference of the root exponents.",
            "The zero-frequency sample is the plain sum of all inputs.",
        ],
        correctness:
            "Reindexing by a primitive root is a bijection of the nonzero indices, so no sample is lost. Substituting n = g^i and k = g^{-j} into the DFT sum yields x[0] plus a convolution of the reordered samples with the twiddle factors indexed by g^i. Reversing the exponent map places each convolution output at its original frequency, so every sample matches the direct DFT definition.",
        complexityRationale:
            "The teaching version evaluates the length p-1 cyclic convolution with a double loop, costing O(p^2); substituting a fast convolution reduces this to O(p log p). Only arrays of length p are stored, so space is O(p).",
        uses: [
            "DFT of prime or large prime-plus-one lengths",
            "Number theoretic transforms with prime moduli",
            "Convolution building blocks in fast multiplication",
        ],
        references: [
            "Rader, A Simple Method for Computing the Discrete Fourier Transform, 1968",
            "Oppenheim and Schafer, Discrete-Time Signal Processing, Chapter 8",
        ],
        workedExample:
            "For p equal to 5 a primitive root is 2, whose powers are 1, 2, 4, 3. The four nonzero samples are reordered by those powers and convolved with twiddles at the same exponents. The zero frequency is the sum of all five samples, and each remaining frequency is recovered at index 2 to the power negative j modulo 5.",
    },
    id: "raders-fft",
    name: "Rader's FFT (Prime Length)",
    category: "math",
    complexity: { time: "O(p^2) naive, O(p log p) with fast convolution", space: "O(p)" },
    defaultInput: { values: [1, 2, 3, 4, 5], p: 5 },
    visualType: "array",
    run,
    pseudocode: [
        "find a primitive root g modulo the prime p",
        "reorder samples by powers of g for the nonzero indices",
        "build twiddle factors indexed by those same powers",
        "compute the cyclic convolution of samples and twiddles",
        "set frequency zero to the sum of all samples",
        "unmap convolution outputs back to frequency indices",
        "done: report the real and imaginary frequency samples",
    ],
};

export default module;
