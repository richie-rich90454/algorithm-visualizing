/**
 * argon2id.ts - Toy Argon2id-Style Memory Mixing (Not Cryptographically Secure)
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Full Argon2id needs BLAKE2b, lanes, slices, and multi-pass block compression.
 * This is a clearly labeled toy that keeps only the defining structural idea:
 * a memory array whose blocks are filled by mixing the previous block with a
 * reference block. Early slices choose references from a seeded pseudo-random
 * stream (data-independent), later slices choose them from the previous block's
 * contents (data-dependent), mirroring Argon2id's hybrid index rule. The mixing
 * is a simple rotate-and-xor step, NOT a secure compression function. Do not
 * use it for passwords or any real security purpose.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(m) for m memory blocks
 *   Space: O(m) for the block array
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Four bars show the 32-bit words of the block currently being filled.
 *   - Meta reports the slice, reference index, and whether the reference was
 *     data-dependent or data-independent.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

/** Deterministic 32-bit pseudo-random generator (mulberry32). */
function mulberry32(seed: number) {
    let state = seed >>> 0;
    return () => {
        state = (state + 0x6d2b79f5) >>> 0;
        let value = state;
        value = Math.imul(value ^ (value >>> 15), value | 1);
        value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
        return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
    };
}

/** 32-bit left rotation with the count kept in the valid range. */
function rotl(value: number, bits: number): number {
    const shift = bits & 31;
    return shift === 0 ? value >>> 0 : ((value << shift) | (value >>> (32 - shift))) >>> 0;
}

/** A single pseudo-random 32-bit index source derived from the seed and block. */
function pseudoIndex(seed: number, index: number): number {
    return Math.floor(mulberry32((seed ^ Math.imul(index + 1, 0x9e3779b9)) >>> 0)() * 4294967296) >>> 0;
}

function makeEntities(words: number[], block: number, dataDependent: boolean): VisualEntity[] {
    return words.map((value, index) => ({
        id: `word-${index}`,
        type: "bar" as const,
        label: (value >>> 0).toString(16).padStart(8, "0"),
        value,
        state: (index === 0 ? "active" : "idle") as EntityState,
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { index, block, dataDependent, hex: (value >>> 0).toString(16).padStart(8, "0") },
    }));
}

