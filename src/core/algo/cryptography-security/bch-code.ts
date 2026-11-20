/**
 * bch-code.ts - BCH(15,7) Error-Correcting Code
 *
 * A narrow-sense BCH code that maps 7 message bits into 15-bit codewords and
 * corrects up to two bit errors. Encoding appends a parity remainder computed
 * with the degree-8 generator polynomial. Decoding uses bounded-distance
 * search: it tries every error pattern of weight zero, one, or two and keeps
 * the unique pattern whose correction is a valid codeword. This is a faithful
 * teaching decoder for this small code, not a general high-rate BCH design.
 *
 * Complexity:
 *   Time:  O(n^2) decoding for n = 15 (at most 121 trial patterns)
 *   Space: O(n) for the codeword and trial patterns
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

const N = 15;
const K = 7;
const GENERATOR = 0x1d1; // x^8 + x^7 + x^6 + x^4 + 1, minimum distance 5

function degree(value: number): number {
    if (value <= 0) {
        return -1;
    }
    return 31 - Math.clz32(value);
}

/** Remainder of a polynomial (bit vector) divided by the generator. */
function remainder(value: number): number {
    let current = value;
    const generatorDegree = degree(GENERATOR);
    while (degree(current) >= generatorDegree) {
        current ^= GENERATOR << (degree(current) - generatorDegree);
    }
    return current;
}

function encode(message: number): number {
    const shifted = (message & ((1 << K) - 1)) << (N - K);
    return shifted | remainder(shifted);
}

function isValidCodeword(word: number): boolean {
    return remainder(word) === 0;
}

/** Try all error patterns of weight at most 2; return the corrected message or -1. */
function decode(word: number): number {
    if (isValidCodeword(word)) {
        return (word >>> (N - K)) & ((1 << K) - 1);
    }
    for (let i = 0; i < N; i += 1) {
        if (isValidCodeword(word ^ (1 << i))) {
            return ((word ^ (1 << i)) >>> (N - K)) & ((1 << K) - 1);
        }
    }
    for (let i = 0; i < N; i += 1) {
        for (let j = i + 1; j < N; j += 1) {
            const corrected = word ^ (1 << i) ^ (1 << j);
            if (isValidCodeword(corrected)) {
                return (corrected >>> (N - K)) & ((1 << K) - 1);
            }
        }
    }
    return -1;
}

function bits(word: number, count: number): number[] {
    return Array.from({ length: count }, (_, i) => (word >>> (count - 1 - i)) & 1);
}

