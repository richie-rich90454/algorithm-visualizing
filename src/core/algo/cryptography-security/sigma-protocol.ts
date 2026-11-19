/**
 * sigma-protocol.ts - Schnorr Sigma Protocol (Toy Discrete-Log Setting)
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * A sigma protocol is a three-move proof: the prover sends a commitment, the
 * verifier sends a random challenge, and the prover sends a response. Here the
 * prover knows a secret w whose public value is h = g^w mod p and wants to
 * convince the verifier of that knowledge without revealing w. The commitment
 * is g^r for a fresh nonce r, the challenge is derived from the commitment, and
 * the response is s = r + c*w mod (p-1). Verification checks that g^s equals
 * t * h^c mod p. This uses small parameters for illustration and is a toy
 * model, not a secure cryptographic implementation.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(log p) modular multiplications for the exponentiations
 *   Space: O(1) for the few group elements and scalars
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Six cells show h, t, c, s, and the two verification sides.
 *   - The freshly computed value is highlighted at each step.
 *   - meta carries all protocol values and the accept or reject verdict.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface ProofInput {
    p?: number;
    g?: number;
    w?: number;
    r?: number;
}

function modpow(base: bigint, exponent: bigint, mod: bigint): bigint {
    let result = 1n;
    let b = ((base % mod) + mod) % mod;
    let e = exponent;
    while (e > 0n) {
        if (e & 1n) {
            result = (result * b) % mod;
        }
        b = (b * b) % mod;
        e >>= 1n;
    }
    return result;
}

function makeCells(
    values: Array<[string, string | number]>,
    highlight: number | null,
): VisualEntity[] {
    return values.map(([label, value], index) => ({
        id: `val-${label}`,
        type: "cell" as const,
        label: `${label}:${value}`,
        value: String(value),
        state: (index === highlight ? "active" : "idle") as EntityState,
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { row: 0, col: index, field: label },
    }));
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as ProofInput | null) ?? {};
    const p = BigInt(task.p ?? 1000003);
    const g = BigInt(task.g ?? 2);
    const w = BigInt(task.w ?? 12345);
    const r = BigInt(task.r ?? 6789);
    const order = p - 1n;
    const h = modpow(g, w, p);
    const t = modpow(g, r, p);
    const c = BigInt((Number(t) * 2654435761) % Number(order)) + 1n;
    const s = (r + c * w) % order;
    const left = modpow(g, s, p);
    const right = (t * modpow(h, c, p)) % p;
    const accepts = left === right;
    let step = 0;

    const snap = (
        values: Array<[string, string | number]>,
        description: string,
        line: number,
        highlight: number | null,
        extra: Record<string, number | string | boolean> = {},
    ): VisualFrame => ({
        stepNumber: step,
        entities: makeCells(values, highlight),
        edges: [],
        description,
        codeLineNumber: line,
        layout: "grid",
        meta: {
            p: Number(p),
            g: Number(g),
            h: Number(h),
            t: Number(t),
            c: Number(c),
            s: Number(s),
            left: Number(left),
            right: Number(right),
            accepts,
            ...extra,
        },
    });

    yield snap(
        [["h", Number(h)]],
        `Set up public key h = g^w mod p with p = ${p}, g = ${g}; secret w is withheld.`,
        0,
        0,
    );
    step += 1;

    yield snap(
        [
            ["h", Number(h)],
            ["t", Number(t)],
        ],
        `Prover commitment: choose nonce r and send t = g^r mod p = ${t}.`,
        2,
        1,
    );
    step += 1;

    yield snap(
        [
            ["h", Number(h)],
            ["t", Number(t)],
            ["c", Number(c)],
        ],
        `Verifier challenge c = ${c} is derived from the commitment.`,
        3,
        2,
    );
    step += 1;

    yield snap(
        [
            ["h", Number(h)],
            ["t", Number(t)],
            ["c", Number(c)],
            ["s", Number(s)],
        ],
        `Prover response: s = r + c*w mod (p-1) = ${s}.`,
        4,
        3,
    );
    step += 1;

    yield snap(
        [
            ["h", Number(h)],
            ["t", Number(t)],
            ["c", Number(c)],
            ["s", Number(s)],
            ["g^s", Number(left)],
            ["t*h^c", Number(right)],
        ],
        `Verify g^s = ${left} and t*h^c mod p = ${right}; ${accepts ? "they match" : "they differ"}.`,
        5,
        4,
    );
    step += 1;

    yield snap(
        [
            ["h", Number(h)],
            ["t", Number(t)],
            ["c", Number(c)],
            ["s", Number(s)],
            ["g^s", Number(left)],
            ["t*h^c", Number(right)],
        ],
        accepts
            ? "Sigma protocol accepts: the prover demonstrated knowledge of w."
            : "Sigma protocol rejects: the verification equation failed.",
        7,
        null,
        { verdict: accepts ? "accept" : "reject" },
    );
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "To prove you know a secret without saying it, commit to a random guess, let the verifier pick a challenge, then weave the challenge and secret into a response. An honest prover can always answer because the response is just the nonce plus the challenge times the secret. A prover who does not know the secret would have to solve a hard discrete-log problem to answer a randomly chosen challenge.",
        invariants: [
            "The commitment t is computed before the challenge c is known.",
            "The challenge is a deterministic function of the commitment in this toy model.",
            "The response s is reduced modulo p-1, the order of the multiplicative group.",
            "Verification accepts exactly when g^s equals t times h to the c modulo p.",
        ],
        correctness:
            "Completeness: for an honest prover, g^s = g^(r+cw) = g^r * (g^w)^c = t * h^c mod p, so the verifier always accepts. Soundness relies on the discrete-log assumption: a prover who can answer two different challenges for the same commitment could compute w, so without the secret a cheating prover succeeds only with negligible probability. Special soundness is the extraction argument behind that claim.",
        complexityRationale:
            "The prover and verifier each compute a small number of modular exponentiations with exponents below p, using square-and-multiply in O(log p) multiplications. Only a handful of group elements and scalars are kept, so space is O(1).",
        uses: [
            "Foundations of Schnorr signatures and Fiat-Shamir transforms",
            "Zero-knowledge identification schemes such as Okamoto identification",
            "Teaching completeness, soundness, and zero knowledge in a single protocol",
        ],
        references: [
            "Schnorr, Efficient Signature Generation by Smart Cards, Journal of Cryptology 1991",
            "Goldwasser, Micali, and Rackoff, The Knowledge Complexity of Interactive Proof Systems, 1989",
        ],
        workedExample:
            "Work modulo p = 1000003 with g = 2 and secret w = 12345, giving h = g^w mod p. The prover sends t = g^r for a nonce r, receives challenge c derived from t, and answers s = r + c*w mod (p-1). The verifier computes g^s and t*h^c; they are equal, so the proof is accepted without ever revealing w.",
    },
    id: "sigma-protocol",
    name: "Sigma Protocol",
    category: "cryptography-security",
    complexity: { time: "O(log p)", space: "O(1)" },
    defaultInput: { p: 1000003, g: 2, w: 12345, r: 6789 },
    visualType: "grid",
    run,
    pseudocode: [
        "compute the public value h as g to the w mod p",
        "prover chooses a fresh nonce r",
        "send the commitment t as g to the r mod p",
        "verifier sends a challenge c derived from t",
        "respond with s as r plus c times w mod p minus one",
        "verifier computes g to the s and t times h to the c",
        "accept when the two group elements are equal",
        "done: report the accept or reject verdict",
    ],
};

export default module;
