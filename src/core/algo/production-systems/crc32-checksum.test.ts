/**
 * crc32-checksum.test.ts - Standard check vectors, bit-flip property, frame
 * shape, termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./crc32-checksum";
import type { VisualFrame } from "@/types";

function checkFrames(frames: VisualFrame[], byteCount: number): void {
    expect(frames.length).toBe(byteCount + 2);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("grid");
        expect(frame.entities.length).toBe(byteCount);
        expect(frame.entities.every((e) => e.type === "cell")).toBe(true);
        expect(frame.meta["rows"]).toBe(1);
        expect(frame.meta["cols"]).toBe(byteCount);
        expect(frame.edges).toEqual([]);
        expect(frame.description.length).toBeGreaterThan(0);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
    });
}

function crcOf(text: string): number {
    return Number([...mod.run({ text })].at(-1)?.meta["crc"]);
}

describe("Crc32Checksum", () => {
    it("matches the canonical CRC-32 check values", () => {
        const vectors: Array<[string, number]> = [
            ["", 0x00000000],
            ["a", 0xe8b7be43],
            ["123456789", 0xcbf43926],
            ["hello", 0x3610a686],
            ["The quick brown fox jumps over the lazy dog", 0x414fa339],
            ["abcdefghijklmnopqrstuvwxyz", 0x4c2750bd],
        ];
        for (const [text, expected] of vectors) {
            const frames = [...mod.run({ text })];
            checkFrames(frames, text.length);
            expect(frames[frames.length - 1]?.meta["crc"]).toBe(expected);
        }
    });

    it("accepts explicit byte arrays", () => {
        const frames = [...mod.run({ bytes: [49, 50, 51, 52, 53, 54, 55, 56, 57] })];
        checkFrames(frames, 9);
        expect(frames[frames.length - 1]?.meta["crc"]).toBe(0xcbf43926);
    });

    it("changes the checksum when a single bit changes", () => {
        const original = crcOf("a message that is long enough to check");
        const bytes = Array.from("a message that is long enough to check", (c) => c.charCodeAt(0));
        bytes[10]! ^= 0x01;
        const flipped = [...mod.run({ bytes })].at(-1)?.meta["crc"];
        expect(flipped).not.toBe(original);
    });

    it("tracks one register per absorbed byte", () => {
        const frames = [...mod.run({ text: "abcd" })];
        checkFrames(frames, 4);
        const registers = frames[frames.length - 1]?.meta["registers"] as number[];
        expect(registers.length).toBe(4);
        for (const register of registers) {
            expect(register).toBeGreaterThanOrEqual(0);
            expect(register).toBeLessThanOrEqual(0xffffffff);
        }
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) {
            count += 1;
        }
        expect(count).toBe(11);
        expect(generator.next().done).toBe(true);
    });
});
