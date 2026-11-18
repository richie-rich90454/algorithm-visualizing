/**
 * newhope-kem.ts - NewHope-Style Ring-LWE KEM (Toy Parameters)
 *
 * NewHope derives its hardness from the learning-with-errors problem in a
 * polynomial ring. This toy implements the teachable core: key generation,
 * encapsulation, and decapsulation with negacyclic polynomial arithmetic mod
 * (x^n + 1) and a small prime. The parameters are tiny for replayability and
 * are NOT secure; this is a teaching model, not a production KEM.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

const modq = (value: number, q: number): number => ((value % q) + q) % q;

/** Multiply two polynomials modulo (x^n + 1) and q. */
export function polyMul(a: number[], b: number[], n: number, q: number): number[] {
    const result: number[] = Array(n).fill(0);
    for (let i = 0; i < n; i += 1) {
        for (let j = 0; j < n; j += 1) {
            const index = (i + j) % n;
            const sign = i + j >= n ? -1 : 1;
            result[index] = modq((result[index] ?? 0) + sign * (a[i] ?? 0) * (b[j] ?? 0), q);
        }
    }
    return result;
}

/** Add or subtract two polynomials modulo q. */
export function polyOp(a: number[], b: number[], n: number, q: number, sign: number): number[] {
    return Array.from({ length: n }, (_, i) => modq((a[i] ?? 0) + sign * (b[i] ?? 0), q));
}

/** Deterministic linear congruential generator producing values in [0, bound). */
function sampler(seed: number, bound: number): () => number {
    let state = seed >>> 0;
    return () => {
        state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
        return state % bound;
    };
}

/** Sample a polynomial whose coefficients lie in {-1, 0, 1}. */
function smallPoly(seed: number, n: number): number[] {
    const rng = sampler(seed, 3);
    return Array.from({ length: n }, () => (rng() % 3) - 1);
}

/** Sample a polynomial with uniform coefficients in [0, q). */
function uniformPoly(seed: number, n: number, q: number): number[] {
    const rng = sampler(seed, q);
    return Array.from({ length: n }, () => rng());
}

export interface NewHopeToy {
    n: number;
    q: number;
    a: number[];
    s: number[];
    e: number[];
    b: number[];
    message: number;
    r: number[];
    e1: number[];
    e2: number[];
    u: number[];
    v: number[];
    w: number[];
    center: number;
    decoded: number;
}

