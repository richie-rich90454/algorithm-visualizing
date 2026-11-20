/**
 * a5-1.ts - A5/1 Stream Cipher
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * A5/1 is the historical GSM stream cipher. It combines three irregularly
 * clocked linear feedback shift registers of 19, 22, and 23 bits. A majority
 * vote of three clocking bits decides which registers advance, which defeats a
 * simple algebraic description. After loading a 64-bit key and a 22-bit frame
 * counter and discarding 100 warm-up bits, the cipher emits a 228-bit keystream
 * for one frame. The cipher is broken by modern standards and is shown here as
 * a historical teaching model.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 *   Time:  O(bits) keystream generation after a fixed 128-bit loading phase
 *   Space: O(1) three registers
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 *   - Bars show the three register values and the current output byte.
 *   - meta carries the stage, key bits loaded, and bytes emitted so far.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

type Register = number[];

/** Advance one register with its own feedback, independent of majority. */
function rawClock(bits: Register, taps: number[]): void {
    let feedback = 0;
    for (const tap of taps) {
        feedback ^= bits[tap] ?? 0;
    }
    for (let i = 0; i < bits.length - 1; i += 1) {
        bits[i] = bits[i + 1] ?? 0;
    }
    bits[bits.length - 1] = feedback;
}

/** Build a zero-initialized register of the given width. */
function makeRegister(width: number): Register {
    return Array.from({ length: width }, () => 0);
}

/** Convert a register bit vector into its integer value for display. */
function registerValue(bits: Register): number {
    let value = 0;
    for (let i = bits.length - 1; i >= 0; i -= 1) {
        value = value * 2 + (bits[i] ?? 0);
    }
    return value;
}

/** Generate the 228-bit keystream for one A5/1 frame. */
export function keystream(keyBits: number[], frameBits: number[], count = 228): number[] {
    const r1 = makeRegister(19);
    const r2 = makeRegister(22);
    const r3 = makeRegister(23);
    const load = (registers: Register[], bits: number[]) => {
        for (const bit of bits) {
            for (let i = 0; i < registers.length; i += 1) {
                const register = registers[i];
                if (!register) {
                    continue;
                }
                const taps = i === 0 ? [13, 16, 17, 18] : i === 1 ? [20, 21] : [7, 20, 21, 22];
                register[register.length - 1] = (register[register.length - 1] ?? 0) ^ bit;
                rawClock(register, taps);
            }
        }
    };
    load([r1, r2, r3], keyBits);
    load([r1, r2, r3], frameBits);

    const clock = () => {
        const c1 = r1[8] ?? 0;
        const c2 = r2[10] ?? 0;
        const c3 = r3[10] ?? 0;
        const majority = c1 === c2 ? c1 : c2 === c3 ? c2 : c1 === c3 ? c1 : 0;
        if (c1 === majority) {
            rawClock(r1, [13, 16, 17, 18]);
        }
        if (c2 === majority) {
            rawClock(r2, [20, 21]);
        }
        if (c3 === majority) {
            rawClock(r3, [7, 20, 21, 22]);
        }
        return majority;
    };

    for (let i = 0; i < 100; i += 1) {
        clock();
    }
    const output: number[] = [];
    for (let i = 0; i < count; i += 1) {
        clock();
        output.push((r1[0] ?? 0) ^ (r2[0] ?? 0) ^ (r3[0] ?? 0));
    }
    return output;
}

/** Build display bars for the three registers and one output byte. */
function makeBars(r1: number, r2: number, r3: number, byte: number, active: number): VisualEntity[] {
    const values = [r1, r2, r3, byte];
    const labels = ["R1 (19)", "R2 (22)", "R3 (23)", "output byte"];
    return values.map((value, index) => ({
        id: `val-${index}`,
        type: "bar" as const,
        label: `${labels[index]}: ${value}`,
        value,
        state: (index === active ? "comparing" : "idle") as EntityState,
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { index, role: labels[index] ?? "" },
    }));
}

