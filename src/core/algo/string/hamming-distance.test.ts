/** Correctness, frame shape, and termination checks for Hamming distance. */
import { describe, expect, it } from "vitest";
import mod from "./hamming-distance";
import type { VisualFrame } from "@/types";

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("grid");
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(Array.isArray(frame.entities)).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
        frame.entities.forEach((e) => expect(e.id).toBeTruthy());
    });
}

function brute(a: string, b: string): number {
    const n = Math.max(a.length, b.length);
    let count = 0;
    for (let i = 0; i < n; i += 1) if ((a[i] ?? "") !== (b[i] ?? "")) count += 1;
    return count;
}

describe("Hamming Distance", () => {
    const cases: Array<[string, string]> = [
        ["", ""],
        ["ABC", "ABC"],
        ["GATTACA", "GATCAGA"],
        ["101010", "111000"],
        ["AB", "ABCD"],
        ["", "AB"],
    ];
    for (const [a, b] of cases) {
        it(`counts mismatches for ${JSON.stringify(a)} vs ${JSON.stringify(b)}`, () => {
            const frames = [...mod.run({ a, b })];
            checkFrames(frames);
            const final = frames[frames.length - 1]?.meta;
            const expected = brute(a, b);
            expect(final?.["distance"]).toBe(expected);
            expect(final?.["compared"]).toBe(Math.max(a.length, b.length));
            const mismatches = final?.["mismatches"] as number[];
            expect(mismatches.length).toBe(expected);
        });
    }

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBeGreaterThan(0);
        expect(generator.next().done).toBe(true);
    });
});
