/**
 * fletchers-checksum.ts - Fletcher's Checksum
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Fletcher's checksum computes two running sums over the bytes of a message.
 * The first accumulates the bytes; the second accumulates the first sum. Both
 * are reduced modulo 255, and the two results are packed into a 16-bit value.
 * Compared with a plain sum, the second accumulator catches transpositions
 * and other order-dependent corruptions at low cost.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(n) for n message bytes
 *   Space: O(n) for the displayed byte bars (O(1) for the state itself)
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - One bar per byte shows the message.
 *   - The bar currently folded into the two sums is highlighted.
 *   - The final frame reports the packed 16-bit checksum.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

const MODULUS = 255;

/** Turn the accepted input forms into a list of bytes. */
function toBytes(input: unknown): number[] {
    const task = (input as { bytes?: number[]; text?: string } | null) ?? {};
    if (Array.isArray(task.bytes)) {
        return task.bytes.map((byte) => ((Math.floor(Number(byte)) % 256) + 256) % 256);
    }
    if (typeof task.text === "string") {
        return [...task.text].map((ch) => ch.charCodeAt(0) & 0xff);
    }
    return [..."abcde"].map((ch) => ch.charCodeAt(0) & 0xff);
}

/** The Fletcher-16 checksum module. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const bytes = toBytes(input);
    let sum1 = 0;
    let sum2 = 0;
    const states = new Map<number, EntityState>();

    const bars = (): VisualEntity[] =>
        bytes.map((byte, index) => ({
            id: `byte-${index}`,
            type: "bar" as const,
            label: String(byte),
            value: byte,
            state: states.get(index) ?? "idle",
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: { index, byte },
        }));

    yield {
        stepNumber: 0,
        entities: bars(),
        edges: [],
        description: `Starting Fletcher-16 over ${bytes.length} byte(s) with both accumulators at zero.`,
        codeLineNumber: 0,
        layout: "array",
        meta: { sum1, sum2, checksum: 0, index: -1, modulus: MODULUS },
    };
    let step = 1;
    for (let i = 0; i < bytes.length; i += 1) {
        const byte = bytes[i] as number;
        sum1 = (sum1 + byte) % MODULUS;
        sum2 = (sum2 + sum1) % MODULUS;
        states.clear();
        states.set(i, "active");
        yield {
            stepNumber: step,
            entities: bars(),
            edges: [],
            description: `Byte ${i} is ${byte}: sum1 becomes ${sum1} and sum2 becomes ${sum2}, both modulo ${MODULUS}.`,
            codeLineNumber: i === 0 ? 1 : 3,
            layout: "array",
            meta: { sum1, sum2, checksum: ((sum2 & 0xff) << 8) | (sum1 & 0xff), index: i, modulus: MODULUS },
        };
        step += 1;
    }

    states.clear();
    const checksum = ((sum2 & 0xff) << 8) | (sum1 & 0xff);
    yield {
        stepNumber: step,
        entities: bars(),
        edges: [],
        description: `Fletcher checksum is 0x${checksum.toString(16).padStart(4, "0")} (sum2 ${sum2}, sum1 ${sum1}).`,
        codeLineNumber: 5,
        layout: "array",
        meta: { sum1, sum2, checksum, index: bytes.length, modulus: MODULUS },
    };
}

/** The Fletcher-16 checksum module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "A single running sum treats bytes as an unordered bag, so swapping two equal-sum bytes goes unnoticed. Fletcher's checksum adds a second accumulator that folds in the first accumulator after every byte. The pair of sums therefore depends on byte order, while both stay small because each is reduced modulo 255.",
        invariants: [
            "sum1 is the running sum of all bytes seen so far modulo 255.",
            "sum2 is the running sum of the successive sum1 values modulo 255.",
            "The packed checksum places sum2 in the high byte and sum1 in the low byte.",
        ],
        correctness:
            "By induction, after processing k bytes the state equals the definition of the two modular sums. A permutation that preserves sum1 but changes order changes the sequence of partial sums, so it changes sum2 unless the partial sums also coincide. Modular arithmetic keeps every intermediate value bounded, and the final 16-bit word is a deterministic function of the byte sequence, so identical messages always produce identical checksums.",
        complexityRationale:
            "Each byte requires two additions and two modular reductions, so the running time is linear in the message length. The algorithm keeps only two accumulators, giving constant working space apart from the bars used for display.",
        uses: [
            "Lightweight integrity checks in network and storage protocols",
            "Checksums in the zlib and Fletcher families of formats",
            "Teaching the difference between order-independent and order-sensitive checksums",
        ],
        references: [
            "Fletcher, An Arithmetic Checksum for Serial Transmissions, 1982",
            "Wikipedia, Fletcher's checksum",
        ],
        workedExample:
            "For the single byte 0x61 (the letter a), sum1 becomes 97 and sum2 becomes 97, so the packed checksum is 0x6161. For two zero bytes both sums remain zero and the checksum stays 0x0000.",
    },
    id: "fletchers-checksum",
    name: "Fletcher's Checksum",
    category: "production-systems",
    complexity: { time: "O(n)", space: "O(1)" },
    defaultInput: { text: "abcde" },
    visualType: "array",
    run,
    pseudocode: [
        "set sum1 and sum2 to zero",
        "for each byte in the message",
        "add the byte to sum1 modulo 255",
        "add the updated sum1 to sum2 modulo 255",
        "pack sum2 in the high byte and sum1 in the low byte",
        "done: return the 16-bit Fletcher checksum",
    ],
};

export default module;
