/**
 * attribute-based-encryption.ts - Toy Threshold ABE via Secret Sharing
 *
 * TOY MODEL - NOT FOR PRODUCTION. Real ciphertext-policy ABE uses bilinear
 * pairings and a monotone access formula. This implements the teachable core:
 * a threshold attribute policy enforced with Shamir secret sharing, where any
 * k of n attributes reconstruct the decryption secret. Encryption is a toy XOR
 * with a hash-derived byte. No pairing, no authenticity, no security claim.
 *
 * Time:  O(n * k^2) to test every attribute subset with Lagrange interpolation
 * Space: O(n)
 */

import type { AlgorithmModule, VisualEntity, VisualFrame } from "@/types";

interface AbeInput {
    totalAttributes?: number;
    threshold?: number;
    secret?: number;
    plaintext?: number;
}

const PRIME = 1000003;

/** Modular exponentiation for inverses in the prime field. */
function powMod(base: number, exponent: number, mod: number): number {
    let result = 1;
    let b = ((base % mod) + mod) % mod;
    let e = exponent;
    while (e > 0) {
        if (e & 1) {
            result = (result * b) % mod;
        }
        b = (b * b) % mod;
        e = Math.floor(e / 2);
    }
    return result;
}

/** Toy key hash so a reconstructed secret yields a byte for XOR. */
function keyByte(secret: number): number {
    let h = Math.imul(secret >>> 0, 2654435761) >>> 0;
    h ^= h >>> 15;
    return h & 0xff;
}

/** Evaluate the sharing polynomial f(x) = secret + a1 x + ... */
function evalPoly(coeffs: number[], x: number): number {
    let result = 0;
    for (let i = coeffs.length - 1; i >= 0; i -= 1) {
        result = (result * x + (coeffs[i] ?? 0)) % PRIME;
    }
    return (result + PRIME) % PRIME;
}

/** Lagrange interpolation at zero from a set of share indices. */
function reconstruct(shares: Map<number, number>, subset: number[]): number {
    let result = 0;
    for (const i of subset) {
        let basis = 1;
        for (const j of subset) {
            if (j === i) {
                continue;
            }
            basis = (basis * (((-j % PRIME) + PRIME) % PRIME)) % PRIME;
            basis = (basis * powMod(i - j, PRIME - 2, PRIME)) % PRIME;
        }
        result = (result + (shares.get(i) ?? 0) * basis) % PRIME;
    }
    return (result + PRIME) % PRIME;
}

