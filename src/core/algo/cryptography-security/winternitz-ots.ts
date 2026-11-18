/**
 * winternitz-ots.ts - Winternitz One-Time Signature (Toy Hash Core)
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * A Winternitz one-time signature turns each message digit into a position
 * on a hash chain. The public key is the end of a chain of length w, the
 * signature is the chain stopped w minus digit steps early, and verification
 * finishes the remaining steps and compares with the public key. This module
 * uses a deterministic toy hash so the exact steps are visible; it is not a
 * secure signature scheme and each key must be used only once.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(k * w) hash evaluations for k digits and chain length w
 *   Space: O(k) for the salts, public keys, and signature elements
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Bars show how many hash steps each digit uses in key generation,
 *     signing, and verification.
 *   - Salts, public keys, signatures, and the verdict are in metadata.
 */

import type { AlgorithmModule, VisualEntity, VisualFrame } from "@/types";

interface WinternitzInput { digits?: number[]; chainLength?: number; seed?: number }

function hash(value: number): number {
    return (Math.imul(value, 1664525) + 12345) >>> 0;
}

function chain(start: number, steps: number): number {
    let value = start;
    for (let i = 0; i < steps; i += 1) value = hash(value);
    return value;
}

function bars(values: number[], labels: string[]): VisualEntity[] {
    return values.map((value, index) => ({
        id: `bar-${index}`,
        type: "bar" as const,
        label: labels[index] ?? String(value),
        value,
        state: "comparing" as const,
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { index },
    }));
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as WinternitzInput | null) ?? {};
    const w = Math.max(2, typeof task.chainLength === "number" ? Math.trunc(task.chainLength) : 8);
    const digitsIn = Array.isArray(task.digits) && task.digits.length > 0 ? [...task.digits] : [3, 5, 2];
    const digits = digitsIn.map((d) => Math.min(w - 1, Math.max(0, Math.trunc(d))));
    const seed = typeof task.seed === "number" ? Math.trunc(task.seed) : 7;
    const salts = digits.map((_d, i) => hash(seed + i + 1));
    const publicKeys = salts.map((salt) => chain(salt, w));
    const signatures = digits.map((digit, i) => chain(salts[i] ?? 0, w - digit));
    const finished = digits.map((digit, i) => chain(signatures[i] ?? 0, digit));
    const verified = finished.every((value, i) => value === publicKeys[i]);

    const base = { n: digits.length, w, digits, seed, salts, publicKeys, signatures };
    yield {
        stepNumber: 0,
        entities: bars(Array(digits.length).fill(w), salts.map((s) => String(s))),
        edges: [],
        description: `For ${digits.length} digits with chain length ${w}, hash each secret salt ${w} times to form the public key.`,
        codeLineNumber: 0,
        layout: "array",
        meta: { ...base, phase: "keygen", verified: false, finished: [] },
    };
    yield {
        stepNumber: 1,
        entities: bars(digits.map((d) => w - d), signatures.map((s) => String(s))),
        edges: [],
        description: `Sign digit d by hashing its salt w minus d times: chain lengths ${digits.map((d) => w - d).join(", ")}.`,
        codeLineNumber: 1,
        layout: "array",
        meta: { ...base, phase: "sign", verified: false, finished: [] },
    };
    yield {
        stepNumber: 2,
        entities: bars(digits, finished.map((f) => String(f))),
        edges: [],
        description: `Verify by hashing each signature d more times and comparing with the public key: ${verified ? "all match" : "mismatch"}.`,
        codeLineNumber: 3,
        layout: "array",
        meta: { ...base, phase: "verify", verified, finished },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "A hash chain is a list where each value is the hash of the previous one. To sign a digit, reveal a value partway along the chain; the verifier hashes it the remaining number of steps and checks that it reaches the published endpoint. Because hashing forward is easy and reversing is hard, a signature cannot be forged from the public key, but a key may only be used once.",
        invariants: [
            "The public key element is the salt hashed w times.",
            "The signature element is the salt hashed w minus the message digit times.",
            "Hashing a signature element by the digit recovers the public key element.",
        ],
        correctness:
            "Consecutive hash applications compose, so hashing the salt w minus d times and then d more times is exactly hashing it w times. That final value is the public key element by construction, so verification succeeds for every valid digit. Changing a signature element changes its hash chain and, absent a hash collision, will not reach the published endpoint.",
        complexityRationale:
            "Key generation, signing, and verification each perform at most w hash evaluations per digit, giving O(k times w) time. The scheme stores one salt, public key element, and signature element per digit, so space is O(k).",
        uses: [
            "Teaching hash-based signatures and hash chains",
            "A building block of Merkle signature schemes",
            "One-time authentication where state is carefully managed",
        ],
        references: [
            "Winternitz, A Signature Scheme with One-Way Functions (improved by Merkle), 1978",
            "Buchmann, Dahmen and Klintsevich, Key Reuse on the Winternitz One-Time Signature Scheme, 2006",
        ],
        workedExample:
            "With chain length eight and digit three, the signer publishes the salt hashed eight times and sends the salt hashed five times. The verifier hashes the signature three more times, reaching the same published value, so the signature is accepted.",
    },
    id: "winternitz-ots",
    name: "Winternitz One-Time Signature (Toy Hash Core)",
    category: "cryptography-security",
    complexity: { time: "O(k * w) toy", space: "O(k) toy" },
    defaultInput: { digits: [3, 5, 2], chainLength: 8, seed: 7 },
    visualType: "array",
    run,
    pseudocode: [
        "choose chain length w and one secret salt per digit",
        "hash each salt w times to get the public key",
        "for message digit d hash the salt w minus d times",
        "publish those values as the signature",
        "for verification hash each signature element d times",
        "compare the result with the public key element",
        "accept only if every digit matches",
        "done: report the verification verdict",
    ],
};

export default module;
