/**
 * popcount-swar.ts - Population Count by SIMD Within A Register.
 *
 * Counts the set bits of a 32-bit word with the classic SWAR mask sequence:
 * pair, nibble, byte, then a single multiply that sums the eight byte counts
 * into the high byte. No per-bit loop is used.
 *
 * Time O(1) (a fixed number of word operations), space O(1).
 */
import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

const MASKS = [0x55555555, 0x33333333, 0x0f0f0f0f, 0x01010101];

function byteCells(value: number, states: Map<number, EntityState> = new Map()): VisualEntity[] {
    const cells: VisualEntity[] = [];
    for (let i = 0; i < 8; i += 1) {
        const byte = (value >>> (i * 4)) & 0xf;
        cells.push({
            id: `nibble-${i}`,
            type: "cell",
            label: byte.toString(16).toUpperCase(),
            value: byte,
            state: states.get(i) ?? "idle",
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: { index: i, row: 0, col: i },
        });
    }
    return cells;
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { value?: number } | null) ?? {};
    let x = typeof task.value === "number" ? task.value >>> 0 : 0b10110100110010101111000011001010;
    let step = 0;

    yield {
        stepNumber: step,
        entities: byteCells(x),
        edges: [],
        description: `Count set bits of 0x${x.toString(16)} using SWAR mask operations.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: { word: x, value: x, count: -1, stage: 0 },
    };
    step += 1;

    // Stage 1: sum adjacent bits into 2-bit fields.
    x = x - ((x >>> 1) & MASKS[0]!);
    yield {
        stepNumber: step,
        entities: byteCells(x, new Map([[0, "active"]])),
        edges: [],
        description: `Stage 1: subtract (x shifted right 1) masked with 0x55555555, giving two-bit counts.`,
        codeLineNumber: 1,
        layout: "grid",
        meta: { word: x >>> 0, count: -1, stage: 1 },
    };
    step += 1;

    // Stage 2: sum adjacent 2-bit fields into 4-bit fields.
    x = (x & MASKS[1]!) + ((x >>> 2) & MASKS[1]!);
    yield {
        stepNumber: step,
        entities: byteCells(x, new Map([[1, "active"]])),
        edges: [],
        description: `Stage 2: add neighbouring two-bit fields with 0x33333333 to form four-bit counts.`,
        codeLineNumber: 2,
        layout: "grid",
        meta: { word: x >>> 0, count: -1, stage: 2 },
    };
    step += 1;

    // Stage 3: combine nibbles into bytes.
    x = (x + (x >>> 4)) & MASKS[2]!;
    yield {
        stepNumber: step,
        entities: byteCells(x, new Map([[2, "active"]])),
        edges: [],
        description: `Stage 3: fold nibbles into bytes and mask with 0x0F0F0F0F; each byte holds one count.`,
        codeLineNumber: 3,
        layout: "grid",
        meta: { word: x >>> 0, count: -1, stage: 3 },
    };
    step += 1;

    // Stage 4: one multiply sums all eight byte counts in the high byte.
    const count = Math.imul(x, MASKS[3]!) >>> 24;
    const finalStates = new Map<number, EntityState>();
    for (let i = 0; i < 8; i += 1) finalStates.set(i, "sorted");
    yield {
        stepNumber: step,
        entities: byteCells(x, finalStates),
        edges: [],
        description: `Stage 4: multiply by 0x01010101 and shift right 24; the population count is ${count}.`,
        codeLineNumber: 4,
        layout: "grid",
        meta: { word: x >>> 0, value: x >>> 0, count, stage: 4 },
    };
}

const module: AlgorithmModule = {
    id: "popcount-swar",
    name: "Popcount (SWAR)",
    category: "math",
    complexity: { time: "O(1)", space: "O(1)" },
    defaultInput: { value: 0b10110100110010101111000011001010 },
    visualType: "grid",
    run,
    pseudocode: [
        "let x be the 32-bit word",
        "x <- x - ((x >> 1) & 0x55555555)  (pair bits)",
        "x <- (x & 0x33333333) + ((x >> 2) & 0x33333333)  (nibbles)",
        "x <- (x + (x >> 4)) & 0x0F0F0F0F  (bytes)",
        "return (x * 0x01010101) >> 24  (sum of byte counts)",
    ],
    education: {
        intuition:
            "Instead of testing each bit in a loop, widen the adders: first add neighbouring single bits, then neighbouring pairs, then neighbouring nibbles. After four stages each byte of the word holds the number of set bits in that byte, and one multiply adds all eight bytes at once.",
        invariants: [
            "After each stage, field widths double: 1, 2, 4, then 8 bits.",
            "No field ever overflows because a field of width w can hold a count up to w.",
            "The final high byte is the total number of set bits in the original word.",
        ],
        correctness:
            "Each stage replaces two adjacent fields holding counts by their sum in a field twice as wide, which stays exact because the maximum count fits. By induction every byte after stage three counts the ones in its original byte; multiplying by 0x01010101 forms the sum of all bytes in the high byte because no byte sum exceeds 32.",
        complexityRationale:
            "The mask sequence is a fixed number of word-level arithmetic operations, independent of the number of set bits, so both time and space are constant.",
        uses: [
            "Computing Hamming weight in cryptography and coding theory",
            "Chess engine evaluation through bitboard population counts",
            "Sparse bitmap and set-cardinality operations in databases",
        ],
        references: [
            "Knuth, The Art of Computer Programming, Volume 4A, Section 7.1.3",
            "Warren, Hacker's Delight, Chapter 5",
        ],
        workedExample:
            "For the byte 0b1011 the pair stage gives 01 01 01 01, the nibble stage gives 0010 0010, and the byte stage gives 0000 0011. Multiplying by 0x01010101 places 3 in the high byte, so three bits are set.",
    },
};

export default module;
