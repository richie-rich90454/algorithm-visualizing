/**
 * shake.ts - SHAKE Extendable-Output Function (Toy Model)
 *
 * SHAKE is a sponge-based extendable-output function: input is absorbed into a
 * fixed state, then as many bytes as requested are squeezed out. The real
 * construction uses the 1600-bit Keccak permutation; this teaching model uses
 * an eight-byte state and a small invertible byte mixer. It preserves the
 * sponge phases and the prefix property of a true XOF. Not cryptographically
 * secure.
 *
 * Time: O(input + output); Space: O(state).
 */

import type { AlgorithmModule, VisualEntity, VisualFrame } from "@/types";

const RATE = 4;
const STATE = 8;

function sbox(value: number): number {
    return (value * 13 + 7) & 0xff;
}

function permute(state: number[]): number[] {
    let s = [...state];
    for (let round = 0; round < 3; round += 1) {
        s = s.map((value, i) => (value ^ ((s[(i + 1) % STATE] ?? 0) << 1)) & 0xff);
        s = s.map((value) => sbox(value));
        s = [...s.slice(1), s[0] ?? 0];
    }
    return s;
}

function makeEntities(state: number[], active: number): VisualEntity[] {
    return state.map((value, index) => ({
        id: `state-${index}`,
        type: "bar" as const,
        label: `${value}`,
        value,
        state: index === active ? "active" : "idle",
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { lane: index },
    }));
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { message?: number[]; outputBytes?: number } | null) ?? {};
    const message = task.message ?? [1, 2, 3, 4, 5];
    const outputBytes = Math.max(1, Math.min(128, Math.floor(task.outputBytes ?? 16)));

    let state: number[] = new Array(STATE).fill(0);
    let step = 0;
    yield {
        stepNumber: step,
        entities: makeEntities(state, -1),
        edges: [],
        description: `Initialized a ${STATE}-byte sponge state for a SHAKE-style extendable output.`,
        codeLineNumber: 0,
        layout: "array",
        meta: { phase: "init", state: [...state], output: [] as number[] },
    };
    step += 1;

    for (let offset = 0; offset < message.length; offset += RATE) {
        const block = message.slice(offset, offset + RATE);
        for (let i = 0; i < block.length; i += 1) {
            state[i] = ((state[i] ?? 0) ^ (block[i] ?? 0)) & 0xff;
        }
        state = permute(state);
        yield {
            stepNumber: step,
            entities: makeEntities(state, offset % STATE),
            edges: [],
            description: `Absorbed message bytes ${offset} to ${Math.min(offset + RATE, message.length) - 1} and permuted the state.`,
            codeLineNumber: 2,
            layout: "array",
            meta: { phase: "absorb", state: [...state], output: [] as number[] },
        };
        step += 1;
    }

    const output: number[] = [];
    while (output.length < outputBytes) {
        output.push(...state.slice(0, RATE));
        state = permute(state);
        yield {
            stepNumber: step,
            entities: makeEntities(state, output.length % STATE),
            edges: [],
            description: `Squeezed ${Math.min(output.length, outputBytes)} of ${outputBytes} output bytes.`,
            codeLineNumber: output.length >= outputBytes ? 5 : 4,
            layout: "array",
            meta: { phase: "squeeze", state: [...state], output: [...output.slice(0, outputBytes)] },
        };
        step += 1;
    }

    const finalOutput = output.slice(0, outputBytes);
    yield {
        stepNumber: step,
        entities: makeEntities(state, -1),
        edges: [],
        description: `Produced ${finalOutput.length} extendable output bytes from the sponge.`,
        codeLineNumber: 6,
        layout: "array",
        meta: { phase: "done", state: [...state], output: finalOutput },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "A sponge keeps a small internal state. Input is absorbed by mixing it into part of the state, and output is squeezed by reading that part back out and permuting in between. Because squeezing does not depend on how many bytes you asked for, a longer request simply extends a shorter one.",
        invariants: [
            "Absorption XORs each input block into the first RATE state bytes before permuting.",
            "Squeezing always reads the same RATE positions and then permutes.",
            "The output of a shorter request is a prefix of the output of a longer request.",
        ],
        correctness:
            "The sponge is deterministic in the absorbed message, so identical inputs give identical streams. Because the squeeze loop advances the state identically regardless of the requested length, the first n bytes produced for any n are identical; this prefix property is verified by the companion test against an independent sponge implementation.",
        complexityRationale:
            "Absorbing costs one permutation per input block and squeezing one per output block, each a constant-time byte mixer, giving O(input plus output) time and O(state) space.",
        uses: [
            "Hashing messages to arbitrary-length outputs such as keys or masks",
            "Building extendable-output primitives from a fixed permutation",
            "Teaching the sponge construction behind the SHA-3 family",
        ],
        references: [
            "NIST FIPS 202, SHA-3 Standard: Permutation-Based Hash and Extendable-Output Functions",
            "Bertoni, Daemen, Peeters, and Van Assche, The Keccak Sponge Function, 2011",
        ],
        workedExample:
            "Absorbing the five-byte message one two three four five into the eight-byte state and requesting sixteen output bytes yields a stream whose first eight bytes are exactly the bytes produced when only eight are requested.",
    },
    id: "shake",
    name: "SHAKE XOF (Toy Model)",
    category: "cryptography-security",
    complexity: { time: "O(input + output)", space: "O(state)" },
    defaultInput: { message: [1, 2, 3, 4, 5], outputBytes: 16 },
    visualType: "array",
    run,
    pseudocode: [
        "initialize the sponge state to zeros",
        "for each input block XOR it into the rate portion of the state",
        "permute the state after every absorbed block",
        "while output bytes remain read the rate portion as output",
        "permute the state after every squeezed block",
        "truncate the stream to the requested length",
        "report the extendable output bytes",
    ],
};

export default module;
