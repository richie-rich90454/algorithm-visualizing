/**
 * aes-ccm.ts - CCM Authenticated Encryption Mode (Toy Block Cipher)
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * CCM combines counter-mode encryption with a cipher-block-chaining message
 * authentication code. A short tag is computed over the associated data and
 * the plaintext, then the plaintext is xored with a keystream produced by
 * encrypting consecutive counter blocks. Decryption recomputes the tag over
 * the recovered plaintext before releasing it, so any change to the data or
 * the associated data is detected. The block cipher here is a four-byte toy
 * Feistel-style permutation, so the module teaches the mode, not security.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 *   Time:  O(L) block encryptions for L bytes of input
 *   Space: O(L) for the ciphertext and tag
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 *   - Bars show plaintext bytes, tag bytes, and ciphertext bytes side by side.
 *   - A verified authentication tag is green; a failed one is red.
 *   - meta carries the byte series and the verification verdict.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

function makeSbox(): number[] {
    const box = Array.from({ length: 256 }, (_, i) => i);
    let state = 12345;
    for (let i = 255; i > 0; i -= 1) {
        state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
        const j = state % (i + 1);
        const temp = box[i]!;
        box[i] = box[j]!;
        box[j] = temp;
    }
    return box;
}

const SBOX = makeSbox();

/** Encrypt one four-byte block with the toy block cipher. */
export function toyBlockEncrypt(block: number[], key: number[], rounds = 4): number[] {
    const b = [0, 1, 2, 3].map((i) => (block[i] ?? 0) & 255);
    const k = [0, 1, 2, 3].map((i) => (key[i] ?? 0) & 255);
    for (let round = 0; round < rounds; round += 1) {
        const s = b.map((value, i) => SBOX[(value ^ k[i]!)!]!);
        const first = s[0]!;
        const second = s[1]!;
        const third = s[2]!;
        b[0] = first ^ (s[3]!);
        b[1] = second ^ first;
        b[2] = third ^ second;
        b[3] = s[3]! ^ third ^ first;
    }
    return b.map((value, i) => value ^ k[i]!);
}

/** Generate a counter-mode keystream of the requested length. */
export function makeKeyStream(key: number[], nonce: number[], length: number): number[] {
    const stream: number[] = [];
    let counter = 0;
    while (stream.length < length) {
        const block = [nonce[0] ?? 0, nonce[1] ?? 0, nonce[2] ?? 0, (nonce[3] ?? 0) ^ (counter & 255)];
        stream.push(...toyBlockEncrypt(block, key));
        counter += 1;
    }
    return stream.slice(0, length);
}

function padBlock(bytes: number[]): number[] {
    const block = [0, 0, 0, 0];
    for (let i = 0; i < 4 && i < bytes.length; i += 1) block[i] = bytes[i]! & 255;
    return block;
}

/** Compute the two-byte CBC-MAC tag over associated data and a byte message. */
export function computeTag(key: number[], nonce: number[], associated: number[], message: number[]): number[] {
    let chain = [0, 0, 0, 0];
    const header = padBlock([associated.length & 255, ...nonce.slice(0, 3)]);
    for (const block of [header, ...chunk(associated), ...chunk(message)]) {
        chain = toyBlockEncrypt(block.map((value, i) => value ^ chain[i]!), key);
    }
    return [chain[0]!, chain[1]!];
}

function chunk(bytes: number[]): number[][] {
    const blocks: number[][] = [];
    for (let i = 0; i < bytes.length; i += 4) blocks.push(padBlock(bytes.slice(i, i + 4)));
    return blocks;
}

export interface CcmResult {
    ciphertext: number[];
    tag: number[];
    plaintext: number[];
    verified: boolean;
}

/** Encrypt and immediately decrypt to demonstrate authenticated encryption. */
export function ccmRoundTrip(key: number[], nonce: number[], plaintext: number[], associated: number[]): CcmResult {
    const stream = makeKeyStream(key, nonce, plaintext.length);
    const ciphertext = plaintext.map((value, i) => (value ^ stream[i]!) & 255);
    const tag = computeTag(key, nonce, associated, plaintext);
    const recovered = ciphertext.map((value, i) => (value ^ stream[i]!) & 255);
    const recoveredTag = computeTag(key, nonce, associated, recovered);
    const verified = tag[0] === recoveredTag[0] && tag[1] === recoveredTag[1];
    return { ciphertext, tag, plaintext: recovered, verified };
}

