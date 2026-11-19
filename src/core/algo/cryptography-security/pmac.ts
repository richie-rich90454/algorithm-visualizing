/**
 * pmac.ts - Parallelizable Message Authentication Code
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * PMAC computes a message authentication code by masking each block with a
 * distinct value derived from a secret offset, encrypting the masked blocks
 * independently, and xoring the results together before a final keyed step.
 * Because every block can be encrypted in parallel, PMAC is much faster than
 * the serial CBC-MAC on wide hardware while still authenticating the whole
 * message. This teaching model uses an 8-bit toy block cipher and GF(2^8)
 * arithmetic for the masks.
 *
 * NOTE: toy model. The block cipher and 8-bit field are for demonstration
 * only, and the finalization is simplified. This is not a secure MAC.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(m) sequentially, or O(1) depth with m parallel block encryptions
 *   Space: O(m) for the visualized block bars and per-block results
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - One bar per message block; the block just processed is CYAN.
 *   - The final frame shows the tag in GREEN.
 *   - meta carries the secret offset, each block's encrypted value, and the tag.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface PmacInput {
    blocks?: number[];
    key?: number;
}

const MULTIPLIER = 79;
const ADDEND = 55;

function toyEncrypt(key: number, block: number): number {
    return (MULTIPLIER * (((block ^ (key & 0xff)) + 256) & 0xff) + ADDEND) & 0xff;
}

/** Double a field element in GF(2^8) with the AES polynomial. */
function gfDouble(value: number): number {
    const high = value & 0x80;
    const shifted = (value << 1) & 0xff;
    return high ? shifted ^ 0x1b : shifted;
}

function gfMultiply(a: number, b: number): number {
    let result = 0;
    let x = a & 0xff;
    let y = b & 0xff;
    while (y > 0) {
        if (y & 1) {
            result ^= x;
        }
        x = gfDouble(x);
        y >>>= 1;
    }
    return result & 0xff;
}

function grayCode(index: number): number {
    return (index ^ (index >>> 1)) & 0xff;
}

function makeBars(blocks: number[], results: number[], current: number, final: boolean): VisualEntity[] {
    return blocks.map((block, index) => {
        let state: EntityState = "idle";
        if (final) {
            state = "sorted";
        } else if (index === current) {
            state = "active";
        } else if (index < results.length) {
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
            metadata: { index, block, maskedResult: results[index] ?? 0 },
        };
    });
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as PmacInput | null) ?? {};
    const blocks = Array.isArray(task.blocks) && task.blocks.length > 0
        ? task.blocks.map((value) => ((Math.floor(Number(value)) % 256) + 256) % 256)
        : [0x01, 0x02, 0x03, 0x04];
    const key = Math.floor(Number(task.key)) & 0xff || 0x2a;
    const offset = toyEncrypt(key, 0);
    const results: number[] = [];
    let accumulator = 0;

    yield {
        stepNumber: 0,
        entities: makeBars(blocks, results, -1, false),
        edges: [],
        description: `PMAC over ${blocks.length} block(s); the secret offset L is 0x${offset.toString(16).padStart(2, "0")}.`,
        codeLineNumber: 0,
        layout: "array",
        meta: { blocks: blocks.length, key, offset, results, accumulator, tag: -1 },
    };
    let step = 1;

    for (let i = 0; i < blocks.length; i += 1) {
        const gamma = gfMultiply(offset, grayCode(i + 1));
        const result = toyEncrypt(key, (blocks[i] ?? 0) ^ gamma);
        results.push(result);
        accumulator ^= result;
        yield {
            stepNumber: step,
            entities: makeBars(blocks, results, i, false),
            edges: [],
            description: `Block ${i}: mask 0x${gamma.toString(16).padStart(2, "0")}, encrypt to 0x${result.toString(16).padStart(2, "0")}, and xor into the accumulator.`,
            codeLineNumber: 3,
            layout: "array",
            meta: {
                blocks: blocks.length,
                key,
                offset,
                results: [...results],
                accumulator,
                tag: -1,
            },
        };
        step += 1;
    }

    const endMask = toyEncrypt(key, blocks.length);
    const tag = toyEncrypt(key, accumulator ^ endMask);
    yield {
        stepNumber: step,
        entities: makeBars(blocks, results, -1, true),
        edges: [],
        description: `Fold in the block-count mask and encrypt; the tag is 0x${tag.toString(16).padStart(2, "0")}.`,
        codeLineNumber: 6,
        layout: "array",
        meta: { blocks: blocks.length, key, offset, results, accumulator, endMask, tag, toy: true, done: true },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "PMAC makes each block independent. It multiplies a secret offset by a unique Gray-code mask for every block position, encrypts the masked block, and xors all the encrypted pieces together. Because xor is commutative, the encryptions can happen in any order or all at once, which is why PMAC parallelizes while a serial chain like CBC-MAC cannot.",
        invariants: [
            "Each block position uses a distinct mask derived from the secret offset and a Gray code.",
            "The accumulator is the xor of all per-block encrypted values, independent of processing order.",
            "The final tag encrypts the accumulator combined with a block-count mask.",
        ],
        correctness:
            "Gray codes are distinct for distinct block indices and multiplication by a nonzero offset in GF(2^8) is a bijection, so each block receives a unique mask. Xor accumulation is associative and commutative, so processing blocks in any order yields the same accumulator and the same tag. The companion test verifies this order independence, recomputes the tag with an independent iterator, and checks that changing any block changes the tag.",
        complexityRationale:
            "A sequential implementation does one field multiplication and one block encryption per message block, so O(m) time; on parallel hardware the per-block encryptions share O(1) depth. Storing bars and results uses O(m) space.",
        uses: [
            "High-throughput message authentication on parallel processors",
            "Authenticated encryption modes that need a fast MAC",
            "A teaching model contrasting parallel and serial MAC constructions",
        ],
        references: [
            "Rogaway, Black, and Krovetz, OCB and PMAC: Parallelizable Authentication, 2004",
            "NIST SP 800-38B, Recommendation for Block Cipher Modes of Operation: The CMAC Mode",
        ],
        workedExample:
            "With offset L and four blocks, block 1 is masked by L times gray(1), block 2 by L times gray(2), and so on. Each masked block is encrypted, the four results are xored, and that xor is combined with the encryption of the count 4 to produce the tag.",
    },
    id: "pmac",
    name: "PMAC",
    category: "cryptography-security",
    complexity: { time: "O(m) sequential, O(1) parallel depth", space: "O(m)" },
    defaultInput: { blocks: [1, 2, 3, 4], key: 42 },
    visualType: "array",
    run,
    pseudocode: [
        "compute the secret offset by encrypting a zero block",
        "for each message block at position i do",
        "multiply the offset by the gray code of i to get a mask",
        "encrypt the block xored with that mask",
        "xor the encrypted value into the accumulator",
        "combine the accumulator with an encryption of the block count",
        "encrypt once more to obtain the tag",
        "done: report the tag and per-block values",
    ],
};

export default module;
