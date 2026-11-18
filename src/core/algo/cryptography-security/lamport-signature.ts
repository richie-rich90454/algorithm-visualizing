/**
 * lamport-signature.ts - Lamport One-Time Signature (Toy Hash)
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * A Lamport signature turns a message into a short bit string and publishes
 * two hashes per bit position: one for a zero and one for a one. Signing reveals
 * the secret that corresponds to each bit. A verifier hashes each revealed
 * secret and checks it against the published value for that bit. The scheme is
 * one-time because reusing a position leaks a secret for the opposite bit.
 *
 * ---------------------------------------------------------------------------
 * Scope of the model
 * ---------------------------------------------------------------------------
 * This is a SMALL TEACHING MODEL, not a secure Lamport signature. It uses a
 * four-bit digest and a deterministic avalanche mixer instead of a real
 * cryptographic hash, and it does not derive keys from a seed or use a full
 * 256-bit message digest. The reveal-and-check logic is exact for this toy.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(n) hash calls for key generation, signing, and verification
 *   Space: O(n) secrets, public values, and signature elements
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Two rows of four cells show the zero and one public values per position.
 *   - The revealed secret's row is highlighted for each bit.
 *   - meta carries the bit vector, public values, and verify results.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface Input {
    message?: string;
    bits?: number[];
}

const N = 4;

/** Small deterministic avalanche mixer, not a cryptographic hash. */
function toyHash(x: number): number {
    let z = (x + 0x9e3779b9) >>> 0;
    z = Math.imul(z ^ (z >>> 16), 0x21f0aaad) >>> 0;
    z = Math.imul(z ^ (z >>> 15), 0x735a2d97) >>> 0;
    return (z ^ (z >>> 15)) >>> 0;
}

/** Secret and public value for one bit position and bit choice. */
export function lamportSecret(i: number, bit: number): number {
    return toyHash(i * 10 + bit + 7);
}
export function lamportPublic(i: number, bit: number): number {
    return toyHash(lamportSecret(i, bit));
}
const hex = (v: number): string => (v >>> 0).toString(16).padStart(8, "0");

function bitsFromMessage(message: string): number[] {
    const h = toyHash(Array.from(message).reduce((acc, ch) => (acc * 31 + ch.charCodeAt(0)) >>> 0, 7));
    return Array.from({ length: N }, (_, i) => (h >>> i) & 1);
}

/** Reveal one secret per bit position. */
export function lamportSign(bits: number[]): number[] {
    return bits.map((bit, i) => lamportSecret(i, bit));
}

/** Check each revealed secret against the public value for the claimed bit. */
export function lamportVerify(sig: number[], bits: number[]): boolean {
    return bits.every((bit, i) => toyHash(sig[i] ?? 0) === lamportPublic(i, bit));
}

function makeCells(bits: number[], revealed: number[]): VisualEntity[] {
    const cells: VisualEntity[] = [];
    for (let bit = 0; bit < 2; bit += 1) {
        for (let i = 0; i < N; i += 1) {
            const selected = bits[i] === bit;
            const shown = revealed.length > 0;
            cells.push({
                id: `cell-${bit}-${i}`,
                type: "cell",
                label: shown && selected ? hex(revealed[i] ?? 0).slice(0, 6) : hex(lamportPublic(i, bit)).slice(0, 6),
                value: lamportPublic(i, bit),
                state: (shown && selected ? "active" : selected ? "comparing" : "idle") as EntityState,
                x: 0,
                y: 0,
                width: 0,
                height: 0,
                metadata: { row: bit, col: i, position: i, bit, selected },
            });
        }
    }
    return cells;
}

