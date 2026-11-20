/**
 * a5-2.ts - A5/2 Stream Cipher (Teaching Toy Model)
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * A5/2 is the weaker GSM cipher that replaced A5/1 in many export markets.
 * Like A5/1 it combines three shift registers of 19, 22, and 23 bits, but it
 * drives their clocking from a small fourth register instead of a majority
 * vote of the three registers themselves. Registers clock under the control of
 * the fourth register, and the keystream bit is the XOR of the three main
 * register outputs.
 *
 * This is a TEACHING TOY MODEL of that structure: the register families and
 * stop/go clocking are faithful in spirit, but the exact fourth-register
 * wiring of the GSM standard is simplified. It must not protect real data.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(bits) shift and XOR operations
 *   Space: O(1) for the four register states
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - One bar per keystream bit shows 0 or 1.
 *   - The active clock control mask is highlighted in the metadata.
 *   - meta tracks the clock mask and the emitted keystream bits.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface A52Input {
    key?: number[];
    bits?: number;
}

export interface A52State {
    r1: number[];
    r2: number[];
    r3: number[];
    r4: number[];
}

/** Initialize the four registers from key bytes, forcing each nonzero. */
export function a52Init(key: number[]): A52State {
    const keyBytes = key.length > 0 ? key.map((b) => b & 0xff) : [0x12, 0x34, 0x56, 0x78, 0x9a, 0xbc, 0xde, 0xf0];
    const fill = (length: number, offset: number): number[] =>
        Array.from({ length }, (_v, i) => (keyBytes[(i + offset) % keyBytes.length] ?? 0) & 1);
    const r1 = fill(19, 0);
    const r2 = fill(22, 3);
    const r3 = fill(23, 6);
    const r4 = fill(4, 1);
    if (!r1.some(Boolean)) r1[0] = 1;
    if (!r2.some(Boolean)) r2[0] = 1;
    if (!r3.some(Boolean)) r3[0] = 1;
    if (!r4.some(Boolean)) r4[0] = 1;
    return { r1, r2, r3, r4 };
}

/** Clock one Galois-style LFSR; taps are zero-based bit indices. */
export function clockLfsr(register: number[], taps: number[]): number {
    const feedback = taps.reduce((acc, tap) => acc ^ (register[tap] ?? 0), 0);
    register.pop();
    register.unshift(feedback);
    return feedback;
}

/** Advance the generator one step and return the keystream bit and clock mask. */
export function a52Step(state: A52State): { bit: number; mask: [number, number, number] } {
    const c1 = state.r4[0] ?? 0;
    const c2 = state.r4[1] ?? 0;
    const c3 = state.r4[2] ?? 0;
    let mask: [number, number, number] = [c1, c2, c3];
    if (mask[0] + mask[1] + mask[2] < 2) {
        mask = mask[0] === 1 ? [1, 1, 0] : mask[1] === 1 ? [1, 1, 1] : [1, 1, 1];
    }
    if (mask[0] === 1) clockLfsr(state.r1, [12, 15, 16, 17]);
    if (mask[1] === 1) clockLfsr(state.r2, [19, 20]);
    if (mask[2] === 1) clockLfsr(state.r3, [6, 19, 20, 21]);
    clockLfsr(state.r4, [2, 0]);
    const bit = (state.r1[18] ?? 0) ^ (state.r2[21] ?? 0) ^ (state.r3[22] ?? 0);
    return { bit, mask };
}

/** Generate a keystream of the requested length. */
export function a52Keystream(key: number[], bits: number): number[] {
    const state = a52Init(key);
    const output: number[] = [];
    for (let i = 0; i < bits; i += 1) {
        output.push(a52Step(state).bit);
    }
    return output;
}

