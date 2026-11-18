/**
 * poseidon-hash.ts - Poseidon Permutation and Sponge Hash (Toy Field)
 *
 * Poseidon is a zero-knowledge-friendly hash built from a finite-field sponge:
 * add round constants, apply a low-degree S-box, and mix with an MDS matrix.
 * Full rounds apply the S-box to every state element; partial rounds apply it
 * to one. This toy uses a 31-bit prime, two state elements, and six rounds with
 * exact arithmetic. The parameters are far below any security requirement;
 * this is a teaching model, not a production hash.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

const P = 2147483647n;
const MODULUS = Number(P);

const fmod = (x: bigint): bigint => ((x % P) + P) % P;
const add = (a: bigint, b: bigint): bigint => fmod(a + b);
const multiply = (a: bigint, b: bigint): bigint => fmod(a * b);

/** Modular exponentiation for the x^5 S-box. */
export function fieldPow(base: bigint, exponent: bigint): bigint {
    let result = 1n;
    let b = fmod(base);
    let e = exponent;
    while (e > 0n) {
        if (e & 1n) {
            result = multiply(result, b);
        }
        b = multiply(b, b);
        e >>= 1n;
    }
    return result;
}

export interface PoseidonToy {
    input: number;
    output: number;
    rounds: number;
    fullHalf: number;
    roundConstants: number[][];
    states: number[][];
}

/** Deterministically derive the round constants from a seed. */
export function makeConstants(seed: number, rounds: number, width: number): bigint[][] {
    let state = seed >>> 0;
    const constants: bigint[][] = [];
    for (let r = 0; r < rounds; r += 1) {
        const row: bigint[] = [];
        for (let i = 0; i < width; i += 1) {
            state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
            row.push(BigInt(state) % P);
        }
        constants.push(row);
    }
    return constants;
}

/** Apply the toy Poseidon permutation, recording the state after each round. */
export function poseidonPermutation(
    state: bigint[],
    constants: bigint[][],
    mds: bigint[][],
    fullHalf: number,
): bigint[][] {
    const width = state.length;
    const trace: bigint[][] = [];
    let s = state.slice();
    const rounds = constants.length;
    for (let r = 0; r < rounds; r += 1) {
        for (let i = 0; i < width; i += 1) {
            s[i] = add(s[i] ?? 0n, constants[r]?.[i] ?? 0n);
        }
        const isFull = r < fullHalf || r >= rounds - fullHalf;
        for (let i = 0; i < width; i += 1) {
            if (isFull || i === 0) {
                s[i] = fieldPow(s[i] ?? 0n, 5n);
            }
        }
        const next: bigint[] = [];
        for (let i = 0; i < width; i += 1) {
            let sum = 0n;
            for (let j = 0; j < width; j += 1) {
                sum = add(sum, multiply(mds[i]?.[j] ?? 0n, s[j] ?? 0n));
            }
            next.push(sum);
        }
        s = next;
        trace.push(s.slice());
    }
    return trace;
}

/** Absorb one field element and squeeze the first state element. */
export function buildPoseidon(input: number, seed: number, rounds: number, fullHalf = 1): PoseidonToy {
    const mds: bigint[][] = [
        [2n, 1n],
        [1n, 3n],
    ];
    const constants = makeConstants(seed, rounds, 2);
    const initial: bigint[] = [fmod(BigInt(input)), 0n];
    const trace = poseidonPermutation(initial, constants, mds, fullHalf);
    const final = trace[trace.length - 1] ?? initial;
    return {
        input,
        output: Number(final[0] ?? 0n),
        rounds,
        fullHalf,
        roundConstants: constants.map((row) => row.map((value) => Number(value))),
        states: trace.map((row) => row.map((value) => Number(value))),
    };
}

