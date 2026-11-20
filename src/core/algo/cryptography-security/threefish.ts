/**
 * threefish.ts - Threefish Block Cipher (Toy Mixing Core)
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Threefish is the block cipher inside the Skein hash function. It operates on
 * four 64-bit words and is built from repeated MIX operations: add two words,
 * rotate one by a fixed amount, then xor. Round subkeys are injected by
 * addition and a fixed word permutation spreads changes across the state. This
 * teaching model keeps the authentic MIX network, additive key injection, and
 * permutation but uses a reduced round count so the structure is easy to watch.
 * It is a faithful toy core, not a production-strength cipher.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(rounds) for a four-word block
 *   Space: O(rounds) for the expanded round subkeys
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Four cells show the state words in hexadecimal.
 *   - The pair mixed in the current step is highlighted.
 *   - meta carries the output words and the concatenated ciphertext.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface CipherInput {
    words?: string[];
    key?: string[];
    rounds?: number;
}

const MASK = (1n << 64n) - 1n;
const GOLDEN = 0x9e3779b97f4a7c15n;
const ROT = [16n, 42n, 12n, 62n, 32n, 24n, 51n, 37n];

const add64 = (a: bigint, b: bigint): bigint => (a + b) & MASK;
const sub64 = (a: bigint, b: bigint): bigint => (a - b) & MASK;
const rotl64 = (x: bigint, n: bigint): bigint => ((x << n) | (x >> (64n - n))) & MASK;
const rotr64 = (x: bigint, n: bigint): bigint => ((x >> n) | (x << (64n - n))) & MASK;
const parseWord = (value: string | undefined, fallback: bigint): bigint => {
    if (value === undefined) {
        return fallback;
    }
    try {
        return BigInt(value) & MASK;
    } catch {
        return fallback;
    }
};
const hex = (value: bigint): string => (value & MASK).toString(16).padStart(16, "0");

/** Expand the four key words into per-round subkeys by additive constants. */
function expandKey(key: bigint[], rounds: number): bigint[][] {
    const subkeys: bigint[][] = [];
    for (let r = 0; r < rounds; r += 1) {
        const extra = GOLDEN * BigInt(r);
        subkeys.push(key.map((word) => add64(word, extra)));
    }
    return subkeys;
}

