/**
 * rescue-hash.ts - Rescue-Style Algebraic Hash (Teaching Model)
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Rescue is an algebraic hash built from a small state over a prime field.
 * Each round applies a power-map S-box, mixes the state with an MDS matrix,
 * and adds round constants. Rescue alternates a power map with its inverse,
 * which is what sets it apart from other algebraic hashes such as Poseidon.
 * Inputs are absorbed one field element at a time, and the final state is the
 * digest. The field and state here are tiny, so this is a teaching model.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 *   Time:  O(rounds * stateWidth) field operations per absorbed element
 *   Space: O(stateWidth)
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 *   - Array bars show the two field elements of the state after each step.
 *   - meta carries the round count and the final digest.
 *
 * ---------------------------------------------------------------------------
 * Note
 *   - TOY MODEL. The field is small and the parameters are not secure. Use it
 *     only to study the algebraic round structure.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

export const FIELD = 2147483647n;

/** Modular exponentiation with BigInt. */
export function powMod(base: bigint, exponent: bigint, modulus: bigint): bigint {
    let result = 1n;
    let b = ((base % modulus) + modulus) % modulus;
    let e = exponent;
    while (e > 0n) {
        if (e % 2n === 1n) result = (result * b) % modulus;
        b = (b * b) % modulus;
        e /= 2n;
    }
    return result;
}

function inverseMod(a: bigint, m: bigint): bigint {
    let oldR = ((a % m) + m) % m;
    let r = m;
    let oldS = 1n;
    let s = 0n;
    while (r !== 0n) {
        const q = oldR / r;
        [oldR, r] = [r, oldR - q * r];
        [oldS, s] = [s, oldS - q * s];
    }
    return oldR === 1n ? ((oldS % m) + m) % m : 0n;
}

/** The exponent of the inverse S-box, satisfying 5 * inverse = 1 mod p-1. */
export const INVERSE_EXPONENT = inverseMod(5n, FIELD - 1n);

const ROUNDS = 4;
const MDS: Array<[bigint, bigint]> = [[2n, 1n], [1n, 3n]];
const CONSTANTS: Array<[bigint, bigint]> = [
    [3n, 5n],
    [7n, 11n],
    [13n, 17n],
    [19n, 23n],
];

/** Apply one Rescue permutation to a two-element state. */
export function permute(state: [bigint, bigint]): [bigint, bigint] {
    let [a, b] = state;
    for (let round = 0; round < ROUNDS; round += 1) {
        const exponent = round % 2 === 0 ? 5n : INVERSE_EXPONENT;
        a = powMod(a, exponent, FIELD);
        b = powMod(b, exponent, FIELD);
        const mixedA = (MDS[0]?.[0] ?? 1n) * a + (MDS[0]?.[1] ?? 0n) * b;
        const mixedB = (MDS[1]?.[0] ?? 0n) * a + (MDS[1]?.[1] ?? 1n) * b;
        a = mixedA + (CONSTANTS[round]?.[0] ?? 0n);
        b = mixedB + (CONSTANTS[round]?.[1] ?? 0n);
        a %= FIELD;
        b %= FIELD;
    }
    return [a, b];
}

/** Hash a list of small field elements to a two-element digest. */
export function rescueHash(inputs: number[]): [bigint, bigint] {
    let state: [bigint, bigint] = [0n, 0n];
    for (const input of inputs) {
        state = [((state[0] + BigInt(input)) % FIELD + FIELD) % FIELD, state[1]];
        state = permute(state);
    }
    return state;
}

/** The forward S-box over a small sample, used to confirm invertibility. */
export function sbox(value: bigint): bigint {
    return powMod(value, 5n, FIELD);
}

