/**
 * lwe-encryption.ts - Regev-Style LWE Encryption (Toy Parameters)
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * This is a small, fully deterministic model of learning-with-errors public-key
 * encryption. A secret binary vector s and short error vector e define a public
 * key (A, b = A*s + e mod q). To encrypt a bit, choose a short random vector r,
 * publish u = r^T*A and v = r^T*b + m*floor(q/2), and decrypt by centering
 * v - u*s. The noise stays far below q/4 so the bit is recovered exactly.
 * The parameters are tiny for replayability and are NOT secure; real schemes
 * use large dimensions and carefully sampled Gaussian noise.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(n^2) for key generation and one encryption
 *   Space: O(n^2) for the public matrix A
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - A key/value grid shows the modulus, dimension, secret, public key,
 *     ciphertext pair, and recovered bit as the computation proceeds.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

const ROWS = ["q", "n", "secret s", "error e", "public b", "message m", "cipher u", "cipher v", "noise", "decrypted"] as const;

/** Deterministic linear-congruential generator so the demo is reproducible. */
function makeRng(seed: number): () => number {
    let state = seed >>> 0;
    return () => {
        state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
        return state;
    };
}

const mod = (value: number, q: number): number => ((value % q) + q) % q;

/** Center a residue modulo q into the interval [-q/2, q/2). */
function centered(value: number, q: number): number {
    const r = mod(value, q);
    return r > q / 2 ? r - q : r;
}

interface LweData {
    q: number;
    n: number;
    s: number[];
    e: number[];
    A: number[][];
    b: number[];
    message: number;
    r: number[];
    u: number[];
    v: number;
    noise: number;
    decrypted: number;
}

/** Full deterministic LWE key generation, encryption, and decryption. */
export function buildLwe(q: number, n: number, message: number, seed: number): LweData {
    const rng = makeRng(seed);
    const s: number[] = [];
    for (let i = 0; i < n; i += 1) {
        s.push(rng() % 2);
    }
    const e: number[] = [];
    for (let i = 0; i < n; i += 1) {
        e.push((rng() % 3) - 1);
    }
    const A: number[][] = [];
    for (let i = 0; i < n; i += 1) {
        const row: number[] = [];
        for (let j = 0; j < n; j += 1) {
            row.push(rng() % q);
        }
        A.push(row);
    }
    const b: number[] = [];
    for (let i = 0; i < n; i += 1) {
        let dot = e[i] ?? 0;
        for (let j = 0; j < n; j += 1) {
            dot += (A[i]?.[j] ?? 0) * (s[j] ?? 0);
        }
        b.push(mod(dot, q));
    }
    const r: number[] = [];
    for (let i = 0; i < n; i += 1) {
        r.push(rng() % 2);
    }
    const u: number[] = [];
    for (let j = 0; j < n; j += 1) {
        let sum = 0;
        for (let i = 0; i < n; i += 1) {
            sum += (r[i] ?? 0) * (A[i]?.[j] ?? 0);
        }
        u.push(mod(sum, q));
    }
    let v = 0;
    for (let i = 0; i < n; i += 1) {
        v += (r[i] ?? 0) * (b[i] ?? 0);
    }
    v = mod(v + message * Math.floor(q / 2), q);
    let uDotS = 0;
    for (let j = 0; j < n; j += 1) {
        uDotS += (u[j] ?? 0) * (s[j] ?? 0);
    }
    const noise = centered(v - uDotS - message * Math.floor(q / 2), q);
    const recovered = centered(v - uDotS, q);
    const decrypted = Math.abs(recovered) >= q / 4 ? 1 : 0;
    return { q, n, s, e, A, b, message, r, u, v, noise, decrypted };
}

/** Build the key/value grid cells. */
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

