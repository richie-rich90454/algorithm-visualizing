/**
 * ring-signature.ts - Ring Signature (Toy Discrete-Log Model)
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * A ring signature lets a member of a group sign a message while hiding which
 * member did it. The signer picks a random starting challenge and builds a
 * chain of commitment values around the ring. For every other member the
 * response is random; for the real signer it is chosen so the chain closes back
 * to the starting challenge. Verification simply walks the chain again, so it
 * succeeds for any member but reveals no identity. The tiny prime group makes
 * this a teaching model, not a secure scheme.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 *   Time:  O(attempts * n) modular exponentiations; expected attempts about q
 *   Space: O(n) for the response list
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 *   - Bars show each member's public key and its response value.
 *   - The real signer's bar is green during signing and hidden at the end.
 *   - meta carries the challenges, responses, and verification verdict.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

const P = 23;
const Q = 11;
const G = 2;

/** Exact modular exponentiation by repeated squaring. */
export function powMod(base: number, exponent: number, modulus: number): number {
    let result = 1;
    let current = ((base % modulus) + modulus) % modulus;
    let power = ((exponent % Q) + Q) % Q;
    while (power > 0) {
        if (power % 2 === 1) result = (result * current) % modulus;
        current = (current * current) % modulus;
        power = Math.floor(power / 2);
    }
    return result;
}

function modQ(value: number): number {
    return ((value % Q) + Q) % Q;
}

function hashChallenge(message: number, commitment: number): number {
    return modQ(message + 3 * commitment + 7);
}

function nextRandom(state: number): number {
    return (Math.imul(state, 1664525) + 1013904223) >>> 0;
}

export interface RingSignature {
    c0: number;
    responses: number[];
    message: number;
    attempts: number;
}

/** Produce a ring signature by retrying until the challenge chain closes. */
export function ringSign(
    publicKeys: number[],
    signerIndex: number,
    secret: number,
    message: number,
    seed = 7,
): RingSignature | null {
    const n = publicKeys.length;
    if (n === 0 || signerIndex < 0 || signerIndex >= n) return null;
    let state = (seed >>> 0) || 1;
    for (let attempts = 1; attempts <= 5000; attempts += 1) {
        state = nextRandom(state);
        const c0 = state % Q;
        const responses = Array.from({ length: n }, () => 0);
        let challenge = c0;
        for (let i = 0; i < n; i += 1) {
            if (i === signerIndex) {
                state = nextRandom(state);
                const k = 1 + (state % (Q - 1));
                responses[i] = modQ(k - challenge * secret);
                const commitment = powMod(G, k, P);
                challenge = hashChallenge(message, commitment);
            } else {
                state = nextRandom(state);
                responses[i] = state % Q;
                const commitment = powMod(G, responses[i]!, P) * powMod(publicKeys[i]!, challenge, P) % P;
                challenge = hashChallenge(message, commitment);
            }
        }
        if (challenge === c0) return { c0, responses, message: modQ(message), attempts };
    }
    return null;
}

/** Verify a ring signature by replaying the challenge chain. */
export function ringVerify(publicKeys: number[], signature: RingSignature): boolean {
    if (publicKeys.length !== signature.responses.length) return false;
    let challenge = signature.c0;
    for (let i = 0; i < publicKeys.length; i += 1) {
        const commitment = powMod(G, signature.responses[i]!, P) * powMod(publicKeys[i]!, challenge, P) % P;
        challenge = hashChallenge(signature.message, commitment);
    }
    return challenge === signature.c0;
}

