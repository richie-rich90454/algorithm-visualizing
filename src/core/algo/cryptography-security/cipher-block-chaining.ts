/**
 * cipher-block-chaining.ts - Cipher Block Chaining (Toy Block Cipher)
 *
 * CBC links each plaintext block to the previous ciphertext block before
 * encryption, so identical plaintext blocks do not produce identical
 * ciphertext blocks. Decryption reverses the link by XORing each decrypted
 * block with the preceding ciphertext block. The block cipher here is a
 * small invertible permutation on bytes, chosen so every step can be checked
 * by hand. It is a teaching model, not a production cipher or mode.
 *
 * Time:  O(b) for b blocks
 * Space: O(b) for the ciphertext
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

export interface CbcResult {
    ciphertext: number[];
    xors: number[];
}

/** Toy invertible byte cipher: multiply by seven, then add thirteen. */
export function toyEncryptByte(block: number, key: number): number {
    return ((((block ^ key) * 7) + 13) % 256 + 256) % 256;
}

/** Inverse of the toy byte cipher; seven's inverse modulo 256 is 183. */
export function toyDecryptByte(block: number, key: number): number {
    return ((((block - 13 + 256) * 183) % 256 + 256) % 256) ^ key;
}

/** Encrypt byte blocks with CBC using the given initialization vector. */
export function cbcEncrypt(plaintext: number[], key: number, iv: number): CbcResult {
    const ciphertext: number[] = [];
    const xors: number[] = [];
    let previous = ((iv % 256) + 256) % 256;
    for (const plain of plaintext) {
        const xor = (((plain ^ previous) % 256) + 256) % 256;
        const cipher = toyEncryptByte(xor, key);
        xors.push(xor);
        ciphertext.push(cipher);
        previous = cipher;
    }
    return { ciphertext, xors };
}

/** Decrypt CBC byte blocks back to the original plaintext. */
export function cbcDecrypt(ciphertext: number[], key: number, iv: number): number[] {
    const plaintext: number[] = [];
    let previous = ((iv % 256) + 256) % 256;
    for (const cipher of ciphertext) {
        const xor = toyDecryptByte(cipher, key);
        plaintext.push((xor ^ previous) % 256);
        previous = cipher;
    }
    return plaintext;
}

