/** chakravala-method.test.ts - Correctness, frame shape, and termination checks. */

import { describe, expect, it } from "vitest";
import mod from "./chakravala-method";
import type { VisualFrame } from "@/types";

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
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

describe("Chakravala Method", () => {
    it("solves Pell's equation for every nonsquare D from 2 to 120", () => {
        for (let D = 2; D <= 120; D += 1) {
            if (Number.isInteger(Math.sqrt(D))) {
                continue;
            }
            const frames = [...mod.run({ D })];
            checkFrames(frames);
            const final = frames[frames.length - 1]?.meta;
            expect(final?.["solved"], `D=${D}`).toBe(true);
            const x = BigInt(final?.["x"] as number);
            const y = BigInt(final?.["y"] as number);
            expect(x * x - BigInt(D) * y * y, `x^2 - ${D} y^2`).toBe(1n);
            expect(x).toBeGreaterThan(0);
            expect(y).toBeGreaterThan(0);
        }
    });

    it("gives the known smallest solution for D = 61", () => {
        const frames = [...mod.run({ D: 61 })];
        const final = frames[frames.length - 1]?.meta;
        expect(final?.["x"]).toBe(1766319049);
        expect(final?.["y"]).toBe(226153980);
    });

    it("handles a perfect square D", () => {
        const frames = [...mod.run({ D: 49 })];
        expect(frames[frames.length - 1]?.meta["y"]).toBe(0);
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
