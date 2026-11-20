/**
 * crc32-checksum.ts - CRC-32 (IEEE 802.3) Checksum
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * CRC-32 computes a 32-bit checksum by treating the message as a polynomial
 * and dividing by a fixed generator polynomial in GF(2). The reflected table
 * free form shifts the register right and conditionally XORs the reversed
 * polynomial 0xEDB88320. The register starts and ends inverted, which is the
 * convention used by zip, gzip, PNG, and Ethernet.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(8 * n) bit steps for n bytes
 *   Space: O(n) for the displayed byte cells
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - One cell per message byte shows its numeric value.
 *   - The byte being absorbed is highlighted; absorbed bytes turn green.
 *   - Metadata tracks the running register and the final checksum.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface CrcInput {
    text?: string;
    bytes?: number[];
}

const POLYNOMIAL = 0xedb88320;
const INITIAL = 0xffffffff;

/** Encode text as ASCII byte values, or return the provided bytes. */
function toBytes(task: CrcInput): number[] {
    if (Array.isArray(task.bytes)) {
        return task.bytes.map((b) => b & 0xff);
    }
    const text = typeof task.text === "string" ? task.text : "123456789";
    const result: number[] = [];
    for (let i = 0; i < text.length; i += 1) {
        result.push(text.charCodeAt(i) & 0xff);
    }
    return result;
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

/** The CRC-32 generator. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as CrcInput | null) ?? {};
    const bytes = toBytes(task);
    let register = INITIAL;

    yield {
        stepNumber: 0,
        entities: makeCells(bytes, -1, false),
        edges: [],
        description: `Computing CRC-32 over ${bytes.length} byte(s).`,
        codeLineNumber: 0,
        layout: "grid",
        meta: { rows: 1, cols: bytes.length, register, registers: [] as number[], crc: 0, crcHex: "" },
    };
    let step = 1;
    const registers: number[] = [];

    for (let i = 0; i < bytes.length; i += 1) {
        const byte = bytes[i] ?? 0;
        register ^= byte;
        for (let bit = 0; bit < 8; bit += 1) {
            const low = (register & 1) !== 0;
            register = register >>> 1;
            if (low) {
                register ^= POLYNOMIAL;
            }
        }
        registers.push(register >>> 0);
        yield {
            stepNumber: step,
            entities: makeCells(bytes, i, false),
            edges: [],
            description: `Absorbed byte ${i} (0x${byte.toString(16).padStart(2, "0")}); register 0x${(register >>> 0).toString(16).padStart(8, "0")}.`,
            codeLineNumber: 1,
            layout: "grid",
            meta: { rows: 1, cols: bytes.length, register: register >>> 0, registers: [...registers], crc: 0, crcHex: "" },
        };
        step += 1;
    }

    const crc = (register ^ INITIAL) >>> 0;
    yield {
        stepNumber: step,
        entities: makeCells(bytes, -1, true),
        edges: [],
        description: `CRC-32 = 0x${crc.toString(16).padStart(8, "0")} (${crc}).`,
        codeLineNumber: 4,
        layout: "grid",
        meta: { rows: 1, cols: bytes.length, register: register >>> 0, registers, crc, crcHex: crc.toString(16).padStart(8, "0"), done: true },
    };
}

/** The CRC-32 module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "A checksum is a compact fingerprint of a message. CRC-32 views the bytes as coefficients of a binary polynomial and keeps the remainder after division by a fixed generator. In the reflected implementation the register shifts right once per bit, and a set low bit triggers an XOR with the reversed generator.",
        invariants: [
            "The register is always a 32-bit value, kept unsigned by the final shift.",
            "Each byte changes the register through exactly eight bit steps.",
            "Identical messages produce identical checksums, and changing one bit changes the checksum.",
        ],
        correctness:
            "Polynomial long division in GF(2) is exactly the shift and conditional XOR loop: shifting by one bit corresponds to multiplying the remainder by x, and XORing the generator when the outgoing bit is set is the subtraction step. Starting and ending with an inverted register is the CRC-32 convention. Therefore the loop yields the IEEE 802.3 CRC-32 of the message, which matches the standard check value for the string 123456789.",
        complexityRationale:
            "Each of the n bytes is processed with eight shift-and-XOR steps, so the time is O(8n), that is O(n). Only the byte cells and the running register are stored, giving O(n) space for the display and O(1) for the computation.",
        uses: [
            "Integrity checks in zip, gzip, and PNG files",
            "Frame check sequences in Ethernet and other network links",
            "Fast detection of accidental data corruption",
        ],
        references: [
            "IEEE 802.3, Carrier Sense Multiple Access with Collision Detection",
            "Peterson and Brown, Cyclic Redundancy Check Codes, 1961",
        ],
        workedExample:
            "For the nine ASCII bytes of 123456789, the reflected loop with initial and final inversion produces the register 0xCBF43926. This is the canonical CRC-32 check value, so an implementation that prints the same number agrees with the standard.",
    },
    id: "crc32-checksum",
    name: "CRC-32 Checksum",
    category: "production-systems",
    complexity: { time: "O(8 * n)", space: "O(n)" },
    defaultInput: { text: "123456789" },
    visualType: "grid",
    run,
    pseudocode: [
        "initialize the register to all one bits",
        "for each byte of the message",
        "XOR the byte into the low eight bits of the register",
        "repeat eight times: shift right one bit and XOR the polynomial when the low bit was set",
        "record the register after the byte",
        "invert the register to form the final checksum",
        "done: report the checksum in decimal and hexadecimal",
    ],
};

export default module;