function makeCells(
    message: number,
    word: number,
    flipped: Set<number>,
    phase: "message" | "codeword" | "channel" | "done",
): VisualEntity[] {
    const entities: VisualEntity[] = [];
    const visible = phase === "message" ? bits(message, K) : bits(word, N);
    const count = phase === "message" ? K : N;
    for (let i = 0; i < count; i += 1) {
        const bit = visible[i] ?? 0;
        const state: EntityState = flipped.has(i)
            ? "error"
            : phase === "done"
                ? "sorted"
                : phase === "channel"
                    ? "active"
                    : phase === "codeword"
                        ? "visited"
                        : "idle";
        entities.push({
            id: `cell-${i}`,
            type: "cell",
            label: String(bit),
            value: bit,
            state,
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: { index: i, region: i < K ? "message" : "parity" },
        });
    }
    return entities;
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { message?: number; errors?: number[] } | null) ?? {};
    const message = (task.message ?? 73) & ((1 << K) - 1);
    const codeword = encode(message);
    const errors = Array.isArray(task.errors) ? task.errors.filter((e) => e >= 0 && e < N).slice(0, 2) : [2];
    let received = codeword;
    for (const index of errors) {
        received ^= 1 << index;
    }
    const flipped = new Set(errors);
    const decodedMessage = decode(received);
    const correctedCodeword = decodedMessage >= 0 ? encode(decodedMessage) : -1;
    const base = { n: N, k: K, message, codeword, received, errors };

    yield {
        stepNumber: 0,
        entities: makeCells(message, codeword, flipped, "message"),
        edges: [],
        description: `${K} message bits are loaded; ${N - K} parity bits will be appended by the generator.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: { ...base, phase: "message", rows: 1, cols: K },
    };
    yield {
        stepNumber: 1,
        entities: makeCells(message, codeword, flipped, "codeword"),
        edges: [],
        description: `Systematic encoding appends the remainder, forming the 15-bit codeword ${codeword.toString(2).padStart(15, "0")}.`,
        codeLineNumber: 2,
        layout: "grid",
        meta: { ...base, phase: "encode", rows: 1, cols: N },
    };
    yield {
        stepNumber: 2,
        entities: makeCells(message, received, flipped, "channel"),
        edges: [],
        description: `The channel flips ${errors.length} bit(s); red cells mark the corrupted positions.`,
        codeLineNumber: 3,
        layout: "grid",
        meta: { ...base, phase: "channel", rows: 1, cols: N },
    };
    yield {
        stepNumber: 3,
        entities: makeCells(message, correctedCodeword >= 0 ? correctedCodeword : received, flipped, "done"),
        edges: [],
        description: decodedMessage >= 0
            ? `Bounded-distance search finds a valid codeword and recovers message ${decodedMessage}.`
            : "No codeword lies within two bits; the decoder reports an uncorrectable word.",
        codeLineNumber: decodedMessage >= 0 ? 5 : 7,
        layout: "grid",
        meta: {
            ...base,
            phase: "done",
            rows: 1,
            cols: N,
            decodedMessage,
            correctedCodeword,
            success: decodedMessage === message,
        },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "An error-correcting code adds redundant parity bits so that a corrupted message can still be recovered. This BCH code turns seven message bits into fifteen codeword bits chosen so that any two valid codewords differ in at least five positions. If at most two bits flip, the received word is closest to exactly one valid codeword, and finding it recovers the message.",
        invariants: [
            "Every valid codeword has zero remainder when divided by the generator polynomial.",
            "Any two codewords differ in at least five bit positions.",
            "A received word with at most two errors matches exactly one valid codeword.",
        ],
        correctness:
            "Encoding appends the remainder of the shifted message, which makes the full codeword divisible by the generator. The minimum distance of this BCH code is five, so spheres of radius two around distinct codewords are disjoint. The decoder enumerates every pattern that flips zero, one, or two bits; if a correction yields a zero remainder it is a valid codeword, and disjointness guarantees it is unique. Extracting the leading seven bits therefore returns the original message whenever at most two errors occurred.",
        complexityRationale:
            "Polynomial division walks down at most fifteen bits per check, a constant. Decoding tests one zero-error pattern, fifteen single-bit patterns, and 105 two-bit patterns, so it runs in O(n squared) for n equals fifteen, that is, a small constant. Only a handful of bit vectors are stored.",
        uses: [
            "Error correction in storage and communication channels",
            "Teaching cyclic codes and bounded-distance decoding",
            "A small model of the code family used in flash memory and QR codes",
        ],
        references: [
            "Bose and Ray-Chaudhuri, On A Class of Error Correcting Binary Group Codes, 1960",
            "Lin and Costello, Error Control Coding, Chapter 6",
        ],
        workedExample:
            "Message 73 becomes a 15-bit codeword with eight appended parity bits. If the channel flips bit 2, the received word fails the remainder test. Trying each single flip, flipping bit 2 back yields a zero remainder, and reading the first seven bits gives 73 again.",
    },
    id: "bch-code",
    name: "BCH(15,7) Error-Correcting Code",
    category: "cryptography-security",
    complexity: { time: "O(n^2)", space: "O(n)" },
    defaultInput: { message: 73, errors: [2] },
    visualType: "grid",
    run,
    pseudocode: [
        "load the message bits and the generator polynomial",
        "shift the message left by the parity length",
        "append the remainder as systematic parity bits",
        "the channel flips up to two positions",
        "try each error pattern of weight zero, one, or two",
        "keep the correction whose word has zero remainder",
        "extract the leading message bits from that codeword",
        "done: report the recovered message",
    ],
};

export default module;
