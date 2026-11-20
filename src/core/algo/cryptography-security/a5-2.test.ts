/**
 * a5-2.test.ts - LFSR transition reference, clock-mask and keystream
 * properties, frame shape, and termination.
 */

import { describe, expect, it } from "vitest";
import mod, { a52Init, a52Keystream, a52Step, clockLfsr } from "./a5-2";
import type { VisualFrame } from "@/types";

function checkFrames(frames: VisualFrame[], bits: number): void {
    expect(frames.length).toBe(bits + 2);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(frame.entities.length).toBe(bits);
        expect(frame.entities.every((e) => e.type === "bar")).toBe(true);
        expect(frame.edges).toEqual([]);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
    });
}

describe("A5/2 Stream Cipher", () => {
    it("clocks LFSRs with the correct feedback and fixed length", () => {
        const register = [1, 0, 0, 1, 1];
        const before = [...register];
        const feedback = clockLfsr(register, [0, 3]);
        expect(feedback).toBe(before[0] ^ before[3]);
        expect(register.length).toBe(5);
        expect(register[0]).toBe(feedback);
        expect(register.slice(1)).toEqual(before.slice(0, 4));
    });

    it("produces deterministic keystream bits within the valid range", () => {
        const key = [0x12, 0x34, 0x56, 0x78];
        const first = a52Keystream(key, 200);
        const second = a52Keystream(key, 200);
        expect(first).toEqual(second);
        expect(first.length).toBe(200);
        expect(first.every((bit) => bit === 0 || bit === 1)).toBe(true);
        expect(a52Keystream([1, 2, 3], 100)).not.toEqual(a52Keystream([4, 5, 6], 100));
    });

    it("clocks at least two main registers on every step", () => {
        const state = a52Init([0x12, 0x34, 0x56, 0x78, 0x9a, 0xbc, 0xde, 0xf0]);
        for (let i = 0; i < 100; i += 1) {
            const { mask, bit } = a52Step(state);
            expect(mask[0] + mask[1] + mask[2]).toBeGreaterThanOrEqual(2);
            expect(bit === 0 || bit === 1).toBe(true);
        }
    });

    it("replays the same bits in its frames as a direct keystream call", () => {
        const key = [0x10, 0x20, 0x30, 0x40];
        const bits = 24;
        const frames = [...mod.run({ key, bits })];
        checkFrames(frames, bits);
        const expected = a52Keystream(key, bits);
        frames.slice(1, -1).forEach((frame, index) => {
            expect(frame.entities[index]?.value).toBe(expected[index]);
        });
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBeGreaterThan(0);
        expect(generator.next().done).toBe(true);
    });
});
