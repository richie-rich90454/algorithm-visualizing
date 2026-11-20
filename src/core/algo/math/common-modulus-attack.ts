/**
 * common-modulus-attack.ts - RSA common-modulus attack.
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * If two distinct, coprime public exponents encrypt the same message under the
 * same modulus, the plaintext can be recovered without factoring. Bezout's
 * identity gives integers a and b with a*e1 + b*e2 = 1, and the message is
 * c1^a times c2^b modulo n. Negative exponents are handled with modular
 * inverses of the ciphertexts.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(log n) big-integer multiplications
 *   Space: O(1)
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Bars show the two exponents, the ciphertexts, and the Bezout factors.
 *   - The combining step is highlighted before the recovered message appears.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

function egcd(a: bigint, b: bigint): { g: bigint; x: bigint; y: bigint } {
    let oldR = a; let r = b; let oldS = 1n; let s = 0n; let oldT = 0n; let t = 1n;
    while (r !== 0n) {
        const q = oldR / r;
        [oldR, r] = [r, oldR - q * r];
        [oldS, s] = [s, oldS - q * s];
        [oldT, t] = [t, oldT - q * t];
    }
    return { g: oldR, x: oldS, y: oldT };
}

function modInverse(a: bigint, m: bigint): bigint {
    const { g, x } = egcd(((a % m) + m) % m, m);
    if (g !== 1n) throw new Error("ciphertext is not invertible");
    return ((x % m) + m) % m;
}

function modPow(base: bigint, exponent: bigint, modulus: bigint): bigint {
    if (modulus === 1n) return 0n;
    let result = 1n;
    let b = ((base % modulus) + modulus) % modulus;
    let e = exponent;
    while (e > 0n) {
        if (e & 1n) result = (result * b) % modulus;
        b = (b * b) % modulus;
        e >>= 1n;
    }
    return result;
}

function power(base: bigint, exponent: bigint, modulus: bigint): bigint {
    return exponent < 0n ? modPow(modInverse(base, modulus), -exponent, modulus) : modPow(base, exponent, modulus);
}

function bars(labels: Array<{ id: string; label: string; value: number; state: EntityState }>): VisualEntity[] {
    return labels.map((entry) => ({
        id: entry.id,
        type: "bar" as const,
        label: entry.label,
        value: entry.value,
        state: entry.state,
        x: Number(entry.id.replace(/\D/g, "")),
        y: 0,
        width: 0,
        height: 0,
        metadata: { label: entry.label },
    }));
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { n?: number; e1?: number; e2?: number; message?: number } | null) ?? {};
    const n = BigInt(task.n ?? 3233);
    const e1 = BigInt(task.e1 ?? 3);
    const e2 = BigInt(task.e2 ?? 17);
    const message = BigInt(task.message ?? 42);
    const c1 = modPow(message, e1, n);
    const c2 = modPow(message, e2, n);
    const { g, x: a, y: b } = egcd(e1, e2);

    let step = 0;
    yield {
        stepNumber: step++,
        entities: bars([
            { id: "bar0", label: `e1=${e1}`, value: Number(e1), state: "idle" },
            { id: "bar1", label: `e2=${e2}`, value: Number(e2), state: "idle" },
            { id: "bar2", label: `c1=${c1}`, value: Number(c1 % 100000n), state: "comparing" },
            { id: "bar3", label: `c2=${c2}`, value: Number(c2 % 100000n), state: "comparing" },
        ]),
        edges: [],
        description: `Two ciphertexts share modulus ${n.toString()} under coprime exponents ${e1} and ${e2}.`,
        codeLineNumber: 0,
        layout: "array",
        meta: { n: n.toString(), e1: e1.toString(), e2: e2.toString(), c1: c1.toString(), c2: c2.toString() },
    };

    if (g !== 1n) {
        yield {
            stepNumber: step,
            entities: bars([{ id: "bar0", label: "no recovery", value: 0, state: "error" }]),
            edges: [],
            description: `Exponents share gcd ${g.toString()}, so the common-modulus attack does not apply.`,
            codeLineNumber: 1,
            layout: "array",
            meta: { gcd: g.toString(), recovered: false },
        };
        return;
    }

    yield {
        stepNumber: step++,
        entities: bars([
            { id: "bar0", label: `a=${a}`, value: Math.abs(Number(a)) + 1, state: "active" },
            { id: "bar1", label: `b=${b}`, value: Math.abs(Number(b)) + 1, state: "active" },
        ]),
        edges: [],
        description: `Bezout gives ${a.toString()} times ${e1} plus ${b.toString()} times ${e2} equals 1.`,
        codeLineNumber: 2,
        layout: "array",
        meta: { a: a.toString(), b: b.toString() },
    };

    const recovered = (power(c1, a, n) * power(c2, b, n)) % n;
    yield {
        stepNumber: step,
        entities: bars([
            { id: "bar0", label: `c1^(${a})`, value: Number(power(c1, a, n) % 100000n), state: "visited" },
            { id: "bar1", label: `c2^(${b})`, value: Number(power(c2, b, n) % 100000n), state: "visited" },
            { id: "bar2", label: `m=${recovered}`, value: Number(recovered % 100000n), state: "sorted" },
        ]),
        edges: [],
        description: `Combining the ciphertexts recovers m = ${recovered.toString()}.`,
        codeLineNumber: 5,
        layout: "array",
        meta: {
            n: n.toString(),
            recovered: recovered.toString(),
            matches: recovered === message,
            a: a.toString(),
            b: b.toString(),
        },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Two different exponents on the same message under the same modulus leak the message. Bezout coefficients turn the exponents into the number 1, so raising the two ciphertexts to those coefficients multiplies back to the message itself.",
        invariants: [
            "The ciphertexts satisfy c1 = m^e1 and c2 = m^e2 modulo n.",
            "The Bezout coefficients satisfy a*e1 + b*e2 = gcd(e1, e2).",
            "Modular inverses exist because the ciphertexts are coprime to n for valid RSA messages.",
        ],
        correctness:
            "By Bezout, a*e1 + b*e2 = 1 when the exponents are coprime. Therefore c1^a * c2^b = m^(a*e1 + b*e2) = m modulo n, using modular inverses for negative coefficients. The algebraic identity is exact in the multiplicative group, so the recovered value is the original message.",
        complexityRationale:
            "The extended Euclidean algorithm runs in O(log n) steps and each modular exponentiation uses O(log exponent) multiplications, giving O(log n) big-integer work and constant space.",
        uses: [
            "Demonstrating why RSA public exponents must not be reused with one modulus",
            "Reconstructing plaintexts in misconfigured cryptographic deployments",
            "Teaching Bezout identities in a concrete security setting",
        ],
        references: [
            "Katz and Lindell, Introduction to Modern Cryptography, chapter on RSA",
            "Menezes, van Oorschot and Vanstone, Handbook of Applied Cryptography, Chapter 8",
        ],
        workedExample:
            "With n = 3233, message 42, e1 = 3 and e2 = 17, the ciphertexts are c1 and c2. Bezout gives a = 6 and b = -1 because 6*3 - 17 = 1, so m = c1^6 * c2^(-1) mod n, and the modular inverse of c2 recovers 42.",
    },
    id: "common-modulus-attack",
    name: "Common Modulus Attack",
    category: "math",
    complexity: { time: "O(log n)", space: "O(1)" },
    defaultInput: { n: 3233, e1: 3, e2: 17, message: 42 },
    visualType: "array",
    run,
    pseudocode: [
        "given n, coprime e1 and e2, and two ciphertexts",
        "compute c1 := m^e1 mod n and c2 := m^e2 mod n",
        "use extended Euclid to find a, b with a*e1 + b*e2 = 1",
        "if the gcd is not 1, report that recovery fails",
        "for a negative exponent take the modular inverse",
        "compute m := c1^a times c2^b modulo n",
        "report the recovered message",
    ],
};

export default module;
