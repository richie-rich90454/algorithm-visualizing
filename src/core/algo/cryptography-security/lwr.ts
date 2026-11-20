/**
 * lwr.ts - Learning With Rounding Encryption (Toy Model)
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Learning With Rounding replaces the explicit random error of Learning With
 * Errors with deterministic rounding. Given a secret vector s and a public
 * vector a, compute the inner product modulo q and round it down to the much
 * smaller modulus p. The discarded low-order bits act as noise. That rounded
 * value b is the public key. To encrypt one bit, add half of p to b when the
 * bit is one; to decrypt, recompute the rounded inner product from s and read
 * the bit by comparing the distance on the p-cycle. This is a tiny teaching
 * instance, not a secure parameter set.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(n) for an n-dimensional secret and public vector
 *   Space: O(n) for the two vectors
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Cells show the inner product, the rounded public value and the ciphertext.
 *   - The decryption cell is green when the bit is recovered.
 *   - meta carries q, p, the vectors, the rounding error and the verdict.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface LwrInput {
    q?: number;
    p?: number;
    secret?: number[];
    a?: number[];
    bit?: number;
}

/** Round a real value to the nearest integer, rounding halves upward. */
function roundHalfUp(value: number): number {
    return Math.floor(value + 0.5);
}

/** Inner product of two vectors reduced modulo q. */
function innerProduct(a: number[], s: number[], q: number): number {
    let total = 0;
    for (let i = 0; i < a.length; i += 1) total += (a[i] ?? 0) * (s[i] ?? 0);
    return ((total % q) + q) % q;
}

/** Build a row of cells for the inner product, public value and ciphertext. */
function makeCells(inner: number, b: number, cipher: number, states: [EntityState, EntityState, EntityState]): VisualEntity[] {
    const values = [inner, b, cipher];
    const labels = ["inner", "rounded b", "cipher"];
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
    const task = (input as LwrInput | null) ?? {};
    const q = Math.max(8, Math.floor(Number(task.q ?? 64)) || 64);
    const p = Math.max(2, Math.floor(Number(task.p ?? 8)) || 8);
    const secret = Array.isArray(task.secret) && task.secret.length > 0
        ? task.secret.map((v) => Math.floor(Number(v) || 0))
        : [7, 19, 3, 41];
    const a = Array.isArray(task.a) && task.a.length > 0
        ? task.a.map((v) => Math.floor(Number(v) || 0))
        : [12, 5, 33, 27];
    const bit = Number(task.bit) === 1 ? 1 : 0;
    const inner = innerProduct(a, secret, q);
    const scaled = (p / q) * inner;
    const roundedRaw = roundHalfUp(scaled);
    const b = roundedRaw % p;
    const cipher = (b + bit * Math.floor(p / 2)) % p;
    const recomputed = roundHalfUp((p / q) * innerProduct(a, secret, q)) % p;
    const distance = ((cipher - recomputed) % p + p) % p;
    const decrypted = distance >= p / 2 ? 1 : 0;
    const error = scaled - roundedRaw;
    let step = 0;
    const emit = (description: string, codeLine: number, states: [EntityState, EntityState, EntityState], extra: Record<string, unknown>) => ({
        stepNumber: step++,
        entities: makeCells(inner, b, cipher, states),
        edges: [],
        description,
        codeLineNumber: codeLine,
        layout: "grid" as const,
        meta: {
            q,
            p,
            dimension: secret.length,
            secret: secret.slice(),
            a: a.slice(),
            inner,
            rounded: b,
            ciphertext: cipher,
            error,
            decrypted,
            ...extra,
        },
    });

    yield emit(`Toy LWR with q=${q}, p=${p} and a ${secret.length}-dimensional secret.`, 0, ["idle", "idle", "idle"], { bit });
    yield emit(`Inner product a dot s mod q is ${inner}.`, 2, ["active", "idle", "idle"], { bit });
    yield emit(`Scale by p/q to ${scaled.toFixed(3)} and round to b=${b}; error ${error.toFixed(3)}.`, 4, ["idle", "active", "idle"], { bit });
    yield emit(`Encrypt bit ${bit} by adding ${Math.floor(p / 2)} when the bit is one: cipher=${cipher}.`, 6, ["idle", "idle", "active"], { bit });
    yield emit(
        decrypted === bit
            ? `Decryption recovered bit ${decrypted} from distance ${distance} on the ${p}-cycle.`
            : `Decryption returned ${decrypted} instead of ${bit}; the rounding error was too large for these parameters.`,
        8,
        ["idle", "idle", decrypted === bit ? "sorted" : "error"],
        { bit, distance, match: decrypted === bit ? 1 : 0 },
    );
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Start with the inner product of a public vector and a secret vector modulo a large number q. Instead of adding random noise, multiply by p over q and round to the nearest integer in a small modulus p. The bits thrown away by rounding are unpredictable to someone who does not know the secret, which plays the same role as noise in Learning With Errors. Adding half of p to the rounded value encodes a one bit, and the receiver subtracts the value they recompute from the secret.",
        invariants: [
            "The rounded public value b is round((p/q) times the inner product) mod p.",
            "The rounding error between the scaled inner product and b is at most one half in magnitude.",
            "Decryption succeeds when the error stays below half of the plaintext gap p/2.",
        ],
        correctness:
            "Let x be the scaled inner product and b its nearest integer. The rounding error e = x minus b satisfies the absolute bound of one half by construction. Encryption adds either zero or p/2 to b. Decryption recomputes b from the secret and takes the distance around the p-cycle; the distance is p/2 for a one and at most one half for a zero, so the two cases are separated whenever p is at least four. The scheme therefore decrypts correctly for all inputs under those parameters. Security relies on the hardness of recovering the secret from rounded inner products, which fails at these toy sizes.",
        complexityRationale:
            "Computing the inner product scans the n entries of the vectors once, and the rounding and modular operations are constant time, so encryption and decryption are O(n). Storing the secret and public vectors uses O(n) space.",
        uses: [
            "Studying the noise-free alternative to Learning With Errors",
            "A stepping stone to post-quantum encryption such as Kyber and FHE schemes",
            "Teaching how rounding can supply cryptographic hardness",
        ],
        references: [
            "Banerjee, Peikert, and Rosen, Pseudorandom Functions and Lattices, EUROCRYPT 2012",
            "Regev, On Lattices, Learning with Errors, Random Linear Codes, and Cryptography, 2005",
        ],
        workedExample:
            "With q=64, p=8, secret 7,19,3,41 and public vector 12,5,33,27, the inner product modulo 64 is computed first. Multiplying by 8/64 and rounding gives b in the range zero to seven. Encrypting a one adds four modulo eight. The receiver recomputes b from the secret; a distance of about four means one and a distance near zero means zero.",
    },
    id: "lwr",
    name: "Learning With Rounding Encryption",
    category: "cryptography-security",
    complexity: { time: "O(n)", space: "O(n)" },
    defaultInput: {
        q: 64,
        p: 8,
        secret: [7, 19, 3, 41],
        a: [12, 5, 33, 27],
        bit: 1,
    },
    visualType: "grid",
    run,
    pseudocode: [
        "choose a large modulus q, a small modulus p and a secret vector s",
        "choose a public vector a of the same dimension",
        "compute the inner product of a and s modulo q",
        "scale by p over q and round to the nearest integer b",
        "to encrypt bit m add m times half of p to b modulo p",
        "recompute the rounded value from the secret when decrypting",
        "measure the distance from the ciphertext around the p cycle",
        "decode zero when close and one when near half the modulus",
        "done: report the ciphertext and whether the bit was recovered",
    ],
};

export default module;
