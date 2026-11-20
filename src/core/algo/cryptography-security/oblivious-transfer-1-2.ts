/**
 * oblivious-transfer-1-2.ts - 1-out-of-2 Oblivious Transfer (Toy RSA)
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * In a 1-out-of-2 oblivious transfer, a sender holds two messages and a
 * receiver chooses exactly one to learn. The sender does not find out which
 * message was chosen, and the receiver learns nothing about the other one.
 * This teaching model uses the classic RSA-based construction with a small
 * modulus: the sender publishes two random values, the receiver blinds one of
 * them with a secret exponent, and the sender returns both messages masked by
 * RSA roots of the blinded values. Only the receiver's own secret unmasks the
 * chosen message.
 *
 * The arithmetic is exact, but the parameters are tiny and the construction is
 * not secure against a real adversary. Do not use it for real privacy.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(log N) for a few RSA modular exponentiations
 *   Space: O(log N) for the modulus-sized values
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Bars show the two messages, the blinded value, and the two masks.
 *   - meta carries the RSA intermediate values and the recovered message.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface Input {
    m0?: number;
    m1?: number;
    choice?: 0 | 1;
    x0?: number;
    x1?: number;
    k?: number;
}

const N = 3233;
const E = 17;
const D = 2753;
const M = 100;

function powMod(base: number, exp: number, mod: number): number {
    let result = 1;
    let b = ((base % mod) + mod) % mod;
    let e = exp;
    while (e > 0) {
        if (e & 1) {
            result = (result * b) % mod;
        }
        b = (b * b) % mod;
        e = Math.floor(e / 2);
    }
    return result;
}

function makeBars(m0: number, m1: number, v: number | null, c0: number | null, c1: number | null, choice: number, done: boolean): VisualEntity[] {
    const items: Array<[string, number, EntityState]> = [
        ["m0", m0, choice === 0 && done ? "sorted" : "idle"],
        ["m1", m1, choice === 1 && done ? "sorted" : "idle"],
        ["v", v ?? 0, v === null ? "unvisited" : "comparing"],
        ["c0", c0 ?? 0, c0 === null ? "unvisited" : "active"],
        ["c1", c1 ?? 0, c1 === null ? "unvisited" : "active"],
    ];
    return items.map(([label, value, state], index) => ({
        id: `bar-${index}`,
        type: "bar" as const,
        label: v === null && label === "v" ? "v?" : c0 === null && (label === "c0" || label === "c1") ? `${label}?` : `${label}=${value}`,
        value,
        state,
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { index, label, value },
    }));
}

/** The toy 1-out-of-2 oblivious transfer generator. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as Input | null) ?? {};
    const m0 = typeof task.m0 === "number" ? task.m0 : 42;
    const m1 = typeof task.m1 === "number" ? task.m1 : 99;
    const choice: 0 | 1 = task.choice === 1 ? 1 : 0;
    const x0 = typeof task.x0 === "number" ? task.x0 : 100;
    const x1 = typeof task.x1 === "number" ? task.x1 : 200;
    const k = typeof task.k === "number" ? task.k : 7;

    const ke = powMod(k, E, N);
    const v = ((choice === 0 ? x0 : x1) + ke) % N;
    const k0 = powMod((v - x0 + N) % N, D, N);
    const k1 = powMod((v - x1 + N) % N, D, N);
    const c0 = (m0 + k0) % M;
    const c1 = (m1 + k1) % M;
    const recovered = (choice === 0 ? c0 : c1) - (k % M);
    const chosen = ((recovered % M) + M) % M;
    const other = choice === 0 ? m1 : m0;

    const common = { N, E, D, x0, x1, k, m0, m1, choice };
    let step = 0;
    yield {
        stepNumber: step,
        entities: makeBars(m0, m1, null, null, null, choice, false),
        edges: [],
        description: `Toy RSA OT with N=${N}, e=${E}. Sender holds two messages; receiver will choose one.`,
        codeLineNumber: 0,
        layout: "array",
        meta: { ...common, v: 0, k0: 0, k1: 0, c0: 0, c1: 0, recovered: -1 },
    };
    step += 1;

    yield {
        stepNumber: step,
        entities: makeBars(m0, m1, null, null, null, choice, false),
        edges: [],
        description: `Sender publishes random values x0=${x0} and x1=${x1}.`,
        codeLineNumber: 1,
        layout: "array",
        meta: { ...common, v: 0, k0: 0, k1: 0, c0: 0, c1: 0, recovered: -1 },
    };
    step += 1;

    yield {
        stepNumber: step,
        entities: makeBars(m0, m1, v, null, null, choice, false),
        edges: [],
        description: `Receiver blinds x${choice} with secret k=${k}: v = (x${choice} + k^e mod N) mod N = ${v}.`,
        codeLineNumber: 3,
        layout: "array",
        meta: { ...common, v, k0: 0, k1: 0, c0: 0, c1: 0, recovered: -1 },
    };
    step += 1;

    yield {
        stepNumber: step,
        entities: makeBars(m0, m1, v, c0, c1, choice, false),
        edges: [],
        description: `Sender derives both RSA roots and returns masked messages c0=${c0}, c1=${c1}.`,
        codeLineNumber: 5,
        layout: "array",
        meta: { ...common, v, k0, k1, c0, c1, recovered: -1 },
    };
    step += 1;

    yield {
        stepNumber: step,
        entities: makeBars(m0, m1, v, c0, c1, choice, true),
        edges: [],
        description: `Receiver unmasks the chosen message with k and obtains ${chosen}.`,
        codeLineNumber: 7,
        layout: "array",
        meta: { ...common, v, k0, k1, c0, c1, recovered: chosen, otherMessage: other },
    };
    step += 1;

    yield {
        stepNumber: step,
        entities: makeBars(m0, m1, v, c0, c1, choice, true),
        edges: [],
        description: `Done: receiver learned message ${choice} (${chosen}) and not message ${1 - choice}. The sender never saw the choice. Toy parameters are not secure.`,
        codeLineNumber: 8,
        layout: "array",
        meta: { ...common, v, k0, k1, c0, c1, recovered: chosen, otherMessage: other, note: "toy parameters, not secure" },
    };
}

/** The toy 1-out-of-2 oblivious transfer module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "Oblivious transfer lets a receiver pick one of two messages without the sender learning which, and without learning the unchosen one. In the RSA version the sender gives two random anchors; the receiver hides a chosen anchor under a secret exponent and sends the result back. The sender computes both possible roots and masks the two messages with them, but only the receiver knows the one root that unmasks the chosen message.",
        invariants: [
            "The blinded value depends on the receiver's choice but reveals it only to someone who knows the secret k.",
            "The sender derives both roots k0 and k1, yet cannot tell which one the receiver can reconstruct.",
            "Only the chosen masked message subtracts to the correct plaintext modulo the message space.",
        ],
        correctness:
            "Because RSA decryption is the inverse of encryption modulo N, the root the sender computes for the chosen anchor equals the receiver's k exactly, so subtracting k from the matching masked message recovers it. The other root is unrelated to k, so the unchosen message cannot be recovered. With the toy parameters in the default input, trying to unmask the wrong ciphertext gives a different value, as the module demonstrates.",
        complexityRationale:
            "The protocol needs a small constant number of modular exponentiations with exponents bounded by N, each costing O(log N) big-integer steps. All stored values are modulus-sized, so space is O(log N).",
        uses: [
            "A teaching model for oblivious transfer and 1-out-of-n selection",
            "A building block for secure multiparty computation",
            "Private information retrieval and privacy-preserving set operations",
        ],
        references: [
            "Rabin, How to Exchange Secrets with Oblivious Transfer, 1981",
            "Even, Goldreich, and Lempel, A Randomized Protocol for Signing Contracts, 1985",
        ],
        workedExample:
            "With N=3233 and messages 42 and 99, the sender publishes x0=100 and x1=200. A receiver who wants message 0 blinds x0 with secret k=7 into v, the sender returns c0 and c1, and subtracting k from c0 gives 42. Subtracting k from c1 gives a different value, so message 1 stays hidden.",
    },
    id: "oblivious-transfer-1-2",
    name: "1-out-of-2 Oblivious Transfer (Toy)",
    category: "cryptography-security",
    complexity: { time: "O(log N)", space: "O(log N)" },
    defaultInput: { m0: 42, m1: 99, choice: 0, x0: 100, x1: 200, k: 7 },
    visualType: "array",
    run,
    pseudocode: [
        "sender chooses two random public anchors x0 and x1",
        "receiver picks a secret k and a choice bit b",
        "receiver sends v equal to x sub b plus k to the e modulo N",
        "sender computes both RSA roots of v minus each anchor",
        "sender masks each message with the corresponding root and sends both",
        "receiver subtracts k from the chosen ciphertext to recover message b",
        "the unchosen message stays hidden and the sender learns nothing",
        "note that a real deployment needs secure parameters",
        "done: report the recovered message",
    ],
};

export default module;
