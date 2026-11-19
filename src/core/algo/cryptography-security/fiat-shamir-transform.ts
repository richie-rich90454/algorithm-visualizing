/**
 * fiat-shamir-transform.ts - Fiat-Shamir Transform (Toy Schnorr)
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * The Fiat-Shamir transform converts an interactive public-coin proof into a
 * non-interactive one by deriving the verifier's random challenge from a hash
 * of the transcript so far. Applied to a Schnorr identification proof, the
 * prover sends a commitment, hashes it with the statement to get a challenge,
 * and replies with a response the verifier checks against the public key. This
 * module works in a small prime field with a toy hash, so it is a teaching
 * model and makes no security claim.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 *   Time:  O(log modulus) modular multiplications per exponentiation
 *   Space: O(1) field elements
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 *   - Bars show commitment, challenge, response, and the two verification sides.
 *   - The final frame highlights whether verification succeeded.
 */
import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

const P = 1000003;
const G = 2;

/** Exact modular exponentiation by repeated squaring. */
export function powMod(base: number, exponent: number, modulus: number): number {
    let result = 1;
    let b = ((base % modulus) + modulus) % modulus;
    let e = Math.floor(exponent);
    while (e > 0) {
        if (e % 2 === 1) {
            result = (result * b) % modulus;
        }
        b = (b * b) % modulus;
        e = Math.floor(e / 2);
    }
    return result;
}

/** A deterministic toy hash used to derive the non-interactive challenge. */
export function toyHash(text: string): number {
    let h = 2166136261;
    for (let i = 0; i < text.length; i += 1) {
        h ^= text.charCodeAt(i);
        h = Math.imul(h, 16777619) >>> 0;
    }
    return h >>> 0;
}

/** Derive the challenge from the commitment and the message. */
export function deriveChallenge(commitment: number, message: string): number {
    return toyHash(`${commitment}|${message}`) % (P - 1);
}

export interface SchnorrProof {
    publicKey: number;
    commitment: number;
    challenge: number;
    response: number;
}

/** Produce a non-interactive Schnorr proof using Fiat-Shamir. */
export function prove(message: string, secret: number, nonce: number): SchnorrProof {
    const publicKey = powMod(G, secret, P);
    const commitment = powMod(G, nonce, P);
    const challenge = deriveChallenge(commitment, message);
    const response = (nonce + challenge * secret) % (P - 1);
    return { publicKey, commitment, challenge, response };
}

/** Check a Fiat-Shamir Schnorr proof against the message and public key. */
export function verify(message: string, proof: SchnorrProof): boolean {
    const recomputed = deriveChallenge(proof.commitment, message);
    if (recomputed !== proof.challenge) {
        return false;
    }
    const left = powMod(G, proof.response, P);
    const right = (proof.commitment * powMod(proof.publicKey, proof.challenge, P)) % P;
    return left === right;
}

