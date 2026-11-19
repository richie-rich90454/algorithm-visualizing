import { describe, expect, it } from "vitest";
import mod from "./number-field-sieve";
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

describe("Number Field Sieve", () => {
    it("finds a verified nontrivial factor on the default", () => {
        const frames = [...mod.run(mod.defaultInput)];
        checkFrames(frames);
        const n = 253;
        const final = frames[frames.length - 1]?.meta;
        const factor = final?.["factor"] as number;
        expect(factor).toBeGreaterThan(1);
        expect(factor).toBeLessThan(n);
        expect(n % factor).toBe(0);
        expect(final?.["cofactor"]).toBe(n / factor);
    });

    it("selects a polynomial with f(m) = n", () => {
        const frames = [...mod.run(mod.defaultInput)];
        const first = frames[0]?.meta;
        const m = first?.["m"] as number;
        const r = first?.["r"] as number;
        expect(m * m + r).toBe(253);
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBeGreaterThan(0);
        expect(generator.next().done).toBe(true);
    });
});
