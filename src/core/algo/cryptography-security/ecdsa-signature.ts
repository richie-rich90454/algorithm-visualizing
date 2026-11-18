/**
 * ecdsa-signature.ts - ECDSA over a Tiny Toy Curve
 *
 * TEACHING MODEL, NOT PRODUCTION SECURITY. The curve y^2 = x^3 + 2x + 2 over
 * the field of order 17 is small enough to enumerate by hand. The exact step
 * shown is the ECDSA verification equation using the recovered point R.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

type Point = { x: number; y: number } | null;
const FIELD = 17;
const A = 2;

function gcd(a: number, b: number): number {
    let x = Math.abs(a);
    let y = Math.abs(b);
    while (y !== 0) {
        const r = x % y;
        x = y;
        y = r;
    }
    return x;
}

function inv(value: number, mod: number): number {
    let [oldR, r] = [((value % mod) + mod) % mod, mod];
    let [oldS, s] = [1, 0];
    while (r !== 0) {
        const q = Math.floor(oldR / r);
        [oldR, r] = [r, oldR - q * r];
        [oldS, s] = [s, oldS - q * s];
    }
    return ((oldS % mod) + mod) % mod;
}

function add(p: Point, q: Point): Point {
    if (!p) return q;
    if (!q) return p;
    if (p.x === q.x && (p.y + q.y) % FIELD === 0) return null;
    let slope: number;
    if (p.x === q.x) {
        slope = ((3 * p.x * p.x + A) * inv(2 * p.y, FIELD)) % FIELD;
    } else {
        slope = ((q.y - p.y) * inv(q.x - p.x, FIELD)) % FIELD;
    }
    slope = ((slope % FIELD) + FIELD) % FIELD;
    const x = ((slope * slope - p.x - q.x) % FIELD + FIELD) % FIELD;
    const y = ((slope * (p.x - x) - p.y) % FIELD + FIELD) % FIELD;
    return { x, y };
}

function mul(k: number, p: Point): Point {
    let result: Point = null;
    let base = p;
    let n = k;
    while (n > 0) {
        if (n % 2 === 1) result = add(result, base);
        base = add(base, base);
        n = Math.floor(n / 2);
    }
    return result;
}

function orderOf(g: Point): number {
    for (let i = 1; i <= 2 * FIELD + 1; i += 1) {
        if (mul(i, g) === null) return i;
    }
    return 0;
}

function makeCells(rows: number[][], revealed: number): VisualEntity[] {
    const entities: VisualEntity[] = [];
    for (let row = 0; row < rows.length; row += 1) {
        for (let col = 0; col < 4; col += 1) {
            const value = row <= revealed ? rows[row]?.[col] ?? -1 : -1;
            const state: EntityState = value < 0 ? "unvisited" : row === revealed ? "active" : "sorted";
            entities.push({
                id: `cell-${row}-${col}`,
                type: "cell",
                label: value < 0 ? "?" : String(value),
                value,
                state,
                x: 0,
                y: 0,
                width: 0,
                height: 0,
                metadata: { row, col },
            });
        }
    }
    return entities;
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { message?: string } | null) ?? {};
    const message = String(task.message ?? "HI");
    const g: Point = { x: 5, y: 1 };
    const n = orderOf(g);
    const d = 7;
    const q: Point = mul(d, g);
    let z = 0;
    for (let i = 0; i < message.length; i += 1) {
        z = (z * 31 + message.charCodeAt(i)) % n;
    }
    if (z === 0) z = 1;

    let k = 3;
    let r = 0;
    let s = 0;
    for (const candidate of [3, 5, 7, 11, 13]) {
        const kp = mul(candidate, g);
        if (!kp) continue;
        const candidateR = kp.x % n;
        if (candidateR === 0) continue;
        const candidateS = (inv(candidate, n) * (z + candidateR * d)) % n;
        if (candidateS === 0) continue;
        k = candidate;
        r = candidateR;
        s = candidateS;
        break;
    }

    const w = inv(s, n);
    const u1 = (z * w) % n;
    const u2 = (r * w) % n;
    const pointR = add(mul(u1, g), mul(u2, q));
    const rx = pointR ? pointR.x % n : -1;
    const valid = rx === r;
    const tampered = ((r + 1) % n) === rx;

    const rows = [
        [z, d, k, n],
        [r, s, q?.x ?? -1, q?.y ?? -1],
        [u1, u2, rx, valid ? 1 : 0],
    ];

    yield {
        stepNumber: 0,
        entities: makeCells(rows, 0),
        edges: [],
        description: `Tiny curve order n = ${n}; message digest z = ${z}, private key d = ${d}.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: { rows: 3, cols: 4, phase: "setup", n, z, valid: false, tamperValid: false },
    };
    yield {
        stepNumber: 1,
        entities: makeCells(rows, 1),
        edges: [],
        description: `Nonce k = ${k}; signature is (r, s) = (${r}, ${s}).`,
        codeLineNumber: 2,
        layout: "grid",
        meta: { rows: 3, cols: 4, phase: "sign", n, r, s, valid: false, tamperValid: false },
    };
    yield {
        stepNumber: 2,
        entities: makeCells(rows, 2),
        edges: [],
        description: `Verify: w = s inverse, R = u1*G + u2*Q has x = ${rx}; matches r -> ${valid ? "accepted" : "rejected"}.`,
        codeLineNumber: 4,
        layout: "grid",
        meta: { rows: 3, cols: 4, phase: "verify", n, z, r, s, rx, u1, u2, valid, tamperValid: false },
    };
    yield {
        stepNumber: 3,
        entities: makeCells(rows, 2),
        edges: [],
        description: `A forged r of ${(r + 1) % n} fails the same equation: ${tampered ? "accepted" : "rejected"}.`,
        codeLineNumber: 5,
        layout: "grid",
        meta: { rows: 3, cols: 4, phase: "tamper", n, r, s, rx, valid, tamperValid: tampered },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Elliptic curve signatures use scalar multiplication on a curve as a one-way function. The signer combines a secret key and a fresh nonce into two numbers; the verifier recombines them with the public key and checks that the resulting curve point has the expected x coordinate.",
        invariants: [
            "The nonce k is invertible modulo the curve order n.",
            "r is the x coordinate of k times the base point, reduced modulo n.",
            "Verification reconstructs a point R whose x coordinate must equal r.",
        ],
        correctness:
            "With Q = d*G, the verification point is R = u1*G + u2*Q = (u1 + u2*d)*G. Substituting u1 = z/s and u2 = r/s gives (z + r*d)/s times G, and because s = (z + r*d)/k this equals k*G, whose x coordinate is r. A wrong r or s breaks the equality. The curve here has only a handful of points, so this demonstrates the algebra and is not secure.",
        complexityRationale:
            "Scalar multiplication uses O(log n) point additions, and a signature needs a few such multiplications, giving O(log n) time and O(1) space on this fixed curve.",
        uses: [
            "Digital signatures in Bitcoin and Ethereum",
            "TLS certificates and secure messaging keys",
            "Compact signatures where bandwidth is limited",
        ],
        references: [
            "Koblitz, Elliptic Curve Cryptosystems, 1987",
            "Johnson, Menezes, and Vanstone, The Elliptic Curve Digital Signature Algorithm, 2001",
        ],
        workedExample:
            "On the tiny curve the base point G = (5, 1) has order 19. For message HI the digest z and nonce k produce r = (kG).x mod 19 and s = k inverse times (z + r*d) mod 19. Recomputing R from the public key returns the same x coordinate, so the signature verifies.",
    },
    id: "ecdsa-signature",
    name: "ECDSA Signature (Tiny Curve)",
    category: "cryptography-security",
    complexity: { time: "O(log n)", space: "O(1)" },
    defaultInput: { message: "HI" },
    visualType: "grid",
    run,
    pseudocode: [
        "choose a base point and compute the curve order n",
        "hash the message to an integer z below n",
        "pick a nonce k and compute the point k times G",
        "set r to its x coordinate modulo n",
        "set s to k inverse times (z plus r times d) modulo n",
        "verify by computing R from u1 and u2 and comparing its x coordinate to r",
        "done: report acceptance for valid and forged signatures",
    ],
};

export default module;
