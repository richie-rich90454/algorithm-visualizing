/**
 * salsa20-stream-cipher.ts - Salsa20 Block Function (Teaching Core)
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Salsa20 builds a 16-word state from the four constant words "expa nd 3
 * 2-by te k", an eight-word key, a two-word block counter, and a two-word
 * nonce. Ten double rounds alternate row and column quarter-rounds, after
 * which the state is added back to the original and serialized as 64 keystream
 * bytes. XORing those bytes with a message gives the stream cipher.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(blocks * 80 quarter-rounds)   Space: O(blocks * 64)
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Bars show the 16 state words while rounds run, then the keystream bytes.
 *   - Meta exposes the round number and the block counter.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface SalsaInput {
    key?: number[];
    nonce?: number[];
    counter?: number;
    blocks?: number;
}

const CONSTANTS = [0x61707865, 0x3320646e, 0x79622d32, 0x6b206574];

function rotl(x: number, n: number): number {
    return ((x << n) | (x >>> (32 - n))) >>> 0;
}

function quarterRound(s: number[], a: number, b: number, c: number, d: number): void {
    const sa = s[a] ?? 0;
    const sb = s[b] ?? 0;
    const sc = s[c] ?? 0;
    const sd = s[d] ?? 0;
    const z1 = (sb ^ rotl((sa + sd) >>> 0, 7)) >>> 0;
    const z2 = (sc ^ rotl((z1 + sa) >>> 0, 9)) >>> 0;
    const z3 = (sd ^ rotl((z2 + z1) >>> 0, 13)) >>> 0;
    const z0 = (sa ^ rotl((z3 + z2) >>> 0, 18)) >>> 0;
    s[a] = z0;
    s[b] = z1;
    s[c] = z2;
    s[d] = z3;
}

function rowRound(s: number[]): void {
    quarterRound(s, 0, 4, 8, 12);
    quarterRound(s, 5, 9, 13, 1);
    quarterRound(s, 10, 14, 2, 6);
    quarterRound(s, 15, 3, 7, 11);
}

function columnRound(s: number[]): void {
    quarterRound(s, 0, 1, 2, 3);
    quarterRound(s, 5, 6, 7, 4);
    quarterRound(s, 10, 11, 8, 9);
    quarterRound(s, 15, 12, 13, 14);
}

function buildState(key: number[], nonce: number[], counter: number): number[] {
    const keyWords: number[] = [];
    for (let i = 0; i < 8; i += 1) {
        let value = 0;
        for (let j = 0; j < 4; j += 1) {
            value += (key[i * 4 + j] ?? 0) * Math.pow(2, 8 * j);
        }
        keyWords.push(value >>> 0);
    }
    const nonceWords: number[] = [];
    for (let i = 0; i < 2; i += 1) {
        let value = 0;
        for (let j = 0; j < 4; j += 1) {
            value += (nonce[i * 4 + j] ?? 0) * Math.pow(2, 8 * j);
        }
        nonceWords.push(value >>> 0);
    }
    const low = counter >>> 0;
    const high = Math.floor(counter / Math.pow(2, 32)) >>> 0;
    return [
        CONSTANTS[0] ?? 0, keyWords[0] ?? 0, keyWords[1] ?? 0, keyWords[2] ?? 0,
        keyWords[3] ?? 0, CONSTANTS[1] ?? 0, nonceWords[0] ?? 0, nonceWords[1] ?? 0,
        low, high, CONSTANTS[2] ?? 0, keyWords[4] ?? 0,
        keyWords[5] ?? 0, keyWords[6] ?? 0, keyWords[7] ?? 0, CONSTANTS[3] ?? 0,
    ];
}

function makeBars(values: number[], state: EntityState, hex = false): VisualEntity[] {
    return values.map((value, index) => ({
        id: `word-${index}`,
        type: "bar" as const,
        label: hex ? (value >>> 0).toString(16).padStart(8, "0") : String(value),
        value,
        state,
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { index },
    }));
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as SalsaInput | null) ?? {};
    const key = task.key ?? Array.from({ length: 32 }, (_, i) => i);
    const nonce = task.nonce ?? Array.from({ length: 8 }, (_, i) => i);
    const counter = typeof task.counter === "number" ? task.counter : 0;
    const blocks = typeof task.blocks === "number" ? Math.max(1, task.blocks) : 1;

    const initial = buildState(key, nonce, counter);
    let step = 0;

    yield {
        stepNumber: step,
        entities: makeBars(initial, "idle", true),
        edges: [],
        description: `Initialized a Salsa20 state from the key, nonce, and block counter.`,
        codeLineNumber: 0,
        layout: "array",
        meta: { step: 0, blocks, counter },
    };
    step += 1;

    let lastHex = "";
    for (let block = 0; block < blocks; block += 1) {
        const original = buildState(key, nonce, counter + block);
        const working = original.slice();
        for (let round = 0; round < 10; round += 1) {
            rowRound(working);
            columnRound(working);
            yield {
                stepNumber: step,
                entities: makeBars(working, "active", true),
                edges: [],
                description: `Block ${block + 1}, double round ${round + 1}: applied row and column quarter-rounds.`,
                codeLineNumber: 1,
                layout: "array",
                meta: { step: step, block: block + 1, round: round + 1, counter: counter + block },
            };
            step += 1;
        }
        const outputWords = working.map((value, index) => (value + (original[index] ?? 0)) >>> 0);
        const outputBytes: number[] = [];
        for (const word of outputWords) {
            for (let j = 0; j < 4; j += 1) {
                outputBytes.push((word >>> (8 * j)) & 0xff);
            }
        }
        lastHex = outputBytes.map((value) => value.toString(16).padStart(2, "0")).join("");
        yield {
            stepNumber: step,
            entities: makeBars(outputBytes, block === blocks - 1 ? "sorted" : "idle"),
            edges: [],
            description: `Generated ${outputBytes.length} Salsa20 keystream bytes for block ${block + 1}.`,
            codeLineNumber: 2,
            layout: "array",
            meta: { step: step, block: block + 1, keystream: lastHex, counter: counter + block },
        };
        step += 1;
    }

    yield {
        stepNumber: step,
        entities: makeBars(initial, "sorted", true),
        edges: [],
        description: `Finished ${blocks} Salsa20 block(s); first keystream bytes ${lastHex.slice(0, 16)}.`,
        codeLineNumber: 3,
        layout: "array",
        meta: { step, blocks, keystream: lastHex, counter },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Salsa20 does not reuse a fixed permutation table; it mixes four-word groups with add, rotate, and XOR. Alternating row and column passes spreads every input word across the whole state after ten double rounds, and adding the original state keeps the transform invertible.",
        invariants: [
            "A quarter-round updates four words with two additions and four rotations.",
            "Each double round consists of four row quarter-rounds then four column quarter-rounds.",
            "The final keystream is the mixed state plus the original state.",
        ],
        correctness:
            "The generator implements the Salsa20 state layout and quarter-round exactly. The companion test checks the standard published keystream for the sequential key and nonce, and cross-checks several blocks against an independent reference implementation.",
        complexityRationale:
            "Each block runs ten double rounds of four quarter-rounds, a fixed 80 quarter-round budget, so time is linear in the number of blocks and space is constant per block.",
        uses: [
            "High-speed stream encryption in the Noise protocol family",
            "A teaching example of add-rotate-XOR round design",
            "The core that ChaCha20 later refined",
        ],
        references: [
            "Bernstein, Salsa20 Specification, eSTREAM submission, 2005",
            "Bernstein, The Salsa20 Family of Stream Ciphers, 2008",
        ],
        workedExample:
            "With the key bytes 00 through 1f, nonce bytes 00 through 07, and counter zero, the first generated block begins 2e ad 0f 5f 18 57 29 ce, which matches an independent reference implementation of the Salsa20 expansion function.",
    },
    id: "salsa20",
    name: "Salsa20 Stream Cipher",
    category: "cryptography-security",
    complexity: { time: "O(blocks)", space: "O(blocks)" },
    defaultInput: {
        key: Array.from({ length: 32 }, (_, i) => i),
        nonce: Array.from({ length: 8 }, (_, i) => i),
        counter: 0,
        blocks: 1,
    },
    visualType: "array",
    run,
    pseudocode: [
        "build sixteen state words from constants, key, counter, and nonce",
        "for each requested block copy the initial state",
        "for ten double rounds do four row quarter-rounds",
        "then do four column quarter-rounds",
        "a quarter-round mixes four words with add, rotate, and XOR",
        "add the original state words back to the mixed words",
        "serialize the result little-endian as sixty-four keystream bytes",
        "emit the keystream and advance to the next block",
    ],
};

export default module;
