/**
 * williams-p-plus-one.test.ts - Genuine factor verification by divisibility,
 * frame shape, termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./williams-p-plus-one";
import type { VisualFrame } from "@/types";

function checkFrames(frames: VisualFrame[]): void {
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(frame.entities.length).toBeGreaterThan(0);
        expect(frame.entities.every((e) => e.type === "bar")).toBe(true);
        expect(frame.edges).toEqual([]);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode!.length);
        expect(frame.meta).toBeDefined();
        expect(Array.isArray(frame.meta["gcds"])).toBe(true);
    });
}

function factorOf(n: number): number {
    const frames = [...mod.run({ n, bound: 15, maxParameters: 16 })];
    checkFrames(frames);
    const meta = frames[frames.length - 1]!.meta;
    return meta["factor"] as number;
}

describe("WilliamsPPlusOne", () => {
    it("finds genuine nontrivial factors for smooth p+1 primes", () => {
        for (const p of [11, 13, 19, 23, 29, 31]) {
            const n = p * 37;
            const factor = factorOf(n);
            expect(factor).toBeGreaterThan(1);
            expect(factor).toBeLessThan(n);
            expect(n % factor).toBe(0);
            const frames = [...mod.run({ n, bound: 15, maxParameters: 16 })];
            expect(frames[frames.length - 1]!.meta["cofactor"]).toBe(n / factor);
        }
    });

    it("finds the default factor of 407", () => {
        const frames = [...mod.run(mod.defaultInput)];
        checkFrames(frames);
        const meta = frames[frames.length - 1]!.meta;
        expect(meta["factor"]).toBe(11);
        expect(meta["cofactor"]).toBe(37);
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBeGreaterThan(0);
        expect(generator.next().done).toBe(true);
    });
});
