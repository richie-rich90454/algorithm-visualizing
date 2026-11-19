/**
 * schnorr-musig-aggregation.ts - MuSig-Style Schnorr Aggregation (Teaching Model)
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * A multisignature lets several signers produce one signature that verifies
 * against one aggregated public key. In the MuSig style, each signer's public
 * key is weighted by a hash of the full signing set, the weights combine the
 * keys into one key, and each signer contributes a partial signature from a
 * nonce and a shared challenge. The partial signatures add into a single
 * Schnorr signature. This module uses a small prime-order subgroup, so it is a
 * teaching model and deliberately omits the rogue-key defenses of real MuSig.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 *   Time:  O(signers * log q) modular operations
 *   Space: O(signers) keys and partial signatures
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 *   - Array bars show the aggregated key, the challenge, and the verdict.
 *   - meta carries the signer count and the final verification result.
 *
 * ---------------------------------------------------------------------------
 * Note
 *   - TOY MODEL. The group is tiny and rogue-key protection is omitted. Do not
 *     use this construction to protect real data.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

/** Modular exponentiation with BigInt. */
export function powMod(base: bigint, exponent: bigint, modulus: bigint): bigint {
    let result = 1n;
    let b = ((base % modulus) + modulus) % modulus;
    let e = exponent;
    while (e > 0n) {
        if (e % 2n === 1n) result = (result * b) % modulus;
        b = (b * b) % modulus;
        e /= 2n;
    }
    return result;
}

function isPrime(n: bigint): boolean {
    if (n < 2n) return false;
    for (let d = 2n; d * d <= n; d += 1n) if (n % d === 0n) return false;
    return true;
}

export interface ToyGroup {
    p: bigint;
    q: bigint;
    g: bigint;
}

let cachedGroup: ToyGroup | null = null;

/** Build a small prime-order subgroup of the integers modulo a prime. */
export function group(): ToyGroup {
    if (cachedGroup) return cachedGroup;
    const q = 1009n;
    let multiplier = 2n;
    let p = multiplier * q + 1n;
    while (!isPrime(p)) {
        multiplier += 1n;
        p = multiplier * q + 1n;
    }
    let g = 2n;
    while (powMod(g, q, p) !== 1n || g === 1n) g += 1n;
    cachedGroup = { p, q, g };
    return cachedGroup;
}

/** Deterministically map a list of numbers to a scalar modulo q. */
export function scalarHash(values: number[]): bigint {
    const { q } = group();
    let hash = 0n;
    for (const value of values) {
        hash = (hash * 257n + BigInt(((value % 256) + 256) % 256)) % q;
    }
    return hash % q;
}

function bytesOf(values: bigint[]): number[] {
    return values.flatMap((value) => value.toString().split("").map((ch) => ch.charCodeAt(0)));
}

/** Weighted aggregation of public keys. */
export function aggregatePublicKey(publicKeys: bigint[]): bigint {
    const { p } = group();
    const list = bytesOf(publicKeys);
    let aggregated = 1n;
    for (const key of publicKeys) {
        const weight = scalarHash([...list, ...bytesOf([key])]) || 1n;
        aggregated = (aggregated * powMod(key, weight, p)) % p;
    }
    return aggregated;
}

export interface MusigSignature {
    s: bigint;
    R: bigint;
    c: bigint;
}

/** Produce a single Schnorr signature from several signers. */
export function musigSign(message: number[], secrets: bigint[]): MusigSignature {
    const { p, q, g } = group();
    const publicKeys = secrets.map((secret) => powMod(g, secret, p));
    const aggregated = aggregatePublicKey(publicKeys);
    const list = bytesOf(publicKeys);

    let R = 1n;
    const nonces = secrets.map((secret, index) => {
        const nonce = scalarHash([...bytesOf([secret]), ...message, index]) || 1n;
        R = (R * powMod(g, nonce, p)) % p;
        return nonce;
    });

    const c = scalarHash([...bytesOf([aggregated, R]), ...message]) || 1n;
    let s = 0n;
    for (let i = 0; i < secrets.length; i += 1) {
        const weight = scalarHash([...list, ...bytesOf([publicKeys[i] ?? 1n])]) || 1n;
        const nonce = nonces[i] ?? 1n;
        const secret = secrets[i] ?? 0n;
        s = (s + nonce + c * weight * secret) % q;
    }
    return { s, R, c };
}

/** Verify an aggregated signature against an aggregated public key. */
export function musigVerify(message: number[], signature: MusigSignature, aggregated: bigint): boolean {
    const { p, g } = group();
    const recomputed = scalarHash([...bytesOf([aggregated, signature.R]), ...message]) || 1n;
    if (recomputed !== signature.c) return false;
    const left = powMod(g, signature.s, p);
    const right = (signature.R * powMod(aggregated, signature.c, p)) % p;
    return left === right;
}

