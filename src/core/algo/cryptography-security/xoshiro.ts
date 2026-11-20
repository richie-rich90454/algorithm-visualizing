/**
 * xoshiro.ts - xoshiro256** Pseudorandom Generator
 *
 * A modern, fast non-cryptographic generator built on a 256-bit state of four
 * 64-bit words. Each step combines a multiplication and rotations to produce
 * an output, then advances the state with xor shifts and one rotation. The
 * state is seeded deterministically from a small integer with splitmix64. This
 * is the real xoshiro256** algorithm expressed with BigInt; it is for
 * simulation and games, not for cryptographic keys.
 *
 * Complexity:
 *   Time:  O(draws) for the requested outputs
 *   Space: O(draws) for the displayed outputs
 */

import type { AlgorithmModule, VisualEntity, VisualFrame } from "@/types";

const MASK = (1n << 64n) - 1n;

function mask(value: bigint): bigint {
    return value & MASK;
}

function rotl(value: bigint, shift: bigint): bigint {
    return mask((value << shift) | (value >> (64n - shift)));
}

function seedState(seed: number): bigint[] {
    let cursor = BigInt(seed >>> 0);
    const state: bigint[] = [];
    for (let i = 0; i < 4; i += 1) {
        cursor = mask(cursor + 0x9e3779b97f4a7c15n);
        let z = cursor;
        z = mask((z ^ (z >> 30n)) * 0xbf58476d1ce4e5b9n);
        z = mask((z ^ (z >> 27n)) * 0x94d049bb133111ebn);
        state.push(mask(z ^ (z >> 31n)));
    }
    return state;
}

function nextOutput(state: bigint[]): bigint {
    const s0 = state[0] ?? 0n;
    const s1 = state[1] ?? 0n;
    const s2 = state[2] ?? 0n;
    const s3 = state[3] ?? 0n;
    const result = mask(rotl(mask(s1 * 5n), 7n) * 9n);
    const t = mask(s1 << 17n);
    let a = s2 ^ s0;
    let b = s3 ^ s1;
    let c = s1 ^ a;
    let d = s0 ^ b;
    a = a ^ t;
    b = rotl(b, 45n);
    state[0] = d;
    state[1] = c;
    state[2] = a;
    state[3] = b;
    return result;
}

function hex(value: bigint): string {
    return value.toString(16).padStart(16, "0");
}

function makeBars(outputs: bigint[]): VisualEntity[] {
    return outputs.map((value, index) => ({
        id: `bar-${index}`,
        type: "bar" as const,
        label: hex(value).slice(0, 8),
        value: Number(value & 0xffffffffn),
        state: "sorted" as const,
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { index },
    }));
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { seed?: number; draws?: number } | null) ?? {};
    const seed = typeof task.seed === "number" ? task.seed >>> 0 : 1;
    const draws = Math.max(1, Math.min(32, typeof task.draws === "number" ? task.draws : 8));
    const state = seedState(seed);
    const outputs: bigint[] = [];
    const base = { draws, seed };

    yield {
        stepNumber: 0,
        entities: makeBars(outputs),
        edges: [],
        description: "Seed the 256-bit state with splitmix64, then draw xoshiro256** outputs.",
        codeLineNumber: 0,
        layout: "array",
        meta: { ...base, state: state.map(hex), outputs: [] },
    };
    for (let i = 0; i < draws; i += 1) {
        const value = nextOutput(state);
        outputs.push(value);
        yield {
            stepNumber: i + 1,
            entities: makeBars(outputs),
            edges: [],
            description: `Draw ${i}: output ${hex(value)} from the advanced state.`,
            codeLineNumber: 3,
            layout: "array",
            meta: { ...base, state: state.map(hex), outputs: outputs.map(hex) },
        };
    }
    yield {
        stepNumber: draws + 1,
        entities: makeBars(outputs),
        edges: [],
        description: `Generated ${draws} values; the same seed always reproduces this exact sequence.`,
        codeLineNumber: 6,
        layout: "array",
        meta: { ...base, state: state.map(hex), outputs: outputs.map(hex), last: hex(outputs[outputs.length - 1] ?? 0n) },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "A good pseudorandom generator keeps a hidden state and produces a new number from it on each call. xoshiro256** stores four 64-bit words. Each draw multiplies one word and rotates the product to form the output, then scrambles the four words with shifts and xors so the next output looks unrelated to the last. A small integer seed is expanded into the full state with splitmix64.",
        invariants: [
            "The four state words stay within 64 bits after every operation.",
            "The same seed always produces the same output sequence.",
            "The state advances exactly once per generated output.",
        ],
        correctness:
            "For a fixed seed, splitmix64 fills the initial state deterministically, and each step applies a fixed, fully specified sequence of multiplications, rotations, shifts, and xors. Replaying those operations on the same state yields the same outputs, so the generator is reproducible. The output transform is a bijection of the state words, so the sequence is the canonical xoshiro256** stream. Note that this is a statistical generator, not a secure one: its outputs must never be used as cryptographic keys.",
        complexityRationale:
            "Each draw performs a constant number of 64-bit operations, so producing k values takes O(k) time. Keeping the displayed outputs and a copy of the state occupies O(k) space in the visualization, while the generator itself uses only O(1) space.",
        uses: [
            "Fast random numbers in simulations and games",
            "Monte Carlo sampling and randomized algorithms",
            "A teaching model of modern PRNG state transitions",
        ],
        references: [
            "Blackman and Vigna, Scrambled Linear Pseudorandom Number Generators, 2021",
            "Vigna, xoshiro256** reference implementation, 2018",
        ],
        workedExample:
            "Seeding with 1 fills the four state words via splitmix64. The first draw multiplies the second word by five, rotates the product left by seven bits, multiplies by nine, and then advances the state with xor shifts and a 45-bit rotation. The hexadecimal output is recorded; repeating the draw continues the same stream.",
    },
    id: "xoshiro",
    name: "xoshiro256** Generator",
    category: "cryptography-security",
    complexity: { time: "O(draws)", space: "O(draws)" },
    defaultInput: { seed: 1, draws: 8 },
    visualType: "array",
    run,
    pseudocode: [
        "expand the small seed into four 64-bit state words",
        "for each requested draw compute the output word",
        "multiply the second state word by five and rotate",
        "scale the rotated word by nine to form the output",
        "advance the state with xor shifts and a rotation",
        "record the output as sixteen hexadecimal digits",
        "done: report the full generated sequence",
    ],
};

export default module;
