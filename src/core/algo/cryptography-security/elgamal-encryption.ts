/**
 * elgamal-encryption.ts - ElGamal Public-Key Encryption (Small Prime Toy)
 *
 * ElGamal encryption relies on the difficulty of discrete logarithms. A private
 * exponent x gives a public value y = g^x mod p. To encrypt a message m one
 * chooses an ephemeral exponent k, sends (g^k, m*y^k) mod p, and decrypts by
 * multiplying by the inverse of (g^k)^x. This implementation is exact but uses
 * a small prime, so it is a teaching model with no security.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

/** Modular exponentiation using BigInt to avoid overflow. */
export function modPow(base: number, exponent: number, modulus: number): number {
    let result = 1n;
    let b = BigInt(base) % BigInt(modulus);
    let e = BigInt(exponent);
    const m = BigInt(modulus);
    while (e > 0n) {
        if (e & 1n) {
            result = (result * b) % m;
        }
        b = (b * b) % m;
        e >>= 1n;
    }
    return Number(result);
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

/** Deterministic linear congruential generator for the ephemeral exponent. */
function makeRng(seed: number): () => number {
    let state = seed >>> 0;
    return () => {
        state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
        return state;
    };
}

export interface ElGamalToy {
    p: number;
    g: number;
    x: number;
    y: number;
    message: number;
    k: number;
    c1: number;
    shared: number;
    c2: number;
    recoveredShared: number;
    decrypted: number;
}

/** Key generation, encryption, and decryption at small parameters. */
export function buildElGamal(p: number, g: number, x: number, message: number, seed: number): ElGamalToy {
    const y = modPow(g, x, p);
    const rng = makeRng(seed);
    const k = 1 + (rng() % (p - 2));
    const c1 = modPow(g, k, p);
    const shared = modPow(y, k, p);
    const c2 = (message * shared) % p;
    const recoveredShared = modPow(c1, x, p);
    const decrypted = (c2 * modInverse(recoveredShared, p)) % p;
    return { p, g, x, y, message, k, c1, shared, c2, recoveredShared, decrypted };
}

function makeCells(rows: Array<[string, string]>, revealed: number, current: number): VisualEntity[] {
    const entities: VisualEntity[] = [];
    rows.forEach(([label, value], row) => {
        const state: EntityState = row === current ? "comparing" : row <= revealed ? "sorted" : "idle";
        for (let col = 0; col < 2; col += 1) {
            entities.push({
                id: `cell-${row}-${col}`,
                type: "cell",
                label: col === 0 ? label : row <= revealed ? value : "?",
                value: col === 0 ? label : value,
                state,
                x: 0,
                y: 0,
                width: 0,
                height: 0,
                metadata: { row, col },
            });
        }
    });
    return entities;
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (
        input as { p?: number; g?: number; x?: number; message?: number; seed?: number } | null
    ) ?? {};
    const p = typeof task.p === "number" && task.p > 3 ? Math.floor(task.p) : 467;
    const g = typeof task.g === "number" && task.g > 1 && task.g < p ? Math.floor(task.g) : 2;
    const x = typeof task.x === "number" && task.x > 1 && task.x < p - 1 ? Math.floor(task.x) : 127;
    const message = typeof task.message === "number" && task.message > 0 && task.message < p
        ? Math.floor(task.message)
        : 42;
    const seed = typeof task.seed === "number" ? task.seed : 20261118;
    const data = buildElGamal(p, g, x, message, seed);
    const rows: Array<[string, string]> = [
        ["prime p", String(p)],
        ["generator g", String(g)],
        ["private x", String(x)],
        ["public y = g^x", String(data.y)],
        ["message m", String(message)],
        ["ephemeral k", String(data.k)],
        ["cipher c1 = g^k", String(data.c1)],
        ["shared y^k", String(data.shared)],
        ["cipher c2 = m*y^k", String(data.c2)],
        ["recv shared c1^x", String(data.recoveredShared)],
        ["decrypted", String(data.decrypted)],
    ];
    const metaBase = { rows: rows.length, cols: 2, p, g, x, message, seed };

    let step = 0;
    yield {
        stepNumber: step,
        entities: makeCells(rows, -1, -1),
        edges: [],
        description: `ElGamal encryption modulo the small prime ${p}. Parameters are tiny for replay and are NOT secure.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: { ...metaBase },
    };
    step += 1;

    for (let i = 0; i < rows.length - 1; i += 1) {
        yield {
            stepNumber: step,
            entities: makeCells(rows, i, i),
            edges: [],
            description: `${rows[i]?.[0]}: ${rows[i]?.[1]}.`,
            codeLineNumber: i < 4 ? 1 : i < 9 ? 3 : 5,
            layout: "grid",
            meta: { ...metaBase, y: data.y, c1: data.c1, c2: data.c2 },
        };
        step += 1;
    }

    yield {
        stepNumber: step,
        entities: makeCells(rows, rows.length - 1, rows.length - 1),
        edges: [],
        description: `Done: message ${message} decrypted as ${data.decrypted} (toy parameters, no security).`,
        codeLineNumber: 7,
        layout: "grid",
        meta: { ...metaBase, y: data.y, c1: data.c1, c2: data.c2, decrypted: data.decrypted, agreed: data.decrypted === message, done: true },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "ElGamal hides a message by multiplying it by a shared secret that only the receiver can reconstruct. The receiver publishes y = g^x; a sender picks a fresh k and sends both g^k and the message times y^k. Because (g^k)^x = (g^x)^k, the receiver recomputes the same secret from the public part of the ciphertext and divides it out.",
        invariants: [
            "The public key satisfies y = g^x mod p.",
            "The two shared secrets agree: y^k = (g^k)^x mod p.",
            "Decryption multiplies c2 by the inverse of the recovered shared secret.",
        ],
        correctness:
            "Exponent arithmetic gives (g^k)^x = g^(kx) = (g^x)^k = y^k modulo p, so the sender's and receiver's shared secrets are identical. The receiver computes c2 * (c1^x)^-1 = m*y^k*(y^k)^-1 = m mod p, recovering the message exactly whenever the shared secret is nonzero, which holds for the prime modulus used here.",
        complexityRationale:
            "Key generation, encryption, and decryption each use a constant number of modular exponentiations, costing O(log p) multiplications with BigInt, and O(1) stored integers. Real ElGamal uses a large prime so discrete logarithms are infeasible.",
        uses: [
            "Public-key encryption and hybrid key transport",
            "The basis of discrete-log based cryptosystems",
            "A teaching model for ephemeral keys and shared secrets",
        ],
        references: [
            "ElGamal, A Public Key Cryptosystem and a Signature Scheme Based on Discrete Logarithms, 1985",
            "Menezes, van Oorschot, and Vanstone, Handbook of Applied Cryptography, Chapter 8, 1996",
        ],
        workedExample:
            "With p=467, g=2, and private x=127, the public key is y = 2^127 mod 467. For a message 42 and an ephemeral k, the sender transmits c1 = 2^k and c2 = 42*y^k mod 467. The receiver computes c1^127 = y^k and multiplies c2 by its inverse to read 42.",
    },
    id: "elgamal-encryption",
    name: "ElGamal Encryption",
    category: "cryptography-security",
    complexity: { time: "O(log p)", space: "O(1)" },
    defaultInput: { p: 467, g: 2, x: 127, message: 42, seed: 20261118 },
    visualType: "grid",
    run,
    pseudocode: [
        "choose a prime p, a base g, and a private exponent x",
        "publish the public key y equal to g raised to x modulo p",
        "choose a fresh ephemeral exponent k for the message",
        "send c1 equal to g raised to k modulo p",
        "send c2 equal to the message times y raised to k modulo p",
        "recover the shared secret as c1 raised to x modulo p",
        "multiply c2 by the inverse of that shared secret",
        "done: report the recovered message",
    ],
};

export default module;
