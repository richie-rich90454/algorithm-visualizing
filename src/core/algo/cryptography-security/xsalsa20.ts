/**
 * xsalsa20.ts - XSalsa20 Stream Cipher (Toy Model)
 *
 * XSalsa20 extends Salsa20 to a 24-byte nonce by first deriving a 32-byte
 * subkey from the key and the first 16 nonce bytes with the HSalsa20 function,
 * then running the Salsa20 block function with that subkey and the remaining 8
 * nonce bytes. This teaching version keeps the HSalsa20 plus Salsa20 pipeline
 * but shortens the core to a handful of double rounds. Not cryptographically
 * secure.
 *
 * Time: O(bytes + rounds); Space: O(state).
 */

import type { AlgorithmModule, VisualEntity, VisualFrame } from "@/types";

const C0 = 0x61707865;
const C1 = 0x3320646e;
const C2 = 0x79622d32;
const C3 = 0x6b206574;

function rotl(value: number, count: number): number {
    return ((value << count) | (value >>> (32 - count))) >>> 0;
}

function quarterRound(s: number[], a: number, b: number, c: number, d: number): void {
    s[b] = ((s[b] ?? 0) ^ rotl(((s[a] ?? 0) + (s[d] ?? 0)) >>> 0, 7)) >>> 0;
    s[c] = ((s[c] ?? 0) ^ rotl(((s[b] ?? 0) + (s[a] ?? 0)) >>> 0, 9)) >>> 0;
    s[d] = ((s[d] ?? 0) ^ rotl(((s[c] ?? 0) + (s[b] ?? 0)) >>> 0, 13)) >>> 0;
    s[a] = ((s[a] ?? 0) ^ rotl(((s[d] ?? 0) + (s[c] ?? 0)) >>> 0, 18)) >>> 0;
}

function doubleRound(s: number[]): void {
    quarterRound(s, 0, 4, 8, 12);
    quarterRound(s, 5, 9, 13, 1);
    quarterRound(s, 10, 14, 2, 6);
    quarterRound(s, 15, 3, 7, 11);
    quarterRound(s, 0, 1, 2, 3);
    quarterRound(s, 5, 6, 7, 4);
    quarterRound(s, 10, 11, 8, 9);
    quarterRound(s, 15, 12, 13, 14);
}

function core(input: number[], doubleRounds: number): number[] {
    const s = [...input];
    for (let i = 0; i < doubleRounds; i += 1) { doubleRound(s); }
    return s;
}

function wordToBytes(word: number): number[] {
    return [word & 0xff, (word >>> 8) & 0xff, (word >>> 16) & 0xff, (word >>> 24) & 0xff];
}

function hsalsa(key: number[], nonce: number[], doubleRounds: number): number[] {
    const state = [
        C0, key[0] ?? 0, key[1] ?? 0, key[2] ?? 0, key[3] ?? 0, C1,
        nonce[0] ?? 0, nonce[1] ?? 0, nonce[2] ?? 0, nonce[3] ?? 0,
        nonce[4] ?? 0, nonce[5] ?? 0, C2, 0, 0, C3,
    ];
    const out = core(state, doubleRounds);
    return [0, 5, 10, 15, 6, 7, 8, 9].map((index) => out[index] ?? 0);
}

function salsaBlock(subkey: number[], nonceTail: number[], counter: number, doubleRounds: number): number[] {
    const state = [
        C0, subkey[0] ?? 0, subkey[1] ?? 0, subkey[2] ?? 0, subkey[3] ?? 0, C1,
        counter & 0xffffffff, 0,
        nonceTail[0] ?? 0, nonceTail[1] ?? 0, C2,
        subkey[4] ?? 0, subkey[5] ?? 0, subkey[6] ?? 0, subkey[7] ?? 0, C3,
    ];
    const out = core(state, doubleRounds);
    const original = state;
    const block: number[] = [];
    for (let i = 0; i < 16; i += 1) {
        block.push(...wordToBytes(((out[i] ?? 0) + (original[i] ?? 0)) >>> 0));
    }
    return block;
}

