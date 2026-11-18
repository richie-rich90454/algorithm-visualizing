/**
 * rc4-stream-cipher.ts - RC4 Stream Cipher
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * RC4 generates a pseudorandom keystream from a short key and XORs it with the
 * plaintext one byte at a time. The key-scheduling algorithm permutes a 256-byte
 * state box using the key, then the pseudorandom generation algorithm walks the
 * box and emits one byte per step. Encryption and decryption are the same
 * operation because XOR is its own inverse.
 *
 * ---------------------------------------------------------------------------
 * Security note
 * ---------------------------------------------------------------------------
 * This is a faithful implementation of the classical RC4 algorithm, shown for
 * teaching. RC4 has known biases in its keystream and is deprecated for real
 * security use; prefer ChaCha20-Poly1305 or AES-GCM in new systems.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(256 + n) for a message of n bytes
 *   Space: O(256) for the state box
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - One bar per plaintext byte shows the keystream byte used at that position.
 *   - Finished positions are green; the current one is yellow.
 *   - The frame meta exposes the keystream and ciphertext in hexadecimal.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface Rc4Input {
    key?: string;
    plaintext?: string;
}

/** Run the key-scheduling algorithm to build the initial 256-byte permutation. */
export function ksa(key: string): number[] {
    const S = Array.from({ length: 256 }, (_v, i) => i);
    let j = 0;
    for (let i = 0; i < 256; i += 1) {
        j = (j + (S[i] ?? 0) + key.charCodeAt(i % key.length)) % 256;
        const tmp = S[i] ?? 0;
        S[i] = S[j] ?? 0;
        S[j] = tmp;
    }
    return S;
}

/** Generate `count` keystream bytes from a state box (mutates it). */
export function prga(S: number[], count: number): number[] {
    let i = 0;
    let j = 0;
    const stream: number[] = [];
    for (let n = 0; n < count; n += 1) {
        i = (i + 1) % 256;
        j = (j + (S[i] ?? 0)) % 256;
        const tmp = S[i] ?? 0;
        S[i] = S[j] ?? 0;
        S[j] = tmp;
        stream.push(S[((S[i] ?? 0) + (S[j] ?? 0)) % 256] ?? 0);
    }
    return stream;
}

const hex = (value: number): string => value.toString(16).padStart(2, "0");

function makeBars(stream: number[], count: number, revealed: number): VisualEntity[] {
    const entities: VisualEntity[] = [];
    for (let i = 0; i < count; i += 1) {
        const shown = i < revealed;
        const value = shown ? (stream[i] ?? 0) : 0;
        const state: EntityState = shown ? "sorted" : i === revealed ? "comparing" : "idle";
        entities.push({
            id: `bar-${i}`,
            type: "bar",
            label: shown ? hex(value) : "?",
            value,
            state,
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: { index: i },
        });
    }
    return entities;
}