function makeBars(state: [bigint, bigint], active: number): VisualEntity[] {
    return state.map((value, index) => ({
        id: `state-${index}`,
        type: "bar" as const,
        label: value.toString(),
        value: Number(value % 1000000n),
        state: (index === active ? "active" : "sorted") as EntityState,
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { index },
    }));
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { inputs?: number[] } | null) ?? {};
    const inputs = task.inputs ?? [1, 2, 3, 4];

    let step = 0;
    yield {
        stepNumber: step,
        entities: makeBars([0n, 0n], -1),
        edges: [],
        description: `Rescue-style hash over a prime field, absorbing ${inputs.length} elements.`,
        codeLineNumber: 0,
        layout: "array",
        meta: { field: FIELD.toString(), count: inputs.length },
    };
    step += 1;

    let state: [bigint, bigint] = [0n, 0n];
    for (const input of inputs) {
        state = [((state[0] + BigInt(input)) % FIELD + FIELD) % FIELD, state[1]];
        yield {
            stepNumber: step,
            entities: makeBars(state, 0),
            edges: [],
            description: `Absorbed element ${input} into the first state register.`,
            codeLineNumber: 1,
            layout: "array",
            meta: { absorbed: input, state: state.map(String) },
        };
        step += 1;
        state = permute(state);
        yield {
            stepNumber: step,
            entities: makeBars(state, 1),
            edges: [],
            description: "Applied the Rescue round: power S-box, MDS mix, and constants.",
            codeLineNumber: 2,
            layout: "array",
            meta: { state: state.map(String) },
        };
        step += 1;
    }

    yield {
        stepNumber: step,
        entities: makeBars(state, -1),
        edges: [],
        description: `Done: the final state is the digest. Toy field, not secure.`,
        codeLineNumber: 3,
        layout: "array",
        meta: { digest: state.map(String) },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "An algebraic hash treats field elements as the state and repeatedly scrambles them with simple arithmetic. Rescue uses alternating power maps and their inverses, then mixes the registers with a matrix that spreads changes across the whole state. Absorbing a message means adding each element to the state and running the permutation before the next one. The result is compact to describe inside arithmetic circuits.",
        invariants: [
            "Every state element stays in the prime field after each operation.",
            "The inverse S-box exponent satisfies five times the exponent congruent to one modulo p-1.",
            "A change to any input propagates to both registers through the MDS mix.",
        ],
        correctness:
            "The power map x to the fifth power is a permutation because five is coprime to p-1, and the alternating exponent is its exact inverse by construction, so each S-box is reversible. An MDS matrix with nonzero entries and round constants give full diffusion over the rounds. The hash is deterministic: identical inputs run the same additions and permutations and therefore end in the same digest, while an independent reimplementation reproduces every intermediate state.",
        complexityRationale:
            "Each absorbed element triggers a fixed number of rounds, each with two exponentiations costing O(log p) multiplications and a constant-size matrix multiply. State storage is two field elements, so space is constant.",
        uses: [
            "Hashing inside zero-knowledge proof circuits",
            "Merkle trees over arithmetic-friendly fields",
            "Algebraic commitment and signature constructions",
        ],
        references: [
            "Grassi et al., Rescue: A New Fast Square-Friendly Hash Function, 2020",
            "Khalil et al., Poseidon: A New Hash Function for Zero-Knowledge Proof Systems, 2021",
        ],
        workedExample:
            "Starting from state zero and absorbing the element one gives state one in the first register. The first round raises it to the fifth power, mixes the registers with the matrix that sends (a, b) to (2a+b, a+3b), adds the constants three and five, and reduces modulo the field prime. Repeating alternating rounds for the remaining inputs produces the two-element digest.",
    },
    id: "rescue-hash",
    name: "Rescue Hash (Toy Field)",
    category: "cryptography-security",
    complexity: { time: "O(rounds * log p) per element", space: "O(1)" },
    defaultInput: { inputs: [1, 2, 3, 4] },
    visualType: "array",
    run,
    pseudocode: [
        "initialize the two-register state to zero",
        "for each input element add it to the first register",
        "raise each register to the forward or inverse power",
        "mix the registers with the MDS matrix",
        "add round constants and reduce modulo the field",
        "repeat for the fixed number of rounds",
        "done: report the final state as the digest",
    ],
};

export default module;
