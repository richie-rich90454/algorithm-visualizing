/**
 * checksum-fletcher.ts - Fletcher Checksum
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Fletcher's checksum keeps two running sums over a sequence of bytes. The
 * first sum accumulates the bytes themselves and the second accumulates the
 * running first sum. Both are reduced modulo a small modulus (255 for the
 * classic 16-bit form). Because the second sum sees every prefix of the first,
 * a change to any byte changes all later sums, which catches more errors than
 * a plain sum. The two sums are packed into one word at the end.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(n) for n bytes
 *   Space: O(n) for the displayed byte cells and sum history
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - One grid cell per byte shows its numeric value.
 *   - The current byte is highlighted; absorbed bytes turn green.
 *   - Metadata tracks both sums and the packed checksum.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface FletcherInput {
    text?: string;
    bytes?: number[];
    modulus?: number;
}

/** Turn the input into byte values in the range 0..255. */
function toBytes(task: FletcherInput): number[] {
    if (Array.isArray(task.bytes)) {
        return task.bytes.map((byte) => byte & 0xff);
    }
    const text = typeof task.text === "string" ? task.text : "abcdefgh";
    return Array.from(text, (character) => character.charCodeAt(0) & 0xff);
}

/** Build the row of byte cells for one frame. */
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
            label: String(value),
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

/** The Fletcher checksum generator. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as FletcherInput | null) ?? {};
    const bytes = toBytes(task);
    const modulus = typeof task.modulus === "number" && task.modulus > 1 ? task.modulus : 255;
    let s1 = 0;
    let s2 = 0;
    const s1History: number[] = [];
    const s2History: number[] = [];

    yield {
        stepNumber: 0,
        entities: makeCells(bytes, -1, false),
        edges: [],
        description: `Starting Fletcher checksum over ${bytes.length} byte(s) with modulus ${modulus}.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: {
            rows: 1,
            cols: bytes.length,
            s1,
            s2,
            checksum: 0,
            modulus,
            s1History: [] as number[],
            s2History: [] as number[],
        },
    };

    let step = 1;
    for (let i = 0; i < bytes.length; i += 1) {
        const byte = bytes[i] ?? 0;
        s1 = (s1 + byte) % modulus;
        s2 = (s2 + s1) % modulus;
        s1History.push(s1);
        s2History.push(s2);
        yield {
            stepNumber: step,
            entities: makeCells(bytes, i, false),
            edges: [],
            description: `Absorbed byte ${i} (${byte}): s1=${s1}, s2=${s2}.`,
            codeLineNumber: 2,
            layout: "grid",
            meta: {
                rows: 1,
                cols: bytes.length,
                s1,
                s2,
                checksum: 0,
                modulus,
                s1History: [...s1History],
                s2History: [...s2History],
            },
        };
        step += 1;
    }

    const checksum = ((s2 << 8) | s1) >>> 0;
    yield {
        stepNumber: step,
        entities: makeCells(bytes, -1, true),
        edges: [],
        description: `Fletcher checksum = ${checksum} (s1=${s1}, s2=${s2}).`,
        codeLineNumber: 4,
        layout: "grid",
        meta: {
            rows: 1,
            cols: bytes.length,
            s1,
            s2,
            checksum,
            modulus,
            s1History,
            s2History,
            done: true,
        },
    };
}

/** The Fletcher checksum module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "Fletcher's checksum is a sum with memory. A first accumulator adds each byte, and a second accumulator adds the running value of the first. Because the second accumulator sees every prefix, a single altered byte changes all later contributions, so the check detects more corruption than a plain sum while staying cheap to compute.",
        invariants: [
            "Both accumulators stay in the range zero through modulus minus one after every byte.",
            "The first accumulator always holds the sum of all bytes seen so far, reduced modulo the modulus.",
            "The second accumulator always holds the sum of the first accumulator's values after each byte.",
        ],
        correctness:
            "The update rule is a direct implementation of the definition. After n bytes the first accumulator equals the sum of all bytes modulo M, and the second equals the sum over positions j of (n minus j plus one) times byte j modulo M. Reducing at each step is valid because addition respects congruence. Packing the second sum in the high byte and the first in the low byte reproduces the standard 16-bit Fletcher value.",
        complexityRationale:
            "Each byte takes two additions and two modular reductions, so the running time is linear in the number of bytes. The accumulators use constant space; the byte cells and the two recorded histories use linear space for the visualization.",
        uses: [
            "Lightweight integrity checks in network and storage protocols",
            "Detecting accidental corruption where cryptographic strength is unnecessary",
            "A teaching step between a plain sum and a cyclic redundancy check",
        ],
        references: [
            "Fletcher, An Arithmetic Checksum for Serial Transmissions, 1982",
            "RFC 1146, Television Images over IP (Fletcher checksum discussion)",
        ],
        workedExample:
            "For the four bytes 1, 2, 3, 4 with modulus 255, the first accumulator ends at 10 and the second passes through 1, 3, 6, 10 to end at 20. The packed 16-bit checksum is 20 times 256 plus 10, which is 5130.",
    },
    id: "checksum-fletcher",
    name: "Fletcher Checksum",
    category: "string",
    complexity: { time: "O(n)", space: "O(n)" },
    defaultInput: { text: "abcdefgh" },
    visualType: "grid",
    run,
    pseudocode: [
        "initialize the first sum s1 and the second sum s2 to zero",
        "for each byte of the message",
        "add the byte to s1 and reduce modulo the modulus",
        "add the new s1 to s2 and reduce modulo the modulus",
        "record both sums after the byte",
        "pack s2 in the high byte and s1 in the low byte",
        "done: report the packed Fletcher checksum",
    ],
};

export default module;
