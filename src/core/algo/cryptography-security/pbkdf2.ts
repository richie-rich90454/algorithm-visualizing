/**
 * pbkdf2.ts - PBKDF2 with HMAC-SHA256
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * PBKDF2 stretches a password into a derived key by repeatedly applying a
 * pseudorandom function, here HMAC-SHA256. For each output block it seeds with
 * the salt plus a block index, computes U1 = HMAC(password, seed), then folds
 * U2 = HMAC(password, U1), and so on, XOR-ing all U values into the block. A
 * large iteration count makes each guess expensive for an attacker. SHA-256,
 * HMAC-SHA256, and PBKDF2 are implemented here in full and match standard test
 * vectors.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(blocks * iterations) HMAC-SHA256 evaluations
 *   Space: O(blocks * 32) bytes for the derived key
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Bars show the derived-key bytes at each checkpoint.
 *   - meta carries the derived key in hexadecimal for verification.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface Input {
    password?: string;
    salt?: string;
    iterations?: number;
    dkLen?: number;
}

const K = [
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
];
const H0 = [
    0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19,
];

const rotr = (x: number, n: number): number => ((x >>> n) | (x << (32 - n))) >>> 0;

/** Full SHA-256 of a byte array, returned as 32 bytes. */
function sha256(bytes: number[]): number[] {
    const padded = bytes.slice();
    padded.push(0x80);
    while (padded.length % 64 !== 56) {
        padded.push(0);
    }
    const bitLen = bytes.length * 8;
    const high = Math.floor(bitLen / 0x100000000);
    const low = bitLen >>> 0;
    for (let i = 3; i >= 0; i -= 1) {
        padded.push(Math.floor(high / 2 ** (8 * i)) & 0xff);
    }
    for (let i = 3; i >= 0; i -= 1) {
        padded.push(Math.floor(low / 2 ** (8 * i)) & 0xff);
    }

    const h = H0.slice();
    const w = new Array<number>(64).fill(0);
    for (let offset = 0; offset < padded.length; offset += 64) {
        for (let i = 0; i < 16; i += 1) {
            const j = offset + i * 4;
            w[i] = (((padded[j] ?? 0) << 24) | ((padded[j + 1] ?? 0) << 16) | ((padded[j + 2] ?? 0) << 8) | (padded[j + 3] ?? 0)) >>> 0;
        }
        for (let i = 16; i < 64; i += 1) {
            const s0 = rotr(w[i - 15] ?? 0, 7) ^ rotr(w[i - 15] ?? 0, 18) ^ ((w[i - 15] ?? 0) >>> 3);
            const s1 = rotr(w[i - 2] ?? 0, 17) ^ rotr(w[i - 2] ?? 0, 19) ^ ((w[i - 2] ?? 0) >>> 10);
            w[i] = (((w[i - 16] ?? 0) + s0 + (w[i - 7] ?? 0) + s1) >>> 0);
        }
        let [a, b, c, d, e, f, g, hh] = h;
        for (let i = 0; i < 64; i += 1) {
            const S1 = rotr(e ?? 0, 6) ^ rotr(e ?? 0, 11) ^ rotr(e ?? 0, 25);
            const ch = (((e ?? 0) & (f ?? 0)) ^ (~(e ?? 0) & (g ?? 0))) >>> 0;
            const t1 = (hh ?? 0) + S1 + ch + (K[i] ?? 0) + (w[i] ?? 0);
            const S0 = rotr(a ?? 0, 2) ^ rotr(a ?? 0, 13) ^ rotr(a ?? 0, 22);
            const maj = (((a ?? 0) & (b ?? 0)) ^ ((a ?? 0) & (c ?? 0)) ^ ((b ?? 0) & (c ?? 0))) >>> 0;
            const t2 = S0 + maj;
            hh = g;
            g = f;
            f = e;
            e = ((d ?? 0) + t1) >>> 0;
            d = c;
            c = b;
            b = a;
            a = (t1 + t2) >>> 0;
        }
        h[0] = ((h[0] ?? 0) + (a ?? 0)) >>> 0;
        h[1] = ((h[1] ?? 0) + (b ?? 0)) >>> 0;
        h[2] = ((h[2] ?? 0) + (c ?? 0)) >>> 0;
        h[3] = ((h[3] ?? 0) + (d ?? 0)) >>> 0;
        h[4] = ((h[4] ?? 0) + (e ?? 0)) >>> 0;
        h[5] = ((h[5] ?? 0) + (f ?? 0)) >>> 0;
        h[6] = ((h[6] ?? 0) + (g ?? 0)) >>> 0;
        h[7] = ((h[7] ?? 0) + (hh ?? 0)) >>> 0;
    }
    const out: number[] = [];
    for (const word of h) {
        out.push((word >>> 24) & 0xff, (word >>> 16) & 0xff, (word >>> 8) & 0xff, word & 0xff);
    }
    return out;
}

/** HMAC-SHA256 with a 64-byte block size. */
function hmacSha256(keyBytes: number[], message: number[]): number[] {
    let key = keyBytes.slice();
    if (key.length > 64) {
        key = sha256(key);
    }
    while (key.length < 64) {
        key.push(0);
    }
    const inner = key.map((b) => b ^ 0x36).concat(message);
    const outer = key.map((b) => b ^ 0x5c);
    return sha256(outer.concat(sha256(inner)));
}

const utf8 = (text: string): number[] => Array.from(new TextEncoder().encode(text));
const hex = (bytes: number[]): string => bytes.map((b) => b.toString(16).padStart(2, "0")).join("");

