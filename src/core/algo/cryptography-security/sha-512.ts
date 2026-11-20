/**
 * sha-512.ts - SHA-512 Secure Hash Algorithm
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * SHA-512 pads a message into 1024-bit blocks, expands each block into eighty
 * 64-bit schedule words, and runs eighty rounds over an eight-word state. The
 * initial values are the fractional parts of the square roots of the first
 * eight primes and the round constants are the fractional parts of the cube
 * roots of the first eighty primes; both are derived here with integer roots.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(message length)   Space: O(message length) for padded bytes
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Bars show padded message bytes with the active phase highlighted.
 *   - The final frame shows the 64 digest bytes.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface Sha512Input {
    message?: string;
}

const MASK = (1n << 64n) - 1n;

function isqrt(n: bigint): bigint {
    if (n < 2n) return n;
    let x = 1n << BigInt(Math.ceil(n.toString(2).length / 2));
    for (;;) {
        const y = (x + n / x) >> 1n;
        if (y >= x) return x;
        x = y;
    }
}

function icbrt(n: bigint): bigint {
    if (n < 2n) return n;
    let x = 1n << BigInt(Math.ceil(n.toString(2).length / 3));
    for (;;) {
        const y = (2n * x + n / (x * x)) / 3n;
        if (y >= x) return x;
        x = y;
    }
}

function firstPrimes(count: number): number[] {
    const primes: number[] = [];
    for (let n = 2; primes.length < count; n += 1) {
        let prime = true;
        for (const p of primes) {
            if (p * p > n) break;
            if (n % p === 0) {
                prime = false;
                break;
            }
        }
        if (prime) primes.push(n);
    }
    return primes;
}

const PRIMES = firstPrimes(80);
const H0 = PRIMES.slice(0, 8).map((p) => isqrt(BigInt(p) << 128n) & MASK);
const K = PRIMES.map((p) => icbrt(BigInt(p) << 192n) & MASK);

function rotr(x: bigint, n: number): bigint {
    return ((x >> BigInt(n)) | (x << BigInt(64 - n))) & MASK;
}

function smallSigma0(x: bigint): bigint {
    return rotr(x, 1) ^ rotr(x, 8) ^ (x >> 7n);
}

function smallSigma1(x: bigint): bigint {
    return rotr(x, 19) ^ rotr(x, 61) ^ (x >> 6n);
}

function bigSigma0(x: bigint): bigint {
    return rotr(x, 28) ^ rotr(x, 34) ^ rotr(x, 39);
}

function bigSigma1(x: bigint): bigint {
    return rotr(x, 14) ^ rotr(x, 18) ^ rotr(x, 41);
}

function pad(message: string): number[] {
    const bytes: number[] = [];
    for (let i = 0; i < message.length; i += 1) {
        bytes.push(message.charCodeAt(i) & 0xff);
    }
    const bitLength = BigInt(bytes.length) * 8n;
    bytes.push(0x80);
    while (bytes.length % 128 !== 112) {
        bytes.push(0);
    }
    for (let b = 15; b >= 0; b -= 1) {
        bytes.push(Number((bitLength >> BigInt(8 * b)) & 0xffn));
    }
    return bytes;
}

function schedule(bytes: number[], offset: number): bigint[] {
    const w: bigint[] = [];
    for (let i = 0; i < 16; i += 1) {
        let value = 0n;
        for (let j = 0; j < 8; j += 1) {
            value = (value << 8n) | BigInt(bytes[offset + i * 8 + j] ?? 0);
        }
        w.push(value);
    }
    for (let i = 16; i < 80; i += 1) {
        const value =
            smallSigma1(w[i - 2] ?? 0n) + (w[i - 7] ?? 0n) + smallSigma0(w[i - 15] ?? 0n) + (w[i - 16] ?? 0n);
        w.push(value & MASK);
    }
    return w;
}

function hex16(value: bigint): string {
    return value.toString(16).padStart(16, "0");
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
    const task = (input as Sha512Input | null) ?? {};
    const message = typeof task.message === "string" ? task.message : "abc";
    const padded = pad(message);
    const h = H0.slice();
    let step = 0;

    yield {
        stepNumber: step,
        entities: makeBars(padded, "idle"),
        edges: [],
        description: `Padding "${message}" into ${padded.length / 128} SHA-512 block(s).`,
        codeLineNumber: 0,
        layout: "array",
        meta: { step: 0, message, blocks: padded.length / 128 },
    };
    step += 1;

    for (let block = 0; block < padded.length / 128; block += 1) {
        const w = schedule(padded, block * 128);
        let [a, b, c, d, e, f, g, hh] = h;
        for (let p = 0; p < 4; p += 1) {
            for (let i = p * 20; i < (p + 1) * 20; i += 1) {
                const ch = (e & f) ^ (~e & g) & MASK;
                const temp1 = (hh + bigSigma1(e) + ch + (K[i] ?? 0n) + (w[i] ?? 0n)) & MASK;
                const maj = (a & b) ^ (a & c) ^ (b & c);
                const temp2 = (bigSigma0(a) + maj) & MASK;
                hh = g;
                g = f;
                f = e;
                e = (d + temp1) & MASK;
                d = c;
                c = b;
                b = a;
                a = (temp1 + temp2) & MASK;
            }
            yield {
                stepNumber: step,
                entities: makeBars(padded, "active"),
                edges: [],
                description: `Block ${block + 1}, phase ${p + 1}: completed 20 of 80 rounds on 64-bit words.`,
                codeLineNumber: 1 + p,
                layout: "array",
                meta: {
                    step: step,
                    block: block + 1,
                    phase: p + 1,
                    state: [a, b, c, d, e, f, g, hh].map(hex16),
                },
            };
            step += 1;
        }
        h[0] = (h[0] + a) & MASK;
        h[1] = (h[1] + b) & MASK;
        h[2] = (h[2] + c) & MASK;
        h[3] = (h[3] + d) & MASK;
        h[4] = (h[4] + e) & MASK;
        h[5] = (h[5] + f) & MASK;
        h[6] = (h[6] + g) & MASK;
        h[7] = (h[7] + hh) & MASK;
    }

    const digestBytes: number[] = [];
    for (const word of h) {
        for (let j = 7; j >= 0; j -= 1) {
            digestBytes.push(Number((word >> BigInt(8 * j)) & 0xffn));
        }
    }
    const digest = digestBytes.map((value) => value.toString(16).padStart(2, "0")).join("");
    yield {
        stepNumber: step,
        entities: makeBars(digestBytes, "sorted"),
        edges: [],
        description: `SHA-512 digest of "${message}" is ${digest.slice(0, 24)}...`,
        codeLineNumber: 5,
        layout: "array",
        meta: { step, digest, message, state: h.map(hex16) },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "SHA-512 is SHA-2 with 64-bit words. It expands each 1024-bit block into eighty words using two small sigma functions, then repeatedly mixes an eight-word state with two large sigma functions and a choose and majority function. Nothing is reused from a previous block except the running hash.",
        invariants: [
            "All arithmetic is modulo two to the 64 and uses BigInt masking.",
            "The initial words are square-root fractions of the first eight primes.",
            "The round constants are cube-root fractions of the first eighty primes.",
        ],
        correctness:
            "The generator derives the NIST constants with exact integer square and cube roots and follows the FIPS 180-4 round schedule. The companion test checks the official digests of the empty string, abc, and longer phrases byte for byte.",
        complexityRationale:
            "Eighty rounds process each 128-byte block, so time is linear in the padded message length; the padded bytes dominate storage.",
        uses: [
            "Digital signatures and TLS transcript hashing",
            "Password-based key derivation inside PBKDF2-HMAC-SHA512",
            "Integrity checks that need a 512-bit digest",
        ],
        references: [
            "NIST, FIPS 180-4: Secure Hash Standard, 2015",
            "NIST, SP 800-107: Recommendation for Applications Using Approved Hash Algorithms",
        ],
        workedExample:
            "For the empty string the single padded block is processed with all eighty constants derived from the first eighty primes. The eight resulting hash words serialize to cf83e1357eefb8bd through 927da3e, the standard 128-character digest.",
    },
    id: "sha-512",
    name: "SHA-512 Hash",
    category: "cryptography-security",
    complexity: { time: "O(n)", space: "O(n)" },
    defaultInput: { message: "abc" },
    visualType: "array",
    run,
    pseudocode: [
        "pad the message with one, zeroes, and a 128-bit big-endian length",
        "initialize eight 64-bit words from prime square-root fractions",
        "for each 1024-bit block expand sixteen words into eighty",
        "for each of the eighty rounds derive Sigma and choose and majority functions",
        "temp1 = h + Sigma1(e) + ch(e,f,g) + K[i] + W[i]",
        "temp2 = Sigma0(a) + maj(a,b,c) and shift the eight state words",
        "after the block add the working state into the running hash",
        "serialize the eight words big-endian into a 512-bit digest",
    ],
};

export default module;