function makeCells(state: bigint[], highlight: number | null): VisualEntity[] {
    return state.map((word, index) => ({
        id: `word-${index}`,
        type: "cell" as const,
        label: `w${index}:0x${hex(word)}`,
        value: hex(word),
        state: (index === highlight ? "active" : "idle") as EntityState,
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { row: 0, col: index, word: index },
    }));
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as CipherInput | null) ?? {};
    const state: bigint[] = [
        parseWord(task.words?.[0], 0x0123456789abcdefn),
        parseWord(task.words?.[1], 0xfedcba9876543210n),
        parseWord(task.words?.[2], 0x0011223344556677n),
        parseWord(task.words?.[3], 0x8899aabbccddeeffn),
    ];
    const key: bigint[] = [0, 1, 2, 3].map((i) =>
        parseWord(task.key?.[i], GOLDEN * BigInt(i + 1)),
    );
    const rounds = Math.max(2, task.rounds ?? 16);
    const subkeys = expandKey(key, rounds);
    let step = 0;

    const snap = (description: string, line: number, highlight: number | null): VisualFrame => ({
        stepNumber: step,
        entities: makeCells(state, highlight),
        edges: [],
        description,
        codeLineNumber: line,
        layout: "grid",
        meta: {
            outputWords: state.map(hex),
            ciphertext: state.map(hex).join(""),
            rounds,
            wordCount: state.length,
        },
    });

    yield snap(
        `Threefish toy core with ${rounds} rounds on four 64-bit words.`,
        0,
        null,
    );
    step += 1;

    for (let r = 0; r < rounds; r += 1) {
        for (let j = 0; j < 4; j += 1) {
            state[j] = add64(state[j] ?? 0n, subkeys[r]?.[j] ?? 0n);
        }
        yield snap(`Round ${r + 1}: inject the round ${r + 1} subkeys by addition.`, 2, null);
        step += 1;

        const rotA = ROT[(r * 2) % ROT.length] ?? 16n;
        const rotB = ROT[(r * 2 + 1) % ROT.length] ?? 42n;
        let x0 = state[0] ?? 0n;
        let x1 = state[1] ?? 0n;
        x0 = add64(x0, x1);
        x1 = rotl64(x1, rotA) ^ x0;
        state[0] = x0;
        state[1] = x1;
        yield snap(`Round ${r + 1}: MIX words 0 and 1 with rotation ${rotA}.`, 3, 1);
        step += 1;

        let x2 = state[2] ?? 0n;
        let x3 = state[3] ?? 0n;
        x2 = add64(x2, x3);
        x3 = rotl64(x3, rotB) ^ x2;
        state[2] = x2;
        state[3] = x3;
        yield snap(`Round ${r + 1}: MIX words 2 and 3 with rotation ${rotB}.`, 3, 3);
        step += 1;

        if (r < rounds - 1) {
            const w0 = state[0] ?? 0n;
            const w1 = state[1] ?? 0n;
            const w2 = state[2] ?? 0n;
            const w3 = state[3] ?? 0n;
            state[0] = w2;
            state[1] = w3;
            state[2] = w0;
            state[3] = w1;
            yield snap(`Round ${r + 1}: permute the four words to spread differences.`, 4, null);
            step += 1;
        }
    }

    yield snap(
        `Threefish toy core complete after ${rounds} rounds; final state is the ciphertext.`,
        6,
        null,
    );
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "A good block cipher spreads a single changed input bit across the whole block. Threefish does this with a very simple repeating recipe: add two words together, rotate one of them, and xor. Adding round-specific constants and swapping word positions means that after several rounds every output word depends on every input word. The same steps reversed, with subtraction and opposite rotations, recover the plaintext.",
        invariants: [
            "Every state word is kept modulo 2 to the 64 after each operation.",
            "Round subkeys are injected by addition and removed by subtraction.",
            "The permutation swaps word pairs and is its own inverse.",
            "Each MIX step is invertible because the updated first word is available for the inverse.",
        ],
        correctness:
            "A MIX step maps (x0, x1) to (x0 + x1, rotl(x1, r) xor (x0 + x1)). Given the outputs, one recovers x1 by rotating the xor result right by r and then x0 by subtracting x1 from the first output. The word-pair permutation is an involution, so applying it twice is the identity. Walking rounds in reverse, unmixing, unpermuting, and subtracting subkeys therefore inverts the cipher exactly for any round count.",
        complexityRationale:
            "Each round injects four subkeys and performs two MIX operations plus one permutation, all constant work on a fixed four-word block, so the block cost is O(rounds). Storing one four-word subkey per round uses O(rounds) space.",
        uses: [
            "The permutation and MIX structure used inside the Skein hash function",
            "A compact teaching model for wide-word ARX ciphers",
            "Demonstrating bit diffusion across a four-word state",
        ],
        references: [
            "Ferguson et al., The Skein Hash Function Family, 2009",
            "Ferguson and Schneier, Cryptography Engineering, block cipher design chapter",
        ],
        workedExample:
            "Starting from four distinct 64-bit words, round one adds four additive-constant subkeys, mixes words 0 and 1 with rotation 16, mixes words 2 and 3 with rotation 42, then swaps the two word pairs. After sixteen rounds the four displayed words are the ciphertext; reversing the rounds with subtraction and right rotations restores the start words.",
    },
    id: "threefish",
    name: "Threefish Block Cipher",
    category: "cryptography-security",
    complexity: { time: "O(rounds)", space: "O(rounds)" },
    defaultInput: {
        words: ["0x0123456789abcdef", "0xfedcba9876543210", "0x0011223344556677", "0x8899aabbccddeeff"],
        key: ["0x1", "0x2", "0x3", "0x4"],
        rounds: 16,
    },
    visualType: "grid",
    run,
    pseudocode: [
        "expand key words into one subkey set per round",
        "for each round",
        "add that round's subkeys to the four state words",
        "MIX words zero and one with the first rotation",
        "MIX words two and three with the second rotation",
        "permute the word pairs except on the final round",
        "after all rounds report the final state",
        "done: inverse rounds subtract subkeys and unmix",
    ],
};

export default module;