function makeBars(bytes: number[], state: EntityState): VisualEntity[] {
    return bytes.map((value, i) => ({
        id: `bar-${i}`,
        type: "bar" as const,
        label: value.toString(16).padStart(2, "0"),
        value,
        state,
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { index: i, byte: value },
    }));
}

/** The PBKDF2 generator. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as Input | null) ?? {};
    const password = utf8(String(task.password ?? "password"));
    const salt = utf8(String(task.salt ?? "salt"));
    const iterations = typeof task.iterations === "number" ? Math.max(1, task.iterations) : 2;
    const dkLen = typeof task.dkLen === "number" ? Math.max(1, task.dkLen) : 32;
    const blocks = Math.ceil(dkLen / 32);

    let step = 0;
    yield {
        stepNumber: step,
        entities: makeBars(new Array<number>(dkLen).fill(0), "idle"),
        edges: [],
        description: `PBKDF2-HMAC-SHA256: password length ${password.length}, salt length ${salt.length}, ${iterations} iterations, ${dkLen} output bytes.`,
        codeLineNumber: 0,
        layout: "array",
        meta: { dkLen, iterations, blocks, derivedKey: "", checkpoint: 0 },
    };
    step += 1;

    const dk: number[] = [];
    const checkpointEvery = Math.max(1, Math.floor(iterations / 8));
    for (let block = 1; block <= blocks; block += 1) {
        const seed = salt.concat([(block >>> 24) & 0xff, (block >>> 16) & 0xff, (block >>> 8) & 0xff, block & 0xff]);
        let u = hmacSha256(password, seed);
        let t = u.slice();
        for (let c = 1; c < iterations; c += 1) {
            u = hmacSha256(password, u);
            for (let i = 0; i < 32; i += 1) {
                t[i] = (t[i] ?? 0) ^ (u[i] ?? 0);
            }
            if (c % checkpointEvery === 0 && c !== iterations - 1) {
                const preview = dk.concat(t).slice(0, dkLen);
                while (preview.length < dkLen) {
                    preview.push(0);
                }
                yield {
                    stepNumber: step,
                    entities: makeBars(preview, "comparing"),
                    edges: [],
                    description: `Block ${block}, iteration ${c + 1}/${iterations}: folding U values with XOR.`,
                    codeLineNumber: 3,
                    layout: "array",
                    meta: { dkLen, iterations, blocks, derivedKey: hex(preview), checkpoint: c + 1 },
                };
                step += 1;
            }
        }
        dk.push(...t);
    }
    const final = dk.slice(0, dkLen);
    yield {
        stepNumber: step,
        entities: makeBars(final, "sorted"),
        edges: [],
        description: `Derived ${dkLen}-byte key after ${blocks} block(s) and ${iterations} iterations each: ${hex(final)}.`,
        codeLineNumber: 6,
        layout: "array",
        meta: { dkLen, iterations, blocks, derivedKey: hex(final), checkpoint: iterations },
    };
}

/** The PBKDF2 module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "A password is usually too short and predictable to use directly as a key. PBKDF2 deliberately makes each candidate password expensive to test by applying a pseudorandom function many times in a chain. For each output block it starts from the salt and a block number, repeatedly applies HMAC-SHA256, and XORs the whole chain together, so the cost grows linearly with the iteration count.",
        invariants: [
            "Each output block starts from a seed of the salt followed by a big-endian block index.",
            "U1 is HMAC(password, seed) and every later U is HMAC(password, the previous U).",
            "The block result is the XOR of all U values, and the final key is the concatenated, truncated blocks.",
        ],
        correctness:
            "SHA-256 compression, HMAC with the ipad and opad masks, and the PBKDF2 XOR folding are all implemented exactly, with 32-bit arithmetic and big-endian byte order. The module reproduces the standard SHA-256 digest of abc, the RFC 4231 HMAC-SHA256 vector, and independent PBKDF2-HMAC-SHA256 outputs, so the chaining and concatenation match the specification term by term.",
        complexityRationale:
            "Each output block needs one HMAC for U1 and one more per additional iteration, and each HMAC is constant cost for typical inputs; the total is O(blocks times iterations) HMAC evaluations. Storing the derived key uses O(blocks times 32) bytes.",
        uses: [
            "Deriving encryption keys from user passwords",
            "Password verification in authentication systems",
            "A legacy but widely deployed KDF in Wi-Fi, disk encryption, and file formats",
        ],
        references: [
            "Kaliski, RFC 2898: PKCS #5 Password-Based Cryptography Specification Version 2.0, 2000",
            "National Institute of Standards and Technology, FIPS 198-1: The Keyed-Hash Message Authentication Code, 2008",
        ],
        workedExample:
            "For password password, salt salt, two iterations, and a 32-byte output, the seed is the salt bytes plus 00000001. U1 is HMAC of the seed, U2 is HMAC of U1, and their XOR is the first block. An independent implementation of the same chain gives the derived key beginning ae4d0c95af6b46d3.",
    },
    id: "pbkdf2",
    name: "PBKDF2 with HMAC-SHA256",
    category: "cryptography-security",
    complexity: { time: "O(blocks * iterations)", space: "O(blocks * 32)" },
    defaultInput: { password: "password", salt: "salt", iterations: 2, dkLen: 32 },
    visualType: "array",
    run,
    pseudocode: [
        "convert the password and salt to bytes",
        "compute the number of thirty-two-byte blocks needed",
        "for each block form the seed as salt plus block index",
        "set U to HMAC of the seed under the password",
        "set the block result T to U",
        "repeat the HMAC on U and XOR it into T for the remaining iterations",
        "append T to the derived key and truncate to the requested length",
        "done: report the derived key bytes",
    ],
};

export default module;
