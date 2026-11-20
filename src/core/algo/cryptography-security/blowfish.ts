/**
 * blowfish.ts - Blowfish-Style Feistel Core (Small Teaching Model)
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * This is a teaching model of Blowfish, not the production cipher and not for
 * security use. It keeps the defining structure: an 18-word P array, four
 * 256-word S-boxes, a function F that adds and XORs four S-box lookups, and a
 * sixteen-round Feistel network with a final pair of whitening words. Only the
 * source of the constants differs: the arrays come from a deterministic linear
 * generator here instead of the hexadecimal digits of pi.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(rounds) per block plus one-time table setup   Space: O(1030)
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Bars show the eight block bytes after each Feistel round.
 *   - The final frame shows the ciphertext or recovered plaintext.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface BlowfishInput {
    block?: number[];
    key?: number[];
    rounds?: number;
    mode?: "encrypt" | "decrypt";
}

interface State {
    p: number[];
    s: number[][];
}

function buildState(key: number[]): State {
    let seed = 0x243f6a88;
    const next = (): number => {
        seed = (Math.imul(seed, 0x41c64e6d) + 0x3039) >>> 0;
        return seed;
    };
    const p = Array.from({ length: 18 }, () => next());
    const s = Array.from({ length: 4 }, () => Array.from({ length: 256 }, () => next()));
    for (let i = 0; i < 18; i += 1) {
        p[i] = ((p[i] ?? 0) ^ (key[i % key.length] ?? 0) * 0x01010101) >>> 0;
    }
    return { p, s };
}

function fFunction(state: State, x: number): number {
    const a = (x >>> 24) & 0xff;
    const b = (x >>> 16) & 0xff;
    const c = (x >>> 8) & 0xff;
    const d = x & 0xff;
    const first = ((state.s[0]?.[a] ?? 0) + (state.s[1]?.[b] ?? 0)) >>> 0;
    const second = (first ^ (state.s[2]?.[c] ?? 0)) >>> 0;
    return ((second + (state.s[3]?.[d] ?? 0)) >>> 0) & 0xffffffff;
}

function toWords(block: number[]): [number, number] {
    let left = 0;
    let right = 0;
    for (let i = 0; i < 4; i += 1) {
        left |= (block[i] ?? 0) << (8 * i);
        right |= (block[4 + i] ?? 0) << (8 * i);
    }
    return [left >>> 0, right >>> 0];
}

function fromWords(left: number, right: number): number[] {
    const out: number[] = [];
    for (let i = 0; i < 4; i += 1) {
        out.push((left >>> (8 * i)) & 0xff);
    }
    for (let i = 0; i < 4; i += 1) {
        out.push((right >>> (8 * i)) & 0xff);
    }
    return out;
}

function makeBars(bytes: number[], state: EntityState): VisualEntity[] {
    return bytes.map((value, index) => ({
        id: `byte-${index}`,
        type: "bar" as const,
        label: value.toString(16).padStart(2, "0"),
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
    const task = (input as BlowfishInput | null) ?? {};
    const key = task.key ?? [1, 2, 3, 4, 5, 6, 7, 8];
    const rounds = typeof task.rounds === "number" ? Math.max(1, Math.min(16, task.rounds)) : 16;
    const mode = task.mode === "decrypt" ? "decrypt" : "encrypt";
    const block = [...(task.block ?? [0, 1, 2, 3, 4, 5, 6, 7])];
    const state = buildState(key);
    let [left, right] = toWords(block);
    let step = 0;

    yield {
        stepNumber: step,
        entities: makeBars(block, "idle"),
        edges: [],
        description: `Starting Blowfish-style ${mode} with ${rounds} Feistel rounds and a generated P array.`,
        codeLineNumber: 0,
        layout: "array",
        meta: { step: 0, mode, rounds, pWords: state.p.length, sWords: state.s.flat().length },
    };
    step += 1;

    const order =
        mode === "encrypt"
            ? Array.from({ length: rounds }, (_, i) => i)
            : Array.from({ length: rounds }, (_, i) => rounds + 1 - i);
    for (const round of order) {
        left = (left ^ (state.p[round] ?? 0)) >>> 0;
        right = (right ^ fFunction(state, left)) >>> 0;
        const temp = left;
        left = right;
        right = temp;
        const bytes = fromWords(left, right);
        yield {
            stepNumber: step,
            entities: makeBars(bytes, "active"),
            edges: [],
            description: `Feistel step ${step}: whitened L with P[${round}] and combined F(L) with R.`,
            codeLineNumber: 2,
            layout: "array",
            meta: { step: step, round: round + 1, left, right },
        };
        step += 1;
    }
    const temp = left;
    left = right;
    right = temp;
    if (mode === "encrypt") {
        right = (right ^ (state.p[rounds] ?? 0)) >>> 0;
        left = (left ^ (state.p[rounds + 1] ?? 0)) >>> 0;
    } else {
        right = (right ^ (state.p[1] ?? 0)) >>> 0;
        left = (left ^ (state.p[0] ?? 0)) >>> 0;
    }

    const output = fromWords(left, right);
    yield {
        stepNumber: step,
        entities: makeBars(output, "sorted"),
        edges: [],
        description: `Finished Blowfish-style ${mode}; output ${output.map((v) => v.toString(16).padStart(2, "0")).join("")}.`,
        codeLineNumber: 5,
        layout: "array",
        meta: { step, mode, output, rounds },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Blowfish encrypts with a sixteen-round Feistel network whose round function looks up four bytes in four large S-boxes, adding two lookups and XORing the other two. The P array and S boxes are key dependent, and decryption runs the same rounds with the P entries in reverse order.",
        invariants: [
            "Each round whitens the left word with one P entry and mixes F into the right.",
            "F combines four S-box lookups with additions and XORs modulo two to the 32.",
            "The final two P entries are applied after undoing the last swap.",
        ],
        correctness:
            "This teaching model implements the Blowfish round and final-whitening steps exactly. The companion test replays the same table generation and rounds independently, checks encrypt then decrypt round-trips, and verifies that changing the key changes the output.",
        complexityRationale:
            "A round does four table lookups, so encryption is O(rounds); the P array and S boxes use 1030 words of space.",
        uses: [
            "A teaching example of key-dependent S boxes",
            "Understanding Feistel decryption with final whitening",
            "Studying the add-XOR-add mixing used in F",
        ],
        references: [
            "Schneier, Blowfish: A Fast New Block Cipher, 1993",
            "Menezes, Oorschot, and Vanstone, Handbook of Applied Cryptography, Ch. 7",
        ],
        workedExample:
            "With the default key the first round XORs P[0] into the left word and F(left) into the right word, then swaps them. After sixteen such rounds the last swap is undone and P[16] and P[17] are applied to produce the ciphertext words.",
    },
    id: "blowfish",
    name: "Blowfish (Teaching Core)",
    category: "cryptography-security",
    complexity: { time: "O(rounds)", space: "O(1030)" },
    defaultInput: {
        block: [0, 1, 2, 3, 4, 5, 6, 7],
        key: [1, 2, 3, 4, 5, 6, 7, 8],
        rounds: 16,
        mode: "encrypt",
    },
    visualType: "array",
    run,
    pseudocode: [
        "initialize the 18-word P array and four 256-word S boxes deterministically",
        "mix key bytes into the P array to form the round keys",
        "encryption: for each round XOR P[i] into L and F(L) into R, then swap",
        "decryption: walk the same rounds with P entries in reverse order",
        "F(L) = (S0[a] + S1[b]) xor S2[c] plus S3[d] modulo two to the 32",
        "undo the final swap and XOR the last two P entries into R and L",
        "reassemble the two words into eight bytes",
        "emit the ciphertext or the recovered plaintext",
    ],
};

export default module;