/** Full toy key generation, encapsulation, and decapsulation. */
export function buildNewHope(n: number, q: number, message: number, seed: number): NewHopeToy {
    const a = uniformPoly(seed, n, q);
    const s = smallPoly(seed + 1, n);
    const e = smallPoly(seed + 2, n);
    const b = polyOp(polyMul(a, s, n, q), e, n, q, 1);
    const r = smallPoly(seed + 3, n);
    const e1 = smallPoly(seed + 4, n);
    const e2 = smallPoly(seed + 5, n);
    const u = polyOp(polyMul(a, r, n, q), e1, n, q, 1);
    const encode = Array(n).fill(0) as number[];
    encode[0] = message === 1 ? Math.floor(q / 2) : 0;
    const v = polyOp(polyOp(polyMul(b, r, n, q), e2, n, q, 1), encode, n, q, 1);
    const w = polyOp(v, polyMul(u, s, n, q), n, q, -1);
    const residue = modq(w[0] ?? 0, q);
    const center = residue > q / 2 ? residue - q : residue;
    const decoded = residue > q / 4 && residue < (3 * q) / 4 ? 1 : 0;
    return { n, q, a, s, e, b, message, r, e1, e2, u, v, w, center, decoded };
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
    const task = (input as { message?: number; n?: number; q?: number; seed?: number } | null) ?? {};
    const message = typeof task.message === "number" && (task.message === 0 || task.message === 1)
        ? task.message
        : 1;
    const n = typeof task.n === "number" && task.n >= 4 ? Math.pow(2, Math.floor(Math.log2(task.n))) : 8;
    const q = typeof task.q === "number" && task.q > 16 ? Math.floor(task.q) : 97;
    const seed = typeof task.seed === "number" ? task.seed : 20261118;
    const data = buildNewHope(n, q, message, seed);
    const rows: Array<[string, string]> = [
        ["n", String(n)],
        ["q", String(q)],
        ["public a", data.a.join(", ")],
        ["secret s", data.s.join(", ")],
        ["error e", data.e.join(", ")],
        ["public b = a*s+e", data.b.join(", ")],
        ["message bit", String(message)],
        ["ephemeral r", data.r.join(", ")],
        ["error e1", data.e1.join(", ")],
        ["error e2", data.e2.join(", ")],
        ["u = a*r+e1", data.u.join(", ")],
        ["v = b*r+e2+enc", data.v.join(", ")],
        ["w = v-u*s", data.w.join(", ")],
        ["centered w0", String(data.center)],
        ["decoded bit", String(data.decoded)],
    ];
    const metaBase = { rows: rows.length, cols: 2, n, q, message, seed };

    let step = 0;
    yield {
        stepNumber: step,
        entities: makeCells(rows, -1, -1),
        edges: [],
        description: `NewHope-style Ring-LWE toy in Z[x]/(x^${n}+1) mod ${q}. Parameters are NOT secure (teaching model).`,
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
            description: `Ring-LWE row ${i + 1}: ${rows[i]?.[0]} computes ${rows[i]?.[1]}.`,
            codeLineNumber: i < 6 ? 1 : i < 12 ? 3 : 5,
            layout: "grid",
            meta: { ...metaBase, b: data.b, u: data.u, v: data.v },
        };
        step += 1;
    }

    yield {
        stepNumber: step,
        entities: makeCells(rows, rows.length - 1, rows.length - 1),
        edges: [],
        description: `Done: bit ${message} decoded as ${data.decoded} (toy parameters, no security).`,
        codeLineNumber: 7,
        layout: "grid",
        meta: {
            ...metaBase,
            a: data.a,
            s: data.s,
            e: data.e,
            b: data.b,
            r: data.r,
            e1: data.e1,
            e2: data.e2,
            u: data.u,
            v: data.v,
            w: data.w,
            center: data.center,
            decoded: data.decoded,
            agreed: data.decoded === message,
            done: true,
        },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "NewHope hides a message inside noisy polynomial equations. The public key is a random polynomial a together with b = a*s + e, where s and e are small. Encapsulation sends a fresh noisy pair u and v with the message encoded as half the modulus; subtracting u*s cancels the a terms and leaves only small noise plus the message, which a threshold decodes.",
        invariants: [
            "All polynomial arithmetic is modulo (x^n + 1) and the prime q.",
            "The public key satisfies b = a*s + e with small e.",
            "The decryption residual is e*r + e2 - e1*s plus the encoded message.",
        ],
        correctness:
            "Expanding gives v - u*s = (a*s+e)*r + e2 + enc - (a*r+e1)*s = e*r + e2 - e1*s + enc, because polynomial multiplication is commutative and the a*s*r terms cancel. Every remaining noise coefficient is a sum of at most n products of values in {-1, 0, 1}, so its magnitude stays below q/4 for the chosen parameters. The constant coefficient therefore decodes back to the original bit exactly.",
        complexityRationale:
            "Each polynomial multiplication is a negacyclic convolution taking O(n^2) scalar operations, and a constant number are used per key generation and encapsulation, giving O(n^2) time and O(n) space. Real NewHope uses power-of-two n in the hundreds and number-theoretic transforms for O(n log n) multiplication.",
        uses: [
            "Post-quantum key establishment based on Ring-LWE",
            "A teaching model for polynomial lattices and noise-based hiding",
            "Foundations for modern KEMs such as Kyber and NewHope",
        ],
        references: [
            "Alkim, Ducas, Poppelmann, and Schwabe, Post-quantum Key Exchange: A New Hope, USENIX Security 2016",
            "Peikert, A Decade of Lattice Cryptography, 2016",
        ],
        workedExample:
            "With n=8, q=97, secret and error coefficients in {-1, 0, 1}, the receiver publishes b = a*s + e. To send bit 1, the sender adds 48 (half of 97) to the constant coefficient of v. The receiver forms v - u*s, whose constant coefficient is near 48 plus small noise, and decodes it as 1.",
    },
    id: "newhope-kem",
    name: "NewHope KEM (Toy Ring-LWE)",
    category: "cryptography-security",
    complexity: { time: "O(n^2)", space: "O(n)" },
    defaultInput: { message: 1, n: 8, q: 97, seed: 20261118 },
    visualType: "grid",
    run,
    pseudocode: [
        "choose ring dimension n, prime q, and a random polynomial a",
        "sample small secret s and error e",
        "publish b equal to a times s plus e",
        "to send a bit sample small r, e1, and e2",
        "send u equal to a times r plus e1",
        "send v equal to b times r plus e2 plus the encoded bit",
        "decapsulate by computing v minus u times s",
        "decode the centered constant coefficient and report the bit",
    ],
};

export default module;
