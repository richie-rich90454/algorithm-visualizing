/**
 * frodo-kem.ts - FrodoKEM-Style Matrix LWE Encapsulation (small toy model)
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * FrodoKEM builds a key-encapsulation mechanism from module-free LWE with large
 * matrices and rounded bits. This module replays the same teachable structure on
 * tiny matrices: a public matrix A and noisy product B hide a short secret S;
 * encapsulation sends a noisy pair U, V whose difference after subtracting the
 * secret is small enough to round each entry back to a shared bit.
 *
 * ---------------------------------------------------------------------------
 * Scope of the model
 * ---------------------------------------------------------------------------
 * This is a SMALL TOY MODEL, not FrodoKEM. It uses a uniform small secret and
 * error instead of discrete Gaussian sampling, a 97-element modulus instead of a
 * large power-of-two modulus, no seed expansion or AES-CTR stream, no CCA
 * transform, and no error reconciliation. The parameters are not secure and no
 * production-security claim is made. Every matrix equation and the rounding step
 * are exact for the toy parameters.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(n^3 + n^2 * k) for key generation and encapsulation
 *   Space: O(n^2) for the public matrices
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - A key/value grid reveals each matrix and the recovered bits in order.
 *   - The final frame reports whether both sides agree on every bit.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

const ROWS = [
    "q",
    "n",
    "k",
    "public A",
    "secret S",
    "error E",
    "public B",
    "R",
    "E1",
    "E2",
    "shared bits",
    "cipher U",
    "cipher V",
    "centered W",
    "recovered bits",
    "agreed",
] as const;

interface FrodoInput {
    q?: number;
    n?: number;
    k?: number;
    seed?: number;
}

const mod = (value: number, q: number): number => ((value % q) + q) % q;

/** Center a residue into the interval [-q/2, q/2). */
function centered(value: number, q: number): number {
    const r = mod(value, q);
    return r > q / 2 ? r - q : r;
}

/** Deterministic linear-congruential generator. */
function makeRng(seed: number): () => number {
    let state = seed >>> 0;
    return () => {
        state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
        return state;
    };
}

/** Multiply two matrices modulo q. */
function multiply(A: number[][], B: number[][], q: number): number[][] {
    const cols = B[0]?.length ?? 0;
    return A.map((row) =>
        Array.from({ length: cols }, (_v, j) =>
            mod(row.reduce((sum, value, k) => sum + value * (B[k]?.[j] ?? 0), 0), q),
        ),
    );
}

/** Add three matrices entrywise modulo q. */
function add3(A: number[][], B: number[][], C: number[][], q: number): number[][] {
    return A.map((row, i) =>
        row.map((value, j) => mod(value + (B[i]?.[j] ?? 0) + (C[i]?.[j] ?? 0), q)),
    );
}

const flatten = (matrix: number[][]): number[] => matrix.reduce<number[]>((acc, row) => acc.concat(row), []);

interface FrodoData {
    q: number;
    n: number;
    k: number;
    A: number[][];
    S: number[][];
    E: number[][];
    B: number[][];
    R: number[][];
    E1: number[][];
    E2: number[][];
    bits: number[][];
    U: number[][];
    V: number[][];
    W: number[][];
    noise: number[][];
    recovered: number[][];
    agreed: boolean;
}

