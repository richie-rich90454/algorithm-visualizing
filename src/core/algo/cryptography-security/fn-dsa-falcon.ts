/**
 * fn-dsa-falcon.ts - Falcon / GPV Preimage Sampling (small toy model)
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Falcon builds short lattice signatures with the GPV trapdoor framework: a
 * public matrix H maps a short secret vector to a message representative, and a
 * verifier checks both the linear equation H times signature equals the
 * representative and that the signature is short. This module replays exactly
 * that teachable core with tiny integer matrices.
 *
 * ---------------------------------------------------------------------------
 * Scope of the model
 * ---------------------------------------------------------------------------
 * This is a SMALL TOY MODEL, not Falcon and not FN-DSA. It omits NTT arithmetic,
 * the q-ary lattice construction, trapdoor basis sampling, discrete Gaussian
 * noise, and compression. The parameters are far too small for security, and
 * no production-security claim is made. The two checks shown - the public
 * linear equation and the shortness bound - are mathematically exact for the
 * toy parameters.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(n^2) for key setup and one verification
 *   Space: O(n^2) for the public matrix
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - A key/value grid reveals the matrix, the short vector, and both checks.
 *   - A failing shortness or equation check is marked in red.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

const ROWS = [
    "q",
    "n",
    "bound",
    "message hash",
    "secret s",
    "public matrix H",
    "representative",
    "signature s'",
    "H times s'",
    "short check",
    "equation check",
    "verified",
] as const;

interface FalconInput {
    message?: string;
    seed?: number;
    n?: number;
    q?: number;
    bound?: number;
    signature?: number[];
}

/** Deterministic 32-bit FNV-1a hash of a string (toy digest, not secure). */
export function hash32(text: string): number {
    let hash = 2166136261;
    for (let i = 0; i < text.length; i += 1) {
        hash ^= text.charCodeAt(i);
        hash = Math.imul(hash, 16777619) >>> 0;
    }
    return hash >>> 0;
}

/** Deterministic linear-congruential generator. */
function rng(seed: number): () => number {
    let state = seed >>> 0;
    return () => {
        state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
        return state;
    };
}

const mod = (value: number, q: number): number => ((value % q) + q) % q;

