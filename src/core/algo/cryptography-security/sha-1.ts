/**
 * sha-1.ts - SHA-1 Secure Hash Algorithm (Historical)
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * SHA-1 pads a message into 512-bit blocks and expands each block into 80
 * 32-bit schedule words. It then runs 80 steps over a five-word state, using
 * four different boolean functions, and adds the resulting state into a
 * running 160-bit hash. SHA-1 has practical collision attacks and is shown as
 * a historical teaching example only, not for security use.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(message length)   Space: O(message length) for padded bytes
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Bars show padded message bytes; the active phase is highlighted.
 *   - The final frame shows the twenty digest bytes.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface Sha1Input {
    message?: string;
}

function rotl(x: number, n: number): number {
    return ((x << n) | (x >>> (32 - n))) >>> 0;
}

function pad(message: string): number[] {
    const bytes: number[] = [];
    for (let i = 0; i < message.length; i += 1) {
        bytes.push(message.charCodeAt(i) & 0xff);
    }
    const bitLength = bytes.length * 8;
    bytes.push(0x80);
    while (bytes.length % 64 !== 56) {
        bytes.push(0);
    }
    for (let b = 7; b >= 0; b -= 1) {
        bytes.push(Math.floor(bitLength / Math.pow(2, 8 * b)) & 0xff);
    }
    return bytes;
}

function schedule(bytes: number[], offset: number): number[] {
    const w: number[] = [];
    for (let i = 0; i < 16; i += 1) {
        let value = 0;
        for (let j = 0; j < 4; j += 1) {
            value = value * 256 + (bytes[offset + i * 4 + j] ?? 0);
        }
        w.push(value >>> 0);
    }
    for (let i = 16; i < 80; i += 1) {
        w.push(rotl((w[i - 3] ?? 0) ^ (w[i - 8] ?? 0) ^ (w[i - 14] ?? 0) ^ (w[i - 16] ?? 0), 1));
    }
    return w;
}

function phase(i: number): { f: number; k: number } {
    if (i < 20) {
        return { f: 0, k: 0x5a827999 };
    }
    if (i < 40) {
        return { f: 1, k: 0x6ed9eba1 };
    }
    if (i < 60) {
        return { f: 2, k: 0x8f1bbcdc };
    }
    return { f: 3, k: 0xca62c1d6 };
}

function mix(f: number, b: number, c: number, d: number): number {
    if (f === 0) return (b & c) | (~b & d);
    if (f === 1) return b ^ c ^ d;
    if (f === 2) return (b & c) | (b & d) | (c & d);
    return b ^ c ^ d;
}

function hex8(value: number): string {
    return (value >>> 0).toString(16).padStart(8, "0");
}

function makeBars(bytes: number[], state: EntityState): VisualEntity[] {
    return bytes.map((value, index) => ({
        id: `byte-${index}`,
        type: "bar" as const,
        label: value.toString(16).padStart(2, "0"),
        value,
        state,
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { index },
    }));
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as Sha1Input | null) ?? {};
    const message = typeof task.message === "string" ? task.message : "abc";
    const padded = pad(message);
    const h = [0x67452301, 0xefcdab89, 0x98badcfe, 0x10325476, 0xc3d2e1f0];
    let step = 0;

    yield {
        stepNumber: step,
        entities: makeBars(padded, "idle"),
        edges: [],
        description: `Padding "${message}" into ${padded.length / 64} SHA-1 block(s).`,
        codeLineNumber: 0,
        layout: "array",
        meta: { step: 0, message, blocks: padded.length / 64 },
    };
    step += 1;

    for (let block = 0; block < padded.length / 64; block += 1) {
        const w = schedule(padded, block * 64);
        let [a, b, c, d, e] = h;
        for (let p = 0; p < 4; p += 1) {
            for (let i = p * 20; i < (p + 1) * 20; i += 1) {
                const { f, k } = phase(i);
                const temp = (rotl(a, 5) + mix(f, b, c, d) + e + k + (w[i] ?? 0)) >>> 0;
                e = d;
                d = c;
                c = rotl(b, 30);
                b = a;
                a = temp;
            }
            yield {
                stepNumber: step,
                entities: makeBars(padded, "active"),
                edges: [],
                description: `Block ${block + 1}, phase ${p + 1}: ran 20 of the 80 schedule steps.`,
                codeLineNumber: 1 + p,
                layout: "array",
                meta: {
                    step: step,
                    block: block + 1,
                    phase: p + 1,
                    state: [hex8(a), hex8(b), hex8(c), hex8(d), hex8(e)],
                },
            };
            step += 1;
        }
        h[0] = (h[0] + a) >>> 0;
        h[1] = (h[1] + b) >>> 0;
        h[2] = (h[2] + c) >>> 0;
        h[3] = (h[3] + d) >>> 0;
        h[4] = (h[4] + e) >>> 0;
    }

    const digestBytes: number[] = [];
    for (const word of h) {
        for (let j = 3; j >= 0; j -= 1) {
            digestBytes.push((word >>> (8 * j)) & 0xff);
        }
    }
    const digest = digestBytes.map((value) => value.toString(16).padStart(2, "0")).join("");
    yield {
        stepNumber: step,
        entities: makeBars(digestBytes, "sorted"),
        edges: [],
        description: `SHA-1 digest of "${message}" is ${digest}.`,
        codeLineNumber: 5,
        layout: "array",
        meta: { step, digest, message, state: h.map(hex8) },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "SHA-1 stretches each 512-bit block into an 80-word schedule, then repeatedly scrambles a five-word state. The mixing function changes every twenty steps so that short and long dependencies both diffuse through the state before the words are added into the final hash.",
        invariants: [
            "The schedule extends the sixteen message words with a rotation of four earlier words.",
            "State arithmetic is 32-bit modular addition and rotation.",
            "Each block adds its final working state back into the running hash.",
        ],
        correctness:
            "The generator follows FIPS 180 step for step, including the four round constants, the four boolean functions, and the big-endian word order. The companion test checks the official digests of the empty string, abc, and several phrases.",
        complexityRationale:
            "Eighty fixed steps process each 64-byte block, so time is linear in message length; memory is dominated by the padded message bytes.",
        uses: [
            "Historical git object identifiers, now being migrated away",
            "A teaching example of a Merkle-Damgard hash with message schedule",
            "Understanding collision attacks on 160-bit digests",
        ],
        references: [
            "NIST, FIPS 180-4: Secure Hash Standard (SHA-1 is historical)",
            "Wang et al., Finding Collisions in the Full SHA-1, CRYPTO 2005",
        ],
        workedExample:
            "The empty message pads to one block. After expanding sixteen words into eighty and running all steps, the five state words serialize to da39a3ee5e6b4b0d3255bfef95601890afd80709.",
    },
    id: "sha-1",
    name: "SHA-1 Hash",
    category: "cryptography-security",
    complexity: { time: "O(n)", space: "O(n)" },
    defaultInput: { message: "abc" },
    visualType: "array",
    run,
    pseudocode: [
        "pad the message with one, zeroes, and a big-endian 64-bit length",
        "initialize five 32-bit hash words h0 through h4",
        "for each 512-bit block expand sixteen words into eighty",
        "for step 0 to 79 select the boolean function and constant",
        "temp = rotl(a,5) + f(b,c,d) + e + k + w[i]",
        "shift b, c, d, e and set a to temp",
        "after the block add the working state into h",
        "serialize h as five big-endian words to get the digest",
    ],
};

export default module;
