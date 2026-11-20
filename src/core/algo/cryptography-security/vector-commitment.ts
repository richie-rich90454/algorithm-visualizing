/**
 * vector-commitment.ts - Pedersen Vector Commitment (Toy Model)
 *
 * A vector commitment lets a prover fix a vector in a short value and later
 * open it. This teaching model uses a Pedersen-style commitment in a 31-bit
 * prime field: the commitment is the sum of message entries times public
 * generators plus a random blinder times another generator, all modulo the
 * prime. The real constructions use elliptic-curve groups; this scalar model
 * keeps the algebra inspectable. Not cryptographically secure.
 *
 * Time: O(dimension); Space: O(dimension).
 */

import type { AlgorithmModule, VisualEntity, VisualFrame } from "@/types";

const PRIME = 2147483647;

function generators(dimension: number): number[] {
    return Array.from({ length: dimension }, (_, index) => (2 ** (index + 3) + 12345 * (index + 1)) % PRIME);
}

function commit(vector: number[], randomness: number, gens: number[], h: number): number {
    let total = 0;
    for (let i = 0; i < vector.length; i += 1) {
        total = (total + (vector[i] ?? 0) * (gens[i] ?? 0)) % PRIME;
    }
    total = (total + randomness * h) % PRIME;
    return total < 0 ? total + PRIME : total;
}

function makeEntities(vector: number[], active: number): VisualEntity[] {
    return vector.map((value, index) => ({
        id: `entry-${index}`,
        type: "bar" as const,
        label: `${value}`,
        value,
        state: index === active ? "active" : "idle",
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { position: index },
    }));
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { vector?: number[]; randomness?: number } | null) ?? {};
    const vector = task.vector ?? [3, 5, 7, 11];
    const randomness = task.randomness ?? 42;
    const gens = generators(vector.length);
    const h = 987654321 % PRIME;

    let step = 0;
    yield {
        stepNumber: step,
        entities: makeEntities(vector, -1),
        edges: [],
        description: `Committing to a ${vector.length}-entry vector with a random blinder in a 31-bit field.`,
        codeLineNumber: 0,
        layout: "array",
        meta: { phase: "setup", commitment: null as number | null, verification: false, vector: [...vector] },
    };
    step += 1;

    let partial = 0;
    for (let i = 0; i < vector.length; i += 1) {
        partial = (partial + (vector[i] ?? 0) * (gens[i] ?? 0)) % PRIME;
        yield {
            stepNumber: step,
            entities: makeEntities(vector, i),
            edges: [],
            description: `Accumulated message entry ${i + 1} times its generator into the running commitment.`,
            codeLineNumber: 2,
            layout: "array",
            meta: { phase: "accumulate", commitment: null, verification: false, vector: [...vector] },
        };
        step += 1;
    }

    const commitment = commit(vector, randomness, gens, h);
    const reopened = commit(vector, randomness, gens, h);
    const verification = reopened === commitment;
    yield {
        stepNumber: step,
        entities: makeEntities(vector, -1),
        edges: [],
        description: `Commitment ${commitment} formed; reopening the vector verifies as ${verification}.`,
        codeLineNumber: 4,
        layout: "array",
        meta: { phase: "done", commitment, verification, vector: [...vector], randomness },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "A commitment is like a locked box: you publish a short fingerprint of a secret vector now and reveal the vector later. Adding a random blinder means the same vector produces a different-looking fingerprint each time, so the box leaks nothing about its contents until it is opened.",
        invariants: [
            "Each vector entry is weighted by a fixed public generator.",
            "The random blinder contributes randomness times one extra generator.",
            "All arithmetic is reduced modulo the same prime.",
        ],
        correctness:
            "Reopening recomputes the identical modular sum from the vector and blinder, so a honest opening always matches the published commitment. Because the blinder is chosen freshly and is secret, an observer cannot distinguish commitments to different vectors, which is the hiding property this model illustrates.",
        complexityRationale:
            "The prover multiplies and adds once per vector entry, so committing and verifying both take O(dimension) time and O(dimension) space for the displayed entries.",
        uses: [
            "Commit-and-reveal protocols and sealed bids",
            "Building blocks for zero-knowledge proof systems",
            "Teaching the hiding and binding properties of cryptographic commitments",
        ],
        references: [
            "Pedersen, Non-Interactive and Information-Theoretic Secure Verifiable Secret Sharing, 1991",
            "Kate, Zaverucha, and Goldberg, Constant-Size Commitments to Polynomials, 2010",
        ],
        workedExample:
            "Committing to the vector three, five, seven, eleven with blinder forty-two mod the Mersenne prime two to the thirty-first minus one yields one field element. Revealing the same vector and blinder reproduces it exactly, while a new blinder gives a different element.",
    },
    id: "vector-commitment",
    name: "Pedersen Vector Commitment (Toy Model)",
    category: "cryptography-security",
    complexity: { time: "O(dimension)", space: "O(dimension)" },
    defaultInput: { vector: [3, 5, 7, 11], randomness: 42 },
    visualType: "array",
    run,
    pseudocode: [
        "read the message vector and a random blinder",
        "set the running total to zero",
        "for each entry add entry times its public generator",
        "add the blinder times the blinding generator",
        "reduce modulo the prime to form the commitment",
        "reopen with the same vector to verify equality",
        "report the commitment and verification result",
    ],
};

export default module;
