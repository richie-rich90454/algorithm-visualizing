/**
 * schoenhage-strassen.ts - Schonhage-Strassen Integer Multiplication
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Schonhage-Strassen multiplies large integers by treating them as polynomials
 * evaluated at a power of two and convolving their digit vectors with a fast
 * Fourier transform over the ring of integers modulo 2^n + 1. In that ring the
 * number two has order 2n, so a principal 2^k-th root of unity is available
 * whenever 2^k divides 2n. A forward transform, pointwise product, and inverse
 * transform recover the convolution coefficients, which are recombined into
 * the exact integer product. This is distinct from the schoolbook, Karatsuba,
 * Toom-Cook, and plain NTT-with-CRT multipliers already in the catalog.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(n log n log log n) bit operations in the full recursive method
 *   Space: O(n log n) for the transform arrays
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

/** Reduce a big integer into the nonnegative range modulo mod. */
function reduce(value: bigint, mod: bigint): bigint {
    const r = value % mod;
    return r < 0n ? r + mod : r;
}

/** Modular exponentiation for BigInt. */
function powMod(base: bigint, exponent: bigint, mod: bigint): bigint {
    let result = 1n;
    let b = reduce(base, mod);
    let e = exponent;
    while (e > 0n) {
        if (e & 1n) {
            result = (result * b) % mod;
        }
        b = (b * b) % mod;
        e >>= 1n;
    }
    return result;
}

/** Modular inverse via the extended Euclidean algorithm. */
function inverse(value: bigint, mod: bigint): bigint {
    let t = 0n;
    let newT = 1n;
    let r = mod;
    let newR = reduce(value, mod);
    while (newR !== 0n) {
        const q = r / newR;
        const oldT = t;
        t = newT;
        newT = oldT - q * newT;
        const oldR = r;
        r = newR;
        newR = oldR - q * newR;
    }
    return reduce(t, mod);
}

/** Iterative radix-2 number theoretic transform over Z/(mod). */
function transform(values: bigint[], invert: boolean, mod: bigint, root: bigint): bigint[] {
    const n = values.length;
    const a = values.slice();
    for (let i = 1, j = 0; i < n; i += 1) {
        let bit = n >> 1;
        while (j & bit) {
            j ^= bit;
            bit >>= 1;
        }
        j ^= bit;
        if (i < j) {
            const t = a[i] as bigint;
            a[i] = a[j] as bigint;
            a[j] = t;
        }
    }
    for (let len = 2; len <= n; len <<= 1) {
        const step = BigInt(n / len);
        let wlen = powMod(root, step, mod);
        if (invert) {
            wlen = inverse(wlen, mod);
        }
        for (let i = 0; i < n; i += len) {
            let w = 1n;
            for (let j = 0; j < len / 2; j += 1) {
                const u = a[i + j] as bigint;
                const v = reduce((a[i + j + len / 2] as bigint) * w, mod);
                a[i + j] = reduce(u + v, mod);
                a[i + j + len / 2] = reduce(u - v, mod);
                w = reduce(w * wlen, mod);
            }
        }
    }
    if (invert) {
        const scale = inverse(BigInt(n), mod);
        for (let i = 0; i < n; i += 1) {
            a[i] = reduce((a[i] as bigint) * scale, mod);
        }
    }
    return a;
}

/** Convert a nonnegative integer into base-2^bits digits. */
function toDigits(value: bigint, bits: number): bigint[] {
    if (value === 0n) {
        return [0n];
    }
    const base = 1n << BigInt(bits);
    const digits: bigint[] = [];
    let x = value;
    while (x > 0n) {
        digits.push(x % base);
        x /= base;
    }
    return digits;
}

/** Exact product via a transform over Z/(2^n+1). */
function multiply(a: bigint, b: bigint): { product: bigint; length: number; ringBits: number; coefficients: number[] } {
    if (a === 0n || b === 0n) {
        return { product: 0n, length: 2, ringBits: 8, coefficients: [] };
    }
    const bits = 8;
    const da = toDigits(a, bits);
    const db = toDigits(b, bits);
    let length = 1;
    while (length < da.length + db.length) {
        length <<= 1;
    }

    // The ring modulus 2^ringBits + 1 must exceed every convolution
    // coefficient, and its exponent must satisfy length dividing 2*ringBits.
    const boundBits = 2 * bits + Math.ceil(Math.log2(Math.min(da.length, db.length))) + 1;
    const half = length / 2;
    const ringBits = Math.max(8, Math.ceil(boundBits / half) * half);
    const modulus = (1n << BigInt(ringBits)) + 1n;
    const root = powMod(2n, BigInt((2 * ringBits) / length), modulus);

    const fa = transform(da.concat(new Array<bigint>(length - da.length).fill(0n)), false, modulus, root);
    const fb = transform(db.concat(new Array<bigint>(length - db.length).fill(0n)), false, modulus, root);
    const productPoints = fa.map((value, i) => reduce((value as bigint) * (fb[i] as bigint), modulus));
    const coefficients = transform(productPoints, true, modulus, root);

    const base = 1n << BigInt(bits);
    let result = 0n;
    let place = 1n;
    const visible: number[] = [];
    for (let i = 0; i < coefficients.length; i += 1) {
        const coeff = coefficients[i] as bigint;
        if (i < 16) {
            visible.push(Number(coeff % 1000000n));
        }
        result += coeff * place;
        place *= base;
    }
    return { product: result, length, ringBits, coefficients: visible };
}