function makeBars(key: bigint, challenge: bigint, verdict: number): VisualEntity[] {
    return [Number(key % 1000000n), Number(challenge), verdict].map((value, index) => ({
        id: `val-${index}`,
        type: "bar" as const,
        label: `${value}`,
        value,
        state: (index === 2 ? "sorted" : "active") as EntityState,
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { index, role: ["aggregated key", "challenge", "verified"][index] ?? "" },
    }));
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { secrets?: number[]; message?: number[] } | null) ?? {};
    const secrets = (task.secrets ?? [11, 23, 37]).map((value) => BigInt(value));
    const message = task.message ?? [1, 2, 3, 4, 5];
    const { p, q, g } = group();

    let step = 0;
    yield {
        stepNumber: step,
        entities: makeBars(0n, 0n, 0),
        edges: [],
        description: `MuSig-style aggregation for ${secrets.length} signers in a toy group of order ${q}.`,
        codeLineNumber: 0,
        layout: "array",
        meta: { signers: secrets.length, p: p.toString(), q: q.toString() },
    };
    step += 1;

    const publicKeys = secrets.map((secret) => powMod(g, secret, p));
    yield {
        stepNumber: step,
        entities: makeBars(publicKeys[0] ?? 0n, 0n, 0),
        edges: [],
        description: "Each signer publishes a public key derived from the generator.",
        codeLineNumber: 1,
        layout: "array",
        meta: { publicKeys: publicKeys.map(String) },
    };
    step += 1;

    const aggregated = aggregatePublicKey(publicKeys);
    yield {
        stepNumber: step,
        entities: makeBars(aggregated, 0n, 0),
        edges: [],
        description: "Hash-weighted public keys combine into one aggregated key.",
        codeLineNumber: 2,
        layout: "array",
        meta: { aggregated: aggregated.toString() },
    };
    step += 1;

    const signature = musigSign(message, secrets);
    yield {
        stepNumber: step,
        entities: makeBars(aggregated, signature.c, 0),
        edges: [],
        description: "Nonces and weighted partial signatures sum into one Schnorr signature.",
        codeLineNumber: 3,
        layout: "array",
        meta: { s: signature.s.toString(), R: signature.R.toString(), c: signature.c.toString() },
    };
    step += 1;

    const verified = musigVerify(message, signature, aggregated);
    yield {
        stepNumber: step,
        entities: makeBars(aggregated, signature.c, verified ? 1 : 0),
        edges: [],
        description: `Done: verification ${verified ? "accepts" : "rejects"} the aggregate signature. Toy group, not secure.`,
        codeLineNumber: 4,
        layout: "array",
        meta: { verified },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Several people can share one signature by turning their public keys into a single combined key and adding their partial signatures. Each key gets a weight derived from a hash of the whole signer list, which keeps the aggregation deterministic. A shared challenge binds the signature to the message, and the sum of the partial responses is checked with one group equation.",
        invariants: [
            "Every public key is the generator raised to a secret exponent.",
            "The challenge hashes the aggregated key, the combined nonce, and the message.",
            "The sum of partial responses satisfies g to the s equals R times the key to the challenge.",
        ],
        correctness:
            "Each partial signature equals the nonce plus the challenge times the weighted secret modulo the group order. Summing gives s equal to the combined nonce plus the challenge times the weighted sum of secrets. The aggregated key is the product of keys raised to their weights, which is the generator raised to that same weighted secret sum, so g to the s equals the combined nonce times the aggregated key to the challenge. A changed message changes the challenge and breaks the equality; a changed response breaks it as well.",
        complexityRationale:
            "Each signer contributes one exponentiation for the nonce, one for the key, and one for the partial response, all with exponents of about log q bits, so time is O(signers * log q). Storage is one key and one partial signature per signer.",
        uses: [
            "Compact multisignatures for threshold approvals",
            "Reducing on-chain signature data in blockchains",
            "Joint authorization by a committee of signers",
        ],
        references: [
            "Maxwell, Poelstra, and Seurin, Simple Schnorr Multi-Signatures with Applications to Bitcoin, 2019",
            "Nick, Ruffing, and Maxwell, MuSig-DN: Schnorr Multi-Signatures with Verifiably Deterministic Nonces, 2020",
        ],
        workedExample:
            "With three signers, each publishes the generator raised to their secret. Hashing the list gives a weight per key, and multiplying keys raised to their weights gives the aggregated key. Each signer derives a nonce from their secret and the message, the nonces multiply into R, and the partial responses add. Verification checks that the generator raised to the summed response equals R times the aggregated key raised to the challenge.",
    },
    id: "schnorr-musig-aggregation",
    name: "Schnorr Multi-Signature Aggregation (Toy Model)",
    category: "cryptography-security",
    complexity: { time: "O(signers * log q)", space: "O(signers)" },
    defaultInput: { secrets: [11, 23, 37], message: [1, 2, 3, 4, 5] },
    visualType: "array",
    run,
    pseudocode: [
        "choose a prime-order subgroup and a generator",
        "derive each public key from its secret exponent",
        "hash the signer list to weight each public key",
        "multiply weighted keys into an aggregated key",
        "derive nonces, combine them, and hash a challenge",
        "sum the weighted partial signatures",
        "done: verify with one group equation",
    ],
};

export default module;