/** Full toy key generation, encapsulation, and decapsulation. */
export function buildFrodo(q: number, n: number, k: number, seed: number): FrodoData {
    const next = makeRng(seed);
    const small = (rows: number, cols: number): number[][] =>
        Array.from({ length: rows }, () => Array.from({ length: cols }, () => (next() % 3) - 1));
    const bits = (rows: number, cols: number): number[][] =>
        Array.from({ length: rows }, () => Array.from({ length: cols }, () => next() % 2));

    const A = Array.from({ length: n }, () => Array.from({ length: n }, () => next() % q));
    const S = small(n, k);
    const E = small(n, k);
    const B = add3(multiply(A, S, q), E, Array.from({ length: n }, () => Array(k).fill(0)), q);

    const R = small(k, n);
    const E1 = small(k, n);
    const E2 = small(k, k);
    const shared = bits(k, k);
    const U = add3(multiply(R, A, q), E1, Array.from({ length: k }, () => Array(n).fill(0)), q);
    const half = Math.floor(q / 2);
    const encode = shared.map((row) => row.map((bit) => bit * half));
    const V = add3(multiply(R, B, q), E2, encode, q);

    const US = multiply(U, S, q);
    const W = V.map((row, i) => row.map((value, j) => centered(value - (US[i]?.[j] ?? 0), q)));
    const noise = V.map((row, i) =>
        row.map((value, j) => centered(value - (encode[i]?.[j] ?? 0) - (US[i]?.[j] ?? 0), q)),
    );
    const threshold = q / 4;
    const recovered = W.map((row) => row.map((value) => (Math.abs(value) >= threshold ? 1 : 0)));
    const agreed = recovered.every((row, i) => row.every((bit, j) => bit === (shared[i]?.[j] ?? -1)));
    return { q, n, k, A, S, E, B, R, E1, E2, bits: shared, U, V, W, noise, recovered, agreed };
}

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