/** Build bar entities from the displayed convolution coefficients. */
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

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { a?: string | number; b?: string | number } | null) ?? {};
    const a = BigInt(task.a ?? 123456789);
    const b = BigInt(task.b ?? 987654321);
    let step = 0;

    yield {
        stepNumber: step,
        entities: makeBars([Number(a % 1000000n), Number(b % 1000000n)], 0),
        edges: [],
        description: `Multiplying ${a} by ${b} with the Schonhage-Strassen transform.`,
        codeLineNumber: 0,
        layout: "array",
        meta: { a: a.toString(), b: b.toString(), phase: "start" },
    };
    step += 1;

    const result = multiply(a, b);
    yield {
        stepNumber: step,
        entities: makeBars(result.coefficients, -1),
        edges: [],
        description: `Split into base-256 digits; transform length ${result.length} over the ring modulo 2^${result.ringBits} plus one.`,
        codeLineNumber: 3,
        layout: "array",
        meta: { length: result.length, ringBits: result.ringBits, coefficients: result.coefficients.slice() },
    };
    step += 1;

    yield {
        stepNumber: step,
        entities: makeBars(result.coefficients, result.coefficients.length - 1),
        edges: [],
        description: `Pointwise products transformed back give the convolution coefficients; carrying recreates ${result.product.toString()}.`,
        codeLineNumber: 7,
        layout: "array",
        meta: {
            a: a.toString(),
            b: b.toString(),
            product: result.product.toString(),
            length: result.length,
            ringBits: result.ringBits,
            complete: true,
        },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Write each integer as a polynomial whose coefficients are base-256 digits evaluated at 256. Their product is the convolution of the digit vectors. A Fourier transform turns convolution into pointwise multiplication, which is far cheaper for large inputs. The trick of Schonhage and Strassen is to run that transform modulo 2^n plus one, where the number two itself supplies the needed roots of unity, so no floating point or divisor search is required.",
        invariants: [
            "The transform length is a power of two dividing twice the ring exponent, so a principal root of unity exists.",
            "Every convolution coefficient is smaller than 2^n plus one, so reduction modulo the ring does not wrap it.",
            "The pointwise products in transform space equal the transform of the convolution by the convolution theorem.",
        ],
        correctness:
            "In the ring modulo 2^n plus one, two has multiplicative order 2n, so raising it to 2n over L gives an element of exact order L. The number theoretic transform and its inverse with the reciprocal root are inverse linear maps because L is invertible in the odd ring. By the convolution theorem the inverse transform of the pointwise products is exactly the digit convolution; since each coefficient is below the modulus, no information is lost. Reinterpreting those coefficients in base 256 with carries yields the exact integer product.",
        complexityRationale:
            "Each transform level combines L values with a constant number of ring operations, so one transform costs O(L log L) operations on n-bit words. The digit count and ring size both scale with the input bit length, giving O(n log n log log n) bit operations in the recursive analysis. The two transform arrays occupy O(n log n) space.",
        uses: [
            "Multiplying integers far beyond machine-word size in computer algebra systems",
            "Fast polynomial multiplication underlying large-number arithmetic libraries",
            "Cryptographic implementations that need exact big-integer products",
        ],
        references: [
            "Schonhage and Strassen, Schnelle Multiplikation grosser Zahlen, 1971",
            "Knuth, The Art of Computer Programming Volume 2, Section 4.3.3",
        ],
        workedExample:
            "Multiplying 123456789 by 987654321 splits each into base-256 digits, giving four digits apiece and a transform length of eight. The ring exponent is chosen so that 2^ringBits plus one is large enough and admits an eighth root of unity. After the forward transforms, pointwise products, and inverse transform, the convolution digits are recombined to give 121932631112635269.",
    },
    id: "schoenhage-strassen",
    name: "Schonhage-Strassen Multiplication",
    category: "math",
    complexity: { time: "O(n log n log log n)", space: "O(n log n)" },
    defaultInput: { a: "123456789", b: "987654321" },
    visualType: "array",
    run,
    pseudocode: [
        "split each integer into base-256 digit vectors",
        "choose a transform length that is a power of two",
        "pick the ring exponent so coefficients fit and a root exists",
        "forward transform both digit vectors over the ring",
        "multiply corresponding transform values pointwise",
        "inverse transform to recover the convolution digits",
        "carry the digits back into a base-256 integer",
        "done: report the exact product",
    ],
};

export default module;
