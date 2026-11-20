/** continued-fraction-factorization.test.ts - Correctness, frame shape, and termination checks. */

import { describe, expect, it } from "vitest";
import mod from "./continued-fraction-factorization";
import type { VisualFrame } from "@/types";

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
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

describe("Continued Fraction Factorization", () => {
    it("splits semiprimes into proper factors", () => {
        for (const n of [8051, 2491, 14273]) {
            const frames = [...mod.run({ n, bound: 50 })];
            checkFrames(frames);
            const factor = Number(frames[frames.length - 1]?.meta["factor"]);
            expect(factor, `factor for ${n}`).toBeGreaterThan(1);
            expect(factor).toBeLessThan(n);
            expect(n % factor).toBe(0);
        }
    });

    it("handles even numbers and perfect squares immediately", () => {
        expect([...mod.run({ n: 1024 })][0]?.meta["factor"]).toBe(2);
        expect([...mod.run({ n: 841 })][0]?.meta["factor"]).toBe(29);
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) {
            count += 1;
        }
        expect(count).toBeGreaterThan(0);
        expect(generator.next().done).toBe(true);
    });
});
