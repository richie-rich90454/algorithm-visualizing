/**
 * proxy-re-encryption.ts - Toy Proxy Re-Encryption
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Proxy re-encryption lets a semi-trusted proxy transform a ciphertext meant
 * for Alice into one meant for Bob without learning the plaintext. This teaching
 * model uses a toy discrete-log construction. Alice and Bob hold secret scalars
 * a and b with public keys g^a and g^b. Given a re-encryption key derived from
 * the difference b minus a, the proxy multiplies the encrypted message by a
 * power of the first ciphertext component, turning m*g^(a*k) into m*g^(b*k). Bob
 * then decrypts with his secret b. The model demonstrates the transformation
 * faithfully; it is NOT a secure scheme because the proxy learns a secret
 * difference and small parameters are used.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(log p) modular multiplications per exponentiation
 *   Space: O(1) for the group elements and scalars
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Cells show the ciphertext components and the recovered messages.
 *   - The value produced at each move is highlighted.
 *   - meta carries the public keys, re-encryption key, and decryption results.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface ProofInput {
    p?: number;
    g?: number;
    a?: number;
    b?: number;
    k?: number;
    m?: number;
}

function modpow(base: bigint, exponent: bigint, mod: bigint): bigint {
    let result = 1n;
    let b = ((base % mod) + mod) % mod;
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

function makeCells(
    values: Array<[string, string | number]>,
    highlight: number | null,
): VisualEntity[] {
    return values.map(([label, value], index) => ({
        id: `val-${label}`,
        type: "cell" as const,
        label: `${label}:${value}`,
        value: String(value),
        state: (index === highlight ? "active" : "idle") as EntityState,
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { row: 0, col: index, field: label },
    }));
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as ProofInput | null) ?? {};
    const p = BigInt(task.p ?? 1000003);
    const g = BigInt(task.g ?? 2);
    const a = BigInt(task.a ?? 137);
    const b = BigInt(task.b ?? 911);
    const k = BigInt(task.k ?? 251);
    const m = BigInt(task.m ?? 42);
    const order = p - 1n;

    const A = modpow(g, a, p);
    const B = modpow(g, b, p);
    const rk = (((b - a) % order) + order) % order;
    const c1 = modpow(g, k, p);
    const c2 = (m * modpow(A, k, p)) % p;
    const c2Prime = (c2 * modpow(c1, rk, p)) % p;
    const decAlice = (c2 * modpow(modpow(c1, a, p), p - 2n, p)) % p;
    const decBob = (c2Prime * modpow(modpow(c1, b, p), p - 2n, p)) % p;
    const works = decAlice === m && decBob === m;
    let step = 0;

    const snap = (
        values: Array<[string, string | number]>,
        description: string,
        line: number,
        highlight: number | null,
    ): VisualFrame => ({
        stepNumber: step,
        entities: makeCells(values, highlight),
        edges: [],
        description,
        codeLineNumber: line,
        layout: "grid",
        meta: {
            p: Number(p),
            A: Number(A),
            B: Number(B),
            rk: Number(rk),
            c1: Number(c1),
            c2: Number(c2),
            c2Prime: Number(c2Prime),
            alicePlain: Number(decAlice),
            bobPlain: Number(decBob),
            works,
        },
    });

    yield snap(
        [["A", Number(A)], ["B", Number(B)]],
        `Publish Alice key A = g^a = ${A} and Bob key B = g^b = ${B} modulo ${p}.`,
        0,
        null,
    );
    step += 1;

    yield snap(
        [["rk", Number(rk)], ["A", Number(A)], ["B", Number(B)]],
        `Proxy receives re-encryption key rk = b - a mod (p-1) = ${rk}.`,
        1,
        0,
    );
    step += 1;

    yield snap(
        [["c1", Number(c1)], ["c2", Number(c2)]],
        `Encrypt message ${m} for Alice: c1 = g^k = ${c1}, c2 = m*A^k = ${c2}.`,
        2,
        1,
    );
    step += 1;

    yield snap(
        [["c1", Number(c1)], ["c2", Number(c2)], ["c2'", Number(c2Prime)]],
        `Proxy re-encrypts: c2' = c2 * c1^rk = ${c2Prime}, now encoded for Bob's key.`,
        4,
        2,
    );
    step += 1;

    yield snap(
        [
            ["c2", Number(c2)],
            ["c2'", Number(c2Prime)],
            ["alice", Number(decAlice)],
            ["bob", Number(decBob)],
        ],
        `Alice decrypts c2 to ${decAlice}; Bob decrypts c2' to ${decBob}. Both should equal ${m}.`,
        6,
        3,
    );
    step += 1;

    yield snap(
        [["alice", Number(decAlice)], ["bob", Number(decBob)], ["m", Number(m)]],
        works
            ? "Toy proxy re-encryption succeeded: the proxy transformed the ciphertext without the plaintext."
            : "Toy proxy re-encryption failed: a recovered message differs from the original.",
        7,
        null,
    );
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "A proxy that cannot read a message may still be allowed to change who can read it. If Alice's and Bob's secret scalars differ by a known amount, the proxy can use that difference as a re-encryption key: multiplying the message-carrying ciphertext by a suitable power of the random component shifts the encryption from Alice's public key to Bob's. Neither the message nor either secret is revealed by that multiplication.",
        invariants: [
            "The first ciphertext component c1 = g^k is unchanged by re-encryption.",
            "The re-encryption key is the difference of the two secret scalars modulo p-1.",
            "Only the message-carrying component c2 is transformed.",
            "Both Alice decrypting c2 and Bob decrypting c2 prime recover the original message.",
        ],
        correctness:
            "The original ciphertext encodes m times A^k = m times g to the a*k. Multiplying by c1 to the rk, where rk = b - a, gives m times g to the (a*k + (b-a)*k) = m times g to the b*k = m times B^k, which is exactly an encryption under Bob's public key. Bob multiplies by the inverse of B^k to recover m, and Alice recovers m from the original ciphertext the same way. The equality therefore holds for any message and keys in the group.",
        complexityRationale:
            "Each public key, ciphertext component, and decryption requires a modular exponentiation with an exponent below p, costing O(log p) multiplications by square-and-multiply. Only a fixed set of group elements is stored, so space is O(1).",
        uses: [
            "Delegate access control in encrypted cloud storage and content distribution",
            "Forwarding encrypted email without revealing the plaintext to the forwarder",
            "A teaching model for understanding re-encryption keys in cryptosystems",
        ],
        references: [
            "Blaze, Bleumer, and Strauss, Divertible Protocols and Atomic Proxy Cryptography, EUROCRYPT 1998",
            "Ateniese, Fu, Green, and Hohenberger, Improved Proxy Re-Encryption Schemes, 2005",
        ],
        workedExample:
            "With p = 1000003, g = 2, Alice secret 137, and Bob secret 911, the proxy key is 911 minus 137. A message m encrypted for Alice as (g^k, m*A^k) is transformed by multiplying the second component by (g^k) to the (911-137). The result decrypts with Bob's secret 911 to m, while the proxy never sees m itself.",
    },
    id: "proxy-re-encryption",
    name: "Proxy Re-Encryption (Toy Model)",
    category: "cryptography-security",
    complexity: { time: "O(log p)", space: "O(1)" },
    defaultInput: { p: 1000003, g: 2, a: 137, b: 911, k: 251, m: 42 },
    visualType: "grid",
    run,
    pseudocode: [
        "publish public keys A as g^a and B as g^b mod p",
        "give the proxy re-encryption key rk as b minus a",
        "encrypt m for Alice as c1 = g^k and c2 = m times A^k",
        "proxy computes c2 prime as c2 times c1 to the rk",
        "the transformed ciphertext is now under Bob's key",
        "Alice decrypts c2 using her secret a",
        "Bob decrypts c2 prime using his secret b",
        "done: confirm both recover the original message",
    ],
};

export default module;
