import { describe, expect, it } from "vitest";
import mod from "./bit-reversal";
import type { VisualFrame } from "@/types";

function referenceOrder(n: number): number[] {
    const k = Math.log2(n);
    const rev: number[] = [];
    for (let i = 0; i < n; i += 1) {
        rev.push(parseInt(i.toString(2).padStart(k, "0").split("").reverse().join(""), 2));
    }
    return rev;
}
function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, i) => {
        expect(frame.stepNumber).toBe(i);
        expect(frame.layout).toBe("array");
        expect(frame.entities.length).toBeGreaterThan(0);
        expect(frame.entities.every((e) => e.type === "bar")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

describe("Bit Reversal", () => {
    it("produces the exact binary-reversal permutation", () => {
        for (const n of [2, 4, 8, 16, 32]) {
            const frames = [...mod.run({ n })];
            checkFrames(frames);
            const expected = referenceOrder(n);
            const final = frames[frames.length - 1]?.meta;
            expect(final?.["order"]).toEqual(expected);
            expect(final?.["reversible"]).toEqual(expected);
            // involution property
            expected.forEach((j, i) => expect(expected[j as number]).toBe(i));
        }
    });

    it("uses the classic n=8 order", () => {
        const frames = [...mod.run({ n: 8 })];
        expect(frames[frames.length - 1]?.meta["order"]).toEqual([0, 4, 2, 6, 1, 5, 3, 7]);
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBeGreaterThan(0);
        expect(generator.next().done).toBe(true);
    });
});