/** The toy FrodoKEM generator. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as FrodoInput | null) ?? {};
    const q = typeof task.q === "number" ? Math.max(5, Math.trunc(task.q)) : 97;
    const n = typeof task.n === "number" ? Math.max(2, Math.min(8, Math.trunc(task.n))) : 4;
    const k = typeof task.k === "number" ? Math.max(1, Math.min(4, Math.trunc(task.k))) : 2;
    const seed = typeof task.seed === "number" ? Math.trunc(task.seed) : 20261118;
    const data = buildFrodo(q, n, k, seed);

    const values: Array<string | null> = Array(ROWS.length).fill(null);
    values[0] = String(q);
    values[1] = String(n);
    values[2] = String(k);
    let step = 0;
    const baseMeta = { q, n, k, seed, rows: ROWS.length, cols: 2 };

    yield {
        stepNumber: step,
        entities: makeCells(values, 0),
        edges: [],
        description: `Toy Frodo-style KEM with modulus ${q}, matrix size ${n}, and secret width ${k}. Not secure parameters.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: baseMeta,
    };
    step += 1;

    values[3] = `${n} by ${n}`;
    values[4] = `${n} by ${k}`;
    values[5] = `${n} by ${k}`;
    values[6] = `${n} by ${k}`;
    yield {
        stepNumber: step,
        entities: makeCells(values, 6),
        edges: [],
        description: `Key generation: B = A times S plus E modulo ${q}; the secret S is small and hidden by E.`,
        codeLineNumber: 2,
        layout: "grid",
        meta: {
            ...baseMeta,
            A: flatten(data.A),
            S: flatten(data.S),
            E: flatten(data.E),
            B: flatten(data.B),
        },
    };
    step += 1;

    values[7] = `${k} by ${n}`;
    values[8] = `${k} by ${k}`;
    values[9] = `${k} by ${k}`;
    values[10] = flatten(data.bits).join("");
    values[11] = `${k} by ${n}`;
    values[12] = `${k} by ${k}`;
    yield {
        stepNumber: step,
        entities: makeCells(values, 12),
        edges: [],
        description: `Encapsulation: U = R times A plus E1, V = R times B plus E2 plus half q times each shared bit.`,
        codeLineNumber: 4,
        layout: "grid",
        meta: {
            ...baseMeta,
            R: flatten(data.R),
            E1: flatten(data.E1),
            E2: flatten(data.E2),
            bits: flatten(data.bits),
            U: flatten(data.U),
            V: flatten(data.V),
        },
    };
    step += 1;

    values[13] = flatten(data.W).join(", ");
    values[14] = flatten(data.recovered).join("");
    yield {
        stepNumber: step,
        entities: makeCells(values, 14),
        edges: [],
        description: `Decapsulation: center V minus U times S; every residual stays below q/4 so rounding recovers the bits.`,
        codeLineNumber: 6,
        layout: "grid",
        meta: {
            ...baseMeta,
            W: flatten(data.W),
            recovered: flatten(data.recovered),
        },
    };
    step += 1;

    yield {
        stepNumber: step,
        entities: makeCells(values, -1),
        edges: [],
        description: data.agreed
            ? `Done: both sides share ${k * k} bits; the toy encapsulation round trips exactly.`
            : "Done: the recovered bits differ from the shared bits; the parameters are too noisy.",
        codeLineNumber: 7,
        layout: "grid",
        meta: {
            ...baseMeta,
            A: flatten(data.A),
            S: flatten(data.S),
            E: flatten(data.E),
            B: flatten(data.B),
            R: flatten(data.R),
            E1: flatten(data.E1),
            E2: flatten(data.E2),
            bits: flatten(data.bits),
            U: flatten(data.U),
            V: flatten(data.V),
            W: flatten(data.W),
            noise: flatten(data.noise),
            recovered: flatten(data.recovered),
            agreed: data.agreed,
            converged: true,
        },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Hide a short secret inside noisy linear equations and use rounding as a shared secret. The receiver subtracts the secret from the transmitted matrix product, which cancels the large terms and leaves only small noise plus half the modulus where a bit is one. Rounding each entry to the nearer half therefore recovers the same bits without sending them.",
        invariants: [
            "Every public entry satisfies B = A times S plus E modulo q.",
            "The ciphertext pair satisfies U = R times A plus E1 and V = R times B plus E2 plus encoded bits.",
            "The residual V minus U times S equals a short combination of the error terms.",
        ],
        correctness:
            "Substituting B = A S + E gives V - U S = (R(A S + E) + E2 + encode(bits)) - (R A + E1) S = R E + E2 - E1 S + encode(bits) modulo q. Each error entry is at most one, so the noise term is bounded by 2k plus one in absolute value, far below q/4 for the default parameters. Centering the residue and thresholding therefore returns exactly the encoded bits on both sides.",
        complexityRationale:
            "Multiplying n by n and n by k matrices costs O(n^2 k) operations, and the encapsulation and decapsulation products have the same order. Public matrices occupy O(n^2) space. Real FrodoKEM uses much larger dimensions and sampled noise to reach security.",
        uses: [
            "Teaching lattice key encapsulation and rounding",
            "Understanding post-quantum key establishment",
            "Comparing matrix LWE with ring-based schemes",
        ],
        references: [
            "Bos et al., FrodoKEM: Learning with Errors Key Encapsulation, NIST Round 3 submission",
            "Regev, On Lattices, Learning with Errors, Random Linear Codes, and Cryptography, STOC 2005",
        ],
        workedExample:
            "With q equal to 97, n equal to 4, and k equal to 2, key generation publishes a four by four matrix A and a four by two matrix B. Encapsulation sends a two by four matrix U and a two by two matrix V. The receiver computes V minus U times S, centers each entry, and reads a one when the value is near 48 and a zero when it is near 0.",
    },
    id: "frodo-kem",
    name: "Frodo-Style LWE KEM",
    category: "cryptography-security",
    complexity: { time: "O(n^3)", space: "O(n^2)" },
    defaultInput: { q: 97, n: 4, k: 2, seed: 20261118 },
    visualType: "grid",
    run,
    pseudocode: [
        "choose modulus q, matrix size n, secret width k, and seed",
        "sample small secret S and error E and publish A and B = A times S plus E",
        "sample small R, E1, E2 and a matrix of shared bits",
        "send U = R times A plus E1",
        "send V = R times B plus E2 plus half q times each bit",
        "compute W = V minus U times S and center each entry",
        "round each centered entry to a shared bit",
        "done: report whether both sides agree on every bit",
    ],
};

export default module;
