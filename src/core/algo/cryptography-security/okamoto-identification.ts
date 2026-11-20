/**
 * okamoto-identification.ts - Okamoto Identification Protocol (Toy Model)
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * The Okamoto identification protocol is a three-move proof of knowledge of a
 * secret pair (w1, w2) whose public value is v = g1^w1 * g2^w2 mod p. The prover
 * first commits to t = g1^r1 * g2^r2 with fresh nonces, then replies to a
 * challenge c with s1 = r1 + c*w1 and s2 = r2 + c*w2 modulo the group order.
 * The verifier accepts exactly when g1^s1 * g2^s2 equals t * v^c modulo p.
 *
 * This uses a small prime field and a deterministic toy challenge, so it is a
 * teaching model of the protocol structure and makes no security claim.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(log p) modular multiplications for the exponentiations
 *   Space: O(1) field elements
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Six bars show v, t, c, s1, s2, and the two verification sides.
 *   - The value computed at the current step is highlighted.
 *   - meta carries the full transcript and the accept or reject verdict.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface OkamotoInput {
    p?: number;
    g1?: number;
    g2?: number;
    w1?: number;
    w2?: number;
    r1?: number;
    r2?: number;
    challenge?: number;
}

export interface OkamotoTranscript {
    p: number;
    order: number;
    g1: number;
    g2: number;
    v: number;
    t: number;
    c: number;
    s1: number;
    s2: number;
    left: number;
    right: number;
    accepted: boolean;
}

/** Exact modular exponentiation by repeated squaring. */
export function modPow(base: number, exponent: number, modulus: number): number {
    let result = 1;
    let b = ((base % modulus) + modulus) % modulus;
    let e = ((exponent % (modulus - 1)) + (modulus - 1)) % (modulus - 1);
    while (e > 0) {
        if (e % 2 === 1) result = (result * b) % modulus;
        b = (b * b) % modulus;
        e = Math.floor(e / 2);
    }
    return result;
}

/** Build and verify an Okamoto identification transcript. */
export function prove(input: OkamotoInput): OkamotoTranscript {
    const p = typeof input.p === "number" && input.p > 2 ? Math.floor(input.p) : 1000003;
    const order = p - 1;
    const g1 = Math.max(2, Math.floor(input.g1 ?? 2));
    const g2 = Math.max(2, Math.floor(input.g2 ?? 5));
    const w1 = Math.floor(input.w1 ?? 17);
    const w2 = Math.floor(input.w2 ?? 23);
    const r1 = Math.floor(input.r1 ?? 41);
    const r2 = Math.floor(input.r2 ?? 59);
    const v = (modPow(g1, w1, p) * modPow(g2, w2, p)) % p;
    const t = (modPow(g1, r1, p) * modPow(g2, r2, p)) % p;
    const c = typeof input.challenge === "number"
        ? ((Math.floor(input.challenge) % order) + order) % order
        : t % order;
    const s1 = (r1 + c * w1) % order;
    const s2 = (r2 + c * w2) % order;
    return verifyOkamoto(p, g1, g2, v, t, c, s1, s2, order);
}

/** Verify an arbitrary Okamoto transcript without knowing the secrets. */
export function verifyOkamoto(
    p: number,
    g1: number,
    g2: number,
    v: number,
    t: number,
    c: number,
    s1: number,
    s2: number,
    order = p - 1,
): OkamotoTranscript {
    const left = (modPow(g1, s1, p) * modPow(g2, s2, p)) % p;
    const right = (t * modPow(v, c, p)) % p;
    return { p, order, g1, g2, v, t, c, s1, s2, left, right, accepted: left === right };
}

