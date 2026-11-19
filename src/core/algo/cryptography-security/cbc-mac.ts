/**
 * cbc-mac.ts - Cipher Block Chaining Message Authentication Code
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * CBC-MAC authenticates a fixed-length message by running it through cipher
 * block chaining with a zero initialization vector and keeping only the final
 * ciphertext block as the tag. Any change to an earlier block propagates into
 * the final block, so a valid tag is strong evidence the message was not
 * altered. This teaching model uses a small invertible affine permutation as a
 * stand-in for a real 64- or 128-bit block cipher.
 *
 * NOTE: toy model. The block cipher here is a simple affine permutation on
 * 8-bit blocks, not a vetted cipher, and plain CBC-MAC is unsafe for messages
 * of varying length. It demonstrates the construction, not a secure MAC.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(m) for m message blocks
 *   Space: O(m) for the visualized block bars and state history
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - One bar per message block; the block just absorbed is CYAN.
 *   - The final frame shows the tag in GREEN.
 *   - meta carries the chaining state after each block and the tag.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface MacInput {
    blocks?: number[];
    key?: number;
}

const MULTIPLIER = 79;
const ADDEND = 55;

/** A toy keyed permutation of 0..255; an odd multiplier ensures invertibility. */
function toyEncrypt(key: number, block: number): number {
    return (MULTIPLIER * (((block ^ (key & 0xff)) + 256) & 0xff) + ADDEND) & 0xff;
}

function makeBars(blocks: number[], states: number[], current: number, final: boolean): VisualEntity[] {
    return blocks.map((block, index) => {
        let state: EntityState = "idle";
        if (final) {
            state = "sorted";
        } else if (index === current) {
            state = "active";
        } else if (index < states.length - 1) {
            state = "visited";
        }
        return {
            id: `block-${index}`,
            type: "bar" as const,
            label: block.toString(16).padStart(2, "0"),
            value: block,
            state,
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: { index, block, chain: states[index] ?? 0 },
        };
    });
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as MacInput | null) ?? {};
    const blocks = Array.isArray(task.blocks) && task.blocks.length > 0
        ? task.blocks.map((value) => ((Math.floor(Number(value)) % 256) + 256) % 256)
        : [0x01, 0x02, 0x03, 0x04];
    const key = Math.floor(Number(task.key)) & 0xff || 0x2a;
    let chain = 0;
    const states: number[] = [];

    yield {
        stepNumber: 0,
        entities: makeBars(blocks, states, -1, false),
        edges: [],
        description: `CBC-MAC over ${blocks.length} block(s) with key ${key}; the chain starts at zero.`,
        codeLineNumber: 0,
        layout: "array",
        meta: { blocks: blocks.length, key, chain, states, tag: -1 },
    };
    let step = 1;

    for (let i = 0; i < blocks.length; i += 1) {
        chain = toyEncrypt(key, chain ^ (blocks[i] ?? 0));
        states.push(chain);
        yield {
            stepNumber: step,
            entities: makeBars(blocks, states, i, false),
            edges: [],
            description: `Block ${i}: xor 0x${(blocks[i] ?? 0).toString(16)} into the chain and encrypt; chain is now 0x${chain.toString(16).padStart(2, "0")}.`,
            codeLineNumber: 3,
            layout: "array",
            meta: { blocks: blocks.length, key, chain, states: [...states], tag: -1 },
        };
        step += 1;
    }

    yield {
        stepNumber: step,
        entities: makeBars(blocks, states, -1, true),
        edges: [],
        description: `The final chain 0x${chain.toString(16).padStart(2, "0")} is the authentication tag.`,
        codeLineNumber: 6,
        layout: "array",
        meta: { blocks: blocks.length, key, chain, states, tag: chain, toy: true, done: true },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "CBC-MAC chains message blocks together: each block is mixed with the previous ciphertext before being encrypted, and the last ciphertext becomes the tag. Because every block feeds into the next, flipping a bit anywhere changes the final tag. The chain starts from zero so the same key and message always produce the same tag.",
        invariants: [
            "The chaining state begins at zero and is replaced by the encryption of the state xor the current block.",
            "One block is absorbed per step, so after i steps exactly i blocks have been processed.",
            "The final chaining state is the authentication tag.",
        ],
        correctness:
            "The block function is an affine permutation with an odd multiplier modulo 256, so it is invertible and the chain is deterministic. Each step applies the CBC-MAC recurrence exactly, and the last value is the tag by definition. The companion test recomputes the whole chain with an independent loop, verifies that changing any block or the key changes the tag, and checks that appending a block generally changes the tag, illustrating why variable-length CBC-MAC needs a length-aware variant such as CMAC.",
        complexityRationale:
            "Each message block costs one toy encryption and one xor, so m blocks take O(m) time. The bar entities and chain history use O(m) space.",
        uses: [
            "A teaching model for message authentication codes",
            "Understanding cipher block chaining and the Merkle-Damgard style of accumulation",
            "Motivating length-aware constructions such as CMAC and GMAC",
        ],
        references: [
            "NIST SP 800-38B, Recommendation for Block Cipher Modes of Operation: The CMAC Mode",
            "Boneh and Shoup, A Graduate Course in Applied Cryptography, chapter on message authentication codes",
        ],
        workedExample:
            "With key 42 and blocks 01 02 03 04, the chain starts at zero, absorbs 01 to get a new value, then folds in 02, 03, and 04 in turn. The last value is the tag; changing the first block to 05 propagates through all four steps and changes that tag.",
    },
    id: "cbc-mac",
    name: "CBC-MAC",
    category: "cryptography-security",
    complexity: { time: "O(m)", space: "O(m)" },
    defaultInput: { blocks: [1, 2, 3, 4], key: 42 },
    visualType: "array",
    run,
    pseudocode: [
        "set the chaining state to zero",
        "for each message block in order do",
        "xor the block into the current chaining state",
        "encrypt the result with the toy block cipher",
        "use the ciphertext as the new chaining state",
        "after the final block the chaining state is the tag",
        "done: report the authentication tag and state history",
    ],
};

export default module;