function makeEntities(bytes: number[], active: number): VisualEntity[] {
    return bytes.map((value, index) => ({
        id: `ks-${index}`,
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
    const task = (input as {
        key?: number[];
        nonce?: number[];
        plaintext?: number[];
        doubleRounds?: number;
    } | null) ?? {};
    const key = task.key ?? [1, 2, 3, 4];
    const nonce = task.nonce ?? [10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21];
    const plaintext = task.plaintext ?? [72, 105, 33, 42, 68, 69, 83, 33];
    const doubleRounds = Math.max(1, Math.min(10, Math.floor(task.doubleRounds ?? 4)));
    const keyWords = [0, 1, 2, 3].map((i) => ((key[i * 4] ?? 0) | ((key[i * 4 + 1] ?? 0) << 8) | ((key[i * 4 + 2] ?? 0) << 16) | ((key[i * 4 + 3] ?? 0) << 24)) >>> 0);
    const nonceWords = Array.from({ length: 6 }, (_, i) => ((nonce[i * 4] ?? 0) | ((nonce[i * 4 + 1] ?? 0) << 8) | ((nonce[i * 4 + 2] ?? 0) << 16) | ((nonce[i * 4 + 3] ?? 0) << 24)) >>> 0);

    const subkey = hsalsa(keyWords, nonceWords.slice(0, 4), doubleRounds);
    let step = 0;
    yield {
        stepNumber: step,
        entities: makeEntities(subkey.slice(0, 8), -1),
        edges: [],
        description: `Derived an eight-word subkey with HSalsa20 using the first half of the 24-byte nonce.`,
        codeLineNumber: 0,
        layout: "array",
        meta: { phase: "hsalsa", subkey: [...subkey], keystream: [] as number[], plaintext: [...plaintext], ciphertext: [] as number[] },
    };
    step += 1;

    const block = salsaBlock(subkey, nonceWords.slice(4), 0, doubleRounds);
    const keystream = block.slice(0, plaintext.length);
    const ciphertext = plaintext.map((value, index) => (value ^ (keystream[index] ?? 0)) & 0xff);
    const recovered = ciphertext.map((value, index) => (value ^ (keystream[index] ?? 0)) & 0xff);

    yield {
        stepNumber: step,
        entities: makeEntities(keystream.length > 0 ? keystream : block.slice(0, 8), -1),
        edges: [],
        description: `Generated a Salsa20 keystream block with the derived subkey and the remaining nonce bytes.`,
        codeLineNumber: 2,
        layout: "array",
        meta: { phase: "salsa", subkey: [...subkey], keystream: [...keystream], plaintext: [...plaintext], ciphertext: [...ciphertext] },
    };
    step += 1;

    yield {
        stepNumber: step,
        entities: makeEntities(ciphertext, -1),
        edges: [],
        description: `XORed ${ciphertext.length} plaintext bytes with the keystream; decrypting restores the plaintext.`,
        codeLineNumber: 5,
        layout: "array",
        meta: { phase: "done", subkey: [...subkey], keystream: [...keystream], plaintext: [...plaintext], ciphertext: [...ciphertext], recovered: [...recovered] },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Salsa20 encrypts by XORing data with a long keystream produced by repeatedly applying a fast round function to a key, nonce, and counter. XSalsa20 widens the nonce to 24 bytes by first mixing the key with half the nonce into a fresh subkey, which lets one key safely cover many more messages.",
        invariants: [
            "HSalsa20 consumes the first sixteen nonce bytes to derive the subkey.",
            "The Salsa20 block function consumes the subkey, the last eight nonce bytes, and a counter.",
            "Encryption and decryption are the same XOR because XOR is its own inverse.",
        ],
        correctness:
            "The Salsa20 block function is deterministic in its key, nonce, and counter, so the same inputs always yield the same keystream. XORing that keystream with a message and XORing again returns the original bytes, which the recovered field verifies for arbitrary inputs.",
        complexityRationale:
            "Each block applies a fixed number of quarter rounds over a sixteen-word state, so generation is O(rounds) per block and O(bytes) overall. State storage is constant in the block size.",
        uses: [
            "High-speed stream encryption in network protocols",
            "Understanding nonce extension through key derivation",
            "Teaching the difference between a block function and a stream keystream",
        ],
        references: [
            "Bernstein, XSalsa20, 2008",
            "Bernstein, The Salsa20 Family of Stream Ciphers, 2008",
        ],
        workedExample:
            "A four-word key and a twelve-word nonce first produce an eight-word subkey through HSalsa20. A Salsa20 block with that subkey, the nonce tail, and counter zero yields keystream bytes that XOR with the plaintext hello to form a ciphertext and XOR back to hello.",
    },
    id: "xsalsa20",
    name: "XSalsa20 Stream Cipher (Toy Model)",
    category: "cryptography-security",
    complexity: { time: "O(bytes + rounds)", space: "O(state)" },
    defaultInput: {
        key: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16],
        nonce: [10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33],
        plaintext: [72, 105, 33, 42, 68, 69, 83, 33],
        doubleRounds: 4,
    },
    visualType: "array",
    run,
    pseudocode: [
        "split the key and the 24-byte nonce into 32-bit words",
        "derive a subkey with HSalsa20 from the key and first nonce half",
        "build the Salsa20 state from subkey, nonce tail, and counter",
        "apply the double rounds to produce a keystream block",
        "XOR the plaintext with the keystream to form ciphertext",
        "XOR the ciphertext again to confirm recovery",
        "report the subkey, keystream, and ciphertext",
    ],
};

export default module;
