/**
 * adler-32-checksum.ts - Adler-32 Checksum
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Adler-32 computes a 32-bit checksum with two running sums modulo 65521.
 * The first accumulates byte values and the second accumulates the running
 * first sum, so each byte affects the result through both sums. The final
 * checksum places the second sum in the high sixteen bits and the first in
 * the low sixteen bits. It is simpler than CRC-32 and appears in zlib streams.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(n) for n bytes
 *   Space: O(n) for the displayed byte cells
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - One cell per message byte shows its numeric value.
 *   - The byte being absorbed is highlighted; earlier bytes turn green.
 *   - Metadata tracks both running sums and the final checksum.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface AdlerInput {
    text?: string;
    bytes?: number[];
}

const MODULUS = 65521;

/** Encode text as ASCII byte values, or use the provided bytes. */
function toBytes(task: AdlerInput): number[] {
    if (Array.isArray(task.bytes)) {
        return task.bytes.map((byte) => byte & 0xff);
    }
    const text = typeof task.text === "string" ? task.text : "Wikipedia";
    return Array.from(text, (character) => character.charCodeAt(0) & 0xff);
}

/** Build one cell per byte. */
function makeCells(bytes: number[], current: number, done: boolean): VisualEntity[] {
    return bytes.map((value, index) => {
        let state: EntityState = "idle";
        if (done || index < current) {
            state = "sorted";
        } else if (index === current) {
            state = "comparing";
        }
        return {
            id: `cell-${index}`,
            type: "cell" as const,
            label: `${value} (0x${value.toString(16).padStart(2, "0")})`,
            value,
            state,
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: { row: 0, col: index, byte: value },
        };
    });
}

/** The Adler-32 generator. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as AdlerInput | null) ?? {};
    const bytes = toBytes(task);
    let a = 1;
    let b = 0;

    yield {
        stepNumber: 0,
        entities: makeCells(bytes, -1, false),
        edges: [],
        description: `Starting Adler-32 over ${bytes.length} byte(s) with sums a=1 and b=0.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: { rows: 1, cols: bytes.length, a, b, checksum: 0, checksumHex: "", as: [] as number[], bs: [] as number[] },
    };
    let step = 1;
    const as: number[] = [];
    const bs: number[] = [];

    for (let i = 0; i < bytes.length; i += 1) {
        const byte = bytes[i] ?? 0;
        a = (a + byte) % MODULUS;
        b = (b + a) % MODULUS;
        as.push(a);
        bs.push(b);
        yield {
            stepNumber: step,
            entities: makeCells(bytes, i, false),
            edges: [],
            description: `Absorbed byte ${i} (${byte}): a=${a}, b=${b}.`,
            codeLineNumber: 2,
            layout: "grid",
            meta: { rows: 1, cols: bytes.length, a, b, checksum: 0, checksumHex: "", as: [...as], bs: [...bs] },
        };
        step += 1;
    }

    const checksum = (((b << 16) | a) >>> 0);
    yield {
        stepNumber: step,
        entities: makeCells(bytes, -1, true),
        edges: [],
        description: `Adler-32 = 0x${checksum.toString(16).padStart(8, "0")} (${checksum}) with a=${a} and b=${b}.`,
        codeLineNumber: 4,
        layout: "grid",
        meta: { rows: 1, cols: bytes.length, a, b, checksum, checksumHex: checksum.toString(16).padStart(8, "0"), as, bs, done: true },
    };
}

/** The Adler-32 module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "Adler-32 keeps two running sums. The first is the sum of all bytes seen so far and the second is the sum of those running values, both reduced modulo a prime. Because the second sum sees every prefix of the first, changing any byte ripples through the rest of the computation. Packing the two sums into one word gives a compact fingerprint.",
        invariants: [
            "Both running sums stay between zero and 65520 after every byte.",
            "The first sum increases by exactly the current byte modulo 65521.",
            "The final checksum stores the second sum in the high bits and the first in the low bits.",
        ],
        correctness:
            "The modular recurrence directly implements the definition of Adler-32: a is the sum of bytes one through n, and b is the sum of the prefix sums one through n. Folding modulo 65521 at each step is valid because addition respects congruence, so the results equal the define sums reduced modulo the prime. Shifting b into the high sixteen bits and OR-ing a into the low bits matches the standard packing, which reproduces the canonical check value for Wikipedia.",
        complexityRationale:
            "Each byte requires two additions, two comparisons, and two modular reductions, so the time is O(n). The computation itself uses constant space, and the displayed byte cells plus the two sum histories use O(n) space.",
        uses: [
            "Integrity checking inside zlib and PNG streams",
            "Fast detection of accidental corruption in stored blocks",
            "A lightweight alternative where cryptographic strength is unnecessary",
        ],
        references: [
            "RFC 1950, ZLIB Compressed Data Format Specification",
            "Adler, checksum algorithm notes in the zlib documentation, 1995",
        ],
        workedExample:
            "For the nine ASCII bytes of 123456789, the running first sum ends at 478 and the second at 2334, giving the packed checksum 0x091e01de. The canonical string Wikipedia gives 0x11e60398, which any correct implementation must reproduce.",
    },
    id: "adler-32-checksum",
    name: "Adler-32 Checksum",
    category: "production-systems",
    complexity: { time: "O(n)", space: "O(n)" },
    defaultInput: { text: "Wikipedia" },
    visualType: "grid",
    run,
    pseudocode: [
        "initialize the first sum a to one and the second sum b to zero",
        "for each byte of the message",
        "add the byte to a and reduce a modulo 65521",
        "add the new a to b and reduce b modulo 65521",
        "record both sums after the byte",
        "pack b into the high bits and a into the low bits",
        "done: report the packed 32-bit checksum",
    ],
};

export default module;
