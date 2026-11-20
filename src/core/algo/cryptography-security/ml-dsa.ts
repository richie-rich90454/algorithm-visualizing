/**
 * ml-dsa.ts - Toy Ring Multiplication for ML-DSA (Dilithium)
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * ML-DSA (Dilithium) signs and verifies by computing in the polynomial ring
 * Z_q[x]/(x^n + 1), where multiplication wraps around with a sign flip because
 * x to the power n equals minus one. The teachable core is that negacyclic
 * polynomial multiplication: each coefficient of the product is a sum of
 * ordinary convolution terms minus the terms that wrap past degree n. This
 * module shows the exact arithmetic on a tiny ring so it can be verified by
 * hand; production ML-DSA uses n = 256, q = 8380417, and a number-theoretic
 * transform. This toy ring is not a secure signature scheme.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(n squared) schoolbook convolution in this toy
 *   Space: O(n) for the product coefficients
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Bars are the product coefficients, revealed one position at a time.
 *   - The current coefficient is ACTIVE; finished ones are SORTED.
 *   - Ring size n, modulus q, and the full product are reported in meta.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface MldsaInput {
    n?: number;
    q?: number;
    a?: number[];
    b?: number[];
}

function mod(value: number, q: number): number {
    return ((value % q) + q) % q;
}

/** Negacyclic product in Z_q[x]/(x^n + 1), computed by schoolbook accumulation. */
function multiply(a: number[], b: number[], n: number, q: number): number[] {
    const result = new Array<number>(n).fill(0);
    for (let k = 0; k < n; k += 1) {
        let sum = 0;
        for (let i = 0; i < n; i += 1) {
            const j = k - i;
            if (j >= 0 && j < n) {
                sum += (a[i] ?? 0) * (b[j] ?? 0);
            }
            const wrapped = k + n - i;
            if (wrapped >= 0 && wrapped < n && k + n >= i) {
                sum -= (a[i] ?? 0) * (b[wrapped] ?? 0);
            }
        }
        result[k] = mod(sum, q);
    }
    return result;
}

/** Build the product bars for a frame. */
function makeBars(product: number[], count: number): VisualEntity[] {
    return product.map((value, index) => {
        let state: EntityState = "idle";
        if (index < count - 1) {
            state = "sorted";
        } else if (index === count - 1) {
            state = "active";
        }
        return {
            id: `coef-${index}`,
            type: "bar" as const,
            label: index < count ? String(value) : "?",
            value: index < count ? value : 0,
            state,
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: { index },
        };
    });
}

/** Run the toy ring multiplication generator. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as MldsaInput | null) ?? {};
    const n = typeof task.n === "number" && task.n >= 2 && task.n <= 8 ? Math.floor(task.n) : 4;
    const q = typeof task.q === "number" && task.q > 1 ? Math.floor(task.q) : 17;
    const a = Array.isArray(task.a) && task.a.length === n ? task.a : [1, 2, 3, 4].slice(0, n);
    const b = Array.isArray(task.b) && task.b.length === n ? task.b : [5, 6, 7, 8].slice(0, n);
    const product = multiply(a, b, n, q);
    let count = 0;
    let step = 0;

    const frame = (description: string, codeLineNumber: number): VisualFrame => ({
        stepNumber: step++,
        entities: makeBars(product, count),
        edges: [],
        description,
        codeLineNumber,
        layout: "array",
        meta: { n, q, product: [...product], a: [...a], b: [...b] },
    });

    yield frame(`Multiply in Z_q[x]/(x^${n} + 1) modulo ${q}; x^${n} equals minus one.`, 0);

    for (let k = 0; k < n; k += 1) {
        count = k + 1;
        yield frame(
            `Coefficient ${k}: sum of a[i]b[j] with i+j=k, minus terms that wrap past degree ${n}; result ${product[k]}.`,
            2,
        );
    }

    yield frame(`Product in the toy ML-DSA ring: [${product.join(", ")}] modulo ${q}.`, 5);
}

/** The ML-DSA teaching-core module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "Lattice signatures such as ML-DSA work with polynomials whose coefficients are taken modulo q. Because the ring identifies x to the power n with minus one, multiplying two polynomials wraps high-degree terms back to low degrees with a flipped sign. That single sign flip is the defining difference from ordinary cyclic convolution.",
        invariants: [
            "Every coefficient is reduced modulo q into the range from zero to q minus one.",
            "A term with degree at least n wraps to degree minus n and changes sign.",
            "The operation is commutative: multiplying a by b equals multiplying b by a.",
        ],
        correctness:
            "Ordinary polynomial multiplication produces degrees up to 2n minus two. Reducing modulo x to the power n plus one replaces x to the power (n + k) with minus x to the power k, so coefficient k of the reduced product equals the forward convolution coefficient k minus the forward coefficient k + n. The schoolbook loop computes exactly that difference, and a test checks it against a full-multiply-then-reduce reference and against commutativity.",
        complexityRationale:
            "For each of the n output coefficients the loop scans n pairs, so O(n squared) time and O(n) space. ML-DSA replaces this quadratic step with a number-theoretic transform costing O(n log n) at much larger n and q.",
        uses: [
            "The polynomial arithmetic inside lattice-based digital signatures",
            "Key generation, signing, and verification in post-quantum cryptography",
            "A teaching model for negacyclic convolution in a quotient ring",
        ],
        references: [
            "NIST FIPS 204, Module-Lattice-Based Digital Signature Standard (ML-DSA), 2024",
            "Lyubashevsky, Fiat-Shamir with Aborts, 2009",
        ],
        workedExample:
            "In Z_17[x]/(x^4 + 1), multiply a = [1, 2, 3, 4] by b = [5, 6, 7, 8]. Coefficient zero sums 1*5 plus the wrapped negatives 2*8, 3*7, and 4*6, giving 5 - 16 - 21 - 24 = -56, or 12 modulo 17. Repeating for the other coefficients gives the full product [12, 15, 2, 9] modulo 17.",
    },
    id: "ml-dsa",
    name: "ML-DSA (Toy Ring Multiplication)",
    category: "cryptography-security",
    complexity: { time: "O(n^2)", space: "O(n)" },
    defaultInput: { n: 4, q: 17, a: [1, 2, 3, 4], b: [5, 6, 7, 8] },
    visualType: "array",
    run,
    pseudocode: [
        "fix the ring modulus q and dimension n where x^n equals minus one",
        "for each output coefficient k from zero to n minus one",
        "sum a[i] times b[k-i] for pairs whose degrees stay below n",
        "subtract a[i] times b[k+n-i] for pairs that wrap around",
        "reduce the total modulo q and store coefficient k",
        "advance to the next coefficient",
        "done: return the product polynomial in the ring",
    ],
};

export default module;