function makeCells(values: Array<string | null>, current: number, failed: boolean): VisualEntity[] {
    const entities: VisualEntity[] = [];
    for (let row = 0; row < ROWS.length; row += 1) {
        const value = values[row];
        const state: EntityState =
            row === current
                ? "comparing"
                : value === null
                  ? "idle"
                  : failed && (row === 9 || row === 10 || row === 11)
                    ? "error"
                    : "sorted";
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

/** The toy GPV/Falcon preimage verification generator. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as FalconInput | null) ?? {};
    const message = typeof task.message === "string" ? task.message : "hello";
    const q = typeof task.q === "number" ? Math.max(3, Math.trunc(task.q)) : 97;
    const n = typeof task.n === "number" ? Math.max(2, Math.min(8, Math.trunc(task.n))) : 4;
    const bound = typeof task.bound === "number" ? Math.max(1, Math.trunc(task.bound)) : 1;
    const seed = typeof task.seed === "number" ? Math.trunc(task.seed) : 2026;
    const next = rng((seed ^ hash32(message)) >>> 0);

    const s: number[] = Array.from({ length: n }, () => (next() % (2 * bound + 1)) - bound);
    const H: number[][] = Array.from({ length: n }, () =>
        Array.from({ length: n }, () => next() % q),
    );
    const representative: number[] = H.map((row) =>
        mod(row.reduce((sum, value, j) => sum + value * (s[j] ?? 0), 0), q),
    );
    const signature = Array.isArray(task.signature)
        ? Array.from({ length: n }, (_v, i) => Math.trunc(task.signature?.[i] ?? 0))
        : s.slice();
    const image: number[] = H.map((row) =>
        mod(row.reduce((sum, value, j) => sum + value * (signature[j] ?? 0), 0), q),
    );
    const shortOk = signature.every((value) => Number.isInteger(value) && Math.abs(value) <= bound);
    const equationOk = image.every((value, i) => value === (representative[i] ?? -1));
    const verified = shortOk && equationOk;

    const messageDigest = hash32(message);
    const values: Array<string | null> = Array(ROWS.length).fill(null);
    values[0] = String(q);
    values[1] = String(n);
    values[2] = String(bound);
    let step = 0;
    const baseMeta = { q, n, bound, message, seed };

    yield {
        stepNumber: step,
        entities: makeCells(values, 0, false),
        edges: [],
        description: `Toy GPV/Falcon preimage core: modulus ${q}, dimension ${n}, shortness bound ${bound}. Not secure parameters.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: { ...baseMeta, rows: ROWS.length, cols: 2 },
    };
    step += 1;

    values[3] = (messageDigest >>> 0).toString(16).padStart(8, "0");
    values[4] = `[${s.join(", ")}]`;
    yield {
        stepNumber: step,
        entities: makeCells(values, 4, false),
        edges: [],
        description: `Message hash ${values[3]}; sample short secret s = [${s.join(", ")}] with entries in [-${bound}, ${bound}].`,
        codeLineNumber: 1,
        layout: "grid",
        meta: { ...baseMeta, rows: ROWS.length, cols: 2, messageHash: values[3], s },
    };
    step += 1;

    values[5] = `${n} by ${n}`;
    values[6] = `[${representative.join(", ")}]`;
    yield {
        stepNumber: step,
        entities: makeCells(values, 6, false),
        edges: [],
        description: `Public matrix H is ${n} by ${n}; the message representative is H times s mod q = [${representative.join(", ")}].`,
        codeLineNumber: 2,
        layout: "grid",
        meta: {
            ...baseMeta,
            rows: ROWS.length,
            cols: 2,
            H: H.reduce<number[]>((acc, row) => acc.concat(row), []),
            representative,
        },
    };
    step += 1;

    values[7] = `[${signature.join(", ")}]`;
    values[8] = `[${image.join(", ")}]`;
    yield {
        stepNumber: step,
        entities: makeCells(values, 8, false),
        edges: [],
        description: `Verify the candidate signature [${signature.join(", ")}]; H times s' mod q = [${image.join(", ")}].`,
        codeLineNumber: 4,
        layout: "grid",
        meta: {
            ...baseMeta,
            rows: ROWS.length,
            cols: 2,
            signature,
            image,
            representative,
        },
    };
    step += 1;

    values[9] = shortOk ? "pass" : "fail";
    values[10] = equationOk ? "pass" : "fail";
    values[11] = verified ? "yes" : "no";
    yield {
        stepNumber: step,
        entities: makeCells(values, 11, !verified),
        edges: [],
        description: verified
            ? "Accepted: the signature is short and satisfies the public linear equation."
            : "Rejected: the signature is too long or fails the public linear equation.",
        codeLineNumber: verified ? 6 : 5,
        layout: "grid",
        meta: {
            ...baseMeta,
            rows: ROWS.length,
            cols: 2,
            s,
            H: H.reduce<number[]>((acc, row) => acc.concat(row), []),
            signature,
            representative,
            image,
            shortOk,
            equationOk,
            verified,
            converged: true,
        },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "A lattice signature is a short vector that a public matrix sends to the message's representative. The verifier never needs the trapdoor: it multiplies the claimed signature by the public matrix and checks two things, that the result matches the representative and that the vector is small enough. Smallness is what makes the trapdoor useful and what stops anyone from solving an easy equation with a huge vector.",
        invariants: [
            "Every representative is computed as H times a short secret modulo q.",
            "A signature is accepted only if both the equation and the shortness bound pass.",
            "Changing one entry of an accepted signature breaks the equation or the bound.",
        ],
        correctness:
            "Key setup defines the representative t as H times s modulo q. A candidate signature s prime is accepted exactly when H times s prime equals t modulo q and every entry of s prime has absolute value at most the bound. The correct s satisfies both conditions by construction, so it verifies; any tampered vector changes the product or violates the bound and is rejected.",
        complexityRationale:
            "Multiplying an n by n matrix by a vector costs O(n^2), and checking n entries for shortness costs O(n), so verification is O(n^2). Storing the public matrix uses O(n^2) space. Real Falcon uses larger dimensions and fast Fourier arithmetic.",
        uses: [
            "Teaching the GPV trapdoor signature framework",
            "Understanding post-quantum lattice signatures",
            "Illustrating why signature shortness matters",
        ],
        references: [
            "Gentry, Peikert, and Vaikuntanathan, Trapdoors for Hard Lattices, STOC 2008",
            "Fouque et al., Falcon: Fast-Fourier Lattice-Based Compact Signatures, NIST FIPS 206 draft",
        ],
        workedExample:
            "With modulus 97 and dimension 4, pick a secret s with entries in minus one, zero, or one and compute t = H times s modulo 97. Publishing H and t, the owner presents s as the signature; the verifier recomputes H times s, finds t, confirms the entries are short, and accepts.",
    },
    id: "fn-dsa-falcon",
    name: "Falcon / GPV Preimage Core",
    category: "cryptography-security",
    complexity: { time: "O(n^2)", space: "O(n^2)" },
    defaultInput: { message: "hello", seed: 2026, n: 4, q: 97, bound: 1 },
    visualType: "grid",
    run,
    pseudocode: [
        "choose modulus q, dimension n, and shortness bound",
        "sample a short secret vector s from message-derived randomness",
        "build a public matrix H and representative t = H times s modulo q",
        "present a candidate signature s prime",
        "compute the product H times s prime modulo q",
        "check that every entry of s prime is within the bound",
        "check that the product equals the representative",
        "done: accept only when both checks pass",
    ],
};

export default module;
