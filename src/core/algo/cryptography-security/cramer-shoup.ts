/**
 * cramer-shoup.ts - Cramer-Shoup Public-Key Encryption (Toy Model)
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Cramer-Shoup is a public-key cryptosystem proved secure against adaptive
 * chosen-ciphertext attacks under the decisional Diffie-Hellman assumption. A
 * ciphertext is a four-tuple: two generator powers, a blinded message and a
 * check value derived from a hash of the first three components and a secret
 * linear combination. Decryption first verifies the check value and rejects
 * any inconsistent tuple before unblinding the message. This module uses a
 * tiny 23-bit group so every step can be shown; it is a faithful structure but
 * the parameters offer no security.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(log q) modular exponentiations per component
 *   Space: O(1) group elements and secret exponents
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Four cells show u1, u2, u3 and the check value u4.
 *   - The hash exponent and verification result are reported in meta.
 *   - A tampered tuple is rejected in red in the final frame.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface Secret {
    x1?: number;
    x2?: number;
    y1?: number;
    y2?: number;
    z?: number;
}
interface CsInput {
    p?: number;
    q?: number;
    g1?: number;
    g2?: number;
    h?: number;
    k?: number;
    r?: number;
    secret?: Secret;
    tamper?: boolean;
}

/** Modular exponentiation by repeated squaring. */
function pow(base: number, exp: number, mod: number): number {
    let result = 1;
    let b = ((base % mod) + mod) % mod;
    let e = ((exp % (mod - 1)) + (mod - 1)) % (mod - 1);
    while (e > 0) {
        if (e & 1) result = (result * b) % mod;
        b = (b * b) % mod;
        e >>= 1;
    }
    return result;
}

/** Modular inverse by brute force, safe for the tiny demonstration prime. */
function invert(value: number, mod: number): number {
    for (let i = 1; i < mod; i += 1) if ((value * i) % mod === 1) return i;
    return 1;
}

/** Hash of the three ciphertext elements reduced into the exponent group. */
function hashExponent(u1: number, u2: number, u3: number, q: number): number {
    return (u1 + u2 + u3) % q;
}

