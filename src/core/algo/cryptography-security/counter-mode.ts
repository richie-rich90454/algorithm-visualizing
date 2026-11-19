/**
 * counter-mode.ts - Counter Mode (Toy Block Cipher)
 *
 * Counter mode turns a block cipher into a stream cipher. Instead of
 * encrypting the plaintext blocks, it encrypts successive counter values and
 * XORs the resulting keystream with the plaintext. Because encryption and
 * decryption are the same XOR operation, no inverse cipher is needed, and
 * each block can be processed independently. The block cipher here is a
 * small toy permutation; this module is a teaching model, not a production
 * mode of operation.
 *
 * Time:  O(b) for b blocks
 * Space: O(b) for the keystream and ciphertext
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

export interface CtrResult {
    keystream: number[];
    ciphertext: number[];
}

/** Toy block cipher used to expand the counter into a keystream byte. */
export function ctrBlock(counter: number, key: number): number {
    return (((((counter ^ key) * 7) + 13) % 256) + 256) % 256;
}

/** XOR plaintext blocks with the counter-derived keystream. */
export function ctrTransform(blocks: number[], key: number, initialCounter: number): CtrResult {
    const keystream: number[] = [];
    const ciphertext: number[] = [];
    for (let i = 0; i < blocks.length; i += 1) {
        const stream = ctrBlock((initialCounter + i) % 256, key);
        keystream.push(stream);
        ciphertext.push(((blocks[i] ?? 0) ^ stream) % 256);
    }
    return { keystream, ciphertext };
}

function makeCells(
    plaintext: number[],
    keystream: number[],
    ciphertext: number[],
    activeCol: number,
    phase: number,
): VisualEntity[] {
    const rows: Array<[string, number[]]> = [
        ["plain", plaintext],
        ["stream", keystream],
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
        input as { plaintext?: number[]; key?: number; counter?: number } | null
    ) ?? {};
    const plaintext = Array.isArray(task.plaintext) && task.plaintext.length > 0
        ? task.plaintext.map((value) => ((Math.trunc(value) % 256) + 256) % 256)
        : [72, 105, 33, 42];
    const key = typeof task.key === "number" ? ((Math.trunc(task.key) % 256) + 256) % 256 : 91;
    const counter = typeof task.counter === "number" ? ((Math.trunc(task.counter) % 256) + 256) % 256 : 5;
    const result = ctrTransform(plaintext, key, counter);
    const cols = plaintext.length;

    let step = 0;
    yield {
        stepNumber: step,
        entities: makeCells(plaintext, [], [], -1, 0),
        edges: [],
        description: `Counter mode over ${cols} block(s) with key ${key} and starting counter ${counter}.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: { rows: 3, cols, phase: "init", key, counter, plaintext, ciphertext: [] as number[] },
    };
    step += 1;

    for (let i = 0; i < cols; i += 1) {
        const value = (counter + i) % 256;
        yield {
            stepNumber: step,
            entities: makeCells(
                plaintext,
                result.keystream.slice(0, i + 1),
                result.ciphertext.slice(0, i + 1),
                i,
                1,
            ),
            edges: [],
            description: `Block ${i}: encrypt counter ${value} to keystream ${result.keystream[i]}; XOR with plaintext ${plaintext[i]} gives ${result.ciphertext[i]}.`,
            codeLineNumber: 3,
            layout: "grid",
            meta: {
                rows: 3,
                cols,
                phase: "block",
                key,
                counter,
                index: i,
                counterValue: value,
                plaintext,
                ciphertext: result.ciphertext.slice(0, i + 1),
            },
        };
        step += 1;
    }

    const restored = ctrTransform(result.ciphertext, key, counter).ciphertext;
    yield {
        stepNumber: step,
        entities: makeCells(plaintext, result.keystream, result.ciphertext, -1, 2),
        edges: [],
        description: `Keystream ${result.keystream.join(", ")}; applying the same XOR again restores the plaintext.`,
        codeLineNumber: 5,
        layout: "grid",
        meta: {
            rows: 3,
            cols,
            phase: "done",
            key,
            counter,
            plaintext,
            ciphertext: result.ciphertext,
            roundTrip: restored.join(",") === plaintext.join(","),
        },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Counter mode never encrypts the message directly. It encrypts a sequence of counter values to make a keystream, then XORs that stream with the plaintext. Since XOR is its own inverse, decryption runs the exact same routine. Each block depends only on its counter, so blocks can be produced in any order or in parallel.",
        invariants: [
            "Block i uses counter initial counter plus i, reduced modulo two hundred fifty six.",
            "The keystream byte is the toy cipher applied to that counter with the key.",
            "XORing the ciphertext with the same keystream returns the original plaintext byte.",
        ],
        correctness:
            "For each block, ciphertext is plaintext XOR keystream, where keystream is a deterministic function of the counter and key. XORing that ciphertext with the identical keystream gives plaintext because a XOR b XOR b equals a. No inverse of the toy cipher is needed, and equal plaintext bytes at different positions receive different keystream bytes because their counters differ.",
        complexityRationale:
            "Each block takes one toy cipher evaluation and one XOR, so encryption and decryption are linear in the block count. The keystream and ciphertext arrays take linear space, and the counter is the only extra state.",
        uses: [
            "Teaching stream-cipher modes derived from block ciphers",
            "Explaining why counter mode supports parallel encryption",
            "Comparing independent block processing with chained CBC",
        ],
        references: [
            "NIST SP 800-38A, Recommendation for Block Cipher Modes of Operation, 2001",
            "Liskov, Reconsidering CTR, IEEE Security and Privacy, 2004",
        ],
        workedExample:
            "With key ninety one and starting counter five, block zero encrypts counter five into a keystream byte and XORs it with plaintext byte seventy two. Block one repeats with counter six. Feeding the ciphertext back through the same counter sequence returns seventy two and the second byte unchanged.",
    },
    id: "counter-mode",
    name: "Counter Mode (Toy Cipher)",
    category: "cryptography-security",
    complexity: { time: "O(b)", space: "O(b)" },
    defaultInput: { plaintext: [72, 105, 33, 42], key: 91, counter: 5 },
    visualType: "grid",
    run,
    pseudocode: [
        "choose a starting counter and a block key",
        "for each plaintext block compute its counter value",
        "encrypt the counter to obtain a keystream byte",
        "xor the plaintext byte with the keystream byte",
        "emit the ciphertext byte and move to the next counter",
        "for decryption regenerate the same keystream",
        "xor each ciphertext byte with its keystream byte",
        "report the ciphertext and confirm the round trip",
    ],
};

export default module;
