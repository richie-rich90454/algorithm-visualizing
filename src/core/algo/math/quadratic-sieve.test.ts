import { describe, expect, it } from "vitest";
import mod from "./quadratic-sieve";
import type { VisualFrame } from "@/types";

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

describe("Quadratic Sieve", () => {
    it("factors the default composite with a verified congruence", () => {
        const frames = [...mod.run(mod.defaultInput)];
        checkFrames(frames);
        const final = frames[frames.length - 1]?.meta;
        const n = 8051;
        const factor = final?.["factor"] as number;
        expect(factor).toBeGreaterThan(1);
        expect(factor).toBeLessThan(n);
        expect(n % factor).toBe(0);
        expect(final?.["cofactor"]).toBe(n / factor);
        const X = final?.["X"] as number;
        const Y = final?.["Y"] as number;
        expect((X * X - Y * Y) % n).toBe(0);
    });

    it("factors a second composite", () => {
        const frames = [...mod.run({ n: 493, B: 15 })];
        const factor = frames[frames.length - 1]?.meta["factor"] as number;
        expect(factor).toBeGreaterThan(1);
        expect(493 % factor).toBe(0);
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBeGreaterThan(0);
        expect(generator.next().done).toBe(true);
    });
});
