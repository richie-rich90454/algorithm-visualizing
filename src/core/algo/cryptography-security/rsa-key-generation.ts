/**
 * rsa-key-generation.ts - RSA Key Generation (Small-Parameter Model)
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * This is a faithful small-parameter model of RSA key generation, not a secure
 * implementation. It picks two primes p and q, forms the modulus n and Euler
 * totient phi, chooses a public exponent e coprime to phi, and computes the
 * private exponent d as the modular inverse of e modulo phi using the extended
 * Euclidean algorithm. A full message round trip demonstrates the key pair.
 * Production RSA uses thousands of bits and certified primes; these tiny keys
 * are for the mathematics only and offer no security.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(log(phi)) for the extended Euclid step
 *   Space: O(1) beyond the visualization
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - A two-column grid lists p, q, n, phi, e, d, the inverse check, and a
 *     sample round trip, filled in as the computation proceeds.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

const ROWS = ["p", "q", "n = p*q", "phi", "e (public)", "d (private)", "e*d mod phi", "round trip"] as const;

/** Modular exponentiation using BigInt so intermediate products stay exact. */
function powMod(base: number, exponent: number, modulus: number): number {
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

/** Extended Euclid: gcd, modular inverse, and the sequence of remainder steps. */
function extendedEuclid(a: number, b: number) {
    const modulus = b;
    let oldR = a;
    let r = b;
    let oldS = 1;
    let s = 0;
    const steps: string[] = [];
    while (r !== 0) {
        const quotient = Math.floor(oldR / r);
        const next = oldR - quotient * r;
        steps.push(`${oldR} = ${quotient}*${r} + ${next}`);
        const nextS = oldS - quotient * s;
        oldR = r;
        r = next;
        oldS = s;
        s = nextS;
    }
    const inverse = ((oldS % modulus) + modulus) % modulus;
    return { gcd: oldR, inverse, steps };
}

/** Build the key/value grid cells from the current state. */
function makeCells(values: Array<string | null>, current: number): VisualEntity[] {
    const entities: VisualEntity[] = [];
    for (let row = 0; row < ROWS.length; row += 1) {
        const value = values[row];
        const state: EntityState = row === current ? "comparing" : value !== null ? "sorted" : "idle";
        entities.push({
            id: `cell-${row}-0`,
            type: "cell",
            label: ROWS[row] ?? "",
            value: ROWS[row] ?? "",
            state,
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: { row, col: 0 },
        });
        entities.push({
            id: `cell-${row}-1`,
            type: "cell",
            label: value ?? "?",
            value: value ?? "",
            state,
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: { row, col: 1 },
        });
    }
    return entities;
}

/** The RSA key-generation generator. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { p?: number; q?: number; e?: number; message?: number } | null) ?? {};
    const p = typeof task.p === "number" ? task.p : 61;
    const q = typeof task.q === "number" ? task.q : 53;
    const n = p * q;
    const phi = (p - 1) * (q - 1);
    let e = typeof task.e === "number" ? task.e : 17;
    // Pick the first coprime exponent at or above the requested e.
    while (e < phi && extendedEuclid(e, phi).gcd !== 1) {
        e += 1;
    }
    const message = typeof task.message === "number" ? task.message : 42;

    const values: Array<string | null> = Array(ROWS.length).fill(null);
    values[0] = String(p);
    values[1] = String(q);
    let step = 0;
    yield {
        stepNumber: step,
        entities: makeCells(values, 0),
        edges: [],
        description: `Generating a small RSA key pair from primes p = ${p} and q = ${q} (toy parameters, not secure).`,
        codeLineNumber: 0,
        layout: "grid",
        meta: { rows: ROWS.length, cols: 2, p, q, n, phi, e, d: 0, valid: false },
    };
    step += 1;

    values[2] = String(n);
    yield {
        stepNumber: step,
        entities: makeCells(values, 2),
        edges: [],
        description: `The modulus is n = p*q = ${p}*${q} = ${n}.`,
        codeLineNumber: 1,
        layout: "grid",
        meta: { rows: ROWS.length, cols: 2, p, q, n, phi, e, d: 0, valid: false },
    };
    step += 1;

    values[3] = String(phi);
    yield {
        stepNumber: step,
        entities: makeCells(values, 3),
        edges: [],
        description: `Euler's totient is phi = (p-1)(q-1) = ${phi}.`,
        codeLineNumber: 1,
        layout: "grid",
        meta: { rows: ROWS.length, cols: 2, p, q, n, phi, e, d: 0, valid: false },
    };
    step += 1;

    values[4] = String(e);
    yield {
        stepNumber: step,
        entities: makeCells(values, 4),
        edges: [],
        description: `Choose public exponent e = ${e}, which is coprime to phi.`,
        codeLineNumber: 2,
        layout: "grid",
        meta: { rows: ROWS.length, cols: 2, p, q, n, phi, e, d: 0, valid: false },
    };
    step += 1;

    const euclid = extendedEuclid(e, phi);
    for (const stepText of euclid.steps) {
        yield {
            stepNumber: step,
            entities: makeCells(values, 5),
            edges: [],
            description: `Extended Euclid: ${stepText}.`,
            codeLineNumber: 3,
            layout: "grid",
            meta: { rows: ROWS.length, cols: 2, p, q, n, phi, e, d: 0, valid: false, euclidStep: stepText },
        };
        step += 1;
    }

    const d = euclid.inverse;
    values[5] = String(d);
    yield {
        stepNumber: step,
        entities: makeCells(values, 5),
        edges: [],
        description: `The private exponent is d = ${d}, the modular inverse of e modulo phi.`,
        codeLineNumber: 4,
        layout: "grid",
        meta: { rows: ROWS.length, cols: 2, p, q, n, phi, e, d, valid: true },
    };
    step += 1;

    const check = (e * d) % phi;
    values[6] = `${e}*${d} mod ${phi} = ${check}`;
    yield {
        stepNumber: step,
        entities: makeCells(values, 6),
        edges: [],
        description: `Check: e*d mod phi = ${check}, so the exponents are inverses.`,
        codeLineNumber: 5,
        layout: "grid",
        meta: { rows: ROWS.length, cols: 2, p, q, n, phi, e, d, valid: check === 1 },
    };
    step += 1;

    const cipher = powMod(message, e, n);
    const recovered = powMod(cipher, d, n);
    values[7] = `${message} -> ${cipher} -> ${recovered}`;
    yield {
        stepNumber: step,
        entities: makeCells(values, 7),
        edges: [],
        description: `Round trip: ${message} encrypted to ${cipher} and decrypted back to ${recovered}.`,
        codeLineNumber: 6,
        layout: "grid",
        meta: { rows: ROWS.length, cols: 2, p, q, n, phi, e, d, valid: recovered === message, message, cipher, recovered },
    };
    step += 1;

    yield {
        stepNumber: step,
        entities: makeCells(values, -1),
        edges: [],
        description: `Done: public key (${n}, ${e}), private key (${n}, ${d}). Toy size, no security.`,
        codeLineNumber: 7,
        layout: "grid",
        meta: {
            rows: ROWS.length,
            cols: 2,
            p,
            q,
            n,
            phi,
            e,
            d,
            valid: recovered === message && check === 1,
            message,
            cipher,
            recovered,
        },
    };
}

/** The RSA key-generation module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "Multiply two primes to get a modulus everyone can see, but keep the primes secret so only you can compute Euler's totient. Pick a public exponent that shares no factor with the totient, then find its private inverse. Encryption raises a message to the public exponent; only the inverse exponent undoes it.",
        invariants: [
            "The modulus n equals p times q and the totient phi equals (p-1)(q-1).",
            "The public exponent e is coprime to phi, so a modular inverse exists.",
            "The private exponent d satisfies e times d congruent to one modulo phi.",
        ],
        correctness:
            "The extended Euclidean algorithm finds integers d and k with e*d + phi*k = gcd(e, phi) = 1, so e*d is congruent to one modulo phi. Euler's theorem then gives (m^e)^d = m^(ed) congruent to m modulo n for any message m, which is exactly the decryption identity.",
        complexityRationale:
            "Choosing e scans at most a small range of candidates, and the extended Euclidean algorithm performs O(log phi) division steps. All stored values are a handful of integers, so space is O(1).",
        uses: [
            "Public-key encryption and digital signatures (with full-size keys)",
            "Secure key transport in TLS and VPNs",
            "A teaching model for modular inverses and Euler's theorem",
        ],
        references: [
            "Rivest, Shamir, and Adleman, A Method for Obtaining Digital Signatures and Public-Key Cryptosystems, 1978",
            "Menezes, Oorschot, and Vanstone, Handbook of Applied Cryptography, Chapter 8",
        ],
        workedExample:
            "With p = 61 and q = 53, n = 3233 and phi = 3120. Choosing e = 17, extended Euclid gives d = 2753 because 17 times 2753 is 46801, which is one more than 15 times 3120. Encrypting 42 gives 2557, and 2557^2753 mod 3233 returns 42.",
    },
    id: "rsa-key-generation",
    name: "RSA Key Generation",
    category: "cryptography-security",
    complexity: { time: "O(log phi)", space: "O(1)" },
    defaultInput: { p: 61, q: 53, e: 17, message: 42 },
    visualType: "grid",
    run,
    pseudocode: [
        "choose two distinct primes p and q",
        "compute n = p times q and phi = (p-1)(q-1)",
        "choose public exponent e coprime with phi",
        "run extended Euclid on e and phi",
        "set d to the modular inverse of e modulo phi",
        "publish (n, e) and keep (n, d) private",
        "encrypt m as m^e mod n and decrypt c as c^d mod n",
        "done: report the key pair and round trip",
    ],
};

export default module;
