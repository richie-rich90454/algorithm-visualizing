/**
 * rc4a.ts - RC4A Stream Cipher (Teaching Model)
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * RC4A is a stream cipher variant of RC4 that runs two independent 256-byte
 * permutations under the same key. The key-scheduling algorithm scrambles both
 * boxes, and the generator alternates between them: one output byte comes from
 * S1 on an odd output and one from S2 on an even output. Using two state boxes
 * removes several of the correlations that weaken plain RC4.
 *
 * This is a faithful teaching implementation of the cipher's mathematical
 * core with small string keys. It is not a vetted constant-time implementation
 * and must not be used to protect real data.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(256) for key setup and O(1) per keystream byte
 *   Space: O(256) for the two permutation boxes
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - One bar per output byte shows the emitted keystream value.
 *   - Odd outputs come from S1 and even outputs from S2; the active box is
 *     highlighted.
 *   - meta tracks the two box indices, the keystream, and the ciphertext.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface Rc4aInput {
    key?: string;
    plaintext?: string;
    streamLength?: number;
}

export interface Rc4aState {
    s1: number[];
    s2: number[];
}

/** Key-scheduling algorithm that scrambles both 256-byte permutations. */
export function rc4aKsa(key: string): Rc4aState {
    const bytes = Array.from(key.length > 0 ? key : "Key", (ch) => ch.charCodeAt(0) & 0xff);
    const s1 = Array.from({ length: 256 }, (_v, i) => i);
    const s2 = Array.from({ length: 256 }, (_v, i) => i);
    let j1 = 0;
    let j2 = 0;
    for (let i = 0; i < 256; i += 1) {
        const k = bytes[i % bytes.length] ?? 0;
        j1 = (j1 + (s1[i] ?? 0) + k) & 0xff;
        const t1 = s1[i] ?? 0;
        s1[i] = s1[j1] ?? 0;
        s1[j1] = t1;
        j2 = (j2 + (s2[i] ?? 0) + k) & 0xff;
        const t2 = s2[i] ?? 0;
        s2[i] = s2[j2] ?? 0;
        s2[j2] = t2;
    }
    return { s1, s2 };
}

/** Generate a keystream by alternating output bytes between S1 and S2. */
export function rc4aPrga(state: Rc4aState, length: number): number[] {
    const s1 = [...state.s1];
    const s2 = [...state.s2];
    let i1 = 0;
    let i2 = 0;
    let j1 = 0;
    let j2 = 0;
    const output: number[] = [];
    for (let n = 0; n < length; n += 1) {
        i1 = (i1 + 1) & 0xff;
        j1 = (j1 + (s1[i1] ?? 0)) & 0xff;
        const a = s1[i1] ?? 0;
        s1[i1] = s1[j1] ?? 0;
        s1[j1] = a;
        output.push(s1[((s1[i1] ?? 0) + (s1[j1] ?? 0)) & 0xff] ?? 0);
        i2 = (i2 + 1) & 0xff;
        j2 = (j2 + (s2[i2] ?? 0)) & 0xff;
        const b = s2[i2] ?? 0;
        s2[i2] = s2[j2] ?? 0;
        s2[j2] = b;
        output.push(s2[((s2[i2] ?? 0) + (s2[j2] ?? 0)) & 0xff] ?? 0);
    }
    return output.slice(0, length);
}

