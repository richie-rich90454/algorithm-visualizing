/** fletchers-checksum.test.ts - Correctness, frame shape, and termination checks. */

import { describe, expect, it } from "vitest";
import mod from "./fletchers-checksum";
import type { VisualFrame } from "@/types";

/** Independent reference for Fletcher-16. */
function reference(bytes: number[]): number {
    let s1 = 0;
    let s2 = 0;
    for (const byte of bytes) {
        s1 = (s1 + byte) % 255;
        s2 = (s2 + s1) % 255;
    }
    return ((s2 & 0xff) << 8) | (s1 & 0xff);
}

/** Check that a frame sequence is well formed. */
function checkFrames(frames: VisualFrame[], expectedBytes: number): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(frame.entities.length).toBe(expectedBytes);
        expect(frame.entities.every((e) => e.type === "bar")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

describe("Fletcher's Checksum", () => {
    it("matches the published single-byte vector", () => {
        const frames = [...mod.run({ bytes: [0x61] })];
        checkFrames(frames, 1);
        expect(frames[frames.length - 1]?.meta["checksum"]).toBe(0x6161);
    });

    it("matches an independent reference on random messages", () => {
        let seed = 4242;
        const next = (): number => {
            seed = (seed * 1103515245 + 12345) & 0x7fffffff;
            return seed & 0xff;
        };
        for (let trial = 0; trial < 40; trial += 1) {
            const bytes = Array.from({ length: trial % 17 }, () => next());
            const frames = [...mod.run({ bytes })];
            checkFrames(frames, bytes.length);
            const final = frames[frames.length - 1];
            expect(final?.meta["checksum"]).toBe(reference(bytes));
            expect(Number(final?.meta["checksum"])).toBeGreaterThanOrEqual(0);
            expect(Number(final?.meta["checksum"])).toBeLessThanOrEqual(0xffff);
            for (let i = 0; i < bytes.length; i += 1) {
                const s1 = Number(frames[i + 1]?.meta["sum1"]);
                const s2 = Number(frames[i + 1]?.meta["sum2"]);
                let r1 = 0;
                let r2 = 0;
                for (let k = 0; k <= i; k += 1) {
                    r1 = (r1 + (bytes[k] as number)) % 255;
                    r2 = (r2 + r1) % 255;
                }
                expect(s1).toBe(r1);
                expect(s2).toBe(r2);
            }
        }
    });

    it("returns zero for zero bytes and preserves non-letter text bytes", () => {
        expect([...mod.run({ bytes: [0, 0, 0, 0] })][3]?.meta["checksum"]).toBe(0);
        const ascii = [..."abcde"].map((ch) => ch.charCodeAt(0));
        const fromText = [...mod.run({ text: "abcde" })];
        const fromBytes = [...mod.run({ bytes: ascii })];
        expect(fromText[fromText.length - 1]?.meta["checksum"]).toBe(
            fromBytes[fromBytes.length - 1]?.meta["checksum"],
        );
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBeGreaterThan(0);
        expect(generator.next().done).toBe(true);
    });
});