function makeEntities(stream: number[], active: number, done: number): VisualEntity[] {
    return stream.map((bit, index) => ({
        id: `bit-${index}`,
        type: "bar" as const,
        label: String(bit),
        value: bit,
        state: (index < done ? "sorted" : index === active ? "comparing" : "idle") as EntityState,
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { index, bit },
    }));
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as A52Input | null) ?? {};
    const key = Array.isArray(task.key) ? task.key : [0x12, 0x34, 0x56, 0x78, 0x9a, 0xbc, 0xde, 0xf0];
    const bits = Math.max(0, Math.min(256, Math.floor(task.bits ?? 32)));
    const stream = a52Keystream(key, bits);
    let step = 0;

    yield {
        stepNumber: step,
        entities: makeEntities(stream, -1, 0),
        edges: [],
        description: `A5/2 teaching model: generating ${bits} keystream bit(s) from a ${key.length}-byte key.`,
        codeLineNumber: 0,
        layout: "array",
        meta: { bits, keyBytes: key.length, mask: [0, 0, 0], keystream: stream },
    };
    step += 1;

    const state = a52Init(key);
    for (let index = 0; index < stream.length; index += 1) {
        const advanced = a52Step(state);
        yield {
            stepNumber: step,
            entities: makeEntities(stream, index, index + 1),
            edges: [],
            description: `Step ${index + 1}: clock mask ${advanced.mask.join("")} produces keystream bit ${advanced.bit}.`,
            codeLineNumber: 3,
            layout: "array",
            meta: { bits, keyBytes: key.length, mask: advanced.mask, bit: advanced.bit },
        };
        step += 1;
    }

    yield {
        stepNumber: step,
        entities: makeEntities(stream, -1, stream.length),
        edges: [],
        description: `A5/2 finished: ${stream.length} keystream bit(s) generated.`,
        codeLineNumber: 6,
        layout: "array",
        meta: { bits, keyBytes: key.length, keystream: stream },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "GSM needed a cipher that could be exported widely, so A5/2 trades strength for simplicity. It keeps the three irregularly clocked shift registers of A5/1 but lets a small fourth register decide when each one steps, which makes the generator faster to implement and far easier to analyze, and consequently much weaker.",
        invariants: [
            "Each LFSR keeps a fixed length and only ever shifts in a feedback bit.",
            "At least two of the three main registers clock on every step.",
            "A keystream bit is the XOR of the most significant bits of the three main registers.",
        ],
        correctness:
            "The registers evolve deterministically from the key, so the same key always produces the same keystream. The clock mask guarantees at least two registers advance each step, avoiding stalling, and the XOR combiner is exactly the linear combining function the cipher specifies, which is why the real cipher succumbs to correlation attacks.",
        complexityRationale:
            "Each generated bit performs at most a few shifts and XORs over fixed-size registers, so producing b bits costs O(b) work. The four registers hold a constant number of bits, giving O(1) space.",
        uses: [
            "Explaining how clock-controlled generators differ from majority-clocked ones",
            "Studying why A5/2 is vulnerable while A5/1 lasted longer",
            "A compact example of combining several LFSRs into a keystream",
        ],
        references: [
            "CRYPTREC, A5/2 Stream Cipher Specification and Evaluation",
            "J. D. Golic, Cryptanalysis of the A5/2 Algorithm, 2000",
        ],
        workedExample:
            "With an eight-byte key, the four registers are seeded from alternating key bits. The fourth register supplies a three-bit clock mask such as 110, so R1 and R2 step while R3 holds; the XOR of the three register output bits becomes the next keystream bit.",
    },
    id: "a5-2",
    name: "A5/2 Stream Cipher",
    category: "cryptography-security",
    complexity: { time: "O(bits)", space: "O(1)" },
    defaultInput: { key: [0x12, 0x34, 0x56, 0x78, 0x9a, 0xbc, 0xde, 0xf0], bits: 32 },
    visualType: "array",
    run,
    pseudocode: [
        "seed the three main registers and the clock register from the key",
        "for each output bit, read the three clock control bits",
        "force at least two control bits high so the generator advances",
        "clock each main register whose control bit is high",
        "clock the control register with its own feedback polynomial",
        "output the x or of the three main register outputs",
        "done: the emitted bits form the keystream",
    ],
};

export default module;
