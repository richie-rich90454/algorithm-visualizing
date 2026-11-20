/**
 * delta-compression-gorilla.test.ts - Independent bitstream decoder, XOR properties, frame shape, termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./delta-compression-gorilla";
import type { VisualFrame } from "@/types";

function checkFrames(frames: VisualFrame[], n: number): void {
    expect(frames.length).toBe(n + 1);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(frame.entities.length).toBe(n);
        expect(frame.entities.every((e) => e.type === "bar")).toBe(true);
        expect(frame.edges).toEqual([]);
        expect(frame.description.length).toBeGreaterThan(0);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
    });
}

/** Independent Gorilla bitstream decoder. */
function decode(bitstream: string, first: number): number[] {
    let index = 0;
    let previous = first >>> 0;
    const output: number[] = [previous];
    let windowTrailing = 0;
    let windowMeaningful = 0;
    const read = (count: number): number => {
        let value = 0;
        for (let k = 0; k < count; k += 1) {
            value = (value * 2 + (bitstream[index++] === "1" ? 1 : 0)) >>> 0;
        }
        return value;
    };
    while (index < bitstream.length) {
        const firstBit = bitstream[index++];
        let xor = 0;
        if (firstBit === "1") {
            const secondBit = bitstream[index++];
            if (secondBit === "0") {
                const payload = read(windowMeaningful);
                xor = (payload << windowTrailing) >>> 0;
            } else {
                const leading = read(5);
                const meaningful = read(6);
                const payload = read(meaningful);
                xor = (payload << (32 - leading - meaningful)) >>> 0;
                windowTrailing = 32 - leading - meaningful;
                windowMeaningful = meaningful;
            }
        }
        const value = (previous ^ xor) >>> 0;
        output.push(value);
        previous = value;
    }
    return output;
}

describe("Gorilla delta compression (small XOR simulator)", () => {
    it("decodes the bitstream back to the exact input", () => {
        const sequences = [
            [100, 100, 100, 110, 110, 200, 200, 200, 205],
            [0, 1, 2, 3, 0, 1, 2, 3],
            [4294967295, 4294967294, 1, 1, 1],
            [7],
            [50, 50, 50, 50, 50],
        ];
        for (const values of sequences) {
            const frames = [...mod.run({ values })];
            checkFrames(frames, values.length);
            const meta = frames[frames.length - 1]?.meta;
            const stream = String(meta?.["bitstream"]);
            expect(stream.length).toBe(Number(meta?.["totalBits"]));
            expect(decode(stream, values[0]!)).toEqual(values.map((v) => v >>> 0));
        }
    });

    it("reports exact XOR deltas and bit counts", () => {
        const values = [100, 100, 100, 110, 110, 200, 200, 205, 205];
        const frames = [...mod.run({ values })];
        checkFrames(frames, values.length);
        const meta = frames[frames.length - 1]?.meta;
        const xors = meta?.["xors"] as number[];
        for (let i = 0; i < values.length; i += 1) {
            const expected = i === 0 ? 0 : (values[i]! ^ values[i - 1]!) >>> 0;
            expect(xors[i]).toBe(expected);
        }
        const bitsPerValue = meta?.["bitsPerValue"] as number[];
        expect(bitsPerValue.reduce((a, b) => a + b, 0)).toBe(Number(meta?.["totalBits"]));
        expect(Number(meta?.["rawBits"])).toBe(values.length * 32);
        expect(Number(meta?.["totalBits"])).toBeLessThan(Number(meta?.["rawBits"]));
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) {
            count += 1;
        }
        expect(count).toBe(10);
        expect(generator.next().done).toBe(true);
    });
});
