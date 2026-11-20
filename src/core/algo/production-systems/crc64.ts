/**
 * crc64.ts - CRC-64/ECMA-182 Checksum
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * CRC-64/ECMA-182 treats the message as a polynomial over GF(2) and divides
 * it by a fixed 64-bit generator. The remainder is appended as a checksum that
 * detects any burst error shorter than 64 bits and all odd-bit errors. This
 * module uses the generator constant 0x42F0E1EBA9EA3693 with the most
 * significant bit processed first and no register inversion, the parameter
 * set whose check value for "123456789" is 6C40DF5F0B497347.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(8 * n) bit steps for n input bytes
 *   Space: O(n) for the displayed byte cells
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - One bar per input byte shows its numeric value.
 *   - The byte currently being absorbed is highlighted; absorbed bytes turn
 *     green.
 *   - meta tracks the running register and the final 64-bit checksum.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

const MASK = 0xffffffffffffffffn;
const POLY = 0x42f0e1eba9ea3693n;
const TOP = 0x8000000000000000n;

interface Crc64Input {
    text?: string;
    bytes?: number[];
}

/** Turn text into ASCII bytes, or sanitize a provided byte list. */
export function toBytes(task: Crc64Input): number[] {
    if (Array.isArray(task.bytes)) {
        return task.bytes.map((b) => ((Math.floor(b) & 0xff) + 256) % 256);
    }
    const source = typeof task.text === "string" ? task.text : "123456789";
    return Array.from(source, (ch) => ch.charCodeAt(0) & 0xff);
}

/** Process one byte into the running CRC-64 register. */
export function absorb(crc: bigint, byte: number): bigint {
    let value = (crc ^ (BigInt(byte) << 56n)) & MASK;
    for (let bit = 0; bit < 8; bit += 1) {
        value = value & TOP ? ((value << 1n) ^ POLY) & MASK : (value << 1n) & MASK;
    }
    return value;
}

/** Compute the full CRC-64/ECMA-182 register for a byte list. */
export function crc64(bytes: number[]): bigint {
    return bytes.reduce((acc, byte) => absorb(acc, byte), 0n);
}

function makeEntities(bytes: number[], active: number, done: number): VisualEntity[] {
    return bytes.map((value, index) => ({
        id: `byte-${index}`,
        type: "bar" as const,
        label: String(value),
        value,
        state: (index < done ? "sorted" : index === active ? "comparing" : "idle") as EntityState,
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { index, value },
    }));
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as Crc64Input | null) ?? {};
    const bytes = toBytes(task);
    let register = 0n;
    let step = 0;

    yield {
        stepNumber: step,
        entities: makeEntities(bytes, -1, 0),
        edges: [],
        description: `Computing a 64-bit cyclic redundancy check over ${bytes.length} byte(s).`,
        codeLineNumber: 0,
        layout: "array",
        meta: { bytes: bytes.length, register: "0", checksum: "0" },
    };
    step += 1;

    for (let i = 0; i < bytes.length; i += 1) {
        const byte = bytes[i] ?? 0;
        register = absorb(register, byte);
        yield {
            stepNumber: step,
            entities: makeEntities(bytes, i, i + 1),
            edges: [],
            description: `Byte ${i} (${byte}) absorbed; register is now 0x${register.toString(16).padStart(16, "0")}.`,
            codeLineNumber: 2,
            layout: "array",
            meta: { bytes: bytes.length, register: register.toString(16), checksum: register.toString(16) },
        };
        step += 1;
    }

    yield {
        stepNumber: step,
        entities: makeEntities(bytes, -1, bytes.length),
        edges: [],
        description: `Final CRC-64/ECMA-182 checksum: 0x${register.toString(16).padStart(16, "0")}.`,
        codeLineNumber: 4,
        layout: "array",
        meta: { bytes: bytes.length, register: register.toString(16), checksum: register.toString(16) },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "A cyclic redundancy check views a message as a long binary number and takes the remainder after division by a fixed generator polynomial. Shifting one byte at a time makes the division cheap in hardware, yet the remainder still changes whenever the message changes in almost any way.",
        invariants: [
            "After each byte the register equals the remainder of the message prefix divided by the generator.",
            "The register is always a 64-bit value masked to the low 64 bits.",
            "A zero byte shifts the register eight times without introducing new bits.",
        ],
        correctness:
            "Polynomial long division in GF(2) is linear, so after all bytes the register is exactly the remainder of the message polynomial. Because the generator has degree 64 and a nonzero constant term, every burst error of length at most 64 and every error with an odd number of flipped bits changes that remainder, which is what makes the checksum a detector.",
        complexityRationale:
            "Each input byte requires eight conditional shifts and XORs, so the work is O(8n), linear in the message length. The visualization stores one bar per byte, giving O(n) display space while the register itself uses O(1) space.",
        uses: [
            "Integrity tags in storage and network protocols that need a wide, fast checksum",
            "Error detection in disk arrays and archive formats",
            "Fingerprinting blocks before a stronger cryptographic hash is applied",
        ],
        references: [
            "W. W. Peterson and D. T. Brown, Cyclic Codes for Error Detection, 1961",
            "ECMA-182, Data Interchange on 12.7 mm Magnetic Tape Cartridge, 1992",
        ],
        workedExample:
            "For the ASCII bytes of '123456789' the register starts at zero, absorbs nine bytes with eight shifts each, and ends at 0x6C40DF5F0B497347, the published check value for CRC-64/ECMA-182.",
    },
    id: "crc64",
    name: "CRC-64 Checksum",
    category: "production-systems",
    complexity: { time: "O(8n)", space: "O(n)" },
    defaultInput: { text: "123456789" },
    visualType: "array",
    run,
    pseudocode: [
        "set the 64-bit register to zero",
        "for each byte in the message",
        "x or the byte into the high eight bits of the register",
        "repeat eight times: shift left and x or the generator when the top bit is set",
        "mask the register to 64 bits after every shift",
        "done: the register is the CRC-64 checksum",
    ],
};

export default module;
