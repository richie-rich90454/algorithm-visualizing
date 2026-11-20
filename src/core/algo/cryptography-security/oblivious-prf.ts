/**
 * oblivious-prf.ts - Blinded Exponentiation OPRF (Toy Field)
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * An oblivious pseudorandom function lets a client learn F_k(x) from a server
 * that holds k, without the server learning x. In this toy construction the
 * PRF is F_k(x) = g^(k times h(x)) in a small prime field. The client raises
 * g^(h(x)) to a random blinding exponent r, so the server only sees
 * g^(r h(x)). The server raises that to k, and the client removes the blinding
 * by raising the result to the inverse of r modulo the group order, recovering
 * exactly g^(k h(x)). The field is tiny and the hash is simple, so this is a
 * teaching model and not a secure OPRF.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 *   Time:  O(log p) modular multiplications per exponentiation
 *   Space: O(1) working state
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 *   - Bars show the input, the blinded message, the unblinded result, and the
 *     directly computed PRF value for comparison.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

export const PRIME = 1009;
export const GENERATOR = 2;
export const GROUP_ORDER = PRIME - 1;
const BLINDS = [5, 11, 13, 17, 19, 23, 25, 29, 31, 37, 41, 43];

/** Pick a blinding exponent coprime to the group order. */
export function chooseBlind(index: number): number {
    return BLINDS[((index % BLINDS.length) + BLINDS.length) % BLINDS.length] ?? 5;
}

/** Modular exponentiation by repeated squaring. */
export function modPow(base: number, exponent: number, modulus: number): number {
    let result = 1 % modulus;
    let b = ((base % modulus) + modulus) % modulus;
    let e = exponent;
    while (e > 0) {
        if (e % 2 === 1) result = (result * b) % modulus;
        b = (b * b) % modulus;
        e = Math.floor(e / 2);
    }
    return result;
}

/** Modular inverse via the extended Euclidean algorithm. */
export function modInverse(value: number, modulus: number): number {
    let [oldR, r] = [((value % modulus) + modulus) % modulus, modulus];
    let [oldS, s] = [1, 0];
    while (r !== 0) {
        const q = Math.floor(oldR / r);
        [oldR, r] = [r, oldR - q * r];
        [oldS, s] = [s, oldS - q * s];
    }
    return ((oldS % modulus) + modulus) % modulus;
}

/** Deterministic exponent for an item. */
export function hashExponent(item: number): number {
    return ((item >>> 0) % (PRIME - 2)) + 1;
}

/** The PRF the server effectively evaluates. */
export function directPrf(key: number, item: number): number {
    return modPow(GENERATOR, (key * hashExponent(item)) % GROUP_ORDER, PRIME);
}

/** Client-side blinding g^(r h(x)). */
export function blind(item: number, r: number): number {
    return modPow(GENERATOR, (r * hashExponent(item)) % GROUP_ORDER, PRIME);
}

/** Server side: raise the blinded value to its secret key. */
export function serverEvaluate(blinded: number, key: number): number {
    return modPow(blinded, key, PRIME);
}

/** Client side: remove the blinding exponent. */
export function unblind(response: number, r: number): number {
    return modPow(response, modInverse(r, GROUP_ORDER), PRIME);
}

function bar(id: string, label: string, value: number, state: EntityState): VisualEntity {
    return {
        id,
        type: "bar",
        label,
        value,
        state,
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { value },
    };
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { item?: number; key?: number; blindIndex?: number } | null) ?? {};
    const item = typeof task.item === "number" ? task.item >>> 0 : 42;
    const key = typeof task.key === "number" ? task.key >>> 0 : 37;
    const r = chooseBlind(typeof task.blindIndex === "number" ? task.blindIndex : 0);

    const blinded = blind(item, r);
    const response = serverEvaluate(blinded, key);
    const result = unblind(response, r);
    const direct = directPrf(key, item);
    let step = 0;

    const frame = (phase: number, description: string, line: number): VisualFrame => ({
        stepNumber: step++,
        entities: [
            bar("bar-0", `x ${item}`, phase >= 1 ? item : 0, "idle"),
            bar("bar-1", `blinded ${blinded}`, phase >= 2 ? blinded : 0, phase >= 2 ? "active" : "unvisited"),
            bar("bar-2", `result ${result}`, phase >= 4 ? result : 0, phase >= 4 ? "sorted" : "unvisited"),
            bar("bar-3", `direct ${direct}`, phase >= 5 ? direct : 0, phase >= 5 ? "sorted" : "unvisited"),
        ],
        edges: [],
        description,
        codeLineNumber: line,
        layout: "array",
        meta: {
            item,
            key,
            blind: r,
            blinded,
            response,
            result,
            directPrf: direct,
            matches: result === direct,
        },
    });

    yield frame(1, `Client blinds item ${item} with random exponent ${r}.`, 0);
    yield frame(2, "Client sends g raised to r times hash(item) to the server.", 1);
    yield frame(3, "Server raises the blinded value to its secret key.", 2);
    yield frame(4, "Client raises the response to the inverse of r modulo the group order.", 3);
    yield frame(5, `Unblinded result equals the direct PRF value: ${result === direct}.`, 4);
}

const module: AlgorithmModule = {
    id: "oblivious-prf",
    name: "Blinded Exponentiation OPRF (Toy Field)",
    category: "cryptography-security",
    complexity: { time: "O(log p)", space: "O(1)" },
    defaultInput: { item: 42, key: 37, blindIndex: 0 },
    visualType: "array",
    run,
    pseudocode: [
        "client chooses a random blinding exponent r coprime to the group order",
        "blinded ← g raised to r times hash(x) modulo p",
        "client sends blinded to the server",
        "server responds with blinded raised to its secret key k",
        "client computes r inverse modulo the group order",
        "result ← response raised to the r inverse",
        "result equals g raised to k times hash(x), the PRF value",
    ],
    education: {
        intuition:
            "Blinding hides an input by multiplying its discrete-log exponent with a random factor the server cannot undo. Exponentiation is commutative, so the server can apply its secret key to the blinded value and the client can strip the blinding afterward. The server performs a real computation on the input's encoding but learns nothing about which item was requested.",
        invariants: [
            "The blinding exponent is coprime to the group order so its modular inverse exists.",
            "The server only ever receives g^(r h(x)), never x or h(x) alone.",
            "Unblinding cancels r exactly because (r h(x)) times k times r inverse equals k h(x) in the exponent.",
        ],
        correctness:
            "The server returns (g^(r h(x)))^k = g^(r k h(x)). Raising this to r inverse modulo the group order gives g^(r k h(x) r^-1) = g^(k h(x)), which is exactly directPrf(k, x). Because the group order reduces exponents, using the inverse modulo that order is valid for every generator of the field.",
        complexityRationale:
            "Blinding, server evaluation, and unblinding are each one modular exponentiation, costing O(log p) multiplications, and only a handful of field elements are stored.",
        uses: [
            "Password-based key exchange without revealing the password",
            "Private information retrieval and anonymous credentials",
            "Teaching the blinding technique behind RSA and OPRFs",
        ],
        references: [
            "Naor and Reingold, Number-Theoretic Constructions of Efficient Pseudo-Random Functions, 1997",
            "Casacuberta and Hesse, OPRFs from oblivious linear evaluation, 2022",
        ],
        workedExample:
            "For item 42 and key 37 with blinding r = 5, the client sends g^(5 h(42)) mod 1009. The server returns that value to the 37th power. The client raises the response to the inverse of 5 modulo 1008, obtaining g^(37 h(42)), which matches the directly computed PRF value in the last frame.",
    },
};

export default module;