/** One bar per attribute share. */
function makeBars(shares: number[], revealed: number): VisualEntity[] {
    return shares.map((value, index) => ({
        id: `share-${index + 1}`,
        type: "bar" as const,
        label: `a${index + 1}:${value % 997}`,
        value: value % 997,
        state: (index < revealed ? "sorted" : "idle") as "sorted" | "idle",
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { index: index + 1, share: value },
    }));
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as AbeInput | null) ?? {};
    const n = Math.max(2, Math.min(Math.trunc(task.totalAttributes ?? 3), 6));
    const k = Math.max(2, Math.min(Math.trunc(task.threshold ?? 2), n));
    const secret = ((Math.trunc(task.secret ?? 4242) % PRIME) + PRIME) % PRIME;
    const plaintext = ((Math.trunc(task.plaintext ?? 73) % 256) + 256) % 256;

    const coefficients = [secret];
    for (let i = 1; i < k; i += 1) {
        coefficients.push((secret * 7 + i * 123457) % PRIME);
    }
    const shares = new Map<number, number>();
    for (let i = 1; i <= n; i += 1) {
        shares.set(i, evalPoly(coefficients, i));
    }
    const cipher = plaintext ^ keyByte(secret);

    // Test every nonempty subset to see which attribute sets can decrypt.
    const subsetResults: string[] = [];
    for (let mask = 1; mask < 1 << n; mask += 1) {
        const subset: number[] = [];
        for (let i = 1; i <= n; i += 1) {
            if (mask & (1 << (i - 1))) {
                subset.push(i);
            }
        }
        const recovered = reconstruct(shares, subset);
        const works = recovered === secret && (cipher ^ keyByte(recovered)) === plaintext;
        subsetResults.push(`${subset.join(",")}:${works ? "ok" : "fail"}`);
    }

    const shareValues = Array.from({ length: n }, (_v, i) => shares.get(i + 1) ?? 0);
    let step = 0;
    yield {
        stepNumber: step,
        entities: makeBars(shareValues, 0),
        edges: [],
        description: `Threshold policy: any ${k} of ${n} attributes reconstruct the secret.`,
        codeLineNumber: 0,
        layout: "array",
        meta: {
            n,
            k,
            prime: PRIME,
            secret,
            plaintext,
            cipher,
            coefficients,
            shares: shareValues,
            subsetResults,
        },
    };
    step += 1;

    for (let i = 1; i <= n; i += 1) {
        yield {
            stepNumber: step,
            entities: makeBars(shareValues, i),
            edges: [],
            description: `Attribute ${i} holds share f(${i}) = ${shares.get(i)}.`,
            codeLineNumber: 3,
            layout: "array",
            meta: {
                n,
                k,
                prime: PRIME,
                secret,
                plaintext,
                cipher,
                coefficients,
                shares: shareValues,
                subsetResults,
            },
        };
        step += 1;
    }

    const satisfying = Array.from({ length: k }, (_v, i) => i + 1);
    const recovered = reconstruct(shares, satisfying);
    yield {
        stepNumber: step,
        entities: makeBars(shareValues, n),
        edges: [],
        description: `Attributes ${satisfying.join(", ")} reconstruct secret ${recovered}; XOR decryption returns ${cipher ^ keyByte(recovered)}.`,
        codeLineNumber: 6,
        layout: "array",
        meta: {
            n,
            k,
            prime: PRIME,
            secret,
            plaintext,
            cipher,
            coefficients,
            shares: shareValues,
            subsetResults,
            recoveredFromFirstK: recovered,
        },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Attribute-based encryption ties the decryption key to a policy over attributes: only a user whose attributes satisfy the policy can recover the secret. In a threshold policy any k of n attributes are enough. Shamir secret sharing enforces this neatly by hiding the secret as the constant term of a degree k-1 polynomial and handing out one point per attribute.",
        invariants: [
            "Each attribute receives one evaluation of the sharing polynomial at a distinct point.",
            "Any k shares determine the degree k-1 polynomial and thus its constant term.",
            "Fewer than k shares leave the secret undetermined.",
        ],
        correctness:
            "Lagrange interpolation reconstructs a degree k-1 polynomial from k or more points exactly. Evaluating the reconstructed polynomial at zero returns its constant term, which is the secret. Fewer than k points leave free coefficients, so reconstruction yields a value unrelated to the true secret and the XOR decryption fails.",
        complexityRationale:
            "Building n shares costs O(n * k). Testing every attribute subset with Lagrange basis products costs O(2^n * k^2), which is fine for the small n used here; memory for shares is O(n).",
        uses: [
            "Teaching policy-based access control with secret sharing",
            "Modeling threshold decryption in distributed key management",
            "Understanding the access-structure core of attribute-based encryption",
        ],
        references: [
            "Shamir, How to Share a Secret, 1979",
            "Sahai and Waters, Fuzzy Identity-Based Encryption, 2005",
        ],
        workedExample:
            "With a 2-of-3 policy and secret 4242, the dealer builds a line whose intercept is 4242 and gives attributes A, B, C the values of that line at x = 1, 2, 3. Any two attributes interpolate the line and recover 4242; a single attribute cannot, so it cannot derive the XOR key.",
    },
    id: "attribute-based-encryption",
    name: "Attribute-Based Encryption (Toy Threshold)",
    category: "cryptography-security",
    complexity: { time: "O(2^n * k^2)", space: "O(n)" },
    defaultInput: { totalAttributes: 3, threshold: 2, secret: 4242, plaintext: 73 },
    visualType: "array",
    run,
    pseudocode: [
        "choose a prime field and a threshold policy of k of n attributes",
        "place the secret as the constant term of a random degree k-1 polynomial",
        "give each attribute one evaluation of that polynomial",
        "encrypt the message by XOR with a hash of the secret",
        "for a user subset, interpolate the polynomial from its shares",
        "read the constant term and derive the XOR key",
        "accept only when decryption recovers the message",
        "done: report which attribute sets satisfy the policy",
    ],
};

export default module;