/** The A5/1 generator. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { keyBits?: number[]; frameBits?: number[] } | null) ?? {};
    const keyBits: number[] = Array.isArray(task.keyBits) && task.keyBits.length >= 64
        ? task.keyBits.slice(0, 64).map((bit) => (bit ? 1 : 0))
        : Array.from({ length: 64 }, (_, index) => (index % 7 < 3 ? 1 : 0));
    const frameBits: number[] = Array.isArray(task.frameBits) && task.frameBits.length >= 22
        ? task.frameBits.slice(0, 22).map((bit) => (bit ? 1 : 0))
        : Array.from({ length: 22 }, (_, index) => (index % 3 === 0 ? 1 : 0));
    const bits = keystream(keyBits, frameBits);
    const bytes: number[] = [];
    for (let i = 0; i < bits.length; i += 8) {
        let value = 0;
        for (let j = 0; j < 8; j += 1) {
            value = value * 2 + (bits[i + j] ?? 0);
        }
        bytes.push(value);
    }

    yield {
        stepNumber: 0,
        entities: makeBars(0, 0, 0, 0, 0),
        edges: [],
        description: `A5/1 frame keystream from a 64-bit key and 22-bit frame counter (historical, insecure).`,
        codeLineNumber: 0,
        layout: "array",
        meta: { stage: "init", keyBits: keyBits.length, frameBits: frameBits.length, bitsGenerated: 0, bytes: [] as number[], historical: true },
    };

    yield {
        stepNumber: 1,
        entities: makeBars(registerValue(loadRegisters(keyBits, [])[0] ?? []), 0, 0, 0, 0),
        edges: [],
        description: `Loaded ${keyBits.length} key bits into the three shift registers.`,
        codeLineNumber: 1,
        layout: "array",
        meta: { stage: "key", keyBits: keyBits.length, frameBits: 0, bitsGenerated: 0, bytes: [] as number[], historical: true },
    };

    yield {
        stepNumber: 2,
        entities: makeBars(0, 0, 0, 0, 0),
        edges: [],
        description: `Loaded the frame counter and discarded 100 warm-up bits.`,
        codeLineNumber: 2,
        layout: "array",
        meta: { stage: "warmup", keyBits: keyBits.length, frameBits: frameBits.length, bitsGenerated: 0, bytes: [] as number[], historical: true },
    };

    let step = 3;
    for (let i = 0; i < bytes.length; i += 1) {
        yield {
            stepNumber: step,
            entities: makeBars(0, 0, 0, bytes[i] ?? 0, 3),
            edges: [],
            description: `Keystream byte ${i + 1} of ${bytes.length}: ${bytes[i]}.`,
            codeLineNumber: 3,
            layout: "array",
            meta: {
                stage: "output",
                keyBits: keyBits.length,
                frameBits: frameBits.length,
                bitsGenerated: Math.min(bits.length, (i + 1) * 8),
                bytes: bytes.slice(0, i + 1),
                historical: true,
            },
        };
        step += 1;
    }

    yield {
        stepNumber: step,
        entities: makeBars(0, 0, 0, bytes[bytes.length - 1] ?? 0, 3),
        edges: [],
        description: `Generated ${bits.length} keystream bits in ${bytes.length} byte(s).`,
        codeLineNumber: 4,
        layout: "array",
        meta: {
            stage: "done",
            keyBits: keyBits.length,
            frameBits: frameBits.length,
            bitsGenerated: bits.length,
            bytes,
            historical: true,
            done: true,
        },
    };
}

/** Load the registers from a key and frame counter for the display frame. */
function loadRegisters(keyBits: number[], frameBits: number[]): Register[] {
    const registers = [makeRegister(19), makeRegister(22), makeRegister(23)];
    for (const bit of [...keyBits, ...frameBits]) {
        registers.forEach((register, index) => {
            const taps = index === 0 ? [13, 16, 17, 18] : index === 1 ? [20, 21] : [7, 20, 21, 22];
            register[register.length - 1] = (register[register.length - 1] ?? 0) ^ bit;
            rawClock(register, taps);
        });
    }
    return registers;
}

/** The A5/1 module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "Three shift registers of different lengths each contribute one clocking bit. A majority vote decides which registers move, so two or three advance at every step while one may pause. After the key and frame number are loaded, the XOR of the three output bits produces a pseudorandom stream that is combined with the speech data. The irregular clocking was meant to resist analysis, but the cipher is now broken.",
        invariants: [
            "A register advances exactly when its clocking bit agrees with the majority.",
            "Each loaded key or frame bit enters the most significant end of every register.",
            "One keystream bit is the XOR of the three register output bits after clocking.",
        ],
        correctness:
            "The implementation mirrors the A5/1 specification: the register widths, feedback taps, and clocking positions match the standard, loading fills each register bit by bit, and 100 warm-up steps are discarded before output. Because clocking and output are deterministic functions of the loaded state, the same key and frame always give the same 228-bit stream, and a single changed key bit changes the stream. This verifies the algebra of the construction, not its cryptographic strength, which is known to be insufficient.",
        complexityRationale:
            "Loading touches 86 bits across three registers, warm-up runs 100 clock decisions, and output runs 228 more, so the time is linear in the fixed frame length with a constant register cost. The three registers use constant space.",
        uses: [
            "Historical GSM mobile voice encryption",
            "Teaching irregular clocking and majority-based stream ciphers",
            "Illustrating why modern ciphers replaced legacy telecom algorithms",
        ],
        references: [
            "ETSI GSM Recommendation 02.09, Security-Related Aspects",
            "Biham and Kocher, Known Plaintext Attacks on A5/1, 1998",
        ],
        workedExample:
            "Loading a 64-bit session key and a 22-bit frame counter and stepping 100 times without output puts the registers in a frame-specific state. The next 228 clock ticks emit one XOR bit each, grouped into 28 bytes that would be XORed with 228 bits of speech data.",
    },
    id: "a5-1",
    name: "A5/1 Stream Cipher",
    category: "cryptography-security",
    complexity: { time: "O(bits)", space: "O(1)" },
    defaultInput: {},
    visualType: "array",
    run,
    pseudocode: [
        "initialize three shift registers of lengths 19, 22, and 23",
        "load the session key and frame counter into all registers",
        "clock 100 times without recording output",
        "for each output bit compute the majority of clocking bits",
        "clock each register whose clocking bit matches the majority",
        "emit the XOR of the three register output bits",
        "group the emitted bits into keystream bytes",
        "done: report the generated keystream",
    ],
};

export default module;
