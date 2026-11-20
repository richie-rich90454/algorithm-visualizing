/**
 * guillou-quisquater.ts - Guillou-Quisquater Identification (Toy)
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Guillou-Quisquater is a three-move identification protocol. The prover holds
 * a secret x whose v-th power is the registered public key y. It first sends a
 * commitment r to the v-th power, the verifier replies with a random challenge
 * c, and the prover answers with r times x to the c. The verifier checks that
 * raising the answer to the v matches the commitment times the public key to
 * the challenge. An impostor who does not know x cannot answer a random
 * challenge. The modulus used here is tiny, so this is a teaching model.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 *   Time:  O(log v + log c) modular multiplications for each party
 *   Space: O(1) for the four protocol values
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 *   - Bars show the public key, commitment, challenge, response, and check.
 *   - A successful identification is green; a failed one is red.
 *   - meta carries every transmitted value and the verdict.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

const N = 77;
const V = 7;

/** Modular exponentiation by repeated squaring over the composite modulus. */
export function powMod(base: number, exponent: number, modulus: number): number {
    let result = 1;
    let current = ((base % modulus) + modulus) % modulus;
    let power = Math.floor(exponent);
    while (power > 0) {
        if (power % 2 === 1) result = (result * current) % modulus;
        current = (current * current) % modulus;
        power = Math.floor(power / 2);
    }
    return result;
}

function gcd(a: number, b: number): number {
    while (b !== 0) {
        const t = a % b;
        a = b;
        b = t;
    }
    return a;
}

/** Register a public key from a secret that is coprime to the modulus. */
export function gqKeyPair(secret: number): { secret: number; publicKey: number } {
    let x = ((Math.floor(secret) % N) + N) % N;
    while (gcd(x, N) !== 1) x = (x + 1) % N;
    return { secret: x, publicKey: powMod(x, V, N) };
}

export interface GqTranscript {
    publicKey: number;
    commitment: number;
    challenge: number;
    response: number;
}

/** Produce the prover's three messages for a given challenge. */
export function gqProve(secret: number, nonce: number, challenge: number): GqTranscript {
    const r = ((nonce % N) + N) % N || 1;
    const normalized = gqKeyPair(secret);
    return {
        publicKey: normalized.publicKey,
        commitment: powMod(r, V, N),
        challenge: ((challenge % V) + V) % V,
        response: r * powMod(normalized.secret, challenge, N) % N,
    };
}

/** Verify an identification transcript with the registered public key. */
export function gqVerify(transcript: GqTranscript, registeredKey: number): boolean {
    const left = powMod(transcript.response, V, N);
    const right = transcript.commitment * powMod(registeredKey, transcript.challenge, N) % N;
    return left === right && transcript.publicKey === registeredKey;
}

