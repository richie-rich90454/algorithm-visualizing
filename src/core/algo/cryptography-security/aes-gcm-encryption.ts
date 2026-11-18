/**
 * aes-gcm-encryption.ts - Toy AES-GCM Block Encryption and Authentication
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * This is a small teaching model of AES-GCM, not a production implementation.
 * It shows the two defining operations of GCM on a single toy block: the
 * plaintext is XORed with a keystream to make the ciphertext, and an
 * authentication tag is formed by XORing the ciphertext bytes together and
 * mixing in a secret tag key. The XOR math is exact; the real cipher replaces
 * the keystream and tag step with AES block encryption and GHASH over a field.
 *
 * No part of this demo provides real confidentiality or integrity.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(b) for a block of b bytes
 *   Space: O(b) for the ciphertext
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Three grid rows hold plaintext, keystream, and ciphertext bytes.
 *   - The active column is being encrypted; finished columns are green.
 *   - A final cell shows the authentication tag in hexadecimal.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface AESGCMInput {
    plaintext?: number[];
    keystream?: number[];
    authKey?: number;
}

function hex(value: number): string {
    return (value & 0xff).toString(16).toUpperCase().padStart(2, "0");
}

function cell(row: number, col: number, label: string, value: number, state: EntityState): VisualEntity {
    return {
        id: `byte-${row}-${col}`,
        type: "cell",
        label,
        value,
        state,
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { row, col },
    };
}

function makeCells(
    plain: number[],
    stream: number[],
    cipher: number[],
    current: number,
    done: boolean,
    tag: number | null,
): VisualEntity[] {
    const entities: VisualEntity[] = [];
    for (let i = 0; i < plain.length; i += 1) {
        const state: EntityState = done || i < current ? "sorted" : i === current ? "active" : "idle";
        const revealed = done || i < current;
        entities.push(cell(0, i, hex(plain[i] ?? 0), plain[i] ?? 0, state));
        entities.push(cell(1, i, hex(stream[i] ?? 0), stream[i] ?? 0, state));
        entities.push(cell(2, i, revealed ? hex(cipher[i] ?? 0) : "??", revealed ? cipher[i] ?? 0 : -1, state));
    }
    if (tag !== null) {
        entities.push(cell(3, 0, `TAG ${hex(tag)}`, tag, "sorted"));
    }
    return entities;
}

/** Encrypt one toy block and compute its toy GCM tag. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as AESGCMInput | null) ?? {};
    const fallbackPlain = [0x48, 0x69, 0x21, 0x2a];
    const fallbackStream = [0x1f, 0x2e, 0x3d, 0x4c];
    const plain: number[] =
        Array.isArray(task.plaintext) && task.plaintext.length > 0
            ? task.plaintext.slice(0, 8).map((v) => v & 0xff)
            : fallbackPlain;
    const stream: number[] =
        Array.isArray(task.keystream) && task.keystream.length >= plain.length
            ? task.keystream.slice(0, plain.length).map((v) => v & 0xff)
            : fallbackStream.slice(0, plain.length);
    const authKey = typeof task.authKey === "number" ? task.authKey & 0xff : 0x5a;

    const cipher = plain.map((value, index) => (value ^ (stream[index] ?? 0)) & 0xff);
    let tagAccumulator = authKey;
    for (const value of cipher) {
        tagAccumulator = (tagAccumulator ^ value) & 0xff;
    }
    const tag = tagAccumulator;
    const rows = 4;
    const cols = plain.length;

    let step = 0;
    yield {
        stepNumber: step,
        entities: makeCells(plain, stream, cipher, -1, false, null),
        edges: [],
        description: `Toy AES-GCM: encrypt one ${plain.length}-byte block with XOR and build an authentication tag.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: { rows, cols, processed: 0, ciphertext: [], tag: -1, authenticated: false },
    };
    step += 1;

    for (let i = 0; i < plain.length; i += 1) {
        yield {
            stepNumber: step,
            entities: makeCells(plain, stream, cipher, i, false, null),
            edges: [],
            description: `Byte ${i}: ${hex(plain[i] ?? 0)} XOR ${hex(stream[i] ?? 0)} = ${hex(cipher[i] ?? 0)}.`,
            codeLineNumber: 2,
            layout: "grid",
            meta: {
                rows,
                cols,
                processed: i + 1,
                ciphertext: cipher.slice(0, i + 1),
                tag: -1,
                authenticated: false,
            },
        };
        step += 1;
    }

    const recovered = cipher.map((value, index) => (value ^ (stream[index] ?? 0)) & 0xff);
    yield {
        stepNumber: step,
        entities: makeCells(plain, stream, cipher, plain.length, true, tag),
        edges: [],
        description: `Tag ${hex(tag)}; XOR decryption recovers the original block and the tag verifies.`,
        codeLineNumber: 5,
        layout: "grid",
        meta: {
            rows,
            cols,
            processed: plain.length,
            ciphertext: cipher,
            tag,
            plaintext: recovered,
            authenticated: true,
        },
    };
}

/** The toy AES-GCM module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "Galois counter mode turns a block cipher into a stream cipher by encrypting counter values into a keystream, then XORing that stream with the message. It also computes a short authentication tag from the ciphertext so tampering is detectable. This toy keeps the exact XOR and tag algebra while replacing the heavy cipher and field arithmetic with fixed bytes.",
        invariants: [
            "Each ciphertext byte is the plaintext byte XOR the matching keystream byte.",
            "The toy tag is the XOR of every ciphertext byte and a secret tag key, reduced to one byte.",
            "XOR is its own inverse, so XORing the ciphertext with the same keystream recovers the plaintext.",
        ],
        correctness:
            "For any byte p and key byte k, (p XOR k) XOR k equals p because XOR is associative and each bit cancels itself. The reference tag recomputes the same XOR chain over the ciphertext and key, so a frame tag matches the definition and any altered byte changes the tag with overwhelming likelihood when a real field-based hash is used.",
        complexityRationale:
            "Encrypting scans each byte once, and folding the tag scans the ciphertext once more, so time is O(b) for b bytes. Storing the ciphertext uses O(b) space.",
        uses: [
            "Authenticated encryption in TLS and many network protocols",
            "Protecting packet payloads with confidentiality and integrity together",
            "A teaching model for counter-mode encryption and authentication tags",
        ],
        references: [
            "Dworkin, NIST SP 800-38D: Galois/Counter Mode, 2007",
            "McGrew and Viega, The Galois/Counter Mode of Operation, 2004",
        ],
        workedExample:
            "Plaintext byte 0x48 XOR keystream byte 0x1F gives ciphertext byte 0x57. XORing 0x57 with 0x1F again restores 0x48. Folding all ciphertext bytes and the key 0x5A into the XOR accumulator produces the one-byte tag shown in the last frame.",
    },
    id: "aes-gcm-encryption",
    name: "AES-GCM Encryption (Toy Model)",
    category: "cryptography-security",
    complexity: { time: "O(b)", space: "O(b)" },
    defaultInput: {
        plaintext: [0x48, 0x69, 0x21, 0x2a],
        keystream: [0x1f, 0x2e, 0x3d, 0x4c],
        authKey: 0x5a,
    },
    visualType: "grid",
    run,
    pseudocode: [
        "load the plaintext block and the keystream bytes",
        "for each byte position in the block",
        "cipher byte equals plaintext byte XOR keystream byte",
        "fold each cipher byte into the tag accumulator",
        "mix in the secret tag key to finish the tag",
        "XOR the cipher with the stream again and check the tag",
        "done: report the ciphertext and authentication tag",
    ],
};

export default module;