function makeCells(states: number[][], revealed: number, current: number): VisualEntity[] {
    const width = states[0]?.length ?? 2;
    const entities: VisualEntity[] = [];
    states.forEach((state, round) => {
        state.forEach((value, element) => {
            const shown = round <= revealed;
            const stateName: EntityState = round === current ? "comparing" : shown ? "sorted" : "idle";
            entities.push({
                id: `cell-${round}-${element}`,
                type: "cell",
                label: shown ? `${element}: ${value}` : "?",
                value,
                state: stateName,
                x: 0,
                y: 0,
                width: 0,
                height: 0,
                metadata: { row: round, col: element },
            });
        });
    });
    return entities;
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { input?: number; seed?: number; rounds?: number } | null) ?? {};
    const value = typeof task.input === "number" ? Math.max(0, Math.floor(task.input)) : 17;
    const seed = typeof task.seed === "number" ? task.seed : 20261118;
    const rounds = typeof task.rounds === "number" ? Math.max(4, Math.min(12, Math.floor(task.rounds))) : 6;
    const fullHalf = 1;
    const data = buildPoseidon(value, seed, rounds, fullHalf);
    const metaBase = { rows: data.states.length, cols: data.states[0]?.length ?? 2, input: value, seed, rounds, fullHalf };

    let step = 0;
    yield {
        stepNumber: step,
        entities: makeCells(data.states, -1, -1),
        edges: [],
        description: `Toy Poseidon permutation over a 31-bit field: ${rounds} rounds, x^5 S-box, 2x2 MDS mix. Parameters are not secure.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: { ...metaBase },
    };
    step += 1;

    for (let r = 0; r < data.states.length; r += 1) {
        const isFull = r < fullHalf || r >= rounds - fullHalf;
        yield {
            stepNumber: step,
            entities: makeCells(data.states, r, r),
            edges: [],
            description: `Round ${r}: add constants, apply x^5 to ${isFull ? "both elements (full round)" : "the first element (partial round)"}, then mix with MDS.`,
            codeLineNumber: r === 0 ? 1 : isFull ? 2 : 3,
            layout: "grid",
            meta: { ...metaBase, round: r, state: data.states[r] },
        };
        step += 1;
    }

    yield {
        stepNumber: step,
        entities: makeCells(data.states, data.states.length - 1, -1),
        edges: [],
        description: `Done: Poseidon(input ${value}) = ${data.output} (toy parameters, no security claim).`,
        codeLineNumber: 5,
        layout: "grid",
        meta: { ...metaBase, output: data.output, done: true },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Poseidon is designed to be cheap inside zero-knowledge circuits, where ordinary hashes are expensive. It works like a sponge: absorb the input into a small field state, then repeatedly add constants, apply a low-degree power map, and mix with an MDS matrix. Full rounds spread the change across all elements; partial rounds save constraints by changing only one.",
        invariants: [
            "Every field operation reduces modulo the prime, so states stay in [0, p).",
            "The S-box is x^5; the MDS matrix is linear over the field.",
            "The output is the first state element after the final round.",
        ],
        correctness:
            "The permutation is a fixed composition of additions, a deterministic power map, and a fixed linear mix, all reduced modulo a prime. An independent replay of the same round function reproduces the state after every round and the final output exactly. Because each round is a bijection on the field for a suitable exponent and an invertible MDS matrix, the construction is a permutation, which is the property a sponge hash relies on.",
        complexityRationale:
            "With a state width t and r rounds, each round costs O(t^2) field multiplications for the MDS mix plus t exponentiations, giving O(r*t^2) work and O(r*t) stored state for the trace. Real Poseidon uses a much larger field and carefully chosen round numbers.",
        uses: [
            "Merkle trees inside zero-knowledge proof systems",
            "Hash-constrained circuits in SNARKs and STARKs",
            "A teaching model for sponge constructions and field permutations",
        ],
        references: [
            "Grassi et al., Poseidon: A New Hash Function for Zero-Knowledge Proof Systems, USENIX Security 2021",
            "Bertoni et al., The Sponge Construction and SHA-3, 2008",
        ],
        workedExample:
            "With input 17, a two-element state [17, 0], six rounds, and constants fixed by a seed, round zero adds constants, raises both elements to the fifth power, and multiplies by the matrix [[2,1],[1,3]] modulo 2147483647. Repeating for all rounds and taking the first element yields the digest shown in the final frame.",
    },
    id: "poseidon-hash",
    name: "Poseidon Hash (Toy Field)",
    category: "cryptography-security",
    complexity: { time: "O(r*t^2)", space: "O(r*t)" },
    defaultInput: { input: 17, seed: 20261118, rounds: 6 },
    visualType: "grid",
    run,
    pseudocode: [
        "choose a prime field, state width, and round constants",
        "absorb the input into the first state element",
        "for each round add the round constants to the state",
        "apply the x^5 S-box to all elements in full rounds, one in partial rounds",
        "multiply the state by the MDS matrix modulo the prime",
        "after the last round output the first state element",
        "done: report the field digest",
    ],
};

export default module;
