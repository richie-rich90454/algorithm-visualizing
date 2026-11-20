/**
 * feige-fiat-shamir.ts - Feige-Fiat-Shamir Identification (Toy Model)
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Feige-Fiat-Shamir is a zero-knowledge identification protocol. The prover
 * knows secret roots whose squares are published as public keys. In each round
 * the prover commits to a random square, the verifier sends a random challenge
 * bit, and the prover answers with a value whose square equals the commitment
 * times the public key when the bit is one. A cheater who does not know a root
 * can answer only one of the two challenges. This toy instance uses a 253
 * modulus, so it demonstrates the protocol and makes no security claim.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 *   Time:  O(k) modular multiplications for k rounds
 *   Space: O(k) for the round transcript
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 *   - One cell per round shows its commitment, challenge bit, and response.
 *   - A passing round is green; a failed round is red.
 *   - meta carries the full transcript and the accept verdict.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

const N = 253;
const SECRETS = [2, 3, 5, 7, 13];
const NONCES = [4, 6, 8, 9, 12];
const BITS = [1, 0, 1, 1, 0];

/** Exact modular multiplication for the small toy modulus. */
export function mulMod(a: number, b: number, modulus = N): number {
    return (a * b) % modulus;
}

/** Run one identification session and return the transcript. */
export function protocol(cheater = false) {
    const publicKeys = SECRETS.map((secret) => mulMod(secret, secret));
    const commitments: number[] = [];
    const responses: number[] = [];
    const accepted: boolean[] = [];
    for (let round = 0; round < BITS.length; round += 1) {
        const secret = SECRETS[round] ?? 1;
        const nonce = NONCES[round] ?? 1;
        const bit = BITS[round] ?? 0;
        const used = cheater ? secret + 1 : secret;
        const commitment = mulMod(nonce, nonce);
        const response = bit === 1 ? mulMod(nonce, used) : nonce;
        const left = mulMod(response, response);
        const right = bit === 1 ? mulMod(commitment, publicKeys[round] ?? 1) : commitment;
        commitments.push(commitment);
        responses.push(response);
        accepted.push(left === right);
    }
    return { publicKeys, commitments, responses, accepted, ok: accepted.every(Boolean) };
}

/** Build one cell per round of the transcript. */
function makeCells(
    commitments: number[],
    responses: number[],
    verdicts: boolean[],
    filled: number,
): VisualEntity[] {
    return BITS.map((bit, index) => {
        const valid = verdicts[index] === true;
        let state: EntityState = "idle";
        if (index < filled) {
            state = valid ? "sorted" : "error";
        }
        return {
            id: `round-${index}`,
            type: "cell" as const,
            label: `r${index + 1}: x=${commitments[index] ?? "-"} b=${bit} y=${responses[index] ?? "-"}`,
            value: responses[index] ?? 0,
            state,
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: { row: 0, col: index, bit, verdict: state },
        };
    });
}

/** The Feige-Fiat-Shamir generator. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { cheater?: boolean } | null) ?? {};
    const cheater = task.cheater === true;
    const result = protocol(cheater);
    yield {
        stepNumber: 0,
        entities: makeCells([], [], [], 0),
        edges: [],
        description: `Feige-Fiat-Shamir toy identification over ${BITS.length} challenge rounds.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: {
            rows: 1,
            cols: BITS.length,
            modulus: N,
            accepted: false,
            verdicts: [] as number[],
            commitments: [] as number[],
            responses: [] as number[],
        },
    };

    let step = 1;
    for (let round = 0; round < BITS.length; round += 1) {
        yield {
            stepNumber: step,
            entities: makeCells(result.commitments, result.responses, result.accepted, round + 1),
            edges: [],
            description: `Round ${round + 1}: challenge ${BITS[round]}, response ${result.responses[round]} ${result.accepted[round] ? "accepted" : "rejected"}.`,
            codeLineNumber: 2,
            layout: "grid",
            meta: {
                rows: 1,
                cols: BITS.length,
                modulus: N,
                accepted: false,
                verdicts: result.accepted.slice(0, round + 1).map((value) => (value ? 1 : 0)),
                commitments: result.commitments.slice(0, round + 1),
                responses: result.responses.slice(0, round + 1),
            },
        };
        step += 1;
    }

    yield {
        stepNumber: step,
        entities: makeCells(result.commitments, result.responses, result.accepted, BITS.length),
        edges: [],
        description: cheater
            ? `Cheater detected: ${result.accepted.filter(Boolean).length} of ${BITS.length} rounds passed.`
            : `Prover accepted: all ${BITS.length} rounds verified.`,
        codeLineNumber: 5,
        layout: "grid",
        meta: {
            rows: 1,
            cols: BITS.length,
            modulus: N,
            accepted: result.ok,
            verdicts: result.accepted.map((value) => (value ? 1 : 0)),
            commitments: result.commitments,
            responses: result.responses,
            done: true,
        },
    };
}

/** The Feige-Fiat-Shamir module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "The prover knows several secret numbers and publishes their squares. In each round it first announces a random square as a commitment. The verifier then flips a coin: on heads the prover reveals its random value, on tails it reveals the random value times the secret. In both cases the verifier can square the answer and compare it with the commitment, possibly multiplied by the public square. A prover who does not know the secret can prepare for only one of the two coin flips.",
        invariants: [
            "Every commitment is the square of the prover's random nonce.",
            "When the challenge is zero the response equals the nonce; when it is one it equals nonce times secret.",
            "A round passes exactly when response squared equals commitment times the public key to the challenge.",
        ],
        correctness:
            "An honest prover always passes because squaring the response gives the nonce square when the bit is zero and the nonce square times the secret square when the bit is one, matching the commitment times the public key. A cheater using a wrong secret produces a response whose square disagrees on every challenge-one round, so the verifier rejects with high probability after several rounds. The transcript reveals no secret because all published values are squares or products with a random nonce. With a 253 modulus this is a teaching model, not a secure instance.",
        complexityRationale:
            "Each round needs a few modular multiplications to form the commitment, response, and two check values, so k rounds take O(k) time. Storing the commitment, response, and verdict per round uses O(k) space.",
        uses: [
            "Zero-knowledge proofs of knowledge in authentication",
            "Historical smart-card identification schemes",
            "Teaching challenge-response and soundness error reduction",
        ],
        references: [
            "Feige, Fiat, and Shamir, Zero Knowledge Proofs of Identity, 1988",
            "Goldwasser, Micali, and Rackoff, The Knowledge Complexity of Interactive Proof Systems, 1985",
        ],
        workedExample:
            "With secret 2, its public square 4 modulo 253, nonce 4, and challenge bit 1, the prover commits to 16 and answers 8. The verifier checks 8 squared, 64, against 16 times 4, also 64, so the round passes. An impostor using 3 instead would answer 12, whose square 144 does not equal 64, and the round fails.",
    },
    id: "feige-fiat-shamir",
    name: "Feige-Fiat-Shamir Identification (Toy Model)",
    category: "cryptography-security",
    complexity: { time: "O(k)", space: "O(k)" },
    defaultInput: {},
    visualType: "grid",
    run,
    pseudocode: [
        "publish the squares of the prover's secret roots",
        "for each challenge round",
        "prover picks a nonce and sends its square as commitment",
        "verifier sends a random challenge bit",
        "prover answers with nonce or nonce times secret",
        "verifier squares the answer and compares with the commitment",
        "reject the whole session if any round fails",
        "done: report the accept verdict and transcript",
    ],
};

export default module;
