/**
 * hmac-drbg.ts - HMAC-DRBG (Toy Model)
 *
 * A deterministic random bit generator built from HMAC. The real standard uses
 * SHA-256 and a wider state; this teaching version uses a small FNV-1a hash as
 * a stand-in so the whole update and generate cycle is easy to inspect. The
 * structure (V and C state, update, and generate with a post-update) matches
 * the NIST construction. Not cryptographically secure.
 *
 * Time: O(bytes * blocksize); Space: O(blocksize).
 */

import type { AlgorithmModule, VisualEntity, VisualFrame } from "@/types";

const BLOCK = 4;

function fnv1a(bytes: number[]): number {
    let hash = 0x811c9dc5;
    for (const byte of bytes) {
        hash ^= byte & 0xff;
        hash = Math.imul(hash, 0x01000193) >>> 0;
    }
    return hash >>> 0;
}

function toBytes(value: number): number[] {
    return [
        (value >>> 24) & 0xff,
        (value >>> 16) & 0xff,
        (value >>> 8) & 0xff,
        value & 0xff,
    ];
}

function hmac(key: number[], message: number[]): number[] {
    const padded = key.slice(0, BLOCK);
    while (padded.length < BLOCK) { padded.push(0); }
    const inner = padded.map((b) => b ^ 0x36);
    const outer = padded.map((b) => b ^ 0x5c);
    const innerHash = fnv1a([...inner, ...message]);
    return toBytes(fnv1a([...outer, ...toBytes(innerHash)]));
}

function makeEntities(state: number[], active: number): VisualEntity[] {
    return state.map((value, index) => ({
        id: `v-${index}`,
        type: "bar" as const,
        label: `${value}`,
        value,
        state: index === active ? "active" : "idle",
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { byte: index },
    }));
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as {
        entropy?: number[];
        nonce?: number[];
        personalization?: number[];
        bytes?: number;
    } | null) ?? {};
    const entropy = task.entropy ?? [1, 2, 3, 4, 5, 6, 7, 8];
    const nonce = task.nonce ?? [9, 10, 11, 12];
    const personalization = task.personalization ?? [13, 14];
    const byteCount = Math.max(4, Math.min(64, Math.floor(task.bytes ?? 8)));

    let v: number[] = new Array(BLOCK).fill(0x01);
    let c: number[] = new Array(BLOCK).fill(0x00);
    const seed = [...entropy, ...nonce, ...personalization];

    function update(provided: number[]): void {
        let k = hmac(c, [...v, 0x00, ...provided]);
        v = hmac(k, v);
        c = hmac(k, [...v, 0x01]);
        v = hmac(k, v);
    }

    update(seed);
    let step = 0;
    yield {
        stepNumber: step,
        entities: makeEntities(v, -1),
        edges: [],
        description: `Instantiated the toy HMAC-DRBG and absorbed a ${seed.length}-byte seed.`,
        codeLineNumber: 0,
        layout: "array",
        meta: { state: [...v], output: [] as number[], reseeds: 0 },
    };
    step += 1;

    const output: number[] = [];
    while (output.length < byteCount) {
        let k = hmac(c, v);
        v = hmac(k, v);
        output.push(...v);
        k = hmac(c, [...v, 0x00]);
        v = hmac(k, v);
        c = hmac(k, [...v, 0x01]);
        v = hmac(k, v);
        yield {
            stepNumber: step,
            entities: makeEntities(v, output.length % BLOCK),
            edges: [],
            description: `Generated ${Math.min(output.length, byteCount)} of ${byteCount} bytes and refreshed the internal state.`,
            codeLineNumber: output.length >= byteCount ? 6 : 4,
            layout: "array",
            meta: { state: [...v], output: [...output.slice(0, byteCount)], reseeds: 0 },
        };
        step += 1;
    }

    const finalOutput = output.slice(0, byteCount);
    yield {
        stepNumber: step,
        entities: makeEntities(v, -1),
        edges: [],
        description: `Generated ${finalOutput.length} deterministic pseudo-random bytes.`,
        codeLineNumber: 6,
        layout: "array",
        meta: { state: [...v], output: finalOutput, reseeds: 0 },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "A DRBG keeps two secret buffers called V and C. Seeding mixes entropy into them with HMAC, and each request produces a block from V before quietly updating both buffers so the next request differs. Because HMAC is one-way, observing output does not reveal the internal state.",
        invariants: [
            "V and C are always exactly one HMAC output block long.",
            "The generation step always refreshes the state after emitting a block.",
            "Repeating the same seed and requests yields the same output sequence.",
        ],
        correctness:
            "The NIST-style update maps a secret state through HMAC, a pseudorandom function, so each refresh is indistinguishable from fresh randomness to an observer without the key. Reproducing the update order in an independent reference gives identical bytes, which is the check performed by the companion test.",
        complexityRationale:
            "Each update and generate call performs a constant number of HMAC evaluations, each hashing a fixed block. Producing n bytes therefore takes O(n) time and O(blocksize) space.",
        uses: [
            "Generating nonces, keys, and salts inside cryptographic libraries",
            "Deterministic replay of randomized simulations from a seed",
            "Teaching the state-management discipline of real random bit generators",
        ],
        references: [
            "NIST SP 800-90A Rev. 1, Recommendation for Random Number Generation Using Deterministic Random Bit Generators",
            "Menezes, Oorschot, and Vanstone, Handbook of Applied Cryptography, chapter 5",
        ],
        workedExample:
            "Seeding with entropy one through eight, a four-byte nonce, and a two-byte personalization string produces a stable stream; the first eight output bytes are identical on every run and change if any seed byte changes.",
    },
    id: "hmac-drbg",
    name: "HMAC-DRBG (Toy Model)",
    category: "cryptography-security",
    complexity: { time: "O(bytes)", space: "O(blocksize)" },
    defaultInput: {
        entropy: [1, 2, 3, 4, 5, 6, 7, 8],
        nonce: [9, 10, 11, 12],
        personalization: [13, 14],
        bytes: 8,
    },
    visualType: "array",
    run,
    pseudocode: [
        "set V to all ones and C to all zeros",
        "absorb entropy, nonce, and personalization through the update step",
        "for each requested block generate from the current V",
        "emit the state bytes as the next random bytes",
        "refresh V and C with HMAC after the block is emitted",
        "repeat until enough bytes are available",
        "report the truncated output stream",
    ],
};

export default module;