function makeBars(publicKeys: number[], responses: number[], reveal: boolean, signer: number): VisualEntity[] {
    const values = [...publicKeys, ...responses];
    return values.map((value, index) => {
        const isResponse = index >= publicKeys.length;
        let state: EntityState = "idle";
        if (isResponse && reveal && index - publicKeys.length === signer) state = "sorted";
        else if (isResponse) state = "visited";
        else state = "comparing";
        return {
            id: `bar-${index}`,
            type: "bar" as const,
            label: `${isResponse ? "r" : "y"}${index % publicKeys.length}:${value}`,
            value,
            state,
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: { index, role: isResponse ? "response" : "public", value },
        };
    });
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { secrets?: number[]; signer?: number; message?: number; seed?: number; tamper?: boolean } | null) ?? {};
    const secrets = Array.isArray(task.secrets) && task.secrets.length >= 2
        ? task.secrets.map((v) => modQ(Math.floor(Number(v) || 0)))
        : [3, 5, 7];
    const publicKeys = secrets.map((secret) => powMod(G, secret, P));
    const signer = Math.min(publicKeys.length - 1, Math.max(0, Math.floor(Number(task.signer ?? 1)) || 0));
    const message = modQ(Math.floor(Number(task.message ?? 4)) || 0);
    const seed = Math.floor(Number(task.seed ?? 7)) || 7;
    const signature = ringSign(publicKeys, signer, secrets[signer]!, message, seed);
    const delivered: RingSignature | null = signature && task.tamper
        ? { ...signature, message: modQ(signature.message + 1) }
        : signature;
    const verified = delivered ? ringVerify(publicKeys, delivered) : false;
    const responses = delivered?.responses ?? Array.from({ length: publicKeys.length }, () => 0);
    const baseMeta = {
        toy: true,
        members: publicKeys.length,
        signer: signer,
        c0: signature?.c0 ?? 0,
        responses,
        verified: false,
    };
    let stepNumber = 0;

    yield {
        stepNumber: stepNumber,
        entities: makeBars(publicKeys, [], false, signer),
        edges: [],
        description: `A ${publicKeys.length}-member ring with public keys ${publicKeys.join(", ")}.`,
        codeLineNumber: 0,
        layout: "array",
        meta: { ...baseMeta, attempted: 0 },
    };
    stepNumber += 1;

    yield {
        stepNumber: stepNumber,
        entities: makeBars(publicKeys, [], false, signer),
        edges: [],
        description: `The signer starts a random challenge chain at c0 = ${signature?.c0 ?? 0}.`,
        codeLineNumber: 1,
        layout: "array",
        meta: { ...baseMeta, attempted: signature?.attempts ?? 0 },
    };
    stepNumber += 1;

    yield {
        stepNumber: stepNumber,
        entities: makeBars(publicKeys, responses, false, signer),
        edges: [],
        description: `The chain closed after ${signature?.attempts ?? 0} attempt(s); responses are ${responses.join(", ")}.`,
        codeLineNumber: 2,
        layout: "array",
        meta: { ...baseMeta, attempted: signature?.attempts ?? 0 },
    };
    stepNumber += 1;

    yield {
        stepNumber: stepNumber,
        entities: makeBars(publicKeys, responses, true, signer),
        edges: [],
        description: `Teaching view: member ${signer} is the real signer; this identity is hidden from a verifier.`,
        codeLineNumber: 3,
        layout: "array",
        meta: { ...baseMeta, attempted: signature?.attempts ?? 0 },
    };
    stepNumber += 1;

    yield {
        stepNumber: stepNumber,
        entities: makeBars(publicKeys, responses, false, signer),
        edges: [],
        description: verified
            ? "The verifier replays the chain and it closes; the signature is accepted."
            : "The verifier replays the chain and it does not close; the signature is rejected.",
        codeLineNumber: 4,
        layout: "array",
        meta: { ...baseMeta, verified: verified ? 1 : 0, done: true },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "A ring signature is a cycle of equations: each member contributes a value that turns one challenge into the next. Outsiders pick random contributions, while the real signer picks a contribution that makes the last challenge equal the first. Anyone can check that the cycle closes, but because every other contribution was random, the closing step alone does not identify who chose it.",
        invariants: [
            "Each public key is the generator raised to its owner's secret.",
            "Every response maps the current challenge to the next through a commitment.",
            "Verification succeeds exactly when the final challenge equals the starting challenge.",
        ],
        correctness:
            "For a non-signer the published response is random, so its commitment is a well-defined group element and the chain advances deterministically. For the signer, choosing the response as k minus the challenge times the secret makes the commitment equal the generator to the k, so the next challenge is fixed. Retrying a random starting challenge eventually makes the final challenge equal the start, and verification reproduces this calculation exactly, accepting any member's signature while hiding which one closed the loop.",
        complexityRationale:
            "Each attempt evaluates one modular exponentiation per ring member, and the expected number of attempts is about the challenge group size, giving O(q n) time in expectation. The signature stores one response per member, using O(n) space.",
        uses: [
            "Anonymous endorsements within an approved group",
            "Whistleblowing and deniable signatures",
            "Teaching linkable and anonymous signature constructions",
        ],
        references: [
            "Rivest, Shamir, and Tauman, How to Leak a Secret, ASIACRYPT 2001",
            "Abe, Ohkubo, and Suzuki, 1-out-of-n Signatures, ASIACRYPT 2002",
        ],
        workedExample:
            "With three members whose public keys are g to 3, g to 5, and g to 7, member two signs by choosing random responses for members zero and one, then setting its own response so that its commitment matches a chosen k. The chain of challenges returns to its starting value, and a verifier only sees a closed cycle.",
    },
    id: "ring-signature",
    name: "Ring Signature (Toy Model)",
    category: "cryptography-security",
    complexity: { time: "O(q n) expected", space: "O(n)" },
    defaultInput: { secrets: [3, 5, 7], signer: 1, message: 4, seed: 7 },
    visualType: "array",
    run,
    pseudocode: [
        "publish one public key per group member",
        "choose a random starting challenge",
        "for each non-signer pick a random response and advance the chain",
        "for the signer choose a response that fixes the next challenge",
        "retry with a new start until the chain closes",
        "publish the starting challenge and all responses",
        "verify by replaying the chain around the ring",
        "done: accept only when the final challenge equals the first",
    ],
};

export default module;
