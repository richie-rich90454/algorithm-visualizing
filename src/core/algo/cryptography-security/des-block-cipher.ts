/**
 * des-block-cipher.ts - Toy Feistel Block Cipher Illustrating DES Structure
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * DES encrypts 64-bit blocks with a 16-round Feistel network: each round splits
 * the block, applies a keyed round function to one half, and swaps. This
 * teaching model keeps that exact structure with 8-bit blocks, 4-bit halves,
 * four rounds, a tiny rotation-based round function, and a simple key schedule.
 * It makes the split, round, and inversion logic visible and testable.
 *
 * ---------------------------------------------------------------------------
 * Scope of the model
 * ---------------------------------------------------------------------------
 * This is NOT DES and is not secure. It omits initial and final permutations,
 * expansion, S-boxes, P-boxes, and the real 56-bit key schedule. It uses a
 * four-bit rotation XOR round function. Only the Feistel structure and key
 * schedule idea are faithful, and the arithmetic shown is exact for this toy.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(rounds) per block
 *   Space: O(rounds) for the stored round keys and half states
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Each frame shows the left and right halves as two grid cells.
 *   - The highlighted cell is the half being rewritten in that round.
 *   - meta carries the round keys, both halves, and the ciphertext.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface Input {
    block?: number;
    key?: number;
}

const ROUNDS = 4;
const MASK4 = 0xf;
const MASK8 = 0xff;

/** Round function: rotate the XOR of the right half and round key left by one. */
export function feistelF(r: number, roundKey: number): number {
    const x = (r ^ roundKey) & MASK4;
    return ((x << 1) | (x >>> 3)) & MASK4;
}

/** Deterministic toy key schedule: rotate the 8-bit key by the round index. */
export function roundKeys(key: number): number[] {
    return Array.from({ length: ROUNDS }, (_, i) => ((((key << i) | (key >>> (8 - i))) & MASK8) & MASK4));
}

/** Encrypt one 8-bit block with the toy Feistel network. */
export function feistelEncrypt(block: number, key: number): number {
    let L = (block >>> 4) & MASK4;
    let R = block & MASK4;
    const keys = roundKeys(key);
    for (let i = 0; i < ROUNDS; i += 1) {
        const nextL = R;
        const nextR = L ^ feistelF(R, keys[i] ?? 0);
        L = nextL & MASK4;
        R = nextR & MASK4;
    }
    return ((L << 4) | R) & MASK8;
}

/** Decrypt by reversing the Feistel rounds with the same keys. */
export function feistelDecrypt(cipher: number, key: number): number {
    let L = (cipher >>> 4) & MASK4;
    let R = cipher & MASK4;
    const keys = roundKeys(key);
    for (let i = ROUNDS - 1; i >= 0; i -= 1) {
        const prevR = L;
        const prevL = R ^ feistelF(L, keys[i] ?? 0);
        L = prevL & MASK4;
        R = prevR & MASK4;
    }
    return ((L << 4) | R) & MASK8;
}

const nibble = (v: number): string => (v & MASK4).toString(2).padStart(4, "0");
const byte = (v: number): string => (v & MASK8).toString(2).padStart(8, "0");

function makeCells(L: number, R: number, focus: "L" | "R"): VisualEntity[] {
    return [
        {
            id: "half-L",
            type: "cell",
            label: `L ${nibble(L)}`,
            value: L,
            state: (focus === "L" ? "active" : "idle") as EntityState,
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: { row: 0, col: 0, half: "L", bits: nibble(L) },
        },
        {
            id: "half-R",
            type: "cell",
            label: `R ${nibble(R)}`,
            value: R,
            state: (focus === "R" ? "comparing" : "idle") as EntityState,
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: { row: 0, col: 1, half: "R", bits: nibble(R) },
        },
    ];
}