function makeCells(values: number[], states: EntityState[]): VisualEntity[] {
    const labels = ["u1", "u2", "u3", "u4"];
    return values.map((value, i) => ({
        id: `value-${i}`,
        type: "cell" as const,
        label: `${labels[i]}=${value}`,
        value,
        state: states[i] ?? "idle",
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { row: 0, col: i, kind: labels[i] ?? "" },
    }));
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as CsInput | null) ?? {};
    const p = Math.max(5, Math.floor(Number(task.p ?? 23)) || 23);
    const q = Math.max(2, Math.floor(Number(task.q ?? 11)) || 11);
    const g1 = Math.floor(Number(task.g1 ?? 4)) || 4;
    const g2 = Math.floor(Number(task.g2 ?? 18)) || 18;
    const h = Math.floor(Number(task.h ?? 12)) || 12;
    const secret = task.secret ?? {};
    const x1 = Math.floor(Number(secret.x1 ?? 3)) || 3;
    const x2 = Math.floor(Number(secret.x2 ?? 4)) || 4;
    const y1 = Math.floor(Number(secret.y1 ?? 5)) || 5;
    const y2 = Math.floor(Number(secret.y2 ?? 6)) || 6;
    const z = Math.floor(Number(secret.z ?? 5)) || 5;
    const k = Math.max(0, Math.floor(Number(task.k ?? 7)) || 0);
    const r = Math.max(1, Math.floor(Number(task.r ?? 6)) || 6);
    const message = pow(g1, k, p);
    const publicC = (pow(g1, x1, p) * pow(g2, x2, p)) % p;
    const publicD = (pow(g1, y1, p) * pow(g2, y2, p)) % p;
    const u1 = pow(g1, r, p);
    const u2 = pow(g2, r, p);
    const u3 = (pow(h, r, p) * message) % p;
    const alpha = hashExponent(u1, u2, u3, q);
    const u4 = pow((publicC * pow(publicD, alpha, p)) % p, r, p);
    const deliveredU3 = task.tamper ? (u3 % p === p - 1 ? 1 : u3 + 1) : u3;
    const deliveredAlpha = hashExponent(u1, u2, deliveredU3, q);
    const check = (pow(u1, x1 + y1 * deliveredAlpha, p) * pow(u2, x2 + y2 * deliveredAlpha, p)) % p;
    const valid = check === u4;
    const clear = valid ? (deliveredU3 * invert(pow(u1, z, p), p)) % p : -1;
    const tuple = [u1, u2, deliveredU3, u4];
    let step = 0;
    const emit = (description: string, codeLine: number, states: EntityState[], extra: Record<string, unknown>) => ({
        stepNumber: step++,
        entities: makeCells(tuple, states),
        edges: [],
        description,
        codeLineNumber: codeLine,
        layout: "grid" as const,
        meta: {
            p,
            q,
            g1,
            g2,
            h,
            publicC,
            publicD,
            message,
            k,
            r,
            alpha,
            deliveredAlpha,
            check,
            ciphertext: tuple.slice(),
            valid: valid ? 1 : 0,
            clear,
            ...extra,
        },
    });

    yield emit(`Cramer-Shoup setup in a group of size ${p} with public elements c=${publicC}, d=${publicD}.`, 0, ["idle", "idle", "idle", "idle"], { phase: "setup" });
    yield emit(`Pick exponent r=${r}; the message group element is g1^${k}=${message}.`, 2, ["idle", "idle", "idle", "idle"], { phase: "random" });
    yield emit(`Compute u1=${u1}, u2=${u2} and the blinded message u3=${u3}.`, 4, ["active", "active", "active", "idle"], { phase: "blind" });
    yield emit(`Hash the first three elements to alpha=${alpha} and build the check value u4=${u4}.`, 6, ["idle", "idle", "idle", "active"], { phase: "check" });
    yield emit(
        valid
            ? `The check value matches ${check}; the tuple is authentic.`
            : `The check value ${check} differs from ${u4}; reject the modified tuple.`,
        8,
        valid ? ["sorted", "sorted", "sorted", "sorted"] : ["idle", "idle", "error", "error"],
        { phase: "verify" },
    );
    if (valid) {
        yield emit(`Unblind with u1^z to recover group element ${clear}, equal to the message ${message}.`, 9, ["idle", "idle", "sorted", "idle"], { phase: "open", recovered: clear });
    }
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Encrypt by producing two powers of the public generators, a message hidden under a power of h, and a fourth value that acts like a signature derived from a hash of the first three. The receiver recomputes that fourth value from the secret key before touching the message. If an attacker changes any component, the hash changes and the recomputed check no longer matches, so the ciphertext is rejected instead of producing a manipulated plaintext.",
        invariants: [
            "The check value u4 is computed from a hash of u1, u2 and u3.",
            "Decryption verifies u4 before attempting to unblind the message.",
            "A genuine tuple yields a check equal to u4 and recovers the original group element.",
        ],
        correctness:
            "For an honest ciphertext, u1 = g1^r and u2 = g2^r, so u1^(x1+y1 alpha) times u2^(x2+y2 alpha) equals (g1^x1 g2^x2)^r times (g1^y1 g2^y2)^(alpha r) = (c d^alpha)^r = u4, which is exactly the verification equation. The blinding factor h^r cancels when dividing u3 by u1^z because h = g1^z, leaving the message element. Changing u3 changes the hash exponent, so the recomputed check differs from the unchanged u4 and the tuple is rejected, giving chosen-ciphertext security under the underlying group assumption.",
        complexityRationale:
            "Encryption and decryption perform a constant number of modular exponentiations, each costing O(log q) multiplications by square and multiply. Only a handful of group elements and secret exponents are stored, so space is O(1).",
        uses: [
            "Chosen-ciphertext secure public-key encryption in cryptographic libraries",
            "A teaching example of the hash-proof-style CCA security argument",
            "Hybrid encryption designs that need built-in ciphertext integrity",
        ],
        references: [
            "Cramer and Shoup, A Practical Public Key Cryptosystem Provably Secure Against Adaptive Chosen Ciphertext Attack, CRYPTO 1998",
            "Katz and Lindell, Introduction to Modern Cryptography, chapter on CCA-secure encryption",
        ],
        workedExample:
            "With p=23, g1=4, g2=18, h=12 and secret exponents 3,4,5,6,5, the public values are c=3 and d=4. Encrypting the message element 8 with r=6 gives the tuple 2,8,3,18 and hash exponent 2. Decryption recomputes the check from the tuple as 18, accepts, and divides u3 by u1^5 to recover 8, the original message element.",
    },
    id: "cramer-shoup",
    name: "Cramer-Shoup Encryption",
    category: "cryptography-security",
    complexity: { time: "O(log q)", space: "O(1)" },
    defaultInput: {
        p: 23,
        q: 11,
        g1: 4,
        g2: 18,
        h: 12,
        k: 7,
        r: 6,
        secret: { x1: 3, x2: 4, y1: 5, y2: 6, z: 5 },
        tamper: false,
    },
    visualType: "grid",
    run,
    pseudocode: [
        "choose a group and publish generator powers c and d",
        "encode the message as a power of the generator",
        "pick a random exponent r",
        "compute the two generator powers u1 and u2",
        "blind the message into u3 using the public h",
        "hash u1, u2 and u3 into an exponent alpha",
        "compute the check value u4 from c, d, alpha and r",
        "on decryption verify u4 before unblinding u3",
        "divide out u1 to the z to recover the message",
        "done: report the ciphertext tuple and the verdict",
    ],
};

export default module;
