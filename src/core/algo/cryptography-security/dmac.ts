/**
 * dmac.ts - DMAC Message Authentication Code (Toy Block Cipher)
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * DMAC is a two-key variant of CBC-MAC that is secure for messages of varying
 * length. The message is first chained under key K1, then the resulting chain
 * value is appended with a block encoding the message length and chained again
 * under key K2. Appending the length and switching keys defeats the extension
 * attack that breaks plain CBC-MAC when messages have different lengths.
 *
 * The block cipher here is a keyed 16-bit permutation used only to demonstrate
 * the DMAC construction. It is a teaching model, not a production cipher.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(n) block encryptions for n message blocks
 *   Space: O(n) for the displayed block values
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - One bar per message block shows its 16-bit value.
 *   - The block chaining under K1 is highlighted, then the length block under
 *     K2 is highlighted.
 *   - meta tracks the intermediate chain value and the final tag.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface DmacInput {
    message?: string;
    k1?: number;
    k2?: number;
}

const MASK = 0xffff;
const MULTIPLIER = 0x9e37;
const ADDEND = 0x1234;

/** A toy keyed permutation: XOR, odd multiplication, and addition modulo 2^16. */
export function toyEncrypt(key: number, block: number): number {
    const k = key & MASK;
    return ((((block ^ k) * MULTIPLIER) + ADDEND + k) & MASK);
}

/** Chain a list of blocks with CBC under a fixed key. */
export function cbcMac(blocks: number[], key: number): number {
    let chain = 0;
    for (const block of blocks) {
        chain = toyEncrypt(key, chain ^ block);
    }
    return chain;
}

/** Compute the DMAC tag for a message under two distinct keys. */
export function dmac(message: string, k1: number, k2: number): number {
    const blocks = Array.from(message, (ch) => ch.charCodeAt(0) & MASK);
    const inner = cbcMac(blocks, k1);
    return cbcMac([inner, blocks.length & MASK], k2);
}

function makeEntities(blocks: number[], active: number, done: number): VisualEntity[] {
    return blocks.map((value, index) => ({
        id: `block-${index}`,
        type: "bar" as const,
        label: value.toString(16).padStart(4, "0"),
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
    const task = (input as DmacInput | null) ?? {};
    const message = typeof task.message === "string" ? task.message : "authenticate me";
    const k1 = Math.floor(task.k1 ?? 0x1234) & MASK;
    const k2 = Math.floor(task.k2 ?? 0xabcd) & MASK;
    const blocks = Array.from(message, (ch) => ch.charCodeAt(0) & MASK);
    const inner = cbcMac(blocks, k1);
    const tag = dmac(message, k1, k2);
    let step = 0;

    yield {
        stepNumber: step,
        entities: makeEntities(blocks, -1, 0),
        edges: [],
        description: `Computing a DMAC tag over ${blocks.length} block(s) with two different keys.`,
        codeLineNumber: 0,
        layout: "array",
        meta: { blocks: blocks.length, k1, k2, inner: 0, tag: 0 },
    };
    step += 1;

    let chain = 0;
    for (let index = 0; index < blocks.length; index += 1) {
        const block = blocks[index] ?? 0;
        chain = toyEncrypt(k1, chain ^ block);
        yield {
            stepNumber: step,
            entities: makeEntities(blocks, index, index + 1),
            edges: [],
            description: `Block ${index} chained under K1; intermediate chain value is ${chain.toString(16).padStart(4, "0")}.`,
            codeLineNumber: 2,
            layout: "array",
            meta: { blocks: blocks.length, k1, k2, inner: chain, tag: 0 },
        };
        step += 1;
    }

    const afterLength = toyEncrypt(k2, toyEncrypt(k2, inner) ^ (blocks.length & MASK));
    yield {
        stepNumber: step,
        entities: makeEntities(blocks, -1, blocks.length),
        edges: [],
        description: `Length block ${blocks.length} appended and chained under K2; tag is ${afterLength.toString(16).padStart(4, "0")}.`,
        codeLineNumber: 4,
        layout: "array",
        meta: { blocks: blocks.length, k1, k2, inner, tag: afterLength },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Plain CBC-MAC is unsafe when messages can have different lengths: an attacker can extend one valid tag into another. DMAC fixes this by chaining the message under one key, appending the message length, and chaining again under a second key, so knowing a tag for one message gives no way to compute the tag of a longer one.",
        invariants: [
            "Each CBC chain value is a 16-bit block produced by a keyed permutation.",
            "The second chain consumes exactly two blocks: the inner value and the length.",
            "Changing any message block or the message length changes the final tag.",
        ],
        correctness:
            "The toy encrypt function is a bijection because it composes XOR, multiplication by an odd constant, and addition modulo 2^16, all of which are invertible. The two-key, length-appended construction is the provably secure DMAC composition: a forgery on a new length would require predicting the second-key chain on a fresh inner value, which is infeasible with a real block cipher.",
        complexityRationale:
            "Each message block costs one block encryption under K1 and the final step costs two under K2, so the work is O(n) block operations. The visualization keeps one bar per block, giving O(n) space.",
        uses: [
            "Message integrity where messages have variable lengths",
            "Teaching the difference between CBC-MAC, CMAC, and DMAC constructions",
            "A case study in why rekeying and length labels prevent extension attacks",
        ],
        references: [
            "E. Petrank and C. Rackoff, CBC MAC for Real-Time Data Sources, 1997",
            "M. Bellare, R. Guerin, and P. Rogaway, XOR MACs: New Methods for Message Authentication, CRYPTO 1995",
        ],
        workedExample:
            "For the message 'Hi', the two 16-bit blocks 0x0048 and 0x0069 are chained under K1 to an inner value. The length block 2 is appended, and chaining the pair under K2 yields the final tag; changing the message to 'Hi!' changes both the inner value and the length, hence the tag.",
    },
    id: "dmac",
    name: "DMAC Message Authentication Code",
    category: "cryptography-security",
    complexity: { time: "O(n)", space: "O(n)" },
    defaultInput: { message: "authenticate me", k1: 0x1234, k2: 0xabcd },
    visualType: "array",
    run,
    pseudocode: [
        "split the message into fixed-size blocks and set the chain to zero",
        "for each block, chain under the first key with cbc encryption",
        "append a final block that encodes the message length",
        "chain the inner value and the length block under the second key",
        "output the last chain value as the authentication tag",
        "done: the tag authenticates the message under the two keys",
    ],
};

export default module;
