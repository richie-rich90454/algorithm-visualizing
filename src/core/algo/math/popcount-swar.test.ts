import { describe, expect, it } from "vitest";
import mod from "./popcount-swar";
import type { VisualFrame } from "@/types";

function reference(value: number): number {
    let v = value >>> 0;
    let count = 0;
    while (v) { count += v & 1; v = v >>> 1; }
    return count;
}
function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, i) => {
        expect(frame.stepNumber).toBe(i);
        expect(frame.layout).toBe("grid");
        expect(frame.entities.length).toBeGreaterThan(0);
        expect(frame.entities.every((e) => e.type === "cell")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

describe("Popcount SWAR", () => {
    it("matches a bitwise reference across edge cases", () => {
        const values = [0, 1, 2, 3, 255, 256, 0x55555555, 0xffffffff, 0b10110100110010101111000011001010];
        for (const value of values) {
            const frames = [...mod.run({ value })];
            checkFrames(frames);
            const count = frames[frames.length - 1]?.meta["count"];
            expect(count).toBe(reference(value));
        }
    });

    it("matches a brute-force counter on random words", () => {
        let seed = 12345;
        for (let t = 0; t < 40; t += 1) {
            seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
            const frames = [...mod.run({ value: seed })];
            expect(frames[frames.length - 1]?.meta["count"]).toBe(reference(seed));
        }
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBeGreaterThan(0);
        expect(generator.next().done).toBe(true);
    });
});
