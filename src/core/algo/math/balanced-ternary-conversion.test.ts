/** balanced-ternary-conversion.test.ts - Correctness, frame shape, and termination. */

import { describe, expect, it } from "vitest";
import mod from "./balanced-ternary-conversion";
import type { VisualFrame } from "@/types";

function reference(nInput: number): number[] {
    let n = Math.trunc(nInput);
    if (n === 0) {
        return [0];
    }
    const digits: number[] = [];
    while (n !== 0) {
        const q = Math.floor(n / 3);
        const r = n - 3 * q;
        if (r === 2) {
            digits.push(-1);
            n = q + 1;
        } else {
            digits.push(r);
            n = q;
        }
    }
    return digits;
}

function reconstruct(digits: number[]): number {
    return digits.reduce((sum, d, i) => sum + d * 3 ** i, 0);
}

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("grid");
        expect(frame.entities.length).toBeGreaterThan(0);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

describe("Balanced ternary conversion", () => {
    it("matches a reference and reconstructs every integer in range", () => {
        for (let n = -300; n <= 300; n += 1) {
            const frames = [...mod.run({ n })];
            checkFrames(frames);
            const final = frames[frames.length - 1]?.meta;
            const digits = final?.["digits"] as number[] | undefined;
            expect(digits).toEqual(reference(n));
            expect(digits?.every((d) => d === -1 || d === 0 || d === 1)).toBe(true);
            expect(reconstruct(digits ?? [])).toBe(n);
            expect(final?.["reconstructed"]).toBe(n);
        }
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) {
            count += 1;
        }
        expect(count).toBeGreaterThan(2);
        expect(generator.next().done).toBe(true);
    });
});