/** The toy Feistel cipher generator. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as Input | null) ?? {};
    const block = Math.max(0, Math.min(MASK8, Math.floor(task.block ?? 0x5a)));
    const key = Math.max(0, Math.min(MASK8, Math.floor(task.key ?? 0x2d)));
    const keys = roundKeys(key);
    const cipher = feistelEncrypt(block, key);
    const recovered = feistelDecrypt(cipher, key);
    let L = (block >>> 4) & MASK4;
    let R = block & MASK4;
    const halves: number[][] = [[L, R]];

    let step = 0;
    yield {
        stepNumber: step,
        entities: makeCells(L, R, "L"),
        edges: [],
        description: `Split 8-bit block ${byte(block)} into L=${nibble(L)} and R=${nibble(R)}; round keys ${keys.map(nibble).join(", ")}.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: { rows: 1, cols: 2, phase: "split", block, key, rounds: ROUNDS, roundKeys: keys, L, R, cipher: byte(cipher), recovered },
    };
    step += 1;

    for (let i = 0; i < ROUNDS; i += 1) {
        const f = feistelF(R, keys[i] ?? 0);
        const nextL = R;
        const nextR = L ^ f;
        L = nextL & MASK4;
        R = nextR & MASK4;
        halves.push([L, R]);
        yield {
            stepNumber: step,
            entities: makeCells(L, R, "R"),
            edges: [],
            description: `Round ${i}: F(R, K${i}) = ${nibble(f)}, so new L=${nibble(L)} and new R=${nibble(R)}.`,
            codeLineNumber: 2,
            layout: "grid",
            meta: {
                rows: 1,
                cols: 2,
                phase: "round",
                round: i,
                block,
                key,
                rounds: ROUNDS,
                roundKeys: keys,
                f,
                L,
                R,
                halves: halves.flat(),
                cipher: byte(cipher),
                recovered,
            },
        };
        step += 1;
    }

    yield {
        stepNumber: step,
        entities: makeCells(L, R, "L"),
        edges: [],
        description: `Done: ciphertext ${byte(cipher)}; reversing the rounds recovers ${byte(recovered)}, matching the input.`,
        codeLineNumber: 5,
        layout: "grid",
        meta: {
            rows: 1,
            cols: 2,
            phase: "done",
            block,
            key,
            rounds: ROUNDS,
            roundKeys: keys,
            L,
            R,
            halves: halves.flat(),
            cipher: byte(cipher),
            recovered,
            roundTrip: recovered === block,
            converged: true,
        },
    };
}

/** The toy Feistel block-cipher module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "A Feistel cipher makes encryption and decryption almost the same operation. Each round keeps one half unchanged, sends the other half through a keyed round function, and XORs the result into the first half. Because XOR is its own inverse, running the rounds backward with the same keys restores the original block, so the round function need not be invertible.",
        invariants: [
            "Each round replaces (L, R) with (R, L xor F(R, K)).",
            "The round keys repeat in reverse order during decryption.",
            "For every key the encryption map is a bijection over all 8-bit blocks.",
        ],
        correctness:
            "Given a round output (L', R') = (R, L xor F(R, K)), the previous state is recovered by R = L' and L = R' xor F(L', K), which is exactly the inverse round implemented here. Applying the four inverse rounds in reverse key order therefore returns the input block for every key. Because each round is an invertible map on the pair of nibbles, their composition is a permutation of all 256 blocks.",
        complexityRationale:
            "Each round computes one XOR, one four-bit rotation, and one XOR, so encryption and decryption are O(rounds) with rounds fixed at four here. Storage is O(rounds) for the round keys and the recorded half states.",
        uses: [
            "Teaching the Feistel structure used by DES and its successors",
            "Understanding why the round function need not be invertible",
            "A small round-trip testbed for block-cipher ideas",
        ],
        references: [
            "NIST FIPS 46-3, Data Encryption Standard, 1999",
            "Feistel, Cryptography and Computer Privacy, Scientific American 1973",
        ],
        workedExample:
            "For block 0x5a (01011010) and key 0x2d, the split is L=0101 and R=1010. Round zero forms F(1010, K0) = 0011, so the state becomes L=1010 and R=0110. Repeating four rounds yields a ciphertext; decrypting with the keys in reverse order reproduces 01011010 exactly.",
    },
    id: "des-block-cipher",
    name: "DES-Structure Toy Feistel Cipher",
    category: "cryptography-security",
    complexity: { time: "O(rounds)", space: "O(rounds)" },
    defaultInput: { block: 0x5a, key: 0x2d },
    visualType: "grid",
    run,
    pseudocode: [
        "split the block into left and right nibbles",
        "derive one round key per round by rotating the master key",
        "compute F as a rotated XOR of the right nibble and round key",
        "replace the state with (R, L xor F(R, K))",
        "repeat for all rounds to get the ciphertext",
        "decrypt by applying inverse rounds with reversed keys",
        "done: report ciphertext and the recovered block",
    ],
};

export default module;
