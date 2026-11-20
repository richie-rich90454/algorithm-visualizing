/**
 * vmpc.ts - VMPC Stream Cipher (Teaching Toy Model)
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * VMPC (Variably Modified Permutation Composition) builds a keystream from a
 * single 256-byte permutation that is continuously recombined with itself. A
 * key schedule shuffles the permutation, then each output byte is obtained by
 * composing lookups at indices derived from the running state before the
 * permutation is updated again. The design is compact and avoids some of the
 * table biases RC4 is known for.
 *
 * This is a TEACHING TOY MODEL of the permutation-composition idea: the exact
 * published KSA round count and output taps are simplified for clarity, so it
 * must not be used to protect real data.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(256) key setup and O(1) per keystream byte
 *   Space: O(256) for the permutation table
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - One bar per keystream byte shows its numeric value.
 *   - The byte just emitted is highlighted.
 *   - meta tracks the running indices n and j and the emitted stream.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface VmpcInput {
    key?: string;
    plaintext?: string;
    streamLength?: number;
}

export interface VmpcState {
    s: number[];
    n: number;
    j: number;
}

/** Shuffle a 256-byte permutation from a string key. */
export function vmpcKsa(key: string): VmpcState {
    const bytes = Array.from(key.length > 0 ? key : "Key", (ch) => ch.charCodeAt(0) & 0xff);
    const s = Array.from({ length: 256 }, (_v, i) => i);
    let j = 0;
    for (let i = 0; i < 256; i += 1) {
        j = (j + (s[i] ?? 0) + (bytes[i % bytes.length] ?? 0)) & 0xff;
        const t = s[i] ?? 0;
        s[i] = s[j] ?? 0;
        s[j] = t;
    }
    for (let round = 0; round < 768; round += 1) {
        const i = round & 0xff;
        j = (j + (s[i] ?? 0) + (bytes[i % bytes.length] ?? 0)) & 0xff;
        const t = s[i] ?? 0;
        s[i] = s[j] ?? 0;
        s[j] = t;
    }
    return { s, n: 0, j };
}

/** Compose permutation lookups to emit one byte and update the state. */
export function vmpcStep(state: VmpcState): number {
    const { s } = state;
    state.j = s[(state.n + (s[state.j] ?? 0)) & 0xff] ?? 0;
    const output = s[((s[state.j] ?? 0) + (s[state.n] ?? 0)) & 0xff] ?? 0;
    const t = s[state.n] ?? 0;
    s[state.n] = s[state.j] ?? 0;
    s[state.j] = t;
    state.n = (state.n + 1) & 0xff;
    return output;
}

/** Generate a keystream of the requested length from a fresh state. */
export function vmpcKeystream(key: string, length: number): number[] {
    const state = vmpcKsa(key);
    return Array.from({ length }, () => vmpcStep(state));
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
        metadata: { index, value },
    }));
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as VmpcInput | null) ?? {};
    const key = typeof task.key === "string" ? task.key : "Key";
    const plaintext = task.plaintext ?? "Attack at dawn";
    const length = Math.max(0, Math.floor(task.streamLength ?? plaintext.length));
    const state = vmpcKsa(key);
    const stream: number[] = [];
    const frames: Array<{ byte: number; n: number; j: number }> = [];
    for (let i = 0; i < length; i += 1) {
        const byte = vmpcStep(state);
        stream.push(byte);
        frames.push({ byte, n: state.n, j: state.j });
    }
    const cipher = Array.from(plaintext, (ch, index) => (ch.charCodeAt(0) & 0xff) ^ (stream[index] ?? 0));
    let step = 0;

    yield {
        stepNumber: step,
        entities: makeEntities(stream, -1, 0),
        edges: [],
        description: `VMPC teaching model: ${length} keystream byte(s) from a ${key.length}-character key.`,
        codeLineNumber: 0,
        layout: "array",
        meta: { keyLength: key.length, length, keystream: stream, ciphertext: cipher },
    };
    step += 1;

    for (let index = 0; index < frames.length; index += 1) {
        const frame = frames[index] ?? { byte: 0, n: 0, j: 0 };
        yield {
            stepNumber: step,
            entities: makeEntities(stream, index, index + 1),
            edges: [],
            description: `Step ${index + 1}: composing the permutation produced byte ${frame.byte}.`,
            codeLineNumber: 2,
            layout: "array",
            meta: { keyLength: key.length, length, n: frame.n, j: frame.j, byte: frame.byte },
        };
        step += 1;
    }

    yield {
        stepNumber: step,
        entities: makeEntities(stream, -1, stream.length),
        edges: [],
        description: `VMPC finished: ${stream.length} keystream byte(s) and ${cipher.length} ciphertext byte(s).`,
        codeLineNumber: 5,
        layout: "array",
        meta: { keyLength: key.length, length, keystream: stream, ciphertext: cipher, plaintext },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Instead of maintaining several tables, VMPC keeps one shuffled byte permutation and computes each output by feeding the permutation into itself at positions chosen by the current state. Every output also swaps two entries, so the table never sits still and each new byte depends on the whole history of prior outputs.",
        invariants: [
            "The 256-byte table remains a permutation because every update is a swap.",
            "The running index n advances by exactly one modulo 256 per output byte.",
            "Each ciphertext byte is the plaintext byte XORed with one keystream byte.",
        ],
        correctness:
            "Swapping two entries of a permutation always yields another permutation, so every lookup is well defined throughout the stream. Since the keystream is generated deterministically from the key, XORing it with a plaintext and then with the same keystream recovers the original bytes exactly, which is the defining correctness property of a stream cipher.",
        complexityRationale:
            "The key schedule performs 256 plus 768 swap steps, O(256), and each keystream byte needs a constant number of lookups and one swap, O(1). The single permutation plus the emitted stream use O(256 + L) space.",
        uses: [
            "Comparing a one-table design against RC4's two-pointer structure",
            "Teaching permutation composition as a source of pseudorandomness",
            "A compact example for discussing stream-cipher state updates",
        ],
        references: [
            "B. Zoltak, VMPC One-Way Function and Stream Cipher, Fast Software Encryption 2004",
            "B. Zoltak, VMPC: Variably Modified Permutation Composition, 2003",
        ],
        workedExample:
            "With the key 'Key', the permutation starts as the identity and is shuffled in 256 plus 768 swap rounds. The first output composes lookups at indices derived from n = 0 and j = 0, then swaps two entries and advances n, so the second output is drawn from a slightly different permutation.",
    },
    id: "vmpc",
    name: "VMPC Stream Cipher",
    category: "cryptography-security",
    complexity: { time: "O(256 + L)", space: "O(256 + L)" },
    defaultInput: { key: "Key", plaintext: "Attack at dawn" },
    visualType: "array",
    run,
    pseudocode: [
        "initialize the 256-byte permutation to the identity",
        "shuffle it with the key, then repeat the mixing rounds",
        "set the running indices n and j to zero",
        "for each byte, compose permutation lookups at state-derived indices",
        "swap the entries at positions n and j and advance n",
        "x or the keystream with the plaintext bytes",
        "done: report the keystream and the ciphertext",
    ],
};

export default module;