function makeEntities(transcript: OkamotoTranscript, active: string): VisualEntity[] {
    const values: Array<[string, number]> = [
        ["v", transcript.v],
        ["t", transcript.t],
        ["c", transcript.c],
        ["s1", transcript.s1],
        ["s2", transcript.s2],
        ["left", transcript.left],
        ["right", transcript.right],
    ];
    return values.map(([label, value], index) => ({
        id: `field-${label}`,
        type: "bar" as const,
        label,
        value,
        state: (label === active ? "comparing" : index === 5 || index === 6
            ? transcript.accepted ? "sorted" : "error"
            : "idle") as EntityState,
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { field: label, value },
    }));
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as OkamotoInput | null) ?? {};
    const transcript = prove(task);
    let step = 0;

    yield {
        stepNumber: step,
        entities: makeEntities(transcript, "v"),
        edges: [],
        description: `Public value v = g1^w1 * g2^w2 mod ${transcript.p} is published by the prover.`,
        codeLineNumber: 0,
        layout: "array",
        meta: { p: transcript.p, accepted: transcript.accepted, left: transcript.left, right: transcript.right },
    };
    step += 1;

    yield {
        stepNumber: step,
        entities: makeEntities(transcript, "t"),
        edges: [],
        description: `The prover commits to t = g1^r1 * g2^r2 with fresh nonces and sends it first.`,
        codeLineNumber: 2,
        layout: "array",
        meta: { p: transcript.p, t: transcript.t, c: transcript.c, accepted: transcript.accepted },
    };
    step += 1;

    yield {
        stepNumber: step,
        entities: makeEntities(transcript, "c"),
        edges: [],
        description: `The verifier sends challenge c = ${transcript.c}.`,
        codeLineNumber: 3,
        layout: "array",
        meta: { p: transcript.p, c: transcript.c, accepted: transcript.accepted },
    };
    step += 1;

    yield {
        stepNumber: step,
        entities: makeEntities(transcript, "s1"),
        edges: [],
        description: `The prover replies with s1 = r1 + c*w1 modulo the group order.`,
        codeLineNumber: 4,
        layout: "array",
        meta: { p: transcript.p, c: transcript.c, s1: transcript.s1, s2: transcript.s2, accepted: transcript.accepted },
    };
    step += 1;

    yield {
        stepNumber: step,
        entities: makeEntities(transcript, "left"),
        edges: [],
        description: `The verifier computes g1^s1 * g2^s2 = ${transcript.left} on one side.`,
        codeLineNumber: 5,
        layout: "array",
        meta: { p: transcript.p, left: transcript.left, accepted: transcript.accepted },
    };
    step += 1;

    yield {
        stepNumber: step,
        entities: makeEntities(transcript, "right"),
        edges: [],
        description: `The verifier computes t * v^c = ${transcript.right} and compares the two sides.`,
        codeLineNumber: 6,
        layout: "array",
        meta: { p: transcript.p, right: transcript.right, accepted: transcript.accepted },
    };
    step += 1;

    yield {
        stepNumber: step,
        entities: makeEntities(transcript, transcript.accepted ? "left" : "right"),
        edges: [],
        description: transcript.accepted
            ? "The two sides match: the verifier accepts the proof of knowledge."
            : "The two sides differ: the verifier rejects the proof.",
        codeLineNumber: 6,
        layout: "array",
        meta: { p: transcript.p, accepted: transcript.accepted, left: transcript.left, right: transcript.right },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "To prove you know a secret without revealing it, commit to a random guess first, then let the verifier pick a challenge that forces you to mix your secret into the answer. Okamoto's version uses two independent generators and two secret exponents, which makes the algebra work in a group where a single-generator proof might leak information.",
        invariants: [
            "The public value v and the commitment t are elements of the multiplicative group modulo p.",
            "The response satisfies s1 = r1 + c*w1 and s2 = r2 + c*w2 modulo the group order.",
            "Acceptance is exactly the equality g1^s1 * g2^s2 = t * v^c modulo p.",
        ],
        correctness:
            "For an honest prover, g1^s1 * g2^s2 = g1^(r1+c*w1) * g2^(r2+c*w2) = (g1^r1 g2^r2) * (g1^w1 g2^w2)^c = t * v^c, so verification succeeds. A prover who does not know (w1, w2) cannot produce responses that satisfy this equation for a random challenge except with small probability, which is the standard special-soundness argument.",
        complexityRationale:
            "Setup and verification each compute a handful of modular exponentiations by repeated squaring, costing O(log p) multiplications each. All values are single field or scalar elements, so the space is O(1).",
        uses: [
            "Teaching the structure of Identification and sigma protocols",
            "Building blocks for anonymous credentials and group signatures",
            "A stepping stone to Fiat-Shamir non-interactive proofs",
        ],
        references: [
            "T. Okamoto, An Efficient Divisible Electronic Cash Scheme, CRYPTO 1995",
            "T. Okamoto, Provably Secure and Practical Identification Schemes and Corresponding Signature Schemes, 1993",
        ],
        workedExample:
            "With p = 1000003, g1 = 2, g2 = 5, secrets w1 = 17 and w2 = 23, the public value is v = g1^17 * g2^23 mod p. Using nonces r1 = 41 and r2 = 59 gives a commitment t; for challenge c the responses are s1 = 41 + 17c and s2 = 59 + 23c, and g1^s1 g2^s2 equals t v^c exactly.",
    },
    id: "okamoto-identification",
    name: "Okamoto Identification Protocol",
    category: "cryptography-security",
    complexity: { time: "O(log p)", space: "O(1)" },
    defaultInput: { p: 1000003, g1: 2, g2: 5, w1: 17, w2: 23, r1: 41, r2: 59 },
    visualType: "array",
    run,
    pseudocode: [
        "publish the public value v equals g1 to the w1 times g2 to the w2",
        "choose fresh nonces r1 and r2 and compute the commitment t",
        "send t to the verifier and receive a challenge c",
        "reply with s1 equals r1 plus c times w1 modulo the order",
        "reply with s2 equals r2 plus c times w2 modulo the order",
        "check that g1 to s1 times g2 to s2 equals t times v to c",
        "done: accept when the two sides are equal",
    ],
};

export default module;