function makeBars(values: number[], labels: string[], active: number, state: EntityState): VisualEntity[] {
    return values.map((value, index) => ({
        id: `bar-${index}`,
        type: "bar" as const,
        label: labels[index] ?? `${value}`,
        value,
        state: index === active ? "comparing" : state,
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { index, role: labels[index] ?? "", value },
    }));
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { secret?: number; nonce?: number; challenge?: number; wrongSecret?: boolean } | null) ?? {};
    const secret = Math.floor(Number(task.secret ?? 4)) || 4;
    const nonce = Math.floor(Number(task.nonce ?? 5)) || 5;
    const challenge = Math.max(0, Math.floor(Number(task.challenge ?? 3)) || 0);
    const keys = gqKeyPair(secret);
    const presentedSecret = task.wrongSecret ? (secret === 4 ? 5 : 4) : secret;
    const transcript = gqProve(presentedSecret, nonce, challenge);
    const verified = gqVerify(transcript, keys.publicKey);
    let stepNumber = 0;

    yield {
        stepNumber: stepNumber,
        entities: makeBars([keys.publicKey], ["public key y"], 0, "idle"),
        edges: [],
        description: `Registration: public key ${keys.publicKey} is the secret raised to ${V} modulo ${N}.`,
        codeLineNumber: 0,
        layout: "array",
        meta: { toy: true, publicKey: keys.publicKey, commitment: 0, challenge: 0, response: 0, verified: false },
    };
    stepNumber += 1;

    yield {
        stepNumber: stepNumber,
        entities: makeBars([transcript.commitment], ["commitment T"], 0, "visited"),
        edges: [],
        description: `The prover commits to a random nonce, giving T = ${transcript.commitment}.`,
        codeLineNumber: 1,
        layout: "array",
        meta: { toy: true, publicKey: keys.publicKey, commitment: transcript.commitment, challenge: 0, response: 0, verified: false },
    };
    stepNumber += 1;

    yield {
        stepNumber: stepNumber,
        entities: makeBars([transcript.challenge], ["challenge c"], 0, "active"),
        edges: [],
        description: `The verifier sends random challenge c = ${transcript.challenge}.`,
        codeLineNumber: 2,
        layout: "array",
        meta: { toy: true, publicKey: keys.publicKey, commitment: transcript.commitment, challenge: transcript.challenge, response: 0, verified: false },
    };
    stepNumber += 1;

    yield {
        stepNumber: stepNumber,
        entities: makeBars([transcript.response], ["response s"], 0, "comparing"),
        edges: [],
        description: `The prover answers with s = ${transcript.response}.`,
        codeLineNumber: 3,
        layout: "array",
        meta: { toy: true, publicKey: keys.publicKey, commitment: transcript.commitment, challenge: transcript.challenge, response: transcript.response, verified: false },
    };
    stepNumber += 1;

    yield {
        stepNumber: stepNumber,
        entities: makeBars([powMod(transcript.response, V, N), transcript.commitment * powMod(keys.publicKey, transcript.challenge, N) % N], ["left", "right"], -1, verified ? "sorted" : "error"),
        edges: [],
        description: verified
            ? "The two sides agree, so the prover is accepted as the key holder."
            : "The two sides differ, so the prover is rejected.",
        codeLineNumber: 4,
        layout: "array",
        meta: {
            toy: true,
            publicKey: keys.publicKey,
            commitment: transcript.commitment,
            challenge: transcript.challenge,
            response: transcript.response,
            verified: verified ? 1 : 0,
            done: true,
        },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "A prover registers the v-th power of a secret as its public key. To prove knowledge without revealing it, the prover first commits to a random value, waits for a random challenge, then combines the secret with that challenge in its reply. The verifier raises the reply to the v and checks it against the commitment and the public key. Because the challenge is chosen after the commitment, guessing a valid reply without the secret is unlikely.",
        invariants: [
            "The public key equals the secret raised to the exponent v modulo n.",
            "The commitment is the random nonce raised to the same exponent.",
            "Verification checks that the response to the v equals the commitment times the public key to the challenge.",
        ],
        correctness:
            "An honest prover computes the response as r times x to the c, so raising it to v gives r to the v times x to the vc, which is the commitment times the public key to the c. An impostor without x would need to solve a root problem modulo n to produce a response for a fresh random challenge. Since the challenge is chosen after the commitment, the impersonation probability is at most one over the challenge space.",
        complexityRationale:
            "Each modular exponentiation needs a number of multiplications logarithmic in its exponent, and only a constant number of them occur, so both parties run in logarithmic time. The transcript stores four integers, giving constant space.",
        uses: [
            "Zero-knowledge identification and login protocols",
            "Smart-card owner authentication",
            "Teaching three-move sigma protocols",
        ],
        references: [
            "Guillou and Quisquater, A Practical Zero-Knowledge Protocol Fitted to Security Microprocessors, EUROCRYPT 1988",
            "Menezes, Oorschot, and Vanstone, Handbook of Applied Cryptography, Chapter 10",
        ],
        workedExample:
            "With modulus 77, exponent 7 and secret 4, the public key is 4 to the 7 modulo 77. The prover picks nonce 5 and sends 5 to the 7 modulo 77 as the commitment. For challenge 3 the response is 5 times 4 cubed modulo 77, and the verifier checks that its seventh power matches the commitment times the public key cubed.",
    },
    id: "guillou-quisquater",
    name: "Guillou-Quisquater Identification (Toy Model)",
    category: "cryptography-security",
    complexity: { time: "O(log n)", space: "O(1)" },
    defaultInput: { secret: 4, nonce: 5, challenge: 3 },
    visualType: "array",
    run,
    pseudocode: [
        "register the public key as the secret to the v modulo n",
        "the prover chooses a random nonce and commits to its v-th power",
        "the verifier sends a random challenge below v",
        "the prover responds with the nonce times the secret to the challenge",
        "the verifier raises the response to the v",
        "the verifier multiplies the commitment by the public key to the challenge",
        "accept when the two values are equal",
        "done: report the identification verdict",
    ],
};

export default module;
