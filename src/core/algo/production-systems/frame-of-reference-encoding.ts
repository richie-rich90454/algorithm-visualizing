/**
 * frame-of-reference-encoding.ts - Frame-of-Reference Integer Encoding
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Frame-of-reference (FOR) encoding exploits the fact that integers in a
 * compressed block are often close together. It subtracts the block minimum
 * from every value, discovers the bit width needed by the largest residual,
 * and packs the residuals back to back into fixed-width words. Decoding only
 * needs the stored base, the bit width, and the packed words.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(n) to find the base, subtract, and pack n values
 *   Space: O(n * width / wordBits) words for the packed stream
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - One bar per original value; its label also shows the residual.
 *   - Bars turn green as their residual is appended to the bit stream.
 *   - The final frame reports the base, bit width, and packed words.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

/** Pack non-negative integers into big-endian words of a fixed bit width. */
function pack(values: number[], width: number, wordBits: number): number[] {
    if (width === 0 || values.length === 0) return [];
    const wordSize = Math.pow(2, wordBits);
    const mask = wordSize - 1;
    const fieldSize = Math.pow(2, width);
    const packed: number[] = [];
    let buffer = 0;
    let bits = 0;
    for (const value of values) {
        buffer = buffer * fieldSize + value;
        bits += width;
        while (bits >= wordBits) {
            bits -= wordBits;
            packed.push(Math.floor(buffer / Math.pow(2, bits)) % wordSize);
            buffer = buffer % Math.pow(2, bits);
        }
    }
    if (bits > 0) packed.push((buffer * Math.pow(2, wordBits - bits)) % wordSize);
    return packed;
}

/** The frame-of-reference encoding module. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { values?: number[]; wordBits?: number } | null) ?? {};
    const values: number[] = Array.isArray(task.values)
        ? task.values.map(Number)
        : [1000, 1002, 1005, 1001, 1010, 1003];
    const wordBits = Math.max(1, Math.min(16, Math.floor(task.wordBits ?? 8)));

    const min = values.length > 0 ? Math.min(...values) : 0;
    const residuals = values.map((value) => value - min);
    const maxResidual = residuals.length > 0 ? Math.max(...residuals) : 0;
    const width = maxResidual === 0 ? 0 : Math.ceil(Math.log2(maxResidual + 1));

    let step = 0;
    const emit = (
        states: Map<number, EntityState>,
        description: string,
        codeLineNumber: number,
        extra: Record<string, number | number[]>,
    ): VisualFrame => {
        const entities: VisualEntity[] = values.map((value, index) => {
            const residual = residuals[index] ?? 0;
            return {
                id: `value-${index}`,
                type: "bar" as const,
                label: `${value} -> ${residual}`,
                value,
                state: states.get(index) ?? "idle",
                x: 0,
                y: 0,
                width: 0,
                height: 0,
                metadata: { index, value, residual },
            };
        });
        const frame: VisualFrame = {
            stepNumber: step,
            entities,
            edges: [],
            description,
            codeLineNumber,
            layout: "array",
            meta: {
                min,
                maxResidual,
                width,
                wordBits,
                residuals: residuals.slice(),
                values: values.slice(),
                ...extra,
            },
        };
        step += 1;
        return frame;
    };

    yield emit(new Map(), `Starting frame-of-reference encoding of ${values.length} value(s) into ${wordBits}-bit words.`, 0, {
        packed: [],
        index: -1,
    });
    const comparing = new Map<number, EntityState>(values.map((_, i) => [i, "comparing" as EntityState]));
    yield emit(comparing, `The block minimum is ${min}; subtracting it keeps every residual small.`, 1, {
        packed: [],
        index: -1,
    });
    const active = new Map<number, EntityState>(values.map((_, i) => [i, "active" as EntityState]));
    yield emit(active, `Largest residual is ${maxResidual}, so each residual needs ${width} bit(s).`, 3, {
        packed: [],
        index: -1,
    });

    const done = new Map<number, EntityState>();
    for (let i = 0; i < values.length; i += 1) {
        done.set(i, "sorted");
        const packed = pack(residuals.slice(0, i + 1), width, wordBits);
        yield emit(
            new Map(done),
            `Appended residual ${residuals[i]} with ${width} bit(s); ${packed.length} packed word(s) so far.`,
            5,
            { packed, index: i },
        );
    }
    yield emit(done, `Encoding complete: base ${min}, width ${width} bit(s), ${pack(residuals, width, wordBits).length} word(s).`, 7, {
        packed: pack(residuals, width, wordBits),
        index: values.length,
    });
}

/** The frame-of-reference encoding module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "Numbers that appear together are often close to each other, so storing each full integer wastes space. Frame-of-reference encoding subtracts the block minimum to turn the values into small residuals, then writes those residuals using only as many bits as the largest one needs. A decoder adds the stored base back after reading each field.",
        invariants: [
            "Every residual equals the original value minus the stored base.",
            "The chosen bit width can represent the largest residual exactly.",
            "The packed words are a lossless concatenation of width-bit residual fields.",
        ],
        correctness:
            "Because the base is the true minimum, every residual is nonnegative. Choosing width as the number of bits needed for the largest residual guarantees every field fits, so packing loses no information. Reading width bits at a time recovers the exact residual sequence, and adding the base recovers each original value. Zero width occurs only when all values equal the base, in which case no bits need to be stored.",
        complexityRationale:
            "Finding the base and the largest residual scans the block once, subtracting scans it a second time, and packing processes each residual once, so the total time is linear. The packed stream holds n times width bits, giving O(n * width / wordBits) words of space.",
        uses: [
            "Columnar analytics formats that compress integer columns in blocks",
            "Inverted index postings lists in search engines",
            "Time-series databases storing dense numeric measurements",
        ],
        references: [
            "Zukowski, Heman, Nes, and Boncz, Super-Scalable RAM-CPU Cache Compression, 2006",
            "Lemire and Kaser, Faster Integer Compression with SIMD",
        ],
        workedExample:
            "For values 1000, 1002, 1005 and 1001 the base is 1000 and the residuals are 0, 2, 5, 1. The largest residual 5 needs three bits, so the fields 000 010 101 001 pack into the bytes 0x0A and 0x90 at eight bits per word.",
    },
    id: "frame-of-reference-encoding",
    name: "Frame-of-Reference Encoding",
    category: "production-systems",
    complexity: { time: "O(n)", space: "O(n * width / wordBits)" },
    defaultInput: { values: [1000, 1002, 1005, 1001, 1010, 1003], wordBits: 8 },
    visualType: "array",
    run,
    pseudocode: [
        "find the minimum value in the block",
        "subtract the minimum from every value to get residuals",
        "find the largest residual",
        "choose the bit width that fits the largest residual",
        "create an empty bit stream",
        "append each residual using width bits",
        "pad the final word and emit the packed integers",
        "done: report the base, width, and packed stream",
    ],
};

export default module;