/** The toy Lamport signature generator. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as Input | null) ?? {};
    const supplied = task.bits;
    const bits = supplied && supplied.length === N && supplied.every((b) => b === 0 || b === 1)
        ? supplied.slice()
        : bitsFromMessage(String(task.message ?? "hello"));
    const sig = lamportSign(bits);
    const verified = lamportVerify(sig, bits);
    const bad = bits.slice();
    bad[0] = bad[0] === 0 ? 1 : 0;
    const tampered = lamportVerify(sig, bad);
    const pub = Array.from({ length: N }, (_, i) => [lamportPublic(i, 0), lamportPublic(i, 1)]).flat();

    let step = 0;
    yield {
        stepNumber: step,
        entities: makeCells(bits, []),
        edges: [],
        description: `Publish two public hashes per bit position for a ${N}-bit digest; distinct pairs prevent cross-bit reuse.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: {
            rows: 2,
            cols: N,
            N,
            bits: [],
            pk: pub.map(hex),
            verified: "pending",
            tamperedVerified: "pending",
        },
    };
    step += 1;

    yield {
        stepNumber: step,
        entities: makeCells(bits, []),
        edges: [],
        description: `Digest bits are [${bits.join(", ")}]; select the matching secret at each position.`,
        codeLineNumber: 2,
        layout: "grid",
        meta: { rows: 2, cols: N, N, bits, pk: pub.map(hex), verified: "pending", tamperedVerified: "pending" },
    };
    step += 1;

    yield {
        stepNumber: step,
        entities: makeCells(bits, sig),
        edges: [],
        description: `Signature reveals one secret per position; hashing each must equal the published value.`,
        codeLineNumber: 3,
        layout: "grid",
        meta: { rows: 2, cols: N, N, bits, pk: pub.map(hex), sig: sig.map(hex), verified: "pending", tamperedVerified: "pending" },
    };
    step += 1;

    yield {
        stepNumber: step,
        entities: makeCells(bits, sig),
        edges: [],
        description: `Verification: every revealed hash matched; verified = ${verified}.`,
        codeLineNumber: 4,
        layout: "grid",
        meta: { rows: 2, cols: N, N, bits, pk: pub.map(hex), sig: sig.map(hex), verified, tamperedVerified: "pending" },
    };
    step += 1;

    yield {
        stepNumber: step,
        entities: makeCells(bad, sig),
        edges: [],
        description: `Flipping bit 0 changes the required hash, so verification fails; tamperedVerified = ${tampered}. This toy is not secure.`,
        codeLineNumber: 5,
        layout: "grid",
        meta: {
            rows: 2,
            cols: N,
            N,
            bits: bad,
            pk: pub.map(hex),
            sig: sig.map(hex),
            verified,
            tamperedVerified: tampered,
            note: "toy hash and four-bit digest, not secure",
        },
    };
}

/** The toy Lamport one-time signature module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "A one-time signature can be built from nothing but a one-way function. For every bit of the message digest, generate two secrets and publish their hashes. To sign, reveal the secret that matches the bit; anyone can hash it and compare. Reusing the same key pair for a second message with a different bit would reveal a secret for both choices, which is why the key is strictly one-time.",
        invariants: [
            "Each bit position has two independent secret and public values.",
            "A signature reveals exactly one secret per bit position.",
            "Verification accepts only when every revealed hash matches the public value for its claimed bit.",
        ],
        correctness:
            "For an honest signature, the revealed element at position i is lamportSecret(i, bits[i]), and hashing it gives lamportPublic(i, bits[i]) by definition, so all checks pass. Changing one bit asks for the hash of a different secret at that position; the revealed secret hashes to the other public value, which is distinct for every position here, so verification fails. This proves both completeness and tamper detection for the toy key set.",
        complexityRationale:
            "Generating two public values per position takes 2n hashes, signing reveals n secrets, and verification hashes n secrets, so each phase is O(n). Storage is O(n) for secrets, public values, and the signature.",
        uses: [
            "A teaching model for one-time signatures",
            "Understanding hash-based signatures before Winternitz and Merkle schemes",
            "Explaining why one-time keys must never be reused",
        ],
        references: [
            "Lamport, Constructing Digital Signatures from a One-Way Function, 1979",
            "Merkle, A Digital Signature Based on a Conventional Encryption Function, 1987",
        ],
        workedExample:
            "For the four-bit digest 1010, the signer reveals secret(0,1), secret(1,0), secret(2,1), and secret(3,0). A verifier hashes those four values and compares them with the published hashes for bit choices one, zero, one, zero. Flipping the first bit to zero demands the other hash at position zero, which does not match.",
    },
    id: "lamport-signature",
    name: "Lamport One-Time Signature (Toy)",
    category: "cryptography-security",
    complexity: { time: "O(n)", space: "O(n)" },
    defaultInput: { message: "hello" },
    visualType: "grid",
    run,
    pseudocode: [
        "generate two secrets and two public hashes per bit position",
        "split the message digest into n bits",
        "select the secret matching each bit",
        "hash each revealed secret and compare with the public value",
        "accept only if every position matches",
        "repeat with one bit changed to test tamper detection",
        "done: report validity and the one-time-use warning",
    ],
};

export default module;