function makeBars(values: number[], active: number): VisualEntity[] {
    const roles = ["commitment", "challenge", "response", "g to response", "commitment times key to challenge"];
    return values.map((value, index) => ({
        id: `bar-${index}`,
        type: "bar" as const,
        label: `${value}`,
        value,
        state: (index === active ? "active" : index >= 3 ? "comparing" : "idle") as EntityState,
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { role: roles[index] ?? "" },
    }));
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { message?: string; secret?: number; nonce?: number } | null) ?? {};
    const message = typeof task.message === "string" ? task.message : "hello";
    const secret = typeof task.secret === "number" ? Math.max(1, Math.floor(task.secret)) : 137;
    const nonce = typeof task.nonce === "number" ? Math.max(1, Math.floor(task.nonce)) : 911;
    const proof = prove(message, secret, nonce);
    const left = powMod(G, proof.response, P);
    const right = (proof.commitment * powMod(proof.publicKey, proof.challenge, P)) % P;
    const accepted = verify(message, proof);
    let step = 0;

    yield {
        stepNumber: step,
        entities: makeBars([proof.publicKey, 0, 0, 0, 0], 0),
        edges: [],
        description: `Fiat-Shamir Schnorr proof over the field of size ${P} for message "${message}".`,
        codeLineNumber: 0,
        layout: "array",
        meta: { message, modulus: P, publicKey: proof.publicKey, accepted: false },
    };
    step += 1;

    yield {
        stepNumber: step,
        entities: makeBars([proof.commitment, 0, 0, 0, 0], 0),
        edges: [],
        description: `Prover commits with g to the nonce: ${proof.commitment}.`,
        codeLineNumber: 1,
        layout: "array",
        meta: { message, commitment: proof.commitment, accepted: false },
    };
    step += 1;

    yield {
        stepNumber: step,
        entities: makeBars([proof.commitment, proof.challenge, 0, 0, 0], 1),
        edges: [],
        description: `Fiat-Shamir derives challenge ${proof.challenge} by hashing the commitment with the message, replacing the verifier's coin toss.`,
        codeLineNumber: 2,
        layout: "array",
        meta: { message, commitment: proof.commitment, challenge: proof.challenge, accepted: false },
    };
    step += 1;

    yield {
        stepNumber: step,
        entities: makeBars([proof.commitment, proof.challenge, proof.response, 0, 0], 2),
        edges: [],
        description: `Prover replies with response ${proof.response} equal to nonce plus challenge times secret modulo the group order.`,
        codeLineNumber: 3,
        layout: "array",
        meta: { message, response: proof.response, accepted: false },
    };
    step += 1;

    yield {
        stepNumber: step,
        entities: makeBars([proof.commitment, proof.challenge, proof.response, left, right], 3),
        edges: [],
        description: `Verifier checks g to the response (${left}) against commitment times key to the challenge (${right}).`,
        codeLineNumber: 4,
        layout: "array",
        meta: { message, left, right, accepted },
    };
    step += 1;

    yield {
        stepNumber: step,
        entities: makeBars([proof.commitment, proof.challenge, proof.response, left, right], 4),
        edges: [],
        description: accepted
            ? `Proof accepted: the two sides match. Toy field and hash, not a secure instantiation.`
            : `Proof rejected: the two sides differ.`,
        codeLineNumber: 5,
        layout: "array",
        meta: { message, left, right, accepted, modulus: P },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Interactive proofs need the verifier to toss random coins after seeing the prover's first message. Fiat-Shamir replaces that coin toss with a hash of everything said so far. Since a prover cannot predict the hash before choosing its commitment, it must commit before knowing the challenge. The result is a single message from prover to verifier that can be checked offline, which is how many digital signatures are built.",
        invariants: [
            "The challenge is a deterministic hash of the commitment and the message.",
            "The response equals the nonce plus challenge times secret modulo the group order.",
            "Verification recomputes the challenge, so a prover cannot choose it after the commitment.",
        ],
        correctness:
            "For an honest proof, g to the response equals g to (nonce plus challenge times secret), which factors into g to the nonce times (g to the secret) to the challenge, exactly the commitment times the public key to the challenge. The verifier also recomputes the challenge from the hash, so changing the message or commitment changes it and breaks the equality. Brute-force tests over many secrets and messages confirm honest proofs verify while tampered proofs fail. The small modulus and toy hash make this a teaching model only.",
        complexityRationale:
            "Proving and verifying each use a constant number of modular exponentiations, each costing O(log modulus) multiplications by repeated squaring. Only a handful of field elements are stored, so space is constant.",
        uses: [
            "Turning Schnorr identification into the Schnorr signature scheme",
            "Building non-interactive zero-knowledge proofs and signature aggregations",
            "Removing interaction from public-coin protocols in blockchain systems",
        ],
        references: [
            "Fiat and Shamir, How to Prove Yourself: Practical Solutions to Identification and Signature Problems, 1986",
            "Schnorr, Efficient Signature Generation by Smart Cards, 1991",
        ],
        workedExample:
            "With secret 137 and nonce 911, the prover sends commitment g to the 911. Hashing that commitment with the message gives a challenge, and the response is 911 plus challenge times 137 modulo one million. The verifier recomputes the challenge and checks that g to the response equals the commitment times the public key to the challenge, which holds exactly for the honest proof.",
    },
    id: "fiat-shamir-transform",
    name: "Fiat-Shamir Transform (Toy Schnorr)",
    category: "cryptography-security",
    complexity: { time: "O(log p)", space: "O(1)" },
    defaultInput: { message: "hello", secret: 137, nonce: 911 },
    visualType: "array",
    run,
    pseudocode: [
        "choose a prime field, generator, secret, and nonce",
        "compute the public key g to the secret",
        "compute the commitment g to the nonce",
        "derive the challenge by hashing commitment and message",
        "set the response to nonce plus challenge times secret",
        "verify g to the response against commitment times key to the challenge",
        "done: report the acceptance verdict",
    ],
};

export default module;