function makeEntities(stream: number[], active: number, done: number): VisualEntity[] {
    return stream.map((value, index) => ({
        id: `byte-${index}`,
        type: "bar" as const,
        label: String(value),
        value,
        state: (index < done ? "sorted" : index === active ? "comparing" : "idle") as EntityState,
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { index, value, box: index % 2 === 0 ? "S1" : "S2" },
    }));
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as Rc4aInput | null) ?? {};
    const plaintext = task.plaintext ?? "Attack at dawn";
    const key = task.key ?? "Key";
    const length = Math.max(0, Math.floor(task.streamLength ?? plaintext.length));
    const state = rc4aKsa(key);
    const stream = rc4aPrga(state, length);
    const bytes = Array.from(plaintext, (ch) => ch.charCodeAt(0) & 0xff);
    const cipher = bytes.map((byte, index) => byte ^ (stream[index] ?? 0));
    let step = 0;

    yield {
        stepNumber: step,
        entities: makeEntities(stream, -1, 0),
        edges: [],
        description: `RC4A key setup complete for a ${key.length}-character key; generating ${length} keystream byte(s).`,
        codeLineNumber: 0,
        layout: "array",
        meta: { keyLength: key.length, length, keystream: stream, ciphertext: cipher },
    };
    step += 1;

    for (let index = 0; index < stream.length; index += 1) {
        const value = stream[index] ?? 0;
        yield {
            stepNumber: step,
            entities: makeEntities(stream, index, index + 1),
            edges: [],
            description: `Keystream byte ${index} is ${value}, emitted from box ${index % 2 === 0 ? "S1" : "S2"}.`,
            codeLineNumber: index % 2 === 0 ? 3 : 5,
            layout: "array",
            meta: { keyLength: key.length, length, box: index % 2 === 0 ? "S1" : "S2", byte: value },
        };
        step += 1;
    }

    yield {
        stepNumber: step,
        entities: makeEntities(stream, -1, stream.length),
        edges: [],
        description: `RC4A finished: ${stream.length} keystream byte(s) and ${cipher.length} ciphertext byte(s).`,
        codeLineNumber: 6,
        layout: "array",
        meta: { keyLength: key.length, length, keystream: stream, ciphertext: cipher, plaintext },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "RC4 improves on a single shuffled byte table by keeping two of them and alternating which one produces each output byte. Both tables are shuffled with the same key but evolve independently during generation, so observing one output byte reveals less about the next one than it would in the original RC4.",
        invariants: [
            "Both S1 and S2 remain permutations of the integers 0 through 255 after every swap.",
            "Odd-indexed keystream bytes come from S1 and even-indexed bytes from S2.",
            "Each output byte is XORed with exactly one plaintext byte, so decryption is the same operation.",
        ],
        correctness:
            "Key scheduling and generation only ever swap entries of a permutation, so each box stays a bijection and its table lookups are well defined. Because the ciphertext is the plaintext XORed with a deterministic keystream, XORing the same keystream again recovers the plaintext exactly; alternating boxes does not change that identity.",
        complexityRationale:
            "Key setup performs 256 swaps on each of the two boxes, which is O(256), and each generated byte costs one swap and one lookup, O(1). Storing the two 256-entry permutations and the emitted stream uses O(256 + L) space.",
        uses: [
            "Teaching how stream-cipher state boxes evolve and why RC4 variants exist",
            "Lightweight keystream generation in constrained teaching examples",
            "Comparing correlation attacks against RC4 and its two-box variant",
        ],
        references: [
            "S. Paul and B. Preneel, A New Weakness in the RC4 Keystream Generator and an Approach to Improve Its Security, Fast Software Encryption 2004",
            "R. Rivest, The RC4 Encryption Algorithm, 1987",
        ],
        workedExample:
            "With the key 'Key', both boxes start as the identity permutation and are shuffled with the same three key bytes. The first keystream byte comes from S1, the second from S2, and XORing those two bytes with the first two bytes of a plaintext gives the first two ciphertext bytes.",
    },
    id: "rc4a",
    name: "RC4A Stream Cipher",
    category: "cryptography-security",
    complexity: { time: "O(256 + L)", space: "O(256 + L)" },
    defaultInput: { key: "Key", plaintext: "Attack at dawn" },
    visualType: "array",
    run,
    pseudocode: [
        "initialize two identity permutations S1 and S2 of 256 bytes",
        "for i from 0 to 255, shuffle S1 and S2 with the key bytes",
        "set both output indices and swap indices to zero",
        "for each output pair, advance and swap in S1 and emit one byte",
        "advance and swap in S2 and emit one byte",
        "x or plaintext bytes with the generated keystream",
        "done: report the keystream and the ciphertext",
    ],
};

export default module;