function makeCells(
    plaintext: number[],
    xors: number[],
    ciphertext: number[],
    activeCol: number,
    phase: number,
): VisualEntity[] {
    const rows: Array<[string, number[]]> = [
        ["plain", plaintext],
        ["xor", xors],
        ["cipher", ciphertext],
    ];
    const entities: VisualEntity[] = [];
    rows.forEach(([name, values], row) => {
        for (let col = 0; col < plaintext.length; col += 1) {
            const value = values[col] ?? 0;
            const state: EntityState =
                phase === 2
                    ? "sorted"
                    : col === activeCol
                      ? "active"
                      : col < activeCol
                        ? "visited"
                        : "idle";
            entities.push({
                id: `cell-${row}-${col}`,
                type: "cell" as const,
                label: String(value),
                value,
                state,
                x: 0,
                y: 0,
                width: 0,
                height: 0,
                metadata: { row, col, role: name, value },
            });
        }
    });
    return entities;
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (
        input as { plaintext?: number[]; key?: number; iv?: number } | null
    ) ?? {};
    const plaintext = Array.isArray(task.plaintext) && task.plaintext.length > 0
        ? task.plaintext.map((value) => ((Math.trunc(value) % 256) + 256) % 256)
        : [72, 105, 33, 42];
    const key = typeof task.key === "number" ? ((Math.trunc(task.key) % 256) + 256) % 256 : 91;
    const iv = typeof task.iv === "number" ? ((Math.trunc(task.iv) % 256) + 256) % 256 : 17;
    const result = cbcEncrypt(plaintext, key, iv);
    const cols = plaintext.length;

    let step = 0;
    yield {
        stepNumber: step,
        entities: makeCells(plaintext, [], [], -1, 0),
        edges: [],
        description: `CBC over ${cols} byte block(s) with key ${key} and initialization vector ${iv}.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: { rows: 3, cols, phase: "init", key, iv, plaintext, ciphertext: [] as number[] },
    };
    step += 1;

    for (let i = 0; i < cols; i += 1) {
        const previous = i === 0 ? iv : (result.ciphertext[i - 1] ?? 0);
        yield {
            stepNumber: step,
            entities: makeCells(
                plaintext,
                result.xors.slice(0, i + 1),
                result.ciphertext.slice(0, i + 1),
                i,
                1,
            ),
            edges: [],
            description:
                `Block ${i}: plaintext ${plaintext[i]} XOR previous ${previous} = ${result.xors[i]}; encrypt to ${result.ciphertext[i]}.`,
            codeLineNumber: i === 0 ? 2 : 4,
            layout: "grid",
            meta: {
                rows: 3,
                cols,
                phase: "block",
                key,
                iv,
                index: i,
                previous,
                plaintext,
                ciphertext: result.ciphertext.slice(0, i + 1),
            },
        };
        step += 1;
    }

    const restored = cbcDecrypt(result.ciphertext, key, iv);
    yield {
        stepNumber: step,
        entities: makeCells(plaintext, result.xors, result.ciphertext, -1, 2),
        edges: [],
        description: `Ciphertext ${result.ciphertext.join(", ")} decrypts back to the original plaintext.`,
        codeLineNumber: 6,
        layout: "grid",
        meta: {
            rows: 3,
            cols,
            phase: "done",
            key,
            iv,
            plaintext,
            ciphertext: result.ciphertext,
            roundTrip: restored.join(",") === plaintext.join(","),
        },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "CBC makes each ciphertext block depend on everything before it. Before encrypting a block, the plaintext is XORed with the previous ciphertext block, so even two identical plaintext blocks produce different ciphertext. The first block uses an initialization vector in place of a previous block. Decryption undoes the cipher and then XORs with that same previous ciphertext block.",
        invariants: [
            "The first XOR uses the initialization vector; every later XOR uses the preceding ciphertext block.",
            "Each toy block cipher output is a byte in zero to two hundred fifty five.",
            "Decrypting a block and XORing with the previous ciphertext recovers the original plaintext byte.",
        ],
        correctness:
            "The toy cipher is invertible because multiplying by seven permutes the bytes modulo two hundred fifty six and multiplying by one hundred eighty three undoes it, after which subtracting thirteen is reversed by adding thirteen. For block i, decryption computes the pre-XOR value and XORs it with the same previous ciphertext used during encryption, so the XOR cancels and the original plaintext byte is recovered. Induction from block zero proves the whole message round-trips.",
        complexityRationale:
            "Encryption and decryption each perform one XOR and one toy cipher operation per block, so both take linear time in the number of blocks. The ciphertext and the intermediate XOR values occupy linear space; only one previous block is kept as running state.",
        uses: [
            "Teaching the difference between block ciphers and modes of operation",
            "Explaining why initialization vectors must be unpredictable",
            "Comparing chained modes with stateless counter mode",
        ],
        references: [
            "NIST SP 800-38A, Recommendation for Block Cipher Modes of Operation, 2001",
            "Dworkin, Block Cipher Modes of Operation, NIST, 2001",
        ],
        workedExample:
            "With plaintext bytes seventy two and one hundred five, key ninety one, and vector seventeen, the first XOR is seventy two XOR seventeen. That result is multiplied by seven, shifted by thirteen, and reduced modulo two hundred fifty six to give the first ciphertext byte, which then becomes the chaining value for the second byte.",
    },
    id: "cipher-block-chaining",
    name: "Cipher Block Chaining (Toy Cipher)",
    category: "cryptography-security",
    complexity: { time: "O(b)", space: "O(b)" },
    defaultInput: { plaintext: [72, 105, 33, 42], key: 91, iv: 17 },
    visualType: "grid",
    run,
    pseudocode: [
        "set the chaining value to the initialization vector",
        "for each plaintext block compute block XOR chaining value",
        "encrypt that XOR value with the toy block cipher",
        "emit the ciphertext block and save it as the chaining value",
        "for decryption invert the toy cipher on each block",
        "xor the result with the previous ciphertext block",
        "save the ciphertext block and continue to the next",
        "report the ciphertext and confirm the round trip",
    ],
};

export default module;