/** The RC4 generator. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as Rc4Input | null) ?? {};
    const key = typeof task.key === "string" && task.key.length > 0 ? task.key : "Key";
    const plaintext = typeof task.plaintext === "string" ? task.plaintext : "Plaintext";
    const bytes = plaintext.split("").map((ch) => ch.charCodeAt(0) & 0xff);
    const stream = prga(ksa(key), bytes.length);
    const cipherBytes = bytes.map((byte, i) => byte ^ (stream[i] ?? 0));
    const plainHex = bytes.map(hex).join("");
    const keystreamHex = stream.map(hex).join("");
    const cipherHex = cipherBytes.map(hex).join("");
    const decrypted = cipherBytes.map((byte, i) => String.fromCharCode(byte ^ (stream[i] ?? 0))).join("");

    let step = 0;
    yield {
        stepNumber: step,
        entities: makeBars(stream, bytes.length, 0),
        edges: [],
        description: `RC4 with ${key.length}-byte key; permuting the 256-byte state box for ${bytes.length} message bytes.`,
        codeLineNumber: 0,
        layout: "array",
        meta: {
            key,
            plaintext,
            bytes: bytes.length,
            processed: 0,
            plaintextHex: plainHex,
            keystreamHex: "",
            ciphertextHex: "",
        },
    };
    step += 1;

    for (let i = 0; i < bytes.length; i += 1) {
        yield {
            stepNumber: step,
            entities: makeBars(stream, bytes.length, i + 1),
            edges: [],
            description: `Byte ${i}: plaintext ${hex(bytes[i] ?? 0)} XOR keystream ${hex(stream[i] ?? 0)} gives ciphertext ${hex(cipherBytes[i] ?? 0)}.`,
            codeLineNumber: i === bytes.length - 1 ? 5 : 3,
            layout: "array",
            meta: {
                key,
                plaintext,
                bytes: bytes.length,
                processed: i + 1,
                plaintextHex: plainHex,
                keystreamHex: stream.slice(0, i + 1).map(hex).join(""),
                ciphertextHex: cipherBytes.slice(0, i + 1).map(hex).join(""),
            },
        };
        step += 1;
    }

    yield {
        stepNumber: step,
        entities: makeBars(stream, bytes.length, bytes.length),
        edges: [],
        description: `Done: ciphertext ${cipherHex}; XOR with the same keystream recovers "${decrypted}".`,
        codeLineNumber: 6,
        layout: "array",
        meta: {
            key,
            plaintext,
            bytes: bytes.length,
            processed: bytes.length,
            plaintextHex: plainHex,
            keystreamHex,
            ciphertextHex: cipherHex,
            decrypted,
            roundTrip: decrypted === plaintext,
            converged: true,
        },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Shuffle a 256-byte table using the secret key, then walk through that table to squeeze out a stream of pseudorandom bytes. XOR each plaintext byte with one keystream byte to encrypt. The receiver repeats the same walk and XORs again, which cancels the keystream and restores the message.",
        invariants: [
            "The state box is always a permutation of the numbers 0 through 255.",
            "One keystream byte is consumed for each plaintext byte.",
            "Encrypting and decrypting use the identical XOR operation.",
        ],
        correctness:
            "The key-scheduling algorithm starts from the identity permutation and only swaps entries, so the box remains a permutation. The generation algorithm swaps two entries before reading the output byte, producing the defined RC4 keystream. Because XOR is associative, self-inverse, and has zero as its identity, ((p XOR k) XOR k) equals p for every byte, so decryption restores the plaintext exactly.",
        complexityRationale:
            "Key scheduling performs 256 swaps regardless of key length, and generation performs a constant number of operations per byte, so the total time is O(256 + n). The 256-entry state box dominates space at O(256).",
        uses: [
            "Historical stream encryption in TLS and WEP",
            "Teaching keystream generation and XOR encryption",
            "Understanding why keystream biases break a cipher",
        ],
        references: [
            "Rivest, The RC4 Encryption Algorithm, 1992",
            "Fluhrer, Mantin, and Shamir, Weaknesses in the Key Scheduling Algorithm of RC4, 2001",
        ],
        workedExample:
            "With key Key and plaintext Plaintext, the keystream begins EB 9F 77 81. The first plaintext byte P is 50 in hexadecimal, and 50 XOR EB gives BB, the first ciphertext byte. The full ciphertext is BB F3 16 E8 D9 40 AF 0A D3.",
    },
    id: "rc4-stream-cipher",
    name: "RC4 Stream Cipher",
    category: "cryptography-security",
    complexity: { time: "O(256 + n)", space: "O(256)" },
    defaultInput: { key: "Key", plaintext: "Plaintext" },
    visualType: "array",
    run,
    pseudocode: [
        "initialize the state box to the identity permutation",
        "for each of 256 positions swap using the key byte",
        "set the two generation pointers to zero",
        "for each plaintext byte advance the pointers and swap",
        "emit the state box entry at the sum of the pointers",
        "xor the keystream byte with the plaintext byte",
        "done: report the ciphertext and the recovered plaintext",
    ],
};

export default module;
