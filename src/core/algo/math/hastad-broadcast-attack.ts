/**
 * hastad-broadcast-attack.ts - Hastad's small-exponent broadcast attack.
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * When the same short message is encrypted with the same small exponent e
 * under at least e pairwise coprime moduli, the Chinese remainder theorem
 * reconstructs m^e exactly provided m^e is smaller than the product of the
 * moduli. An integer e-th root then reveals the message without any private
 * key. Random padding or larger exponents defeat the attack.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(e log N) big-integer operations for e moduli
 *   Space: O(e)
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Bars show the ciphertext received under each modulus.
 *   - A bar for the CRT combination appears, followed by the rooted message.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

function egcd(a: bigint, b: bigint): { g: bigint; x: bigint } {
    let oldR = a; let r = b; let oldS = 1n; let s = 0n;
    while (r !== 0n) {
        const q = oldR / r;
        [oldR, r] = [r, oldR - q * r];
        [oldS, s] = [s, oldS - q * s];
    }
    return { g: oldR, x: oldS };
}

function modInverse(a: bigint, m: bigint): bigint {
    const { g, x } = egcd(((a % m) + m) % m, m);
    if (g !== 1n) throw new Error("moduli are not coprime");
    return ((x % m) + m) % m;
}

function modPow(base: bigint, exponent: bigint, modulus: bigint): bigint {
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

/** Garner-style CRT for pairwise coprime moduli. */
function combine(residues: bigint[], moduli: bigint[]): bigint {
    let x = 0n;
    let product = 1n;
    for (let i = 0; i < residues.length; i += 1) {
        const mi = moduli[i]!;
        const ci = residues[i]!;
        const factor = modInverse(product % mi, mi);
        const t = (((ci - x) % mi + mi) % mi) * factor % mi;
        x += product * t;
        product *= mi;
    }
    return x;
}

function integerRoot(value: bigint, exponent: bigint): bigint {
    if (value < 0n || exponent <= 0n) return 0n;
    if (value <= 1n) return value;
    let low = 1n;
    let high = 1n;
    while (high ** exponent <= value) high <<= 1n;
    while (low + 1n < high) {
        const mid = (low + high) >> 1n;
        if (mid ** exponent <= value) low = mid;
        else high = mid;
    }
    return low;
}

function bars(entries: Array<{ id: string; label: string; value: number; state: EntityState }>): VisualEntity[] {
    return entries.map((entry, index) => ({
        id: `bar-${index}`,
        type: "bar" as const,
        label: entry.label,
        value: entry.value,
        state: entry.state,
        x: index,
        y: 0,
        width: 0,
        height: 0,
        metadata: { label: entry.label },
    }));
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { moduli?: number[]; exponent?: number; message?: number } | null) ?? {};
    const moduli = (task.moduli ?? [101, 103, 107]).map((n) => BigInt(n));
    const exponent = BigInt(task.exponent ?? 3);
    const message = BigInt(task.message ?? 42);
    const product = moduli.reduce((acc, n) => acc * n, 1n);
    const ciphertexts = moduli.map((n) => modPow(message, exponent, n));

    let step = 0;
    yield {
        stepNumber: step++,
        entities: bars(ciphertexts.map((c, i) => ({ id: `bar-${i}`, label: `c${i}=${c}`, value: Number(c), state: "comparing" }))),
        edges: [],
        description: `The same message was broadcast to ${moduli.length} recipients under exponent ${exponent}.`,
        codeLineNumber: 0,
        layout: "array",
        meta: {
            moduli: moduli.map(String),
            exponent: exponent.toString(),
            ciphertexts: ciphertexts.map(String),
        },
    };

    const combined = combine(ciphertexts, moduli);
    yield {
        stepNumber: step++,
        entities: bars([
            ...ciphertexts.map((c, i) => ({ id: `bar-${i}`, label: `c${i}=${c}`, value: Number(c), state: "visited" as EntityState })),
            { id: "bar-combined", label: `x=${combined}`, value: Number(combined % 100000n), state: "active" as EntityState },
        ]),
        edges: [],
        description: `Chinese remaindering gives x = ${combined.toString()} modulo the product of the moduli.`,
        codeLineNumber: 3,
        layout: "array",
        meta: {
            moduli: moduli.map(String),
            exponent: exponent.toString(),
            combined: combined.toString(),
            product: product.toString(),
            exact: combined === message ** exponent,
        },
    };

    const root = integerRoot(combined, exponent);
    const verified = root ** exponent === combined;
    yield {
        stepNumber: step,
        entities: bars([
            { id: "bar-root", label: `root=${root}`, value: Number(root % 100000n), state: verified ? "sorted" : "error" },
        ]),
        edges: [],
        description: verified
            ? `The ${exponent}-th root reveals the message ${root.toString()}.`
            : "The CRT value is not a perfect power, so the attack was inconclusive.",
        codeLineNumber: 6,
        layout: "array",
        meta: {
            moduli: moduli.map(String),
            exponent: exponent.toString(),
            combined: combined.toString(),
            recovered: root.toString(),
            verified,
            correct: verified && root === message,
        },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Encrypting without padding under a tiny exponent leaves m^e below the modulus for each recipient individually, but the product of many moduli is much larger. The Chinese remainder theorem stitches the residues into the exact integer m^e, and taking an ordinary e-th root undoes the exponentiation.",
        invariants: [
            "Each ciphertext is the residue of m^e modulo its own modulus.",
            "The moduli are pairwise coprime, so CRT reconstruction is unique modulo their product.",
            "When m^e is smaller than the product, the reconstructed value equals m^e as an integer.",
        ],
        correctness:
            "By the Chinese remainder theorem the combined value is the unique residue of m^e modulo the product. If m^e is less than that product, the residue equals m^e itself. The integer e-th root is therefore exactly m, and the final perfect-power check detects when the message was too large for the method to apply.",
        complexityRationale:
            "Each recipient needs one modular exponentiation costing O(log e) multiplications, CRT combination is linear in the number of recipients, and the binary-search root takes O(log m) big-integer powerings, so the total is polynomial in the input sizes.",
        uses: [
            "Explaining why textbook RSA must use randomized padding",
            "Warnings against reusing a small exponent across recipients",
            "Cryptography coursework on the Chinese remainder theorem",
        ],
        references: [
            "Hastad, On Using RSA with Low Exponent in a Public Key Network, 1985",
            "Menezes, van Oorschot and Vanstone, Handbook of Applied Cryptography, Chapter 8",
        ],
        workedExample:
            "With exponent 3 and moduli 101, 103 and 107, the product exceeds one million. For message 42, m^3 = 74088 is below the product, so CRT returns 74088 exactly and the integer cube root returns 42.",
    },
    id: "hastad-broadcast-attack",
    name: "Hastad Broadcast Attack",
    category: "math",
    complexity: { time: "O(e log N)", space: "O(e)" },
    defaultInput: { moduli: [101, 103, 107], exponent: 3, message: 42 },
    visualType: "array",
    run,
    pseudocode: [
        "given e pairwise coprime moduli and e ciphertexts",
        "compute each c_i := m^e mod n_i",
        "set x := 0 and product := 1",
        "for each recipient i",
        "choose t so x + product*t is congruent to c_i mod n_i",
        "set x := x + product*t and product := product*n_i",
        "compute the integer e-th root of x and verify it",
    ],
};

export default module;