/** The toy Argon2id generator. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (
        input as { memoryBlocks?: number; seed?: number; passes?: number } | null
    ) ?? {};
    const blocks =
        typeof task.memoryBlocks === "number"
            ? Math.max(1, Math.min(256, Math.floor(task.memoryBlocks)))
            : 16;
    const seed = typeof task.seed === "number" ? Math.floor(task.seed) : 5;
    const passes = typeof task.passes === "number" ? Math.max(1, Math.floor(task.passes)) : 1;

    const memory: number[][] = [];
    memory[0] = Array.from({ length: 4 }, (_, j) =>
        rotl((seed + j * 0x9e3779b9) >>> 0, 3 + 5 * j),
    );

    yield {
        stepNumber: 0,
        entities: makeEntities(memory[0]!, 0, false),
        edges: [],
        description: `TOY Argon2id-style mixing over ${blocks} blocks, seed ${seed}. This is a teaching model, not a secure password hash.`,
        codeLineNumber: 0,
        layout: "array",
        meta: {
            blocks,
            seed,
            passes,
            block: 0,
            slice: 0,
            reference: 0,
            dataDependent: false,
            words: memory[0]!.map((value) => (value >>> 0).toString(16).padStart(8, "0")),
            tag: "",
        },
    };

    let step = 1;
    for (let pass = 0; pass < passes; pass += 1) {
        for (let i = 1; i < blocks; i += 1) {
            const slice = Math.floor(((i % blocks) * 4) / blocks);
            const dataDependent = slice >= 2;
            const previous = memory[i - 1]!;
            const reference = dataDependent
                ? previous[0]! % i
                : pseudoIndex(seed + pass * 7919, i) % i;
            const refBlock = memory[reference]!;
            const current = previous.map((_value, j) =>
                rotl(previous[(j + 1) % 4]! ^ refBlock[j]!, 5 + 3 * j),
            );
            memory[i] = current;

            yield {
                stepNumber: step,
                entities: makeEntities(current, i, dataDependent),
                edges: [],
                description: `Pass ${pass + 1}, block ${i}: slice ${slice} uses a ${dataDependent ? "data-dependent" : "data-independent"} reference ${reference}. Toy rotate-xor mix, not secure.`,
                codeLineNumber: 3,
                layout: "array",
                meta: {
                    blocks,
                    seed,
                    passes,
                    pass: pass + 1,
                    block: i,
                    slice,
                    reference,
                    dataDependent,
                    words: current.map((value) => (value >>> 0).toString(16).padStart(8, "0")),
                    tag: "",
                },
            };
            step += 1;
        }
    }

    const tagWords = [0, 1, 2, 3].map((j) =>
        memory.reduce((acc, block) => acc ^ (block[j] ?? 0), 0) >>> 0,
    );
    const tag = tagWords.map((value) => (value >>> 0).toString(16).padStart(8, "0")).join("");
    yield {
        stepNumber: step,
        entities: makeEntities(tagWords, blocks - 1, false),
        edges: [],
        description: `Toy final tag is the xor of all memory words: ${tag}. This is not a cryptographic authentication tag.`,
        codeLineNumber: 5,
        layout: "array",
        meta: { blocks, seed, passes, block: blocks - 1, dataDependent: false, tag },
    };
}

/** The toy Argon2id module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "Argon2id fills a large memory array so that hashing costs RAM as well as CPU. Its blocks are chained: each new block mixes the previous block with a block chosen by an index rule. The first part of each segment uses a pseudo-random index to resist data-dependent attacks, while the rest derives the index from the data itself to resist trade-off attacks. This toy keeps that alternation but uses a toy mixer.",
        invariants: [
            "Every block after the first mixes the immediately previous block with one reference block.",
            "Slices zero and one use seeded pseudo-random references; slices two and three use data-derived references.",
            "Each 32-bit word is rotated by a fixed amount and combined with xor.",
        ],
        correctness:
            "The demo's mathematical step is exact and independently checkable: given the previous block and the chosen reference, the new words equal rotate-left of (previous[(j+1) mod 4] xor reference[j]) by 5 + 3j bits. The reference index is likewise exact: a seeded pseudo-random value modulo i, or the previous block's first word modulo i. This verifies the toy recurrence, not Argon2id's real BLAKE2b compression or its security.",
        complexityRationale:
            "Each of the m blocks is filled once with four constant-time word operations, so the time is O(m) per pass. The memory array stores m blocks, giving O(m) space.",
        uses: [
            "Teaching why memory-hard functions resist GPU and ASIC attacks",
            "Demonstrating the data-independent versus data-dependent index split",
            "A safe, tiny stand-in for experimenting with block-chaining layouts",
        ],
        references: [
            "Biryukov and Dinu, Argon2: New Generation of Memory-Hard Functions, 2016",
            "Biryukov, Dinu, and Khovratovich, Argon2 Memory-Hard Function Specification, 2017",
        ],
        workedExample:
            "With sixteen blocks, block eight lies in slice two, so its reference is the first word of block seven taken modulo eight. Each output word is the xor of adjacent words from blocks seven and the reference, rotated left by 5, 8, 11, and 14 bits respectively. The final tag is the xor of every memory word.",
    },
    id: "argon2id",
    name: "Argon2id (toy mixing model)",
    category: "cryptography-security",
    complexity: { time: "O(m)", space: "O(m)" },
    defaultInput: { memoryBlocks: 16, seed: 5, passes: 1 },
    visualType: "array",
    run,
    pseudocode: [
        "initialize block zero from the seed",
        "for each later memory block",
        "choose a reference from a seeded stream or the previous block",
        "mix previous and reference words with xor and rotate",
        "store the four resulting words as the new block",
        "xor all memory words into a final tag",
        "done: report the toy tag with a security disclaimer",
    ],
};

export default module;