/** The LWE generator. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { message?: number; q?: number; n?: number; seed?: number } | null) ?? {};
    const q = typeof task.q === "number" ? task.q : 97;
    const n = typeof task.n === "number" ? Math.max(2, task.n) : 4;
    const message = typeof task.message === "number" ? (task.message === 0 ? 0 : 1) : 1;
    const seed = typeof task.seed === "number" ? task.seed : 20261118;
    const data = buildLwe(q, n, message, seed);

    const values: Array<string | null> = Array(ROWS.length).fill(null);
    values[0] = String(q);
    values[1] = String(n);
    let step = 0;
    yield {
        stepNumber: step,
        entities: makeCells(values, 0),
        edges: [],
        description: `Toy LWE encryption with q = ${q} and dimension ${n} (not secure parameters).`,
        codeLineNumber: 0,
        layout: "grid",
        meta: { rows: ROWS.length, cols: 2, q, n, message, seed },
    };
    step += 1;

    values[2] = data.s.join(", ");
    values[3] = data.e.join(", ");
    yield {
        stepNumber: step,
        entities: makeCells(values, 2),
        edges: [],
        description: `Sample secret s = [${data.s.join(", ")}] and short error e = [${data.e.join(", ")}].`,
        codeLineNumber: 1,
        layout: "grid",
        meta: { rows: ROWS.length, cols: 2, q, n, message, seed, s: data.s, e: data.e },
    };
    step += 1;

    values[4] = data.b.join(", ");
    yield {
        stepNumber: step,
        entities: makeCells(values, 4),
        edges: [],
        description: `Public key b = A*s + e mod q = [${data.b.join(", ")}].`,
        codeLineNumber: 2,
        layout: "grid",
        meta: {
            rows: ROWS.length,
            cols: 2,
            q,
            n,
            message,
            seed,
            s: data.s,
            e: data.e,
            A: data.A.reduce<number[]>((acc, row) => acc.concat(row), []),
            b: data.b,
        },
    };
    step += 1;

    values[5] = String(message);
    values[6] = data.u.join(", ");
    values[7] = String(data.v);
    yield {
        stepNumber: step,
        entities: makeCells(values, 7),
        edges: [],
        description: `Encrypt bit ${message}: u = r^T*A = [${data.u.join(", ")}], v = r^T*b + m*floor(q/2) = ${data.v}.`,
        codeLineNumber: 4,
        layout: "grid",
        meta: {
            rows: ROWS.length,
            cols: 2,
            q,
            n,
            message,
            seed,
            b: data.b,
            u: data.u,
            v: data.v,
            r: data.r,
        },
    };
    step += 1;

    values[8] = String(data.noise);
    values[9] = String(data.decrypted);
    yield {
        stepNumber: step,
        entities: makeCells(values, 9),
        edges: [],
        description: `Decrypt: v - u*s has residual noise ${data.noise}, so the recovered bit is ${data.decrypted}.`,
        codeLineNumber: 6,
        layout: "grid",
        meta: {
            rows: ROWS.length,
            cols: 2,
            q,
            n,
            message,
            seed,
            u: data.u,
            v: data.v,
            noise: data.noise,
            decrypted: data.decrypted,
        },
    };
    step += 1;

    yield {
        stepNumber: step,
        entities: makeCells(values, -1),
        edges: [],
        description: `Done: bit ${message} encrypted and recovered as ${data.decrypted} (toy parameters, no security).`,
        codeLineNumber: 7,
        layout: "grid",
        meta: {
            rows: ROWS.length,
            cols: 2,
            q,
            n,
            message,
            seed,
            s: data.s,
            e: data.e,
            b: data.b,
            u: data.u,
            v: data.v,
            noise: data.noise,
            decrypted: data.decrypted,
            agreed: data.decrypted === message,
        },
    };
}

/** The LWE module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "Hide a secret inside noisy linear equations. The public key is a matrix of random numbers plus a few small errors; without the secret, recovering it looks like solving a hard noisy system. To send a bit, add half the modulus when the bit is one, and the small leftover noise lets the receiver round back to the right bit.",
        invariants: [
            "Every public-key entry satisfies b_i = A_i dot s + e_i modulo q.",
            "The ciphertext vector u is r transposed times the public matrix A.",
            "The decryption residual equals r dot e, which stays much smaller than q/4.",
        ],
        correctness:
            "Decryption computes v - u*s = r^T(A*s + e) + m*floor(q/2) - r^T*A*s = r^T*e + m*floor(q/2) modulo q. Because each error is small and r is binary, the noise term is bounded by n in absolute value, far below q/4 for these parameters, so centering and thresholding recovers m exactly.",
        complexityRationale:
            "Generating the n by n public matrix and multiplying it by binary vectors costs O(n^2) operations, and the stored key material is O(n^2) entries. Real schemes use much larger n and q for security.",
        uses: [
            "Post-quantum public-key encryption and key establishment",
            "The foundation of lattice schemes such as Kyber and Regev",
            "A teaching model for noisy linear algebra and rounding",
        ],
        references: [
            "Regev, On Lattices, Learning with Errors, Random Linear Codes, and Cryptography, STOC 2005",
            "Peikert, A Decade of Lattice Cryptography, Foundations and Trends in Theoretical Computer Science, 2016",
        ],
        workedExample:
            "With q = 97, n = 4, secret [1, 0, 1, 0], and errors in {-1, 0, 1}, the public key is b = A*s + e mod 97. Encrypting bit 1 picks a binary r, sends u = r^T*A and v = r^T*b + 48 mod 97, and the receiver centers v - u*s near 48 to read the bit as 1.",
    },
    id: "lwe-encryption",
    name: "LWE Encryption",
    category: "cryptography-security",
    complexity: { time: "O(n^2)", space: "O(n^2)" },
    defaultInput: { message: 1, q: 97, n: 4, seed: 20261118 },
    visualType: "grid",
    run,
    pseudocode: [
        "choose modulus q, dimension n, and a small secret vector s",
        "sample a short error vector e",
        "publish public key A and b = A times s plus e modulo q",
        "to encrypt a bit choose a short random vector r",
        "send u = r transposed times A and v = r transposed times b plus half q",
        "decrypt by centering v minus u dot s modulo q",
        "round to zero or one according to the q/4 threshold",
        "done: report the recovered bit",
    ],
};

export default module;