function makeBars(values: number[], labels: string[], active: number, state: EntityState): VisualEntity[] {
    return values.map((value, index) => ({
        id: `bar-${index}`,
        type: "bar" as const,
        label: labels[index] ?? `${value}`,
        value,
        state: index === active ? "comparing" : state,
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { index, role: labels[index] ?? "", value },
    }));
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as {
        plaintext?: number[];
        associated?: number[];
        key?: number[];
        nonce?: number[];
        tamper?: boolean;
    } | null) ?? {};
    const key = [0, 1, 2, 3].map((i) => ((Math.floor(task.key?.[i] ?? i * 31 + 7) % 256) + 256) % 256);
    const nonce = [0, 1, 2, 3].map((i) => ((Math.floor(task.nonce?.[i] ?? i + 1) % 256) + 256) % 256);
    const plaintext = Array.isArray(task.plaintext) && task.plaintext.length > 0
        ? task.plaintext.map((v) => ((Math.floor(Number(v) || 0) % 256) + 256) % 256)
        : [72, 105, 33, 42, 68, 69, 83, 33];
    const associated = Array.isArray(task.associated)
        ? task.associated.map((v) => ((Math.floor(Number(v) || 0) % 256) + 256) % 256)
        : [1, 2, 3];
    const stream = makeKeyStream(key, nonce, plaintext.length);
    const tag = computeTag(key, nonce, associated, plaintext);
    const ciphertext = plaintext.map((value, i) => value ^ stream[i]!);
    const delivered = task.tamper ? ciphertext.map((value, i) => (i === 0 ? value ^ 1 : value)) : ciphertext;
    const recovered = delivered.map((value, i) => value ^ stream[i]!);
    const checkTag = computeTag(key, nonce, associated, recovered);
    const verified = tag[0] === checkTag[0] && tag[1] === checkTag[1];
    let stepNumber = 0;

    yield {
        stepNumber: stepNumber,
        entities: makeBars(plaintext, plaintext.map((_, i) => `p${i}`), -1, "idle"),
        edges: [],
        description: `CCM toy mode over ${plaintext.length} plaintext byte(s) and ${associated.length} associated byte(s).`,
        codeLineNumber: 0,
        layout: "array",
        meta: { plaintext: [...plaintext], tag: [], ciphertext: [], verified: false, toy: true },
    };
    stepNumber += 1;

    yield {
        stepNumber: stepNumber,
        entities: makeBars(tag, ["t0", "t1"], 1, "active"),
        edges: [],
        description: `CBC-MAC over the associated data and plaintext gives tag ${tag.join(", ")}.`,
        codeLineNumber: 1,
        layout: "array",
        meta: { plaintext: [...plaintext], tag, ciphertext: [], verified: false, toy: true },
    };
    stepNumber += 1;

    yield {
        stepNumber: stepNumber,
        entities: makeBars(stream.slice(0, plaintext.length), stream.slice(0, plaintext.length).map((_, i) => `k${i}`), -1, "visited"),
        edges: [],
        description: `Counter mode produces ${stream.length} keystream byte(s) from the toy block cipher.`,
        codeLineNumber: 2,
        layout: "array",
        meta: { plaintext: [...plaintext], tag, ciphertext: [], verified: false, toy: true },
    };
    stepNumber += 1;

    yield {
        stepNumber: stepNumber,
        entities: makeBars(delivered, delivered.map((_, i) => `c${i}`), -1, task.tamper ? "error" : "sorted"),
        edges: [],
        description: `Ciphertext ready${task.tamper ? " with a simulated one-byte tamper" : ""}.`,
        codeLineNumber: 3,
        layout: "array",
        meta: { plaintext: [...plaintext], tag, ciphertext: delivered, verified: false, toy: true },
    };
    stepNumber += 1;

    yield {
        stepNumber: stepNumber,
        entities: makeBars(recovered, recovered.map((_, i) => `r${i}`), -1, verified ? "sorted" : "error"),
        edges: [],
        description: verified
            ? `Tag recomputed over the recovered plaintext matches; verification succeeds.`
            : `Tag mismatch; authentication failed and the plaintext must be discarded.`,
        codeLineNumber: 4,
        layout: "array",
        meta: {
            plaintext: [...plaintext],
            tag,
            checkTag,
            ciphertext: delivered,
            recovered,
            verified: verified ? 1 : 0,
            toy: true,
            done: true,
        },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Encrypt the data with a stream generated from counter blocks, and separately compute a short authentication tag by chaining a block cipher over the associated data and the plaintext. The receiver recomputes the tag from the recovered plaintext and compares. If even one byte changed in transit, the tag will not match.",
        invariants: [
            "Each keystream byte is produced by encrypting a unique counter block.",
            "The tag depends on both the associated data and the plaintext.",
            "Decryption accepts only when the recomputed tag equals the transmitted tag.",
        ],
        correctness:
            "Counter-mode decryption is the xor inverse of encryption because xor with the same keystream twice returns the original byte. The CBC-MAC chain makes every tag byte depend on all preceding blocks, so altering any protected byte changes the tag with high probability. Comparing the recomputed tag before releasing plaintext therefore detects tampering.",
        complexityRationale:
            "Encryption needs one toy block encryption per four keystream bytes and one per message block for the tag, costing time linear in the byte length. The ciphertext, keystream, and tag arrays use linear space.",
        uses: [
            "Authenticated encryption in TLS and wireless standards",
            "Protecting packet payloads together with their headers",
            "Teaching how encryption and authentication compose",
        ],
        references: [
            "RFC 3610, Counter with CBC-MAC (CCM), 2003",
            "NIST SP 800-38C, Recommendation for Block Cipher Modes of Operation: CCM, 2007",
        ],
        workedExample:
            "Take a four-byte plaintext, a four-byte key, and a nonce whose final byte starts the counter. The first counter block is encrypted to give four keystream bytes, which are xored with the plaintext. A CBC-MAC chain over the associated-data header and the plaintext yields a two-byte tag that the receiver recomputes after decrypting.",
    },
    id: "aes-ccm",
    name: "AES-CCM Authenticated Encryption (Toy Core)",
    category: "cryptography-security",
    complexity: { time: "O(L)", space: "O(L)" },
    defaultInput: {
        plaintext: [72, 105, 33, 42, 68, 69, 83, 33],
        associated: [1, 2, 3],
        key: [7, 31, 15, 23],
        nonce: [1, 2, 3, 4],
    },
    visualType: "array",
    run,
    pseudocode: [
        "split the key and nonce into four-byte words",
        "for each counter value encrypt the counter block into keystream",
        "xor the plaintext with the keystream to form ciphertext",
        "chain block encryptions over associated data and plaintext for the tag",
        "transmit ciphertext, associated data, and the short tag",
        "on receipt decrypt with the regenerated keystream",
        "recompute the tag over the recovered plaintext",
        "accept only if the two tags are equal",
        "done: report the verification verdict",
    ],
};

export default module;
